import { ALTURA, BORDA, CORES_DA_COMUNIDADE, corSobre, ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { Icone } from '@/ui/Icone'
import { useSetasDoGrupo } from '@/ui/setasDoGrupo'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

export type CorDaComunidade = (typeof CORES_DA_COMUNIDADE)[number]['valor']

export const COR_PADRAO: CorDaComunidade = CORES_DA_COMUNIDADE[0].valor

export function ehCorDaLista(cor: string): cor is CorDaComunidade {
  return CORES_DA_COMUNIDADE.some((c) => c.valor === cor)
}

/**
 * "COR" (3.6.3): a grade das 6 amostras de 44 (raio 999), com o nome da cor
 * abaixo de cada uma. A escolhida tem anel de 2 na cor do texto, afastado 2,
 * e um check sobre a amostra: forma além da cor. Papel `radio`.
 */
export function SeletorDeCor({
  valor,
  aoMudar,
}: {
  valor: CorDaComunidade
  aoMudar: (cor: CorDaComunidade) => void
}) {
  const { cores } = useTema()
  const propsDaOpcao = useSetasDoGrupo(CORES_DA_COMUNIDADE, valor, aoMudar)
  return (
    <View
      accessibilityRole="radiogroup"
      aria-label="Cor da comunidade"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}
    >
      {CORES_DA_COMUNIDADE.map((c) => {
        const marcada = c.valor === valor
        return (
          <Pressable
            key={c.valor}
            {...propsDaOpcao(c.valor)}
            accessibilityRole="radio"
            accessibilityLabel={c.rotulo}
            aria-checked={marcada}
            onPress={() => aoMudar(c.valor)}
            style={{ flex: 1, minWidth: ALTURA.iconeSo, alignItems: 'center', gap: ESPACO.e8 }}
          >
            {({ pressed }) => (
              <>
                <View
                  style={{
                    width: ALTURA.iconeSo,
                    height: ALTURA.iconeSo,
                    borderRadius: RAIO.pilula,
                    backgroundColor: c.valor,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(marcada || pressed
                      ? {
                          outlineWidth: BORDA.contraste,
                          outlineStyle: 'solid' as const,
                          outlineOffset: BORDA.contraste,
                          outlineColor: marcada ? cores.texto : cores.tonalBorda,
                        }
                      : {}),
                  }}
                >
                  {marcada ? (
                    <Icone nome="check" cor={corSobre(c.valor)} tamanho={18} peso="forte" />
                  ) : null}
                </View>
                <Texto
                  variante="legenda"
                  cor={marcada ? 'texto' : 'textoSuave'}
                  peso={marcada ? 'forte' : 'regular'}
                  // Duas linhas: com fonte grande o nome da cor não pode ser cortado ("Azul-céu...").
                  numberOfLines={2}
                  style={{ textAlign: 'center' }}
                >
                  {c.rotulo}
                </Texto>
              </>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}
