import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, useWindowDimensions, View } from 'react-native'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { DIAS_CURTOS, formatarDataPorExtenso, gradeDoMes, type DataLocal } from '@/utilidades/datas'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Linha, Lista } from '@/ui/Linha'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { contarEventos } from './calendario'

interface Props {
  referencia: DataLocal
  hoje: DataLocal
  selecionado: DataLocal
  porDia: Map<DataLocal, ResumoDoEvento[]>
  aoEscolher: (dia: DataLocal) => void
}

/** Acima desta escala de fonte, sete colunas não cabem: o mês vira lista. */
const ESCALA_DA_LISTA = 1.5

/**
 * Grade do mês (domingo a sábado). Cada dia é um botão com rótulo completo
 * ("sábado, 15 de novembro de 2026, hoje, 2 eventos"); a quantidade aparece
 * em número, não só como marca colorida. Com fonte muito grande, a grade
 * vira uma lista dos dias com evento (e de hoje), sem cortar nada.
 */
export function VistaDoMes(props: Props) {
  const { fontScale } = useWindowDimensions()
  return fontScale > ESCALA_DA_LISTA ? <MesEmLista {...props} /> : <MesEmGrade {...props} />
}

function rotuloDoDia(dia: DataLocal, hoje: DataLocal, n: number) {
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
      <Texto variante="legenda" cor="textoSuave">
        Nenhum evento neste mês.
      </Texto>
    )
  }
  return (
    <Lista recuo={0}>
      {dias.map((dia) => {
        const n = porDia.get(dia)?.length ?? 0
        return (
          <Linha
            key={dia}
            titulo={`${formatarDataPorExtenso(dia)}${dia === hoje ? ' (hoje)' : ''}`}
            descricao={contarEventos(n)}
            selecionado={dia === selecionado}
            semSeta
            rotuloAcessivel={rotuloDoDia(dia, hoje, n)}
            aoPressionar={() => aoEscolher(dia)}
          />
        )
      })}
    </Lista>
  )
}

function MesEmGrade({ referencia, hoje, selecionado, porDia, aoEscolher }: Props) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const grade = gradeDoMes(referencia)
  const mes = referencia.slice(0, 7)
  const semanas = Array.from({ length: 6 }, (_, i) => grade.slice(i * 7, i * 7 + 7))

  return (
    <View style={{ gap: ESPACO.e4 }}>
      {/* Cada dia já diz o dia da semana no rótulo: o cabeçalho é só visual. */}
      <View
        style={{ flexDirection: 'row', paddingBottom: ESPACO.e4 }}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {DIAS_CURTOS.map((d) => (
          <Texto key={d} variante="rotulo" cor="textoSuave" centralizado style={{ flex: 1 }}>
            {d}
          </Texto>
        ))}
      </View>
      {semanas.map((semana) => (
        <View key={semana[0]} style={{ flexDirection: 'row', gap: 2 }}>
          {semana.map((dia) => {
            const n = porDia.get(dia)?.length ?? 0
            const ehHoje = dia === hoje
            const escolhido = dia === selecionado
            const doMes = dia.startsWith(mes)
            return (
              <Pressable
                key={dia}
                accessibilityRole="button"
                accessibilityLabel={rotuloDoDia(dia, hoje, n)}
                aria-selected={escolhido}
                onPress={() => aoEscolher(dia)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: ALVO + ESPACO.e12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  borderRadius: RAIO.celula,
                  // Escolhido: contorno em destaque e fundo de realce (forma, não só cor).
                  borderWidth: escolhido ? 2 : aumentarContraste ? 1 : 0,
                  borderColor: escolhido ? cores.destaque : cores.campoBorda,
                  backgroundColor: escolhido || pressed ? cores.pressionado : 'transparent',
                })}
              >
                <View
                  style={{
                    minWidth: 30,
                    minHeight: 30,
                    paddingHorizontal: 4,
                    borderRadius: RAIO.pilula,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: ehHoje ? cores.primaria : 'transparent',
                  }}
                >
                  <Texto
                    variante={escolhido || ehHoje ? 'tituloItem' : 'corpo'}
                    cor={ehHoje ? 'sobrePrimaria' : doMes ? 'texto' : 'textoSuave'}
                    centralizado
                    tabular
                  >
                    {Number(dia.slice(8, 10))}
                  </Texto>
                </View>
                {n > 0 ? (
                  <Texto variante="rotulo" cor="destaque" tabular>
                    {n === 1 ? '•' : `•${n}`}
                  </Texto>
                ) : (
                  <Texto variante="rotulo"> </Texto>
                )}
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
