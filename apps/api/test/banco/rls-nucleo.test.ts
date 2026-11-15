import { createHmac, randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  concederProva,
  criarComunidade,
  criarConta,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'

/**
 * Prova as regras do núcleo DIRETAMENTE no banco, como `uj_api` e `uj_auth`,
 * sem passar pela API. Se a API errar uma checagem, isto é o que ainda segura.
 */

let b: BancoDeTeste
let criador: string
let provaDoCriador: string
let adminA: string
let adminA2: string
let membroA: string
let membroAB: string
let adminB: string
let comA: string
let comB: string

beforeAll(async () => {
  b = await novoBanco()
  criador = await criarConta(b, 'Criador', { proprietario: true })
  provaDoCriador = await concederProva(b, criador)
  adminA = await criarConta(b, 'Admin A')
  adminA2 = await criarConta(b, 'Admin A dois')
  membroA = await criarConta(b, 'Membro A')
  membroAB = await criarConta(b, 'Membro de A e B')
  adminB = await criarConta(b, 'Admin B')
  comA = await criarComunidade(b, 'Comunidade A')
  comB = await criarComunidade(b, 'Comunidade B')
  await vincular(b, adminA, comA, 'admin')
  await vincular(b, adminA2, comA, 'admin')
  await vincular(b, membroA, comA, 'membro')
  await vincular(b, membroAB, comA, 'membro')
  await vincular(b, membroAB, comB, 'admin')
  await vincular(b, adminB, comB, 'admin')
  await vincular(b, criador, comA, 'membro')
})

afterAll(async () => {
  await b.encerrar()
})

const erroDe = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
  } catch (e) {
    const err = e as Error & { code?: string }
    return `${err.code ?? ''} ${err.message}`
  }
  throw new Error('era esperado um erro')
}

const hmac = (token: string) => createHmac('sha256', 'segredo-de-teste').update(token).digest()

async function criarConvite(
  comunidadeId: string,
  papel: string,
  opcoes: { email?: string; expiraEm?: string } = {},
): Promise<Buffer> {
  const token = hmac(randomBytes(16).toString('hex'))
  await b.su.query(
    `insert into uj.convites (comunidade_id, papel, email_destino, token_hmac, expira_em, criado_por)
     values ($1, $2, $3, $4, coalesce($5::timestamptz, now() + interval '7 days'), $6)`,
    [comunidadeId, papel, opcoes.email ?? null, token, opcoes.expiraEm ?? null, adminA],
  )
  return token
}

describe('papéis do banco', () => {
  it('uj_api e uj_auth não são superusuário, não ignoram RLS e não são donos de nada', async () => {
    const { rows } = await b.su.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      "select rolsuper, rolbypassrls from pg_roles where rolname in ('uj_api','uj_auth')",
    )
    expect(rows).toHaveLength(2)
    for (const r of rows) expect([r.rolsuper, r.rolbypassrls]).toEqual([false, false])
    const donos = await b.su.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'uj' and pg_get_userbyid(c.relowner) in ('uj_api','uj_auth')`,
    )
    expect(donos.rows).toEqual([])
  })

  it('nenhuma função de uj é executável por PUBLIC', async () => {
    const { rows } = await b.su.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'uj' and has_function_privilege('public', p.oid, 'execute')`,
    )
    expect(rows).toEqual([])
  })
})

describe('sem contexto, nada aparece', () => {
  it.each(['contas', 'comunidades', 'vinculos', 'convites', 'auditoria', 'mudancas', 'sessoes'])(
    '%s',
    async (tabela) => {
      expect(await b.comoApi({}, `select * from uj.${tabela}`)).toEqual([])
    },
  )
})

