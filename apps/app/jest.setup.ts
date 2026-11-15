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

// Câmera: o teste confere a tela e a chamada à API, não o leitor nativo.
jest.mock('expo-camera', () => {
  const { View } = require('react-native')
  const permissao = { granted: true, canAskAgain: true, status: 'granted', expires: 'never' }
  return {
    CameraView: (props: object) =>
      require('react').createElement(View, { ...props, testID: 'camera' }),
    useCameraPermissions: jest.fn(() => [permissao, jest.fn(async () => permissao)]),
  }
})

// Chave de idempotência previsível e sem módulo nativo.
jest.mock('expo-crypto', () => {
  let n = 0
  return {
    randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`),
  }
})
