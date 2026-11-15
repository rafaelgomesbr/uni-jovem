import { ALTURA, BORDA, ESPACO, RAIO } from '@uj/tokens'
import { Children, type ReactNode } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

export interface Barra {
  rotulo: string
  valor: number
  /** Texto do valor (ex.: "12 presentes"); padrão: o número. */
  texto?: string
}

/**
 * Gráfico de barras (3.7.5) num cartão de vidro com a sobrancelha: cada barra
 * tem o rótulo em `legenda` acima, o trilho de 8 (raio 999, tonal) com o
 * preenchimento primário e o valor à direita em `botao` com algarismos
 * tabulares. O valor está sempre escrito e no rótulo do leitor de tela: a
 * barra só reforça, nunca é o único sinal (nem a cor).
 */
export function GraficoDeBarras({ titulo, barras }: { titulo: string; barras: readonly Barra[] }) {
  const { cores, solido } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const maximo = Math.max(1, ...barras.map((b) => b.valor))
  return (
    <CartaoDeVidro sobrancelha={titulo}>
      <View accessibilityRole="summary" accessibilityLabel={titulo} style={{ gap: ESPACO.e12 }}>
        {barras.length === 0 ? (
          <Texto variante="corpo" cor="textoSuave">
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
                style={{ gap: ESPACO.e4 }}
              >
                <Texto variante="legenda" cor="textoSuave">
                  {b.rotulo}
                </Texto>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
                  <View
                    style={{
                      flex: 1,
                      height: ESPACO.e8,
                      borderRadius: RAIO.pilula,
                      backgroundColor: solido(cores.tonal),
                      // Com "Aumentar contraste", o trilho ganha contorno para a barra vazia aparecer.
                      borderWidth: aumentarContraste ? BORDA.fina : 0,
                      borderColor: aumentarContraste ? cores.texto : 'transparent',
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${(Math.max(0, b.valor) / maximo) * 100}%`,
                        height: '100%',
                        borderRadius: RAIO.pilula,
                        backgroundColor: cores.primaria,
                      }}
                    />
                  </View>
                  {/* Coluna do valor com 48 de largura mínima (cresce com a fonte). */}
                  <Texto
                    variante="botao"
                    tabular
                    style={{ minWidth: ALTURA.controle, textAlign: 'right' }}
                  >
                    {texto}
                  </Texto>
                </View>
              </View>
            )
          })
        )}
      </View>
    </CartaoDeVidro>
  )
}

/**
 * Número de relatório (3.7.5): cartão de vidro compacto com o valor em
 * `numero` (Bricolage 800 28/32, `tabular-nums`) e o rótulo escrito em
 * `legenda`, sem depender de cor.
 */
export function Numero({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <CartaoDeVidro style={{ flex: 1, padding: ESPACO.e16 }}>
      <View accessible accessibilityLabel={`${rotulo}: ${valor}`} style={{ gap: ESPACO.e4 }}>
        <Texto variante="numero" tabular accessibilityRole="text" testID="numero-do-relatorio">
          {String(valor)}
        </Texto>
        <Texto variante="legenda" cor="textoSuave">
          {rotulo}
        </Texto>
      </View>
    </CartaoDeVidro>
  )
}

/**
 * Grade de 2 colunas com intervalo de 12. Com fonte grande (`fontScale` de
 * 1,35 ou mais), uma coluna só, para o número não cortar.
 */
export function GradeDeNumeros({ children }: { children: ReactNode }) {
  const { fontScale } = useWindowDimensions()
  const itens = Children.toArray(children).filter(Boolean)
  const porLinha = fontScale >= 1.35 ? 1 : 2
  const linhas: ReactNode[][] = []
  for (let i = 0; i < itens.length; i += porLinha) linhas.push(itens.slice(i, i + porLinha))
  return (
    <View style={{ gap: ESPACO.e12 }}>
      {linhas.map((linha, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: ESPACO.e12 }}>
          {linha}
          {/* Linha incompleta: a célula vazia guarda a largura da coluna. */}
          {linha.length < porLinha ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  )
}
