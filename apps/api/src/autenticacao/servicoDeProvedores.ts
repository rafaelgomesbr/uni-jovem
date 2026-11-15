import { NOME_DO_APP } from '@uj/dominio'
import { senhaConfere } from './cripto.ts'
import {
  NOME_DO_PROVEDOR,
  TokenDeProvedorRecusado,
  type IdentidadeDoProvedor,
  type Provedor,
  type TokensJaUsados,
  type VerificadorDeProvedores,
} from './provedores.ts'
import {
  auditar,
  concluirEntrada,
  emTx,
  ErroDeAuth,
  type DependenciasAuth,
  type Plataforma,
  type ResultadoDeEntrada,
} from './servico.ts'

/**
 * Entrar e conectar com Google ou Apple. Regras (pedido do dono, 14/11/2026):
 *
 * - Nunca cria conta: a entrada continua só por convite.
 * - A conta é achada pelo vínculo do provedor (`sub`) ou, na primeira vez,
 *   pelo e-mail VERIFICADO pelo provedor igual ao da conta. O e-mail de
 *   retransmissão privada da Apple nunca casa: aí só o vínculo prévio vale.
 * - Depois de achada, a entrada segue a mesma regra da senha (2FA de quem
 *   ligou; o Criador sem código no login, ver `concluirEntrada`).
 * - Nada de token na auditoria ou no log: só o provedor e a origem.
 */

export interface DependenciasDeProvedores extends DependenciasAuth {
  verificador: VerificadorDeProvedores
  usados: TokensJaUsados
}

const SEM_CONTA = (provedor: Provedor) =>
  new ErroDeAuth(
    'conta_nao_encontrada',
    401,
    `Não encontramos uma conta do ${NOME_DO_APP} ligada a esta conta ${NOME_DO_PROVEDOR[provedor]}. ` +
      'A conta é criada por convite: peça o link a quem administra a sua comunidade. ' +
      `Se você já tem conta, entre com e-mail e senha e conecte a conta ${NOME_DO_PROVEDOR[provedor]} ` +
      'em Perfil, Segurança.',
  )

function recusa(provedor: Provedor, e: TokenDeProvedorRecusado): ErroDeAuth {
  if (e.motivo === 'provedor_desligado') {
    return new ErroDeAuth(
      'provedor_indisponivel',
      404,
      `Entrar com ${NOME_DO_PROVEDOR[provedor]} não está disponível agora.`,
    )
  }
  return new ErroDeAuth(
    'token_invalido',
    401,
    `Não conseguimos confirmar a entrada com ${NOME_DO_PROVEDOR[provedor]}. Tente de novo.`,
  )
}

/** Confere o token e impede o reuso. Erros já saem com a mensagem da tela. */
async function identidade(
  d: DependenciasDeProvedores,
  provedor: Provedor,
  token: string,
  nonce: string | undefined,
): Promise<IdentidadeDoProvedor> {
  let id: IdentidadeDoProvedor
  try {
    id = await d.verificador.verificar(provedor, token, { nonce })
  } catch (e) {
    if (e instanceof TokenDeProvedorRecusado) throw recusa(provedor, e)
    throw e
  }
  if (!d.usados.registrar(token, id.expiraEm)) {
    throw new ErroDeAuth(
      'token_ja_usado',
      401,
      `Esta confirmação do ${NOME_DO_PROVEDOR[provedor]} já foi usada. Tente de novo.`,
    )
  }
  return id
}

interface LinhaDaConta {
  id: string
  senha_hash: string | null
  estado: string
  totp_ativado_em: Date | null
  plataforma_proprietario: boolean
}

export async function entrarComProvedor(
  d: DependenciasDeProvedores,
  pedido: {
    provedor: Provedor
    token: string
    nonce?: string | undefined
    aparelho: string | null
    plataforma: Plataforma
  },
): Promise<ResultadoDeEntrada> {
  const id = await identidade(d, pedido.provedor, pedido.token, pedido.nonce)

  const conta = await emTx(d.auth, async (c) => {
    const porSub = (
      await c.query<LinhaDaConta & { vinculo_id: string; desconectado: boolean }>(
        `select p.id as vinculo_id, p.desconectado_em is not null as desconectado,
                a.id, a.senha_hash, a.estado, a.totp_ativado_em, a.plataforma_proprietario
           from uj.contas_provedores p join uj.contas a on a.id = p.conta_id
          where p.provedor = $1 and p.sub = $2
          for update of p`,
        [id.provedor, id.sub],
      )
    ).rows[0]
    if (porSub) {
      if (porSub.desconectado) return null
      await c.query('update uj.contas_provedores set ultimo_uso_em = now() where id = $1', [
        porSub.vinculo_id,
      ])
      return porSub
    }

    // Primeira vez com este provedor: só pelo e-mail verificado, e só se a
    // conta nunca teve (nem desconectou) um vínculo com ele.
    if (!id.email || !id.emailVerificado || id.retransmissaoPrivada) return null
    const porEmail = (
      await c.query<LinhaDaConta>(
        `select a.id, a.senha_hash, a.estado, a.totp_ativado_em, a.plataforma_proprietario
           from uj.contas a
          where a.email = $1
            and not exists (select 1 from uj.contas_provedores p
                             where p.conta_id = a.id and p.provedor = $2)
          for update of a`,
        [id.email, id.provedor],
      )
    ).rows[0]
    if (!porEmail || porEmail.estado !== 'ativa' || !porEmail.senha_hash) return null
    await c.query(
      `insert into uj.contas_provedores (conta_id, provedor, sub, email_informado, ultimo_uso_em)
       values ($1, $2, $3, $4, now())`,
      [porEmail.id, id.provedor, id.sub, id.email],
    )
    await auditar(c, porEmail.id, 'conta.provedor_conectado', {
      provedor: id.provedor,
      origem: 'email_verificado',
    })
    return porEmail
  })

  if (!conta || conta.estado !== 'ativa' || !conta.senha_hash) throw SEM_CONTA(pedido.provedor)
  return concluirEntrada(d, { ...conta, senha_hash: conta.senha_hash }, pedido)
}

