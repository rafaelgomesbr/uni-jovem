import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Caixa de entrada do sino (D42, migração 0020): lista paginada da conta por
 * cursor opaco, contador de não lidas, marcar uma e todas como lidas, e o
 * isolamento (só as próprias, só das comunidades com vínculo ativo).
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let org: Pessoa
let ana: Pessoa
let bruno: Pessoa
let carla: Pessoa

const CAIXA = '/api/v1/eu/notificacoes/caixa'

interface Item {
  id: string
  tipo: string
  titulo: string
  texto: string
  comunidade: { id: string; nome: string }
  destino: { tela: string; avisoId?: string; eventoId?: string } | null
  assunto: string | null
  eventoId: string | null
  lida: boolean
  lidaEm: string | null
  criadoEm: string
}

type Metodo = 'GET' | 'POST'
const req = (metodo: Metodo, url: string, p: Pessoa, corpo?: object) =>
  app.inject({ method: metodo, url, headers: p.auth, ...(corpo ? { payload: corpo } : {}) })

async function pagina(p: Pessoa, cursor?: string) {
  const r = await req('GET', cursor ? `${CAIXA}?cursor=${encodeURIComponent(cursor)}` : CAIXA, p)
  expect(r.statusCode).toBe(200)
  return r.json() as { notificacoes: Item[]; proximoCursor: string | null }
}

async function todas(p: Pessoa): Promise<Item[]> {
  const itens: Item[] = []
  let cursor: string | undefined
  for (let i = 0; i < 20; i++) {
    const r = await pagina(p, cursor)
    itens.push(...r.notificacoes)
    if (!r.proximoCursor) return itens
    cursor = r.proximoCursor
  }
  throw new Error('Paginação sem fim')
}

async function naoLidas(p: Pessoa): Promise<number> {
  const r = await req('GET', `${CAIXA}/nao-lidas`, p)
  expect(r.statusCode).toBe(200)
  return (r.json() as { naoLidas: number }).naoLidas
}

