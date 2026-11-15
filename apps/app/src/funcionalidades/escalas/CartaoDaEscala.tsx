import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useRef } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { EscalaDoInicio, MinhaEscala } from '@/servicos/contratoDosEventos'
import { AvisoDeFalha } from '@/ui/Falha'
import { confirmar } from '@/utilidades/confirmar'
import { dataDoInstante, falarQuando, formatarHora } from '@/utilidades/datas'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip, type TomDoChip } from '@/ui/Chip'
import { focar, type NoDeView } from '@/ui/foco'
import { Texto } from '@/ui/Texto'
import { soNaWeb } from '@/ui/web'

import { naComunidade } from '../eventos/consultas'
import { NOME_DO_ESTADO_DA_ATRIBUICAO } from '../eventos/nomes'
import { useInvalidarEscalas, useResponderEscala } from './consultas'

/** Chip de cada estado da escala (mapa da 2.12.12). */
const CHIP: Readonly<Record<EscalaDoInicio['estado'], { texto: string; tom: TomDoChip }>> = {
  pendente: { texto: 'Pendente', tom: 'alerta' },
  confirmada: { texto: 'Confirmada', tom: 'sucesso' },
  recusada: { texto: 'Recusada', tom: 'erro' },
  substituicao_pedida: { texto: 'Substituição pedida', tom: 'info' },
}

/** "Sábado, 21/11 · 16:00": a sobrancelha da data (maiúsculas por estilo). */
export function quandoDaEscala(iso: string, fuso: string): string {
  const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: fuso }).format(
    new Date(iso),
  )
  const dia = (nome.split('-')[0] ?? nome).replace(/^./, (c) => c.toLocaleUpperCase('pt-BR'))
  const [, mes, d] = dataDoInstante(iso, fuso).split('-')
  return `${dia}, ${d}/${mes} · ${formatarHora(iso, fuso)}`
}

interface Props {
  escala: EscalaDoInicio | MinhaEscala
  comunidadeId: string
  fuso: string
  /**
   * "Confirmar" é o primário só na escala mais urgente da tela (a primeira
   * pendente): um primário visível por tela. Nas outras, é secundário.
   */
  primario?: boolean
}

/**
 * Uma escala da própria pessoa (3.4.5), no formato do "Sua escala" do
 * Início: a data na sobrancelha com o chip da situação à direita, 4, a
 * função em `tituloItem`, o evento em `meta` e, embaixo, "Confirmar" e
 * "Pedir substituição" lado a lado. "Não posso ir" (recusar) fica à vista,
 * em terciário logo abaixo: atrás de um "…" sem texto, ninguém achava (U-05).
 * Com substituição pedida, a ação é cancelar o pedido.
 */
export function CartaoDaEscala({ escala, comunidadeId, fuso, primario = false }: Props) {
  const responder = useResponderEscala(comunidadeId)
  const invalidar = useInvalidarEscalas(comunidadeId)
  const pedidoAberto = 'substituicaoAberta' in escala ? escala.substituicaoAberta : null
  const cancelarPedido = useMutation({
    mutationFn: (id: string) =>
      api.post(`${naComunidade(comunidadeId)}/substituicoes/${id}/cancelar`),
    onSuccess: invalidar,
  })
  const onde = escala.etapaTitulo ? `${escala.etapaTitulo} · ${escala.funcao}` : escala.funcao
  const comSubstituicao = escala.estado === 'substituicao_pedida'
  const podeRecusar = !comSubstituicao && escala.estado !== 'recusada'
  const chip = CHIP[escala.estado]
  // Depois de responder, o botão tocado some: o foco vai para o resumo, que já diz a situação nova.
  const resumo = useRef<NoDeView>(null)
  const depoisDeResponder = { onSuccess: () => focar(resumo) }
  const erro = responder.error ?? cancelarPedido.error

  async function recusar() {
    const ok = await confirmar({
      titulo: 'Recusar esta escala?',
      mensagem:
        'A organização fica sabendo que você não pode. Se preferir que alguém fique no seu lugar, peça substituição.',
      confirmar: 'Recusar',
      destrutivo: true,
    })
    if (ok) responder.mutate({ atribuicaoId: escala.id, resposta: 'recusar' }, depoisDeResponder)
  }

  const pedirSubstituicao = (
    <Botao
      titulo="Pedir substituição"
      variante="secundario"
      rotuloAcessivel={`Pedir substituição na escala de ${escala.eventoTitulo}, ${onde}`}
      aoPressionar={() =>
        router.push({
          pathname: '/escalas/substituicao/[atribuicaoId]',
          params: { atribuicaoId: escala.id },
        })
      }
    />
  )

  const botoes = comSubstituicao ? (
    pedidoAberto ? (
      <Botao
        titulo="Cancelar o pedido"
        variante="secundario"
        rotuloAcessivel={`Cancelar o pedido de substituição em ${escala.eventoTitulo}, ${onde}`}
        carregando={cancelarPedido.isPending}
        aoPressionar={() => cancelarPedido.mutate(pedidoAberto, depoisDeResponder)}
      />
    ) : null
  ) : escala.estado === 'confirmada' ? (
    pedirSubstituicao
  ) : (
    <ParDeBotoes>
      <Botao
        titulo="Confirmar"
        variante={primario ? 'primario' : 'secundario'}
        rotuloAcessivel={`Confirmar a escala em ${escala.eventoTitulo}, ${onde}`}
        carregando={responder.isPending && responder.variables?.resposta === 'confirmar'}
        aoPressionar={() =>
          responder.mutate({ atribuicaoId: escala.id, resposta: 'confirmar' }, depoisDeResponder)
        }
      />
      {pedirSubstituicao}
    </ParDeBotoes>
  )

  return (
    <CartaoDeVidro
      sobrancelha={quandoDaEscala(escala.eventoInicio, fuso)}
      extra={<Chip texto={chip.texto} tom={chip.tom} />}
      comecaComTitulo
      {...(botoes || podeRecusar
        ? {
            acoes: (
              <View style={{ gap: ESPACO.e8 }}>
                {botoes}
                {podeRecusar ? (
                  <Botao
                    titulo="Não posso ir"
                    variante="terciario"
                    alinhado
                    rotuloAcessivel={`Não posso ir: recusar a escala em ${escala.eventoTitulo}, ${onde}`}
                    carregando={responder.isPending && responder.variables?.resposta === 'recusar'}
                    aoPressionar={() => void recusar()}
                  />
                ) : null}
              </View>
            ),
          }
        : {})}
    >
      <View
        ref={resumo}
        {...soNaWeb({ tabIndex: -1 })}
        accessible
        accessibilityLabel={`${onde}. ${escala.eventoTitulo}, ${falarQuando(escala.eventoInicio, fuso)}. Situação: ${NOME_DO_ESTADO_DA_ATRIBUICAO[escala.estado]}`}
      >
        <Texto variante="tituloItem">{onde}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {escala.eventoTitulo}
        </Texto>
        {comSubstituicao && !pedidoAberto ? (
          <Texto variante="legenda" cor="textoSuave">
            Você pediu substituição. Você continua na escala até alguém assumir.
          </Texto>
        ) : null}
      </View>
      {erro ? <AvisoDeFalha erro={erro} /> : null}
    </CartaoDeVidro>
  )
}