describe('isolamento entre comunidades', () => {
  it('membro de A no contexto A vê os vínculos de A e nenhum de B', async () => {
    const linhas = await b.comoApi<{ comunidade_id: string }>(
      { contaId: membroA, comunidadeId: comA },
      'select comunidade_id from uj.vinculos',
    )
    expect(linhas.length).toBeGreaterThan(1)
    expect(new Set(linhas.map((l) => l.comunidade_id))).toEqual(new Set([comA]))
  })

  it('membro de A que põe B no contexto não vê nada de B', async () => {
    const linhas = await b.comoApi(
      { contaId: membroA, comunidadeId: comB },
      'select conta_id from uj.vinculos where comunidade_id = $1',
      [comB],
    )
    expect(linhas).toEqual([])
  })

  it('quem está em A e B, no contexto A, não vê vínculos de terceiros em B', async () => {
    const linhas = await b.comoApi<{ conta_id: string }>(
      { contaId: membroAB, comunidadeId: comA },
      'select conta_id from uj.vinculos where comunidade_id = $1',
      [comB],
    )
    expect(linhas.map((l) => l.conta_id)).toEqual([membroAB])
  })

  it('lista de comunidades mostra só as que a pessoa participa', async () => {
    const linhas = await b.comoApi<{ id: string }>(
      { contaId: membroA },
      'select id from uj.comunidades',
    )
    expect(linhas.map((l) => l.id)).toEqual([comA])
  })

  it('admin de A não cria convite para B, nem trocando o contexto para B', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA, comunidadeId: comB },
        `insert into uj.convites (comunidade_id, papel, token_hmac, expira_em, criado_por)
         values ($1, 'membro', 'x', now() + interval '7 days', $2)`,
        [comB, adminA],
      ),
    )
    expect(msg).toMatch(/row-level security/)
  })

  it('log de mudanças respeita a comunidade do contexto', async () => {
    const linhas = await b.comoApi<{ comunidade_id: string }>(
      { contaId: membroAB, comunidadeId: comB },
      'select distinct comunidade_id from uj.mudancas',
    )
    expect(linhas.map((l) => l.comunidade_id)).toEqual([comB])
  })

  it('membro não vê no log a existência de mudanças de convites (nível 30)', async () => {
    await criarConvite(comA, 'membro')
    const deMembro = await b.comoApi<{ tabela: string }>(
      { contaId: membroA, comunidadeId: comA },
      "select tabela from uj.mudancas where tabela = 'convites'",
    )
    expect(deMembro).toEqual([])
    const deAdmin = await b.comoApi<{ tabela: string }>(
      { contaId: adminA, comunidadeId: comA },
      "select tabela from uj.mudancas where tabela = 'convites'",
    )
    expect(deAdmin.length).toBeGreaterThan(0)
  })
})

describe('convites pela API (uj_api)', () => {
  it('membro não cria convite', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: membroA, comunidadeId: comA },
        `insert into uj.convites (comunidade_id, papel, token_hmac, expira_em, criado_por)
         values ($1, 'admin', 'y', now() + interval '7 days', $2)`,
        [comA, membroA],
      ),
    )
    expect(msg).toMatch(/row-level security/)
  })

  it('admin cria convite na própria comunidade, mas não em nome de outra pessoa', async () => {
    await b.comoApi(
      { contaId: adminA, comunidadeId: comA },
      `insert into uj.convites (comunidade_id, papel, token_hmac, expira_em, criado_por)
       values ($1, 'organizador', 'z', now() + interval '7 days', $2)`,
      [comA, adminA],
    )
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA, comunidadeId: comA },
        `insert into uj.convites (comunidade_id, papel, token_hmac, expira_em, criado_por)
         values ($1, 'membro', 'w', now() + interval '7 days', $2)`,
        [comA, adminA2],
      ),
    )
    expect(msg).toMatch(/row-level security/)
  })

  it('convite com validade acima de 7 dias é recusado', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA, comunidadeId: comA },
        `insert into uj.convites (comunidade_id, papel, token_hmac, expira_em, criado_por)
         values ($1, 'membro', 'longo', now() + interval '8 days', $2)`,
        [comA, adminA],
      ),
    )
    expect(msg).toMatch(/check constraint/)
  })

  it('uj_api não altera usos nem a validade de um convite', async () => {
    expect(
      await erroDe(
        b.comoApi({ contaId: adminA, comunidadeId: comA }, 'update uj.convites set usos = 0'),
      ),
    ).toMatch(/permission denied/)
    expect(
      await erroDe(
        b.comoApi(
          { contaId: adminA, comunidadeId: comA },
          "update uj.convites set expira_em = now() + interval '1 day'",
        ),
      ),
    ).toMatch(/permission denied/)
  })

  it('revogação registra quem revogou e não pode ser desfeita', async () => {
    const token = await criarConvite(comA, 'membro')
    const r = await b.comoApi<{ revogado_por: string }>(
      { contaId: adminA, comunidadeId: comA },
      'update uj.convites set revogado_em = now() where token_hmac = $1 returning revogado_por',
      [token],
    )
    expect(r).toEqual([{ revogado_por: adminA }])
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA, comunidadeId: comA },
        'update uj.convites set revogado_em = null where token_hmac = $1',
        [token],
      ),
    )
    expect(msg).toMatch(/irreversivel/)
  })
})

