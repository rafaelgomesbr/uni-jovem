/**
 * Camada offline do app (F13, ADR 0005).
 *
 * Mapa de estado: a fila, os pacotes e a validade vivem no SQLite cifrado da
 * partição (conta, comunidade) e chegam às telas pelo React Query local
 * (`networkMode: 'always'`, chave `['offline', conta, comunidade, ...]`).
 * Aqui ficam só a fase da sincronização e os gatilhos: abrir o app, voltar ao
 * primeiro plano, recuperar a rede e o botão "Sincronizar agora".
 */
import NetInfo from '@react-native-community/netinfo'
import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api, type ClienteDaApi } from '@/servicos/api'
import type { DetalheDaComunidade } from '@/servicos/contrato'
import type { EncontroDoMeuRepertorio } from '@/servicos/contratoDoRepertorio'
import { ErroLocal, mensagemDoErro, SemConexao } from '@/servicos/erros'

import { limparPdfsAbertos } from '../pdf/abrirPdf'

import { ligarLimpezaAoSair } from './aoEncerrar'
import { depositoPadrao } from './deposito'
import { guardarDescarte, type MotivoDoDescarte } from './descartadas'
import { descartarOperacao, refazerOperacao, registrarAcao, type ResultadoDoRegistro } from './fila'
import { MENSAGEM_DA_WEB, MENSAGEM_SEM_PREPARO } from './mensagens'
import { baixarRepertorio, encontroEstaPerto, type ResultadoDoDownload } from './repertorioOffline'
import {
  AcessoRevogado,
  caminhoDoPacote,
  guardarPacote,
  sincronizarParticao,
} from './sincronizador'
import type {
  DepositoLocal,
  MetaDaParticao,
  NovaAcao,
  OperacaoNaFila,
  PacoteGuardado,
  PacoteOffline,
  Particao,
  PdfGuardado,
  RepertorioGuardado,
  ResumoDoPacote,
  ResumoDoRepertorioGuardado,
} from './tipos'

// Sair da conta apaga as partições deste aparelho (registrado uma vez, na carga do módulo).
ligarLimpezaAoSair(depositoPadrao)

/** D23: 7 dias quando a comunidade ainda não respondeu a própria validade. */
const VALIDADE_PADRAO_DIAS = 7

export type FaseDaSincronizacao = 'ocioso' | 'sincronizando' | 'concluido' | 'falha'

export interface Offline {
  /** `false` na web e em aparelho sem cifragem: nada fica guardado. */
  disponivel: boolean
  motivoIndisponivel: string | null
  online: boolean
  /** Já existe partição desta comunidade neste aparelho. */
  temParticao: boolean
  fase: FaseDaSincronizacao
  erro: string | null
  ultimaSincronizacao: string | null
  validoAte: string | null
  operacoes: OperacaoNaFila[]
  pendentes: number
  rejeitadas: number
  conflitos: number
  pacotes: ResumoDoPacote[]
  /** Repertórios guardados para tocar sem internet (só o resumo: a cifra fica no banco cifrado). */
  repertorios: ResumoDoRepertorioGuardado[]
  /** Prefixo das consultas locais (já leva conta e comunidade). */
  chaveLocal: readonly string[]
  lerPacote(eventoId: string): Promise<PacoteGuardado | null>
  lerRepertorio(eventoId: string): Promise<RepertorioGuardado | null>
  lerRepertorios(): Promise<RepertorioGuardado[]>
  /**
   * Baixa (ou confere a versão de) o repertório do encontro para tocar sem internet. `faltam_pdfs`:
   * a cifra em texto chegou, mas algum PDF ainda não (sem internet no meio do caminho, por exemplo):
   * a tela não pode dizer "pronto".
   */
  baixarRepertorio(eventoId: string): Promise<ResultadoDoDownload | 'faltam_pdfs'>
  removerRepertorio(eventoId: string): Promise<void>
  /** O PDF da música guardado neste aparelho (a `versao` pedida, ou o mais recente), sem rede. */
  lerPdf(musicaId: string, versao?: string): Promise<PdfGuardado | null>
  sincronizarAgora(): Promise<void>
  prepararEvento(eventoId: string): Promise<void>
  removerPacote(eventoId: string): Promise<void>
  /** Guarda a ação na fila desta comunidade. `vinculoId` cria a partição se ainda não houver. */
  registrar(acao: NovaAcao, opcoes?: { vinculoId?: string | null }): Promise<ResultadoDoRegistro>
  descartar(chave: string): Promise<void>
  refazer(chave: string): Promise<void>
  /** O que ainda não chegou ao servidor (para avisar antes de sair). */
  naoEnviadas(comunidadeId?: string): Promise<OperacaoNaFila[]>
  apagarComunidade(comunidadeId: string): Promise<void>
}

