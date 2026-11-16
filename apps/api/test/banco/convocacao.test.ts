import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Convocação (D54, migração 0023): o texto novo do aviso a quem é convocado,
 * o aviso de recusa à organização (só organizadores e admins ativos da
 * comunidade do fato, respeitando a preferência) e a convocação que espera
 * resposta primeiro no Início.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let orgA: Pessoa
let adminA: Pessoa
let ana: Pessoa
let bia: Pessoa
let orgB: Pessoa
let beto: Pessoa
/** Membro em A e organizadora em B: o aviso de A nunca pode chegar a ela. */
let dupla: Pessoa
const v: Record<string, string> = {}

const RECUSA = {
  titulo: 'Convocação recusada',
  corpo: 'Alguém não pode servir num encontro. Toque para convocar outra pessoa.',
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE'
const req = (metodo: Metodo, com: string, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

let dias = 3
async function novoEvento(
  com: string,
  org: Pessoa,
  publicar = true,
): Promise<{ eventoId: string; inicio: string }> {
  // Um dia diferente por evento: nada colide com a deduplicação de 1 h.
  const inicio = new Date(Date.now() + dias++ * 86_400_000).toISOString()
  const r = await req('POST', com, '/eventos', org, {
    titulo: 'Sábado com a juventude',
    categoria: 'Programação de sábado',
    inicio,
    duracaoMin: 120,
  })
  expect(r.statusCode).toBe(200)
  const eventoId = r.json().id as string
  if (publicar) {
    const p = await req('POST', com, `/eventos/${eventoId}/status`, org, { status: 'publicado' })
    expect(p.statusCode).toBe(200)
  }
  return { eventoId, inicio }
}

async function convocar(
  com: string,
  org: Pessoa,
  eventoId: string,
  vinculoId: string,
): Promise<string> {
  const r = await req('POST', com, `/eventos/${eventoId}/atribuicoes`, org, { vinculoId })
  expect(r.statusCode).toBe(200)
  return r.json().id as string
}

async function avisosDeRecusa(eventoId: string) {
  return (
    await b.su.query<{
      conta_id: string
      comunidade_id: string
      tipo: string
      recurso_tipo: string
      titulo: string
      corpo: string
    }>(
      `select conta_id, comunidade_id, tipo, recurso_tipo, titulo, corpo from uj.notificacoes
        where recurso_id = $1 and titulo = $2`,
      [eventoId, RECUSA.titulo],
    )
  ).rows
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
  adminA = await pessoaComSessao(b, app, config, 'Abel')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  bia = await pessoaComSessao(b, app, config, 'Bia')
  orgB = await pessoaComSessao(b, app, config, 'Otto')
  beto = await pessoaComSessao(b, app, config, 'Beto')
  dupla = await pessoaComSessao(b, app, config, 'Duda')
  await vincular(b, orgA.id, comA, 'organizador')
  await vincular(b, adminA.id, comA, 'admin')
  v['ana'] = await vincular(b, ana.id, comA, 'membro')
  v['bia'] = await vincular(b, bia.id, comA, 'membro')
  v['duplaA'] = await vincular(b, dupla.id, comA, 'membro')
  await vincular(b, orgB.id, comB, 'organizador')
  await vincular(b, dupla.id, comB, 'organizador')
  v['beto'] = await vincular(b, beto.id, comB, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('aviso a quem é convocado', () => {
  it('evento publicado: "Nova convocação", sem nome nem título do evento', async () => {
    const { eventoId } = await novoEvento(comA, orgA)
    const id = await convocar(comA, orgA, eventoId, v['bia']!)
    const { rows } = await b.su.query<{ titulo: string; corpo: string; tipo: string }>(
      'select titulo, corpo, tipo from uj.notificacoes where conta_id = $1 and recurso_id = $2',
      [bia.id, id],
    )
    expect(rows).toEqual([
      {
        titulo: 'Nova convocação',
        corpo: 'Você foi convocado para servir. Abra o app para responder.',
        tipo: 'escalas',
      },
    ])
  })

  it('rascunho: só avisa ao publicar, com o mesmo texto', async () => {
    const { eventoId } = await novoEvento(comA, orgA, false)
    const id = await convocar(comA, orgA, eventoId, v['bia']!)
    const antes = await b.su.query('select 1 from uj.notificacoes where recurso_id = $1', [id])
    expect(antes.rows).toEqual([])
    await req('POST', comA, `/eventos/${eventoId}/status`, orgA, { status: 'publicado' })
    const depois = await b.su.query<{ titulo: string }>(
      'select titulo from uj.notificacoes where conta_id = $1 and recurso_id = $2',
      [bia.id, id],
    )
    expect(depois.rows).toEqual([{ titulo: 'Nova convocação' }])
  })
})

describe('"Não posso ir" avisa a organização', () => {
  it('organizadora e admin da comunidade recebem; membros e quem recusou, não', async () => {
    const { eventoId } = await novoEvento(comA, orgA)
    const id = await convocar(comA, orgA, eventoId, v['ana']!)
    // A organização ainda não foi avisada de nada sobre este encontro.
    expect(await avisosDeRecusa(eventoId)).toEqual([])
    const r = await req('POST', comA, `/atribuicoes/${id}/recusar`, ana)
    expect(r.json()).toEqual({ estado: 'recusada' })

    const avisos = await avisosDeRecusa(eventoId)
    expect(avisos.map((a) => a.conta_id).sort()).toEqual([orgA.id, adminA.id].sort())
    for (const a of avisos) {
      expect(a).toMatchObject({
        comunidade_id: comA,
        tipo: 'escalas',
        recurso_tipo: 'evento',
        ...RECUSA,
      })
    }
    // Texto genérico (NOT-02): nem o nome de quem recusou, nem o título do encontro.
    const bruto = JSON.stringify(avisos)
    for (const proibido of ['Ana', 'Sábado', 'juventude', 'Vale']) {
      expect(bruto).not.toContain(proibido)
    }
    // A dupla é organizadora em B, mas só membro em A: não recebe.
    for (const p of [ana, bia, dupla, orgB, beto]) {
      expect(avisos.some((a) => a.conta_id === p.id)).toBe(false)
    }
  })

  it('o toque abre o encontro na caixa do sino da organização', async () => {
    const { eventoId } = await novoEvento(comA, orgA)
    const id = await convocar(comA, orgA, eventoId, v['ana']!)
    await req('POST', comA, `/atribuicoes/${id}/recusar`, ana)
    const caixa = await app.inject({
      method: 'GET',
      url: '/api/v1/eu/notificacoes/caixa',
      headers: adminA.auth,
    })
    expect(caixa.statusCode).toBe(200)
    const item = caixa
      .json()
      .notificacoes.find(
        (n: { titulo: string; destino: { eventoId?: string } | null }) =>
          n.titulo === RECUSA.titulo && n.destino?.eventoId === eventoId,
      )
    expect(item).toMatchObject({
      tipo: 'escalas',
      texto: RECUSA.corpo,
      destino: { tela: 'evento', eventoId },
    })
  })

  it('aceitar não avisa a organização', async () => {
    const { eventoId } = await novoEvento(comA, orgA)
    const id = await convocar(comA, orgA, eventoId, v['ana']!)
    expect((await req('POST', comA, `/atribuicoes/${id}/confirmar`, ana)).statusCode).toBe(200)
    expect(await avisosDeRecusa(eventoId)).toEqual([])
  })

  it('respeita a preferência: quem desligou "Escalas" naquela comunidade não recebe', async () => {
    const desligar = await req('PUT', comA, '/notificacoes/preferencias', adminA, {
      tipos: { escalas: false },
    })
    expect(desligar.statusCode).toBe(200)
    try {
      const { eventoId } = await novoEvento(comA, orgA)
      const id = await convocar(comA, orgA, eventoId, v['ana']!)
      await req('POST', comA, `/atribuicoes/${id}/recusar`, ana)
      expect((await avisosDeRecusa(eventoId)).map((a) => a.conta_id)).toEqual([orgA.id])
    } finally {
      await req('PUT', comA, '/notificacoes/preferencias', adminA, { tipos: { escalas: true } })
    }
  })

  it('rascunho não avisa (ninguém foi convocado de verdade ainda)', async () => {
    const { eventoId } = await novoEvento(comA, orgA, false)
    const id = await convocar(comA, orgA, eventoId, v['ana']!)
    await req('POST', comA, `/atribuicoes/${id}/recusar`, ana)
    expect(await avisosDeRecusa(eventoId)).toEqual([])
  })

  it('vínculo encerrado não recebe', async () => {
    const saiu = await pessoaComSessao(b, app, config, 'Saulo')
    const vinculo = await vincular(b, saiu.id, comA, 'organizador')
    await b.su.query("update uj.vinculos set estado = 'removido' where id = $1", [vinculo])
    const { eventoId } = await novoEvento(comA, orgA)
    const id = await convocar(comA, orgA, eventoId, v['ana']!)
    await req('POST', comA, `/atribuicoes/${id}/recusar`, ana)
    const avisos = await avisosDeRecusa(eventoId)
    expect(avisos.length).toBeGreaterThan(0)
    expect(avisos.some((a) => a.conta_id === saiu.id)).toBe(false)
  })
})

describe('isolamento entre comunidades', () => {
  it('recusa em B avisa só a organização de B; A não recebe nada', async () => {
    const { eventoId } = await novoEvento(comB, orgB)
    const id = await convocar(comB, orgB, eventoId, v['beto']!)
    expect((await req('POST', comB, `/atribuicoes/${id}/recusar`, beto)).statusCode).toBe(200)
    const avisos = await avisosDeRecusa(eventoId)
    expect(avisos.map((a) => a.conta_id).sort()).toEqual([orgB.id, dupla.id].sort())
    expect(avisos.every((a) => a.comunidade_id === comB)).toBe(true)
    for (const p of [orgA, adminA, ana, bia]) {
      expect(avisos.some((a) => a.conta_id === p.id)).toBe(false)
    }
  })

  it('ninguém de A recusa a convocação de B trocando o id: 404 e nenhum aviso', async () => {
    const { eventoId } = await novoEvento(comB, orgB)
    const idDeB = await convocar(comB, orgB, eventoId, v['beto']!)
    // Id de B na URL de A (a Ana é de A).
    expect((await req('POST', comA, `/atribuicoes/${idDeB}/recusar`, ana)).statusCode).toBe(404)
    // A comunidade B na URL, sem vínculo nela.
    expect((await req('POST', comB, `/atribuicoes/${idDeB}/recusar`, ana)).statusCode).toBe(404)
    // A organizadora de A, que organiza mas não é a convocada.
    expect((await req('POST', comA, `/atribuicoes/${idDeB}/recusar`, orgA)).statusCode).toBe(404)
    const { rows } = await b.su.query('select estado from uj.atribuicoes where id = $1', [idDeB])
    expect(rows).toEqual([{ estado: 'pendente' }])
    expect(await avisosDeRecusa(eventoId)).toEqual([])
  })

  it('a organização de A não vê na caixa o aviso de recusa de B', async () => {
    const caixa = await app.inject({
      method: 'GET',
      url: '/api/v1/eu/notificacoes/caixa',
      headers: orgA.auth,
    })
    const deB = caixa
      .json()
      .notificacoes.filter((n: { comunidade: { id: string } }) => n.comunidade.id === comB)
    expect(deB).toEqual([])
    // Pela RLS, nem lendo direto a tabela no contexto de A.
    const linhas = await b.comoApi(
      { contaId: orgA.id, comunidadeId: comA },
      'select comunidade_id from uj.notificacoes where comunidade_id = $1',
      [comB],
    )
    expect(linhas).toEqual([])
  })
})

describe('Início', () => {
  it('a convocação que espera resposta vem primeiro, mesmo sendo mais tarde', async () => {
    const lia = await pessoaComSessao(b, app, config, 'Lia')
    const vinculo = await vincular(b, lia.id, comA, 'membro')
    const cedo = await novoEvento(comA, orgA)
    const tarde = await novoEvento(comA, orgA)
    const aceita = await convocar(comA, orgA, cedo.eventoId, vinculo)
    const pendente = await convocar(comA, orgA, tarde.eventoId, vinculo)
    await req('POST', comA, `/atribuicoes/${aceita}/confirmar`, lia)
    const inicio = (await req('GET', comA, '/inicio', lia)).json()
    expect(inicio.minhasEscalas[0]).toMatchObject({ id: pendente, estado: 'pendente' })
    expect(inicio.minhasEscalas.some((e: { id: string }) => e.id === aceita)).toBe(true)
  })
})
