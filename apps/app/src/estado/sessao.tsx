/**
 * Sessão do aparelho: quem está conectado e em qual comunidade.
 *
 * Mapa de estado: conta e comunidades são ESTADO DO SERVIDOR (vêm de
 * `GET /api/v1/eu` e vivem no React Query); aqui ficam só a fase da sessão,
 * o desafio de segundo fator em andamento, a comunidade escolhida (preferência
 * local guardada por conta) e a situação da biometria deste aparelho.
 *
 * Biometria: com ela ligada, a sessão guardada só abre com o rosto ou a
 * digital (o cofre de `armazenamentoDoRefresh.ts`). Na abertura, o próprio
 * sistema pede; se a pessoa cancela, a sessão fica "trancada": a tela Entrar
 * mostra "Entrar com Face ID" e, como alternativa, e-mail e senha.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'

// Fecha a janela de retorno do Google na web (efeito ao carregar o módulo).
import '@/funcionalidades/autenticacao/provedores/retornoNaWeb'
import { nomeDoAparelho, plataformaAtual } from '@/servicos/aparelho'
import { api, type ClienteDaApi } from '@/servicos/api'
import {
  BiometriaRecusada,
  biometriaLigada,
  desligarBiometria,
  ligarBiometria,
} from '@/servicos/armazenamentoDoRefresh'
import { consultarBiometria, SEM_BIOMETRIA, type Biometria } from '@/servicos/biometria'
import type {
  Aceites,
  CadastroPendente,
  ComunidadeDoVinculo,
  Conta,
  Provedor,
  RespostaDeEntrar,
  RespostaDoProvedor,
  RespostaEu,
  SessaoAberta,
} from '@/servicos/contrato'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { ErroDaApi, MENSAGEM_MUITA_GENTE, SemConexao } from '@/servicos/erros'

import {
  aoEncerrarSessao as ganchosDeEncerramento,
  type GanchoDeEncerramento,
} from './aoEncerrarSessao'
import { definirAcessoDasImagens } from '@/ui/Avatar'

import { CHAVES } from './clienteDeConsulta'
import { gravarComunidadeAtiva, lerComunidadeAtiva } from './comunidadeAtivaSalva'
import { apagarContaSalva, gravarContaSalva, lerContaSalva } from './contaSalva'
import { gravarPreferenciaLocal, lerPreferenciaLocal } from './preferenciaLocal'

export type EstadoDaSessao = 'carregando' | 'anonimo' | 'autenticado'
/**
 * `cadastro_pendente`: Google ou Apple com um e-mail sem conta (ADR 0007). A
 * tela "Falta pouco" pede a idade e os aceites e conclui o cadastro.
 */
export type ResultadoDeEntrar = 'pronto' | 'segundo_fator' | 'cadastro_pendente'

/** O que a tela de completar o cadastro mostra; o token fica só em memória. */
export interface CadastroComProvedor {
  provedor: Provedor
  nome: string
  email: string
}

/** O que o app recebeu do provedor: o ID token (e, na Apple, o nonce cru). */
export type CredencialDoProvedor = { idToken: string } | { identityToken: string; nonce: string }

export interface SituacaoDaBiometria extends Biometria {
  /** A sessão deste aparelho só abre com a biometria. */
  ligada: boolean
  /** Há uma sessão trancada esperando a biometria (a pessoa cancelou na abertura). */
  travada: boolean
  /** Acabou de entrar com senha ou provedor: vale perguntar se quer usar a biometria. */
  oferecer: boolean
}

/** Operações da biometria; injetáveis para os testes. */
export interface OperacoesDeBiometria {
  consultar(): Promise<Biometria>
  ligada(): Promise<boolean>
  ligar(): Promise<void>
  desligar(): Promise<void>
}

const BIOMETRIA_DO_APARELHO: OperacoesDeBiometria = {
  consultar: consultarBiometria,
  ligada: biometriaLigada,
  ligar: ligarBiometria,
  desligar: desligarBiometria,
}

/** "Agora não" na oferta: não pergunta de novo (dá para ligar em Perfil, Segurança). */
export const OFERTA_DISPENSADA = 'uj.biometria.oferta-dispensada'

