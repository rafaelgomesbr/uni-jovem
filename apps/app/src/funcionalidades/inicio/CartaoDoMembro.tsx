import { ESPACO, type PoseDoSol } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import type { EventoDoMomento, MomentoDoInicio, ParteDoMomento } from '@/servicos/contratoV3'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDoMomento } from '@/ui/CartaoDoMomento'
import { Chip } from '@/ui/Chip'
import { Texto } from '@/ui/Texto'
import { desfazerAgora, useDesfazerPendente } from '@/ui/ToastComDesfazer'

import {
  acoesDoMembro,
  descreverParte,
  estaNoLouvor,
  etiquetaDoMomento,
  momentoDoDia,
  posicaoNoDia,
  tocaNoLouvor,
} from './momento'
import { dataEHoraDoCartao } from './quando'
import {
  botaoComum,
  ChipsDoTopo,
  LinhaDoMotivo,
  ordenarBotoes,
  textoDaPosicao,
  useDestinosDoEncontro,
} from './PecasDoCartao'

export const MOTIVO_SEM_INTERNET_PARA_RESPONDER = 'Precisa de internet para responder.'

interface Props {
  momento: MomentoDoInicio
  evento: EventoDoMomento
  /** As partes da pessoa neste encontro, já com a resposta em espera aplicada. */
  partes: readonly ParteDoMomento[]
  /** Ids das convocações que a pessoa acabou de responder e ainda não chegaram ao servidor. */
  emEspera: ReadonlySet<string>
  semInternet: boolean
  /** "hoje, 14:32": quando a cópia mostrada foi salva (só com a internet fora). */
  versaoSalva: string | null
  /** Pose do sol durante um encanto (o primeiro "Aceitar" faz o sol subir). */
  poseDoEncanto?: PoseDoSol
  aoAceitar: (parte: ParteDoMomento) => void
  aoRecusar: (parte: ParteDoMomento) => void
  /** O que mostrar logo abaixo da parte (a faixa do encanto). */
  rodape?: ReactNode
}

/** "Louvor · Vocal", ou "Louvor · Vocal, Recepção e mais 1" quando são várias. */
function descricaoDasPartes(partes: readonly ParteDoMomento[]): string {
  const [a, b, ...mais] = partes.map(descreverParte)
  if (!a) return ''
  if (!b) return a
  return `${a}, ${b}${mais.length ? ` e mais ${mais.length}` : ''}`
}

/**
 * O cartão do momento do MEMBRO (3.1 do UX, D68 e D79), ENXUTO: a etiqueta do relógio, o título,
 * a data e a hora numa linha, UMA linha do que importa ("Sua parte" com a situação), o botão
 * principal e UM botão secundário de verdade. O botão principal muda com o relógio, a convocação e o
 * instrumento; a pendência vence o relógio ("Aceitar" até no dia). Sem internet os botões de
 * resposta ficam desabilitados com o motivo escrito embaixo.
 */
