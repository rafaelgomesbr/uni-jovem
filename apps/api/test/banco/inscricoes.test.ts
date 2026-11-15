import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { normalizarTelefone } from '../../src/publico/apoio.ts'
import { TETO_POR_WHATSAPP } from '../../src/publico/rotas.ts'
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
  // Pool do tamanho do de produção (src/index.ts) e espera longa: a suíte
  // inteira roda em paralelo e o teste de 50 inscrições não pode cair por fila.
  b = await novoBanco({ conexoesDaApi: 10, esperaPorConexaoMs: 60_000 })
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

  it('inscrição: confirmação com QR sem dado pessoal; a mesma pessoa não duplica e é avisada', async () => {
    const { id, idPublico } = await eventoPublico()
    const r = await inscrever(idPublico, {
      nome: 'Beatriz Conceição',
      telefone: '11 92222-2222',
      email: 'Bia@Exemplo.test',
    })
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('Inscrição confirmada')
    const codigo = r.body.match(/Código: <strong>([0-9A-F]{10})<\/strong>/)![1]!
    expect(r.body).toContain('<svg')
    expect(codigo).not.toMatch(/Beatriz|2222/)
    expect(r.body).toMatch(/\/e\/[0-9a-f]{32}\/cancelar#t=/)
    // A mesma pessoa de novo, escrita de outro jeito (caixa, acento, espaços):
    // não duplica, não devolve o código (M2) e diz que ela já está inscrita.
    const de_novo = await inscrever(idPublico, {
      nome: '  beatriz   CONCEICAO ',
      telefone: '+55 11 92222-2222',
    })
    expect(de_novo.statusCode).toBe(409)
    expect(de_novo.body).toContain('Esta pessoa já está inscrita neste evento')
    expect(de_novo.body).not.toContain('Inscrição confirmada')
    expect(de_novo.body).not.toContain(codigo)
    expect(de_novo.body).not.toContain('<svg')
    expect(de_novo.body).not.toMatch(/cancelar#t=/)
    const lista = (await req('GET', `/eventos/${id}/inscricoes`, org)).json()
    expect(lista.inscricoes).toHaveLength(1)
    expect(lista.inscricoes[0]).toMatchObject({
      nome: 'Beatriz Conceição',
      telefone: '+5511922222222',
      email: 'bia@exemplo.test',
    })
  })

  it('irmãos: duas pessoas com o mesmo WhatsApp entram, cada uma com o seu código', async () => {
    const { id, idPublico } = await eventoPublico()
    const telefone = '(11) 93333-1000'
    const joao = await inscrever(idPublico, { nome: 'João Silva', telefone })
    const maria = await inscrever(idPublico, { nome: 'Maria Silva', telefone })
    expect(joao.statusCode).toBe(200)
    expect(maria.statusCode).toBe(200)
    expect(maria.body).toContain('Inscrição confirmada')
    const codigoDe = (corpo: string) => corpo.match(/Código: <strong>([0-9A-F]{10})<\/strong>/)![1]!
    expect(codigoDe(joao.body)).not.toBe(codigoDe(maria.body))
    const lista = (await req('GET', `/eventos/${id}/inscricoes`, org)).json()
    expect(lista.inscricoes.map((i: { nome: string }) => i.nome).sort()).toEqual([
      'João Silva',
      'Maria Silva',
    ])
    // No banco, a chave de repetição é WhatsApp mais nome normalizado.
    const { rows } = await b.su.query(
      "select uj.nome_normalizado('  João   da SILVA ') as n, uj.nome_normalizado('Joao da Silva') as m",
    )
    expect(rows).toEqual([{ n: 'joao da silva', m: 'joao da silva' }])
  })

  it(`teto de ${TETO_POR_WHATSAPP} inscrições ativas por WhatsApp no mesmo evento`, async () => {
    const { idPublico } = await eventoPublico()
    const telefone = '11 93333-2000'
    for (let i = 0; i < TETO_POR_WHATSAPP; i++) {
      expect((await inscrever(idPublico, { nome: `Pessoa ${i}`, telefone })).statusCode).toBe(200)
    }
    const passou = await inscrever(idPublico, { nome: 'Mais Uma', telefone })
    expect(passou.statusCode).toBe(409)
    expect(passou.body).toContain(
      `Este WhatsApp já tem ${TETO_POR_WHATSAPP} inscrições neste evento`,
    )
    expect(passou.body).toContain('value="Mais Uma"')
  })

  it('tela de sucesso: rótulo claro, print, mandar ao próprio WhatsApp e inscrever outra pessoa', async () => {
    const { idPublico } = await eventoPublico()
    const formulario = await app.inject({ method: 'GET', url: `/e/${idPublico}` })
    expect(formulario.body).toContain('Nome de quem vai participar')
    expect(formulario.body).not.toContain('Seu nome')

    const r = await inscrever(idPublico, {
      nome: 'Lucas Andrade',
      telefone: '(11) 94444-3000',
      email: 'mae@exemplo.test',
    })
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('Tire um print: é a entrada dessa pessoa.')
    const codigo = r.body.match(/Código: <strong>([0-9A-F]{10})<\/strong>/)![1]!
    const token = r.body.match(/cancelar#t=([\w-]+)/)![1]!

    // "Mandar para o meu WhatsApp": resumo com código e link de cancelamento,
    // sem nome, telefone nem e-mail.
    const link = r.body.match(
      /href="(https:\/\/wa\.me\/\?text=[^"]+)"[^>]*>Mandar para o meu WhatsApp/,
    )
    expect(link).not.toBeNull()
    const texto = decodeURIComponent(link![1]!.replace(/&amp;/g, '&').split('text=')[1]!)
    expect(texto).toContain('Luau musical')
    expect(texto).toContain(`Código de entrada: ${codigo}`)
    expect(texto).toContain(`/e/${idPublico}/cancelar#t=${token}`)
    expect(texto).not.toMatch(/Lucas|Andrade|94444|3000|mae@/)

    // "Inscrever outra pessoa": o formulário volta com o mesmo contato e o nome
    // em branco, sem nada na URL.
    expect(r.body).toContain(`action="/e/${idPublico}/outra"`)
    expect(r.body).toContain('Inscrever outra pessoa')
    const outra = await app.inject({
      method: 'POST',
      url: `/e/${idPublico}/outra`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        telefone: '(11) 94444-3000',
        email: 'mae@exemplo.test',
      }).toString(),
    })
    expect(outra.statusCode).toBe(200)
    expect(outra.body).toContain('Nome de quem vai participar')
    expect(outra.body).toContain('value="(11) 94444-3000"')
    expect(outra.body).toContain('value="mae@exemplo.test"')
    expect(outra.body).toMatch(/id="nome"[^>]*value=""/)
    expect(outra.body).toContain('preencha o nome da outra pessoa')
    // O consentimento e a confirmação de idade continuam lá, desmarcados.
    expect(outra.body).toMatch(/id="consentimento"[^>]*required/)
    expect(outra.body).not.toMatch(/id="consentimento"[^>]*checked/)
    expect(
      (await app.inject({ method: 'POST', url: '/e/nao-existe/outra', payload: {} })).statusCode,
    ).toBe(404)
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
  // A falha de 15/11/2026 (26 respostas 409 em vez de 30) não era corrida: as
  // 20 vagas fecharam certas. Eram 4 pedidos que esperaram mais de 10 s por
  // uma conexão no pool de 4 do teste, com a suíte inteira disputando a CPU, e
  // viraram 500 ("timeout exceeded when trying to connect"). O arquivo agora
  // usa o pool de produção (10) e espera longa; o caso do pool esgotado tem
  // teste próprio logo abaixo.
  it(
    '50 inscrições simultâneas para 20 vagas: exatamente 20 confirmadas, 30 recusadas',
    { timeout: 90_000 },
    async () => {
      const { id, idPublico } = await eventoPublico({ capacidade: 20 })
      const respostas = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          inscrever(idPublico, {
            nome: `Pessoa ${i}`,
            telefone: `1196000${String(i).padStart(4, '0')}`,
          }),
        ),
      )
      const situacao = respostas.map((r) =>
        r.statusCode === 200 && r.body.includes('Inscrição confirmada')
          ? 'confirmada'
          : r.statusCode === 409 && r.body.includes('As vagas acabaram')
            ? 'lotado'
            : `outro ${r.statusCode}`,
      )
      const contagem = Object.fromEntries(
        [...new Set(situacao)].map((s) => [s, situacao.filter((x) => x === s).length]),
      )
      expect(contagem).toEqual({ confirmada: 20, lotado: 30 })
      const { rows } = await b.su.query(
        "select count(*)::int as n from uj.inscricoes where evento_id = $1 and estado = 'confirmada'",
        [id],
      )
      expect(rows).toEqual([{ n: 20 }])
    },
  )

  it('pool de conexões esgotado: 503 com mensagem humana, nunca 500 nem sucesso falso', async () => {
    // Pool de uma conexão, ocupada de propósito: os pedidos ficam na fila do
    // pool, estouram a espera e reproduzem o que derrubou o teste de 50.
    // (A espera também vale para abrir a conexão nova: curta demais, nem a
    // primeira abre com a suíte inteira rodando.)
    const pool = b.outroPoolDaApi({ max: 1, connectionTimeoutMillis: 3_000 })
    const apertado = criarServidor(config, {
      api: pool,
      auth: b.auth,
      correio: correioDesligado(),
      fatorDeLimitePorIp: 1000,
    })
    await apertado.ready()
    const pedir = (i: number, idPublico: string) =>
      apertado.inject({
        method: 'POST',
        url: `/e/${idPublico}/inscricao`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams({
          consentimento: 'sim',
          idade: 'sim',
          nome: `Pico ${i}`,
          telefone: `1196100${String(i).padStart(4, '0')}`,
        }).toString(),
      })
    try {
      const { id, idPublico } = await eventoPublico()
      const presa = await pool.connect()
      let respostas
      try {
        respostas = await Promise.all([0, 1, 2, 3, 4].map((i) => pedir(i, idPublico)))
      } finally {
        presa.release()
      }
      for (const r of respostas) {
        expect(r.statusCode).toBe(503)
        expect(r.headers['content-type']).toContain('text/html')
        expect(r.body).toContain('Muita gente se inscrevendo agora')
        expect(r.body).not.toContain('Inscrição confirmada')
      }
      // Nada foi gravado; com a conexão livre, a mesma pessoa entra.
      const depois = await pedir(0, idPublico)
      expect(depois.statusCode).toBe(200)
      expect(depois.body).toContain('Inscrição confirmada')
      const { rows } = await b.su.query(
        'select count(*)::int as n from uj.inscricoes where evento_id = $1',
        [id],
      )
      expect(rows).toEqual([{ n: 1 }])
    } finally {
      await apertado.close()
    }
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
    // Contrato em camelCase (N3): inscricaoId, estado, codigoCheckin.
    expect(r.json()).toEqual({
      inscricaoId: expect.any(String),
      estado: 'confirmada',
      codigoCheckin: expect.stringMatching(/^[0-9A-F]{10}$/),
    })
    // Repetir não duplica.
    expect((await req('POST', `/eventos/${id}/inscricoes/eu`, membro)).json()).toEqual(r.json())
    expect((await req('GET', `/eventos/${id}/inscricoes`, membro)).statusCode).toBe(403)
    expect(
      (await req('POST', `/inscricoes/${r.json().inscricaoId}/cancelar`, membro)).statusCode,
    ).toBe(200)
  })

  it('"minhas inscrições": só as da pessoa, com evento, estado e código', async () => {
    const outra = await pessoaComSessao(b, app, config, 'Outra Pessoa')
    await vincular(b, outra.id, com, 'membro')
    const pessoa = await pessoaComSessao(b, app, config, 'Pessoa do Início')
    await vincular(b, pessoa.id, com, 'membro')
    const vazio = await req('GET', '/inscricoes/eu', pessoa)
    expect(vazio.statusCode).toBe(200)
    expect(vazio.json()).toEqual({ inscricoes: [] })

    const lotado = await eventoPublico({ capacidade: 1, espera: true })
    const livre = await eventoPublico()
    const cancelado = await eventoPublico()
    await req('POST', `/eventos/${lotado.id}/inscricoes/eu`, outra)
    const naEspera = (await req('POST', `/eventos/${lotado.id}/inscricoes/eu`, pessoa)).json()
    const confirmada = (await req('POST', `/eventos/${livre.id}/inscricoes/eu`, pessoa)).json()
    const desistiu = (await req('POST', `/eventos/${cancelado.id}/inscricoes/eu`, pessoa)).json()
    await req('POST', `/inscricoes/${desistiu.inscricaoId}/cancelar`, pessoa)

    const r = await req('GET', '/inscricoes/eu', pessoa)
    expect(r.statusCode).toBe(200)
    const lista = r.json().inscricoes as {
      inscricaoId: string
      estado: string
      codigoCheckin: string
      presente: boolean
      evento: { id: string; titulo: string; status: string; duracaoMin: number }
    }[]
    // Por padrão, só as ativas (a cancelada fica de fora), e nunca as de outra pessoa.
    expect(lista.map((i) => i.inscricaoId).sort()).toEqual(
      [naEspera.inscricaoId, confirmada.inscricaoId].sort(),
    )
    expect(lista.find((i) => i.inscricaoId === naEspera.inscricaoId)).toMatchObject({
      estado: 'espera',
      codigoCheckin: naEspera.codigoCheckin,
      presente: false,
      evento: { id: lotado.id, titulo: 'Luau musical', status: 'publicado', duracaoMin: 120 },
    })
    const todas = (await req('GET', '/inscricoes/eu?periodo=todas', pessoa)).json().inscricoes as {
      inscricaoId: string
      estado: string
    }[]
    expect(todas.find((i) => i.inscricaoId === desistiu.inscricaoId)?.estado).toBe('cancelada')
    expect(todas).toHaveLength(3)
    expect((await req('GET', '/inscricoes/eu?periodo=ontem', pessoa)).statusCode).toBe(400)
    // A da outra pessoa não aparece nem para a organizadora, que não está inscrita.
    expect((await req('GET', '/inscricoes/eu', org)).json()).toEqual({ inscricoes: [] })
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
