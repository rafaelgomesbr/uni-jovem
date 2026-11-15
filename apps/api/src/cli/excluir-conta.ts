/**
 * Excluir a conta de OUTRA pessoa, pelo operador (exclusao-de-conta.md, caso 9):
 * a conta de quem tem menos de 16 anos e entrou por engano, ou o pedido de
 * quem perdeu o acesso e falou com o encarregado. Mesmo efeito da exclusão
 * pelo app (`uj.excluir_conta`, D26 e D29); a prova de reautenticação, que no
 * app vem da senha da pessoa, aqui é gravada pelo próprio dono do banco.
 *
 * Motivo obrigatório, de uma lista fechada: a auditoria (`plataforma.conta_excluida`,
 * visível no painel do Criador) guarda só o código, nunca nome, idade ou texto livre.
 * Sem `--confirmar`, só mostra o que aconteceria (nada é gravado).
 *
 * Uso (no servidor, com o .env do ambiente carregado):
 *   DATABASE_URL_DONO=... node --import tsx apps/api/src/cli/excluir-conta.ts \
 *     --email pessoa@exemplo.com --motivo menor_de_16 [--confirmar]
 *   (ou --conta <uuid> no lugar de --email)
 */
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import pg from 'pg'
import { normalizarEmail } from '../autenticacao/servico.ts'

export const MOTIVOS_DO_OPERADOR = {
  menor_de_16: 'Conta de quem tem menos de 16 anos (Termos, seção 3; ECA Digital).',
  pedido_do_titular: 'A própria pessoa pediu ao encarregado e não consegue excluir pelo app.',
  determinacao_legal: 'Ordem de autoridade competente.',
} as const

export type MotivoDoOperador = keyof typeof MOTIVOS_DO_OPERADOR

export function ehMotivoDoOperador(valor: unknown): valor is MotivoDoOperador {
  return typeof valor === 'string' && Object.hasOwn(MOTIVOS_DO_OPERADOR, valor)
}

export interface PedidoDoOperador {
  /** Um dos dois identifica a conta. */
  contaId?: string
  email?: string
  motivo: MotivoDoOperador
  /** Falso: só confere e descreve (nada é gravado). */
  confirmar: boolean
}

export interface ResultadoDoOperador {
  contaId: string
  /** Comunidades em que a pessoa estava ativa: a administração delas deve ser avisada. */
  comunidades: { id: string; nome: string }[]
  excluida: boolean
}

/** Erro com mensagem para quem opera (vai para o terminal, sem dado pessoal). */
export class ErroDoOperador extends Error {
  override name = 'ErroDoOperador'
}

