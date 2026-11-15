import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { normalizarTelefone } from '../../src/publico/apoio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let org: Pessoa
let membro: Pessoa

type Metodo = 'GET' | 'POST' | 'DELETE'
const req = (metodo: Metodo, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

const SEGREDO_INTERNO = 'Nota secreta da organização'

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 1000,
  })
  await app.ready()
  com = await criarComunidade(b, 'Jovens Central')
  org = await pessoaComSessao(b, app, config, 'Organizadora')
  membro = await pessoaComSessao(b, app, config, 'Membro Interno')
  await vincular(b, org.id, com, 'organizador')
  await vincular(b, membro.id, com, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

async function eventoPublico(opcoes: { capacidade?: number; espera?: boolean } = {}) {
  const id = (
    await req('POST', '/eventos', org, {
      titulo: 'Luau musical',
      categoria: 'Luau musical',
      inicio: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      duracaoMin: 120,
      visibilidade: 'publica',
      ...(opcoes.capacidade ? { capacidade: opcoes.capacidade } : {}),
      ...(opcoes.espera ? { listaDeEspera: true } : {}),
    })
  ).json().id as string
  await req('POST', `/eventos/${id}/notas`, org, { texto: SEGREDO_INTERNO })
  await req('POST', `/eventos/${id}/status`, org, { status: 'publicado' })
  const idPublico = (await req('GET', `/eventos/${id}`, org)).json().idPublico as string
  return { id, idPublico }
}

const inscrever = (idPublico: string, dados: Record<string, string>) =>
  app.inject({
    method: 'POST',
    url: `/e/${idPublico}/inscricao`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ consentimento: 'sim', idade: 'sim', ...dados }).toString(),
  })

describe('página pública', () => {
  it('mostra só o publicado, com prévia para o WhatsApp e CSP estrita', async () => {
    const { idPublico } = await eventoPublico()
    await inscrever(idPublico, { nome: 'Visitante Fulano', telefone: '(11) 91111-1111' })
    const r = await app.inject({ method: 'GET', url: `/e/${idPublico}` })
    expect(r.statusCode).toBe(200)
    expect(r.body).toMatch(/<meta property="og:title" content="Luau musical"/)
    expect(r.body).not.toContain(SEGREDO_INTERNO)
    expect(r.body).not.toContain('Visitante Fulano')
    expect(r.body).not.toContain('Organizadora')
    expect(r.headers['content-security-policy']).toContain("default-src 'self'")
    expect(r.headers['x-robots-tag']).toContain('noindex')
  })

  it('a função pública devolve exatamente os campos publicados', async () => {
    const { idPublico } = await eventoPublico()
    const { fields } = await b.api.query('select * from uj.evento_publico($1)', [idPublico])
    expect(fields.map((f) => f.name).sort()).toEqual(
      [
        'capacidade',
        'categoria',
        'comunidade_cor',
        'comunidade_nome',
        'descricao',
        'duracao_min',
        'fuso',
        'informacoes_uteis',
        'inicio',
        'inscricoes_abertas',
        'lista_de_espera',
        'local_endereco',
        'local_latitude',
        'local_longitude',
        'local_nome',
        'local_tipo',
        'motivo_status',
        // Prazo de retenção da comunidade (o consentimento TC-04 cita os dias).
        'retencao_dias',
        'status',
        'titulo',
        'vagas_restantes',
      ].sort(),
    )
  })

  it('evento interno ou rascunho não existe para o público', async () => {
    const interno = (
      await req('POST', '/eventos', org, {
        titulo: 'Reunião interna',
        categoria: 'Outra',
        inicio: new Date(Date.now() + 86_400_000).toISOString(),
        duracaoMin: 60,
      })
    ).json().id
    await req('POST', `/eventos/${interno}/status`, org, { status: 'publicado' })
    const idPublico = (await req('GET', `/eventos/${interno}`, org)).json().idPublico
    expect((await app.inject({ method: 'GET', url: `/e/${idPublico}` })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: '/e/nao-existe' })).statusCode).toBe(404)
  })

  it('inscrição: confirmação com QR sem dado pessoal; o mesmo WhatsApp não duplica', async () => {
    const { id, idPublico } = await eventoPublico()
    const r = await inscrever(idPublico, {
      nome: 'Beatriz',
      telefone: '11 92222-2222',
      email: 'Bia@Exemplo.test',
    })
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('Inscrição confirmada')
    const codigo = r.body.match(/Código: <strong>([0-9A-F]{10})<\/strong>/)![1]!
    expect(r.body).toContain('<svg')
    expect(codigo).not.toMatch(/Beatriz|2222/)
    expect(r.body).toMatch(/\/e\/[0-9a-f]{32}\/cancelar#t=/)
    // Repetir não duplica nem devolve o código (ver correcoes-de-seguranca.test.ts, M2).
    const de_novo = await inscrever(idPublico, { nome: 'Beatriz', telefone: '+55 11 92222-2222' })
    expect(de_novo.statusCode).toBe(200)
    expect(de_novo.body).not.toContain(codigo)
    const lista = (await req('GET', `/eventos/${id}/inscricoes`, org)).json()
    expect(lista.inscricoes.filter((i: { nome: string }) => i.nome === 'Beatriz')).toHaveLength(1)
    expect(lista.inscricoes[0]).toMatchObject({
      telefone: '+5511922222222',
      email: 'bia@exemplo.test',
    })
  })

  it('sem consentimento, com telefone inválido ou campo-isca: nada é gravado', async () => {
    const { id, idPublico } = await eventoPublico()
    const sem = await app.inject({
      method: 'POST',
      url: `/e/${idPublico}/inscricao`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'nome=Ana&telefone=11933333333',
    })
    expect(sem.statusCode).toBe(400)
    expect(sem.body).toContain('marque a concordância')
    expect(sem.body).toContain('value="Ana"')
    expect((await inscrever(idPublico, { nome: 'Ana', telefone: '123' })).statusCode).toBe(400)
    expect(
      (await inscrever(idPublico, { nome: 'Robô', telefone: '11944444444', site: 'spam' }))
        .statusCode,
    ).toBe(200)
    expect((await req('GET', `/eventos/${id}/inscricoes`, org)).json().inscricoes).toEqual([])
  })

  it('HTML injetado no nome é escapado', async () => {
    const { idPublico } = await eventoPublico()
    const r = await inscrever(idPublico, {
      nome: '<script>alert(1)</script>',
      telefone: '11955555555',
      consentimento: 'nao',
    })
    expect(r.body).not.toContain('<script>alert(1)</script>')
    expect(r.body).toContain('&lt;script&gt;')
  })
})

