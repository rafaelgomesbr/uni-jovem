import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig, type Config } from '../src/config.ts'
import { caminhoSemConsulta } from '../src/log.ts'
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

const NL = String.fromCharCode(10)

describe('app aberto nas páginas públicas (ADR 0007)', () => {
  it('/ não diz mais "só por convite"; /suporte explica criar e denunciar comunidade', async () => {
    const app = servidorDasPaginas(producao, pastaCompleta)
    const inicio = await app.inject({ method: 'GET', url: '/' })
    expect(inicio.body).not.toMatch(/só por convite/i)
    expect(inicio.body).toContain('Crie sua conta')
    const suporte = await app.inject({ method: 'GET', url: '/suporte' })
    expect(suporte.body).toContain('Como criar uma comunidade')
    expect(suporte.body).toContain('Como denunciar uma comunidade')
    expect(suporte.body).toContain('href="/termos#administrador"')
  })

  it('/termos anexa o Termo do Administrador em #administrador, sem notas internas', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'uj-docs-termo-'))
    try {
      await writeFile(
        join(pasta, 'termos-de-uso.md'),
        '# Termos de Uso' + NL + NL + '## 1. Uso' + NL + NL + 'Texto.' + NL,
      )
      const app = servidorDasPaginas(producao, pasta)
      // Sem o arquivo do termo: a página continua respondendo.
      const sem = await app.inject({ method: 'GET', url: '/termos' })
      expect(sem.statusCode).toBe(200)
      expect(sem.body).not.toContain('id="administrador"')
      await writeFile(
        join(pasta, 'termo-do-administrador.md'),
        [
          '# Termo do Administrador da Comunidade',
          '',
          '> Cabeçalho interno do rascunho.',
          '',
          '## A1. Para quem vale',
          '',
          'Texto do termo. [REVISÃO JURÍDICA: dúvida para o advogado.]',
          '',
        ].join(NL),
      )
      const com = await app.inject({ method: 'GET', url: '/termos' })
      expect(com.statusCode).toBe(200)
      expect(com.body).toContain('id="administrador"')
      expect(com.body).toContain('A1. Para quem vale')
      expect(com.body).not.toContain('REVISÃO JURÍDICA')
    } finally {
      await rm(pasta, { recursive: true, force: true })
    }
  })

  it('/termos com os documentos reais: o termo aparece, sem revisão jurídica nem anexo', async () => {
    const app = servidorDasPaginas(producao)
    const r = await app.inject({ method: 'GET', url: '/termos' })
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('id="administrador"')
    expect(r.body).not.toContain('REVISÃO JURÍDICA')
    expect(r.body).not.toContain('Anexo')
  })

  it('links universais incluem /entrar/*; o log não guarda o código da comunidade', async () => {
    const app = servidorDasPaginas(producao, pastaCompleta)
    const aasa = await app.inject({ method: 'GET', url: '/.well-known/apple-app-site-association' })
    expect(JSON.stringify(aasa.json())).toContain('/entrar/*')
    expect(caminhoSemConsulta('/entrar/ABCD2345?x=1')).toBe('/entrar/[codigo]')
    expect(caminhoSemConsulta('/app/entrar/ABCD2345')).toBe('/app/entrar/[codigo]')
    expect(caminhoSemConsulta('/api/v1/entrada')).toBe('/api/v1/entrada')
  })
})

describe('link do código da comunidade: /entrar/:codigo (D58)', () => {
  it('código válido: mostra o código formatado e as três ações, sem script embutido', async () => {
    const app = servidorDasPaginas(producao, pastaCompleta)
    const r = await app.inject({ method: 'GET', url: '/entrar/XPHVYHFS' })
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toContain('text/html')
    expect(r.headers['x-robots-tag']).toBe('noindex, nofollow')
    expect(r.headers['content-security-policy']).toContain("script-src 'self'")
    expect(r.body).toContain('noindex')
    expect(r.body).toContain('Você foi convidado(a) para uma comunidade no Uni Jovem')
    expect(r.body).toContain('XPHV YHFS')
    expect(r.body).toContain('href="unijovem://entrar/XPHVYHFS"')
    expect(r.body).toContain('>Abrir no app<')
    expect(r.body).toContain('href="/app/tenho-um-codigo?codigo=XPHVYHFS"')
    expect(r.body).toContain('Continuar no navegador')
    expect(r.body).toContain('Copiar código')
    expect(r.body).toContain('<script src="/publico/codigo.js" defer>')
    // Nenhum script inline: a CSP não deixaria rodar.
    expect(r.body.replace(/<script src="[^"]*" defer><\/script>/g, '')).not.toContain('<script')
  })

  it('aceita minúsculas, espaço e hífen, e usa o esquema do ambiente', async () => {
    const hml = servidorDasPaginas(
      carregarConfig(
        envDeTeste({
          UJ_AMBIENTE: 'homologacao',
          URL_PUBLICA: 'https://unijovem-hml.exemplo.test',
          TURNSTILE_SEGREDO: 'ts',
        }),
      ),
      pastaCompleta,
    )
    const r = await hml.inject({ method: 'GET', url: '/entrar/xphv-yhfs' })
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('XPHV YHFS')
    expect(r.body).toContain('href="unijovem-hml://entrar/XPHVYHFS"')
  })

  it('formato inválido: 404 amigável, sem refletir o que veio na URL', async () => {
    const app = servidorDasPaginas(producao, pastaCompleta)
    for (const ruim of [
      'ABC',
      'XPHVYHFSX',
      'XPHVYHF0', // 0 não existe no alfabeto
      'XPHVYHFO', // O também não
      'XPHVYHF1',
      '%3Cscript%3Ealert(1)%3C%2Fscript%3E',
      'A'.repeat(90),
    ]) {
      const r = await app.inject({ method: 'GET', url: `/entrar/${ruim}` })
      expect(r.statusCode, ruim).toBe(404)
      expect(r.headers['x-robots-tag']).toBe('noindex, nofollow')
      expect(r.body).toContain('Código não reconhecido')
      expect(r.body).not.toContain('<script>')
      expect(r.body).not.toContain('Abrir no app')
    }
    const vazio = await app.inject({ method: 'GET', url: '/entrar/' })
    expect(vazio.statusCode).toBe(404)
  })

  it('não consulta o banco: resposta igual para qualquer código de formato válido', async () => {
    // O servidor das páginas nem tem banco: se a rota consultasse, falharia aqui.
    const app = servidorDasPaginas(producao, pastaCompleta)
    const a = await app.inject({ method: 'GET', url: '/entrar/ABCD2345' })
    const b = await app.inject({ method: 'GET', url: '/entrar/ZZZZ9999' })
    expect(a.statusCode).toBe(200)
    expect(b.statusCode).toBe(200)
    // Nada de nome de comunidade: só o código muda entre as duas páginas.
    expect(
      a.body
        .replaceAll('ABCD2345', 'X')
        .replaceAll('ABCD 2345', 'Y')
        .replaceAll('A B C D 2 3 4 5', 'Z'),
    ).toBe(
      b.body
        .replaceAll('ZZZZ9999', 'X')
        .replaceAll('ZZZZ 9999', 'Y')
        .replaceAll('Z Z Z Z 9 9 9 9', 'Z'),
    )
  })

  it('o script de copiar é servido como JavaScript e só lê o atributo do botão', async () => {
    const app = servidorDasPaginas(producao, pastaCompleta)
    const r = await app.inject({ method: 'GET', url: '/publico/codigo.js' })
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toContain('text/javascript')
    expect(r.body).toContain("getAttribute('data-codigo')")
    expect(r.body).not.toContain('location')
  })
})
