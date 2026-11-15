// Lint do app (Expo/React Native). Segue a política da raiz: tudo é "error",
// porque aviso ninguém lê. O `eslint.config.mjs` da raiz ignora `apps/app`;
// este arquivo vale para os arquivos daqui (o ESLint 10 procura a configuração
// a partir da pasta de cada arquivo), então `npm run lint` na raiz e aqui
// aplicam as mesmas regras.
//
// Por que não `eslint-config-expo`: ele traz `eslint-plugin-react` e
// `eslint-plugin-import`, que ainda não declaram suporte ao ESLint 10 da raiz.
// O que importa para este app fica coberto pelo typescript-eslint (com tipos)
// e pelas regras de hooks do React 19 (inclusive as do React Compiler, que o
// app usa em `experiments.reactCompiler`).

import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'android/**',
      'ios/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ['*.mjs', '*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-proto': 'error',
      'no-debugger': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // `onPress={async () => ...}` é o jeito comum no React Native; o retorno é ignorado.
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/incompatible-library': 'error',
      'react-hooks/unsupported-syntax': 'error',
    },
  },
  {
    // Configuração, testes e dublês rodam no Node/Jest (require de módulos dublados).
    files: ['*.config.ts', '*.config.mjs', 'jest.setup.ts', '**/__tests__/**', 'src/testes/**'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
)
