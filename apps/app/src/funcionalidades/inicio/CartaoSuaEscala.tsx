import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useRef } from 'react'
import { View } from 'react-native'

import type { EscalaDoInicio } from '@/servicos/contratoDosEventos'
import { AvisoDeFalha } from '@/ui/Falha'
import { falarQuando, formatarHora } from '@/utilidades/datas'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { focar, type NoDeView } from '@/ui/foco'
import { Texto } from '@/ui/Texto'
import { soNaWeb } from '@/ui/web'

import { confirmarQueNaoPodeIr, useResponderEscala } from '../escalas/consultas'
import { dataCompleta } from './quando'

interface Props {
  /** Uma convocação que espera resposta, de um encontro que não é o do cartão de cima. */
  escala: EscalaDoInicio
  /** Quantas convocações esperam resposta ao todo (com mais de uma, o terciário "Ver todas"). */
  total: number
  comunidadeId: string
  fuso: string
}

/**
 * "VOCÊ FOI CONVOCADO" (D62): só existe enquanto a pessoa precisa responder,
 * com "Aceitar" e "Não posso ir" lado a lado (o "Não posso ir" pede
 * confirmação). Depois de aceitar o cartão some do Início: a convocação vira a
 * linha "Você:" do cartão do encontro. Se a pendente é do mesmo encontro do
 * cartão de cima, os botões moram nele e este cartão nem aparece.
 */
export function CartaoSuaEscala({ escala, total, comunidadeId, fuso }: Props) {
  const responder = useResponderEscala(comunidadeId)
  const resumo = useRef<NoDeView>(null)
  const onde = escala.etapaTitulo ? `${escala.etapaTitulo} · ${escala.funcao}` : escala.funcao
  const depoisDeResponder = { onSuccess: () => focar(resumo) }

  async function naoPossoIr() {
    if (await confirmarQueNaoPodeIr()) {
      responder.mutate({ atribuicaoId: escala.id, resposta: 'recusar' }, depoisDeResponder)
    }
  }

  return (
    <CartaoDeVidro
      sobrancelha="Você foi convocado"
      comecaComTitulo
      acoes={
        <View style={{ gap: ESPACO.e4 }}>
          <ParDeBotoes>
            <Botao
              titulo="Aceitar"
              rotuloAcessivel={`Aceitar a convocação em ${escala.eventoTitulo}, ${onde}`}
              carregando={responder.isPending && responder.variables?.resposta === 'confirmar'}
              aoPressionar={() =>
                responder.mutate(
                  { atribuicaoId: escala.id, resposta: 'confirmar' },
                  depoisDeResponder,
                )
              }
            />
            <Botao
              titulo="Não posso ir"
              variante="secundario"
              rotuloAcessivel={`Não posso ir: avisar a organização sobre ${escala.eventoTitulo}, ${onde}`}
              carregando={responder.isPending && responder.variables?.resposta === 'recusar'}
              aoPressionar={() => void naoPossoIr()}
            />
          </ParDeBotoes>
          {total > 1 ? (
            <Botao
              titulo={`Ver todas (${total})`}
              variante="terciario"
              alinhado
              rotuloAcessivel={`Ver todas as suas convocações (${total})`}
              aoPressionar={() => router.push('/escalas')}
            />
          ) : null}
        </View>
      }
    >
      <View
        ref={resumo}
        {...soNaWeb({ tabIndex: -1 })}
        accessible
        accessibilityLabel={`${onde}. ${escala.eventoTitulo}, ${falarQuando(escala.eventoInicio, fuso)}. Situação: aguardando sua resposta`}
      >
        <Texto variante="tituloItem">{onde}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {`${escala.eventoTitulo} · ${dataCompleta(escala.eventoInicio, fuso)} · ${formatarHora(escala.eventoInicio, fuso)}`}
        </Texto>
      </View>
      {responder.error ? <AvisoDeFalha erro={responder.error} /> : null}
    </CartaoDeVidro>
  )
}