const assinarRede = (aviso: () => void) => onlineManager.subscribe(aviso)
const lerRede = () => onlineManager.isOnline()

/** Rede do aparelho, pela mesma fonte do React Query (NetInfo no celular). */
export function useEstaOnline(): boolean {
  return useSyncExternalStore(assinarRede, lerRede, lerRede)
}

const semModoOffline = async (): Promise<never> => {
  throw new ErroLocal(MENSAGEM_DA_WEB)
}

/** Sem provedor (web e testes de tela isolados): nada fica guardado. */
const INDISPONIVEL: Omit<Offline, 'online'> = {
  disponivel: false,
  motivoIndisponivel: MENSAGEM_DA_WEB,
  temParticao: false,
  fase: 'ocioso',
  erro: null,
  ultimaSincronizacao: null,
  validoAte: null,
  operacoes: [],
  pendentes: 0,
  rejeitadas: 0,
  conflitos: 0,
  pacotes: [],
  repertorios: [],
  chaveLocal: ['offline', '', ''],
  lerPacote: async () => null,
  lerRepertorio: async () => null,
  lerRepertorios: async () => [],
  baixarRepertorio: semModoOffline,
  removerRepertorio: async () => undefined,
  lerPdf: async () => null,
  sincronizarAgora: async () => undefined,
  prepararEvento: semModoOffline,
  removerPacote: async () => undefined,
  registrar: semModoOffline,
  descartar: async () => undefined,
  refazer: async () => undefined,
  naoEnviadas: async () => [],
  apagarComunidade: async () => undefined,
}

const ContextoOffline = createContext<Offline | null>(null)

interface Resumo {
  meta: MetaDaParticao
  operacoes: OperacaoNaFila[]
  pacotes: ResumoDoPacote[]
  repertorios: ResumoDoRepertorioGuardado[]
}

interface Props {
  children: ReactNode
  /** Injetáveis para testes. */
  deposito?: DepositoLocal
  cliente?: Pick<ClienteDaApi, 'get' | 'post'> & Partial<Pick<ClienteDaApi, 'pedir'>>
}

