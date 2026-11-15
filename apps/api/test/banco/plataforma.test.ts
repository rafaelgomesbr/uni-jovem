import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, SENHA_PADRAO, type Pessoa } from '../apoio/pessoas.ts'

/**
 * M1: painel de saúde e auditoria da plataforma (só o Criador, com prova de
 * 2FA recente, como as demais rotas de plataforma: D12 e D31). Também o fuso
 * na criação de comunidade, a lista de intervenção com o nome (sem contato) e
 * a prontidão (`/api/pronto`, M3).
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let criador: Pessoa
let admin: Pessoa
let membro: Pessoa

const req = (metodo: 'GET' | 'POST' | 'PATCH', url: string, p: Pessoa, corpo?: object) =>
  app.inject({ method: metodo, url, headers: p.auth, ...(corpo ? { payload: corpo } : {}) })

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  com = await criarComunidade(b, 'Jovens Central')
  criador = await pessoaComSessao(b, app, config, 'Criador', { criador: true })
  admin = await pessoaComSessao(b, app, config, 'Fulana Administradora')
  membro = await pessoaComSessao(b, app, config, 'Beltrano Membro')
  await vincular(b, admin.id, com, 'admin')
  await vincular(b, membro.id, com, 'membro')
  await b.su.query("update uj.contas set whatsapp = '+5511987654321' where id = $1", [membro.id])
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

/** O Criador logado sem a prova de 2FA (o login dele não pede o código: D31). */
async function criadorSemProva(): Promise<{ authorization: string }> {
  const email = (
    await b.su.query<{ email: string }>('select email from uj.contas where id = $1', [criador.id])
  ).rows[0]!.email
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/entrar',
    payload: { email, senha: SENHA_PADRAO, plataforma: 'ios' },
  })
  return { authorization: `Bearer ${login.json().acesso as string}` }
}

describe('saúde da plataforma', () => {
  it('só números agregados, com as cotas do dia e o aviso a partir de 80%', async () => {
    // Uso fictício de hoje: convite em 80% (aviso), recuperação em 76% (sem aviso),
    // e uma pessoa com 24 de 30 notificações (80%).
    await b.su.query(
      `insert into uj.cotas_diarias (chave, quantidade) values
         ('email:convite', 48), ('email:recuperacao', 23),
         ('push:' || $1 || ':' || $2, 24), ('push:' || $2 || ':' || $1, 3)`,
      [membro.id, com],
    )
    await b.su.query(
      `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
       values ($1, 'Evento sigiloso do mês', 'Outra', now(), 60, 'America/Sao_Paulo', $2, 'publicado')`,
      [com, admin.id],
    )
    const r = await req('GET', '/api/v1/plataforma/saude', criador)
    expect(r.statusCode).toBe(200)
    const s = r.json()
    expect(s.comunidadesPorEstado).toEqual({ ativa: 1 })
    expect(s.contasAtivas).toBe(3)
    expect(s.eventosDoMes).toEqual({ total: 1, porStatus: { publicado: 1 } })
    expect(s.filaDePush).toEqual({
      pendentes: 0,
      pendenteMaisAntigoEm: null,
      enviados24h: 0,
      falhas24h: 0,
      descartados24h: 0,
    })
    const cota = (nome: string) => s.cotas.find((c: { cota: string }) => c.cota === nome)
    expect(cota('email:convite')).toMatchObject({
      global: true,
      limite: 60,
      maiorUso: 48,
      percentual: 80,
      aviso: true,
    })
    expect(cota('email:recuperacao')).toMatchObject({ maiorUso: 23, percentual: 77, aviso: false })
    expect(cota('push_por_pessoa')).toMatchObject({
      global: false,
      limite: 30,
      maiorUso: 24,
      chaves: 2,
      chavesAcimaDe80: 1,
      aviso: true,
    })
    expect(cota('exportacoes_por_conta')).toMatchObject({ maiorUso: 0, chaves: 0, aviso: false })
    expect(s.alertas.map((a: { cota: string }) => a.cota).sort()).toEqual([
      'email:convite',
      'push_por_pessoa',
    ])
    expect(s.alertas[0].mensagem).toMatch(/\d/)
    // Nada de conteúdo nem de pessoa: nomes, títulos, e-mails e ids ficam de fora.
    const texto = r.body
    for (const proibido of [
      'Jovens Central',
      'Evento sigiloso',
      'Fulana',
      '@exemplo.test',
      membro.id,
      com,
    ]) {
      expect(texto).not.toContain(proibido)
    }
  })

  it('sem prova de 2FA recente, nem o Criador lê (403), e o banco também nega', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/plataforma/saude',
      headers: await criadorSemProva(),
    })
    expect(r.statusCode).toBe(403)
    expect(r.json().erro).toBe('segundo_fator_necessario')
    const doBanco = await b.comoApi<{ s: unknown }>(
      { contaId: criador.id },
      'select uj.saude_da_plataforma() as s',
    )
    expect(doBanco).toEqual([{ s: null }])
    expect((await req('GET', '/api/v1/plataforma/saude', admin)).statusCode).toBe(403)
  })
})