describe('aceite de convite (uj_auth, funções atômicas)', () => {
  it('uj_auth não faz DML direto em vínculos, convites ou comunidades', async () => {
    expect(
      await erroDe(
        b.auth.query(
          "insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1,$2,'admin')",
          [membroA, comB],
        ),
      ),
    ).toMatch(/permission denied/)
    expect(await erroDe(b.auth.query('select * from uj.convites'))).toMatch(/permission denied/)
    expect(await erroDe(b.auth.query('select * from uj.comunidades'))).toMatch(/permission denied/)
    expect(await erroDe(b.auth.query('select * from uj.mudancas'))).toMatch(/permission denied/)
  })

  it('uj_auth não se torna proprietário nem desativa contas', async () => {
    expect(
      await erroDe(
        b.auth.query('update uj.contas set plataforma_proprietario = true where id = $1', [
          membroA,
        ]),
      ),
    ).toMatch(/permission denied/)
    expect(
      await erroDe(
        b.auth.query("update uj.contas set estado = 'desativada' where id = $1", [membroA]),
      ),
    ).toMatch(/permission denied/)
  })

  it('uj_auth não lê provas de plataforma', async () => {
    expect(await erroDe(b.auth.query('select * from uj.provas_de_plataforma'))).toMatch(
      /permission denied/,
    )
  })

  it('consultar_convite informa a situação sem precisar de vínculo', async () => {
    const valido = await criarConvite(comA, 'organizador')
    const { rows } = await b.auth.query('select papel, situacao from uj.consultar_convite($1)', [
      valido,
    ])
    expect(rows).toEqual([{ papel: 'organizador', situacao: 'valido' }])
    const inexistente = await b.auth.query('select * from uj.consultar_convite($1)', [hmac('nada')])
    expect(inexistente.rows).toEqual([])
  })

  it('conta nova por convite: cria conta e vínculo com o papel do convite', async () => {
    const token = await criarConvite(comA, 'organizador')
    const { rows } = await b.auth.query<{ conta_id: string; vinculo_id: string }>(
      `select * from uj.criar_conta_por_convite($1, 'Pessoa Nova', 'Nova@Exemplo.test', '+5511999990000', 'hash')`,
      [token],
    )
    const v = await b.su.query('select papel, estado from uj.vinculos where id = $1', [
      rows[0]!.vinculo_id,
    ])
    expect(v.rows).toEqual([{ papel: 'organizador', estado: 'ativo' }])
    const c = await b.su.query('select email from uj.contas where id = $1', [rows[0]!.conta_id])
    expect(c.rows).toEqual([{ email: 'nova@exemplo.test' }])
  })

  it('convite inválido não deixa conta criada para trás', async () => {
    const msg = await erroDe(
      b.auth.query(
        `select * from uj.criar_conta_por_convite($1, 'Fantasma', 'fantasma@exemplo.test', null, 'hash')`,
        [hmac('inexistente')],
      ),
    )
    expect(msg).toMatch(/UJ001/)
    const { rows } = await b.su.query(
      "select 1 from uj.contas where email = 'fantasma@exemplo.test'",
    )
    expect(rows).toEqual([])
  })

  it('expirado, revogado e já usado não concedem vínculo', async () => {
    const pessoa = await criarConta(b, 'Pessoa convites')
    const expirado = await criarConvite(comB, 'membro')
    await b.su.query(
      "update uj.convites set expira_em = criado_em + interval '1 second' where token_hmac = $1",
      [expirado],
    )
    await new Promise((r) => setTimeout(r, 1100))
    expect(
      await erroDe(b.auth.query('select uj.aceitar_convite($1, $2)', [expirado, pessoa])),
    ).toMatch(/UJ001/)

    const revogado = await criarConvite(comB, 'membro')
    await b.su.query('update uj.convites set revogado_em = now() where token_hmac = $1', [revogado])
    expect(
      await erroDe(b.auth.query('select uj.aceitar_convite($1, $2)', [revogado, pessoa])),
    ).toMatch(/UJ001/)

    const unico = await criarConvite(comB, 'membro')
    await b.auth.query('select uj.aceitar_convite($1, $2)', [unico, pessoa])
    const outra = await criarConta(b, 'Outra pessoa')
    expect(await erroDe(b.auth.query('select uj.aceitar_convite($1, $2)', [unico, outra]))).toMatch(
      /UJ001/,
    )
  })

  it('convite para um e-mail não serve para outra conta', async () => {
    const token = await criarConvite(comB, 'membro', { email: 'alguem@exemplo.test' })
    const pessoa = await criarConta(b, 'Pessoa errada')
    expect(
      await erroDe(b.auth.query('select uj.aceitar_convite($1, $2)', [token, pessoa])),
    ).toMatch(/UJ002/)
    const usos = await b.su.query('select usos from uj.convites where token_hmac = $1', [token])
    expect(usos.rows).toEqual([{ usos: 0 }])
  })

  it('quem já participa não consome o convite', async () => {
    const token = await criarConvite(comA, 'admin')
    expect(
      await erroDe(b.auth.query('select uj.aceitar_convite($1, $2)', [token, membroA])),
    ).toMatch(/UJ003/)
    const usos = await b.su.query('select usos from uj.convites where token_hmac = $1', [token])
    expect(usos.rows).toEqual([{ usos: 0 }])
  })

  it('quem saiu volta pelo convite, com o papel do convite e sem designações antigas', async () => {
    const pessoa = await criarConta(b, 'Volta')
    await vincular(b, pessoa, comB, 'organizador')
    await b.su.query(
      "update uj.vinculos set estado = 'removido', designacoes = '{equipe_oracao}' where conta_id = $1",
      [pessoa],
    )
    const token = await criarConvite(comB, 'membro')
    await b.auth.query('select uj.aceitar_convite($1, $2)', [token, pessoa])
    const { rows } = await b.su.query(
      'select papel, estado, designacoes from uj.vinculos where conta_id = $1',
      [pessoa],
    )
    expect(rows).toEqual([{ papel: 'membro', estado: 'ativo', designacoes: [] }])
  })

  it('dois aceites simultâneos do mesmo convite: só um vínculo', async () => {
    const token = await criarConvite(comB, 'membro')
    const p1 = await criarConta(b, 'Corrida um')
    const p2 = await criarConta(b, 'Corrida dois')
    const resultados = await Promise.allSettled([
      b.auth.query('select uj.aceitar_convite($1, $2)', [token, p1]),
      b.auth.query('select uj.aceitar_convite($1, $2)', [token, p2]),
    ])
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const { rows } = await b.su.query(
      'select count(*)::int as n from uj.vinculos where convite_id = (select id from uj.convites where token_hmac = $1)',
      [token],
    )
    expect(rows).toEqual([{ n: 1 }])
  })

  it('o aceite fica na auditoria', async () => {
    const { rows } = await b.su.query(
      "select count(*)::int as n from uj.auditoria where acao = 'convite.aceito'",
    )
    expect(rows[0]!.n).toBeGreaterThan(0)
  })
})

