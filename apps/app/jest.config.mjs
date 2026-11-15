// Jest do app. Os testes passam pelo React Compiler, como o bundle que vai
// para o aparelho (`experiments.reactCompiler` no app.config.ts). Sem isso, o
// Jest roda um código que ninguém usa: em 15/11/2026 o compilador pulava os
// `useRef` de `useRefsDosCampos` a partir do segundo render, o app fechava em
// "Nova programação" e todos os testes passavam.
import { createRequire } from 'node:module'

const exigir = createRequire(import.meta.url)
const { resolveBabelOptions } = exigir('jest-expo/src/resolveBabelOptions')

const opcoesDoBabel = resolveBabelOptions(import.meta.dirname)
// O mesmo `babel-jest` que o preset do jest-expo usa (o do Jest 30).
const babelJest = exigir.resolve('babel-jest', {
  paths: [exigir.resolve('jest-expo/package.json')],
})

export default {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  testTimeout: 60000,
  transform: {
    '\\.[jt]sx?$': [
      babelJest,
      { ...opcoesDoBabel, caller: { ...opcoesDoBabel.caller, supportsReactCompiler: true } },
    ],
  },
}
