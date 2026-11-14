import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { iniciarCriador } from '../../src/cli/criador.ts'
import { novoBanco, type BancoDeTeste } from '../apoio/banco.ts'

let b: BancoDeTeste
beforeAll(async () => {
  b = await novoBanco()
})
afterAll(async () => {
  await b.encerrar()
})

const dados = {
  nome: 'Rafa',
  email: 'Criador@Exemplo.test',
  urlPublica: 'https://hml.exemplo.test',
}

describe('comando criador:iniciar', () => {
  it('cria a conta proprietária sem senha e emite link de uso único', async () => {
    const r = await iniciarCriador(b.dono, dados)
    expect(r.link).toMatch(/^https:\/\/hml\.exemplo\.test\/primeiro-acesso#t=[\w-]{40,}$/)
    const { rows } = await b.su.query(
      'select email, senha_hash, plataforma_proprietario from uj.contas where id = $1',
      [r.contaId],
    )
    expect(rows).toEqual([
      { email: 'criador@exemplo.test', senha_hash: null, plataforma_proprietario: true },
    ])
  })

  it('re-emitir invalida o link anterior', async () => {
    const segundo = await iniciarCriador(b.dono, dados)
    const { rows } = await b.su.query(
      'select count(*)::int as validos from uj.recuperacoes_senha where conta_id = $1 and usado_em is null',
      [segundo.contaId],
    )
    expect(rows).toEqual([{ validos: 1 }])
  })

  it('recusa outro e-mail enquanto houver Criador pendente, e recusa quando já configurado', async () => {
    await expect(iniciarCriador(b.dono, { ...dados, email: 'outro@exemplo.test' })).rejects.toThrow(
      /outro e-mail/,
    )
    await b.su.query(
      `update uj.contas set senha_hash = 'x', totp_ativado_em = now() where plataforma_proprietario`,
    )
    await expect(iniciarCriador(b.dono, dados)).rejects.toThrow(/Já existe um Criador/)
  })
})
