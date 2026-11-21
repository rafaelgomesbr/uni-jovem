/* eslint-disable no-restricted-syntax -- opacidade aqui é a camada animada do anel e do erro, não estado (D63) */
import {
  ALTURA_DO_ACESSO,
  ESPACO,
  MOVIMENTO_DE_ACESSO,
  RAIO,
  RITMO_DE_ACESSO,
  TIPO,
} from '@uj/tokens'
import { useId, useState, type ComponentRef, type ReactNode, type Ref } from 'react'
import { Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Abalar } from './Abalar'
import { FAMILIA } from './fontes'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useAnunciar } from './useAnunciar'
import { soNaWeb } from './web'

export interface PropsDoCampoDeAcesso extends Omit<
  TextInputProps,
  'style' | 'secureTextEntry' | 'accessibilityLabel' | 'placeholder' | 'editable'
> {
  /** Sempre visível acima do campo: placeholder não substitui rótulo. */
  rotulo: string
  /** Erro do campo: ícone mais texto na fenda de baixo, borda de 2 e anúncio (a cor nunca é o único sinal). */
  erro?: string | null
  /** Apoio vivo na fenda quando não há erro (o status da senha, "7 de 10 caracteres"). */
  apoio?: string | null
  /** Cada vez que sobe, o campo balança 5 pt (erro ao enviar). */
  disparoDeErro?: number
  /** Campo de senha, com "Mostrar" e "Ocultar" em texto. */
  senha?: boolean
  /** Só exemplo ("nome@exemplo.com"), nunca instrução. */
  exemplo?: string
  /** Só leitura (enviando): sem mudar a cor, o botão já diz que está enviando. */
  somenteLeitura?: boolean
  /** À direita do rótulo, na mesma linha ("Esqueci a senha"). */
  aoLado?: ReactNode
  ref?: Ref<ComponentRef<typeof TextInput>>
}

const SAIDA = Easing.out(Easing.quad)

/**
 * Campo da tela de acesso (D63): rótulo fixo acima (nunca flutuante, que o
 * preenchimento do sistema e a fonte grande quebram), caixa de 56, anel de foco
 * e de erro em camadas que só mudam de opacidade (o texto não se desloca), e
 * uma fenda de 26 sempre reservada embaixo: o erro aparece sem empurrar o
 * botão. "Mostrar" tem texto, não só o olho.
 */
export function CampoDeAcesso({
  rotulo,
  erro,
  apoio,
  disparoDeErro = 0,
  senha = false,
  exemplo,
  somenteLeitura = false,
  aoLado,
  onFocus,
  onBlur,
  ref,
  ...resto
}: PropsDoCampoDeAcesso) {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const id = useId()
  const [visivel, setVisivel] = useState(false)
  const foco = useSharedValue(0)
  const idDoRotulo = `rotulo-${id}`
  const idDoErro = `erro-${id}`

  // No iOS a região viva não fala: o erro novo é anunciado (nas três plataformas).
  useAnunciar(erro ? `${rotulo}: erro: ${erro}` : null)

  function mudarFoco(para: number) {
    foco.set(
      withTiming(para, {
        duration: reduzirMovimento
          ? 0
          : para
            ? MOVIMENTO_DE_ACESSO.foco
            : MOVIMENTO_DE_ACESSO.focoSaida,
        easing: SAIDA,
        reduceMotion: ReduceMotion.Never,
      }),
    )
  }

  const estiloDoAnel = useAnimatedStyle(() => ({ opacity: foco.value }))
  const camada = {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: RAIO.controle,
    borderWidth: 2,
  } as const

  return (
    <View style={{ alignSelf: 'stretch' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          columnGap: ESPACO.e12,
          marginBottom: ESPACO.e8,
        }}
      >
        <Texto variante="rotulo" cor="textoSuave" nativeID={idDoRotulo}>
          {rotulo}
        </Texto>
        {aoLado}
      </View>

      <Abalar disparo={disparoDeErro}>
        <View
          style={{
            minHeight: ALTURA_DO_ACESSO,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: RAIO.controle,
            borderWidth: 1,
            borderColor: cores.campoBorda,
            backgroundColor: cores.campoFundo,
          }}
        >
          <TextInput
            ref={ref}
            accessibilityLabel={rotulo}
            accessibilityLabelledBy={idDoRotulo}
            accessibilityHint={erro ? `Erro: ${erro}` : undefined}
            {...soNaWeb({
              dataSet: { campoDeAcesso: '' },
              'aria-describedby': erro ? idDoErro : undefined,
              'aria-invalid': erro ? true : undefined,
            })}
            placeholder={exemplo}
            placeholderTextColor={cores.textoSuave}
            secureTextEntry={senha && !visivel}
            editable={!somenteLeitura}
            importantForAutofill="yes"
            spellCheck={false}
            {...resto}
            onFocus={(e) => {
              mudarFoco(1)
              onFocus?.(e)
            }}
            onBlur={(e) => {
              mudarFoco(0)
              onBlur?.(e)
            }}
            style={[
              {
                flex: 1,
                alignSelf: 'stretch',
                minHeight: ALTURA_DO_ACESSO - 2,
                paddingLeft: ESPACO.e16,
                paddingRight: senha ? 104 : ESPACO.e16,
                paddingVertical: 0,
                color: cores.texto,
                fontFamily: FAMILIA.texto,
                // 16 evita o zoom automático do Safari ao focar o campo.
                fontSize: 16,
              },
              Platform.OS === 'web' ? { outlineWidth: 0 } : null,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[camada, { borderColor: cores.foco }, estiloDoAnel]}
          />
          {erro ? (
            <View pointerEvents="none" style={[camada, { borderColor: cores.erro }]} />
          ) : null}
          {senha ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
              onPress={() => setVisivel((v) => !v)}
              hitSlop={ESPACO.e4}
              style={{
                position: 'absolute',
                right: ESPACO.e6,
                top: 0,
                bottom: 0,
                minWidth: 96,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: ESPACO.e6,
              }}
            >
              <Icone nome={visivel ? 'ocultar' : 'mostrar'} cor={cores.textoSuave} tamanho={18} />
              <Texto variante="botao" cor="textoSuave" importantForAccessibility="no">
                {visivel ? 'Ocultar' : 'Mostrar'}
              </Texto>
            </Pressable>
          ) : null}
        </View>
      </Abalar>

      <View
        style={{
          marginTop: ESPACO.e6,
          minHeight: RITMO_DE_ACESSO.fendaDeErro - ESPACO.e6,
          justifyContent: 'flex-start',
        }}
      >
        {erro ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e6 }}>
            <View style={{ height: TIPO.meta.altura, justifyContent: 'center' }}>
              <Icone nome="erroDeCampo" cor={cores.erro} tamanho={16} />
            </View>
            {/* Texto em `texto`, ícone em `erro`: sobre o pico do violeta da aurora o `erro` não passa AA. */}
            <Texto variante="meta" peso="forte" nativeID={idDoErro} style={{ flex: 1 }}>
              {erro}
            </Texto>
          </View>
        ) : apoio ? (
          <Texto variante="meta" cor="textoSuave" accessibilityLiveRegion="polite">
            {apoio}
          </Texto>
        ) : null}
      </View>
    </View>
  )
}
