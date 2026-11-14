import type pg from 'pg'
import { gerarToken, hashDeToken } from '../autenticacao/cripto.ts'
import { normalizarEmail } from '../autenticacao/servico.ts'

/**
 * Cria (ou re-emite o link de) a conta proprietária da plataforma.
 *
 * Roda no servidor, com a conexão do DONO do banco, por quem opera a máquina.
 * Não existe conta mestra no código: a conta nasce sem senha e sem 2FA, e o
 * link de uso único (30 min) leva ao primeiro acesso, que define os dois juntos.
 *
 * Recusa se já houver um proprietário configurado (com senha): a partir daí,
 * troca de proprietário só pela transferência de propriedade dentro do app.
 */
export async function iniciarCriador(
  dono: pg.Pool,
  dados: { nome: string; email: string; urlPublica: string },
): Promise<{ link: string; contaId: string }> {
  const email = normalizarEmail(dados.email)
  const c = await dono.connect()
  try {
    await c.query('begin')
    const { rows } = await c.query<{ id: string; email: string; senha_hash: string | null }>(
      'select id, email, senha_hash from uj.contas where plataforma_proprietario for update',
    )
    let contaId: string
    const existente = rows[0]
    if (existente) {
      if (existente.senha_hash) {
        throw new Error(
          'Já existe um Criador configurado. Para trocar, use a transferência de propriedade no app.',
        )
      }
      if (existente.email !== email) {
        throw new Error('Já existe um Criador pendente com outro e-mail. Use o mesmo e-mail.')
      }
      contaId = existente.id
    } else {
      const nova = await c.query<{ id: string }>(
        `insert into uj.contas (nome, email, email_verificado_em, plataforma_proprietario)
         values ($1, $2, now(), true) returning id`,
        [dados.nome.trim(), email],
      )
      contaId = nova.rows[0]!.id
    }
    await c.query(
      `update uj.recuperacoes_senha set usado_em = now()
        where conta_id = $1 and finalidade = 'primeiro_acesso' and usado_em is null`,
      [contaId],
    )
    const token = gerarToken()
    await c.query(
      `insert into uj.recuperacoes_senha (conta_id, finalidade, token_hash, expira_em)
       values ($1, 'primeiro_acesso', $2, now() + interval '30 minutes')`,
      [contaId, hashDeToken(token)],
    )
    await c.query("insert into uj.auditoria (conta_id, acao) values ($1, 'criador.link_emitido')", [
      contaId,
    ])
    await c.query('commit')
    return { link: new URL(`/primeiro-acesso#t=${token}`, dados.urlPublica).toString(), contaId }
  } catch (e) {
    await c.query('rollback').catch(() => undefined)
    throw e
  } finally {
    c.release()
  }
}
