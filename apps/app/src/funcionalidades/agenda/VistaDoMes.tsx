import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, useWindowDimensions, View } from 'react-native'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { formatarDataPorExtenso, gradeDoMes, type DataLocal } from '@/utilidades/datas'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { contarEventos } from './calendario'
import { CALENDARIO } from './medidas'

interface Props {
  referencia: DataLocal
  hoje: DataLocal
  selecionado: DataLocal
  porDia: Map<DataLocal, ResumoDoEvento[]>
  aoEscolher: (dia: DataLocal) => void
}

/** A partir desta escala de fonte, sete colunas não cabem: o mês vira lista (2.13, revisão M4). */
export const ESCALA_DA_LISTA = 1.35

/** Cabeçalho visual dos dias (quadro 06). Cada dia já diz o dia da semana no rótulo. */
const INICIAIS_DOS_DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

/**
 * Mês (3.3.1 e quadro 06): cartão de vidro com a grade de 7 colunas iguais
 * e células de 48. Cada dia é um botão com o rótulo completo ("sábado, 15
 * de novembro de 2026, hoje, 2 eventos"): a quantidade vai em texto, os
 * pontos só reforçam. Com fonte grande, a grade vira a lista dos dias com
 * evento (e de hoje), sem cortar nada.
 */
export function VistaDoMes(props: Props) {
  const { fontScale } = useWindowDimensions()
  return fontScale >= ESCALA_DA_LISTA ? <MesEmLista {...props} /> : <MesEmGrade {...props} />
}

export function rotuloDoDia(dia: DataLocal, hoje: DataLocal, n: number) {
  return [formatarDataPorExtenso(dia), dia === hoje ? 'hoje' : null, contarEventos(n)]
    .filter(Boolean)
    .join(', ')
}

function MesEmLista({ referencia, hoje, selecionado, porDia, aoEscolher }: Props) {
  const mes = referencia.slice(0, 7)
  const dias = gradeDoMes(referencia).filter(
    (d) => d.startsWith(mes) && ((porDia.get(d)?.length ?? 0) > 0 || d === hoje),
  )
  if (dias.length === 0) {
    return (
      <CartaoDeVidro>
        <Texto variante="corpo" cor="textoSuave">
          Nenhum encontro neste mês.
        </Texto>
      </CartaoDeVidro>
    )
  }
  return (
    <CartaoDeVidro lista>
      <Lista>
        {dias.map((dia) => {
          const n = porDia.get(dia)?.length ?? 0
          return (
            <LinhaDeLista
              key={dia}
              icone="calendario"
              titulo={`${formatarDataPorExtenso(dia, false)}${dia === hoje ? ' (hoje)' : ''}`}
              descricao={contarEventos(n)}
              selecionado={dia === selecionado}
              semSeta
              rotuloAcessivel={rotuloDoDia(dia, hoje, n)}
              aoPressionar={() => aoEscolher(dia)}
            />
          )
        })}
      </Lista>
    </CartaoDeVidro>
  )
}

function MesEmGrade({ referencia, hoje, selecionado, porDia, aoEscolher }: Props) {
  const grade = gradeDoMes(referencia)
  const mes = referencia.slice(0, 7)
  const semanas = Array.from({ length: 6 }, (_, i) => grade.slice(i * 7, i * 7 + 7))

  return (
    <CartaoDeVidro>
      <View>
        <View
          style={{ flexDirection: 'row', marginBottom: ESPACO.e8 }}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {INICIAIS_DOS_DIAS.map((d, i) => (
            <Texto
              key={i}
              variante="sobrancelha"
              cor="textoSuave"
              accessibilityRole="text"
              centralizado
              style={{ flex: 1 }}
            >
              {d}
            </Texto>
          ))}
        </View>
        {semanas.map((semana) => (
          <View key={semana[0]} style={{ flexDirection: 'row' }}>
            {semana.map((dia) => (
              <CelulaDoDia
                key={dia}
                dia={dia}
                numero={Number(dia.slice(8, 10))}
                eventos={porDia.get(dia)?.length ?? 0}
                hoje={hoje}
                escolhido={dia === selecionado}
                doMes={dia.startsWith(mes)}
                altura={CALENDARIO.celula}
                aoEscolher={aoEscolher}
              />
            ))}
          </View>
        ))}
      </View>
    </CartaoDeVidro>
  )
}

interface PropsDaCelula {
  dia: DataLocal
  numero: number
  eventos: number
  hoje: DataLocal
  escolhido: boolean
  /** Dias de outro mês ficam em texto suave. */
  doMes: boolean
  altura: number
  aoEscolher: (dia: DataLocal) => void
  /** Semana: o dia da semana em sobrancelha acima do número. */
  diaDaSemana?: string
}

/**
 * Um dia do calendário (mês e semana). Hoje: círculo de 32 em `primaria`
 * com o número em `sobrePrimaria` 600. Escolhido: anel de 2 em `texto` em
 * volta de um círculo de 36 (forma, não só cor). Até 3 pontos de 4 em
 * `destaque` abaixo do número.
 */
export function CelulaDoDia({
  dia,
  numero,
  eventos,
  hoje,
  escolhido,
  doMes,
  altura,
  aoEscolher,
  diaDaSemana,
}: PropsDaCelula) {
  const { cores } = useTema()
  const ehHoje = dia === hoje
  const lado = escolhido ? CALENDARIO.circuloEscolhido : CALENDARIO.circulo
  const pontos = Math.min(eventos, CALENDARIO.maximoDePontos)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloDoDia(dia, hoje, eventos)}
      aria-selected={escolhido}
      onPress={() => aoEscolher(dia)}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: altura,
        alignItems: 'center',
        justifyContent: 'center',
        gap: CALENDARIO.abaixoDoNumero,
        borderRadius: RAIO.celula,
        backgroundColor: pressed ? cores.pressionado : 'transparent',
      })}
    >
      {diaDaSemana ? (
        <Texto variante="sobrancelha" cor="textoSuave" accessibilityRole="text">
          {diaDaSemana}
        </Texto>
      ) : null}
      <View
        style={{
          width: lado,
          height: lado,
          borderRadius: RAIO.pilula,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ehHoje ? cores.primaria : 'transparent',
          borderWidth: escolhido ? CALENDARIO.anel : 0,
          borderColor: cores.texto,
        }}
      >
        <Texto
          variante={diaDaSemana ? 'tituloItem' : 'corpo'}
          peso={ehHoje || diaDaSemana ? 'forte' : 'medio'}
          cor={ehHoje ? 'sobrePrimaria' : doMes ? 'texto' : 'textoSuave'}
          centralizado
          tabular
          maxFontSizeMultiplier={ESCALA_DA_LISTA}
        >
          {numero}
        </Texto>
      </View>
      <View style={{ flexDirection: 'row', gap: CALENDARIO.entrePontos, height: CALENDARIO.ponto }}>
        {Array.from({ length: pontos }, (_, i) => (
          <View
            key={i}
            style={{
              width: CALENDARIO.ponto,
              height: CALENDARIO.ponto,
              borderRadius: RAIO.pilula,
              backgroundColor: cores.destaque,
            }}
          />
        ))}
      </View>
    </Pressable>
  )
}
