/**
 * Ambiente dos testes. Módulos nativos viram dublês em memória: o teste
 * confere o comportamento do app, não o Keychain nem a rede de verdade.
 */

jest.mock('expo-secure-store', () => {
  const cofre = new Map<string, string>()
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 6,
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 7,
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
// AES-GCM de verdade (do Node) no lugar do nativo: o cofre da biometria cifra e decifra.
jest.mock('expo-crypto', () => {
  let n = 0
  const nodeCrypto = require('node:crypto')
  const { randomBytes } = nodeCrypto
  // `Buffer` do Node sem depender dos tipos do Node no tsconfig do app.
  const B = require('node:buffer').Buffer
  class Chave {
    bruta: Uint8Array
    constructor(bruta: Uint8Array) {
      this.bruta = bruta
    }
    static async generate() {
      return new Chave(randomBytes(32))
    }
    static async import(texto: string) {
      return new Chave(B.from(texto, 'base64'))
    }
    async encoded() {
      return B.from(this.bruta).toString('base64')
    }
  }
  class Selado {
    combinado: Uint8Array
    constructor(combinado: Uint8Array) {
      this.combinado = combinado
    }
    static fromCombined(texto: string) {
      return new Selado(B.from(texto, 'base64'))
    }
    async combined(codificacao?: string) {
      return codificacao === 'base64' ? B.from(this.combinado).toString('base64') : this.combinado
    }
  }
  return {
    randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`),
    getRandomBytes: jest.fn((quantos: number) => new Uint8Array(randomBytes(quantos))),
    getRandomBytesAsync: jest.fn(async (quantos: number) => new Uint8Array(randomBytes(quantos))),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: jest.fn(async (_alg: string, texto: string) =>
      nodeCrypto.createHash('sha256').update(texto).digest('hex'),
    ),
    AESKeySize: { AES128: 128, AES192: 192, AES256: 256 },
    AESEncryptionKey: Chave,
    AESSealedData: Selado,
    aesEncryptAsync: jest.fn(async (texto: Uint8Array, chave: Chave) => {
      const iv = randomBytes(12)
      const c = nodeCrypto.createCipheriv('aes-256-gcm', chave.bruta, iv)
      const corpo = B.concat([c.update(B.from(texto)), c.final()])
      return new Selado(B.concat([iv, corpo, c.getAuthTag()]))
    }),
    aesDecryptAsync: jest.fn(async (selado: Selado, chave: Chave) => {
      const b = selado.combinado
      const d = nodeCrypto.createDecipheriv('aes-256-gcm', chave.bruta, b.subarray(0, 12))
      d.setAuthTag(b.subarray(b.length - 16))
      return new Uint8Array(B.concat([d.update(b.subarray(12, b.length - 16)), d.final()]))
    }),
  }
})

// Biometria: sensor presente, rosto cadastrado, e a pessoa confirma (o teste muda quando quer).
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [2]),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}))

// Entrar com a Apple: o teste decide se está disponível e o que a folha devolve.
jest.mock('expo-apple-authentication', () => {
  const { createElement } = require('react')
  const { Pressable, Text } = require('react-native')
  return {
    isAvailableAsync: jest.fn(async () => false),
    signInAsync: jest.fn(),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) =>
      createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: 'Entrar com a Apple', onPress },
        createElement(Text, null, 'Entrar com a Apple'),
      ),
  }
})

// Google: o pedido fica pronto e a resposta é controlada pelo teste (`__responder`).
jest.mock('expo-auth-session/providers/google', () => {
  const React = require('react')
  let ouvinte: ((r: unknown) => void) | null = null
  return {
    __responder: (r: unknown) => ouvinte?.(r),
    useIdTokenAuthRequest: jest.fn(() => {
      const [resposta, setResposta] = React.useState(null)
      ouvinte = setResposta
      return [{}, resposta, jest.fn(async () => undefined)]
    }),
  }
})
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openBrowserAsync: jest.fn(async () => ({ type: 'opened' })),
}))

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