describe('capacidade, lista de espera e cancelamento', () => {
  it('50 inscrições simultâneas para 20 vagas: exatamente 20 confirmadas', async () => {
    const { id, idPublico } = await eventoPublico({ capacidade: 20 })
    const respostas = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        inscrever(idPublico, {
          nome: `Pessoa ${i}`,
          telefone: `1196000${String(i).padStart(4, '0')}`,
        }),
      ),
    )
    expect(respostas.filter((r) => r.body.includes('Inscrição confirmada'))).toHaveLength(20)
    expect(respostas.filter((r) => r.statusCode === 409)).toHaveLength(30)
    const { rows } = await b.su.query(
      "select count(*)::int as n from uj.inscricoes where evento_id = $1 and estado = 'confirmada'",
      [id],
    )
    expect(rows).toEqual([{ n: 20 }])
  })

  it('lista de espera; cancelar pelo link promove a primeira da fila', async () => {
    const { id, idPublico } = await eventoPublico({ capacidade: 1, espera: true })
    const primeira = await inscrever(idPublico, { nome: 'Primeira', telefone: '11970000001' })
    const segunda = await inscrever(idPublico, { nome: 'Segunda', telefone: '11970000002' })
    expect(segunda.body).toContain('lista de espera')
    const token = primeira.body.match(/cancelar#t=([\w-]+)/)![1]!
    const cancelou = await app.inject({
      method: 'POST',
      url: `/e/${idPublico}/cancelar`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `token=${token}`,
    })
    expect(cancelou.statusCode).toBe(200)
    const { rows } = await b.su.query(
      'select nome, estado, promovida_em is not null as promovida from uj.inscricoes where evento_id = $1 order by criado_em',
      [id],
    )
    expect(rows).toEqual([
      { nome: 'Primeira', estado: 'cancelada', promovida: false },
      { nome: 'Segunda', estado: 'confirmada', promovida: true },
    ])
    // O mesmo link não cancela duas vezes; token inventado também não.
    const repetido = await app.inject({
      method: 'POST',
      url: `/e/${idPublico}/cancelar`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `token=${token}`,
    })
    expect(repetido.statusCode).toBe(404)
  })

  it('membro se inscreve pelo app e cancela a própria', async () => {
    const { id } = await eventoPublico({ capacidade: 5 })
    const r = await req('POST', `/eventos/${id}/inscricoes/eu`, membro)
    expect(r.json()).toMatchObject({ estado: 'confirmada' })
    // Repetir não duplica.
    expect((await req('POST', `/eventos/${id}/inscricoes/eu`, membro)).json().inscricao_id).toBe(
      r.json().inscricao_id,
    )
    expect((await req('GET', `/eventos/${id}/inscricoes`, membro)).statusCode).toBe(403)
    expect(
      (await req('POST', `/inscricoes/${r.json().inscricao_id}/cancelar`, membro)).statusCode,
    ).toBe(200)
  })
})

