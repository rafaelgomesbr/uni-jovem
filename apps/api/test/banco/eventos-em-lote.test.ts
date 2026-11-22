import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Vários dias de uma vez (D78): `POST /api/v1/c/:comunidadeId/eventos/em-lote`. Um encontro por
 * dia, cada um com a própria data e hora, o título do dia, o roteiro do modelo; tudo ou nada;
 * limite de 14; a mesma permissão de criar (e de publicar, se pedir); isolamento entre comunidades.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let orgA: Pessoa
let orgB: Pessoa
let membroA: Pessoa
let localDeB: string

const emLote = (com: string, quem: Pessoa, corpo: object) =>
  app.inject({
    method: 'POST',
    url: `/api/v1/c/${com}/eventos/em-lote`,
    headers: quem.auth,
    payload: corpo,
  })

const base = { categoria: 'Encontro', modelo: 'sabado_padrao' }

async function quantosEm(com: string): Promise<number> {
  return (
    await b.su.query<{ n: number }>(
      'select count(*)::int as n from uj.eventos where comunidade_id = $1',
      [com],
    )
  ).rows[0]!.n
}

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  comA = await criarComunidade(b, 'Jovens do Vale')
  comB = await criarComunidade(b, 'Jovens da Serra')
  orgA = await pessoaComSessao(b, app, config, 'Olga')
  orgB = await pessoaComSessao(b, app, config, 'Otávio')
  membroA = await pessoaComSessao(b, app, config, 'Mara')
  await vincular(b, orgA.id, comA, 'organizador')
  await vincular(b, orgB.id, comB, 'organizador')
  await vincular(b, membroA.id, comA, 'membro')
  localDeB = (
    await b.dono.query<{ id: string }>(
      `insert into uj.locais (comunidade_id, nome, tipo) values ($1, 'Salão de B', 'interno')
       returning id`,
      [comB],
    )
  ).rows[0]!.id
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('criar vários dias de uma vez', () => {
  it('um encontro por dia, na ordem das datas, com o título do dia e o roteiro do modelo', async () => {
    const r = await emLote(comA, orgA, {
      ...base,
      dias: [
        { data: '2026-12-13', hora: '10:00' },
        { data: '2026-12-11', hora: '19:30' },
        { data: '2026-12-12', hora: '16:00' },
      ],
    })
    expect(r.statusCode).toBe(200)
    const { eventos } = r.json() as {
      eventos: { id: string; titulo: string; inicio: string; status: string }[]
    }
    expect(eventos.map((e) => e.titulo)).toEqual(['Sexta', 'Sábado', 'Domingo'])
    expect(eventos.every((e) => e.status === 'rascunho')).toBe(true)
    // Cada dia na própria hora de parede de Brasília (UTC-3).
    expect(eventos.map((e) => e.inicio)).toEqual([
      '2026-12-11T22:30:00.000Z',
      '2026-12-12T19:00:00.000Z',
      '2026-12-13T13:00:00.000Z',
    ])
    for (const e of eventos) {
      const gravado = (
        await b.su.query<{ titulo: string; status: string; duracao_min: number; etapas: number }>(
          `select titulo, status, duracao_min,
                  (select count(*)::int from uj.etapas t where t.evento_id = e.id) as etapas
             from uj.eventos e where id = $1`,
          [e.id],
        )
      ).rows[0]!
      expect(gravado).toMatchObject({
        titulo: e.titulo,
        status: 'rascunho',
        duracao_min: 60,
        etapas: 7,
      })
    }
    const auditoria = (
      await b.su.query<{ n: number }>(
        "select count(*)::int as n from uj.auditoria where acao = 'evento.criado' and comunidade_id = $1",
        [comA],
      )
    ).rows[0]!.n
    expect(auditoria).toBeGreaterThanOrEqual(3)
  })

  it('o título que a pessoa escreveu vale para todos os dias', async () => {
    const r = await emLote(comA, orgA, {
      categoria: 'Retiro',
      titulo: 'Retiro de jovens',
      duracaoMin: 90,
      dias: [
        { data: '2026-12-18', hora: '19:00' },
        { data: '2026-12-19', hora: '19:00' },
      ],
    })
    expect(r.statusCode).toBe(200)
    const { eventos } = r.json() as { eventos: { titulo: string }[] }
    expect(eventos.map((e) => e.titulo)).toEqual(['Retiro de jovens', 'Retiro de jovens'])
  })

  it('com "publicar", os encontros já nascem publicados', async () => {
    const r = await emLote(comA, orgA, {
      ...base,
      publicar: true,
      dias: [
        { data: '2026-12-25', hora: '16:00' },
        { data: '2026-12-26', hora: '16:00' },
      ],
    })
    expect(r.statusCode).toBe(200)
    expect((r.json().eventos as { status: string }[]).map((e) => e.status)).toEqual([
      'publicado',
      'publicado',
    ])
  })

  it('só a organização cria (membro leva 403, nada gravado)', async () => {
    const antes = await quantosEm(comA)
    const r = await emLote(comA, membroA, {
      ...base,
      dias: [{ data: '2027-01-02', hora: '16:00' }],
    })
    expect(r.statusCode).toBe(403)
    expect(await quantosEm(comA)).toBe(antes)
  })
})

