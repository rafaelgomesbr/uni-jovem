import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  COMUNIDADE_A,
  COMUNIDADE_B,
  PESSOAS_FICTICIAS,
  semearDemonstracao,
} from '../../src/cli/demonstracao.ts'
import { novoBanco, type BancoDeTeste } from '../apoio/banco.ts'

/**
 * M7: a semente cria as comunidades A e B fictícias, uma conta própria em B e
 * uma conta presente nas duas. Idempotente: rodar de novo não cria nada, e num
 * ambiente que já tinha a A (semente antiga), cria só o que falta.
 */

let limpo: BancoDeTeste
let antigo: BancoDeTeste

beforeAll(async () => {
  ;[limpo, antigo] = await Promise.all([novoBanco(), novoBanco()])
})

afterAll(async () => {
  await Promise.all([limpo.encerrar(), antigo.encerrar()])
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

describe('semente de demonstração', () => {
  it('banco vazio: cria A e B, a conta de B e a conta presente nas duas', async () => {
    const r = await semearDemonstracao(limpo.dono)
    expect(r.credenciais).toHaveLength(PESSOAS_FICTICIAS.length)
    // A senha só aparece na saída, nunca no banco em claro.
    for (const linha of r.credenciais) expect(linha).toMatch(/@unijovem\.invalid {2}senha: \S{20}$/)
    expect(await vinculosPorComunidade(limpo)).toEqual([
      ['A', 'demo.admin2@unijovem.invalid', 'admin'],
      ['A', 'demo.admin@unijovem.invalid', 'admin'],
      ['A', 'demo.duas@unijovem.invalid', 'membro'],
      ['A', 'demo.membro@unijovem.invalid', 'membro'],
      ['A', 'demo.organizador@unijovem.invalid', 'organizador'],
      ['B', 'demo.b.admin@unijovem.invalid', 'admin'],
      ['B', 'demo.duas@unijovem.invalid', 'organizador'],
    ])
    const eventos = async (comunidadeId: string) =>
      (
        await limpo.su.query<{ n: number }>(
          'select count(*)::int as n from uj.eventos where comunidade_id = $1',
          [comunidadeId],
        )
      ).rows[0]!.n
    expect(await eventos(r.comunidades.A)).toBe(2)
    expect(await eventos(r.comunidades.B)).toBe(1)
  })

  it('rodar de novo não cria nada nem mexe em senha', async () => {
    const antes = await limpo.su.query('select id, senha_hash from uj.contas order by id')
    const r = await semearDemonstracao(limpo.dono)
    expect(r.criadas).toEqual([])
    expect(r.credenciais).toEqual([])
    expect((await limpo.su.query('select id, senha_hash from uj.contas order by id')).rows).toEqual(
      antes.rows,
    )
    expect((await limpo.su.query('select count(*)::int as n from uj.comunidades')).rows[0].n).toBe(
      2,
    )
  })

  it('ambiente que já tinha a A: cria só a B, as contas novas e os vínculos que faltam', async () => {
    // Retrato da semente antiga: a A com as quatro contas e nada mais.
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
    expect(r.criadas).toEqual([
      `comunidade ${COMUNIDADE_B}`,
      'conta demo.b.admin@unijovem.invalid',
      'vínculo demo.b.admin@unijovem.invalid em B',
      'conta demo.duas@unijovem.invalid',
      'vínculo demo.duas@unijovem.invalid em A',
      'vínculo demo.duas@unijovem.invalid em B',
    ])
    expect(r.credenciais).toHaveLength(2)
    // A comunidade A não ganha conteúdo de novo (pode ter sido mexida pela equipe).
    const eventosEmA = await antigo.su.query(
      'select count(*)::int as n from uj.eventos where comunidade_id = $1',
      [a],
    )
    expect(eventosEmA.rows[0].n).toBe(0)
    expect((await semearDemonstracao(antigo.dono)).criadas).toEqual([])
  })
})
