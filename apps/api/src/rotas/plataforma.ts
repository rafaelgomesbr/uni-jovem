import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { DIAS_DE_CARENCIA_DA_EXCLUSAO_DA_COMUNIDADE, permite, type Acao } from '@uj/dominio'
import { gerarToken, hmacDeToken } from '../autenticacao/cripto.ts'
import { doisFatoresRecente } from '../autenticacao/jwt.ts'
import { emTransacao } from '../banco/contexto.ts'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { email as campoEmail } from './autenticacao.ts'
import {
  criarConvite,
  fusoValido,
  linkDoConvite,
  VALIDADE_MAXIMA_CONVITE_DIAS,
  type DependenciasComunidades,
} from './comunidades.ts'
import { auditar, exigir, exigirCriador, idDoCaminho } from './contexto.ts'

const DIAS_DE_CARENCIA_DA_EXCLUSAO = DIAS_DE_CARENCIA_DA_EXCLUSAO_DA_COMUNIDADE
/** P1: fuso padrão de comunidade nova. */
const FUSO_PADRAO = 'America/Sao_Paulo'
const motivo = z
  .string()
  .trim()
  .min(10, 'Explique o motivo da intervenção (pelo menos 10 caracteres).')
  .max(500)

/** Uma cota do dia, como `uj.saude_da_plataforma()` devolve. */
interface CotaDoBanco {
  cota: string
  global: boolean
  limite: number
  maiorUso: number
  chaves: number
  chavesAcimaDe80: number
}

interface SaudeDoBanco {
  geradoEm: string
  comunidadesPorEstado: Record<string, number>
  contasAtivas: number
  eventosDoMes: { total: number; porStatus: Record<string, number> }
  cotas: CotaDoBanco[]
  filaDePush: {
    pendentes: number
    pendenteMaisAntigoEm: string | null
    enviados24h: number
    falhas24h: number
    descartados24h: number
  }
}

/** Nome de cada cota no painel, em linguagem de gente. */
const DESCRICAO_DA_COTA: Record<string, string> = {
  'email:convite': 'E-mails de convite no dia (todas as comunidades)',
  'email:recuperacao': 'E-mails de recuperação de senha no dia',
  'email:cadastro': 'E-mails de cadastro de conta no dia',
  'email:convite_por_convite': 'Reenvios de um mesmo convite no dia',
  push_por_pessoa: 'Notificações por pessoa e comunidade no dia',
  push_critico_por_pessoa: 'Notificações importantes (cancelamento, substituição) por pessoa',
  avisos_por_hora: 'Avisos publicados por comunidade na hora',
  exportacoes_por_conta: 'Exportações por pessoa no dia',
  exportacao_bytes_por_comunidade: 'Tamanho das exportações por comunidade no dia (bytes)',
}

/**
 * Acrescenta a cada cota o percentual, o aviso e a descrição, e junta os
 * alertas. O aviso acende quando alguma chave chegou a 80% do limite (a conta
 * é feita no banco, em `chavesAcimaDe80`).
 */
export function montarSaude(s: SaudeDoBanco) {
  const cotas = s.cotas.map((c) => {
    const percentual = c.limite > 0 ? Math.round((c.maiorUso / c.limite) * 100) : 0
    return {
      ...c,
      descricao: DESCRICAO_DA_COTA[c.cota] ?? c.cota,
      percentual,
      aviso: c.chavesAcimaDe80 > 0,
    }
  })
  const alertas = cotas
    .filter((c) => c.aviso)
    .map((c) => ({
      cota: c.cota,
      mensagem: c.global
        ? `${c.descricao}: ${c.maiorUso} de ${c.limite} (${c.percentual}%).`
        : `${c.descricao}: ${c.chavesAcimaDe80} com 80% ou mais do limite de ${c.limite} (maior uso: ${c.maiorUso}).`,
    }))
  return { ...s, cotas, alertas }
}

