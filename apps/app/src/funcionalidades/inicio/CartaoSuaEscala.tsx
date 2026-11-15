import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useRef } from 'react'
import { View } from 'react-native'

import type { EscalaDoInicio } from '@/servicos/contratoDosEventos'
import { dataDoInstante, falarQuando, formatarHora } from '@/utilidades/datas'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip, type TomDoChip } from '@/ui/Chip'
import { focar, type NoDeView } from '@/ui/foco'
import { Texto } from '@/ui/Texto'
import { soNaWeb } from '@/ui/web'

import { NOME_DO_ESTADO_DA_ATRIBUICAO } from '../eventos/nomes'
import { useResponderEscala } from '../escalas/consultas'

/** Chip de cada estado da escala (mapa da 2.12.12). "Pendente" não ganha chip: os botões dizem. */
const CHIP: Partial<Record<EscalaDoInicio['estado'], { texto: string; tom: TomDoChip }>> = {
  confirmada: { texto: 'Confirmada', tom: 'sucesso' },
  recusada: { texto: 'Recusada', tom: 'erro' },
  substituicao_pedida: { texto: 'Substituição', tom: 'info' },
}

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
 * "SUA ESCALA" (mockup): sobrancelha, 4, a função em `tituloItem`, a data em
 * legenda e os botões médios "Confirmar" e "Pedir substituição" lado a lado.
 * Já confirmada: o chip à direita da sobrancelha e só "Pedir substituição".
 */
export function CartaoSuaEscala({ escala, total, comunidadeId, fuso }: Props) {
  const responder = useResponderEscala(comunidadeId)
  const resumo = useRef<NoDeView>(null)
  const onde = escala.etapaTitulo ? `${escala.etapaTitulo} · ${escala.funcao}` : escala.funcao
  const chip = CHIP[escala.estado]
  const podeResponder = escala.estado === 'pendente' || escala.estado === 'confirmada'
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
  const verTodas =
    total > 1 ? (
      <Botao
        titulo={`Ver todas (${total})`}
        variante="terciario"
        alinhado
        rotuloAcessivel={`Ver todas as escalas (${total})`}
        aoPressionar={() => router.push('/escalas')}
      />
    ) : null

  return (
    <CartaoDeVidro
      sobrancelha="Sua escala"
      comecaComTitulo
      {...(chip ? { extra: <Chip texto={chip.texto} tom={chip.tom} /> } : {})}
      acoes={
        <View style={{ gap: ESPACO.e4 }}>
          {escala.estado === 'pendente' ? (
            <ParDeBotoes>
              <Botao
                titulo="Confirmar"
                rotuloAcessivel={`Confirmar a escala em ${escala.eventoTitulo}, ${onde}`}
                carregando={responder.isPending}
                aoPressionar={() =>
                  responder.mutate(
                    { atribuicaoId: escala.id, resposta: 'confirmar' },
                    { onSuccess: () => focar(resumo) },
                  )
                }
              />
              {pedirSubstituicao}
            </ParDeBotoes>
          ) : podeResponder ? (
            pedirSubstituicao
          ) : (
            <Botao
              titulo="Ver minhas escalas"
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
        <Texto variante="legenda" cor="textoSuave">
          {escala.eventoTitulo} · {quandoCurto(escala.eventoInicio, fuso)}
        </Texto>
      </View>
      {responder.error ? <AvisoDeErro erro={responder.error} /> : null}
    </CartaoDeVidro>
  )
}