export function ProvedorOffline({ children, deposito = depositoPadrao, cliente = api }: Props) {
  const { estado, conta, comunidadeAtiva, comunidades } = useSessao()
  const consultas = useQueryClient()
  const online = useEstaOnline()
  const [fase, setFase] = useState<FaseDaSincronizacao>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const emCurso = useRef<Promise<void> | null>(null)

  const contaId = estado === 'autenticado' ? (conta?.id ?? null) : null
  const comunidadeId = contaId ? (comunidadeAtiva?.id ?? null) : null
  const ativa = deposito.disponivel && contaId !== null && comunidadeId !== null
  const chaveLocal = ['offline', contaId ?? '', comunidadeId ?? '']
  const idsDasComunidades = comunidades
    .map((c) => c.id)
    .sort()
    .join(',')

  const resumo = useQuery({
    queryKey: [...chaveLocal, 'resumo'],
    queryFn: async (): Promise<Resumo | null> => {
      const p = await deposito.abrir(contaId!, comunidadeId!)
      if (!p) return null
      const [meta, operacoes, pacotes, repertorios] = await Promise.all([
        p.meta(),
        p.operacoes(),
        p.pacotes(),
        p.resumoDosRepertorios(),
      ])
      return { meta, operacoes, pacotes, repertorios }
    },
    enabled: ativa,
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  })

  const invalidarLocais = () => consultas.invalidateQueries({ queryKey: ['offline'] })

  async function particaoAtiva(): Promise<Particao | null> {
    if (!ativa) return null
    return deposito.abrir(contaId!, comunidadeId!)
  }

  async function garantirParticao(
    vinculoId: string | null,
    { semVinculo = false }: { semVinculo?: boolean } = {},
  ): Promise<Particao> {
    if (!deposito.disponivel) throw new ErroLocal(deposito.motivoIndisponivel ?? MENSAGEM_DA_WEB)
    if (!contaId || !comunidadeId) throw new ErroLocal('Escolha uma comunidade primeiro.')
    const existente = await deposito.abrir(contaId, comunidadeId)
    if (existente) {
      if (vinculoId && !(await existente.meta()).vinculoId) {
        await existente.atualizarMeta({ vinculoId })
      }
      return existente
    }
    // O repertório para tocar não leva fila de ações: pode criar a partição sem o vínculo.
    if (!vinculoId && !semVinculo) throw new ErroLocal(MENSAGEM_SEM_PREPARO)
    const dias =
      consultas.getQueryData<DetalheDaComunidade>(CHAVES.comunidade(comunidadeId))
        ?.validadeOfflineDias ?? VALIDADE_PADRAO_DIAS
    return deposito.criar({ contaId, comunidadeId, vinculoId, validadeDias: dias })
  }

  // Última tentativa de baixar o repertório sozinho, por comunidade (não repete a cada volta ao
  // primeiro plano).
  const ultimaBaixaSozinha = useRef<{ comunidade: string; em: number } | null>(null)

  /**
   * Baixa sozinho o repertório do próximo encontro em que a pessoa toca, quando ele está perto
   * e há Wi-Fi (D71). Nunca em dados móveis: o botão "Deixar pronto sem internet" cobre esse caso.
   */
  async function baixarRepertorioSozinho(): Promise<void> {
    if (!ativa || !contaId || !comunidadeId || !onlineManager.isOnline()) return
    const ultima = ultimaBaixaSozinha.current
    if (ultima?.comunidade === comunidadeId && Date.now() - ultima.em < 10 * 60_000) return
    ultimaBaixaSozinha.current = { comunidade: comunidadeId, em: Date.now() }
    try {
      const rede = await NetInfo.fetch()
      if (rede.type !== 'wifi' && rede.type !== 'ethernet') return
      const { encontros } = await cliente.get<{ encontros: EncontroDoMeuRepertorio[] }>(
        `/api/v1/c/${comunidadeId}/meu-repertorio`,
      )
      const perto = encontros.filter(
        (e) =>
          encontroEstaPerto(e.evento.inicio) &&
          e.convocacoes.some((c) => c.estado !== 'recusada') &&
          e.itens.length > 0,
      )
      if (!perto.length) return
      const p = await garantirParticao(null, { semVinculo: true })
      for (const e of perto) await baixarRepertorio(p, cliente, e.evento.id)
      await invalidarLocais()
    } catch {
      // Em segundo plano, falha não incomoda: o botão manual continua lá.
    }
  }

  /** Apaga a partição; o que não foi enviado vai para a tela (só em memória). */
  async function descartarParticao(alvo: string, motivo: MotivoDoDescarte): Promise<void> {
    if (!contaId) return
    const p = await deposito.abrir(contaId, alvo).catch(() => null)
    guardarDescarte(motivo, p ? await p.operacoes().catch(() => []) : [])
    await deposito.apagar(contaId, alvo)
  }

  async function sincronizarTudo(): Promise<void> {
    if (!deposito.disponivel || !contaId) return
    if (emCurso.current) return emCurso.current
    if (!onlineManager.isOnline()) return
    const trabalho = (async () => {
      setFase('sincronizando')
      setErro(null)
      let aceitas = 0
      try {
        const minhas = new Set(comunidades.map((c) => c.id))
        const registros = (await deposito.listar()).filter((r) => r.contaId === contaId)
        for (const r of registros) {
          // Saiu da comunidade (ou foi removida): a partição dela sai do aparelho.
          if (!minhas.has(r.comunidadeId)) {
            await descartarParticao(r.comunidadeId, 'saiu')
            continue
          }
          const p = await deposito.abrir(contaId, r.comunidadeId)
          if (!p) continue
          try {
            aceitas += (await sincronizarParticao(p, cliente)).aceitas
          } catch (e) {
            if (!(e instanceof AcessoRevogado)) throw e
            await descartarParticao(r.comunidadeId, 'revogado')
          }
        }
        setFase('concluido')
      } catch (e) {
        if (e instanceof SemConexao) {
          setFase('ocioso')
        } else {
          setFase('falha')
          setErro(mensagemDoErro(e))
        }
      } finally {
        await invalidarLocais()
        // O que o servidor aceitou muda as telas da comunidade: recarrega.
        if (aceitas > 0 && comunidadeId) {
          await consultas.invalidateQueries({ queryKey: CHAVES.comunidade(comunidadeId) })
        }
      }
    })()
    emCurso.current = trabalho
    try {
      await trabalho
    } finally {
      emCurso.current = null
    }
  }

  /** Partição vencida fica bloqueada e é apagada; o que ficou nela vai para a tela. */
  async function apagarVencidas(): Promise<void> {
    const vencidas = await deposito.apagarVencidas()
    for (const v of vencidas) guardarDescarte('vencido', v.operacoes)
    if (vencidas.length) await invalidarLocais()
  }

  // Abertura do app.
  const aoAbrir = useEffectEvent(() => {
    void apagarVencidas()
  })
  useEffect(() => {
    aoAbrir()
  }, [])

  // Conta conectada: o que for de outra conta sai do aparelho; depois, sincroniza.
  const aoEntrar = useEffectEvent(async () => {
    if (!contaId) return
    await deposito.apagarOutrasContas(contaId)
    await sincronizarTudo()
  })
  useEffect(() => {
    if (contaId) void aoEntrar()
  }, [contaId])

  // Com a comunidade à vista (ao abrir o app ou ao trocar de comunidade), vê se há repertório
  // do encontro perto para baixar sozinho no Wi-Fi.
  const aoTerComunidade = useEffectEvent(() => {
    void baixarRepertorioSozinho()
  })
  useEffect(() => {
    if (contaId && comunidadeId) aoTerComunidade()
  }, [contaId, comunidadeId])

  // A lista de comunidades mudou (saiu de uma, foi removida): confere as partições.
  const conferirComunidades = useEffectEvent(async () => {
    if (!contaId) return
    const minhas = new Set(comunidades.map((c) => c.id))
    const sobrando = (await deposito.listar()).filter(
      (r) => r.contaId === contaId && !minhas.has(r.comunidadeId),
    )
    for (const r of sobrando) await descartarParticao(r.comunidadeId, 'saiu')
    if (sobrando.length) await invalidarLocais()
  })
  useEffect(() => {
    if (contaId) void conferirComunidades()
  }, [contaId, idsDasComunidades])

  // Voltar ao primeiro plano (o app pode ter ficado dias em segundo plano: confere a
  // validade antes) e recuperar a rede disparam a sincronização.
  const aoVoltar = useEffectEvent(async () => {
    await apagarVencidas()
    await sincronizarTudo()
    await baixarRepertorioSozinho()
  })
  const aoReconectar = useEffectEvent(() => {
    void sincronizarTudo().then(baixarRepertorioSozinho)
  })
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (e) => {
      if (e === 'active') void aoVoltar()
    })
    const semRede = onlineManager.subscribe((conectado) => {
      if (conectado) aoReconectar()
    })
    return () => {
      assinatura.remove()
      semRede()
    }
  }, [])

  const dados = resumo.data ?? null
  const operacoes = dados?.operacoes ?? []

  const valor: Offline = {
    disponivel: deposito.disponivel,
    motivoIndisponivel: deposito.motivoIndisponivel,
    online,
    temParticao: dados !== null,
    fase,
    erro,
    ultimaSincronizacao: dados?.meta.ultimaSincronizacao ?? null,
    validoAte: dados?.meta.validoAte ?? null,
    operacoes,
    pendentes: operacoes.filter((o) => o.estado === 'pendente').length,
    rejeitadas: operacoes.filter((o) => o.estado === 'rejeitada').length,
    conflitos: operacoes.filter((o) => o.estado === 'conflito').length,
    pacotes: dados?.pacotes ?? [],
    repertorios: dados?.repertorios ?? [],
    chaveLocal,
    async lerPacote(eventoId) {
      const p = await particaoAtiva()
      return p ? p.lerPacote(eventoId) : null
    },
    async lerRepertorio(eventoId) {
      const p = await particaoAtiva()
      return p ? p.lerRepertorio(eventoId) : null
    },
    async lerRepertorios() {
      const p = await particaoAtiva()
      return p ? p.repertorios() : []
    },
    async baixarRepertorio(eventoId) {
      if (!deposito.disponivel) {
        throw new ErroLocal(deposito.motivoIndisponivel ?? MENSAGEM_DA_WEB)
      }
      if (!contaId || !comunidadeId) throw new ErroLocal('Escolha uma comunidade primeiro.')
      const p = await garantirParticao(null, { semVinculo: true })
      try {
        const resultado = await baixarRepertorio(p, cliente, eventoId)
        const resumo = (await p.resumoDosRepertorios()).find((r) => r.eventoId === eventoId)
        return resumo && resumo.pdfsBaixados < resumo.pdfs ? 'faltam_pdfs' : resultado
      } finally {
        await invalidarLocais()
      }
    },
    async removerRepertorio(eventoId) {
      await (await particaoAtiva())?.removerRepertorio(eventoId)
      await invalidarLocais()
    },
    async lerPdf(musicaId, versao) {
      const p = await particaoAtiva()
      return p ? p.lerPdf(musicaId, versao) : null
    },
    sincronizarAgora: sincronizarTudo,
    async prepararEvento(eventoId) {
      if (!deposito.disponivel) {
        throw new ErroLocal(deposito.motivoIndisponivel ?? MENSAGEM_DA_WEB)
      }
      if (!contaId || !comunidadeId) throw new ErroLocal('Escolha uma comunidade primeiro.')
      const pacote = await cliente.get<PacoteOffline>(caminhoDoPacote(comunidadeId, eventoId))
      const p = await deposito.criar({
        contaId,
        comunidadeId,
        vinculoId: pacote.vinculoId,
        validadeDias: pacote.validadeDias,
      })
      await guardarPacote(p, pacote)
      await invalidarLocais()
    },
    async removerPacote(eventoId) {
      await (await particaoAtiva())?.removerPacote(eventoId)
      await invalidarLocais()
    },
    async registrar(acao, opcoes) {
      const p = await garantirParticao(opcoes?.vinculoId ?? null)
      const r = await registrarAcao(p, acao)
      await invalidarLocais()
      return r
    },
    async descartar(chave) {
      const p = await particaoAtiva()
      if (p) await descartarOperacao(p, chave)
      await invalidarLocais()
    },
    async refazer(chave) {
      const p = await particaoAtiva()
      if (p) await refazerOperacao(p, chave)
      await invalidarLocais()
      if (onlineManager.isOnline()) void sincronizarTudo()
    },
    async naoEnviadas(alvo) {
      if (!contaId || !deposito.disponivel) return []
      const todas: OperacaoNaFila[] = []
      for (const r of await deposito.listar()) {
        if (r.contaId !== contaId || (alvo && r.comunidadeId !== alvo)) continue
        const p = await deposito.abrir(contaId, r.comunidadeId).catch(() => null)
        if (p) todas.push(...(await p.operacoes()))
      }
      return todas
    },
    async apagarComunidade(alvo) {
      if (!contaId) return
      await deposito.apagar(contaId, alvo)
      // Os PDFs abertos para ler também saem do cache do aparelho.
      limparPdfsAbertos()
      await invalidarLocais()
    },
  }

  return <ContextoOffline value={valor}>{children}</ContextoOffline>
}

