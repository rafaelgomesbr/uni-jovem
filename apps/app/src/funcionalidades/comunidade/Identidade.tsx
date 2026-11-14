import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

const HEX = /^#[0-9A-Fa-f]{6}$/

/** Marca da comunidade: círculo na cor dela com ícone. Decorativa: o nome vem ao lado. */
export function MarcaDaComunidade({ cor, tamanho = 36 }: { cor: string; tamanho?: number }) {
  const { cores } = useTema()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: HEX.test(cor) ? cor : cores.secundaria,
        borderWidth: 1,
        borderColor: cores.borda,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icone nome="comunidade" cor="#FFFFFF" tamanho={tamanho * 0.55} />
    </View>
  )
}

interface PropsDaIdentidade {
  nome: string
  cor: string
  detalhe?: string
}

/** Nome + marca + detalhe (ex.: papel). Lido como um item só pelo leitor de tela. */
export function IdentidadeDaComunidade({ nome, cor, detalhe }: PropsDaIdentidade) {
  return (
    <View
      accessible
      accessibilityLabel={detalhe ? `Comunidade ${nome}. ${detalhe}` : `Comunidade ${nome}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x3, flexShrink: 1 }}
    >
      <MarcaDaComunidade cor={cor} />
      <View style={{ flexShrink: 1 }}>
        <Texto variante="corpoForte" numberOfLines={2}>
          {nome}
        </Texto>
        {detalhe ? (
          <Texto variante="apoio" cor="textoSuave">
            {detalhe}
          </Texto>
        ) : null}
      </View>
    </View>
  )
}
