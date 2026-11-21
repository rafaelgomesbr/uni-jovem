import { ALTURA_DO_ACESSO_TERCIARIO, ALTURA_DO_LINK_DO_RODAPE, ESPACO, RAIO } from '@uj/tokens'
import type { ReactNode, Ref } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'

import { useAnelDeFoco, type NoDeView } from './foco'
import { ALVO } from './medidas'
import { useTema } from './tema'
import { useToqueComMola } from './useToqueComMola'

interface PropsDoLinkDeAcesso {
  /** O nome para o leitor de tela: o texto inteiro do link ("Primeira vez aqui? Criar conta"). */
  rotulo: string
  aoPressionar: () => void
  children: ReactNode
  /** `rodape` 48 (largura toda), `curto` 44 (links soltos), `linha` 44 sem esticar ("Esqueci a senha"). */
  tamanho?: 'rodape' | 'curto' | 'linha'
  dica?: string
  desabilitado?: boolean
  ref?: Ref<NoDeView>
}

/**
 * Link de texto da tela de acesso (rodapé, "Esqueci a senha", "Voltar"): alvo
 * de 44 a 48, camada de pressionado (só a camada, sem escala) e anel de foco.
 * O conteúdo é de quem chama; o nome acessível é o texto inteiro.
 */
export function LinkDeAcesso({
  rotulo,
  aoPressionar,
  children,
  tamanho = 'curto',
  dica,
  desabilitado = false,
  ref,
}: PropsDoLinkDeAcesso) {
  const { cores } = useTema()
  const anel = useAnelDeFoco(cores.foco)
  const toque = useToqueComMola({ escala: false })
  const altura = tamanho === 'rodape' ? ALTURA_DO_ACESSO_TERCIARIO : ALTURA_DO_LINK_DO_RODAPE
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      {...(dica ? { accessibilityHint: dica } : {})}
      aria-disabled={desabilitado}
      disabled={desabilitado}
      onPress={aoPressionar}
      onPressIn={toque.aoPressionarDentro}
      onPressOut={toque.aoPressionarFora}
      onFocus={anel.onFocus}
      onBlur={anel.onBlur}
      hitSlop={ESPACO.e4}
      style={[
        {
          minHeight: Math.max(altura, ALVO),
          minWidth: ALVO,
          overflow: 'hidden',
          flexDirection: 'row',
          flexWrap: 'wrap',
          // Quebrado em duas linhas (fonte grande), o conteúdo continua centrado na altura do alvo.
          alignContent: 'center',
          alignItems: 'center',
          justifyContent: tamanho === 'linha' ? 'flex-end' : 'center',
          columnGap: ESPACO.e4,
          paddingHorizontal: ESPACO.e8,
          borderRadius: RAIO.controle,
        },
        anel.estilo,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: cores.pressionado },
          toque.estiloDaCamada,
        ]}
      />
      {children}
    </Pressable>
  )
}
