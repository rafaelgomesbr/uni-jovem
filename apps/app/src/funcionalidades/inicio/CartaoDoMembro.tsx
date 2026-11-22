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
  dataEHorario,
  descreverParte,
  etiquetaDoMomento,
  momentoDoDia,
  tocaNoLouvor,
} from './momento'
import {
  AvisoDeEspera,
  botaoComum,
  LinhaDoMotivo,
  ordenarBotoes,
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
 * O cartão do momento do MEMBRO (3.1 do UX, D68): a etiqueta do relógio, o título, a data, o
 * local com "Como chegar", "Sua parte" com a situação, e UM primário que muda com o relógio, a
 * convocação e o instrumento. A pendência vence o relógio ("Aceitar" até no dia). Sem internet
 * os botões de resposta ficam desabilitados com o motivo escrito embaixo.
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
  const destinos = useDestinosDoEncontro(evento)
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
  })

  function botao(acao: typeof primaria, principal: boolean) {
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

  const botoes = ordenarBotoes(botao(primaria, true), secundaria ? botao(secundaria, false) : null)
  const respondendo = primaria === 'aceitar'
  const musicoSemBotao =
    musicoConfirmado && primaria !== 'repertorio' && secundaria !== 'repertorio' && !respondendo

  // A resposta recusada ainda pode ser desfeita enquanto o toast espera.
  const podeDesfazer = esperaDoDesfazer !== null && partes.some((p) => emEspera.has(p.atribuicaoId))
  const aindaNaoRespondeu = pendente !== null && (dia === 'dia' || dia === 'agora')

  return (
    <CartaoDoMomento
      momento={dia}
      {...(poseDoEncanto ? { pose: poseDoEncanto } : {})}
      etiqueta={etiquetaDoMomento(momento)}
      aoVivo={dia === 'agora'}
      {...(versaoSalva
        ? { chip: <Chip tom="neutro" texto={`Última versão: ${versaoSalva}`} /> }
        : {})}
      titulo={evento.titulo}
      meta={[dataEHorario(evento.inicio, evento.duracaoMin, evento.fuso), evento.local?.nome]
        .filter(Boolean)
        .join('\n')}
      aoPressionar={destinos.abrirEncontro}
      rotuloAcessivel={[
        etiquetaDoMomento(momento),
        evento.titulo,
        dataEHorario(evento.inicio, evento.duracaoMin, evento.fuso),
        evento.local?.nome,
      ]
        .filter(Boolean)
        .join('. ')}
      dica="Abre o encontro."
      acoes={
        <View style={{ gap: ESPACO.e8 }}>
          <ParDeBotoes larguraMinima={150}>{botoes}</ParDeBotoes>
          {semInternet && respondendo ? (
            <LinhaDoMotivo texto={MOTIVO_SEM_INTERNET_PARA_RESPONDER} />
          ) : null}
        </View>
      }
    >
      <View style={{ gap: ESPACO.e8 }}>
        {evento.local && primaria !== 'comoChegar' && destinos.temMapa ? (
          <Botao
            titulo="Como chegar"
            variante="terciario"
            alinhado
            icone="local"
            tamanho="compacto"
            rotuloAcessivel={`Como chegar a ${evento.titulo}`}
            aoPressionar={destinos.comoChegar}
          />
        ) : null}

        {ativas.length > 0 ? (
          <View style={{ gap: ESPACO.e8 }}>
            <Texto variante="rotulo">{`Sua parte: ${descricaoDasPartes(ativas)}`}</Texto>
            {pendente ? (
              aindaNaoRespondeu ? (
                <AvisoDeEspera texto="Você ainda não respondeu. Dá tempo de avisar a liderança." />
              ) : (
                <Chip situacao="aguardando" texto="Aguardando sua resposta" />
              )
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
            <Texto variante="corpo">Você avisou que não pode. A liderança será avisada.</Texto>
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
          <Texto variante="rotulo">Inscrições abertas</Texto>
        ) : null}
        {inscricao === 'inscrito' ? <Chip tom="sucesso" icone="check" texto="Inscrito" /> : null}
        {inscricao === 'espera' ? (
          <Chip tom="alerta" icone="relogio" texto="Na lista de espera" />
        ) : null}

        {musicoSemBotao ? (
          <Botao
            titulo="Abrir o repertório"
            variante="terciario"
            alinhado
            icone="musica"
            tamanho="compacto"
            rotuloAcessivel={`Abrir o meu repertório de ${evento.titulo}`}
            aoPressionar={destinos.repertorio}
          />
        ) : null}
        {rodape}
      </View>
    </CartaoDoMomento>
  )
}
