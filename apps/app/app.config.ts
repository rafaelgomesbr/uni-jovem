import type { ExpoConfig } from 'expo/config'

/**
 * Configuração do app Uni Jovem (substitui o `app.json` do modelo).
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

/** O nome vive aqui e em `src/constantes` (D5): trocar o nome é trocar estes dois pontos. */
const NOME = 'Uni Jovem'

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
  'A câmera é usada só para ler o QR Code de presença na entrada de um evento. ' +
  'Nenhuma foto é tirada nem guardada.'

/** Versão vista pelas pessoas; o número de build fica com o EAS (`appVersionSource: remote`). */
const VERSAO = '0.1.0'

/** Projeto no EAS (conta `rafaelgmsz`), criado pelo `eas init` em 14/11/2026. Não é segredo. */
const ID_DO_PROJETO_EAS = '70fc7050-14d4-468a-b55a-6e01da3ddbac'

const config: ExpoConfig = {
  name: NOME_NO_APARELHO[VARIANTE],
  slug: 'uni-jovem',
  owner: 'rafaelgmsz',
  version: VERSAO,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: VARIANTE === 'producao' ? 'unijovem' : 'unijovem-hml',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: IDENTIFICADOR[VARIANTE],
    supportsTablet: false,
    associatedDomains: [`applinks:${DOMINIO[VARIANTE]}`],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: TEXTO_CAMERA,
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
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: DOMINIO[VARIANTE], pathPrefix: '/convite' },
          { scheme: 'https', host: DOMINIO[VARIANTE], pathPrefix: '/app' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#12102A',
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
      },
    ],
    ['expo-secure-store', { faceIDPermission: false }],
    ['expo-sqlite', { useSQLCipher: true }],
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