/** Notificação gravada direto (como o gatilho grava), no instante pedido. */
async function semear(conta: string, comunidade: string, criadoEm: Date): Promise<string> {
  const { rows } = await b.su.query<{ id: string }>(
    `insert into uj.notificacoes (comunidade_id, conta_id, tipo, recurso_tipo, recurso_id, titulo,
                                  corpo, chave_dedup, criado_em)
     values ($1, $2, 'escalas', 'atribuicao', $3, 'Nova escala',
             'Você foi escalado para um evento. Abra o app para confirmar.', $4, $5)
     returning id`,
    [comunidade, conta, randomUUID(), randomUUID(), criadoEm],
  )
  return rows[0]!.id
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
  org = await pessoaComSessao(b, app, config, 'Organizadora')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  bruno = await pessoaComSessao(b, app, config, 'Bruno')
  carla = await pessoaComSessao(b, app, config, 'Carla')
  await vincular(b, org.id, comA, 'organizador')
  await vincular(b, org.id, comB, 'organizador')
  await vincular(b, ana.id, comA, 'membro')
  await vincular(b, bruno.id, comB, 'membro')
  await vincular(b, carla.id, comA, 'membro')
  await vincular(b, carla.id, comB, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('caixa de entrada', () => {
  it('sem sessão: 401', async () => {
    const r = await app.inject({ method: 'GET', url: CAIXA })
    expect(r.statusCode).toBe(401)
  })

  it('aviso publicado aparece com texto genérico, comunidade e destino', async () => {
    const r = await req('POST', `/api/v1/c/${comA}/avisos`, org, {
      titulo: 'Oração pela saúde da Maria',
      texto: 'Texto sigiloso com o telefone 11 91234-5678',
      publicar: true,
    })
    expect(r.statusCode).toBe(200)
    const avisoId = r.json().id as string

    const { notificacoes, proximoCursor } = await pagina(ana)
    expect(proximoCursor).toBeNull()
    expect(notificacoes).toHaveLength(1)
    const [n] = notificacoes
    expect(n).toMatchObject({
      tipo: 'avisos',
      titulo: 'Novo aviso',
      comunidade: { id: comA, nome: 'Jovens do Vale' },
      destino: { tela: 'aviso', avisoId },
      lida: false,
      lidaEm: null,
    })
    // D66: dentro do app, o sino mostra o título real do aviso (`assunto`); o texto que
    // sai para a tela bloqueada segue genérico e o CORPO do aviso nunca chega à caixa.
    expect(n!.assunto).toBe('Oração pela saúde da Maria')
    expect(JSON.stringify([n!.titulo, n!.texto])).not.toMatch(/Maria|sigiloso|91234/)
    expect(JSON.stringify(notificacoes)).not.toMatch(/sigiloso|91234/)
    // Quem publicou não é avisado; quem é só de B também não.
    expect((await pagina(org)).notificacoes).toHaveLength(0)
    expect((await pagina(bruno)).notificacoes).toHaveLength(0)
    expect(await naoLidas(ana)).toBe(1)

    // Tirado do ar: o destino vira a lista de avisos.
    const fora = await req('POST', `/api/v1/c/${comA}/avisos/${avisoId}/despublicar`, org)
    expect(fora.statusCode).toBe(200)
    expect((await pagina(ana)).notificacoes[0]!.destino).toEqual({ tela: 'avisos' })
  })

  it('pagina de 20 em 20, da mais nova para a mais antiga, sem repetir nem pular', async () => {
    // 45 notificações da Carla nas duas comunidades, com empates de instante
    // (três por milissegundo) para exercitar o desempate pelo id.
    // A Carla também é de A: já tem o aviso do teste anterior.
    const existentes = (await todas(carla)).map((n) => n.id)
    expect(existentes).toHaveLength(1)
    const base = Date.parse('2026-11-10T12:00:00.000Z')
    const semeadas: string[] = []
    for (let i = 0; i < 45; i++) {
      const instante = new Date(base + Math.floor(i / 3) * 60_000)
      semeadas.push(await semear(carla.id, i % 2 ? comA : comB, instante))
    }

    const p1 = await pagina(carla)
    expect(p1.notificacoes).toHaveLength(20)
    expect(p1.proximoCursor).toEqual(expect.any(String))
    // O cursor não expõe o id nem o instante em claro.
    expect(p1.proximoCursor).not.toContain(p1.notificacoes[19]!.id)

    const lista = await todas(carla)
    expect(lista).toHaveLength(46)
    expect(new Set(lista.map((n) => n.id))).toEqual(new Set([...existentes, ...semeadas]))
    for (let i = 1; i < lista.length; i++) {
      const antes = Date.parse(lista[i - 1]!.criadoEm)
      const agora = Date.parse(lista[i]!.criadoEm)
      expect(antes).toBeGreaterThanOrEqual(agora)
      if (antes === agora) expect(lista[i - 1]!.id > lista[i]!.id).toBe(true)
    }
    expect(lista.filter((n) => n.destino?.tela === 'escalas')).toHaveLength(45)
    expect(new Set(lista.map((n) => n.comunidade.nome))).toEqual(
      new Set(['Jovens do Vale', 'Jovens da Serra']),
    )
  })

  it('notificação nova entre páginas não faz a próxima repetir nem pular', async () => {
    const p1 = await pagina(carla)
    await semear(carla.id, comA, new Date('2026-11-14T12:00:00.000Z'))
    const resto: Item[] = []
    let cursor = p1.proximoCursor
    while (cursor) {
      const p = await pagina(carla, cursor)
      resto.push(...p.notificacoes)
      cursor = p.proximoCursor
    }
    const ids = [...p1.notificacoes, ...resto].map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(46)
  })

  it('cursor inválido: 400 com mensagem humana', async () => {
    for (const cursor of ['nada', Buffer.from('1:xyz').toString('base64url'), 'a'.repeat(200)]) {
      const r = await req('GET', `${CAIXA}?cursor=${cursor}`, carla)
      expect(r.statusCode).toBe(400)
    }
  })

  it('marca uma como lida (idempotente) e todas como lidas', async () => {
    const total = await naoLidas(carla)
    expect(total).toBe(47)
    const [primeira] = (await pagina(carla)).notificacoes
    expect((await req('POST', `${CAIXA}/${primeira!.id}/lida`, carla)).statusCode).toBe(200)
    expect((await req('POST', `${CAIXA}/${primeira!.id}/lida`, carla)).statusCode).toBe(200)
    expect(await naoLidas(carla)).toBe(total - 1)
    const marcada = (await pagina(carla)).notificacoes.find((n) => n.id === primeira!.id)
    expect(marcada).toMatchObject({ lida: true, lidaEm: expect.any(String) })

    const r = await req('POST', `${CAIXA}/lidas`, carla)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ marcadas: total - 1 })
    expect(await naoLidas(carla)).toBe(0)
    expect((await todas(carla)).every((n) => n.lida)).toBe(true)
  })
})