export function CartaoDoMembro({
  momento,
  evento,
  partes,
  emEspera,
  semInternet,
  versaoSalva,
  poseDoEncanto,
  aoAceitar,
  aoRecusar,
  rodape,
}: Props) {
  const toco = estaNoLouvor(partes)
  const musicas = evento.musicas ?? 0
  const destinos = useDestinosDoEncontro(evento, { toco, musicas, organiza: false })
  const esperaDoDesfazer = useDesfazerPendente()
  const dia = momentoDoDia(momento)

  const pendente = partes.find((p) => p.estado === 'pendente') ?? null
  const ativas = partes.filter((p) => p.estado !== 'recusada')
  const todasRecusadas = partes.length > 0 && ativas.length === 0
  const musicoConfirmado = tocaNoLouvor(ativas)
  const inscricao = momento.inscricao?.situacao ?? null
  const podeSeInscrever = inscricao === 'aberta'

  const { primaria, secundaria } = acoesDoMembro({
    momento: dia,
    pendente: pendente !== null,
    musicoConfirmado,
    podeSeInscrever,
    depoisDeUmEncontro: momento.recemTerminado !== null,
    temRepertorio: musicas > 0,
  })

  /** `modo`: o botão em destaque ou o secundário (a outra resposta, ou o caminho de apoio). */
  function botao(acao: typeof primaria, modo: 'primario' | 'secundario') {
    const principal = modo === 'primario'
    const variante = principal ? 'primario' : 'secundario'
    if (acao === 'aceitar' && pendente) {
      return (
        <Botao
          key={acao}
          titulo="Aceitar"
          variante={variante}
          desabilitado={semInternet}
          rotuloAcessivel={`Aceitar a convocação em ${evento.titulo}, ${descreverParte(pendente)}`}
          aoPressionar={() => aoAceitar(pendente)}
        />
      )
    }
    if (acao === 'naoPossoIr' && pendente) {
      return (
        <Botao
          key={acao}
          titulo="Não posso ir"
          variante={variante}
          desabilitado={semInternet}
          rotuloAcessivel={`Não posso ir: avisar a liderança sobre ${evento.titulo}, ${descreverParte(pendente)}`}
          aoPressionar={() => aoRecusar(pendente)}
        />
      )
    }
    return botaoComum(acao, principal, evento, destinos)
  }

  // "Aceitar" e "Não posso ir" são as duas respostas de uma pergunta só: ficam lado a lado. Qualquer
  // outro caminho é UM botão de verdade abaixo do principal, na mesma largura (D79). Havendo
  // músicas, o repertório à mão vence o "Ver o encontro" genérico (D73): o cartão já abre o encontro.
  const respondendo = primaria === 'aceitar'
  const secundariaFinal =
    secundaria === 'ver' && (musicoConfirmado || musicas > 0) && primaria !== 'repertorio'
      ? ('repertorio' as const)
      : secundaria
  const botoes = ordenarBotoes(
    botao(primaria, 'primario'),
    secundariaFinal ? botao(secundariaFinal, 'secundario') : null,
  )

  // A resposta recusada ainda pode ser desfeita enquanto o toast espera.
  const podeDesfazer = esperaDoDesfazer !== null && partes.some((p) => emEspera.has(p.atribuicaoId))
  const etiqueta = etiquetaDoMomento(momento)
  const quando = dataEHoraDoCartao(evento.inicio, evento.fuso)
  const posicao = posicaoNoDia(momento)
  const temEstado =
    ativas.length > 0 ||
    todasRecusadas ||
    inscricao === 'aberta' ||
    inscricao === 'inscrito' ||
    inscricao === 'espera'

  return (
    <CartaoDoMomento
      momento={dia}
      {...(poseDoEncanto ? { pose: poseDoEncanto } : {})}
      etiqueta={etiqueta}
      aoVivo={dia === 'agora'}
      chip={<ChipsDoTopo posicao={posicao} versaoSalva={versaoSalva} />}
      titulo={evento.titulo}
      meta={quando}
      aoPressionar={destinos.abrirEncontro}
      rotuloAcessivel={[etiqueta, posicao ? textoDaPosicao(posicao) : null, evento.titulo, quando]
        .filter(Boolean)
        .join('. ')}
      dica="Abre o encontro."
      acoes={
        <View style={{ gap: ESPACO.e8 }}>
          <ParDeBotoes empilhar={!respondendo} larguraMinima={150}>
            {botoes}
          </ParDeBotoes>
          {semInternet && respondendo ? (
            <LinhaDoMotivo texto={MOTIVO_SEM_INTERNET_PARA_RESPONDER} />
          ) : null}
        </View>
      }
    >
      {temEstado || rodape ? (
        <View style={{ gap: ESPACO.e8 }}>
          {temEstado ? (
            <View style={{ gap: ESPACO.e8, alignItems: 'flex-start' }}>
              {ativas.length > 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    columnGap: ESPACO.e8,
                    rowGap: ESPACO.e8,
                  }}
                >
                  <Texto variante="corpo" peso="medio">
                    {`Sua parte: ${descricaoDasPartes(ativas)}`}
                  </Texto>
                  {pendente ? (
                    <Chip situacao="aguardando" texto="Aguardando sua resposta" />
                  ) : ativas.some((p) => p.estado === 'substituicao_pedida') ? (
                    <Chip tom="alerta" icone="relogio" texto="Troca pedida" />
                  ) : (
                    <Chip
                      situacao="aceitou"
                      {...(ativas.some((p) => emEspera.has(p.atribuicaoId))
                        ? { aparecer: 'confirmado' as const }
                        : {})}
                    />
                  )}
                </View>
              ) : null}

              {todasRecusadas ? (
                <View style={{ gap: ESPACO.e4, alignItems: 'flex-start' }}>
                  <Texto variante="corpo" peso="medio">
                    Você avisou que não pode. A liderança será avisada.
                  </Texto>
                  {podeDesfazer ? (
                    <Botao
                      titulo="Desfazer"
                      variante="terciario"
                      alinhado
                      tamanho="compacto"
                      aoPressionar={desfazerAgora}
                    />
                  ) : null}
                </View>
              ) : null}

              {ativas.length === 0 && !todasRecusadas && inscricao === 'aberta' ? (
                <Texto variante="corpo" peso="medio">
                  Inscrições abertas
                </Texto>
              ) : null}
              {inscricao === 'inscrito' ? (
                <Chip tom="sucesso" icone="check" texto="Inscrito" />
              ) : null}
              {inscricao === 'espera' ? (
                <Chip tom="alerta" icone="relogio" texto="Na lista de espera" />
              ) : null}
            </View>
          ) : null}
          {rodape}
        </View>
      ) : null}
    </CartaoDoMomento>
  )
}
