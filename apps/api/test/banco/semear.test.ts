import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dataNoFuso, instanteNoFuso, MODELO_SABADO_PADRAO } from '@uj/dominio'
import { decifrar } from '../../src/autenticacao/cripto.ts'
import {
  COMUNIDADE_A,
  COMUNIDADE_B,
  PESSOAS_FICTICIAS,
  semearDemonstracao,
} from '../../src/cli/demonstracao.ts'
import {
  FIGURANTES_DE_A,
  planoDaComunidadeA,
  proximoSabado,
} from '../../src/cli/demonstracao-plano.ts'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { novoBanco, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'

/**
 * M7: a semente cria as comunidades A e B fictícias, uma conta própria em B e
 * uma conta presente nas duas, e enche a A de uma comunidade viva (agenda,
 * escalas, avisos, oração, sugestões, conteúdos). Idempotente: rodar de novo
 * não cria nada; numa base com a semente antiga (como a produção semeada em
 * 15/11/2026), cria só o que falta e não toca no que não é da demonstração.
 * O texto dos pedidos de oração só existe cifrado, e a API o lê.
 */

const config = carregarConfig(envDeTeste())
const chaveDeOracao = Buffer.from(config.ORACAO_CHAVE, 'base64')
const FUSO = 'America/Sao_Paulo'
const hoje = () => dataNoFuso(new Date(), FUSO)

let limpo: BancoDeTeste
let antigo: BancoDeTeste
let producao: BancoDeTeste
/** Credenciais impressas pela primeira execução na base vazia (só existem ali). */
let credenciaisDaPrimeira: string[] = []
const COM_SENHA = new Set(PESSOAS_FICTICIAS.map((p) => p.email))

beforeAll(async () => {
  ;[limpo, antigo, producao] = await Promise.all([novoBanco(), novoBanco(), novoBanco()])
})

afterAll(async () => {
  await Promise.all([limpo.encerrar(), antigo.encerrar(), producao.encerrar()])
})

/** Vínculos como [comunidade, e-mail, papel], na ordem de código (sem depender da collation). */
async function vinculosPorComunidade(b: BancoDeTeste) {
  const { rows } = await b.su.query<{ comunidade: string; email: string; papel: string }>(
    `select case m.nome when $1 then 'A' when $2 then 'B' else m.nome end as comunidade,
            a.email, v.papel
       from uj.vinculos v join uj.comunidades m on m.id = v.comunidade_id
       join uj.contas a on a.id = v.conta_id`,
    [COMUNIDADE_A, COMUNIDADE_B],
  )
  return rows
    .map((r) => [r.comunidade, r.email, r.papel])
    .sort((x, y) => (x.join(' ') < y.join(' ') ? -1 : 1))
}

const TABELAS_DE_CONTEUDO = [
  'locais',
  'eventos',
  'etapas',
  'atribuicoes',
  'substituicoes',
  'disponibilidades',
  'tarefas',
  'checklist_itens',
  'inscricoes',
  'presencas',
  'avisos',
  'pedidos_oracao',
  'intercessoes',
  'sugestoes',
  'musicas',
  'palestrantes',
  'dinamicas',
] as const

/** Linhas de cada tabela de conteúdo numa comunidade (ou em todas as outras). */
async function contagens(b: BancoDeTeste, comunidade: string, fora = false) {
  const r: Record<string, number> = {}
  for (const t of TABELAS_DE_CONTEUDO) {
    r[t] = (
      await b.su.query<{ n: number }>(
        `select count(*)::int as n from uj.${t} where (comunidade_id = $1) <> $2`,
        [comunidade, fora],
      )
    ).rows[0]!.n
  }
  return r
}

/** O que a semente cria numa base vazia (com a chave de oração). */
const CRIADO_NUMA_BASE_VAZIA = {
  comunidades: 2,
  contas: PESSOAS_FICTICIAS.length + FIGURANTES_DE_A.length,
  vínculos: 17,
  locais: 3,
  eventos: 10,
  etapas: 55,
  'itens de checklist': 50,
  tarefas: 13,
  escalas: 64,
  substituições: 1,
  inscrições: 10,
  presenças: 22,
  disponibilidades: 2,
  avisos: 3,
  musicas: 5,
  palestrantes: 2,
  dinamicas: 1,
  sugestões: 3,
  'pedidos de oração': 6,
  intercessões: 19,
}

describe('semente de demonstração: base vazia', () => {
  it('cria A e B, as contas com senha, os figurantes sem senha e a conta nas duas', async () => {
    const r = await semearDemonstracao(limpo.dono, { chaveDeOracao })
    credenciaisDaPrimeira = r.credenciais
    expect(r.avisos).toEqual([])
    expect(r.contagem).toEqual(CRIADO_NUMA_BASE_VAZIA)
    // Só as contas com senha têm credencial; a senha só aparece na saída, nunca em claro no banco.
    expect(r.credenciais).toHaveLength(PESSOAS_FICTICIAS.length)
    for (const linha of r.credenciais) expect(linha).toMatch(/@unijovem\.invalid {2}senha: \S{20}$/)
    // Nenhuma linha do relatório traz texto de pedido de oração.
    const textos = planoDaComunidadeA(hoje()).pedidosDeOracao.map((p) => p.texto)
    for (const t of textos) expect(r.criadas.join('\n')).not.toContain(t)
    const vinculos = await vinculosPorComunidade(limpo)
    expect(vinculos.filter((v) => !COM_SENHA.has(v[1]!))).toEqual(
      FIGURANTES_DE_A.map((f) => ['A', f.email, f.papel]).sort((x, y) =>
        x.join(' ') < y.join(' ') ? -1 : 1,
      ),
    )
    expect(vinculos.filter((v) => COM_SENHA.has(v[1]!))).toEqual([
      ['A', 'demo.admin2@unijovem.invalid', 'admin'],
      ['A', 'demo.admin@unijovem.invalid', 'admin'],
      ['A', 'demo.duas@unijovem.invalid', 'membro'],
      ['A', 'demo.membro@unijovem.invalid', 'membro'],
      ['A', 'demo.organizador@unijovem.invalid', 'organizador'],
      ['B', 'demo.b.admin@unijovem.invalid', 'admin'],
      ['B', 'demo.duas@unijovem.invalid', 'organizador'],
    ])
    // Figurantes: nenhuma senha utilizável, e-mail .invalid, sem telefone; alguns com avatar.
    const figurantes = await limpo.su.query<{
      senha_hash: string | null
      whatsapp: string | null
      avatar_icone: string | null
    }>('select senha_hash, whatsapp, avatar_icone from uj.contas where email = any($1)', [
      FIGURANTES_DE_A.map((f) => f.email),
    ])
    expect(figurantes.rows).toHaveLength(FIGURANTES_DE_A.length)
    expect(figurantes.rows.every((f) => f.senha_hash === null && f.whatsapp === null)).toBe(true)
    expect(figurantes.rows.filter((f) => f.avatar_icone).length).toBeGreaterThanOrEqual(6)
    expect(
      (
        await limpo.su.query<{ n: number }>(
          "select count(*)::int as n from uj.contas where email not like '%@unijovem.invalid'",
        )
      ).rows[0]!.n,
    ).toBe(0)
  })

  it('a contagem do que foi criado bate com o banco', async () => {
    // A primeira execução foi no teste anterior; aqui, o retrato do banco.
    const a = (
      await limpo.su.query<{ id: string }>('select id from uj.comunidades where nome = $1', [
        COMUNIDADE_A,
      ])
    ).rows[0]!.id
    expect(await contagens(limpo, a)).toEqual({
      locais: 2,
      eventos: 9,
      etapas: 55,
      atribuicoes: 64,
      substituicoes: 1,
      disponibilidades: 2,
      tarefas: 13,
      checklist_itens: 50,
      inscricoes: 10,
      presencas: 22,
      avisos: 3,
      pedidos_oracao: 6,
      intercessoes: 19,
      sugestoes: 3,
      musicas: 5,
      palestrantes: 2,
      dinamicas: 1,
    })
    const s0 = proximoSabado(hoje())
    const fatos = (
      await limpo.su.query(
        `select
           (select count(*)::int from uj.eventos where comunidade_id = $1 and titulo = 'Sábado Jovem'
               and inicio > now()) as "sabadosFuturos",
           (select count(*)::int from uj.eventos where comunidade_id = $1 and status = 'encerrado'
               and inicio < now()) as "eventosPassados",
           (select count(*)::int from uj.eventos where comunidade_id = $1 and titulo = 'Retiro de Verão'
               and visibilidade = 'publica' and capacidade = 40 and inicio > now()
               and inscricao_ate > now()) as "retiroAberto",
           (select count(*)::int from uj.avisos where comunidade_id = $1 and fixado
               and titulo = 'Ensaio do louvor às 15h' and estado = 'publicado') as "avisoFixado",
           (select count(*)::int from uj.substituicoes where comunidade_id = $1 and estado = 'aberta')
             as "substituicoesAbertas",
           (select array_agg(status order by status) from uj.sugestoes where comunidade_id = $1)
             as "situacoesDasSugestoes",
           (select count(*)::int from uj.sugestoes where comunidade_id = $1 and status = 'aceita'
               and resposta is not null and respondida_por is not null) as "aceitaComResposta",
           (select count(*)::int from uj.musicas where comunidade_id = $1 and tom is not null
               and cifra is null) as "musicasComTomSemLetra",
           (select (inicio at time zone 'America/Sao_Paulo')::date::text from uj.eventos
             where comunidade_id = $1 and titulo = 'Sábado Jovem' and inicio > now()
             order by inicio limit 1) as "primeiroSabado"`,
        [a],
      )
    ).rows[0]
    expect(fatos).toEqual({
      sabadosFuturos: 4,
      eventosPassados: 2,
      retiroAberto: 1,
      avisoFixado: 1,
      substituicoesAbertas: 1,
      situacoesDasSugestoes: ['aceita', 'em_analise', 'recebida'],
      aceitaComResposta: 1,
      musicasComTomSemLetra: 5,
      primeiroSabado: s0,
    })
    // As escalas das contas de demonstração: confirmadas e pendentes pela frente.
    const escalas = await limpo.su.query<{ email: string; estado: string; n: number }>(
      `select c.email, a.estado, count(*)::int as n
         from uj.atribuicoes a join uj.vinculos v on v.id = a.vinculo_id
         join uj.contas c on c.id = v.conta_id join uj.eventos e on e.id = a.evento_id
        where e.inicio > now() and c.email in ('demo.membro@unijovem.invalid',
              'demo.organizador@unijovem.invalid')
        group by 1, 2`,
    )
    for (const email of ['demo.membro@unijovem.invalid', 'demo.organizador@unijovem.invalid']) {
      const estados = escalas.rows.filter((x) => x.email === email).map((x) => x.estado)
      expect(estados, email).toEqual(expect.arrayContaining(['confirmada', 'pendente']))
    }
  })

  it('o texto dos pedidos de oração fica cifrado no banco, fora do log e da auditoria', async () => {
    const textos = planoDaComunidadeA(hoje()).pedidosDeOracao.map((p) => p.texto)
    const { rows } = await limpo.su.query<{ id: string; texto_cifrado: Buffer }>(
      'select id, texto_cifrado from uj.pedidos_oracao',
    )
    expect(rows).toHaveLength(textos.length)
    for (const r of rows) {
      expect(r.texto_cifrado[0]).toBe(1)
      for (const t of textos) {
        expect(r.texto_cifrado.includes(Buffer.from(t, 'utf8'))).toBe(false)
        expect(r.texto_cifrado.toString('hex')).not.toContain(Buffer.from(t).toString('hex'))
      }
    }
    // Decifra com a chave da API e o dado autenticado da rota (`oracao:<id>`), e só com eles.
    expect(
      rows.map((r) => decifrar(chaveDeOracao, r.texto_cifrado, `oracao:${r.id}`)).sort(),
    ).toEqual([...textos].sort())
    expect(() => decifrar(chaveDeOracao, rows[0]!.texto_cifrado, 'oracao:outro-id')).toThrow()
    expect(() =>
      decifrar(Buffer.alloc(32, 9), rows[0]!.texto_cifrado, `oracao:${rows[0]!.id}`),
    ).toThrow()
    // Nenhum trecho do texto no log de mudanças, na auditoria nem nas notificações.
    const rastros = (
      await limpo.su.query<{ t: string }>(
        `select coalesce((select string_agg(m::text, ' ') from uj.mudancas m), '')
             || coalesce((select string_agg(x::text, ' ') from uj.auditoria x), '')
             || coalesce((select string_agg(n::text, ' ') from uj.notificacoes n), '') as t`,
      )
    ).rows[0]!.t
    for (const t of textos) expect(rastros).not.toContain(t.slice(0, 20))
    const auditoria = await limpo.su.query<{ n: number }>(
      "select count(*)::int as n from uj.auditoria where acao = 'oracao.criado'",
    )
    expect(auditoria.rows[0]!.n).toBe(textos.length)
  })

  it('a API lê o que a semente gravou: oração decifrada, escalas e avisos no Início', async () => {
    const app = criarServidor(config, {
      api: limpo.api,
      auth: limpo.auth,
      correio: correioDesligado(),
      fatorDeLimitePorIp: 100,
    })
    await app.ready()
    try {
      const a = (
        await limpo.su.query<{ id: string }>('select id from uj.comunidades where nome = $1', [
          COMUNIDADE_A,
        ])
      ).rows[0]!.id
      // Entra com a senha que a semente imprimiu (é o que o revisor das lojas recebe).
      const entrar = async (email: string) => {
        const linha = credenciaisDaPrimeira.find((l) => l.includes(` ${email} `))
        const senha = linha?.match(/senha: (\S+)$/)?.[1]
        expect(senha, email).toBeDefined()
        const login = await app.inject({
          method: 'POST',
          url: '/api/auth/entrar',
          payload: { email, senha, plataforma: 'ios' },
        })
        expect(login.statusCode, email).toBe(200)
        return { authorization: `Bearer ${login.json().acesso as string}` }
      }
      const membro = await entrar('demo.membro@unijovem.invalid')
      const organizador = await entrar('demo.organizador@unijovem.invalid')
      // Figurante não entra: não tem senha.
      const figurante = await app.inject({
        method: 'POST',
        url: '/api/auth/entrar',
        payload: {
          email: FIGURANTES_DE_A[0]!.email,
          senha: 'qualquer coisa 2026',
          plataforma: 'ios',
        },
      })
      expect(figurante.statusCode).not.toBe(200)
      const get = (caminho: string, h: { authorization: string }) =>
        app.inject({ method: 'GET', url: `/api/v1/c/${a}${caminho}`, headers: h })

      const plano = planoDaComunidadeA(hoje())
      const deCarla = await get('/oracao', membro)
      expect(deCarla.statusCode).toBe(200)
      const pedidos = deCarla.json().pedidos as {
        texto: string | null
        visibilidade: string
        minha: boolean
        orando: { total: number; euEstouOrando: boolean }
      }[]
      // Carla vê os da comunidade e o dela "somente eu", todos com o texto decifrado.
      expect(pedidos.map((p) => p.texto).sort()).toEqual(
        plano.pedidosDeOracao.map((p) => p.texto).sort(),
      )
      expect(pedidos.filter((p) => p.visibilidade === 'somente_eu')).toHaveLength(1)
      expect(pedidos.some((p) => p.orando.euEstouOrando)).toBe(true)
      expect(pedidos.reduce((t, p) => t + p.orando.total, 0)).toBe(19)
      // Bruno não vê o "somente eu" da Carla.
      const deBruno = (await get('/oracao', organizador)).json().pedidos as unknown[]
      expect(deBruno).toHaveLength(plano.pedidosDeOracao.length - 1)

      const inicio = (await get('/inicio', membro)).json()
      expect(inicio.proximosEventos.length).toBe(5)
      expect(inicio.minhasEscalas.length).toBeGreaterThan(0)
      expect(inicio.minhasTarefas.length).toBeGreaterThan(0)
      expect(inicio.substituicoesAbertas).toBe(1)
      expect(inicio.avisos).toHaveLength(3)
      expect(inicio.avisos[0]).toMatchObject({ titulo: 'Ensaio do louvor às 15h', fixado: true })
      const escalas = (await get('/minhas-escalas', organizador)).json().escalas as {
        estado: string
      }[]
      expect(new Set(escalas.map((x) => x.estado))).toEqual(new Set(['confirmada', 'pendente']))
    } finally {
      await app.close()
    }
    // Três entradas com argon2 (duas certas, uma recusada): folga sob a suíte inteira.
  }, 90_000)

  it('rodar de novo não cria nada nem mexe em senha', async () => {
    const a = (
      await limpo.su.query<{ id: string }>('select id from uj.comunidades where nome = $1', [
        COMUNIDADE_A,
      ])
    ).rows[0]!.id
    const antes = {
      contas: (await limpo.su.query('select id, senha_hash from uj.contas order by id')).rows,
      conteudo: await contagens(limpo, a),
      auditoria: (await limpo.su.query('select count(*)::int as n from uj.auditoria')).rows,
      mudancas: (await limpo.su.query('select count(*)::int as n from uj.mudancas')).rows,
    }
    const r = await semearDemonstracao(limpo.dono, { chaveDeOracao })
    expect(r.criadas).toEqual([])
    expect(r.contagem).toEqual({})
    expect(r.credenciais).toEqual([])
    expect({
      contas: (await limpo.su.query('select id, senha_hash from uj.contas order by id')).rows,
      conteudo: await contagens(limpo, a),
      auditoria: (await limpo.su.query('select count(*)::int as n from uj.auditoria')).rows,
      mudancas: (await limpo.su.query('select count(*)::int as n from uj.mudancas')).rows,
    }).toEqual(antes)
    expect((await limpo.su.query('select count(*)::int as n from uj.comunidades')).rows[0].n).toBe(
      2,
    )
  })

  it('com outra ORACAO_CHAVE, recusa e não grava nada', async () => {
    const antes = (await limpo.su.query('select count(*)::int as n from uj.mudancas')).rows
    await expect(
      semearDemonstracao(limpo.dono, { chaveDeOracao: Buffer.alloc(32, 9) }),
    ).rejects.toThrow(/não decifra/)
    expect((await limpo.su.query('select count(*)::int as n from uj.mudancas')).rows).toEqual(antes)
  })
})

describe('semente de demonstração: base com a semente antiga', () => {
  it('só a A com as quatro contas: cria o resto; sem a chave, pula só a oração', async () => {
    // Retrato da primeira semente: a A com as quatro contas e nada mais.
    const a = (
      await antigo.su.query<{ id: string }>(
        'insert into uj.comunidades (nome) values ($1) returning id',
        [COMUNIDADE_A],
      )
    ).rows[0]!.id
    for (const p of PESSOAS_FICTICIAS.filter((x) =>
      x.vinculos.every((v) => v.comunidade === 'A'),
    )) {
      const conta = (
        await antigo.su.query<{ id: string }>(
          `insert into uj.contas (nome, email, email_verificado_em) values ($1, $2, now()) returning id`,
          [p.nome, p.email],
        )
      ).rows[0]!.id
      await antigo.su.query(
        'insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1, $2, $3)',
        [conta, a, p.vinculos[0]!.papel],
      )
    }

    const r = await semearDemonstracao(antigo.dono)
    expect(r.comunidades.A).toBe(a)
    expect(r.criadas.slice(0, 6)).toEqual([
      `comunidade ${COMUNIDADE_B}`,
      'conta demo.b.admin@unijovem.invalid',
      'vínculo demo.b.admin@unijovem.invalid em B',
      'conta demo.duas@unijovem.invalid',
      'vínculo demo.duas@unijovem.invalid em A',
      'vínculo demo.duas@unijovem.invalid em B',
    ])
    expect(r.credenciais).toHaveLength(2)
    expect(r.avisos).toEqual([expect.stringMatching(/Pedidos de oração não semeados/)])
    const { 'pedidos de oração': _p, intercessões: _i, ...semOracao } = CRIADO_NUMA_BASE_VAZIA
    expect(r.contagem).toEqual({
      ...semOracao,
      comunidades: 1,
      contas: 2 + FIGURANTES_DE_A.length,
      vínculos: 3 + FIGURANTES_DE_A.length,
    })

    // Com a chave, completa só a oração; depois, nada.
    const comChave = await semearDemonstracao(antigo.dono, { chaveDeOracao })
    expect(comChave.contagem).toEqual({ 'pedidos de oração': 6, intercessões: 19 })
    expect(comChave.credenciais).toEqual([])
    const outra = await semearDemonstracao(antigo.dono, { chaveDeOracao })
    expect(outra.criadas).toEqual([])
    expect(outra.contagem).toEqual({})
  })

  it('produção semeada em 15/11/2026: enriquece a A sem duplicar e sem tocar no resto', async () => {
    const b = producao
    const sabado = proximoSabado(hoje())
    const comunidade = async (nome: string) =>
      (
        await b.su.query<{ id: string }>(
          "insert into uj.comunidades (nome, fuso, validade_offline_dias) values ($1, 'America/Sao_Paulo', 7) returning id",
          [nome],
        )
      ).rows[0]!.id
    const a = await comunidade(COMUNIDADE_A)
    const vizinha = await comunidade(COMUNIDADE_B)
    // Uma comunidade de verdade no mesmo banco: a semente não pode encostar nela.
    const real = await comunidade('Jovens da Outra Igreja')
    const conta = async (nome: string, email: string) =>
      (
        await b.su.query<{ id: string }>(
          `insert into uj.contas (nome, email, email_verificado_em, senha_hash, faixa_etaria)
           values ($1, $2, now(), 'hash-da-semente-antiga', '18_mais') returning id`,
          [nome, email],
        )
      ).rows[0]!.id
    const vinculos: Record<string, string> = {}
    const contas: Record<string, string> = {}
    for (const p of PESSOAS_FICTICIAS) {
      contas[p.chave] = await conta(p.nome, p.email)
      for (const v of p.vinculos) {
        vinculos[`${p.chave}:${v.comunidade}`] = (
          await b.su.query<{ id: string }>(
            'insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1, $2, $3) returning id',
            [contas[p.chave], v.comunidade === 'A' ? a : vizinha, v.papel],
          )
        ).rows[0]!.id
      }
    }
    const pessoaReal = await conta('Pessoa Real', 'pessoa.real@exemplo.test')
    await b.su.query(
      "insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1, $2, 'admin')",
      [pessoaReal, real],
    )
    // O conteúdo da semente antiga em A (e o evento da B).
    const local = async (com: string, nome: string) =>
      (
        await b.su.query<{ id: string }>(
          "insert into uj.locais (comunidade_id, nome, tipo) values ($1, $2, 'interno') returning id",
          [com, nome],
        )
      ).rows[0]!.id
    const salao = await local(a, 'Salão da igreja')
    const evento = async (
      com: string,
      autor: string,
      titulo: string,
      data: string,
      hora: string,
      l: string,
    ) =>
      (
        await b.su.query<{ id: string }>(
          `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, status,
             visibilidade, local_id, criado_por)
           values ($1, $2, 'Programação de sábado', $3, 60, 'America/Sao_Paulo', 'publicado',
             'interna', $4, $5) returning id`,
          [com, titulo, instanteNoFuso(data, hora, FUSO), l, autor],
        )
      ).rows[0]!.id
    const sabadoAntigo = await evento(a, contas['admin']!, 'Sábado Jovem', sabado, '16:00', salao)
    let louvor = ''
    for (const [ordem, etapa] of MODELO_SABADO_PADRAO.etapas.entries()) {
      const id = (
        await b.su.query<{ id: string }>(
          `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min)
           values ($1, $2, $3, $4, $5) returning id`,
          [a, sabadoAntigo, ordem, etapa.titulo, etapa.duracaoMin],
        )
      ).rows[0]!.id
      if (etapa.titulo === 'Louvor') louvor = id
    }
    await b.su.query(
      `insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id, funcao)
       values ($1, $2, $3, $4, 'vocal'), ($1, $2, $3, $5, 'violão')`,
      [a, sabadoAntigo, louvor, vinculos['membro:A'], vinculos['organizador:A']],
    )
    await b.su.query(
      `insert into uj.tarefas (comunidade_id, evento_id, titulo, responsavel_vinculo_id)
       values ($1, $2, 'Imprimir a lição da semana', $3)`,
      [a, sabadoAntigo, vinculos['organizador:A']],
    )
    await evento(a, contas['admin']!, 'Noite de jogos', proximoSabado(hoje(), 1), '19:30', salao)
    await evento(
      vizinha,
      contas['admin_b']!,
      'Encontro da Vizinha',
      sabado,
      '19:00',
      await local(vizinha, 'Sala dos jovens'),
    )
    await evento(real, pessoaReal, 'Culto de domingo', sabado, '10:00', await local(real, 'Templo'))

    const foraAntes = await contagens(b, a, true)
    const rastrosAntes = (
      await b.su.query(
        `select (select count(*)::int from uj.mudancas where comunidade_id <> $1) as mudancas,
                (select count(*)::int from uj.notificacoes where comunidade_id <> $1) as notificacoes,
                (select count(*)::int from uj.auditoria where comunidade_id <> $1) as auditoria`,
        [a],
      )
    ).rows[0]
    const senhasAntes = (await b.su.query('select id, senha_hash from uj.contas order by id')).rows

    const r = await semearDemonstracao(b.dono, { chaveDeOracao })
    expect(r.credenciais).toEqual([])
    expect(r.criadas.filter((l) => l.startsWith('comunidade'))).toEqual([])
    expect(r.contagem).toMatchObject({
      contas: FIGURANTES_DE_A.length,
      vínculos: FIGURANTES_DE_A.length,
      locais: 1,
      eventos: 7,
      escalas: 62,
      tarefas: 12,
      'pedidos de oração': 6,
    })
    // Nada duplicado: um sábado e uma noite de jogos por dia, um salão.
    const repetidos = await b.su.query(
      `select titulo, (inicio at time zone fuso)::date as dia, count(*)::int as n
         from uj.eventos where comunidade_id = $1 group by 1, 2 having count(*) > 1`,
      [a],
    )
    expect(repetidos.rows).toEqual([])
    expect((await contagens(b, a)).locais).toBe(2)
    expect((await contagens(b, a)).eventos).toBe(9)
    // O que já existia fica como estava: as duas escalas antigas seguem pendentes.
    const antigas = await b.su.query<{ funcao: string; estado: string }>(
      "select funcao, estado from uj.atribuicoes where evento_id = $1 and funcao in ('vocal', 'violão') order by funcao",
      [sabadoAntigo],
    )
    expect(antigas.rows).toEqual([
      { funcao: 'violão', estado: 'pendente' },
      { funcao: 'vocal', estado: 'pendente' },
    ])
    const noSabadoAntigo = (
      await b.su.query(
        `select (select count(*)::int from uj.atribuicoes where evento_id = $1) as escalas,
                (select count(*)::int from uj.tarefas where evento_id = $1) as tarefas,
                (select count(*)::int from uj.checklist_itens where evento_id = $1) as checklist,
                (select count(*)::int from uj.etapas where evento_id = $1) as etapas`,
        [sabadoAntigo],
      )
    ).rows[0]
    expect(noSabadoAntigo).toEqual({ escalas: 11, tarefas: 3, checklist: 7, etapas: 7 })
    // Fora da demonstração A, nada mudou: nem conteúdo, nem log, nem notificação, nem auditoria.
    expect(await contagens(b, a, true)).toEqual(foraAntes)
    expect(
      (
        await b.su.query(
          `select (select count(*)::int from uj.mudancas where comunidade_id <> $1) as mudancas,
                  (select count(*)::int from uj.notificacoes where comunidade_id <> $1) as notificacoes,
                  (select count(*)::int from uj.auditoria where comunidade_id <> $1) as auditoria`,
          [a],
        )
      ).rows[0],
    ).toEqual(rastrosAntes)
    expect(
      (
        await b.su.query(
          'select id, senha_hash from uj.contas where senha_hash is not null order by id',
        )
      ).rows,
    ).toEqual(senhasAntes)

    const deNovo = await semearDemonstracao(b.dono, { chaveDeOracao })
    expect(deNovo.criadas).toEqual([])
    expect(deNovo.contagem).toEqual({})
  })
})
