import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

/**
 * O teclado está aberto? A barra de abas flutuante some enquanto ele está na
 * tela (2.12.17), e a barra de ação volta a encostar no fim. Na web não há
 * teclado virtual a acompanhar.
 */
export function useTecladoAberto(): boolean {
  const [aberto, setAberto] = useState(false)
  // O teclado é um sistema externo: assina os eventos dele enquanto a tela existe.
  useEffect(() => {
    if (Platform.OS === 'web') return
    const ios = Platform.OS === 'ios'
    const abrir = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setAberto(true),
    )
    const fechar = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setAberto(false),
    )
    return () => {
      abrir.remove()
      fechar.remove()
    }
  }, [])
  return aberto
}
