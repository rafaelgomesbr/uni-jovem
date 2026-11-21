import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { EscalaDoInicio, EventoDoInicio } from '@/servicos/contratoDosEventos'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { Chip } from '@/ui/Chip'
import { AvisoDeFalha } from '@/ui/Falha'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { usePode } from '../comunidade/permissoes'
import { confirmarQueNaoPodeIr, useResponderEscala } from '../escalas/consultas'
import { naComunidade, useEvento } from '../eventos/consultas'
import { ChipDoStatus, rotuloFaladoDoEvento } from '../eventos/LinhaDoEvento'
import { useMudancaNoEvento } from '../eventos/mutacoes'
import { motivoSemInscricao } from '../eventos/regras'
import { escalaDeLouvor } from '../repertorio/souDoLouvor'
import { dataCompleta, diasAte, faixaDeHorario, proximidadeDoEncontro } from './quando'
import { useVisaoGeralDaComunidade } from './visaoGeral'

/** O que o botão do cartão faz. Um primário só, que muda conforme o estado (D62). */
export type AcaoDoCartao =
  | 'aceitar'
  | 'naoPossoIr'
  | 'publicar'
  | 'editar'
  | 'checkin'
  | 'aoVivo'
  | 'verQuemFalta'
  | 'repertorio'
  | 'inscrever'
  | 'ver'

export interface SituacaoDoCartao {
  /** Organiza: publica e vê os números da equipe. */
  organiza: boolean
  rascunho: boolean
  /** Está acontecendo agora. */
  aoVivo: boolean
  /** Hoje, a partir de 2 h antes, e o encontro está publicado: hora do check-in. */
  naHoraDoCheckin: boolean
  /** A pessoa tem uma convocação deste encontro esperando resposta. */
  convocacaoPendente: boolean
  /** A pessoa toca no louvor neste encontro (convocação de louvor confirmada). */
  noLouvor: boolean
  /** Convocados deste encontro que ainda não responderam (só quem organiza sabe). */
  semResposta: number
  /** Encontro público com inscrição aberta e a pessoa ainda não está inscrita. */
  podeSeInscrever: boolean
}

/**
 * A tabela da seção 5 da auditoria de 21/11/2026: o botão primário e o
 * secundário (se houver) conforme quem olha e em que estado está o encontro.
 * Função pura, para testar cada linha da tabela sem montar a tela.
 */
export function acoesDoCartao(s: SituacaoDoCartao): {
  primaria: AcaoDoCartao
  secundaria: AcaoDoCartao | null
} {
  if (s.organiza && s.rascunho) return { primaria: 'publicar', secundaria: 'editar' }
  if (s.organiza && s.naHoraDoCheckin) return { primaria: 'checkin', secundaria: 'aoVivo' }
  if (s.convocacaoPendente) return { primaria: 'aceitar', secundaria: 'naoPossoIr' }
  if (s.aoVivo) return { primaria: 'aoVivo', secundaria: null }
  if (s.organiza && s.semResposta > 0) return { primaria: 'verQuemFalta', secundaria: 'ver' }
  if (s.noLouvor) return { primaria: 'repertorio', secundaria: 'ver' }
  if (s.podeSeInscrever) return { primaria: 'inscrever', secundaria: 'ver' }
  return { primaria: 'ver', secundaria: null }
}

const TEXTO_DO_ESTADO = {
  pendente: { texto: 'Aguardando sua resposta', tom: 'alerta' },
  substituicao_pedida: { texto: 'Troca pedida', tom: 'alerta' },
  confirmada: { texto: 'Confirmado', tom: 'sucesso' },
} as const

/** "Louvor · Vocal" (a convocação sem etapa é só a função). */
function ondeDaConvocacao(e: EscalaDoInicio): string {
  return e.etapaTitulo ? `${e.etapaTitulo} · ${e.funcao}` : e.funcao
}

interface Props {
  evento: EventoDoInicio
  comunidadeId: string
  fuso: string
  /** As convocações da pessoa neste encontro. */
  minhasConvocacoes: readonly EscalaDoInicio[]
  /** Está inscrita neste encontro (e não só na lista de espera). */
  inscrita: boolean
  agora?: Date
}

/**
 * Próximo encontro no Início (D62): logo depois da saudação, sempre à vista,
 * sem rolar. A proximidade em texto ("Hoje", "Amanhã", "Em 5 dias"), a data
 * completa, o horário, o título, o local, a linha "Você: Louvor · Vocal"
 * quando a pessoa foi convocada e UM botão primário que muda conforme o
 * estado. A convocação pendente deste encontro (Aceitar, Não posso ir) mora
 * aqui dentro. Sem a lista de etapas: o roteiro está a um toque.
 */
