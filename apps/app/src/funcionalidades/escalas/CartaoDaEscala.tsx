import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useRef } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { EscalaDoInicio, MinhaEscala } from '@/servicos/contratoDosEventos'
import { confirmar } from '@/utilidades/confirmar'
import { falarQuando, formatarQuando } from '@/utilidades/datas'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { focar, type NoDeView } from '@/ui/foco'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'
import { soNaWeb } from '@/ui/web'

import { naComunidade } from '../eventos/consultas'
import { COR_DO_ESTADO_DA_ATRIBUICAO, NOME_DO_ESTADO_DA_ATRIBUICAO } from '../eventos/nomes'
import { useInvalidarEscalas, useResponderEscala } from './consultas'

interface Props {
  escala: EscalaDoInicio | MinhaEscala
  comunidadeId: string
  fuso: string
}

/**
 * Uma escala da própria pessoa, com as respostas possíveis: confirmar,
 * recusar, pedir substituição ou cancelar o pedido em aberto.
 */
export function CartaoDaEscala({ escala, comunidadeId, fuso }: Props) {
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
  // Depois de responder, o botão tocado some: o foco vai para o resumo, que já diz a situação nova.
  const resumo = useRef<NoDeView>(null)
  const depoisDeResponder = { onSuccess: () => focar(resumo) }

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

  const onde_ = escala.etapaTitulo ? `${escala.etapaTitulo} · ${escala.funcao}` : escala.funcao
  return (
    // Mockup "Sua escala": a função em destaque, o evento e a hora abaixo, e as
    // duas respostas principais lado a lado. Sem moldura própria: vive dentro de um cartão.
    <View style={{ gap: ESPACO.x3 }}>
      <View
        ref={resumo}
        {...soNaWeb({ tabIndex: -1 })}
        accessible
        accessibilityLabel={`${escala.eventoTitulo}. ${onde_}. ${falarQuando(escala.eventoInicio, fuso)}. Situação: ${NOME_DO_ESTADO_DA_ATRIBUICAO[escala.estado]}`}
        style={{ gap: ESPACO.x1 }}
      >
        <Texto variante="corpoForte">{onde_}</Texto>
        <Texto variante="apoio" cor="textoSuave" style={{ fontSize: 13 }}>
          {escala.eventoTitulo} · {formatarQuando(escala.eventoInicio, fuso)}
        </Texto>
        <Selo
          texto={NOME_DO_ESTADO_DA_ATRIBUICAO[escala.estado]}
          cor={COR_DO_ESTADO_DA_ATRIBUICAO[escala.estado]}
        />
      </View>
      {(responder.error ?? cancelarPedido.error) ? (
        <AvisoDeErro erro={responder.error ?? cancelarPedido.error} />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {!comSubstituicao && escala.estado !== 'confirmada' ? (
          <Botao
            titulo="Confirmar"
            larguraTotal={false}
            style={{ flex: 1, minWidth: 130 }}
            rotuloAcessivel={`Confirmar a escala em ${escala.eventoTitulo}, ${onde}`}
            carregando={responder.isPending && responder.variables?.resposta === 'confirmar'}
            aoPressionar={() =>
              responder.mutate(
                { atribuicaoId: escala.id, resposta: 'confirmar' },
                depoisDeResponder,
              )
            }
          />
        ) : null}
        {!comSubstituicao ? (
          <Botao
            titulo="Pedir substituição"
            variante="secundario"
            larguraTotal={false}
            style={{ flex: 1, minWidth: 130 }}
            rotuloAcessivel={`Pedir substituição na escala de ${escala.eventoTitulo}, ${onde}`}
            aoPressionar={() =>
              router.push({
                pathname: '/escalas/substituicao/[atribuicaoId]',
                params: { atribuicaoId: escala.id },
              })
            }
          />
        ) : pedidoAberto ? (
          <Botao
            titulo="Cancelar pedido de substituição"
            variante="secundario"
            carregando={cancelarPedido.isPending}
            aoPressionar={() => cancelarPedido.mutate(pedidoAberto, depoisDeResponder)}
          />
        ) : (
          <Texto variante="apoio" cor="textoSuave">
            Você pediu substituição. Para cancelar o pedido, abra Minhas escalas.
          </Texto>
        )}
      </View>
      {!comSubstituicao && escala.estado !== 'recusada' ? (
        <Botao
          titulo="Não posso ir"
          variante="terciario"
          larguraTotal={false}
          rotuloAcessivel={`Não posso ir: recusar a escala em ${escala.eventoTitulo}, ${onde}`}
          carregando={responder.isPending && responder.variables?.resposta === 'recusar'}
          aoPressionar={() => void recusar()}
          style={{ marginLeft: -ESPACO.x3 }}
        />
      ) : null}
    </View>
  )
}