describe('papéis e vínculos', () => {
  it('membro não altera o próprio papel', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: membroA, comunidadeId: comA },
        "update uj.vinculos set papel = 'admin' where conta_id = $1",
        [membroA],
      ),
    )
    expect(msg).toMatch(/proprio papel/)
  })

  it('membro não altera o papel de outra pessoa (RLS filtra: nada muda)', async () => {
    await b.comoApi(
      { contaId: membroA, comunidadeId: comA },
      "update uj.vinculos set papel = 'membro' where conta_id = $1",
      [adminA2],
    )
    const { rows } = await b.su.query('select papel from uj.vinculos where conta_id = $1', [
      adminA2,
    ])
    expect(rows[0]).toEqual({ papel: 'admin' })
  })

  it('admin não altera o próprio papel', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA, comunidadeId: comA },
        "update uj.vinculos set papel = 'membro' where conta_id = $1 and comunidade_id = $2",
        [adminA, comA],
      ),
    )
    expect(msg).toMatch(/proprio papel/)
  })

  it('admin promove membro a organizador', async () => {
    const r = await b.comoApi(
      { contaId: adminA, comunidadeId: comA },
      "update uj.vinculos set papel = 'organizador' where conta_id = $1 and comunidade_id = $2 returning papel",
      [membroA, comA],
    )
    expect(r).toEqual([{ papel: 'organizador' }])
  })

  it('membro pode sair, mas não trocar o próprio estado para outro valor', async () => {
    const membroSai = await criarConta(b, 'Membro que sai')
    await vincular(b, membroSai, comA, 'membro')
    const msg = await erroDe(
      b.comoApi(
        { contaId: membroSai, comunidadeId: comA },
        "update uj.vinculos set estado = 'desativado' where conta_id = $1",
        [membroSai],
      ),
    )
    expect(msg).toMatch(/sair/)
    const r = await b.comoApi(
      { contaId: membroSai, comunidadeId: comA },
      "update uj.vinculos set estado = 'removido' where conta_id = $1 returning estado",
      [membroSai],
    )
    expect(r).toEqual([{ estado: 'removido' }])
  })

  it('admin não rebaixa nem remove o vínculo do Criador', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA, comunidadeId: comA },
        "update uj.vinculos set estado = 'removido' where conta_id = $1 and comunidade_id = $2",
        [criador, comA],
      ),
    )
    expect(msg).toMatch(/protegido/)
  })

  it('uj_api não consegue se tornar proprietário (privilégio de coluna)', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: membroA },
        'update uj.contas set plataforma_proprietario = true where id = $1',
        [membroA],
      ),
    )
    expect(msg).toMatch(/permission denied/)
  })
})