export function useOffline(): Offline {
  const offline = use(ContextoOffline)
  const online = useEstaOnline()
  return offline ?? { ...INDISPONIVEL, online }
}

/** Pacote do evento guardado neste aparelho (ou `null`). */
export function usePacoteDoEvento(eventoId: string | null) {
  const offline = useOffline()
  return useQuery({
    queryKey: [...offline.chaveLocal, 'pacote', eventoId ?? ''],
    queryFn: () => offline.lerPacote(eventoId!),
    enabled: offline.temParticao && !!eventoId,
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  })
}

/** Repertório do encontro guardado neste aparelho (ou `null`): é o que abre sem internet. */
export function useRepertorioGuardado(eventoId: string | null) {
  const offline = useOffline()
  return useQuery({
    queryKey: [...offline.chaveLocal, 'repertorio', eventoId ?? ''],
    queryFn: () => offline.lerRepertorio(eventoId!),
    enabled: offline.temParticao && !!eventoId,
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  })
}

/** Todos os repertórios guardados (com a cifra), para o Meu repertório sem internet. */
export function useRepertoriosGuardados() {
  const offline = useOffline()
  return useQuery({
    queryKey: [...offline.chaveLocal, 'repertorios'],
    queryFn: () => offline.lerRepertorios(),
    enabled: offline.temParticao,
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  })
}

/** Operações ainda não enviadas de um evento (para marcar "pendente" na tela). */
export function usePendentesDoEvento(eventoId: string): OperacaoNaFila[] {
  return useOffline().operacoes.filter((o) => o.eventoId === eventoId && o.estado === 'pendente')
}