/** Transação com a prova do Criador e, se houver, a comunidade alvo no contexto. */
function comoCriador<T>(
  api: pg.Pool,
  pedido: FastifyRequest,
  comunidadeId: string | null,
  trabalho: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const s = pedido.sessao!
  return emTransacao(api, { contaId: s.contaId, comunidadeId, prova: s.prova }, trabalho)
}

/** Página da lista de comunidades da Plataforma. */
const PAGINA_DA_PLATAFORMA = 50

const SO_CRIADOR = () =>
  new ErroHttp('so_criador', 403, 'Só o Criador do Uni Jovem pode fazer isto.')

/** Cursor opaco da lista (o mesmo formato da caixa de notificações, D42). */
function escreverCursor(micros: string, id: string): string {
  return Buffer.from(`${micros}:${id}`, 'utf8').toString('base64url')
}

function lerCursor(cursor: string): { micros: string; id: string } {
  const texto = Buffer.from(cursor, 'base64url').toString('utf8')
  const partes = /^(\d{1,19}):([0-9a-f-]{36})$/.exec(texto)
  if (!partes || !z.uuid().safeParse(partes[2]).success) {
    throw new ErroHttp('cursor_invalido', 400, 'A lista mudou. Abra as comunidades de novo.')
  }
  return { micros: partes[1]!, id: partes[2]! }
}

const ERROS_DA_TRANSFERENCIA: Record<string, [string, number, string]> = {
  UJ010: [
    'destino_invalido',
    422,
    'A conta de destino precisa existir, estar ativa e ter o código extra ao entrar ligado.',
  ],
  UJ011: ['sem_transferencia', 404, 'Não há transferência de propriedade em aberto para você.'],
  UJ012: [
    'prazo_de_espera',
    409,
    'A transferência só pode ser concluída depois das 72 horas de espera.',
  ],
}

function traduzirTransferencia(e: unknown): never {
  const codigo = (e as { code?: string }).code
  const t = codigo ? ERROS_DA_TRANSFERENCIA[codigo] : undefined
  if (t) throw new ErroHttp(t[0], t[1], t[2])
  traduzirErroDoBanco(e)
}

