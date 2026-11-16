import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { Pressable, useWindowDimensions, View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Avatar, type FotoDoAvatar } from './Avatar'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

export interface PropsDaPilula {
  nome: string
  /** Sem comunidade: avatar tracejado com o ícone de pessoas. */
  vazia: boolean
  /** Mais de uma comunidade: chevron para baixo. */
  podeTrocar: boolean
  rotulo: string
  aoPressionar: (() => void) | null
  /** Versão do cabeçalho compacto: avatar de 24, altura de 36. */
  compacta?: boolean
  /** Logotipo da comunidade (D33): toma o lugar das iniciais no avatar de 32. */
  logo?: FotoDoAvatar | null
}

/**
 * Pílula da comunidade (seção 2.12.14, M): altura mínima de 44, padding 6,
 * 14, 6 e 6, intervalo de 10, raio 999, fundo tonal e borda de 1; avatar de
 * 32 com as iniciais em coral (como o "JC" do mockup) ou o logotipo da
 * comunidade, quando há (D33), e o nome em 15/20 600.
 * Com fonte grande, o nome vai a 2 linhas e o raio vira 22.
 */
export function PilulaDaComunidade({
  nome,
  vazia,
  podeTrocar,
  rotulo,
  aoPressionar,
  compacta = false,
  logo = null,
}: PropsDaPilula) {
  const { cores, solido } = useTema()
  const { reduzirTransparencia, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const { fontScale } = useWindowDimensions()
  const grande = fontScale >= 1.35 && !compacta
  const lado = compacta ? 24 : 32

  const caixa = (pressionado: boolean) => (
    <View
      style={{
        minHeight: compacta ? 36 : ALTURA.pilula,
        flexDirection: 'row',
        alignItems: 'center',
        gap: compacta ? ESPACO.e8 : ESPACO.e10,
        paddingVertical: ESPACO.e6,
        paddingLeft: ESPACO.e6,
        paddingRight: ESPACO.e14,
        borderRadius: grande ? RAIO.cartao : RAIO.pilula,
        borderWidth: aumentarContraste ? 2 : 1,
        borderColor: aumentarContraste ? cores.texto : cores.tonalBorda,
        backgroundColor: pressionado
          ? solido(cores.tonalBorda)
          : reduzirTransparencia
            ? cores.tonalOpaco
            : cores.tonal,
        alignSelf: 'flex-start',
        maxWidth: '100%',
      }}
    >
      {vazia ? (
        <View
          style={{
            width: lado,
            height: lado,
            borderRadius: lado / 2,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: cores.textoSuave,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icone nome="abaComunidade" cor={cores.textoSuave} tamanho={14} />
        </View>
      ) : (
        <Avatar nome={nome} proprio lado={lado} foto={logo} decorativo />
      )}
      <Texto
        variante="botao"
        numberOfLines={grande ? 2 : 1}
        style={{ flexShrink: 1 }}
        {...(compacta ? { maxFontSizeMultiplier: 1.3 } : {})}
      >
        {nome}
      </Texto>
      {podeTrocar ? <Icone nome="abrirLista" cor={cores.texto} tamanho={16} /> : null}
    </View>
  )

  if (!aoPressionar) {
    return (
      <View accessible accessibilityLabel={rotulo} style={{ flexShrink: 1, minWidth: 0 }}>
        {caixa(false)}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoPressionar}
      style={{ flexShrink: 1, minWidth: 0 }}
    >
      {({ pressed }) => caixa(pressed)}
    </Pressable>
  )
}
