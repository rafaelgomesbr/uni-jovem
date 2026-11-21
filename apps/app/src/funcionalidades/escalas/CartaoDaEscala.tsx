import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useRef } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { EscalaDoInicio, MinhaEscala } from '@/servicos/contratoDosEventos'
import { AvisoDeFalha } from '@/ui/Falha'
import { dataDoInstante, falarQuando, formatarHora } from '@/utilidades/datas'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { focar, type NoDeView } from '@/ui/foco'
import { Texto } from '@/ui/Texto'
import { soNaWeb } from '@/ui/web'

import { naComunidade } from '../eventos/consultas'
import { CHIP_DO_ESTADO_DA_ATRIBUICAO, NOME_DO_ESTADO_DA_ATRIBUICAO } from '../eventos/nomes'
import { confirmarQueNaoPodeIr, useInvalidarEscalas, useResponderEscala } from './consultas'

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
   * "Aceitar" é o primário só na convocação mais urgente da tela (a primeira
   * pendente): um primário visível por tela. Nas outras, é secundário.
   */
  primario?: boolean
}

/**
 * Uma convocação da própria pessoa (3.4.5), no formato do "Você foi convocado" do
 * Início: a data na sobrancelha com o chip da situação à direita, 4, a
 * função em `tituloItem`, o evento em `meta` e, embaixo, a pergunta de uma
 * vez só: pendente tem "Aceitar" e "Não posso ir" lado a lado (D62; antes
 * eram três botões e ninguém sabia a diferença entre recusar e pedir
 * substituição). "Pedir substituição" só aparece depois de aceitar. Com
 * substituição pedida, a ação é cancelar o pedido.
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
  const chip = CHIP_DO_ESTADO_DA_ATRIBUICAO[escala.estado]
  // Depois de responder, o botão tocado some: o foco vai para o resumo, que já diz a situação nova.
  const resumo = useRef<NoDeView>(null)
  const depoisDeResponder = { onSuccess: () => focar(resumo) }
  const erro = responder.error ?? cancelarPedido.error

  async function recusar() {
    const ok = await confirmarQueNaoPodeIr()
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

  // Pendente: só "Aceitar" e "Não posso ir" (D62). "Pedir substituição" só existe depois de aceitar.
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
  ) : escala.estado === 'pendente' ? (
    <ParDeBotoes>
      <Botao
        titulo="Aceitar"
        variante={primario ? 'primario' : 'secundario'}
        rotuloAcessivel={`Aceitar a convocação em ${escala.eventoTitulo}, ${onde}`}
        carregando={responder.isPending && responder.variables?.resposta === 'confirmar'}
        aoPressionar={() =>
          responder.mutate({ atribuicaoId: escala.id, resposta: 'confirmar' }, depoisDeResponder)
        }
      />
      <Botao
        titulo="Não posso ir"
        variante="secundario"
        rotuloAcessivel={`Não posso ir: avisar a organização sobre ${escala.eventoTitulo}, ${onde}`}
        carregando={responder.isPending && responder.variables?.resposta === 'recusar'}
        aoPressionar={() => void recusar()}
      />
    </ParDeBotoes>
  ) : null

  return (
    <CartaoDeVidro
      sobrancelha={quandoDaEscala(escala.eventoInicio, fuso)}
      extra={<Chip texto={chip.texto} tom={chip.tom} />}
      comecaComTitulo
      {...(botoes ? { acoes: botoes } : {})}
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