export function registrarRotasDePlataforma(app: FastifyInstance, d: DependenciasComunidades): void {
  const { api } = d
  const criador = {
    preHandler: async (pedido: FastifyRequest) => {
      await app.exigirSessao(pedido)
      exigirCriador(pedido)
    },
  }

  /**
   * Ações de plataforma que não destroem nada (ADR 0007, revisa D12 e D31):
   * basta a conta ser a proprietária, conferido no banco; o código do
   * autenticador não é pedido. Cada ação passa pela matriz (`permite`).
   */
  const criadorSemProva = (acao: Acao<'plataforma'>) => ({
    preHandler: async (pedido: FastifyRequest) => {
      await app.exigirSessao(pedido)
      const s = pedido.sessao!
      const ehCriador = await emTransacao(
        api,
        { contaId: s.contaId, comunidadeId: null },
        async (c) =>
          (await c.query<{ ok: boolean }>('select uj.eh_criador() as ok')).rows[0]?.ok === true,
      )
      const ator = {
        papel: null,
        designacoes: [],
        proprietarioComDoisFatores: ehCriador && s.prova !== null && doisFatoresRecente(s),
        criador: ehCriador,
      }
      if (!permite(ator, 'plataforma', acao)) throw SO_CRIADOR()
    },
  })

  /**
   * Lista da Plataforma (ADR 0007): filtro de verificação, busca por nome ou
   * cidade e cursor opaco. Quem criou aparece com nome e e-mail (o admin que
   * abriu a comunidade); nunca os demais membros nem conteúdo.
   */
  app.get('/api/v1/plataforma/comunidades', criadorSemProva('ler_comunidades'), async (pedido) => {
    const q = validar(
      z.object({
        verificacao: z.enum(['nova', 'verificada', 'todas']).default('todas'),
        busca: z.string().trim().max(80).optional(),
        cursor: z.string().max(200).optional(),
      }),
      pedido.query ?? {},
    )
    const depois = q.cursor ? lerCursor(q.cursor) : null
    return comoCriador(api, pedido, null, async (c) => {
      const { rows } = await c.query<{
        id: string
        nome: string
        cor: string
        cidade: string | null
        estado: string
        verificacao: string
        exclusao_agendada_para: Date | null
        criado_em: Date
        micros: string
        membros_ativos: number
        admins_ativos: number
        denuncias_abertas: number
        criador_nome: string | null
        criador_email: string | null
      }>('select * from uj.comunidades_da_plataforma($1, $2, $3, $4, $5)', [
        q.verificacao === 'todas' ? null : q.verificacao,
        q.busca || null,
        depois?.micros ?? null,
        depois?.id ?? null,
        PAGINA_DA_PLATAFORMA + 1,
      ])
      const pagina = rows.slice(0, PAGINA_DA_PLATAFORMA)
      const ultima = pagina.at(-1)
      return {
        comunidades: pagina.map((r) => ({
          id: r.id,
          nome: r.nome,
          cor: r.cor,
          cidade: r.cidade,
          estado: r.estado,
          verificacao: r.verificacao,
          exclusaoAgendadaPara: r.exclusao_agendada_para,
          criadoEm: r.criado_em,
          membrosAtivos: r.membros_ativos,
          adminsAtivos: r.admins_ativos,
          denunciasAbertas: r.denuncias_abertas,
          criador:
            r.criador_nome === null ? null : { nome: r.criador_nome, email: r.criador_email },
        })),
        proximoCursor:
          rows.length > PAGINA_DA_PLATAFORMA && ultima
            ? escreverCursor(ultima.micros, ultima.id)
            : null,
      }
    })
  })

  // Verificar tira as rodinhas; desverificar devolve, sem apagar nada. Auditados.
  for (const [acao, verificada] of [
    ['verificar', true],
    ['desverificar', false],
  ] as const) {
    app.post(
      `/api/v1/plataforma/comunidades/:comunidadeId/${acao}`,
      criadorSemProva('verificar_comunidade'),
      async (pedido) => {
        const id = idDoCaminho(pedido, 'comunidadeId')
        return comoCriador(api, pedido, id, async (c) => {
          const { rows } = await c.query<{ v: string | null }>(
            'select uj.definir_verificacao($1, $2) as v',
            [id, verificada],
          )
          const verificacao = rows[0]?.v ?? null
          if (verificacao === null) throw NAO_ENCONTRADO()
          await auditar(
            c,
            pedido,
            verificada ? 'plataforma.comunidade_verificada' : 'plataforma.comunidade_desverificada',
            { tipo: 'comunidade', id },
            {},
            id,
          )
          return { verificacao }
        })
      },
    )
  }

  // ---------------------------------------------------------------- denúncias de comunidade

  app.get(
    '/api/v1/plataforma/denuncias-de-comunidade',
    criadorSemProva('ler_denuncias_de_comunidade'),
    async (pedido) => {
      const q = validar(
        z.object({
          estado: z.enum(['aberta', 'procedente', 'improcedente', 'todas']).default('aberta'),
        }),
        pedido.query ?? {},
      )
      return comoCriador(api, pedido, null, async (c) => {
        const { rows } = await c.query<{
          id: string
          comunidade_id: string
          comunidade_nome: string
          motivo: string
          detalhe: string | null
          estado: string
          resolucao: string | null
          criado_em: Date
          resolvida_em: Date | null
        }>('select * from uj.denuncias_de_comunidade_da_plataforma($1)', [
          q.estado === 'todas' ? null : q.estado,
        ])
        return {
          denuncias: rows.map((r) => ({
            id: r.id,
            comunidade: { id: r.comunidade_id, nome: r.comunidade_nome },
            motivo: r.motivo,
            detalhe: r.detalhe,
            estado: r.estado,
            resolucao: r.resolucao,
            criadoEm: r.criado_em,
            resolvidaEm: r.resolvida_em,
          })),
        }
      })
    },
  )

  app.post(
    '/api/v1/plataforma/denuncias-de-comunidade/:denunciaId/resolver',
    criadorSemProva('resolver_denuncia_de_comunidade'),
    async (pedido) => {
      const denunciaId = idDoCaminho(pedido, 'denunciaId')
      const corpo = validar(
        z.object({
          estado: z.enum(['procedente', 'improcedente'], {
            error: 'Escolha se a denúncia procede ou não.',
          }),
          resolucao: z.string().trim().max(500).nullish(),
        }),
        pedido.body,
      )
      return comoCriador(api, pedido, null, async (c) => {
        const { rows } = await c.query<{ c: string | null }>(
          'select uj.resolver_denuncia_de_comunidade($1, $2, $3) as c',
          [denunciaId, corpo.estado, corpo.resolucao ?? null],
        )
        const comunidadeId = rows[0]?.c ?? null
        if (comunidadeId === null) throw NAO_ENCONTRADO()
        // Na auditoria da plataforma (sem comunidade: a administração dela não vê).
        await auditar(
          c,
          pedido,
          'plataforma.denuncia_de_comunidade_resolvida',
          { tipo: 'denuncia_de_comunidade', id: denunciaId },
          { estado: corpo.estado },
          null,
        )
        return { ok: true }
      })
    },
  )

  /**
   * Painel de saúde: só números agregados (sem nome, texto ou identificador de
   * pessoa). Leitura de plataforma também pede a prova de 2FA recente, como as
   * demais rotas do Criador (D12, D31): a sessão sozinha não basta.
   */
  app.get('/api/v1/plataforma/saude', criador, async (pedido) => {
    exigir(pedido, 'plataforma', 'ler_saude_da_plataforma')
    const saude = await comoCriador(api, pedido, null, async (c) => {
      const { rows } = await c.query<{ s: SaudeDoBanco | null }>(
        'select uj.saude_da_plataforma() as s',
      )
      return rows[0]?.s ?? null
    })
    // O banco confere a prova de novo (ela pode ter vencido no meio do caminho).
    if (!saude) {
      throw new ErroHttp(
        'segundo_fator_necessario',
        403,
        'Confirme o código do seu autenticador para continuar.',
      )
    }
    return montarSaude(saude)
  })

  /** Auditoria da plataforma: só ações de plataforma, mais recentes primeiro, em páginas. */
  app.get('/api/v1/plataforma/auditoria', criador, async (pedido) => {
    exigir(pedido, 'plataforma', 'ler_auditoria_da_plataforma')
    const q = validar(
      z.object({
        antes: z.coerce.number().int().positive().optional(),
        limite: z.coerce.number().int().min(1).max(100).default(50),
      }),
      pedido.query,
    )
    return comoCriador(api, pedido, null, async (c) => {
      const { rows } = await c.query(
        `select id, momento, conta_id as "contaId", comunidade_id as "comunidadeId",
                comunidade_nome as "comunidadeNome", acao, recurso_tipo as "recursoTipo",
                recurso_id as "recursoId", detalhes
           from uj.auditoria_da_plataforma($1, $2)`,
        [q.antes ?? null, q.limite],
      )
      return { registros: rows }
    })
  })

  // ADR 0007: criar comunidade pela Plataforma não pede o código do autenticador.
  // Nasce verificada (quem cria é o próprio Criador), com o convite do primeiro admin.
  app.post(
    '/api/v1/plataforma/comunidades',
    criadorSemProva('criar_comunidade'),
    async (pedido) => {
      const corpo = validar(
        z.object({
          nome: z.string().trim().min(2).max(80),
          cor: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/)
            .optional(),
          // Fuso IANA da comunidade (horários dos eventos); sem valor, o padrão P1.
          fuso: fusoValido.optional(),
          emailDoAdmin: campoEmail.nullish(),
        }),
        pedido.body,
      )
      const token = gerarToken()
      const criada = await comoCriador(api, pedido, null, async (c) => {
        try {
          const { rows } = await c.query<{ comunidade_id: string; expira_em: Date }>(
            'select comunidade_id, expira_em from uj.criar_comunidade_pela_plataforma($1, $2, $3, $4, $5, $6)',
            [
              corpo.nome,
              corpo.cor ?? '#5B4BDB',
              corpo.fuso ?? FUSO_PADRAO,
              corpo.emailDoAdmin?.trim().toLowerCase() ?? null,
              hmacDeToken(token, d.config.CONVITE_SEGREDO),
              VALIDADE_MAXIMA_CONVITE_DIAS,
            ],
          )
          const id = rows[0]!.comunidade_id
          // A auditoria nasce no contexto da nova comunidade.
          await c.query("select set_config('app.comunidade_id', $1, true)", [id])
          await auditar(
            c,
            pedido,
            'plataforma.comunidade_criada',
            { tipo: 'comunidade', id },
            {},
            id,
          )
          return { id, expiraEm: rows[0]!.expira_em }
        } catch (e) {
          traduzirErroDoBanco(e)
        }
      })
      return {
        id: criada.id,
        conviteDoPrimeiroAdmin: {
          link: linkDoConvite(d.config, token),
          expiraEm: criada.expiraEm,
        },
      }
    },
  )

  app.patch('/api/v1/plataforma/comunidades/:comunidadeId/estado', criador, async (pedido) => {
    const id = idDoCaminho(pedido, 'comunidadeId')
    const corpo = validar(
      z.object({
        estado: z.enum(['ativa', 'suspensa', 'arquivada', 'exclusao_agendada']),
        confirmacaoNome: z.string().optional(),
      }),
      pedido.body,
    )
    return comoCriador(api, pedido, id, async (c) => {
      const atual = (
        await c.query<{ nome: string; estado: string }>(
          'select nome, estado from uj.comunidades where id = $1 for update',
          [id],
        )
      ).rows[0]
      if (!atual) throw NAO_ENCONTRADO()
      if (corpo.estado === 'exclusao_agendada' && corpo.confirmacaoNome?.trim() !== atual.nome) {
        throw new ErroHttp(
          'confirmacao_necessaria',
          422,
          'Para agendar a exclusão, digite o nome exato da comunidade.',
        )
      }
      try {
        await c.query(
          `update uj.comunidades set estado = $2,
                  exclusao_agendada_para = case when $2 = 'exclusao_agendada'
                    then now() + make_interval(days => $3) end
            where id = $1`,
          [id, corpo.estado, DIAS_DE_CARENCIA_DA_EXCLUSAO],
        )
      } catch (e) {
        traduzirErroDoBanco(e)
      }
      await auditar(
        c,
        pedido,
        'plataforma.estado_alterado',
        { tipo: 'comunidade', id },
        {
          de: atual.estado,
          para: corpo.estado,
        },
        id,
      )
      return { ok: true }
    })
  })

  /** Intervenção: convite de admin numa comunidade (ex.: ficou sem admin). */
  app.post('/api/v1/plataforma/comunidades/:comunidadeId/convites', criador, async (pedido) => {
    const id = idDoCaminho(pedido, 'comunidadeId')
    const corpo = validar(z.object({ email: campoEmail.nullish(), motivo }), pedido.body)
    const s = pedido.sessao!
    const convite = await comoCriador(api, pedido, id, async (c) => {
      try {
        const novo = await criarConvite(c, d.config, {
          comunidadeId: id,
          papel: 'admin',
          email: corpo.email?.trim().toLowerCase() ?? null,
          validadeDias: VALIDADE_MAXIMA_CONVITE_DIAS,
          criadoPor: s.contaId,
        })
        await auditar(
          c,
          pedido,
          'plataforma.intervencao_convite',
          { tipo: 'convite', id: novo.id },
          {
            motivo: corpo.motivo,
          },
          id,
        )
        return novo
      } catch (e) {
        traduzirErroDoBanco(e)
      }
    })
    return {
      id: convite.id,
      link: linkDoConvite(d.config, convite.token),
      expiraEm: convite.expiraEm,
    }
  })

  /**
   * Intervenção: os vínculos da comunidade (nome, papel e estado) para escolher
   * quem nomear. Nunca e-mail nem WhatsApp: o Criador não precisa de contato
   * para intervir, e a consulta fica na auditoria da comunidade.
   */
  app.get('/api/v1/plataforma/comunidades/:comunidadeId/membros', criador, async (pedido) => {
    const id = idDoCaminho(pedido, 'comunidadeId')
    return comoCriador(api, pedido, id, async (c) => {
      const existe = await c.query('select 1 from uj.comunidades where id = $1', [id])
      if (!existe.rows[0]) throw NAO_ENCONTRADO()
      const { rows } = await c.query(
        `select vinculo_id as "vinculoId", nome, papel, estado, desde
           from uj.vinculos_para_intervencao($1)`,
        [id],
      )
      await auditar(
        c,
        pedido,
        'plataforma.intervencao_consulta',
        { tipo: 'comunidade', id },
        {},
        id,
      )
      return { vinculos: rows }
    })
  })

  app.patch(
    '/api/v1/plataforma/comunidades/:comunidadeId/membros/:vinculoId',
    criador,
    async (pedido) => {
      const id = idDoCaminho(pedido, 'comunidadeId')
      const vinculoId = idDoCaminho(pedido, 'vinculoId')
      const corpo = validar(
        z.object({ papel: z.enum(['admin', 'organizador', 'membro']), motivo }),
        pedido.body,
      )
      return comoCriador(api, pedido, id, async (c) => {
        try {
          const r = await c.query(
            'update uj.vinculos set papel = $3 where id = $1 and comunidade_id = $2 returning id',
            [vinculoId, id, corpo.papel],
          )
          if (!r.rowCount) throw NAO_ENCONTRADO()
          await auditar(
            c,
            pedido,
            'plataforma.intervencao_papel',
            { tipo: 'vinculo', id: vinculoId },
            {
              papel: corpo.papel,
              motivo: corpo.motivo,
            },
            id,
          )
          return { ok: true }
        } catch (e) {
          if (e instanceof ErroHttp) throw e
          traduzirErroDoBanco(e)
        }
      })
    },
  )

  // ---------------------------------------------------------------- transferência de propriedade

  app.post('/api/v1/plataforma/transferencia', criador, async (pedido) => {
    const corpo = validar(z.object({ email: campoEmail }), pedido.body)
    return comoCriador(api, pedido, null, async (c) => {
      try {
        const { rows } = await c.query<{ id: string }>(
          'select uj.iniciar_transferencia($1) as id',
          [corpo.email],
        )
        return { id: rows[0]!.id }
      } catch (e) {
        traduzirTransferencia(e)
      }
    })
  })

  const exigirSessao = { preHandler: app.exigirSessao }

  app.get('/api/v1/eu/transferencia', exigirSessao, async (pedido) =>
    comoCriador(api, pedido, null, async (c) => {
      const { rows } = await c.query(
        `select id, de_conta as "deConta", para_conta as "paraConta", para_nome as "paraNome",
                criado_em as "criadoEm", efetiva_apos as "efetivaApos", aceita_em as "aceitaEm"
           from uj.transferencia_aberta()`,
      )
      return { transferencia: rows[0] ?? null }
    }),
  )

  for (const [acao, funcao] of [
    ['aceitar', 'uj.aceitar_transferencia'],
    ['cancelar', 'uj.cancelar_transferencia'],
    ['concluir', 'uj.concluir_transferencia'],
  ] as const) {
    app.post(`/api/v1/eu/transferencia/${acao}`, exigirSessao, async (pedido) => {
      // Aceitar e concluir exigem 2FA recente de quem age; cancelar, não.
      if (acao !== 'cancelar') exigirCriador(pedido)
      return comoCriador(api, pedido, null, async (c) => {
        try {
          await c.query(`select ${funcao}()`)
          return { ok: true }
        } catch (e) {
          traduzirTransferencia(e)
        }
      })
    })
  }
}
