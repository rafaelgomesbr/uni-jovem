import { useMutation } from '@tanstack/react-query'
import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { EscalaDoInicio, MinhaEscala } from '@/servicos/contratoDosEventos'
import { confirmar } from '@/utilidades/confirmar'
import { falarQuando, formatarQuando } from '@/utilidades/datas'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

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
  const { cores } = useTema()
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

  async function recusar() {
    const ok = await confirmar({
      titulo: 'Recusar esta escala?',
      mensagem:
        'A organização fica sabendo que você não pode. Se preferir que alguém fique no seu lugar, peça substituição.',
      confirmar: 'Recusar',
      destrutivo: true,
    })
    if (ok) responder.mutate({ atribuicaoId: escala.id, resposta: 'recusar' })
  }

  return (
    <View
      style={{
        gap: ESPACO.x2,
        padding: ESPACO.x3,
        borderRadius: RAIO.medio,
        borderWidth: 1,
        borderColor: cores.borda,
      }}
    >
      <View
        accessible
        accessibilityLabel={`${escala.eventoTitulo}. ${onde}. ${falarQuando(escala.eventoInicio, fuso)}. Situação: ${NOME_DO_ESTADO_DA_ATRIBUICAO[escala.estado]}`}
        style={{ gap: 2 }}
      >
        <Texto variante="corpoForte">{escala.eventoTitulo}</Texto>
        <Texto variante="apoio" cor="textoSuave">
          {onde}
        </Texto>
        <Texto variante="apoio" cor="textoSuave">
          {formatarQuando(escala.eventoInicio, fuso)}
        </Texto>
        <Selo
          texto={NOME_DO_ESTADO_DA_ATRIBUICAO[escala.estado]}
          cor={COR_DO_ESTADO_DA_ATRIBUICAO[escala.estado]}
        />
      </View>
      {(responder.error ?? cancelarPedido.error) ? (
        <AvisoDeErro erro={responder.error ?? cancelarPedido.error} />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        {!comSubstituicao && escala.estado !== 'confirmada' ? (
          <Botao
            titulo="Confirmar"
            icone="confirmado"
            larguraTotal={false}
            rotuloAcessivel={`Confirmar a escala em ${escala.eventoTitulo}, ${onde}`}
            carregando={responder.isPending && responder.variables?.resposta === 'confirmar'}
            aoPressionar={() =>
              responder.mutate({ atribuicaoId: escala.id, resposta: 'confirmar' })
            }
          />
        ) : null}
        {!comSubstituicao && escala.estado !== 'recusada' ? (
          <Botao
            titulo="Recusar"
            variante="secundario"
            larguraTotal={false}
            rotuloAcessivel={`Recusar a escala em ${escala.eventoTitulo}, ${onde}`}
            carregando={responder.isPending && responder.variables?.resposta === 'recusar'}
            aoPressionar={() => void recusar()}
          />
        ) : null}
        {!comSubstituicao ? (
          <Botao
            titulo="Pedir substituição"
            icone="trocar"
            variante="secundario"
            larguraTotal={false}
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
            larguraTotal={false}
            carregando={cancelarPedido.isPending}
            aoPressionar={() => cancelarPedido.mutate(pedidoAberto)}
          />
        ) : (
          <Texto variante="apoio" cor="textoSuave">
            Você pediu substituição. Para cancelar o pedido, abra Minhas escalas.
          </Texto>
        )}
      </View>
    </View>
  )
}