describe('Criador e prova de 2FA', () => {
  it('sem a prova, o Criador cria comunidade (ADR 0007), mas não suspende nem intervém', async () => {
    // Sem RETURNING: ler comunidade alheia continua pedindo vínculo ou a prova.
    await b.comoApi(
      { contaId: criador },
      "insert into uj.comunidades (nome, criado_por) values ('Sem prova', $1)",
      [criador],
    )
    const criada = await b.su.query(
      "select verificacao from uj.comunidades where nome = 'Sem prova' and criado_por = $1",
      [criador],
    )
    expect(criada.rows).toEqual([{ verificacao: 'verificada' }])
    // Suspender: a RLS não deixa o Criador sem a prova tocar a comunidade.
    expect(
      await b.comoApi(
        { contaId: criador },
        "update uj.comunidades set estado = 'suspensa' where id = $1 returning id",
        [comA],
      ),
    ).toEqual([])
    // Intervenção (nomear admin): também não.
    const msg = await erroDe(
      b.comoApi(
        { contaId: criador, comunidadeId: comB },
        "insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1, $2, 'admin')",
        [adminA, comB],
      ),
    )
    expect(msg).toMatch(/row-level security/)
  })

  it('prova de outra conta ou inventada não vale', async () => {
    const suspender = (prova: string) =>
      b.comoApi(
        { contaId: criador, prova },
        "update uj.comunidades set estado = 'suspensa' where id = $1 returning id",
        [comA],
      )
    expect(await suspender('inventada')).toEqual([])
    // Forjar app.conta_id como o Criador, com a prova de outra pessoa, também não.
    const provaDeOutro = await concederProva(b, adminA)
    expect(await suspender(provaDeOutro)).toEqual([])
  })

  it('com a prova, o Criador cria comunidade', async () => {
    const r = await b.comoApi<{ nome: string }>(
      { contaId: criador, prova: provaDoCriador },
      "insert into uj.comunidades (nome, criado_por) values ('Nova do Criador', $1) returning nome",
      [criador],
    )
    expect(r).toEqual([{ nome: 'Nova do Criador' }])
  })

  it('nem com a prova o Criador se concede papel ou designação', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: criador, comunidadeId: comA, prova: provaDoCriador },
        "update uj.vinculos set designacoes = '{equipe_oracao}' where conta_id = $1 and comunidade_id = $2",
        [criador, comA],
      ),
    )
    expect(msg).toMatch(/proprio papel/)
    const msg2 = await erroDe(
      b.comoApi(
        { contaId: criador, comunidadeId: comB, prova: provaDoCriador },
        "insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1, $2, 'admin')",
        [criador, comB],
      ),
    )
    expect(msg2).toMatch(/proprio papel/)
  })

  it('fora do modo de intervenção o Criador não lista membros de outras comunidades', async () => {
    const r = await b.comoApi(
      { contaId: criador, comunidadeId: comA, prova: provaDoCriador },
      'select conta_id from uj.vinculos where comunidade_id = $1',
      [comB],
    )
    expect(r).toEqual([])
  })
})

