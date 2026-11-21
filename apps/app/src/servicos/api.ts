/**
 * Cliente da API do Uni Jovem.
 *
 * - Token de acesso só em memória (nunca em disco, nunca em log).
 * - Celular: refresh no Keychain/Keystore, renovado com `{ refresh }`.
 * - Web: refresh em cookie HttpOnly; renovação com corpo `{}`, cookie e o
 *   cabeçalho `x-uj-csrf: 1`. Com Web Locks, duas abas não renovam juntas.
 * - Renovação em fila única: a API derruba o aparelho se o mesmo refresh for
 *   usado duas vezes, então pedidos simultâneos que recebem 401
 *   `acesso_expirado` esperam a MESMA renovação e depois se repetem.
 */
import { Platform } from 'react-native'

import { plataformaAtual } from './aparelho'
import { criarArmazenamentoDoRefresh } from './armazenamentoDoRefresh'
import type { Plataforma, SessaoAberta } from './contrato'
import { ErroDaApi, MENSAGEM_GENERICA, SemConexao } from './erros'

export interface ArmazenamentoDoRefresh {
  ler(): Promise<string | null>
  gravar(valor: string): Promise<void>
  apagar(): Promise<void>
}

export type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface OpcoesDoPedido {
  metodo?: Metodo
  corpo?: unknown
  /** Padrão: true. Rotas públicas de autenticação passam `false`. */
  autenticado?: boolean
  /** Cancela o pedido (ex.: long polling ao sair da tela). Cancelado não vira "sem conexão". */
  sinal?: AbortSignal
  /**
   * Tempo limite deste pedido, em ms. Padrão: `TEMPO_LIMITE_MS`; long polling
   * (`depoisDaVersao=`) e envio grande ganham mais (ver `tempoLimitePara`).
   */
  tempoLimiteMs?: number
  /** `texto`: devolve o corpo cru (ex.: CSV de uma exportação). Padrão: JSON. */
  formato?: 'json' | 'texto'
}

export interface OpcoesDoCliente {
  /** Origem da API sem barra no fim (ex.: `https://unijovem.exemplo`); vazio = mesma origem. */
  baseUrl: string
  plataforma: Plataforma
  /** `null` na web: lá o refresh é um cookie HttpOnly. */
  armazenamento: ArmazenamentoDoRefresh | null
  fetch?: typeof fetch
  /** Serializa a renovação entre abas (Web Locks). Sem ela, roda direto. */
  comTrava?: <T>(trabalho: () => Promise<T>) => Promise<T>
}

export interface ClienteDaApi {
  pedir<T>(caminho: string, opcoes?: OpcoesDoPedido): Promise<T>
  get<T>(caminho: string, opcoes?: Pick<OpcoesDoPedido, 'sinal' | 'tempoLimiteMs'>): Promise<T>
  post<T>(
    caminho: string,
    corpo?: unknown,
    opcoes?: Omit<OpcoesDoPedido, 'metodo' | 'corpo'>,
  ): Promise<T>
  patch<T>(caminho: string, corpo?: unknown): Promise<T>
  put<T>(caminho: string, corpo?: unknown): Promise<T>
  delete<T>(caminho: string): Promise<T>
  /** Renova o acesso (fila única). `false` quando não há sessão para renovar. */
  renovar(): Promise<boolean>
  /** Guarda a sessão recém-aberta (entrar, segundo fator, convite). */
  abrirSessao(sessao: SessaoAberta): Promise<void>
  /** Troca só o token de acesso (ex.: o token com prova de 2FA recente). */
  definirAcesso(acesso: string): void
  /** Esquece acesso e refresh deste aparelho. */
  encerrarSessao(): Promise<void>
  temAcesso(): boolean
  /**
   * Baixa uma imagem protegida (foto de perfil, logotipo) e devolve uma `data:`
   * URI. O token de acesso fica aqui dentro: quem desenha recebe só a imagem.
   * `null` sem sessão, sem permissão (404) ou sem rede.
   */
  baixarImagem(caminho: string): Promise<string | null>
  /** Avisa quando a API encerrou a sessão (refresh inválido, aparelho revogado). */
  aoPerderSessao(ouvinte: () => void): () => void
}