describe('auditoria da plataforma', () => {
  it('só eventos de plataforma, do mais novo para o mais antigo, em páginas', async () => {
    // Ruído que não pode aparecer: ação de conta, de comunidade e de oração.
    await b.su.query(
      `insert into uj.auditoria (conta_id, comunidade_id, acao, detalhes) values
         ($1, null, 'conta.senha_redefinida', '{}'),
         ($1, $2, 'evento.publicado', '{}'),
         ($1, $2, 'oracao.criado', '{}')`,
      [membro.id, com],
    )
    const criada = await req('POST', '/api/v1/plataforma/comunidades', criador, {
      nome: 'Comunidade Auditada',
    })
    expect(criada.statusCode).toBe(200)
    const novaId = criada.json().id as string
    expect(
      (
        await req('PATCH', `/api/v1/plataforma/comunidades/${novaId}/estado`, criador, {
          estado: 'suspensa',
        })
      ).statusCode,
    ).toBe(200)

    const r = await req('GET', '/api/v1/plataforma/auditoria', criador)
    expect(r.statusCode).toBe(200)
    const registros = r.json().registros as {
      id: string
      acao: string
      comunidadeId: string | null
      comunidadeNome: string | null
      detalhes: Record<string, unknown>
    }[]
    expect(registros.every((x) => /^(plataforma|criador)\./.test(x.acao))).toBe(true)
    expect(registros.slice(0, 2)).toMatchObject([
      {
        acao: 'plataforma.estado_alterado',
        comunidadeId: novaId,
        comunidadeNome: 'Comunidade Auditada',
        detalhes: { de: 'ativa', para: 'suspensa' },
      },
      { acao: 'plataforma.comunidade_criada', comunidadeId: novaId },
    ])
    // Página seguinte: `antes` com o id do último visto.
    const p1 = (await req('GET', '/api/v1/plataforma/auditoria?limite=1', criador)).json()
      .registros as { id: string; acao: string }[]
    expect(p1).toHaveLength(1)
    const p2 = (
      await req('GET', `/api/v1/plataforma/auditoria?limite=1&antes=${p1[0]!.id}`, criador)
    ).json().registros as { acao: string }[]
    expect(p2.map((x) => x.acao)).toEqual(['plataforma.comunidade_criada'])
    expect((await req('GET', '/api/v1/plataforma/auditoria?limite=500', criador)).statusCode).toBe(
      400,
    )
    const semProva = await app.inject({
      method: 'GET',
      url: '/api/v1/plataforma/auditoria',
      headers: await criadorSemProva(),
    })
    expect(semProva.statusCode).toBe(403)
  })
})

describe('criação de comunidade com fuso', () => {
  it('grava o fuso informado; sem ele, America/Sao_Paulo; fuso inválido é recusado', async () => {
    const fusoDe = async (id: string) =>
      (await b.su.query<{ fuso: string }>('select fuso from uj.comunidades where id = $1', [id]))
        .rows[0]!.fuso
    const manaus = await req('POST', '/api/v1/plataforma/comunidades', criador, {
      nome: 'Jovens de Manaus',
      fuso: 'America/Manaus',
    })
    expect(manaus.statusCode).toBe(200)
    expect(await fusoDe(manaus.json().id)).toBe('America/Manaus')
    const padrao = await req('POST', '/api/v1/plataforma/comunidades', criador, {
      nome: 'Jovens do Padrão',
    })
    expect(await fusoDe(padrao.json().id)).toBe('America/Sao_Paulo')
    const ruim = await req('POST', '/api/v1/plataforma/comunidades', criador, {
      nome: 'Jovens de Marte',
      fuso: 'Marte/Base_Alfa',
    })
    expect(ruim.statusCode).toBe(400)
    expect(ruim.json().mensagem).toContain('Fuso horário desconhecido.')
  })
})