// ------------------------------------------------------------ contas conectadas (logado)

export interface ContaConectada {
  provedor: Provedor
  email: string | null
  conectadaEm: Date
}

export async function listarProvedores(
  d: DependenciasAuth,
  contaId: string,
): Promise<ContaConectada[]> {
  const { rows } = await d.auth.query<ContaConectada>(
    `select provedor, email_informado as email, criado_em as "conectadaEm"
       from uj.contas_provedores
      where conta_id = $1 and desconectado_em is null
      order by provedor`,
    [contaId],
  )
  return rows
}

/**
 * Conecta Google ou Apple a uma conta já aberta. Exige a senha atual: sem
 * ela, uma sessão roubada ligaria o Google de outra pessoa e ganharia uma
 * porta de entrada permanente (mesmo raciocínio do 2FA, D14).
 */
export async function conectarProvedor(
  d: DependenciasDeProvedores,
  pedido: {
    contaId: string
    provedor: Provedor
    token: string
    nonce?: string | undefined
    senhaAtual: string
  },
): Promise<ContaConectada> {
  const conta = (
    await d.auth.query<{ senha_hash: string | null }>(
      "select senha_hash from uj.contas where id = $1 and estado = 'ativa'",
      [pedido.contaId],
    )
  ).rows[0]
  if (!conta?.senha_hash) {
    throw new ErroDeAuth('sessao_invalida', 401, 'Sua sessão terminou. Entre de novo.')
  }
  if (!(await senhaConfere(conta.senha_hash, pedido.senhaAtual))) {
    throw new ErroDeAuth('senha_incorreta', 401, 'Senha atual incorreta.')
  }
  const id = await identidade(d, pedido.provedor, pedido.token, pedido.nonce)
  const email = id.email

  return emTx(d.auth, async (c) => {
    const doSub = (
      await c.query<{ id: string; conta_id: string }>(
        'select id, conta_id from uj.contas_provedores where provedor = $1 and sub = $2 for update',
        [id.provedor, id.sub],
      )
    ).rows[0]
    if (doSub && doSub.conta_id !== pedido.contaId) {
      throw new ErroDeAuth(
        'provedor_em_outra_conta',
        409,
        `Esta conta ${NOME_DO_PROVEDOR[id.provedor]} já está conectada a outra conta do ${NOME_DO_APP}.`,
      )
    }
    const { rows } = await c.query<ContaConectada>(
      // Uma linha por conta e provedor: reconectar (mesma conta do provedor ou outra) reaproveita.
      `insert into uj.contas_provedores (conta_id, provedor, sub, email_informado)
       values ($1, $2, $3, $4)
       on conflict (conta_id, provedor) do update
          set sub = excluded.sub, email_informado = excluded.email_informado,
              desconectado_em = null, criado_em = now()
       returning provedor, email_informado as email, criado_em as "conectadaEm"`,
      [pedido.contaId, id.provedor, id.sub, email],
    )
    await auditar(c, pedido.contaId, 'conta.provedor_conectado', {
      provedor: id.provedor,
      origem: 'tela_de_seguranca',
    })
    return rows[0]!
  })
}

export async function desconectarProvedor(
  d: DependenciasAuth,
  pedido: { contaId: string; provedor: Provedor },
): Promise<void> {
  await emTx(d.auth, async (c) => {
    const r = await c.query(
      `update uj.contas_provedores set desconectado_em = now(), email_informado = null
        where conta_id = $1 and provedor = $2 and desconectado_em is null`,
      [pedido.contaId, pedido.provedor],
    )
    if (r.rowCount !== 1) {
      throw new ErroDeAuth(
        'nao_encontrado',
        404,
        `A conta ${NOME_DO_PROVEDOR[pedido.provedor]} não está conectada.`,
      )
    }
    await auditar(c, pedido.contaId, 'conta.provedor_desconectado', { provedor: pedido.provedor })
  })
}
