/**
 * Ambiente dos testes. Módulos nativos viram dublês em memória: o teste
 * confere o comportamento do app, não o Keychain nem a rede de verdade.
 */

jest.mock('expo-secure-store', () => {
  const cofre = new Map<string, string>()
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 6,
    __cofre: cofre,
    getItemAsync: jest.fn(async (chave: string) => cofre.get(chave) ?? null),
    setItemAsync: jest.fn(async (chave: string, valor: string) => {
      cofre.set(chave, valor)
    }),
    deleteItemAsync: jest.fn(async (chave: string) => {
      cofre.delete(chave)
    }),
  }
})

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
)

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
)

// Ícones são decorativos; no teste basta um nó vazio.
jest.mock('expo-symbols', () => {
  const { View } = require('react-native')
  return { SymbolView: (props: object) => require('react').createElement(View, props) }
})

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }))
