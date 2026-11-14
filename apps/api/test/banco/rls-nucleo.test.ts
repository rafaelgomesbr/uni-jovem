import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  criarComunidade,
  criarConta,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'

/**
 * Prova as regras do núcleo DIRETAMENTE no banco, como `uj_api`, sem passar
 * pela API. Se a API errar uma checagem, isto é o que ainda segura.
 */

let b: BancoDeTeste
let criador: string
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
    return (e as Error).message
  }
  throw new Error('era esperado um erro')
}

describe('papéis do banco', () => {
  it('uj_api e uj_auth não são superusuário, não ignoram RLS e não são donos de nada', async () => {
    const { rows } = await b.su.query<{
      rolname: string
      rolsuper: boolean
      rolbypassrls: boolean
    }>("select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('uj_api','uj_auth')")
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r.rolsuper).toBe(false)
      expect(r.rolbypassrls).toBe(false)
    }
    const donos = await b.su.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'uj' and pg_get_userbyid(c.relowner) in ('uj_api','uj_auth')`,
    )
    expect(donos.rows).toEqual([])
  })

  it('toda tabela do esquema uj tem RLS habilitada', async () => {
    const { rows } = await b.su.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'uj' and c.relkind = 'r' and not c.relrowsecurity`,
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
    const linhas = await b.comoApi<{ conta_id: string }>(
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
    // Só o próprio vínculo (a pessoa sempre enxerga os seus).
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
})

describe('convites', () => {
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

  it('uj_api não altera usos de um convite (só revogação)', async () => {
    const msg = await erroDe(
      b.comoApi({ contaId: adminA, comunidadeId: comA }, 'update uj.convites set usos = 0'),
    )
    expect(msg).toMatch(/permission denied/)
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

  it('membro pode sair, mas não se reativar nem trocar de estado para outro valor', async () => {
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

  it('a conta do Criador é intocável por admin de comunidade', async () => {
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

describe('último administrador', () => {
  it('o único admin não sai deixando a comunidade sem admin', async () => {
    // Em B há dois admins (membroAB e adminB). O primeiro sai: permitido.
    await b.comoApi(
      { contaId: membroAB, comunidadeId: comB },
      "update uj.vinculos set estado = 'removido' where conta_id = $1 and comunidade_id = $2",
      [membroAB, comB],
    )
    // Agora adminB é o último: sair é recusado.
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminB, comunidadeId: comB },
        "update uj.vinculos set estado = 'removido' where conta_id = $1 and comunidade_id = $2",
        [adminB, comB],
      ),
    )
    expect(msg).toMatch(/sem administrador/)
  })

  it('o Criador pode intervir e rebaixar o último admin', async () => {
    const r = await b.comoApi(
      { contaId: criador },
      "update uj.vinculos set papel = 'membro' where conta_id = $1 and comunidade_id = $2 returning papel",
      [adminB, comB],
    )
    expect(r).toEqual([{ papel: 'membro' }])
  })
})

describe('ciclo de vida da comunidade', () => {
  it('admin edita o nome, mas não suspende', async () => {
    const r = await b.comoApi(
      { contaId: adminA, comunidadeId: comA },
      "update uj.comunidades set nome = 'Comunidade A (nova)' where id = $1 returning versao",
      [comA],
    )
    expect(r).toEqual([{ versao: 2 }])
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA, comunidadeId: comA },
        "update uj.comunidades set estado = 'suspensa' where id = $1",
        [comA],
      ),
    )
    expect(msg).toMatch(/exclusivo do proprietario/)
  })

  it('só o proprietário cria comunidade', async () => {
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA },
        "insert into uj.comunidades (nome, criado_por) values ('Nova', $1)",
        [adminA],
      ),
    )
    expect(msg).toMatch(/row-level security/)
    const r = await b.comoApi<{ nome: string }>(
      { contaId: criador },
      "insert into uj.comunidades (nome, criado_por) values ('Nova do Criador', $1) returning nome",
      [criador],
    )
    expect(r).toEqual([{ nome: 'Nova do Criador' }])
  })

  it('modo de entrada diferente de convite não está habilitado nesta versão', async () => {
    const msg = await erroDe(
      b.su.query("update uj.comunidades set modo_entrada = 'livre' where id = $1", [comA]),
    )
    expect(msg).toMatch(/nao habilitado/)
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
      { contaId: criador },
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

describe('auditoria só-inserção', () => {
  it('insere com a própria conta; não insere em nome de outra', async () => {
    await b.comoApi(
      { contaId: adminA, comunidadeId: comA },
      "insert into uj.auditoria (conta_id, comunidade_id, acao) values ($1, $2, 'teste.registro')",
      [adminA, comA],
    )
    const msg = await erroDe(
      b.comoApi(
        { contaId: adminA, comunidadeId: comA },
        "insert into uj.auditoria (conta_id, comunidade_id, acao) values ($1, $2, 'teste.registro')",
        [adminA2, comA],
      ),
    )
    expect(msg).toMatch(/row-level security/)
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

describe('uj_auth não alcança conteúdo de comunidade', () => {
  it('sem privilégio no log de mudanças', async () => {
    expect(await erroDe(b.auth.query('select * from uj.mudancas'))).toMatch(/permission denied/)
  })
})