describe('limites e validação (400, nada gravado)', () => {
  it('sem dias, com dia repetido, data ou hora inválida e acima do limite de 14', async () => {
    const antes = await quantosEm(comA)
    const dia = (n: number) => `2027-02-${String(n).padStart(2, '0')}`
    const casos: Record<string, unknown[]> = {
      'sem dias': [],
      'dia repetido': [
        { data: dia(1), hora: '16:00' },
        { data: dia(1), hora: '18:00' },
      ],
      'data inválida': [{ data: '2027-02-30', hora: '16:00' }],
      'hora inválida': [{ data: dia(1), hora: '25:00' }],
      'quinze dias': Array.from({ length: 15 }, (_, i) => ({ data: dia(i + 1), hora: '16:00' })),
    }
    for (const [nome, dias] of Object.entries(casos)) {
      const r = await emLote(comA, orgA, { ...base, dias })
      expect(r.statusCode, nome).toBe(400)
    }
    expect(await quantosEm(comA)).toBe(antes)
  })

  it('catorze dias é o limite e passa', async () => {
    const dia = (n: number) => `2027-03-${String(n).padStart(2, '0')}`
    const r = await emLote(comA, orgA, {
      ...base,
      dias: Array.from({ length: 14 }, (_, i) => ({ data: dia(i + 1), hora: '16:00' })),
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().eventos).toHaveLength(14)
  })

  it('título curto demais é recusado', async () => {
    const r = await emLote(comA, orgA, {
      ...base,
      titulo: 'A',
      dias: [{ data: '2027-04-03', hora: '16:00' }],
    })
    expect(r.statusCode).toBe(400)
  })
})

describe('tudo ou nada', () => {
  it('um modelo que não existe na comunidade (404) não cria nenhum dia', async () => {
    const antes = await quantosEm(comA)
    const r = await emLote(comA, orgA, {
      categoria: 'Encontro',
      modelo: '00000000-0000-4000-8000-000000000000',
      dias: [
        { data: '2027-05-01', hora: '16:00' },
        { data: '2027-05-02', hora: '16:00' },
      ],
    })
    expect(r.statusCode).toBe(404)
    expect(await quantosEm(comA)).toBe(antes)
  })

  it('um local de outra comunidade derruba o lote inteiro', async () => {
    const antes = await quantosEm(comA)
    const r = await emLote(comA, orgA, {
      ...base,
      localId: localDeB,
      dias: [
        { data: '2027-06-05', hora: '16:00' },
        { data: '2027-06-06', hora: '16:00' },
      ],
    })
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect(r.statusCode).toBeLessThan(500)
    expect(await quantosEm(comA)).toBe(antes)
  })
})

describe('isolamento entre comunidades', () => {
  it('a organização de A não cria na comunidade B (404), e B segue intacta', async () => {
    const antes = await quantosEm(comB)
    const r = await emLote(comB, orgA, { ...base, dias: [{ data: '2027-07-03', hora: '16:00' }] })
    expect(r.statusCode).toBe(404)
    expect(await quantosEm(comB)).toBe(antes)
  })

  it('o lote de B nasce só em B', async () => {
    const antesA = await quantosEm(comA)
    const r = await emLote(comB, orgB, { ...base, dias: [{ data: '2027-07-10', hora: '16:00' }] })
    expect(r.statusCode).toBe(200)
    expect(await quantosEm(comA)).toBe(antesA)
    expect(await quantosEm(comB)).toBe(1)
  })
})
