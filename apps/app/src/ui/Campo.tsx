import { ESPACO, RAIO, TIPO } from '@uj/tokens'
import { useId, useState } from 'react'
import { Pressable, TextInput, View, type TextInputProps } from 'react-native'

import { FAMILIA } from './fontes'
import { Icone } from './Icone'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import { useTema } from './tema'

export interface PropsDoCampo extends Omit<
  TextInputProps,
  'style' | 'secureTextEntry' | 'accessibilityLabel' | 'placeholder'
> {
  /** Sempre visível acima do campo: placeholder não substitui rótulo. */
  rotulo: string
  erro?: string | null
  /** Orientação curta que fica abaixo do campo (ex.: formato do WhatsApp). */
  ajuda?: string
  /** Campo de senha, com botão "Mostrar senha". */
  senha?: boolean
  exemplo?: string
}

export function Campo({
  rotulo,
  erro,
  ajuda,
  senha = false,
  exemplo,
  onFocus,
  onBlur,
  ...resto
}: PropsDoCampo) {
  const { cores } = useTema()
  const id = useId()
  const [focado, setFocado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const idDoRotulo = `rotulo-${id}`
  const descricao = [erro ? `Erro: ${erro}` : null, ajuda].filter(Boolean).join('. ')

  return (
    <View style={{ gap: ESPACO.x1, alignSelf: 'stretch' }}>
      <Texto variante="corpoForte" nativeID={idDoRotulo}>
        {rotulo}
      </Texto>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: ALVO,
          borderRadius: RAIO.medio,
          borderWidth: erro || focado ? 2 : 1.5,
          borderColor: erro ? cores.erro : focado ? cores.foco : cores.borda,
          backgroundColor: cores.superficie,
        }}
      >
        <TextInput
          accessibilityLabel={rotulo}
          accessibilityLabelledBy={idDoRotulo}
          accessibilityHint={descricao || undefined}
          placeholder={exemplo}
          placeholderTextColor={cores.textoSuave}
          secureTextEntry={senha && !visivel}
          {...resto}
          onFocus={(e) => {
            setFocado(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocado(false)
            onBlur?.(e)
          }}
          style={{
            flex: 1,
            minHeight: ALVO,
            paddingHorizontal: ESPACO.x3,
            paddingVertical: ESPACO.x2,
            color: cores.texto,
            fontFamily: FAMILIA.texto,
            // 16 evita o zoom automático do Safari ao focar o campo.
            fontSize: TIPO.corpo.tamanho,
          }}
        />
        {senha ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
            onPress={() => setVisivel((v) => !v)}
            style={{
              minHeight: ALVO,
              minWidth: ALVO,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icone nome={visivel ? 'ocultar' : 'mostrar'} cor={cores.textoSuave} />
          </Pressable>
        ) : null}
      </View>
      {ajuda ? (
        <Texto variante="apoio" cor="textoSuave" importantForAccessibility="no">
          {ajuda}
        </Texto>
      ) : null}
      {erro ? (
        <View
          style={{ flexDirection: 'row', gap: ESPACO.x1, alignItems: 'flex-start' }}
          accessibilityLiveRegion="polite"
        >
          <Icone nome="erro" cor={cores.erro} tamanho={18} />
          <Texto variante="apoio" cor="erro" style={{ flex: 1 }}>
            {erro}
          </Texto>
        </View>
      ) : null}
    </View>
  )
}
