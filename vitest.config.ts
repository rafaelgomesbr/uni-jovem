import { defineConfig } from 'vitest/config'

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
          environment: 'node',
          globalSetup: ['apps/api/test/apoio/postgres-global.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
