import { ESPACO } from '@uj/tokens'
import { router, type NativeStackNavigationOptions } from 'expo-router'
import { Platform, Pressable, type ColorValue } from 'react-native'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { FAMILIA } from '@/ui/fontes'
import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { useTema } from '@/ui/tema'

/**
 * Botão de voltar da web: o padrão da biblioteca diz "Go back" ao leitor de
 * tela. Aqui, "Voltar", com alvo de 44 pt e realce ao toque.
 */
function VoltarNaWeb({ tintColor, canGoBack }: { tintColor?: ColorValue; canGoBack?: boolean }) {
  const { cores } = useTema()
  if (!canGoBack) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      onPress={() => router.back()}
      style={({ pressed }) => ({
        minWidth: ALVO,
        minHeight: ALVO,
        marginLeft: ESPACO.x1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: ALVO / 2,
        backgroundColor: pressed ? cores.superficieRealce : 'transparent',
      })}
    >
      <Icone nome="voltar" cor={tintColor ?? cores.destaque} />
    </Pressable>
  )
}

/**
 * Opções comuns a todas as pilhas (navegadores aninhados não herdam as do
 * pai). Com "Reduzir movimento", as transições entre telas são cortadas.
 */
export function useOpcoesDaPilha(): NativeStackNavigationOptions {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  return {
    contentStyle: { backgroundColor: cores.fundo },
    headerStyle: { backgroundColor: cores.fundo },
    headerTintColor: cores.destaque,
    headerTitleStyle: { fontFamily: FAMILIA.textoForte, color: cores.texto },
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    animation: reduzirMovimento ? 'none' : 'default',
    ...(Platform.OS === 'web' ? { headerLeft: (props) => <VoltarNaWeb {...props} /> } : {}),
  }
}
