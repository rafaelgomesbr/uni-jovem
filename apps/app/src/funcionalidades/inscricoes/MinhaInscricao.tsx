import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ESPACO, RAIO } from '@uj/tokens'
import type { ReactNode, Ref } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { DetalheDoEvento, MinhaInscricao as Inscricao } from '@/servicos/contratoDosEventos'
import { SemConexao } from '@/servicos/erros'
import { AvisoDeFalha } from '@/ui/Falha'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CodigoQR } from '@/ui/CodigoQR'
import { useFocoAoMudar, type NoDeView } from '@/ui/foco'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { soNaWeb } from '@/ui/web'

import { useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { naComunidade, useInvalidarEventos } from '../eventos/consultas'
import { useOffline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { EXPLICACAO_SEM_INSCRICAO, motivoSemInscricao } from '../eventos/regras'
import { formatarCodigo, NOME_DO_ESTADO_DA_INSCRICAO } from './nomes'

/** Lado do QR de entrada (3.5.3). */
const LADO_DO_QR = 200

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
  /**
   * "Inscrever-me" como secundário: a tela já tem um primário (o da barra de
   * ação, ou o do cartão de destaque quando a inscrição foi rebaixada). Um
   * primário por tela.
   */
  secundario?: boolean
}

/**
 * Inscrição da própria pessoa. A API não tem leitura de "minha inscrição":
 * inscrever é idempotente (devolve a que já existe), então o mesmo botão
 * serve para se inscrever e para ver o código de entrada de novo.
 *
 * Inscrita, vira o QR de entrada (3.5.3): o cartão de destaque "SUA
 * ENTRADA", com o QR de 200 sobre o quadro branco de raio 14, o código em
 * algarismos largos e "Cancelar inscrição". Fora de um cartão, cada estado
 * traz o próprio cartão; dentro de um (a seção de participação do evento),
 * entra só o conteúdo, para não haver cartão dentro de cartão.
 */
export function MinhaInscricao({ evento, comunidadeId, secundario = false }: Props) {
  const pode = usePode()
  const { superficie } = useTema()
  const dentroDeCartao = superficie !== 'fundo'
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const chave = CHAVES.minhaInscricao(comunidadeId, evento.id)
  // Só lê o que veio da última resposta; quem preenche é a mutação.
  const minha = useQuery<Inscricao | null>({
    queryKey: chave,
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  }).data

  const offline = useOffline()
  const euOnline = useMeuVinculo()
  const vinculoDoPacote = usePacoteDoEvento(evento.id).data?.pacote.vinculoId ?? null
  // Intenção registrada sem internet: "pendente, vaga não garantida" até o servidor confirmar.
  const intencao =
    offline.operacoes.find((o) => o.tipo === 'inscricao.intencao' && o.eventoId === evento.id) ??
    null

  async function guardarIntencao(): Promise<null> {
    await offline.registrar(
      {
        tipo: 'inscricao.intencao',
        dados: { eventoId: evento.id },
        eventoId: evento.id,
        descricao: `Inscrição em "${evento.titulo}"`,
      },
      { vinculoId: euOnline ?? vinculoDoPacote },
    )
    return null
  }

  const inscrever = useMutation({
    mutationFn: async (): Promise<Inscricao | null> => {
      if (!offline.online && offline.disponivel) return guardarIntencao()
      try {
        return await api.post<Inscricao>(
          `${naComunidade(comunidadeId)}/eventos/${evento.id}/inscricoes/eu`,
        )
      } catch (erro) {
        if (erro instanceof SemConexao && offline.disponivel) return guardarIntencao()
        throw erro
      }
    },
    // Sem rede ela ainda roda: guarda a intenção neste aparelho.
    networkMode: 'always',
    onSuccess: (r) => {
      if (r) consultas.setQueryData(chave, r)
      // O Início lista as próprias inscrições (`GET /inscricoes/eu`).
      void consultas.invalidateQueries({ queryKey: CHAVES.minhasInscricoes(comunidadeId) })
    },
  })
  const cancelar = useMutation({
    mutationFn: (id: string) => api.post(`${naComunidade(comunidadeId)}/inscricoes/${id}/cancelar`),
    onSuccess: async () => {
      consultas.setQueryData(chave, null)
      void consultas.invalidateQueries({ queryKey: CHAVES.minhasInscricoes(comunidadeId) })
      await invalidar(evento.id)
    },
  })

  const motivo = motivoSemInscricao(evento)
  const ativa = minha && minha.estado !== 'cancelada' ? minha : null
  // Inscrever e cancelar trocam o bloco (o botão tocado some): o foco vai para o bloco novo.
  const { alvo: focoRef, pedirFoco } = useFocoAoMudar(
    ativa ? 'ativa' : intencao?.estado === 'pendente' ? 'pendente' : 'livre',
  )

  if (!pode('inscricao', 'inscrever_se', { proprio: true })) return null

  async function pedirCancelamento(id: string) {
    const ok = await confirmar({
      titulo: 'Cancelar sua inscrição?',
      mensagem:
        'Sua vaga fica livre para outra pessoa. Você pode se inscrever de novo enquanto houver vaga.',
      confirmar: 'Cancelar inscrição',
      destrutivo: true,
    })
    if (!ok) return
    pedirFoco()
    cancelar.mutate(id)
  }

  if (ativa) {
    const entrada = (
      <EntradaComQR ativa={ativa} focoRef={focoRef} erro={cancelar.error} recuo={!dentroDeCartao} />
    )
    const cancelarInscricao = (
      <Botao
        titulo="Cancelar inscrição"
        variante="secundario"
        rotuloAcessivel={`Cancelar inscrição em ${evento.titulo}`}
        carregando={cancelar.isPending}
        aoPressionar={() => void pedirCancelamento(ativa.inscricaoId)}
      />
    )
    if (dentroDeCartao) {
      return (
        <View style={{ gap: ESPACO.e12 }}>
          <Texto variante="sobrancelha">Sua entrada</Texto>
          {entrada}
          {cancelarInscricao}
        </View>
      )
    }
    return (
      <CartaoDeDestaque sobrancelha="Sua entrada" acoes={cancelarInscricao}>
        {entrada}
      </CartaoDeDestaque>
    )
  }

  if (intencao?.estado === 'pendente') {
    return (
      <Bloco
        dentroDeCartao={dentroDeCartao}
        sobrancelha="Sua inscrição"
        extra={<Chip texto="Pendente" tom="alerta" />}
      >
        <View ref={focoRef} accessible {...soNaWeb({ tabIndex: -1 })}>
          <Texto variante="corpo">
            Pendente: vaga não garantida. Sua inscrição foi anotada neste aparelho, sem internet. A
            vaga só fica garantida quando o servidor confirmar, assim que a conexão voltar.
          </Texto>
        </View>
      </Bloco>
    )
  }

  const inscreverMe = (
    <Botao
      ref={focoRef}
      titulo="Inscrever-me"
      icone="inscricoes"
      variante={secundario ? 'secundario' : 'primario'}
      carregando={inscrever.isPending}
      desabilitado={motivo !== null}
      {...(motivo ? { motivo: EXPLICACAO_SEM_INSCRICAO[motivo] } : {})}
      dica="Se você já se inscreveu, mostra a sua inscrição sem duplicar."
      aoPressionar={() => {
        pedirFoco()
        inscrever.mutate()
      }}
    />
  )
  const avisos =
    intencao || inscrever.error || (!offline.online && offline.disponivel && motivo === null)
  return (
    <Bloco dentroDeCartao={dentroDeCartao} sobrancelha="Inscrição" acoes={inscreverMe}>
      {avisos ? (
        <>
          {intencao ? (
            <Aviso tipo="alerta" titulo="A inscrição feita sem internet não entrou">
              {`${intencao.mensagem ?? 'O servidor não confirmou a vaga.'} Veja em Perfil, Uso sem internet.`}
            </Aviso>
          ) : null}
          {inscrever.error ? <AvisoDeFalha erro={inscrever.error} /> : null}
          {!offline.online && offline.disponivel && motivo === null ? (
            <Texto variante="corpo">
              Sem internet: a inscrição fica anotada neste aparelho e a vaga só é garantida quando o
              servidor confirmar.
            </Texto>
          ) : null}
        </>
      ) : null}
    </Bloco>
  )
}

/**
 * O QR de entrada: a situação (anunciada quando a inscrição troca), o QR de
 * 200 sobre o quadro branco de raio 14 (preto no branco nos dois temas), 12,
 * o código em algarismos largos e a legenda. O QR e o código ficam
 * centralizados, como pede a grade (2.13).
 */
function EntradaComQR({
  ativa,
  focoRef,
  erro,
  recuo,
}: {
  ativa: Inscricao
  focoRef: Ref<NoDeView>
  erro: unknown
  /** No cartão de destaque: 8 entre a sobrancelha e o conteúdo (M). */
  recuo: boolean
}) {
  return (
    <View style={{ gap: ESPACO.e12, marginTop: recuo ? ESPACO.e8 : 0 }}>
      <View ref={focoRef} accessible {...soNaWeb({ tabIndex: -1 })}>
        <Texto variante="rotulo" cor="textoSuave">
          {`Sua inscrição: ${NOME_DO_ESTADO_DA_INSCRICAO[ativa.estado]}`}
        </Texto>
      </View>
      {ativa.estado === 'espera' ? (
        <Texto variante="corpo">
          Você está na lista de espera. Se abrir uma vaga, sua inscrição é confirmada sozinha.
        </Texto>
      ) : null}
      <View style={{ alignSelf: 'center', borderRadius: RAIO.controle, overflow: 'hidden' }}>
        <CodigoQR
          valor={ativa.codigoCheckin}
          tamanho={LADO_DO_QR}
          rotulo={`QR do seu código de entrada, ${ativa.codigoCheckin.split('').join(' ')}`}
        />
      </View>
      <View style={{ gap: ESPACO.e4 }}>
        <Texto variante="codigo" centralizado selectable>
          {formatarCodigo(ativa.codigoCheckin)}
        </Texto>
        <Texto variante="legenda" cor="textoSuave" centralizado>
          Mostre na entrada. Aumente o brilho da tela se precisar.
        </Texto>
      </View>
      {erro ? <AvisoDeFalha erro={erro} /> : null}
    </View>
  )
}

/**
 * Fora de um cartão, o estado vem no próprio cartão de vidro (sobrancelha,
 * conteúdo e ações); dentro de um, só a sobrancelha e o conteúdo.
 */
function Bloco({
  dentroDeCartao,
  sobrancelha,
  extra,
  acoes,
  children,
}: {
  dentroDeCartao: boolean
  sobrancelha: string
  extra?: ReactNode
  acoes?: ReactNode
  children?: ReactNode
}) {
  if (!dentroDeCartao) {
    return (
      <CartaoDeVidro
        sobrancelha={sobrancelha}
        {...(extra ? { extra } : {})}
        {...(acoes ? { acoes } : {})}
      >
        {children}
      </CartaoDeVidro>
    )
  }
  return (
    <View style={{ gap: ESPACO.e8 }}>
      {extra ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
          <Texto variante="sobrancelha" style={{ flex: 1 }}>
            {sobrancelha}
          </Texto>
          {extra}
        </View>
      ) : null}
      {children}
      {acoes}
    </View>
  )
}