const SESSAO_ENCERRADA = new Set(['sessao_invalida', 'nao_autenticado'])

/**
 * A6: tempo limite de um pedido comum. O `fetch` do React Native não tem um
 * útil: em Wi-Fi de igreja ou 4G fraco o pedido ficava pendurado, com a tela
 * carregando e o botão girando para sempre. Estourou: vira `SemConexao`.
 * D58: 12 s (eram 20). Com 1 nova tentativa nas leituras, a tela vira erro com
 * "Tentar de novo" em cerca de 25 s no pior caso (eram 60 s); escrita nunca se repete.
 */
export const TEMPO_LIMITE_MS = 12_000
/** O ao vivo segura a resposta até 25 s no servidor (long polling). */
export const TEMPO_LIMITE_LONG_POLLING_MS = 40_000
/** Foto e logotipo vão em base64 (até cerca de 2,7 MB): subida lenta no 4G. */
export const TEMPO_LIMITE_ENVIO_GRANDE_MS = 60_000
const ENVIO_GRANDE_CARACTERES = 256 * 1024

function tempoLimitePara(caminho: string, corpo: string | undefined): number {
  if (caminho.includes('depoisDaVersao=')) return TEMPO_LIMITE_LONG_POLLING_MS
  if (corpo && corpo.length > ENVIO_GRANDE_CARACTERES) return TEMPO_LIMITE_ENVIO_GRANDE_MS
  return TEMPO_LIMITE_MS
}

/** Remove a barra final para que `${base}/api/...` nunca vire `//api`. */
function normalizarBase(base: string): string {
  return base.replace(/\/+$/, '')
}

function interpretar(texto: string): unknown {
  if (!texto) return undefined
  try {
    return JSON.parse(texto) as unknown
  } catch {
    return undefined
  }
}

async function lerCorpo(resposta: Response): Promise<unknown> {
  return interpretar(await resposta.text())
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Base64 puro, sem depender de FileReader ou btoa (que variam entre celular, web e testes). */
export function emBase64(bytes: Uint8Array): string {
  let saida = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    saida += BASE64[a >> 2]
    saida += BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)]
    saida += b === undefined ? '=' : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)]
    saida += c === undefined ? '=' : BASE64[c & 63]
  }
  return saida
}

/** Bytes da imagem como `data:` URI (o expo-image e o navegador desenham direto). */
async function comoDataUri(resposta: Response): Promise<string> {
  const tipo = resposta.headers.get('content-type')?.split(';')[0] ?? 'image/webp'
  const bytes = new Uint8Array(await resposta.arrayBuffer())
  return `data:${tipo};base64,${emBase64(bytes)}`
}

function erroDoCorpo(status: number, corpo: unknown): ErroDaApi {
  if (corpo && typeof corpo === 'object') {
    const { erro, mensagem, atual, ...extra } = corpo as {
      erro?: unknown
      mensagem?: unknown
      atual?: unknown
    } & Record<string, unknown>
    if (typeof erro === 'string' && typeof mensagem === 'string') {
      // Conflito (409) traz o estado atual do servidor: a tela mostra em vez de sobrescrever.
      return new ErroDaApi(status, erro, mensagem, atual, extra)
    }
  }
  return new ErroDaApi(status, 'desconhecido', MENSAGEM_GENERICA)
}

