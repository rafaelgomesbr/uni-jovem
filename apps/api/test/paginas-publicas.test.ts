import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig, type Config } from '../src/config.ts'
import {
  conferirPaginasPublicas,
  marcadoresPendentes,
  PAGINAS_PUBLICAS,
  registrarDocumentosPublicos,
} from '../src/publico/documentos.ts'
import { criarServidor } from '../src/servidor.ts'
import { envDeTeste } from './apoio/config.ts'

/**
 * B1: nenhuma página pública com [PREENCHER] em produção (a partida recusa;
 * em homologação, só o aviso no log). M3: página inicial e "não encontrado".
 */

const IMPRESSAO = Array.from({ length: 32 }, () => 'AB').join(':')

/** Configuração de produção completa, com valores fictícios. */
const producao = carregarConfig(
  envDeTeste({
    UJ_AMBIENTE: 'producao',
    URL_PUBLICA: 'https://unijovem.exemplo.test',
    TURNSTILE_SEGREDO: 'ts',
    SUPORTE_EMAIL: 'suporte@exemplo.test',
    ANDROID_SHA256_IMPRESSOES: IMPRESSAO,
  }),
)

function servidorDasPaginas(config: Config, pasta?: string) {
  const app = Fastify()
  registrarDocumentosPublicos(app, { config, ...(pasta ? { pasta } : {}) })
  return app
}

const DOCUMENTO_COMPLETO = `# Política de Privacidade

> Cabeçalho interno do rascunho.

## 1. Quem somos

Texto completo, sem pendência.
`

const PAGINA_DE_EXCLUSAO = `# Exclusão de conta

## 10. Conteúdo da página (rascunho)

> No app, abra Perfil e toque em Excluir conta.
`

let pastaCompleta: string
let pastaPendente: string

beforeAll(async () => {
  pastaCompleta = await mkdtemp(join(tmpdir(), 'uj-docs-ok-'))
  pastaPendente = await mkdtemp(join(tmpdir(), 'uj-docs-pendente-'))
  for (const pasta of [pastaCompleta, pastaPendente]) {
    await writeFile(
      join(pasta, 'termos-de-uso.md'),
      DOCUMENTO_COMPLETO.replace('Política de Privacidade', 'Termos de Uso'),
    )
    await writeFile(join(pasta, 'exclusao-de-conta.md'), PAGINA_DE_EXCLUSAO)
  }
  await writeFile(join(pastaCompleta, 'politica-de-privacidade.md'), DOCUMENTO_COMPLETO)
  await writeFile(
    join(pastaPendente, 'politica-de-privacidade.md'),
    DOCUMENTO_COMPLETO.replace(
      'Texto completo, sem pendência.',
      'Controlador: [PREENCHER: razão social]. Contato: [PREENCHER: e-mail do encarregado].',
    ),
  )
})

afterAll(async () => {
  await Promise.all(
    [pastaCompleta, pastaPendente].map((p) => rm(p, { recursive: true, force: true })),
  )
})

