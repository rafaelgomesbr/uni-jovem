import { ESPACO, RAIO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

export interface Barra {
  rotulo: string
  valor: number
  /** Texto do valor (ex.: "12 presentes"); padrão: o número. */
  texto?: string
}

/**
 * Gráfico de barras horizontal e estático. O valor está sempre escrito ao
 * lado da barra e no rótulo do leitor de tela: a barra só reforça, nunca é o
 * único sinal (nem a cor).
 */
export function GraficoDeBarras({ titulo, barras }: { titulo: string; barras: readonly Barra[] }) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const maximo = Math.max(1, ...barras.map((b) => b.valor))
  return (
    <View accessibilityRole="summary" accessibilityLabel={titulo} style={{ gap: ESPACO.x3 }}>
      <Texto variante="corpoForte">{titulo}</Texto>
      {barras.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Nada para mostrar neste período.
        </Texto>
      ) : (
        barras.map((b, i) => {
          const texto = b.texto ?? String(b.valor)
          return (
            <View
              key={`${b.rotulo}-${i}`}
              accessible
              accessibilityLabel={`${b.rotulo}: ${texto}`}
              style={{ gap: ESPACO.x1 }}
            >
              <Texto variante="apoio">{b.rotulo}</Texto>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x2 }}>
                <View
                  style={{
                    flex: 1,
                    height: 14,
                    borderRadius: RAIO.pilula,
                    borderWidth: 1,
                    borderColor: aumentarContraste ? cores.texto : cores.borda,
                    backgroundColor: cores.superficieElevada,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${(Math.max(0, b.valor) / maximo) * 100}%`,
                      height: '100%',
                      backgroundColor: cores.destaque,
                    }}
                  />
                </View>
                <Texto variante="corpoForte" style={{ minWidth: 48, textAlign: 'right' }}>
                  {texto}
                </Texto>
              </View>
            </View>
          )
        })
      )}
    </View>
  )
}

/** Número grande com o rótulo escrito (sem depender de cor). */
export function Numero({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  const { cores } = useTema()
  return (
    <View
      accessible
      accessibilityLabel={`${rotulo}: ${valor}`}
      style={{
        flexGrow: 1,
        flexBasis: 140,
        padding: ESPACO.x3,
        gap: ESPACO.x1,
        borderRadius: RAIO.medio,
        borderWidth: 1,
        borderColor: cores.borda,
        backgroundColor: cores.superficieElevada,
      }}
    >
      <Texto variante="titulo" accessibilityRole="text">
        {String(valor)}
      </Texto>
      <Texto variante="apoio" cor="textoSuave">
        {rotulo}
      </Texto>
    </View>
  )
}

export function GradeDeNumeros({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>{children}</View>
}
