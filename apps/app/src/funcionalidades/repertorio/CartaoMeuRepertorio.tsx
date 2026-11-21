import { ehConvocacaoDeLouvor } from '@uj/dominio'
import { router } from 'expo-router'

import type { EscalaDoInicio } from '@/servicos/contratoDosEventos'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'
import { dataDoInstante, falarQuando, formatarHora } from '@/utilidades/datas'

/**
 * A convocação que o Início já traz é de louvor? (Sim se a etapa é a do Louvor
 * ou a função é de banda; a convocação recusada não conta.) Não precisa de
 * outra chamada à API: o cartão só aparece para quem toca.
 */
export function escalaDeLouvorNoInicio(escalas: readonly EscalaDoInicio[]): EscalaDoInicio | null {
  return (
    escalas.find(
      (e) =>
        e.estado !== 'recusada' &&
        ehConvocacaoDeLouvor({ funcao: e.funcao, etapaTitulo: e.etapaTitulo }),
    ) ?? null
  )
}

function quando(iso: string, fuso: string): string {
  const [, mes, dia] = dataDoInstante(iso, fuso).split('-')
  return `${dia}/${mes} · ${formatarHora(iso, fuso)}`
}

/**
 * "Meu repertório" no Início (D61): só para quem foi convocado ao louvor. Leva
 * para as músicas do próximo encontro, no tom do dia.
 */
export function CartaoMeuRepertorio({ escala, fuso }: { escala: EscalaDoInicio; fuso: string }) {
  return (
    <CartaoDeVidro
      sobrancelha="Meu repertório"
      comecaComTitulo
      acoes={
        <Botao
          titulo="Abrir o repertório"
          variante="secundario"
          icone="musica"
          rotuloAcessivel={`Abrir o meu repertório de ${escala.eventoTitulo}`}
          aoPressionar={() => router.push('/meu-repertorio')}
        />
      }
    >
      <Texto
        variante="tituloItem"
        accessibilityLabel={`${escala.funcao} em ${escala.eventoTitulo}, ${falarQuando(escala.eventoInicio, fuso)}`}
      >
        {`${escala.funcao} · ${escala.eventoTitulo}`}
      </Texto>
      <Texto variante="meta" cor="textoSuave">
        {`${quando(escala.eventoInicio, fuso)} · músicas, tom do dia e cifra`}
      </Texto>
    </CartaoDeVidro>
  )
}
