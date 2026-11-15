import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { DIAS_CURTOS, formatarDataPorExtenso, gradeDoMes, type DataLocal } from '@/utilidades/datas'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
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

/**
 * Grade do mês (domingo a sábado). Cada dia é um botão com rótulo completo
 * ("sábado, 15 de novembro de 2026, hoje, 2 eventos"); a quantidade aparece
 * em número, não só como marca colorida.
 */
export function VistaDoMes({ referencia, hoje, selecionado, porDia, aoEscolher }: Props) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const grade = gradeDoMes(referencia)
  const mes = referencia.slice(0, 7)
  const semanas = Array.from({ length: 6 }, (_, i) => grade.slice(i * 7, i * 7 + 7))

  return (
    <View style={{ gap: ESPACO.x1 }}>
      <View
        style={{ flexDirection: 'row' }}
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
            const rotulo = [formatarDataPorExtenso(dia), ehHoje ? 'hoje' : null, contarEventos(n)]
              .filter(Boolean)
              .join(', ')
            return (
              <Pressable
                key={dia}
                accessibilityRole="button"
                accessibilityLabel={rotulo}
                accessibilityState={{ selected: escolhido }}
                onPress={() => aoEscolher(dia)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: ALVO + ESPACO.x3,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  borderRadius: RAIO.pequeno,
                  borderWidth: escolhido ? 2 : aumentarContraste ? 1 : 0,
                  borderColor: escolhido ? cores.destaque : cores.borda,
                  backgroundColor: escolhido ? cores.superficieElevada : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    minWidth: 28,
                    paddingHorizontal: 4,
                    borderRadius: RAIO.pilula,
                    backgroundColor: ehHoje ? cores.secundaria : 'transparent',
                  }}
                >
                  <Texto
                    variante={escolhido || ehHoje ? 'corpoForte' : 'corpo'}
                    cor={ehHoje ? 'sobreSecundaria' : doMes ? 'texto' : 'textoSuave'}
                    centralizado
                  >
                    {Number(dia.slice(8, 10))}
                  </Texto>
                </View>
                {n > 0 ? (
                  <Texto variante="rotulo" cor="destaque">
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