describe('presença', () => {
  it('check-in por QR e manual; repetido não duplica; sem inscrição também', async () => {
    const { id, idPublico } = await eventoPublico()
    const corpo = (await inscrever(idPublico, { nome: 'Carla', telefone: '11980000001' })).body
    const codigo = corpo.match(/Código: <strong>([0-9A-F]{10})<\/strong>/)![1]!
    const chave = randomUUID()
    const p1 = await req('POST', `/eventos/${id}/presencas`, org, {
      chaveIdempotencia: chave,
      origem: 'qr',
      codigo,
    })
    expect(p1.json()).toMatchObject({ jaRegistrada: false })
    // Mesmo envio (fila offline repetindo).
    expect(
      (
        await req('POST', `/eventos/${id}/presencas`, org, {
          chaveIdempotencia: chave,
          origem: 'qr',
          codigo,
        })
      ).json().jaRegistrada,
    ).toBe(true)
    // Outro aparelho, mesma pessoa.
    expect(
      (
        await req('POST', `/eventos/${id}/presencas`, org, {
          chaveIdempotencia: randomUUID(),
          origem: 'manual',
          codigo,
        })
      ).json().jaRegistrada,
    ).toBe(true)
    await req('POST', `/eventos/${id}/presencas`, org, {
      chaveIdempotencia: randomUUID(),
      origem: 'manual',
      nomeAvulso: 'Visitante sem inscrição',
    })
    const lista = (await req('GET', `/eventos/${id}/presencas`, org)).json()
    expect(lista.total).toBe(2)
    expect(lista.presencas.map((p: { nome: string }) => p.nome).sort()).toEqual([
      'Carla',
      'Visitante sem inscrição',
    ])
    const checkin = (await req('GET', `/eventos/${id}/checkin`, org)).json()
    expect(checkin.inscritos[0]).toMatchObject({
      nome: 'Carla',
      presente: true,
      telefone: '•••• 0001',
    })
  })

  it('membro não registra presença de ninguém', async () => {
    const { id } = await eventoPublico()
    expect(
      (
        await req('POST', `/eventos/${id}/presencas`, membro, {
          chaveIdempotencia: randomUUID(),
          origem: 'manual',
          nomeAvulso: 'X',
        })
      ).statusCode,
    ).toBe(403)
  })
})

describe('retenção', () => {
  it('inscrições públicas viram anônimas depois do prazo; contagem e presença ficam', async () => {
    const { id, idPublico } = await eventoPublico()
    await inscrever(idPublico, { nome: 'Daniela', telefone: '11990000001' })
    await b.dono.query("update uj.eventos set inicio = now() - interval '200 days' where id = $1", [
      id,
    ])
    const { rows } = await b.dono.query('select uj.anonimizar_inscricoes_vencidas() as n')
    expect(rows[0].n).toBeGreaterThanOrEqual(1)
    const i = await b.su.query(
      'select nome, telefone, estado from uj.inscricoes where evento_id = $1',
      [id],
    )
    expect(i.rows).toEqual([{ nome: 'Participante', telefone: null, estado: 'confirmada' }])
  })
})

describe('telefone', () => {
  it('normaliza formatos brasileiros e internacionais', () => {
    expect(normalizarTelefone('(11) 91234-5678')).toBe('+5511912345678')
    expect(normalizarTelefone('5511912345678')).toBe('+5511912345678')
    expect(normalizarTelefone('+1 415 555 0100')).toBe('+14155550100')
    expect(normalizarTelefone('1234')).toBeNull()
  })
})
