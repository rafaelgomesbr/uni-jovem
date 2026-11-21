import type { ExpoConfig } from 'expo/config'

import { NOME_DO_APP } from '../../packages/dominio/src/produto.ts'

/**
 * Configuração do app (substitui o `app.json` do modelo).
 *
 * Um binário por ambiente, escolhido pelo perfil do EAS (`EAS_BUILD_PROFILE`)
 * ou por `UJ_VARIANTE` fora do EAS. Cada ambiente tem identificador próprio,
 * então homologação e produção convivem no mesmo aparelho e nunca trocam
 * dados, chaves de push ou sessão (P5, D21, D22).
 */

type Variante = 'desenvolvimento' | 'homologacao' | 'producao'

function varianteAtual(): Variante {
  const bruta = process.env['UJ_VARIANTE'] ?? process.env['EAS_BUILD_PROFILE'] ?? 'desenvolvimento'
  if (bruta === 'producao' || bruta === 'homologacao') return bruta
  return 'desenvolvimento'
}

const VARIANTE = varianteAtual()

/**
 * O nome vem da constante única (D5), a mesma do app e da API. Importada pelo
 * caminho do arquivo: a configuração roda no Node na hora do build, fora do
 * Metro, e o `produto.ts` não importa nada.
 */
const NOME = NOME_DO_APP

const IDENTIFICADOR: Record<Variante, string> = {
  producao: 'com.solerte.unijovem',
  homologacao: 'com.solerte.unijovem.hml',
  desenvolvimento: 'com.solerte.unijovem.hml',
}

const NOME_NO_APARELHO: Record<Variante, string> = {
  producao: NOME,
  homologacao: `${NOME} HML`,
  desenvolvimento: `${NOME} Dev`,
}

/** Domínio dos links universais por ambiente (`.well-known` servido pela API). */
const DOMINIO: Record<Variante, string> = {
  producao: 'unijovem.solerte.com.br',
  homologacao: 'unijovem-hml.solerte.com.br',
  desenvolvimento: 'unijovem-hml.solerte.com.br',
}

/**
 * Textos de permissão num lugar só. Dizem o que o app faz com a permissão,
 * sem promessa vaga (a Apple recusa "para melhorar sua experiência").
 */
const TEXTO_CAMERA =
  'A câmera lê o QR Code de presença na entrada de um evento e, quando você escolhe, tira a ' +
  'sua foto de perfil ou o logotipo da sua comunidade. Só a foto que você confirmar é enviada, ' +
  'recortada e sem a localização.'

/** Galeria (D33): só a imagem escolhida chega ao app; nada mais da galeria é lido. */
const TEXTO_GALERIA =
  'A galeria é usada quando você escolhe uma foto de perfil ou o logotipo da sua comunidade. ' +
  'Só a imagem escolhida é enviada, recortada e sem a localização.'

const TEXTO_FACE_ID =
  `O Face ID protege a sua sessão no ${NOME}: com ele ligado, o app só abre a sua conta ` +
  'depois de confirmar que é você. Nenhuma imagem do seu rosto sai do aparelho.'

/**
 * Entrar com Google no celular devolve a pessoa ao app por um esquema de URL:
 * no iOS, o reverso do cliente iOS ("com.googleusercontent.apps.<id>"); no
 * Android, o pacote do app (padrão do expo-auth-session). Só entram quando o
 * ID de cliente existe no ambiente do build.
 */
const CLIENTE_GOOGLE_IOS = process.env['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID']
const CLIENTE_GOOGLE_ANDROID = process.env['EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID']
const ESQUEMA = VARIANTE === 'producao' ? 'unijovem' : 'unijovem-hml'
const ESQUEMAS = [
  ESQUEMA,
  ...(CLIENTE_GOOGLE_IOS ? [CLIENTE_GOOGLE_IOS.split('.').reverse().join('.')] : []),
  ...(CLIENTE_GOOGLE_ANDROID ? [IDENTIFICADOR[VARIANTE]] : []),
]

/** Versão vista pelas pessoas; o número de build fica com o EAS (`appVersionSource: remote`). */
const VERSAO = '1.0.0'

/** Projeto no EAS (conta `rafaelgmsz`), criado pelo `eas init` em 14/11/2026. Não é segredo. */
const ID_DO_PROJETO_EAS = '70fc7050-14d4-468a-b55a-6e01da3ddbac'

const config: ExpoConfig = {
  name: NOME_NO_APARELHO[VARIANTE],
  slug: 'uni-jovem',
  owner: 'rafaelgmsz',
  version: VERSAO,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: ESQUEMAS.length > 1 ? ESQUEMAS : ESQUEMA,
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: IDENTIFICADOR[VARIANTE],
    supportsTablet: false,
    associatedDomains: [`applinks:${DOMINIO[VARIANTE]}`],
    // Entrar com a Apple (diretriz 4.8 da App Store, já que há login social).
    // O App ID precisa da capacidade "Sign in with Apple" no portal da Apple.
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: TEXTO_CAMERA,
      NSPhotoLibraryUsageDescription: TEXTO_GALERIA,
      // Textos do sistema (botões nativos, folhas, Face ID) em português.
      CFBundleDevelopmentRegion: 'pt-BR',
      CFBundleLocalizations: ['pt-BR'],
    },
  },
  android: {
    package: IDENTIFICADOR[VARIANTE],
    adaptiveIcon: {
      backgroundColor: '#12102A',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.CAMERA'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      // Sem anúncios nem alarmes exatos: as lojas cobram justificativa para estes.
      'com.google.android.gms.permission.AD_ID',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.SCHEDULE_EXACT_ALARM',
    ],
    // Dados locais (sessão, banco cifrado) não vão para o backup do Google.
    allowBackup: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: DOMINIO[VARIANTE], pathPrefix: '/convite' },
          // Link do código da comunidade (`/entrar/<codigo>`, D58), o mesmo do iOS (AASA).
          { scheme: 'https', host: DOMINIO[VARIANTE], pathPrefix: '/entrar/' },
          { scheme: 'https', host: DOMINIO[VARIANTE], pathPrefix: '/app' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    // O leitor de tela da web lê em português (atributo lang do documento).
    lang: 'pt-BR',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    ...(CLIENTE_GOOGLE_IOS
      ? [
          [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: CLIENTE_GOOGLE_IOS.split('.').reverse().join('.') },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#12102A',
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
      },
    ],
    [
      'expo-camera',
      { cameraPermission: TEXTO_CAMERA, microphonePermission: false, recordAudioAndroid: false },
    ],
    // Foto de perfil e logotipo (D33): câmera ou galeria, com o recorte 1:1 do sistema.
    [
      'expo-image-picker',
      {
        photosPermission: TEXTO_GALERIA,
        cameraPermission: TEXTO_CAMERA,
        microphonePermission: false,
      },
    ],
    // Face ID: o cofre da sessão (SecureStore com requireAuthentication) e a
    // confirmação ao ligar (LocalAuthentication) usam o mesmo texto.
    ['expo-secure-store', { faceIDPermission: TEXTO_FACE_ID }],
    ['expo-local-authentication', { faceIDPermission: TEXTO_FACE_ID }],
    'expo-apple-authentication',
    ['expo-sqlite', { useSQLCipher: true }],
    // Versículo local e push nativo (F14). Sem alarme exato (bloqueado acima):
    // o versículo pode chegar com alguns minutos de diferença, sem justificativa à loja.
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#B83E1A',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
    baseUrl: '/app',
  },
  extra: {
    variante: VARIANTE,
    eas: { projectId: ID_DO_PROJETO_EAS },
  },
}

export default config