export interface Sessao {
  estado: EstadoDaSessao
  /** `false` só enquanto o app descobre, na abertura, se há sessão salva. */
  pronto: boolean
  /** Falha ao abrir o app com sessão salva (ex.: sem rede). Há `tentarDeNovo`. */
  falhaAoIniciar: Error | null
  conta: Conta | null
  comunidades: ComunidadeDoVinculo[]
  comunidadeAtiva: ComunidadeDoVinculo | null
  temSegundoFatorPendente: boolean
  biometria: SituacaoDaBiometria
  entrar(dados: { email: string; senha: string }): Promise<ResultadoDeEntrar>
  /**
   * Google ou Apple: entra, segue o 2FA de quem ligou ou, com um e-mail sem
   * conta, devolve `cadastro_pendente` (ADR 0007).
   */
  entrarComProvedor(
    provedor: Provedor,
    credencial: CredencialDoProvedor,
  ): Promise<ResultadoDeEntrar>
  confirmarSegundoFator(codigo: string): Promise<void>
  /** Cadastro iniciado pelo Google ou pela Apple, esperando idade e aceites. */
  cadastroPendente: CadastroComProvedor | null
  concluirCadastroComProvedor(dados: { faixaEtaria: FaixaEtaria; aceites: Aceites }): Promise<void>
  descartarCadastroPendente(): void
  /** Para fluxos que já recebem a sessão pronta (convite, primeiro acesso). */
  abrirSessao(sessao: SessaoAberta): Promise<void>
  /** Abre a sessão trancada pedindo a biometria de novo. */
  desbloquearComBiometria(): Promise<void>
  ligarBiometria(): Promise<void>
  desligarBiometria(): Promise<void>
  dispensarOfertaDeBiometria(): Promise<void>
  sair(): Promise<void>
  trocarComunidade(comunidadeId: string): Promise<void>
  tentarDeNovo(): void
}

const ContextoDaSessao = createContext<Sessao | null>(null)

type Fase = 'iniciando' | 'anonimo' | 'conectado'

interface PropsDoProvedor {
  children: ReactNode
  /** Injetável para testes; o padrão é o cliente único do app. */
  cliente?: ClienteDaApi
  /** Padrão: os ganchos registrados em `aoEncerrarSessao.ts`. */
  aoEncerrarSessao?: GanchoDeEncerramento
  /** Padrão: Face ID, Touch ID ou a biometria do Android (nada na web). */
  biometria?: OperacoesDeBiometria
}