describe('páginas públicas com [PREENCHER] (B1)', () => {
  it('acha o marcador em cada página e conta as ocorrências', async () => {
    const app = servidorDasPaginas(producao, pastaPendente)
    expect(await marcadoresPendentes(app)).toEqual([
      { caminho: '/privacidade', status: 200, ocorrencias: 2 },
    ])
    // Sem e-mail de suporte (só fora de produção a configuração aceita), o /suporte também.
    const semSuporte = servidorDasPaginas(carregarConfig(envDeTeste()), pastaCompleta)
    expect(await marcadoresPendentes(semSuporte)).toEqual([
      { caminho: '/suporte', status: 200, ocorrencias: 1 },
    ])
  })

  it('o aviso de rascunho não conta como pendência', async () => {
    const app = servidorDasPaginas(producao, pastaCompleta)
    const r = await app.inject({ method: 'GET', url: '/privacidade' })
    expect(r.body).toContain('Rascunho em revisão jurídica')
    expect(await marcadoresPendentes(app)).toEqual([])
  })

  it('produção não sobe com página pendente; homologação só avisa', async () => {
    const app = servidorDasPaginas(producao, pastaPendente)
    await expect(conferirPaginasPublicas(app, 'producao')).rejects.toThrow(/\/privacidade/)
    expect(await conferirPaginasPublicas(app, 'homologacao')).toMatch(/PREENCHER.*\/privacidade/)
    expect(
      await conferirPaginasPublicas(servidorDasPaginas(producao, pastaCompleta), 'producao'),
    ).toBeNull()
  })

  it('documento ausente (página fora do ar) também impede a produção', async () => {
    const vazia = await mkdtemp(join(tmpdir(), 'uj-docs-vazia-'))
    try {
      const app = servidorDasPaginas(producao, vazia)
      await expect(conferirPaginasPublicas(app, 'producao')).rejects.toThrow(/\/termos \(503\)/)
    } finally {
      await rm(vazia, { recursive: true, force: true })
    }
  })

  it('documentos reais: nenhuma página pública com [PREENCHER] quando UJ_AMBIENTE=producao', async () => {
    // Falha só no ensaio de produção (UJ_AMBIENTE=producao npx vitest run): os
    // dados que faltam vêm do dono (PH-11). Fora dele, a regra é só avisar.
    const app = servidorDasPaginas(producao)
    const pendentes = await marcadoresPendentes(app)
    if (process.env['UJ_AMBIENTE'] === 'producao') {
      expect(pendentes).toEqual([])
    } else {
      expect(pendentes.every((p) => p.status === 200)).toBe(true)
      const aviso = await conferirPaginasPublicas(app, 'homologacao')
      expect(aviso === null || aviso.includes('[PREENCHER]')).toBe(true)
    }
  })
})

describe('página inicial e "não encontrado" (M3)', () => {
  it('/ é SSR, indexável, com CSP estrita, sem script e com os links legais', async () => {
    const app = servidorDasPaginas(producao, pastaCompleta)
    const r = await app.inject({ method: 'GET', url: '/' })
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toContain('text/html')
    expect(r.headers['content-security-policy']).toContain("default-src 'self'")
    expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(r.body).toContain('<h1>Uni Jovem</h1>')
    expect(r.body).not.toContain('<script')
    expect(r.body).not.toContain('noindex')
    expect(r.body).toContain('<meta property="og:url" content="https://unijovem.exemplo.test/" />')
    for (const caminho of PAGINAS_PUBLICAS.filter((c) => c !== '/')) {
      expect(r.body).toContain(`href="${caminho}"`)
    }
  })

  it('endereço inexistente: JSON em pt-BR na API, página HTML no resto', async () => {
    const app = criarServidor(carregarConfig(envDeTeste()))
    const api = await app.inject({ method: 'GET', url: '/api/v1/nada-aqui?x=1' })
    expect(api.statusCode).toBe(404)
    expect(api.headers['content-type']).toContain('application/json')
    expect(api.json()).toEqual({
      erro: 'nao_encontrado',
      mensagem: 'Não encontramos este endereço. Confira o link ou atualize o app.',
    })
    const pagina = await app.inject({ method: 'GET', url: '/pagina/que/nao/existe' })
    expect(pagina.statusCode).toBe(404)
    expect(pagina.headers['content-type']).toContain('text/html')
    expect(pagina.headers['content-security-policy']).toContain("default-src 'self'")
    expect(pagina.headers['cache-control']).toBe('no-store')
    expect(pagina.body).toContain('Página não encontrada')
    expect(pagina.body).toContain('noindex')
    // O caminho pedido nunca volta na página (nada a refletir).
    const refletido = await app.inject({ method: 'GET', url: '/%3Cscript%3Ealert(1)%3C/script%3E' })
    expect(refletido.body).not.toContain('<script>')
    await app.close()
  })
})