export async function excluirContaPeloOperador(
  dono: pg.Pool,
  pedido: PedidoDoOperador,
): Promise<ResultadoDoOperador> {
  if (!ehMotivoDoOperador(pedido.motivo)) {
    throw new ErroDoOperador(`Motivo obrigatório: ${Object.keys(MOTIVOS_DO_OPERADOR).join(', ')}.`)
  }
  if (!pedido.contaId === !pedido.email) {
    throw new ErroDoOperador('Informe a conta por --conta ou por --email (um dos dois).')
  }
  const c = await dono.connect()
  try {
    await c.query('begin')
    const conta = (
      await c.query<{ id: string; estado: string; plataforma_proprietario: boolean }>(
        pedido.contaId
          ? 'select id, estado, plataforma_proprietario from uj.contas where id = $1::uuid'
          : 'select id, estado, plataforma_proprietario from uj.contas where email = $1',
        [pedido.contaId ?? normalizarEmail(pedido.email!)],
      )
    ).rows[0]
    if (!conta || conta.estado === 'anonimizada') {
      throw new ErroDoOperador('Conta não encontrada (ou já excluída).')
    }
    if (conta.plataforma_proprietario) {
      throw new ErroDoOperador('Esta é a conta do Criador: transfira a propriedade antes.')
    }
    const unicas = (
      await c.query<{ id: string; nome: string }>(
        'select id, nome from uj.comunidades_em_que_e_unico_admin($1)',
        [conta.id],
      )
    ).rows
    if (unicas.length > 0) {
      throw new ErroDoOperador(
        `A pessoa é a única administradora de: ${unicas.map((u) => u.nome).join(', ')}. ` +
          'Nomeie outra pessoa como administradora (intervenção do Criador no app) e rode de novo.',
      )
    }
    const comunidades = (
      await c.query<{ id: string; nome: string }>(
        `select m.id, m.nome from uj.vinculos v join uj.comunidades m on m.id = v.comunidade_id
          where v.conta_id = $1 and v.estado = 'ativo' order by m.nome`,
        [conta.id],
      )
    ).rows
    if (!pedido.confirmar) {
      await c.query('rollback')
      return { contaId: conta.id, comunidades, excluida: false }
    }

    // A prova de uso único que `uj.excluir_conta` exige (D29), válida por 1 minuto.
    const prova = randomBytes(32).toString('base64url')
    await c.query(
      `insert into uj.provas_de_reautenticacao (prova_hash, conta_id, finalidade, expira_em)
       values (sha256(convert_to($1, 'UTF8')), $2, 'excluir_conta', now() + interval '1 minute')`,
      [prova, conta.id],
    )
    await c.query('select uj.excluir_conta($1, $2)', [conta.id, prova])
    await c.query(
      `insert into uj.auditoria (conta_id, acao, recurso_tipo, recurso_id, detalhes)
       values (null, 'plataforma.conta_excluida', 'conta', $1, $2)`,
      [conta.id, JSON.stringify({ motivo: pedido.motivo, pelo: 'operador' })],
    )
    await c.query('commit')
    return { contaId: conta.id, comunidades, excluida: true }
  } catch (e) {
    await c.query('rollback').catch(() => undefined)
    throw e
  } finally {
    c.release()
  }
}

const executadoDireto = process.argv[1]?.replace(/\\/g, '/').endsWith('cli/excluir-conta.ts')
if (executadoDireto) {
  const { values } = parseArgs({
    options: {
      conta: { type: 'string' },
      email: { type: 'string' },
      motivo: { type: 'string' },
      confirmar: { type: 'boolean', default: false },
    },
  })
  const url = process.env['DATABASE_URL_DONO']
  if (!url || !ehMotivoDoOperador(values.motivo)) {
    console.error(
      'Uso: DATABASE_URL_DONO=... node --import tsx apps/api/src/cli/excluir-conta.ts ' +
        '(--conta <uuid> | --email <e-mail>) --motivo <código> [--confirmar]\n' +
        'Motivos:\n' +
        Object.entries(MOTIVOS_DO_OPERADOR)
          .map(([codigo, texto]) => `  ${codigo}: ${texto}`)
          .join('\n'),
    )
    process.exit(1)
  }
  const dono = new pg.Pool({ connectionString: url, max: 1 })
  try {
    const r = await excluirContaPeloOperador(dono, {
      ...(values.conta ? { contaId: values.conta } : {}),
      ...(values.email ? { email: values.email } : {}),
      motivo: values.motivo,
      confirmar: values.confirmar,
    })
    const lista = r.comunidades.map((m) => `  ${m.nome} (${m.id})`).join('\n') || '  nenhuma'
    if (r.excluida) {
      console.warn(`Conta ${r.contaId} excluída (motivo: ${values.motivo}).`)
      console.warn(`Avise a administração destas comunidades (sem citar idade):\n${lista}`)
    } else {
      console.warn(`Simulação: a conta ${r.contaId} seria excluída. Nada foi gravado.`)
      console.warn(`Comunidades em que ela está ativa:\n${lista}`)
      console.warn('Para excluir de fato, rode de novo com --confirmar.')
    }
  } catch (e) {
    // Mensagens próprias ou do banco, sem parâmetros: nada pessoal no terminal.
    console.error((e as Error).message)
    process.exitCode = 1
  } finally {
    await dono.end()
  }
}
