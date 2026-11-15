import { CORES_DA_COMUNIDADE, corSobre, ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { useSetasDoGrupo } from '@/ui/setasDoGrupo'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

export type CorDaComunidade = (typeof CORES_DA_COMUNIDADE)[number]['valor']

export const COR_PADRAO: CorDaComunidade = CORES_DA_COMUNIDADE[0].valor

export function ehCorDaLista(cor: string): cor is CorDaComunidade {
  return CORES_DA_COMUNIDADE.some((c) => c.valor === cor)
}

/**
 * Identidade da comunidade: pílulas com a amostra da cor e o nome dela
 * (papel `radio`). A escolhida tem contorno grosso e marca, nunca só a cor.
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
    <View accessibilityRole="radiogroup" aria-label="Cor da comunidade" style={{ gap: ESPACO.x2 }}>
      <Texto variante="corpoForte">Cor da comunidade</Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
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
              style={({ pressed }) => ({
                minHeight: ALVO,
                flexDirection: 'row',
                alignItems: 'center',
                gap: ESPACO.x2,
                paddingLeft: ESPACO.x2,
                paddingRight: ESPACO.x4,
                borderRadius: RAIO.pilula,
                borderWidth: marcada ? 2 : 1,
                borderColor: marcada ? cores.destaque : cores.borda,
                backgroundColor: marcada || pressed ? cores.superficieRealce : cores.superficie,
              })}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: c.valor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {marcada ? <Icone nome="confirmado" cor={corSobre(c.valor)} tamanho={18} /> : null}
              </View>
              <Texto variante="corpoForte">{c.rotulo}</Texto>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