describe('isolamento da caixa', () => {
  it('a conta A não lê nem marca a notificação da B (404, e a de B fica intacta)', async () => {
    const deBruno = await semear(bruno.id, comB, new Date())
    expect((await todas(ana)).map((n) => n.id)).not.toContain(deBruno)
    expect((await req('POST', `${CAIXA}/${deBruno}/lida`, ana)).statusCode).toBe(404)
    // Nem quem é da mesma comunidade (Carla, em B) marca a do Bruno.
    expect((await req('POST', `${CAIXA}/${deBruno}/lida`, carla)).statusCode).toBe(404)
    // "Marcar todas" da Ana não toca na do Bruno.
    expect((await req('POST', `${CAIXA}/lidas`, ana)).statusCode).toBe(200)
    expect(await naoLidas(bruno)).toBe(1)
    const dele = (await todas(bruno)).find((n) => n.id === deBruno)
    expect(dele?.lida).toBe(false)
    // Id inexistente e id que não é UUID: o mesmo 404.
    expect((await req('POST', `${CAIXA}/${randomUUID()}/lida`, ana)).statusCode).toBe(404)
    expect((await req('POST', `${CAIXA}/123/lida`, ana)).statusCode).toBe(404)
  })

  it('direto no banco: o papel da API só vê as próprias e só grava lida_em', async () => {
    const deAna = await b.comoApi<{ id: string }>(
      { contaId: ana.id, comunidadeId: null },
      'select id from uj.notificacoes',
    )
    const doBanco = await b.su.query<{ id: string }>(
      'select id from uj.notificacoes where conta_id = $1',
      [ana.id],
    )
    expect(deAna.map((r) => r.id).sort()).toEqual(doBanco.rows.map((r) => r.id).sort())
    await expect(
      b.comoApi({ contaId: ana.id, comunidadeId: null }, "update uj.notificacoes set titulo = 'x'"),
    ).rejects.toThrow(/permission denied|permissão negada/)
    // Sem conta no contexto, nada.
    expect(
      await b.comoApi({ contaId: null, comunidadeId: null }, 'select id from uj.notificacoes'),
    ).toEqual([])
  })

  it('vínculo desativado: as notificações daquela comunidade somem da lista e do contador', async () => {
    const deB = await semear(carla.id, comB, new Date())
    const deA = await semear(carla.id, comA, new Date())
    expect(await naoLidas(carla)).toBe(2)
    await b.su.query(
      "update uj.vinculos set estado = 'desativado' where conta_id = $1 and comunidade_id = $2",
      [carla.id, comB],
    )
    const lista = await todas(carla)
    expect(lista.map((n) => n.id)).toContain(deA)
    expect(lista.map((n) => n.id)).not.toContain(deB)
    expect(lista.every((n) => n.comunidade.id === comA)).toBe(true)
    expect(await naoLidas(carla)).toBe(1)
    expect((await req('POST', `${CAIXA}/${deB}/lida`, carla)).statusCode).toBe(404)
    await b.su.query(
      "update uj.vinculos set estado = 'ativo' where conta_id = $1 and comunidade_id = $2",
      [carla.id, comB],
    )
  })

  it('ao sair da comunidade, as notificações dela somem', async () => {
    const deB = await semear(carla.id, comB, new Date())
    expect((await todas(carla)).map((n) => n.id)).toContain(deB)
    expect((await req('POST', `/api/v1/c/${comB}/sair`, carla)).statusCode).toBe(200)
    const lista = await todas(carla)
    expect(lista.map((n) => n.id)).not.toContain(deB)
    expect(lista.every((n) => n.comunidade.id === comA)).toBe(true)
  })
})