describe('último administrador', () => {
  it('o único admin não sai deixando a comunidade sem admin', async () => {
    await b.comoApi(
      { contaId: membroAB, comunidadeId: comB },
      "update uj.vinculos set estado = 'removido' where conta_id = $1 and comunidade_id = $2",
      [membroAB, comB],
    )
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminB, comunidadeId: comB },
        "update uj.vinculos set estado = 'removido' where conta_id = $1 and comunidade_id = $2",
        [adminB, comB],
      ),
    )
    expect(msg).toMatch(/sem administrador/)
  })

  it('desativar a conta do único admin também é recusado', async () => {
    const msg = await erroDe(
      b.su.query("update uj.contas set estado = 'desativada' where id = $1", [adminB]),
    )
    expect(msg).toMatch(/sem administrador/)
  })

  it('dois admins se rebaixando ao mesmo tempo: a comunidade continua com um', async () => {
    const c = await criarComunidade(b, 'Comunidade da corrida')
    const x = await criarConta(b, 'Admin X')
    const y = await criarConta(b, 'Admin Y')
    await vincular(b, x, c, 'admin')
    await vincular(b, y, c, 'admin')
    // Duas transações abertas AO MESMO TEMPO, cada uma vendo a outra pessoa
    // ainda como admin (o cenário de "write skew" em READ COMMITTED).
    const t1 = await b.api.connect()
    const t2 = await b.api.connect()
    const abrir = async (cli: typeof t1, ator: string) => {
      await cli.query('begin')
      await cli.query(
        "select set_config('app.conta_id', $1, true), set_config('app.comunidade_id', $2, true)",
        [ator, c],
      )
    }
    const sql = "update uj.vinculos set papel = 'membro' where conta_id = $1 and comunidade_id = $2"
    try {
      await abrir(t1, x)
      await abrir(t2, y)
      // Os dois veem o outro como admin antes de qualquer confirmação.
      const r1 = await t1.query(sql, [y, c]) // X rebaixa Y; trava a comunidade
      expect(r1.rowCount).toBe(1)
      const segundo = t2.query(sql, [x, c]) // Y rebaixa X; espera a trava de T1
      await new Promise((r) => setTimeout(r, 200))
      await t1.query('commit')
      const erro = await segundo.then(
        () => null,
        (e: Error) => e.message,
      )
      expect(erro).toMatch(/sem administrador/)
      await t2.query('rollback')
    } finally {
      t1.release()
      t2.release()
    }
    const { rows } = await b.su.query(
      "select count(*)::int as n from uj.vinculos where comunidade_id = $1 and papel = 'admin'",
      [c],
    )
    expect(rows).toEqual([{ n: 1 }])
  })

  it('o Criador, em intervenção com prova, pode rebaixar o último admin', async () => {
    const r = await b.comoApi(
      { contaId: criador, comunidadeId: comB, prova: provaDoCriador },
      "update uj.vinculos set papel = 'membro' where conta_id = $1 and comunidade_id = $2 returning papel",
      [adminB, comB],
    )
    expect(r).toEqual([{ papel: 'membro' }])
  })
})