export function criarClienteDaApi(opcoes: OpcoesDoCliente): ClienteDaApi {
  const base = normalizarBase(opcoes.baseUrl)
  const ehWeb = opcoes.plataforma === 'web'
  const { armazenamento } = opcoes
  const comTrava = opcoes.comTrava ?? (<T>(trabalho: () => Promise<T>) => trabalho())
  const ouvintesDePerda = new Set<() => void>()

  let acesso: string | null = null
  let renovacaoEmCurso: Promise<boolean> | null = null

  /**
   * Faz o pedido e lê o corpo com `ler`, tudo dentro do tempo limite (o corpo
   * também pode travar no meio). O sinal do chamador continua valendo: se ELE
   * cancelar, o erro de cancelamento sobe como está, não como "sem conexão".
   */
  async function chamar<T>(
    caminho: string,
    init: Omit<RequestInit, 'signal'> & { sinal?: AbortSignal | undefined; tempoLimiteMs?: number },
    ler: (resposta: Response) => Promise<T>,
  ): Promise<{ resposta: Response; corpo: T }> {
    const executar = opcoes.fetch ?? globalThis.fetch
    const { sinal, tempoLimiteMs, ...resto } = init
    const corpoEnviado = typeof resto.body === 'string' ? resto.body : undefined
    const limite = tempoLimiteMs ?? tempoLimitePara(caminho, corpoEnviado)
    // AbortSignal.any e AbortSignal.timeout não existem em todo Hermes: junta à mão.
    const controle = new AbortController()
    const repassar = () => controle.abort()
    if (sinal?.aborted) controle.abort()
    else sinal?.addEventListener('abort', repassar)
    let estourou = false
    const relogio = setTimeout(() => {
      estourou = true
      controle.abort()
    }, limite)
    try {
      const resposta = await executar(`${base}${caminho}`, {
        ...resto,
        signal: controle.signal,
        // Mesma origem na web: o cookie de refresh só viaja para /api/auth.
        ...(ehWeb ? { credentials: 'include' as const } : {}),
      })
      return { resposta, corpo: await ler(resposta) }
    } catch (erro) {
      // Cancelado de propósito (ex.: saiu da tela): não é falta de rede.
      if (sinal?.aborted && !estourou) throw erro
      // Sem resposta nenhuma (rede fora, servidor inalcançável) ou tempo esgotado.
      throw new SemConexao()
    } finally {
      clearTimeout(relogio)
      sinal?.removeEventListener('abort', repassar)
    }
  }

  function avisarPerda() {
    for (const ouvinte of ouvintesDePerda) ouvinte()
  }

  async function esquecerSessao() {
    acesso = null
    await armazenamento?.apagar()
  }

  async function executarRenovacao(): Promise<boolean> {
    let corpo: Record<string, string> = {}
    if (!ehWeb) {
      const refresh = await armazenamento?.ler()
      if (!refresh) return false
      corpo = { refresh }
    }
    const { resposta, corpo: dados } = await chamar(
      '/api/auth/renovar',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(ehWeb ? { 'x-uj-csrf': '1' } : {}),
        },
        body: JSON.stringify(corpo),
      },
      lerCorpo,
    )
    if (resposta.status === 401) {
      await esquecerSessao()
      return false
    }
    if (!resposta.ok) throw erroDoCorpo(resposta.status, dados)
    const sessao = dados as SessaoAberta
    acesso = sessao.acesso
    // O refresh antigo já não vale: grava o novo antes de liberar a fila.
    if (sessao.refresh && armazenamento) await armazenamento.gravar(sessao.refresh)
    return true
  }

  function renovar(): Promise<boolean> {
    if (!renovacaoEmCurso) {
      renovacaoEmCurso = comTrava(executarRenovacao).finally(() => {
        renovacaoEmCurso = null
      })
    }
    return renovacaoEmCurso
  }

  async function pedir<T>(caminho: string, op: OpcoesDoPedido = {}): Promise<T> {
    const autenticado = op.autenticado ?? true
    const metodo = op.metodo ?? 'GET'

    if (autenticado && !acesso && !(await renovar())) {
      avisarPerda()
      throw new ErroDaApi(401, 'nao_autenticado', 'Entre para continuar.')
    }

    for (let tentativa = 0; ; tentativa++) {
      const acessoUsado = acesso
      const headers: Record<string, string> = { accept: 'application/json' }
      if (op.corpo !== undefined) headers['content-type'] = 'application/json'
      if (autenticado && acessoUsado) headers.authorization = `Bearer ${acessoUsado}`

      const { resposta, corpo: texto } = await chamar(
        caminho,
        {
          method: metodo,
          headers,
          ...(op.corpo !== undefined ? { body: JSON.stringify(op.corpo) } : {}),
          ...(op.sinal ? { sinal: op.sinal } : {}),
          ...(op.tempoLimiteMs !== undefined ? { tempoLimiteMs: op.tempoLimiteMs } : {}),
        },
        (r) => r.text(),
      )
      if (resposta.ok && op.formato === 'texto') return texto as T
      const dados = interpretar(texto)
      if (resposta.ok) return dados as T

      const erro = erroDoCorpo(resposta.status, dados)
      if (autenticado && resposta.status === 401) {
        if (erro.codigo === 'acesso_expirado' && tentativa === 0) {
          // Outro pedido já renovou enquanto este estava no ar: só repete.
          if (acesso && acesso !== acessoUsado) continue
          if (await renovar()) continue
          avisarPerda()
          throw erro
        }
        if (SESSAO_ENCERRADA.has(erro.codigo)) {
          await esquecerSessao()
          avisarPerda()
        }
      }
      throw erro
    }
  }

  async function baixarImagem(caminho: string): Promise<string | null> {
    if (!acesso && !(await renovar().catch(() => false))) return null
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const acessoUsado = acesso
      const lido = await chamar(
        caminho,
        {
          method: 'GET',
          headers: {
            accept: 'image/*',
            ...(acessoUsado ? { authorization: `Bearer ${acessoUsado}` } : {}),
          },
        },
        (r) => (r.ok ? comoDataUri(r) : Promise.resolve(null)),
      ).catch(() => null)
      if (!lido) return null
      if (lido.resposta.status === 401 && tentativa === 0) {
        // Acesso vencido: renova uma vez (ou usa o que outro pedido já renovou).
        if (acesso && acesso !== acessoUsado) continue
        if (await renovar().catch(() => false)) continue
        return null
      }
      return lido.corpo
    }
    return null
  }

  return {
    pedir,
    baixarImagem,
    get: (caminho, extra) =>
      pedir(caminho, {
        ...(extra?.sinal ? { sinal: extra.sinal } : {}),
        ...(extra?.tempoLimiteMs !== undefined ? { tempoLimiteMs: extra.tempoLimiteMs } : {}),
      }),
    post: (caminho, corpo, extra) =>
      pedir(caminho, { ...extra, metodo: 'POST', corpo: corpo ?? {} }),
    patch: (caminho, corpo) => pedir(caminho, { metodo: 'PATCH', corpo: corpo ?? {} }),
    put: (caminho, corpo) => pedir(caminho, { metodo: 'PUT', corpo: corpo ?? {} }),
    delete: (caminho) => pedir(caminho, { metodo: 'DELETE' }),
    renovar,
    async abrirSessao(sessao) {
      acesso = sessao.acesso
      if (sessao.refresh && armazenamento) await armazenamento.gravar(sessao.refresh)
    },
    definirAcesso(novo) {
      acesso = novo
    },
    encerrarSessao: esquecerSessao,
    temAcesso: () => acesso !== null,
    aoPerderSessao(ouvinte) {
      ouvintesDePerda.add(ouvinte)
      return () => {
        ouvintesDePerda.delete(ouvinte)
      }
    },
  }
}

