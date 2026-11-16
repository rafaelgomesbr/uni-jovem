import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useRef } from 'react'
import { View } from 'react-native'

import type { EscalaDoInicio } from '@/servicos/contratoDosEventos'
import { AvisoDeFalha } from '@/ui/Falha'
import { dataDoInstante, falarQuando, formatarHora } from '@/utilidades/datas'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { focar, type NoDeView } from '@/ui/foco'
import { Texto } from '@/ui/Texto'
import { soNaWeb } from '@/ui/web'

import { confirmarQueNaoPodeIr, useResponderEscala } from '../escalas/consultas'
import { CHIP_DO_ESTADO_DA_ATRIBUICAO, NOME_DO_ESTADO_DA_ATRIBUICAO } from '../eventos/nomes'

function quandoCurto(iso: string, fuso: string): string {
  const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: fuso }).format(
    new Date(iso),
  )
  const dia = (nome.split('-')[0] ?? nome).replace(/^./, (c) => c.toLocaleUpperCase('pt-BR'))
  const [, mes, d] = dataDoInstante(iso, fuso).split('-')
  return `${dia}, ${d}/${mes} · ${formatarHora(iso, fuso)}`
}

interface Props {
  escala: EscalaDoInicio
  /** Quantas escalas a pessoa tem ao todo (com mais de uma, o terciário "Ver todas"). */
  total: number
  comunidadeId: string
  fuso: string
}

/**
 * "VOCÊ FOI CONVOCADO" (mockup; vocabulário da D54): sobrancelha, 4, a função
 * em `tituloItem`, a data em legenda e, enquanto espera resposta, os botões
 * médios "Aceitar" e "Não posso ir" lado a lado (o "Não posso ir" pede
 * confirmação). Já aceita: o chip à direita da sobrancelha e só "Pedir
 * substituição". A API manda primeiro a convocação que espera resposta.
 */
export function CartaoSuaEscala({ escala, total, comunidadeId, fuso }: Props) {
  const responder = useResponderEscala(comunidadeId)
  const resumo = useRef<NoDeView>(null)
  const onde = escala.etapaTitulo ? `${escala.etapaTitulo} · ${escala.funcao}` : escala.funcao
  // Esperando resposta não ganha chip: os botões já dizem.
  const chip = escala.estado === 'pendente' ? null : CHIP_DO_ESTADO_DA_ATRIBUICAO[escala.estado]
  const podeTrocar = escala.estado === 'confirmada'
  const depoisDeResponder = { onSuccess: () => focar(resumo) }

  async function naoPossoIr() {
    if (await confirmarQueNaoPodeIr()) {
      responder.mutate({ atribuicaoId: escala.id, resposta: 'recusar' }, depoisDeResponder)
    }
  }

  const pedirSubstituicao = (
    <Botao
      titulo="Pedir substituição"
      variante="secundario"
      rotuloAcessivel={`Pedir substituição em ${escala.eventoTitulo}, ${onde}`}
      aoPressionar={() =>
        router.push({
          pathname: '/escalas/substituicao/[atribuicaoId]',
          params: { atribuicaoId: escala.id },
        })
      }
    />
  )
  const verTodas =
    total > 1 ? (
      <Botao
        titulo={`Ver todas (${total})`}
        variante="terciario"
        alinhado
        rotuloAcessivel={`Ver todas as suas convocações (${total})`}
        aoPressionar={() => router.push('/escalas')}
      />
    ) : null

  return (
    <CartaoDeVidro
      sobrancelha="Você foi convocado"
      comecaComTitulo
      {...(chip ? { extra: <Chip texto={chip.texto} tom={chip.tom} /> } : {})}
      acoes={
        <View style={{ gap: ESPACO.e4 }}>
          {escala.estado === 'pendente' ? (
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
          ) : podeTrocar ? (
            pedirSubstituicao
          ) : (
            <Botao
              titulo="Ver minhas convocações"
              variante="secundario"
              aoPressionar={() => router.push('/escalas')}
            />
          )}
          {verTodas}
        </View>
      }
    >
      <View
        ref={resumo}
        {...soNaWeb({ tabIndex: -1 })}
        accessible
        accessibilityLabel={`${onde}. ${escala.eventoTitulo}, ${falarQuando(escala.eventoInicio, fuso)}. Situação: ${NOME_DO_ESTADO_DA_ATRIBUICAO[escala.estado]}`}
      >
        <Texto variante="tituloItem">{onde}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {escala.eventoTitulo} · {quandoCurto(escala.eventoInicio, fuso)}
        </Texto>
      </View>
      {responder.error ? <AvisoDeFalha erro={responder.error} /> : null}
    </CartaoDeVidro>
  )
}