describe('ciclo de vida da comunidade', () => {
  it('admin edita o nome, mas não suspende', async () => {
    const r = await b.comoApi<{ versao: number }>(
      { contaId: adminA, comunidadeId: comA },
      "update uj.comunidades set nome = 'Comunidade A (nova)' where id = $1 returning versao",
      [comA],
    )
    expect(r[0]!.versao).toBeGreaterThan(1)
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA, comunidadeId: comA },
        "update uj.comunidades set estado = 'suspensa' where id = $1",
        [comA],
      ),
    )
    expect(msg).toMatch(/exclusivo do proprietario/)
  })

  it('conta comum não insere comunidade direto (só pela função de criação)', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA },
        "insert into uj.comunidades (nome, criado_por) values ('Nova', $1)",
        [adminA],
      ),
    )
    expect(msg).toMatch(/row-level security/)
  })

  it('modo de entrada `livre` continua não habilitado; os da ADR 0007 sim', async () => {
    const msg = await erroDe(
      b.su.query("update uj.comunidades set modo_entrada = 'livre' where id = $1", [comA]),
    )
    expect(msg).toMatch(/nao habilitado/)
    // 'solicitacao' saiu do enum (virou codigo_com_aprovacao).
    const msg2 = await erroDe(
      b.su.query("update uj.comunidades set modo_entrada = 'solicitacao' where id = $1", [comA]),
    )
    // O gatilho recusa antes da restrição: 'solicitacao' saiu dos modos.
    expect(msg2).toMatch(/nao habilitado|check constraint/)
    for (const modo of ['codigo_com_aprovacao', 'codigo_direto', 'convite']) {
      await b.su.query('update uj.comunidades set modo_entrada = $2 where id = $1', [comA, modo])
    }
  })

  it('fuso inexistente é recusado', async () => {
    const msg = await erroDe(
      b.su.query("update uj.comunidades set fuso = 'Marte/Olympus' where id = $1", [comA]),
    )
    expect(msg).toMatch(/time zone/)
  })

  it('suspensa: membro ainda lê, admin não grava', async () => {
    const c = await criarComunidade(b, 'Comunidade suspensa')
    const adm = await criarConta(b, 'Admin suspensa')
    await vincular(b, adm, c, 'admin')
    await b.comoApi(
      { contaId: criador, prova: provaDoCriador },
      "update uj.comunidades set estado = 'suspensa' where id = $1",
      [c],
    )
    const lidas = await b.comoApi(
      { contaId: adm, comunidadeId: c },
      'select id from uj.vinculos where comunidade_id = $1',
      [c],
    )
    expect(lidas).toHaveLength(1)
    const alteradas = await b.comoApi(
      { contaId: adm, comunidadeId: c },
      "update uj.comunidades set nome = 'x tentativa' where id = $1 returning id",
      [c],
    )
    expect(alteradas).toEqual([])
  })
})

describe('sessões', () => {
  it('revogação de sessão não pode ser desfeita', async () => {
    const { rows } = await b.su.query<{ id: string }>(
      `insert into uj.sessoes (conta_id, familia, refresh_hash, expira_em)
       values ($1, gen_random_uuid(), $2, now() + interval '90 days') returning id`,
      [membroA, randomBytes(32)],
    )
    const id = rows[0]!.id
    await b.comoApi(
      { contaId: membroA },
      'update uj.sessoes set revogada_em = now() where id = $1',
      [id],
    )
    const msg = await erroDe(
      b.comoApi({ contaId: membroA }, 'update uj.sessoes set revogada_em = null where id = $1', [
        id,
      ]),
    )
    expect(msg).toMatch(/irreversivel/)
  })
})

