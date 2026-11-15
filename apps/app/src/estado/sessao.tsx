/**
 * Sessão do aparelho: quem está conectado e em qual comunidade.
 *
 * Mapa de estado: conta e comunidades são ESTADO DO SERVIDOR (vêm de
 * `GET /api/v1/eu` e vivem no React Query); aqui ficam só a fase da sessão,
 * o desafio de segundo fator em andamento e a comunidade escolhida, que é
 * preferência local guardada por conta.
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

import { nomeDoAparelho, plataformaAtual } from '@/servicos/aparelho'
import { api, type ClienteDaApi } from '@/servicos/api'
import type {
  ComunidadeDoVinculo,
  Conta,
  RespostaDeEntrar,
  RespostaEu,
  SessaoAberta,
} from '@/servicos/contrato'
import { ErroDaApi } from '@/servicos/erros'

import {
  aoEncerrarSessao as ganchosDeEncerramento,
  type GanchoDeEncerramento,
} from './aoEncerrarSessao'
import { CHAVES } from './clienteDeConsulta'
import { gravarComunidadeAtiva, lerComunidadeAtiva } from './comunidadeAtivaSalva'

export type EstadoDaSessao = 'carregando' | 'anonimo' | 'autenticado'
export type ResultadoDeEntrar = 'pronto' | 'segundo_fator'

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
  entrar(dados: { email: string; senha: string }): Promise<ResultadoDeEntrar>
  confirmarSegundoFator(codigo: string): Promise<void>
  /** Para fluxos que já recebem a sessão pronta (convite, primeiro acesso). */
  abrirSessao(sessao: SessaoAberta): Promise<void>
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
}

export function ProvedorDeSessao({
  children,
  cliente = api,
  aoEncerrarSessao = ganchosDeEncerramento,
}: PropsDoProvedor) {
  const consultas = useQueryClient()
  const [fase, setFase] = useState<Fase>('iniciando')
  const [falhaAoIniciar, setFalhaAoIniciar] = useState<Error | null>(null)
  const [desafio, setDesafio] = useState<string | null>(null)
  const [preferida, setPreferida] = useState<string | null>(null)
  const encerramento = useRef<Promise<void> | null>(null)
  const iniciou = useRef(false)
  // Depois de sair, nenhuma busca atrasada pode tentar renovar a sessão
  // (na web, o cookie poderia reabri-la). O ref vale antes do próximo render.
  const encerrada = useRef(false)

  const buscarEu = () => {
    if (encerrada.current) {
      return Promise.reject(new ErroDaApi(401, 'nao_autenticado', 'Entre para continuar.'))
    }
    return cliente.get<RespostaEu>('/api/v1/eu')
  }
  const eu = useQuery({ queryKey: CHAVES.eu, queryFn: buscarEu, enabled: fase === 'conectado' })

  function encerrarLocalmente(): Promise<void> {
    encerramento.current ??= (async () => {
      encerrada.current = true
      const contaId = consultas.getQueryData<RespostaEu>(CHAVES.eu)?.conta.id ?? null
      await cliente.encerrarSessao()
      consultas.clear()
      setDesafio(null)
      setPreferida(null)
      setFase('anonimo')
      await aoEncerrarSessao(contaId)
    })()
    return encerramento.current
  }

  async function carregarConta(): Promise<void> {
    encerrada.current = false
    const dados = await consultas.fetchQuery({ queryKey: CHAVES.eu, queryFn: buscarEu })
    setPreferida(await lerComunidadeAtiva(dados.conta.id))
    encerramento.current = null
    setFase('conectado')
  }

  async function iniciar(): Promise<void> {
    setFalhaAoIniciar(null)
    try {
      const temSessao = cliente.temAcesso() || (await cliente.renovar())
      if (!temSessao) {
        setFase('anonimo')
        return
      }
      await carregarConta()
    } catch (erro) {
      if (erro instanceof ErroDaApi && erro.status === 401) {
        setFase('anonimo')
        return
      }
      setFalhaAoIniciar(erro instanceof Error ? erro : new Error(String(erro)))
    }
  }

  // Sincroniza com o armazenamento seguro e a rede na abertura do app. O ref
  // impede uma segunda renovação no modo estrito (refresh repetido derruba o aparelho).
  const aoAbrir = useEffectEvent(() => {
    void iniciar()
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

  async function abrirSessao(sessao: SessaoAberta): Promise<void> {
    await cliente.abrirSessao(sessao)
    await carregarConta()
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
    async entrar({ email, senha }) {
      const resposta = await cliente.post<RespostaDeEntrar>(
        '/api/auth/entrar',
        { email: email.trim(), senha, plataforma: plataformaAtual(), aparelho: nomeDoAparelho() },
        { autenticado: false },
      )
      if (resposta.segundoFator) {
        setDesafio(resposta.desafio)
        return 'segundo_fator'
      }
      await abrirSessao(resposta)
      return 'pronto'
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
      await abrirSessao(sessao)
    },
    abrirSessao,
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
