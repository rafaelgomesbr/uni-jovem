import { ALTURA, ESPACO, RAIO, TIPO } from '@uj/tokens'
import { useId, useState } from 'react'
import { Pressable, TextInput, View, type TextInputProps } from 'react-native'

import { useAnunciar } from './useAnunciar'
import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { FAMILIA } from './fontes'
import { Icone } from './Icone'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import { useTema } from './tema'
import { soNaWeb } from './web'

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
  /** Campo de data ou hora digitada: o formato vai na ajuda, não só no exemplo apagado. */
  formato?: 'data' | 'hora'
}

export function Campo({
  rotulo,
  erro,
  ajuda: ajudaDoCampo,
  senha = false,
  exemplo,
  formato,
  onFocus,
  onBlur,
  ...resto
}: PropsDoCampo) {
  const { cores } = useTema()
  const { reduzirTransparencia } = usePreferenciasDeAcessibilidade()
  const id = useId()
  const [focado, setFocado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const ajudaDoFormato =
    formato === 'data' ? 'Formato DD/MM/AAAA.' : formato === 'hora' ? 'Formato HH:MM.' : null
  const ajuda = [ajudaDoFormato, ajudaDoCampo].filter(Boolean).join(' ') || undefined
  const idDoRotulo = `rotulo-${id}`
  const idDaAjuda = `ajuda-${id}`
  const idDoErro = `erro-${id}`
  const descricao = [erro ? `Erro: ${erro}` : null, ajuda].filter(Boolean).join('. ')
  // No iOS a região viva não fala: o erro novo é anunciado (nas três plataformas).
  useAnunciar(erro ? `${rotulo}: ${erro}` : null)

  return (
    <View style={{ gap: ESPACO.x2, alignSelf: 'stretch' }}>
      <Texto variante="corpoForte" nativeID={idDoRotulo} style={{ fontSize: 15 }}>
        {rotulo}
      </Texto>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: Math.max(ALVO, ALTURA.campo),
          borderRadius: RAIO.medio,
          // Vidro com borda suave; foco e erro trocam a borda por uma de 2 pt (forma, não só cor).
          borderWidth: erro || focado ? 2 : 1,
          borderColor: erro ? cores.erro : focado ? cores.foco : cores.borda,
          backgroundColor: reduzirTransparencia ? cores.superficie : cores.cartaoVidro,
        }}
      >
        <TextInput
          accessibilityLabel={rotulo}
          accessibilityLabelledBy={idDoRotulo}
          accessibilityHint={descricao || undefined}
          {...soNaWeb({
            'aria-describedby':
              [erro ? idDoErro : null, ajuda ? idDaAjuda : null].filter(Boolean).join(' ') ||
              undefined,
            'aria-invalid': erro ? true : undefined,
          })}
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
            minHeight: Math.max(ALVO, ALTURA.campo),
            paddingHorizontal: ESPACO.x4,
            paddingVertical: ESPACO.x3,
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
        <Texto
          variante="apoio"
          cor="textoSuave"
          nativeID={idDaAjuda}
          importantForAccessibility="no"
        >
          {ajuda}
        </Texto>
      ) : null}
      {erro ? (
        <View style={{ flexDirection: 'row', gap: ESPACO.x1, alignItems: 'flex-start' }}>
          <Icone nome="erro" cor={cores.erro} tamanho={18} />
          <Texto variante="apoio" cor="erro" nativeID={idDoErro} style={{ flex: 1 }}>
            {erro}
          </Texto>
        </View>
      ) : null}
    </View>
  )
}