describe('auditoria só-inserção', () => {
  it('insere com a própria conta na comunidade do contexto; não forja autor nem comunidade', async () => {
    await b.comoApi(
      { contaId: adminA, comunidadeId: comA },
      "insert into uj.auditoria (conta_id, comunidade_id, acao) values ($1, $2, 'teste.registro')",
      [adminA, comA],
    )
    expect(
      await erroDe(
        b.comoApi(
          { contaId: adminA, comunidadeId: comA },
          "insert into uj.auditoria (conta_id, comunidade_id, acao) values ($1, $2, 'teste.registro')",
          [adminA2, comA],
        ),
      ),
    ).toMatch(/row-level security/)
    expect(
      await erroDe(
        b.comoApi(
          { contaId: adminA, comunidadeId: comA },
          "insert into uj.auditoria (conta_id, comunidade_id, acao) values ($1, $2, 'teste.registro')",
          [adminA, comB],
        ),
      ),
    ).toMatch(/row-level security/)
    expect(
      await erroDe(
        b.comoApi(
          { contaId: adminA, comunidadeId: comA },
          "insert into uj.auditoria (conta_id, comunidade_id, acao, momento) values ($1, $2, 'teste.registro', now() - interval '1 year')",
          [adminA, comA],
        ),
      ),
    ).toMatch(/permission denied/)
  })

  it('nem o dono do esquema altera ou apaga auditoria', async () => {
    expect(await erroDe(b.dono.query("update uj.auditoria set acao = 'x.y'"))).toMatch(
      /só-inserção/,
    )
    expect(await erroDe(b.dono.query('delete from uj.auditoria'))).toMatch(/só-inserção/)
    expect(await erroDe(b.dono.query('truncate uj.auditoria'))).toMatch(/só-inserção/)
  })

  it('membro não lê auditoria; admin lê a da sua comunidade', async () => {
    expect(
      await b.comoApi({ contaId: membroAB, comunidadeId: comA }, 'select id from uj.auditoria'),
    ).toEqual([])
    const lidas = await b.comoApi<{ comunidade_id: string }>(
      { contaId: adminA, comunidadeId: comA },
      'select comunidade_id from uj.auditoria',
    )
    expect(lidas.length).toBeGreaterThan(0)
    expect(new Set(lidas.map((l) => l.comunidade_id))).toEqual(new Set([comA]))
  })
})

describe('cursor de sincronização', () => {
  it('transação mais antiga que confirma depois não fica para trás do limite', async () => {
    const c = await criarComunidade(b, 'Comunidade do cursor')
    const lenta = await b.su.connect()
    const consulta =
      "select id from uj.mudancas where comunidade_id = $1 and tabela = 't' and xact < $2::xid8"
    const limite = async () =>
      (
        await b.su.query<{ limite: string }>(
          'select pg_snapshot_xmin(pg_current_snapshot())::text as limite',
        )
      ).rows[0]!.limite
    try {
      await lenta.query('begin')
      // Transação "lenta" grava primeiro (xact menor), mas confirma por último.
      await lenta.query(
        "insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao) values ($1, 't', gen_random_uuid(), 'I')",
        [c],
      )
      await b.su.query(
        "insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao) values ($1, 't', gen_random_uuid(), 'I')",
        [c],
      )
      // Enquanto a lenta está aberta, nenhuma das duas passa do limite: a mais
      // nova (já confirmada) espera, para o cursor não pular a lenta.
      const durante = await b.su.query(consulta, [c, await limite()])
      expect(durante.rows).toEqual([])
      await lenta.query('commit')
    } finally {
      lenta.release()
    }
    // A marca d'água é do cluster inteiro: transações de outros testes em
    // paralelo podem atrasá-la (D13: atraso, nunca perda). Espera até 30 s:
    // com a suíte inteira e a máquina carregada, 10 s já não bastaram.
    let visiveis = 0
    for (let i = 0; i < 300 && visiveis < 2; i++) {
      visiveis = (await b.su.query(consulta, [c, await limite()])).rows.length
      if (visiveis < 2) await new Promise((r) => setTimeout(r, 100))
    }
    expect(visiveis).toBe(2)
  }, 60_000)
})
