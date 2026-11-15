import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { aplicarComando, CONCESSAO_DE_CONDUCAO_S, type EstadoAoVivo } from '@uj/dominio'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { mascararTelefone } from '../publico/apoio.ts'
import { montarRetrato } from './ao-vivo.ts'
import { exigir, idDoCaminho, naComunidade } from './contexto.ts'
import { registrarPresenca } from './inscricoes.ts'

/**
 * Sincronização offline no servidor (F13, ADR 0005).
 *
 * POST .../sync/operacoes recebe a fila do aparelho e REVALIDA tudo por
 * operação, na sua própria transação: sessão e vínculo ativo (comComunidade),
 * vínculo gravado na criação da operação, papel (matriz), regra (banco) e
 * versão (ao vivo). Resposta por operação: aceita, ja_aplicada,
 * rejeitada (motivo) ou conflito (estado do servidor). A idempotência fica em
 * `uj.sync_operacoes`, na mesma transação do efeito.
 *
 * GET .../sync/mudancas devolve o log da comunidade com o cursor (xact, id) e a
 * marca d'água (D13), já filtrado pela política de `uj.mudancas` (nível,
 * conta-alvo, designação: oração "somente eu" de outra pessoa nunca aparece).
 *
 * GET .../eventos/:eventoId/pacote-offline: o mínimo para o dia do evento
 * (sem notas internas, sem oração, telefone mascarado), com validade igual a
 * `validade_offline_dias` da comunidade.
 */

const MAXIMO_POR_LOTE = 100
/** Relógio do aparelho adiantado: aceito até 5 min; além disso, vale a hora do servidor. */
const TOLERANCIA_DE_RELOGIO_MS = 5 * 60_000

const dataHora = z.iso.datetime({ offset: true })
const comandoOffline = z.object({
  comando: z.enum(['iniciar', 'avancar', 'voltar', 'ir_para', 'pausar', 'retomar', 'encerrar']),
  etapaId: z.uuid().optional(),
  ocorridoEm: dataHora,
})
const envelope = { chave: z.uuid(), vinculoId: z.uuid(), criadaEm: dataHora }
const operacao = z.discriminatedUnion('tipo', [
  z.object({
    ...envelope,
    tipo: z.literal('tarefa.concluir'),
    dados: z.object({ tarefaId: z.uuid(), concluida: z.boolean() }),
  }),
  z.object({
    ...envelope,
    tipo: z.literal('checklist.marcar'),
    dados: z.object({ itemId: z.uuid(), marcado: z.boolean() }),
  }),
  z.object({
    ...envelope,
    tipo: z.literal('presenca.registrar'),
    dados: z
      .object({
        eventoId: z.uuid(),
        codigo: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[0-9A-F]{10}$/)
          .optional(),
        inscricaoId: z.uuid().optional(),
        vinculoId: z.uuid().optional(),
        nomeAvulso: z.string().trim().min(1).max(120).optional(),
        ocorridaEm: dataHora.optional(),
      })
      .refine(
        (x) => [x.codigo, x.inscricaoId, x.vinculoId, x.nomeAvulso].filter(Boolean).length === 1,
        'Informe exatamente um: código, inscrição, pessoa ou nome.',
      ),
  }),
  z.object({
    ...envelope,
    tipo: z.literal('ao_vivo.proposta'),
    dados: z.object({
      eventoId: z.uuid(),
      versaoBase: z.number().int().min(0),
      comandos: z.array(comandoOffline).min(1).max(50),
    }),
  }),
  z.object({
    ...envelope,
    tipo: z.literal('inscricao.intencao'),
    dados: z.object({ eventoId: z.uuid() }),
  }),
])
type Operacao = z.infer<typeof operacao>

type Situacao = 'aceita' | 'ja_aplicada' | 'rejeitada' | 'conflito'
interface Resultado {
  chave: string | null
  status: Situacao
  motivo?: string
  mensagem?: string
  estado?: unknown
  resultado?: unknown
}

const rejeitada = (chave: string | null, motivo: string, mensagem: string): Resultado => ({
  chave,
  status: 'rejeitada',
  motivo,
  mensagem,
})

