import { defineConfig } from 'vitest/config'

/** Testes que leem a marca d'água de sincronização (ver o projeto 'banco-marca-dagua'). */
const MARCA_DAGUA = [
  'apps/api/test/banco/rls-nucleo.test.ts',
  'apps/api/test/banco/sincronizacao.test.ts',
  'apps/api/test/banco/tarefas-diarias.test.ts',
]

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unidade',
          include: ['packages/*/test/**/*.test.ts', 'apps/api/test/*.test.ts'],
          environment: 'node',
          // Rodam em paralelo com a subida do Postgres do projeto 'banco'.
          testTimeout: 20_000,
        },
      },
      {
        test: {
          name: 'banco',
          include: ['apps/api/test/banco/**/*.test.ts'],
          exclude: MARCA_DAGUA,
          environment: 'node',
          globalSetup: ['apps/api/test/apoio/postgres-global.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
      {
        // A marca d'água do log de mudanças (D13) vale para o cluster inteiro:
        // qualquer transação aberta por outro arquivo de teste a segura. Estes
        // arquivos conferem exatamente essa marca, então ganham um Postgres só
        // deles (o globalSetup roda por projeto) e rodam um arquivo por vez.
        test: {
          name: 'banco-marca-dagua',
          include: MARCA_DAGUA,
          environment: 'node',
          globalSetup: ['apps/api/test/apoio/postgres-global.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