describe('intervenção: vínculos com o nome, sem contato', () => {
  it('lista nome, papel e estado; nunca e-mail nem WhatsApp; fica auditado', async () => {
    const r = await req('GET', `/api/v1/plataforma/comunidades/${com}/membros`, criador)
    expect(r.statusCode).toBe(200)
    const vinculos = r.json().vinculos as Record<string, unknown>[]
    expect(vinculos.map((v) => Object.keys(v).sort())).toEqual([
      ['desde', 'estado', 'nome', 'papel', 'vinculoId'],
      ['desde', 'estado', 'nome', 'papel', 'vinculoId'],
    ])
    expect(vinculos.map((v) => [v['nome'], v['papel'], v['estado']])).toEqual([
      ['Fulana Administradora', 'admin', 'ativo'],
      ['Beltrano Membro', 'membro', 'ativo'],
    ])
    expect(r.body).not.toContain('@exemplo.test')
    expect(r.body).not.toContain('+5511987654321')
    const aud = await b.su.query(
      "select count(*)::int as n from uj.auditoria where acao = 'plataforma.intervencao_consulta' and comunidade_id = $1",
      [com],
    )
    expect(aud.rows[0].n).toBeGreaterThan(0)
    // Comunidade que não existe: 404; o banco não responde sem a prova.
    expect(
      (
        await req(
          'GET',
          '/api/v1/plataforma/comunidades/00000000-0000-4000-8000-000000000000/membros',
          criador,
        )
      ).statusCode,
    ).toBe(404)
    expect(
      await b.comoApi({ contaId: criador.id }, 'select * from uj.vinculos_para_intervencao($1)', [
        com,
      ]),
    ).toEqual([])
  })

  it('mudar o papel pela intervenção continua exigindo motivo e prova', async () => {
    const lista = (
      await req('GET', `/api/v1/plataforma/comunidades/${com}/membros`, criador)
    ).json().vinculos as { vinculoId: string; nome: string }[]
    const alvo = lista.find((v) => v.nome === 'Beltrano Membro')!
    const url = `/api/v1/plataforma/comunidades/${com}/membros/${alvo.vinculoId}`
    expect((await req('PATCH', url, criador, { papel: 'admin' })).statusCode).toBe(400)
    const semProva = await app.inject({
      method: 'PATCH',
      url,
      headers: await criadorSemProva(),
      payload: { papel: 'admin', motivo: 'A comunidade ficou sem liderança ativa.' },
    })
    expect(semProva.statusCode).toBe(403)
  })
})

describe('prontidão (/api/pronto)', () => {
  it('200 com o banco; 503 em português, sem detalhe técnico, sem ele', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/pronto' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ ok: true })

    // Pool apontando para uma porta sem banco: a conexão é recusada na hora.
    const fora = new pg.Pool({
      connectionString: 'postgres://uj_api:x@127.0.0.1:1/nada',
      connectionTimeoutMillis: 2_000,
    })
    const semBanco = criarServidor(config, { api: fora, auth: fora, correio: correioDesligado() })
    try {
      const falha = await semBanco.inject({ method: 'GET', url: '/api/pronto' })
      expect(falha.statusCode).toBe(503)
      expect(falha.json()).toEqual({
        ok: false,
        erro: 'indisponivel',
        mensagem: 'O serviço está iniciando ou em manutenção. Tente de novo em instantes.',
      })
      // A saúde (processo vivo) continua respondendo.
      expect((await semBanco.inject({ method: 'GET', url: '/api/saude' })).statusCode).toBe(200)
    } finally {
      await semBanco.close()
      await fora.end()
    }
  })
})