/** Erros de regra que o banco levanta nas funções usadas aqui. */
const ERROS_DO_BANCO: Record<string, [string, string]> = {
  UJ030: ['inscricoes_encerradas', 'As inscrições para este evento estão encerradas.'],
  UJ031: ['lotado', 'As vagas acabaram antes de a sua inscrição chegar.'],
  UJ033: ['nao_encontrado', 'Não encontramos esta inscrição.'],
  UJ034: ['nao_encontrado', 'Não encontramos este evento.'],
}

function hashDoConteudo(op: Operacao): Buffer {
  const { chave: _chave, ...conteudo } = op
  return createHash('sha256').update(JSON.stringify(conteudo)).digest()
}

function instanteSeguro(iso: string, agora: Date): Date {
  const t = new Date(iso)
  return t.getTime() > agora.getTime() + TOLERANCIA_DE_RELOGIO_MS ? agora : t
}

export function registrarRotasDeSincronizacao(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId'

  // ---------------------------------------------------------------- operações

  async function aplicar(
    c: pg.PoolClient,
    pedido: FastifyRequest,
    op: Operacao,
    eu: string,
    criadaEm: Date,
  ): Promise<Resultado> {
    const comunidadeId = pedido.comunidade!.id
    switch (op.tipo) {
      case 'tarefa.concluir':
      case 'checklist.marcar': {
        const tarefa = op.tipo === 'tarefa.concluir'
        const tabela = tarefa ? 'uj.tarefas' : 'uj.checklist_itens'
        const coluna = tarefa ? 'concluida_em' : 'marcado_em'
        const id = tarefa ? op.dados.tarefaId : op.dados.itemId
        const ligar = tarefa ? op.dados.concluida : op.dados.marcado
        const linha = (
          await c.query<{ responsavel: string | null; quando: Date | null; versao: number }>(
            `select responsavel_vinculo_id as responsavel, ${coluna} as quando, versao
               from ${tabela} where id = $1 and comunidade_id = $2`,
            [id, comunidadeId],
          )
        ).rows[0]
        if (!linha) return rejeitada(op.chave, 'nao_encontrado', 'Este item não existe mais.')
        const alvo = { proprio: linha.responsavel === eu }
        if (tarefa) exigir(pedido, 'tarefa', 'concluir', alvo)
        else exigir(pedido, 'checklist', 'marcar', alvo)
        // Concluir é idempotente: já concluído fica como está.
        if (ligar && linha.quando) {
          return { chave: op.chave, status: 'aceita', resultado: { [coluna]: linha.quando } }
        }
        if (!ligar && !linha.quando) {
          return { chave: op.chave, status: 'aceita', resultado: { [coluna]: null } }
        }
        // Reabrir o que outra pessoa concluiu DEPOIS desta alteração: conflito explícito.
        if (!ligar && linha.quando && linha.quando > criadaEm) {
          return {
            chave: op.chave,
            status: 'conflito',
            motivo: 'concluido_depois',
            mensagem:
              'Alguém concluiu este item depois da sua alteração. Confira antes de reabrir.',
            estado: { [coluna]: linha.quando, versao: linha.versao },
          }
        }
        const r = await c.query<{ quando: Date | null; versao: number }>(
          `update ${tabela} set ${coluna} = $3
            where id = $1 and comunidade_id = $2 returning ${coluna} as quando, versao`,
          [id, comunidadeId, ligar ? criadaEm : null],
        )
        if (!r.rows[0]) {
          return rejeitada(op.chave, 'sem_permissao', 'Este item não é seu para marcar.')
        }
        return {
          chave: op.chave,
          status: 'aceita',
          resultado: { [coluna]: r.rows[0].quando, versao: r.rows[0].versao },
        }
      }

      case 'presenca.registrar': {
        exigir(pedido, 'presenca', 'registrar')
        const { eventoId, ocorridaEm, ...quem } = op.dados
        const p = await registrarPresenca(c, comunidadeId, eventoId, {
          chaveIdempotencia: op.chave,
          origem: 'offline',
          ...quem,
          ocorridaEm: instanteSeguro(ocorridaEm ?? op.criadaEm, new Date()).toISOString(),
        })
        return {
          chave: op.chave,
          status: p.jaRegistrada ? 'ja_aplicada' : 'aceita',
          resultado: { presencaId: p.id },
        }
      }

      case 'inscricao.intencao': {
        exigir(pedido, 'inscricao', 'inscrever_se', { proprio: true })
        const { rows } = await c.query<{ inscricao_id: string; estado: string }>(
          'select * from uj.inscrever_membro($1)',
          [op.dados.eventoId],
        )
        return {
          chave: op.chave,
          status: 'aceita',
          resultado: { inscricaoId: rows[0]!.inscricao_id, estado: rows[0]!.estado },
        }
      }

      case 'ao_vivo.proposta': {
        exigir(pedido, 'ao_vivo', 'conduzir')
        const { eventoId, versaoBase, comandos } = op.dados
        const evento = (
          await c.query<{ status: string }>(
            'select status from uj.eventos where id = $1 and comunidade_id = $2',
            [eventoId, comunidadeId],
          )
        ).rows[0]
        if (!evento) return rejeitada(op.chave, 'nao_encontrado', 'Este evento não existe mais.')
        if (evento.status !== 'publicado') {
          return rejeitada(op.chave, 'evento_nao_publicado', 'O evento não está mais publicado.')
        }
        await c.query(
          'insert into uj.andamentos (evento_id, comunidade_id) values ($1, $2) on conflict (evento_id) do nothing',
          [eventoId, comunidadeId],
        )
        const linha = (
          await c.query<{
            situacao: EstadoAoVivo['situacao']
            etapa_atual_id: string | null
            etapa_iniciada_em: Date | null
            iniciado_em: Date | null
            pausado_em: Date | null
            encerrado_em: Date | null
            condutor_vinculo_id: string | null
            condutor_ate: Date | null
            versao: number
          }>('select * from uj.andamentos where evento_id = $1 for update', [eventoId])
        ).rows[0]!
        const agora = new Date()
        const outroConduz =
          linha.condutor_vinculo_id !== null &&
          linha.condutor_vinculo_id !== eu &&
          linha.condutor_ate !== null &&
          linha.condutor_ate > agora
        // O servidor é a fonte da verdade: andou desde a base, as duas linhas
        // do tempo vão para o app decidir.
        if (linha.versao !== versaoBase || outroConduz) {
          return {
            chave: op.chave,
            status: 'conflito',
            motivo: outroConduz ? 'conduzido_por_outra_pessoa' : 'andamento_mudou',
            mensagem:
              'O andamento mudou no servidor enquanto você estava sem conexão. Compare e escolha.',
            estado: await montarRetrato(c, comunidadeId, eventoId),
          }
        }
        const etapas = (
          await c.query<{ id: string }>(
            'select id from uj.etapas where evento_id = $1 order by ordem',
            [eventoId],
          )
        ).rows.map((e) => e.id)
        const iso = (d: Date | null) => (d ? d.toISOString() : null)
        let estado: EstadoAoVivo = {
          situacao: linha.situacao,
          etapaAtualId: linha.etapa_atual_id,
          etapaIniciadaEm: iso(linha.etapa_iniciada_em),
          iniciadoEm: iso(linha.iniciado_em),
          pausadoEm: iso(linha.pausado_em),
          encerradoEm: iso(linha.encerrado_em),
        }
        const aplicados: { comando: string; etapaId: string | null; quando: Date }[] = []
        let anterior = new Date(0)
        for (const cmd of comandos) {
          let quando = instanteSeguro(cmd.ocorridoEm, agora)
          if (quando < anterior) quando = anterior
          anterior = quando
          if (cmd.comando === 'ir_para' && !cmd.etapaId) {
            return rejeitada(op.chave, 'comando_invalido', 'Falta a etapa do comando "ir para".')
          }
          const r = aplicarComando(
            estado,
            cmd.comando === 'ir_para'
              ? { tipo: 'ir_para', etapaId: cmd.etapaId! }
              : { tipo: cmd.comando },
            etapas,
            quando,
          )
          if (!r.ok) return rejeitada(op.chave, 'comando_invalido', r.motivo)
          estado = r.estado
          aplicados.push({ comando: cmd.comando, etapaId: estado.etapaAtualId, quando })
        }
        const versao = linha.versao + aplicados.length
        await c.query(
          `update uj.andamentos set situacao = $2, etapa_atual_id = $3, etapa_iniciada_em = $4,
                  iniciado_em = $5, pausado_em = $6, encerrado_em = $7, condutor_vinculo_id = $8,
                  condutor_ate = now() + make_interval(secs => $9), versao = $10
            where evento_id = $1`,
          [
            eventoId,
            estado.situacao,
            estado.etapaAtualId,
            estado.etapaIniciadaEm,
            estado.iniciadoEm,
            estado.pausadoEm,
            estado.encerradoEm,
            eu,
            CONCESSAO_DE_CONDUCAO_S,
            versao,
          ],
        )
        for (const [i, a] of aplicados.entries()) {
          await c.query(
            `insert into uj.andamento_comandos (comunidade_id, evento_id, comando, etapa_id, vinculo_id,
               ocorrido_em, origem, versao_resultante)
             values ($1, $2, $3, $4, $5, $6, 'offline', $7)`,
            [comunidadeId, eventoId, a.comando, a.etapaId, eu, a.quando, linha.versao + i + 1],
          )
        }
        return {
          chave: op.chave,
          status: 'aceita',
          resultado: await montarRetrato(c, comunidadeId, eventoId),
        }
      }
    }
  }

  async function processar(pedido: FastifyRequest, bruto: unknown): Promise<Resultado> {
    const chaveBruta = (bruto as { chave?: unknown } | null)?.chave
    const chaveInformada =
      typeof chaveBruta === 'string' && z.uuid().safeParse(chaveBruta).success ? chaveBruta : null
    const lido = operacao.safeParse(bruto)
    if (!lido.success) {
      return rejeitada(
        chaveInformada,
        'dados_invalidos',
        'Esta alteração chegou incompleta. Refaça a ação com o app atualizado.',
      )
    }
    const op = lido.data
    const hash = hashDoConteudo(op)
    const contaId = pedido.sessao!.contaId
    try {
      return await naComunidade(api, pedido, async (c) => {
        const anterior = (
          await c.query<{ conteudo_hash: Buffer; resultado: unknown }>(
            `select conteudo_hash, resultado from uj.sync_operacoes
              where comunidade_id = $1 and conta_id = $2 and chave = $3`,
            [pedido.comunidade!.id, contaId, op.chave],
          )
        ).rows[0]
        if (anterior) {
          return anterior.conteudo_hash.equals(hash)
            ? { chave: op.chave, status: 'ja_aplicada' as const, resultado: anterior.resultado }
            : rejeitada(
                op.chave,
                'chave_com_conteudo_diferente',
                'Esta alteração já foi enviada com outro conteúdo.',
              )
        }
        const contexto = (
          await c.query<{ eu: string | null; dias: number }>(
            `select uj.vinculo_da_conta_no_contexto() as eu,
                    (select validade_offline_dias from uj.comunidades where id = $1) as dias`,
            [pedido.comunidade!.id],
          )
        ).rows[0]!
        // O vínculo gravado na criação precisa ser o vínculo ativo de agora:
        // operação feita com um acesso que foi revogado nunca é aplicada.
        if (!contexto.eu || contexto.eu !== op.vinculoId) {
          return rejeitada(
            op.chave,
            'vinculo_revogado',
            'Esta alteração foi feita com um acesso que não vale mais nesta comunidade.',
          )
        }
        const agora = new Date()
        const criadaEm = instanteSeguro(op.criadaEm, agora)
        if (agora.getTime() - criadaEm.getTime() > contexto.dias * 24 * 3600_000) {
          return rejeitada(
            op.chave,
            'operacao_vencida',
            'Esta alteração ficou tempo demais sem ser enviada e venceu.',
          )
        }
        const r = await aplicar(c, pedido, op, contexto.eu, criadaEm)
        if (r.status === 'aceita' || r.status === 'ja_aplicada') {
          await c.query(
            `insert into uj.sync_operacoes (comunidade_id, conta_id, chave, tipo, conteudo_hash, resultado)
             values ($1, $2, $3, $4, $5, $6)`,
            [
              pedido.comunidade!.id,
              contaId,
              op.chave,
              op.tipo,
              hash,
              JSON.stringify(r.resultado ?? {}),
            ],
          )
        }
        return r
      })
    } catch (e) {
      if (e instanceof ErroHttp) return rejeitada(op.chave, e.codigo, e.message)
      const codigo = (e as { code?: string }).code
      const conhecido = codigo ? ERROS_DO_BANCO[codigo] : undefined
      if (conhecido) return rejeitada(op.chave, conhecido[0], conhecido[1])
      try {
        traduzirErroDoBanco(e)
      } catch (traduzido) {
        if (traduzido instanceof ErroHttp) {
          return rejeitada(op.chave, traduzido.codigo, traduzido.message)
        }
      }
      throw e
    }
  }

  app.post(`${base}/sync/operacoes`, naCom, async (pedido) => {
    exigir(pedido, 'sincronizacao', 'enviar_operacoes')
    const corpo = validar(
      z.object({ operacoes: z.array(z.unknown()).min(1).max(MAXIMO_POR_LOTE) }),
      pedido.body,
    )
    const resultados: Resultado[] = []
    // Em ordem: uma operação pode depender da anterior (ex.: comandos do ao vivo).
    for (const bruto of corpo.operacoes) resultados.push(await processar(pedido, bruto))
    return { resultados, servidorEm: new Date().toISOString() }
  })

  // ---------------------------------------------------------------- mudanças

  app.get(`${base}/sync/mudancas`, naCom, async (pedido) => {
    exigir(pedido, 'sincronizacao', 'ler_mudancas')
    const q = validar(
      z.object({
        cursor: z
          .string()
          .regex(/^\d{1,20}:\d{1,19}$/, 'Cursor inválido.')
          .default('0:0'),
        limite: z.coerce.number().int().min(1).max(1000).default(500),
      }),
      pedido.query,
    )
    const [xact, id] = q.cursor.split(':') as [string, string]
    return naComunidade(api, pedido, async (c) => {
      const marca = (
        await c.query<{ limite: string }>(
          'select pg_snapshot_xmin(pg_current_snapshot())::text as limite',
        )
      ).rows[0]!.limite
      const marco = (
        await c.query<{ x: string; i: string }>(
          'select podado_ate_xact::text as x, podado_ate_id::text as i from uj.marco_de_sincronizacao where id = 1',
        )
      ).rows[0]
      const cursorZero = xact === '0' && id === '0'
      if (
        marco &&
        !cursorZero &&
        (BigInt(xact) < BigInt(marco.x) ||
          (BigInt(xact) === BigInt(marco.x) && BigInt(id) <= BigInt(marco.i)))
      ) {
        // O log antes do cursor já foi podado: o aparelho baixa tudo de novo.
        return { recomecar: true, mudancas: [], cursor: `${marca}:0`, temMais: false }
      }
      const { rows } = await c.query<{
        id: string
        xact: string
        tabela: string
        registro_id: string
        operacao: string
        momento: Date
      }>(
        `select id::text, xact::text, tabela, registro_id, operacao, momento
           from uj.mudancas
          where comunidade_id = $1 and (xact, id) > ($2::xid8, $3::bigint) and xact < $4::xid8
          order by xact, id limit $5`,
        [pedido.comunidade!.id, xact, id, marca, q.limite + 1],
      )
      const temMais = rows.length > q.limite
      const pagina = temMais ? rows.slice(0, q.limite) : rows
      const ultima = pagina[pagina.length - 1]
      // Página cheia: continua da última linha. Incompleta: da marca d'água
      // (nunca para trás do cursor recebido).
      const cursor = temMais
        ? `${ultima!.xact}:${ultima!.id}`
        : BigInt(marca) > BigInt(xact)
          ? `${marca}:0`
          : q.cursor
      return {
        recomecar: false,
        mudancas: pagina.map((m) => ({
          tabela: m.tabela,
          id: m.registro_id,
          operacao: m.operacao,
          momento: m.momento,
        })),
        cursor,
        temMais,
      }
    })
  })

  // ---------------------------------------------------------------- pacote offline

  app.get(`${base}/eventos/:eventoId/pacote-offline`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'ler_pacote_offline')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const organizador = pedido.comunidade!.papel !== 'membro'
    return naComunidade(api, pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      const evento = (
        await c.query(
          `select e.id, e.titulo, e.descricao, e.categoria, e.inicio, e.duracao_min as "duracaoMin",
                  e.fuso, e.status, e.motivo_status as "motivoStatus", e.capacidade,
                  e.informacoes_uteis as "informacoesUteis", e.versao,
                  case when l.id is null then null else json_build_object('id', l.id, 'nome', l.nome,
                    'tipo', l.tipo, 'endereco', l.endereco, 'latitude', l.latitude,
                    'longitude', l.longitude, 'referencia', l.referencia) end as local
             from uj.eventos e left join uj.locais l on l.id = e.local_id
            where e.id = $1 and e.comunidade_id = $2`,
          [eventoId, comunidadeId],
        )
      ).rows[0]
      if (!evento) throw NAO_ENCONTRADO()
      const meta = (
        await c.query<{ dias: number; marca: string; eu: string | null }>(
          `select (select validade_offline_dias from uj.comunidades where id = $1) as dias,
                  pg_snapshot_xmin(pg_current_snapshot())::text as marca,
                  uj.vinculo_da_conta_no_contexto() as eu`,
          [comunidadeId],
        )
      ).rows[0]!
      const nomes = new Map(
        (
          await c.query<{ vinculo_id: string; nome: string }>(
            'select vinculo_id, nome from uj.pessoas_da_comunidade()',
          )
        ).rows.map((p) => [p.vinculo_id, p.nome]),
      )
      const comNome = <T extends { vinculoId: string | null }>(l: T[]) =>
        l.map((x) => ({ ...x, nome: x.vinculoId ? (nomes.get(x.vinculoId) ?? null) : null }))
      const etapas = (
        await c.query(
          `select id, ordem, titulo, descricao, duracao_min as "duracaoMin", versao
             from uj.etapas where evento_id = $1 order by ordem`,
          [eventoId],
        )
      ).rows
      const atribuicoes = comNome(
        (
          await c.query<{ vinculoId: string | null }>(
            `select id, etapa_id as "etapaId", vinculo_id as "vinculoId", funcao, estado
               from uj.atribuicoes where evento_id = $1 order by criado_em`,
            [eventoId],
          )
        ).rows,
      )
      const tarefas = comNome(
        (
          await c.query<{ vinculoId: string | null }>(
            `select id, titulo, responsavel_vinculo_id as "vinculoId", prazo,
                    concluida_em as "concluidaEm", versao
               from uj.tarefas where evento_id = $1 order by prazo nulls last, criado_em`,
            [eventoId],
          )
        ).rows,
      )
      const checklist = comNome(
        (
          await c.query<{ vinculoId: string | null }>(
            `select id, tipo, texto, ordem, responsavel_vinculo_id as "vinculoId",
                    marcado_em as "marcadoEm", versao
               from uj.checklist_itens where evento_id = $1 order by tipo, ordem`,
            [eventoId],
          )
        ).rows,
      )
      const materiais = comNome(
        (
          await c.query<{ vinculoId: string | null }>(
            `select id, nome as item, quantidade, responsavel_vinculo_id as "vinculoId",
                    providenciado_em as "providenciadoEm", versao
               from uj.materiais where evento_id = $1 order by criado_em`,
            [eventoId],
          )
        ).rows,
      )
      const aoVivo = await montarRetrato(c, comunidadeId, eventoId)
      let checkin: unknown = null
      if (organizador) {
        const inscritos = (
          await c.query<{ telefone: string | null }>(
            `select i.id as "inscricaoId", i.vinculo_id as "vinculoId", i.nome, i.telefone,
                    i.codigo_checkin as "codigo", i.estado,
                    exists (select 1 from uj.presencas p where p.inscricao_id = i.id) as presente
               from uj.inscricoes i where i.evento_id = $1 and i.estado in ('confirmada', 'espera')
              order by i.nome`,
            [eventoId],
          )
        ).rows.map((r) => ({ ...r, telefone: mascararTelefone(r.telefone) }))
        const membros = (
          await c.query(
            `select p.vinculo_id as "vinculoId", p.nome,
                    exists (select 1 from uj.presencas x where x.evento_id = $1 and x.vinculo_id = p.vinculo_id) as presente
               from uj.pessoas_da_comunidade() p where p.estado = 'ativo' order by p.nome`,
            [eventoId],
          )
        ).rows
        checkin = { inscritos, membros }
      }
      const agora = new Date()
      return {
        geradoEm: agora.toISOString(),
        validadeDias: meta.dias,
        validoAte: new Date(agora.getTime() + meta.dias * 24 * 3600_000).toISOString(),
        cursor: `${meta.marca}:0`,
        vinculoId: meta.eu,
        evento,
        etapas,
        atribuicoes,
        tarefas,
        checklist,
        materiais,
        aoVivo,
        checkin,
      }
    })
  })
}