export function ProvedorDeSessao({
  children,
  cliente = api,
  aoEncerrarSessao = ganchosDeEncerramento,
  biometria = BIOMETRIA_DO_APARELHO,
}: PropsDoProvedor) {
  const consultas = useQueryClient()
  const [fase, setFase] = useState<Fase>('iniciando')
  const [falhaAoIniciar, setFalhaAoIniciar] = useState<Error | null>(null)
  const [desafio, setDesafio] = useState<string | null>(null)
  const [pendente, setPendente] = useState<(CadastroComProvedor & { token: string }) | null>(null)
  const [preferida, setPreferida] = useState<string | null>(null)
  const [aparelho, setAparelho] = useState<Biometria>(SEM_BIOMETRIA)
  const [ligada, setLigada] = useState(false)
  const [travada, setTravada] = useState(false)
  const [oferecer, setOferecer] = useState(false)
  const encerramento = useRef<Promise<void> | null>(null)
  const iniciou = useRef(false)
  // Depois de sair, nenhuma busca atrasada pode tentar renovar a sessão
  // (na web, o cookie poderia reabri-la). O ref vale antes do próximo render.
  const encerrada = useRef(false)

  const buscarEu = () => {
    if (encerrada.current) {
      return Promise.reject(new ErroDaApi(401, 'nao_autenticado', 'Entre para continuar.'))
    }
    return cliente.get<RespostaEu>('/api/v1/eu').then(async (dados) => {
      // Guarda para abrir sem internet; resposta que chega depois de sair não volta ao disco.
      if (!encerrada.current) await gravarContaSalva(dados)
      return dados
    })
  }
  const eu = useQuery({ queryKey: CHAVES.eu, queryFn: buscarEu, enabled: fase === 'conectado' })

  function encerrarLocalmente(): Promise<void> {
    encerramento.current ??= (async () => {
      encerrada.current = true
      const contaId = consultas.getQueryData<RespostaEu>(CHAVES.eu)?.conta.id ?? null
      await cliente.encerrarSessao()
      await apagarContaSalva()
      consultas.clear()
      setDesafio(null)
      setPendente(null)
      setPreferida(null)
      // O cofre foi apagado junto com o refresh: a biometria recomeça desligada.
      setLigada(false)
      setTravada(false)
      setOferecer(false)
      setFase('anonimo')
      await aoEncerrarSessao(contaId)
    })()
    return encerramento.current
  }

  async function carregarConta(): Promise<void> {
    encerrada.current = false
    // `always`: sem rede, o pedido falha na hora (e o app abre com a conta salva) em vez de
    // ficar pausado esperando a conexão.
    const dados = await consultas.fetchQuery({
      queryKey: CHAVES.eu,
      queryFn: buscarEu,
      networkMode: 'always',
    })
    setPreferida(await lerComunidadeAtiva(dados.conta.id))
    encerramento.current = null
    setFase('conectado')
  }

  async function abrirSemRede(): Promise<boolean> {
    const salva = await lerContaSalva()
    if (!salva) return false
    encerrada.current = false
    consultas.setQueryData(CHAVES.eu, salva)
    setPreferida(await lerComunidadeAtiva(salva.conta.id))
    encerramento.current = null
    setFase('conectado')
    return true
  }

  async function iniciar(): Promise<void> {
    setFalhaAoIniciar(null)
    try {
      const temSessao = cliente.temAcesso() || (await cliente.renovar())
      setTravada(false)
      if (!temSessao) {
        setLigada(await biometria.ligada().catch(() => false))
        setFase('anonimo')
        return
      }
      await carregarConta()
    } catch (erro) {
      if (erro instanceof BiometriaRecusada) {
        // A sessão continua guardada e trancada: a tela Entrar oferece tentar de novo.
        setTravada(true)
        setFase('anonimo')
        return
      }
      if (erro instanceof ErroDaApi && erro.status === 401) {
        setLigada(false)
        setFase('anonimo')
        return
      }
      // Sem rede, com sessão guardada: abre com a última conta conhecida (F13).
      // Quando a rede voltar, o primeiro pedido renova o acesso; se a sessão
      // tiver sido revogada, a API responde 401 e o app sai e apaga tudo.
      if (erro instanceof SemConexao && (await abrirSemRede())) return
      if (erro instanceof ErroDaApi && erro.status === 429) {
        // A4 (D44): muita gente abrindo o app na mesma rede. Nunca uma tela sem
        // saída: com a conta guardada, abre com ela, como sem rede; sem ela,
        // "Tentar de novo" com texto humano. Na web não há como saber se existe
        // sessão (o cookie é HttpOnly e nada fica guardado): vai para Entrar.
        if (await abrirSemRede()) return
        if (plataformaAtual() === 'web') {
          setLigada(false)
          setFase('anonimo')
          return
        }
        setFalhaAoIniciar(new ErroDaApi(429, erro.codigo, MENSAGEM_MUITA_GENTE))
        return
      }
      setFalhaAoIniciar(erro instanceof Error ? erro : new Error(String(erro)))
    }
  }

  // Sincroniza com o armazenamento seguro e a rede na abertura do app. O ref
  // impede uma segunda renovação no modo estrito (refresh repetido derruba o aparelho).
  const aoAbrir = useEffectEvent(() => {
    void (async () => {
      const [disponivel, jaLigada] = await Promise.all([
        biometria.consultar().catch(() => SEM_BIOMETRIA),
        biometria.ligada().catch(() => false),
      ])
      setAparelho(disponivel)
      setLigada(jaLigada)
      await iniciar()
    })()
  })
  useEffect(() => {
    if (iniciou.current) return
    iniciou.current = true
    aoAbrir()
  }, [])

  // A API pode encerrar a sessão a qualquer momento (aparelho revogado).
  const aoPerder = useEffectEvent(() => {
    void encerrarLocalmente()
  })
  useEffect(() => cliente.aoPerderSessao(() => aoPerder()), [cliente])

  // Foto de perfil e logotipo (D33): o avatar pede a imagem ao cliente da API,
  // que baixa com a sessão e devolve só os bytes (o token não sai do cliente).
  useEffect(() => {
    definirAcessoDasImagens(async (caminho) => {
      const uri = await cliente.baixarImagem(caminho)
      return uri ? { url: uri, cabecalhos: {} } : null
    })
    return () => definirAcessoDasImagens(null)
  }, [cliente])

  async function abrirSessao(sessao: SessaoAberta): Promise<void> {
    await cliente.abrirSessao(sessao)
    // Gravar a sessão nova recomeça o cofre (ver armazenamentoDoRefresh.ts).
    setLigada(await biometria.ligada().catch(() => false))
    setTravada(false)
    await carregarConta()
  }

  /**
   * Depois de entrar com credencial (não na abertura): pergunta sobre a
   * biometria. Roda ANTES de abrir a sessão, para a pergunta já estar de pé
   * quando a navegação sair da tela Entrar. Sessão nova sempre começa com a
   * biometria desligada (o cofre recomeça ao gravar o refresh novo).
   */
  async function talvezOferecerBiometria(): Promise<void> {
    if (!aparelho.disponivel) return
    if (await lerPreferenciaLocal<boolean>(OFERTA_DISPENSADA)) return
    setOferecer(true)
  }

  async function concluirEntrada(
    resposta: RespostaDeEntrar | CadastroPendente,
    provedor?: Provedor,
  ): Promise<ResultadoDeEntrar> {
    if ('cadastroPendente' in resposta) {
      setPendente({
        provedor: provedor ?? 'google',
        token: resposta.tokenDeCadastro,
        nome: resposta.nome,
        email: resposta.email,
      })
      return 'cadastro_pendente'
    }
    if (resposta.segundoFator) {
      setDesafio(resposta.desafio)
      return 'segundo_fator'
    }
    await talvezOferecerBiometria()
    await abrirSessao(resposta)
    return 'pronto'
  }

  const comunidades = fase === 'conectado' ? (eu.data?.comunidades ?? []) : []
  const conta = fase === 'conectado' ? (eu.data?.conta ?? null) : null
  const comunidadeAtiva =
    comunidades.length === 1
      ? (comunidades[0] ?? null)
      : (comunidades.find((c) => c.id === preferida) ?? null)

  const estado: EstadoDaSessao =
    fase === 'iniciando'
      ? 'carregando'
      : fase === 'anonimo'
        ? 'anonimo'
        : conta
          ? 'autenticado'
          : 'carregando'

  const valor: Sessao = {
    estado,
    pronto: fase !== 'iniciando',
    falhaAoIniciar,
    conta,
    comunidades,
    comunidadeAtiva,
    temSegundoFatorPendente: desafio !== null,
    biometria: { ...aparelho, ligada, travada, oferecer },
    async entrar({ email, senha }) {
      const resposta = await cliente.post<RespostaDeEntrar>(
        '/api/auth/entrar',
        { email: email.trim(), senha, plataforma: plataformaAtual(), aparelho: nomeDoAparelho() },
        { autenticado: false },
      )
      return concluirEntrada(resposta)
    },
    async entrarComProvedor(provedor, credencial) {
      const resposta = await cliente.post<RespostaDoProvedor>(
        `/api/auth/provedor/${provedor}`,
        { ...credencial, plataforma: plataformaAtual(), aparelho: nomeDoAparelho() },
        { autenticado: false },
      )
      return concluirEntrada(resposta, provedor)
    },
    cadastroPendente: pendente
      ? { provedor: pendente.provedor, nome: pendente.nome, email: pendente.email }
      : null,
    async concluirCadastroComProvedor({ faixaEtaria, aceites }) {
      if (!pendente) {
        throw new ErroDaApi(
          400,
          'sem_cadastro_pendente',
          'Comece de novo pelo botão do Google ou da Apple.',
        )
      }
      const sessao = await cliente.post<SessaoAberta>(
        '/api/auth/provedor/concluir-cadastro',
        {
          tokenDeCadastro: pendente.token,
          faixaEtaria,
          aceites,
          plataforma: plataformaAtual(),
          aparelho: nomeDoAparelho(),
        },
        { autenticado: false },
      )
      setPendente(null)
      await talvezOferecerBiometria()
      await abrirSessao(sessao)
    },
    descartarCadastroPendente() {
      setPendente(null)
    },
    async confirmarSegundoFator(codigo) {
      if (!desafio) {
        throw new ErroDaApi(400, 'sem_desafio', 'Entre de novo com seu e-mail e senha.')
      }
      const sessao = await cliente.post<SessaoAberta>(
        '/api/auth/segundo-fator',
        { desafio, codigo: codigo.trim() },
        { autenticado: false },
      )
      setDesafio(null)
      await talvezOferecerBiometria()
      await abrirSessao(sessao)
    },
    abrirSessao,
    async desbloquearComBiometria() {
      await iniciar()
    },
    async ligarBiometria() {
      await biometria.ligar()
      setLigada(true)
      setOferecer(false)
    },
    async desligarBiometria() {
      await biometria.desligar()
      setLigada(false)
    },
    async dispensarOfertaDeBiometria() {
      setOferecer(false)
      await gravarPreferenciaLocal(OFERTA_DISPENSADA, true)
    },
    async sair() {
      try {
        if (cliente.temAcesso()) {
          // Silencia o push deste aparelho antes de encerrar (a API também apaga ao sair).
          if (Platform.OS !== 'web') {
            await cliente.delete('/api/v1/eu/notificacoes/aparelho').catch(() => undefined)
          }
          await cliente.post('/api/auth/sair')
        }
      } catch {
        // Sem rede ou sessão já encerrada: sai deste aparelho do mesmo jeito.
      }
      await encerrarLocalmente()
    },
    async trocarComunidade(comunidadeId) {
      setPreferida(comunidadeId)
      if (conta) await gravarComunidadeAtiva(conta.id, comunidadeId)
    },
    tentarDeNovo() {
      void iniciar()
    },
  }

  return <ContextoDaSessao value={valor}>{children}</ContextoDaSessao>
}

export function useSessao(): Sessao {
  const sessao = use(ContextoDaSessao)
  if (!sessao) throw new Error('useSessao precisa estar dentro de ProvedorDeSessao')
  return sessao
}