interface GerenciadorDeTravas {
  request<T>(nome: string, trabalho: () => Promise<T>): Promise<T>
}

/** Web Locks quando o navegador oferece; nos demais casos, sem trava. */
function travaEntreAbas(): OpcoesDoCliente['comTrava'] {
  const locks = (globalThis as { navigator?: { locks?: GerenciadorDeTravas } }).navigator?.locks
  if (Platform.OS !== 'web' || !locks) return undefined
  return (trabalho) => locks.request('uj-renovacao-de-sessao', trabalho)
}

function baseDaApi(): string {
  // Na web o app é servido no mesmo host da API (`/app` e `/api`).
  if (Platform.OS === 'web') return ''
  const url = process.env.EXPO_PUBLIC_API_URL ?? ''
  if (!url && process.env.NODE_ENV === 'development') {
    console.warn('EXPO_PUBLIC_API_URL não definida: o app no celular não alcança a API.')
  }
  return url
}

const trava = travaEntreAbas()

/** Cliente único do app. Testes criam o próprio com `criarClienteDaApi`. */
export const api: ClienteDaApi = criarClienteDaApi({
  baseUrl: baseDaApi(),
  plataforma: plataformaAtual(),
  armazenamento: criarArmazenamentoDoRefresh(),
  ...(trava ? { comTrava: trava } : {}),
})