export function CartaoDoProximoEvento({
  evento,
  comunidadeId,
  fuso,
  minhasConvocacoes,
  inscrita,
  agora = new Date(),
}: Props) {
  const pode = usePode()
  const organiza = pode('evento', 'publicar')
  const podeCheckin = pode('presenca', 'registrar')
  const detalhe = useEvento(comunidadeId, evento.id)
  const numeros = useVisaoGeralDaComunidade(comunidadeId, organiza)
  const responder = useResponderEscala(comunidadeId)
  const publicarEncontro = useMudancaNoEvento(comunidadeId, evento.id, (_base, _v: void) =>
    api.post(`${naComunidade(comunidadeId)}/eventos/${evento.id}/status`, { status: 'publicado' }),
  )

  const inicio = new Date(evento.inicio).getTime()
  const fim = inicio + evento.duracaoMin * 60_000
  const publicado = evento.status === 'publicado'
  const aoVivo = publicado && agora.getTime() >= inicio && agora.getTime() < fim
  const naHoraDoCheckin =
    publicado && podeCheckin && agora.getTime() >= inicio - 2 * 3_600_000 && agora.getTime() < fim
  const pendente = minhasConvocacoes.find((e) => e.estado === 'pendente') ?? null
  const noLouvor =
    escalaDeLouvor(minhasConvocacoes.filter((e) => e.estado === 'confirmada')) !== null
  const deste = numeros.data?.proximosEncontros.find((e) => e.id === evento.id) ?? null
  const semResposta = deste?.semResposta ?? 0
  const podeSeInscrever =
    !organiza &&
    !inscrita &&
    pode('inscricao', 'inscrever_se', { proprio: true }) &&
    detalhe.data?.visibilidade === 'publica' &&
    motivoSemInscricao(detalhe.data, agora) === null

  const { primaria, secundaria } = acoesDoCartao({
    organiza,
    rascunho: evento.status === 'rascunho',
    aoVivo,
    naHoraDoCheckin,
    convocacaoPendente: pendente !== null,
    noLouvor,
    semResposta,
    podeSeInscrever,
  })

  const abrir = () =>
    router.push({ pathname: '/evento/[eventoId]', params: { eventoId: evento.id } })

  async function publicar() {
    const publica = detalhe.data?.visibilidade === 'publica'
    const ok = await confirmar({
      titulo: 'Publicar este encontro?',
      mensagem: publica
        ? 'Todos da comunidade passam a ver o encontro, e a página pública de inscrição fica no ar.'
        : 'Todos da comunidade passam a ver o encontro na agenda.',
      confirmar: 'Publicar',
    })
    if (ok) {
      publicarEncontro.mutate(undefined, {
        onSuccess: () => mostrarToast({ texto: 'Encontro publicado.' }),
      })
    }
  }

  async function naoPossoIr() {
    if (pendente && (await confirmarQueNaoPodeIr())) {
      responder.mutate({ atribuicaoId: pendente.id, resposta: 'recusar' })
    }
  }

  function botao(acao: AcaoDoCartao, principal: boolean) {
    const variante = principal ? 'primario' : 'secundario'
    const alvo = { eventoId: evento.id }
    switch (acao) {
      case 'aceitar':
        return pendente ? (
          <Botao
            key={acao}
            titulo="Aceitar"
            variante={variante}
            rotuloAcessivel={`Aceitar a convocação em ${evento.titulo}, ${ondeDaConvocacao(pendente)}`}
            carregando={responder.isPending && responder.variables?.resposta === 'confirmar'}
            aoPressionar={() =>
              responder.mutate({ atribuicaoId: pendente.id, resposta: 'confirmar' })
            }
          />
        ) : null
      case 'naoPossoIr':
        return pendente ? (
          <Botao
            key={acao}
            titulo="Não posso ir"
            variante={variante}
            rotuloAcessivel={`Não posso ir: avisar a organização sobre ${evento.titulo}, ${ondeDaConvocacao(pendente)}`}
            carregando={responder.isPending && responder.variables?.resposta === 'recusar'}
            aoPressionar={() => void naoPossoIr()}
          />
        ) : null
      case 'publicar':
        return (
          <Botao
            key={acao}
            titulo="Publicar"
            variante={variante}
            rotuloAcessivel={`Publicar o encontro ${evento.titulo}`}
            carregando={publicarEncontro.isPending}
            aoPressionar={() => void publicar()}
          />
        )
      case 'editar':
        return (
          <Botao
            key={acao}
            titulo="Editar"
            variante={variante}
            aoPressionar={() =>
              router.push({ pathname: '/evento/[eventoId]/editar', params: alvo })
            }
          />
        )
      case 'checkin':
        return (
          <Botao
            key={acao}
            titulo="Fazer check-in"
            variante={variante}
            aoPressionar={() =>
              router.push({ pathname: '/evento/[eventoId]/checkin', params: alvo })
            }
          />
        )
      case 'aoVivo':
        return (
          <Botao
            key={acao}
            titulo={principal ? 'Acompanhar ao vivo' : 'Abrir ao vivo'}
            variante={variante}
            aoPressionar={() =>
              router.push({ pathname: '/evento/[eventoId]/ao-vivo', params: alvo })
            }
          />
        )
      case 'verQuemFalta':
        return (
          <Botao
            key={acao}
            titulo="Ver quem falta responder"
            variante={variante}
            aoPressionar={() =>
              router.push({
                pathname: '/evento/[eventoId]',
                params: { eventoId: evento.id, aba: 'convocados' },
              })
            }
          />
        )
      case 'repertorio':
        return (
          <Botao
            key={acao}
            titulo="Abrir o repertório"
            variante={variante}
            icone="musica"
            rotuloAcessivel={`Abrir o meu repertório de ${evento.titulo}`}
            aoPressionar={() => router.push('/meu-repertorio')}
          />
        )
      case 'inscrever':
        // A inscrição (com a vaga, a espera e o QR de entrada) se conclui na tela do encontro.
        return <Botao key={acao} titulo="Inscrever-me" variante={variante} aoPressionar={abrir} />
      case 'ver':
        return <Botao key={acao} titulo="Ver o encontro" variante={variante} aoPressionar={abrir} />
    }
  }

  const botoes = [botao(primaria, true), secundaria ? botao(secundaria, false) : null].filter(
    Boolean,
  )

  // "Você: Louvor · Vocal" e a situação em texto (o chip leva texto e ícone, nunca só cor).
  const ativas = minhasConvocacoes.filter((e) => e.estado !== 'recusada')
  const situacaoDaPessoa = ativas.some((e) => e.estado === 'pendente')
    ? TEXTO_DO_ESTADO.pendente
    : ativas.some((e) => e.estado === 'substituicao_pedida')
      ? TEXTO_DO_ESTADO.substituicao_pedida
      : TEXTO_DO_ESTADO.confirmada
  const voce = ativas.length
    ? `Você: ${ativas.slice(0, 2).map(ondeDaConvocacao).join(', ')}${
        ativas.length > 2 ? ` e mais ${ativas.length - 2}` : ''
      }`
    : inscrita
      ? 'Você: inscrito'
      : null
  const aceitaram =
    organiza && deste && deste.convocados > 0
      ? `${deste.convocados - deste.semResposta - deste.recusadas} de ${deste.convocados} aceitaram`
      : null

  const proximidade = proximidadeDoEncontro(diasAte(evento.inicio, fuso, agora))
  const rotulo = [
    `${proximidade}. ${rotuloFaladoDoEvento(evento, fuso)}`,
    voce ? (ativas.length ? `${voce}. ${situacaoDaPessoa.texto}` : voce) : null,
    aceitaram,
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <CartaoDeDestaque
      sobrancelha={proximidade}
      meta={`${dataCompleta(evento.inicio, fuso)} · ${faixaDeHorario(evento.inicio, evento.duracaoMin, fuso)}`}
      chip={
        aoVivo ? (
          <Chip texto="Ao vivo" tom="quente" ponto />
        ) : (
          <ChipDoStatus status={evento.status} />
        )
      }
      titulo={evento.titulo}
      {...(evento.localNome ? { descricao: evento.localNome } : {})}
      aoPressionar={abrir}
      rotuloAcessivel={rotulo}
      dica="Abre o encontro."
      acoes={
        <View style={{ gap: ESPACO.e8 }}>
          {botoes.length > 1 ? <ParDeBotoes>{botoes}</ParDeBotoes> : botoes[0]}
          {responder.error ? <AvisoDeFalha erro={responder.error} /> : null}
          {publicarEncontro.error ? <AvisoDeFalha erro={publicarEncontro.error} /> : null}
        </View>
      }
    >
      {voce || aceitaram ? (
        <View style={{ gap: ESPACO.e8 }}>
          {voce ? (
            <View style={{ gap: ESPACO.e4 }}>
              <Texto variante="rotulo">{voce}</Texto>
              {ativas.length ? (
                <Chip
                  texto={situacaoDaPessoa.texto}
                  tom={situacaoDaPessoa.tom}
                  {...(situacaoDaPessoa.tom === 'sucesso' ? { icone: 'check' as const } : {})}
                />
              ) : null}
            </View>
          ) : null}
          {aceitaram ? <Texto variante="rotulo">{aceitaram}</Texto> : null}
        </View>
      ) : null}
    </CartaoDeDestaque>
  )
}
