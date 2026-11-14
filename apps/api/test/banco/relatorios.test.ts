import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Relatórios e exportações (F16): números conferidos contra um cenário
 * montado à mão, CSV sem contatos para organizador, link com token, validade
 * de 24 h (vencida = 404), auditoria sem conteúdo e isolamento por comunidade.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let comB: string
let admin: Pessoa
let admin2: Pessoa
let org: Pessoa
let org2: Pessoa
let ana: Pessoa
let bia: Pessoa
const v: Record<string, string> = {}
const ev: Record<string, string> = {}

const TELEFONE_PUBLICO = '+5511987654321'
const EMAIL_PUBLICO = 'carla@exemplo.test'
const WHATSAPP_DA_ANA = '+5511911112222'

// Período que cobre o evento passado e o futuro (o padrão termina hoje).
const dia = (deslocamento: number) =>
  new Date(Date.now() + deslocamento * 86_400_000).toISOString().slice(0, 10)
const PERIODO = { de: dia(-30), ate: dia(30) }
const NO_PERIODO = `?de=${PERIODO.de}&ate=${PERIODO.ate}`

type Metodo = 'GET' | 'POST' | 'DELETE'
const req = (metodo: Metodo, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

async function um(sql: string, params: unknown[]): Promise<string> {
  return (await b.dono.query<{ id: string }>(sql, params)).rows[0]!.id
}

async function evento(
  comunidade: string,
  titulo: string,
  quando: string,
  status: string,
  criador: string,
): Promise<string> {
  return um(
    `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status, capacidade)
     values ($1, $2, 'Culto', now() + $3::interval, 90, 'America/Sao_Paulo', $4, $5, 10) returning id`,
    [comunidade, titulo, quando, criador, status],
  )
}

async function inscricaoPublica(
  eventoId: string,
  nome: string,
  telefone: string | null,
  estado: string,
  email: string | null = null,
  comunidade = com,
): Promise<string> {
  return um(
    `insert into uj.inscricoes (comunidade_id, evento_id, origem, nome, telefone, email, estado, consentimento_em, cancelada_em)
     values ($1, $2, 'publica', $3, $4, $5, $6, now(), case when $6 = 'cancelada' then now() end) returning id`,
    [comunidade, eventoId, nome, telefone, email, estado],
  )
}

async function presenca(
  eventoId: string,
  dados: { inscricao?: string; vinculo?: string; avulso?: string },
): Promise<void> {
  await um(
    `insert into uj.presencas (comunidade_id, evento_id, inscricao_id, vinculo_id, nome_avulso, origem, registrada_por, chave_idempotencia)
     values ($1, $2, $3, $4, $5, 'qr', $6, gen_random_uuid()) returning id`,
    [com, eventoId, dados.inscricao ?? null, dados.vinculo ?? null, dados.avulso ?? null, v['org']],
  )
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
  com = await criarComunidade(b, 'Jovens Relatórios')
  comB = await criarComunidade(b, 'Comunidade B')
  admin = await pessoaComSessao(b, app, config, 'Admin')
  admin2 = await pessoaComSessao(b, app, config, 'Admin Dois')
  org = await pessoaComSessao(b, app, config, 'Organizadora')
  org2 = await pessoaComSessao(b, app, config, 'Organizador Dois')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  bia = await pessoaComSessao(b, app, config, 'Bia')
  v['admin'] = await vincular(b, admin.id, com, 'admin')
  v['admin2'] = await vincular(b, admin2.id, com, 'admin')
  v['org'] = await vincular(b, org.id, com, 'organizador')
  v['org2'] = await vincular(b, org2.id, com, 'organizador')
  v['ana'] = await vincular(b, ana.id, com, 'membro')
  v['bia'] = await vincular(b, bia.id, com, 'membro')
  await b.su.query('update uj.contas set whatsapp = $2 where id = $1', [ana.id, WHATSAPP_DA_ANA])

  // E1: realizado há 2 dias, com inscrições, presença e escala.
  ev['e1'] = await evento(com, 'Culto jovem', '-2 days', 'publicado', org.id)
  const carla = await inscricaoPublica(
    ev['e1'],
    'Carla Pública',
    TELEFONE_PUBLICO,
    'confirmada',
    EMAIL_PUBLICO,
  )
  await inscricaoPublica(ev['e1'], 'Davi Público', '+5511900001111', 'confirmada')
  await inscricaoPublica(ev['e1'], 'Eva Espera', '+5511900002222', 'espera')
  await inscricaoPublica(ev['e1'], 'Fábio Cancelou', '+5511900003333', 'cancelada')
  await inscricaoPublica(ev['e1'], '=HYPERLINK("http://x")', null, 'confirmada')
  const inscricaoDaAna = await um(
    `insert into uj.inscricoes (comunidade_id, evento_id, origem, vinculo_id, nome, estado)
     values ($1, $2, 'membro', $3, 'Ana', 'confirmada') returning id`,
    [com, ev['e1'], v['ana']],
  )
  await presenca(ev['e1'], { inscricao: carla })
  await presenca(ev['e1'], { inscricao: inscricaoDaAna, vinculo: v['ana'] })
  await presenca(ev['e1'], { vinculo: v['bia'] })
  await presenca(ev['e1'], { avulso: 'Visitante' })

  const atrib = (vinculo: string, funcao: string, estado: string) =>
    um(
      'insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id, funcao, estado) values ($1, $2, $3, $4, $5) returning id',
      [com, ev['e1'], vinculo, funcao, estado],
    )
  await atrib(v['ana']!, 'louvor', 'confirmada')
  const assumida = await atrib(v['ana']!, 'recepção', 'confirmada')
  await atrib(v['org']!, 'som', 'pendente')
  await atrib(v['bia']!, 'lanche', 'recusada')
  await um(
    `insert into uj.substituicoes (comunidade_id, atribuicao_id, pedida_por, estado, assumida_por, resolvida_em)
     values ($1, $2, $3, 'assumida', $4, now()) returning id`,
    [com, assumida, v['bia'], v['ana']],
  )

  // E2: futuro; E3: cancelado (fora dos relatórios de presença).
  ev['e2'] = await evento(com, 'Retiro', '5 days', 'publicado', org.id)
  await inscricaoPublica(ev['e2'], 'Gabi Futura', '+5511900004444', 'confirmada')
  ev['e3'] = await evento(com, 'Cancelado', '-3 days', 'cancelado', org.id)

  // Comunidade B no mesmo período: nada disto pode aparecer em A.
  const adminB = await pessoaComSessao(b, app, config, 'Admin B')
  await vincular(b, adminB.id, comB, 'admin')
  const eB = await evento(comB, 'Evento de B', '-1 days', 'publicado', adminB.id)
  await inscricaoPublica(eB, 'Pessoa de B', '+5511955556666', 'confirmada', null, comB)
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('relatórios', () => {
  it('membro não vê relatório nem exporta', async () => {
    for (const r of ['presenca', 'inscricoes', 'escalas', 'atividade']) {
      expect((await req('GET', `/relatorios/${r}`, ana)).statusCode, r).toBe(403)
    }
    expect((await req('POST', '/exportacoes', ana, { tipo: 'presenca' })).statusCode).toBe(403)
    expect((await req('GET', '/exportacoes', ana)).statusCode).toBe(403)
  })

  it('presença por evento e por período', async () => {
    const r = (await req('GET', `/relatorios/presenca${NO_PERIODO}`, org)).json()
    expect(r.totais).toEqual({ eventos: 2, presentes: 4, mediaPorEvento: 2, membrosDistintos: 2 })
    const e1 = r.porEvento.find((e: { id: string }) => e.id === ev['e1'])
    expect(e1).toMatchObject({
      presentes: 4,
      presentesInscritos: 2,
      presentesMembros: 1,
      presentesSemInscricao: 1,
    })
    expect(r.porEvento.map((e: { titulo: string }) => e.titulo)).not.toContain('Evento de B')
    expect(r.porEvento.map((e: { titulo: string }) => e.titulo)).not.toContain('Cancelado')
    expect(r.porPeriodo.reduce((s: number, p: { presentes: number }) => s + p.presentes, 0)).toBe(4)
    // Filtro de período que não pega nada.
    const vazio = (
      await req('GET', '/relatorios/presenca?de=2020-01-01&ate=2020-01-31', org)
    ).json()
    expect(vazio.totais.eventos).toBe(0)
    // Período invertido ou longo demais: erro claro.
    expect(
      (await req('GET', '/relatorios/presenca?de=2026-02-01&ate=2026-01-01', org)).statusCode,
    ).toBe(400)
    expect(
      (await req('GET', '/relatorios/presenca?de=2020-01-01&ate=2026-01-01', org)).statusCode,
    ).toBe(400)
  })

  it('inscrições versus presença', async () => {
    const r = (await req('GET', `/relatorios/inscricoes${NO_PERIODO}`, org)).json()
    const e1 = r.porEvento.find((e: { id: string }) => e.id === ev['e1'])
    expect(e1).toMatchObject({
      realizado: true,
      confirmadas: 4,
      espera: 1,
      canceladas: 1,
      compareceram: 2,
      faltaram: 2,
      taxaDeComparecimento: 50,
      publicas: 4,
      deMembros: 1,
      presentesSemInscricao: 2,
    })
    const e2 = r.porEvento.find((e: { id: string }) => e.id === ev['e2'])
    expect(e2).toMatchObject({ realizado: false, faltaram: null, taxaDeComparecimento: null })
    expect(r.totais).toMatchObject({
      eventos: 2,
      eventosRealizados: 1,
      confirmadas: 5,
      compareceram: 2,
      faltaram: 2,
      taxaDeComparecimento: 50,
    })
  })

  it('escalas cumpridas e substituições', async () => {
    const r = (await req('GET', `/relatorios/escalas${NO_PERIODO}`, org)).json()
    expect(r.totais).toEqual({
      escalas: 4,
      confirmadas: 2,
      recusadas: 1,
      semResposta: 1,
      substituicaoPedida: 0,
      cumpridas: 2,
      cumpridasComPresenca: 2,
      substituicoesPedidas: 1,
      substituicoesAssumidas: 1,
      substituicoesCanceladas: 0,
      substituicoesAbertas: 0,
    })
    const porNome = Object.fromEntries(
      r.porPessoa.map((p: { nome: string }) => [p.nome, p] as const),
    )
    expect(porNome['Ana']).toMatchObject({ escalas: 2, cumpridas: 2, substituicoesAssumidas: 1 })
    expect(porNome['Bia']).toMatchObject({ escalas: 1, recusadas: 1, substituicoesPedidas: 1 })
  })

  it('atividade no período', async () => {
    const r = (await req('GET', `/relatorios/atividade${NO_PERIODO}`, admin)).json()
    expect(r.atividade).toMatchObject({
      eventosRealizados: 1,
      eventosPrevistos: 1,
      eventosCancelados: 1,
      inscricoes: 7,
      presencas: 4,
      novosVinculos: 6,
      substituicoesPedidas: 1,
    })
  })
})

describe('exportações', () => {
  async function exportar(p: Pessoa, corpo: object) {
    const r = await req('POST', '/exportacoes', p, { ...PERIODO, ...corpo })
    expect(r.statusCode, r.body).toBe(200)
    return r.json() as { id: string; token: string; nomeArquivo: string; linhas: number }
  }
  const baixar = (p: Pessoa, id: string, token: string) =>
    req('POST', `/exportacoes/${id}/arquivo`, p, { token })

  it('organizador exporta sem contatos; com contatos é só para admin', async () => {
    const e = await exportar(org, { tipo: 'inscricoes' })
    expect(e.linhas).toBe(7)
    const r = await baixar(org, e.id, e.token)
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toMatch(/text\/csv/)
    expect(r.headers['content-disposition']).toContain(e.nomeArquivo)
    const csv = r.body
    const cabecalho = csv.split('\r\n')[0]!
    expect(cabecalho).not.toMatch(/Telefone|E-mail|WhatsApp/)
    expect(csv).toContain('Carla Pública')
    expect(csv).not.toContain(TELEFONE_PUBLICO)
    expect(csv).not.toContain('987654321')
    expect(csv).not.toContain(EMAIL_PUBLICO)
    // Isolamento: nada da comunidade B.
    expect(csv).not.toContain('Pessoa de B')
    // Proteção contra fórmula na planilha.
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`)

    const membros = await exportar(org, { tipo: 'membros' })
    const csvMembros = (await baixar(org, membros.id, membros.token)).body
    expect(csvMembros).toContain('Ana')
    expect(csvMembros).not.toContain(WHATSAPP_DA_ANA)
    expect(csvMembros).not.toContain(ana.email)

    expect(
      (await req('POST', '/exportacoes', org, { tipo: 'inscricoes', comContatos: true }))
        .statusCode,
    ).toBe(403)

    const comContatos = await exportar(admin, { tipo: 'inscricoes', comContatos: true })
    const csvAdmin = (await baixar(admin, comContatos.id, comContatos.token)).body
    expect(csvAdmin.split('\r\n')[0]).toMatch(/Telefone;E-mail/)
    expect(csvAdmin).toContain(TELEFONE_PUBLICO)
    expect(csvAdmin).toContain(EMAIL_PUBLICO)
    const membrosAdmin = await exportar(admin, { tipo: 'membros', comContatos: true })
    const csvMembrosAdmin = (await baixar(admin, membrosAdmin.id, membrosAdmin.token)).body
    expect(csvMembrosAdmin).toContain(WHATSAPP_DA_ANA)
    expect(csvMembrosAdmin).toContain(ana.email)
  })

  it('presença e escalas também exportam, sem dados de outra comunidade', async () => {
    const p = await exportar(org, { tipo: 'presenca' })
    expect(p.linhas).toBe(4)
    const csv = (await baixar(org, p.id, p.token)).body
    expect(csv).toContain('Visitante')
    expect(csv).not.toContain(TELEFONE_PUBLICO)
    const e = await exportar(org, { tipo: 'escalas' })
    expect(e.linhas).toBe(4)
    const csvEscalas = (await baixar(org, e.id, e.token)).body
    // A escala assumida diz no lugar de quem.
    expect(csvEscalas).toMatch(/recepção;Ana;confirmada;Bia/)
  })

  it('o link exige o token certo e a dona; cada geração e download vai para a auditoria sem o conteúdo', async () => {
    const e = await exportar(org, { tipo: 'inscricoes' })
    expect((await baixar(org, e.id, 'token-errado-mas-com-formato-valido-123')).statusCode).toBe(
      404,
    )
    expect((await baixar(org, e.id, 'curto')).statusCode).toBe(404)
    // Outro organizador, mesmo com o token, não baixa a exportação alheia.
    expect((await baixar(org2, e.id, e.token)).statusCode).toBe(404)
    expect((await baixar(admin, e.id, e.token)).statusCode).toBe(404)
    expect((await baixar(org, e.id, e.token)).statusCode).toBe(200)

    const lista = (await req('GET', '/exportacoes', org)).json().exportacoes
    const minha = lista.find((x: { id: string }) => x.id === e.id)
    expect(minha).toMatchObject({ tipo: 'inscricoes', comContatos: false, downloads: 1 })
    expect(JSON.stringify(lista)).not.toContain(e.token)
    expect((await req('GET', '/exportacoes', org2)).json().exportacoes).toEqual([])

    const aud = await b.su.query<{ acao: string; detalhes: Record<string, unknown> }>(
      "select acao, detalhes from uj.auditoria where recurso_id = $1 and acao like 'exportacao.%' order by id",
      [e.id],
    )
    expect(aud.rows.map((r) => r.acao)).toEqual(['exportacao.gerada', 'exportacao.baixada'])
    expect(aud.rows[0]!.detalhes).toMatchObject({
      tipo: 'inscricoes',
      comContatos: false,
      linhas: 7,
    })
    const tudo = JSON.stringify(aud.rows)
    expect(tudo).not.toContain('Carla')
    expect(tudo).not.toContain(e.token)
    // O banco guarda só o hash do token.
    const { rows } = await b.su.query<{ t: string }>(
      'select encode(token_hash, $2) as t from uj.exportacoes where id = $1',
      [e.id, 'escape'],
    )
    expect(rows[0]!.t).not.toContain(e.token)
  })

  it('vencida (24 h) responde 404, some da lista e é apagada', async () => {
    const e = await exportar(org, { tipo: 'presenca' })
    const { rows } = await b.su.query<{ horas: number }>(
      'select extract(epoch from expira_em - criado_em) / 3600 as horas from uj.exportacoes where id = $1',
      [e.id],
    )
    expect(Number(rows[0]!.horas)).toBe(24)
    await b.su.query(
      "update uj.exportacoes set criado_em = now() - interval '25 hours', expira_em = now() - interval '1 hour' where id = $1",
      [e.id],
    )
    expect((await baixar(org, e.id, e.token)).statusCode).toBe(404)
    // Direto no banco, como a dona: a política já esconde a vencida.
    expect(
      await b.comoApi(
        { contaId: org.id, comunidadeId: com },
        'select id from uj.exportacoes where id = $1',
        [e.id],
      ),
    ).toEqual([])
    const lista = (await req('GET', '/exportacoes', org)).json().exportacoes
    expect(lista.map((x: { id: string }) => x.id)).not.toContain(e.id)
    const resto = await b.su.query('select count(*)::int as n from uj.exportacoes where id = $1', [
      e.id,
    ])
    expect(resto.rows[0].n).toBe(0)
  })

  it('admin rebaixado deixa de baixar a exportação com contatos', async () => {
    const e = await exportar(admin2, { tipo: 'membros', comContatos: true })
    await b.su.query("update uj.vinculos set papel = 'organizador' where id = $1", [v['admin2']])
    expect((await baixar(admin2, e.id, e.token)).statusCode).toBe(404)
    await b.su.query("update uj.vinculos set papel = 'admin' where id = $1", [v['admin2']])
    expect((await baixar(admin2, e.id, e.token)).statusCode).toBe(200)
  })

  it('a dona exclui a própria exportação', async () => {
    const e = await exportar(org, { tipo: 'membros' })
    expect((await req('DELETE', `/exportacoes/${e.id}`, org2)).statusCode).toBe(404)
    expect((await req('DELETE', `/exportacoes/${e.id}`, org)).json()).toEqual({ ok: true })
    expect((await baixar(org, e.id, e.token)).statusCode).toBe(404)
  })
})
