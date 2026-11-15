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

// Chave de idempotência previsível e sem módulo nativo. Bytes aleatórios vêm do Node.
jest.mock('expo-crypto', () => {
  let n = 0
  const { randomBytes } = require('node:crypto')
  return {
    randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`),
    getRandomBytes: jest.fn((quantos: number) => new Uint8Array(randomBytes(quantos))),
    getRandomBytesAsync: jest.fn(async (quantos: number) => new Uint8Array(randomBytes(quantos))),
  }
})

// Banco local: SQL de verdade (SQLite do Node) com a chave do SQLCipher simulada.
jest.mock('expo-sqlite', () => require('./src/testes/sqliteFalso'))

// Notificações do sistema: permissão ainda não perguntada, nada agendado.
jest.mock('expo-notifications', () => {
  const permissao = {
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
    expires: 'never',
    ios: { status: 0 },
  }
  return {
    IosAuthorizationStatus: {
      NOT_DETERMINED: 0,
      DENIED: 1,
      AUTHORIZED: 2,
      PROVISIONAL: 3,
      EPHEMERAL: 4,
    },
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    getPermissionsAsync: jest.fn(async () => permissao),
    requestPermissionsAsync: jest.fn(async () => permissao),
    getAllScheduledNotificationsAsync: jest.fn(async () => []),
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
    scheduleNotificationAsync: jest.fn(async () => 'id'),
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    getDevicePushTokenAsync: jest.fn(async () => ({ type: 'ios', data: 'ab'.repeat(32) })),
  }
})

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }))

// Arquivo e compartilhamento: o teste confere o conteúdo entregue, não o sistema.
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}))

jest.mock('expo-file-system', () => {
  class File {
    uri: string
    exists = false
    conteudo = ''
    constructor(...partes: unknown[]) {
      this.uri = `file:///cache/${String(partes.at(-1))}`
    }
    create() {
      this.exists = true
    }
    async write(texto: string) {
      this.conteudo = texto
      ;(globalThis as { __ultimoArquivo?: { uri: string; conteudo: string } }).__ultimoArquivo = {
        uri: this.uri,
        conteudo: texto,
      }
    }
    delete() {
      this.exists = false
    }
  }
  return { File, Paths: { cache: 'cache' } }
})
