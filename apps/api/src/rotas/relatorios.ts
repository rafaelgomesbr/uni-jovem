import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { dataValida, ehPapel, NOME_DO_PAPEL } from '@uj/dominio'
import { gerarToken, hashDeToken } from '../autenticacao/cripto.ts'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { BOM_UTF8, gerarCsv, type Celula } from '../relatorios/csv.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Relatórios e exportações (F16).
 *
 * Tudo é consulta feita como `uj_api` na comunidade do contexto: a RLS decide
 * o que entra (isolamento entre comunidades, rascunhos, inscrições). Os
 * relatórios só trazem números e nomes; contatos só aparecem na exportação
 * "com contatos", que exige admin (matriz e política de `uj.exportacoes`).
 * Pedidos de oração ficam fora de qualquer relatório, nem como contagem.
 *
 * Exportação: o CSV é gerado na hora, guardado com dona e validade de 24 h, e
 * baixado com um token de 256 bits que vai no CORPO de um POST (não na URL:
 * URL acaba em log e em histórico). Do token, o banco guarda só o SHA-256.
 */

const dataLocal = z.string().refine(dataValida, 'Data no formato AAAA-MM-DD.')
const DIAS_PADRAO = 90
const DIAS_MAXIMOS = 731
const LIMITE_DE_LINHAS = 50_000

const filtrosDoPeriodo = {
  de: dataLocal.optional(),
  ate: dataLocal.optional(),
}

interface Periodo {
  de: string
  ate: string
  fuso: string
  hoje: string
}

function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)
}

/** Período no fuso da comunidade. Padrão: os últimos 90 dias até hoje. */
async function lerPeriodo(
  c: pg.PoolClient,
  comunidadeId: string,
  q: { de?: string | undefined; ate?: string | undefined },
): Promise<Periodo> {
  const { rows } = await c.query<{ fuso: string; hoje: string }>(
    `select fuso, to_char(now() at time zone fuso, 'YYYY-MM-DD') as hoje
       from uj.comunidades where id = $1`,
    [comunidadeId],
  )
  if (!rows[0]) throw NAO_ENCONTRADO()
  const ate = q.ate ?? rows[0].hoje
  const de = q.de ?? somarDias(ate, -(DIAS_PADRAO - 1))
  if (de > ate) {
    throw new ErroHttp('periodo_invalido', 400, 'A data inicial precisa ser antes da final.')
  }
  if (diasEntre(de, ate) > DIAS_MAXIMOS) {
    throw new ErroHttp('periodo_longo', 400, 'Escolha um período de até dois anos.')
  }
  return { de, ate, fuso: rows[0].fuso, hoje: rows[0].hoje }
}

// Evento "no período": a data local do início (no fuso do evento) está entre $2 e $3.
const NO_PERIODO = `(e.inicio at time zone e.fuso)::date between $2::date and $3::date`
const quandoNoPeriodo = (coluna: string) =>
  `(${coluna} at time zone $4)::date between $2::date and $3::date`

const taxa = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : null)

// ------------------------------------------------------------ exportação

export const TIPOS_DE_EXPORTACAO = ['presenca', 'inscricoes', 'escalas', 'membros'] as const
type TipoDeExportacao = (typeof TIPOS_DE_EXPORTACAO)[number]

const ORIGEM_DA_PRESENCA: Record<string, string> = {
  qr: 'QR',
  manual: 'manual',
  offline: 'sem internet',
}
const SITUACAO_DA_ESCALA: Record<string, string> = {
  confirmada: 'confirmada',
  recusada: 'recusada',
  pendente: 'sem resposta',
  substituicao_pedida: 'substituição pedida',
}
const SITUACAO_DA_INSCRICAO: Record<string, string> = {
  confirmada: 'confirmada',
  espera: 'lista de espera',
  cancelada: 'cancelada',
}

type LinhaSql = Record<string, Celula>

/**
 * As consultas SEM contatos não pedem as colunas de contato ao banco: o que
 * não é lido não tem como vazar para o arquivo.
 */
async function linhasDaExportacao(
  c: pg.PoolClient,
  comunidadeId: string,
  tipo: TipoDeExportacao,
  comContatos: boolean,
  p: Periodo,
): Promise<{ cabecalho: string[]; linhas: Celula[][] }> {
  const contatosDasPessoas = comContatos ? ', email, whatsapp' : ''
  const pessoas = `pessoas as materialized (
    select vinculo_id, nome${contatosDasPessoas} from uj.pessoas_da_comunidade())`
  const params = [comunidadeId, p.de, p.ate]
  const consultar = async (sql: string, valores: unknown[]) => {
    const { rows } = await c.query<LinhaSql>(`${sql} limit ${LIMITE_DE_LINHAS + 1}`, valores)
    if (rows.length > LIMITE_DE_LINHAS) {
      throw new ErroHttp(
        'exportacao_grande',
        422,
        'Este período tem dados demais para um arquivo só. Escolha um período menor.',
      )
    }
    return rows
  }
  const data = (coluna: string) => `to_char(${coluna} at time zone e.fuso, 'DD/MM/YYYY HH24:MI')`

  switch (tipo) {
    case 'presenca': {
      const rows = await consultar(
        `with ${pessoas}
         select e.titulo, ${data('e.inicio')} as data, e.categoria,
                coalesce(i.nome, pc.nome, p.nome_avulso, 'Pessoa inativa') as nome,
                case when p.inscricao_id is not null then 'inscrição'
                     when p.vinculo_id is not null then 'membro' else 'sem inscrição' end as tipo,
                p.origem, ${data('p.ocorrida_em')} as registrada
                ${comContatos ? ', coalesce(i.telefone, pc.whatsapp) as telefone, coalesce(i.email, pc.email) as email' : ''}
           from uj.presencas p
           join uj.eventos e on e.id = p.evento_id
           left join uj.inscricoes i on i.id = p.inscricao_id
           left join pessoas pc on pc.vinculo_id = p.vinculo_id
          where p.comunidade_id = $1 and ${NO_PERIODO}
          order by e.inicio, 4`,
        params,
      )
      return {
        cabecalho: [
          'Evento',
          'Data do evento',
          'Categoria',
          'Nome',
          'Tipo',
          'Registro',
          'Registrada em',
          ...(comContatos ? ['Telefone', 'E-mail'] : []),
        ],
        linhas: rows.map((r) => [
          r['titulo'],
          r['data'],
          r['categoria'],
          r['nome'],
          r['tipo'],
          ORIGEM_DA_PRESENCA[String(r['origem'])] ?? r['origem'],
          r['registrada'],
          ...(comContatos ? [r['telefone'], r['email']] : []),
        ]),
      }
    }
    case 'inscricoes': {
      const rows = await consultar(
        `with ${pessoas}
         select e.titulo, ${data('e.inicio')} as data, i.nome,
                case i.origem when 'publica' then 'página pública' else 'membro' end as origem,
                i.estado, exists (select 1 from uj.presencas x where x.inscricao_id = i.id) as presente,
                ${data('i.criado_em')} as inscrita
                ${comContatos ? ', coalesce(i.telefone, pc.whatsapp) as telefone, coalesce(i.email, pc.email) as email' : ''}
           from uj.inscricoes i
           join uj.eventos e on e.id = i.evento_id
           left join pessoas pc on pc.vinculo_id = i.vinculo_id
          where i.comunidade_id = $1 and ${NO_PERIODO}
          order by e.inicio, i.criado_em`,
        params,
      )
      return {
        cabecalho: [
          'Evento',
          'Data do evento',
          'Nome',
          'Origem',
          'Situação',
          'Presente',
          'Inscrita em',
          ...(comContatos ? ['Telefone', 'E-mail'] : []),
        ],
        linhas: rows.map((r) => [
          r['titulo'],
          r['data'],
          r['nome'],
          r['origem'],
          SITUACAO_DA_INSCRICAO[String(r['estado'])] ?? r['estado'],
          r['presente'],
          r['inscrita'],
          ...(comContatos ? [r['telefone'], r['email']] : []),
        ]),
      }
    }
    case 'escalas': {
      const rows = await consultar(
        `with ${pessoas}
         select e.titulo, ${data('e.inicio')} as data, coalesce(t.titulo, 'Evento inteiro') as etapa,
                a.funcao, coalesce(pc.nome, 'Pessoa inativa') as pessoa, a.estado,
                (select coalesce(px.nome, 'Pessoa inativa') from uj.substituicoes s
                   left join pessoas px on px.vinculo_id = s.pedida_por
                  where s.atribuicao_id = a.id and s.estado = 'assumida'
                  order by s.resolvida_em desc limit 1) as substituiu
                ${comContatos ? ', pc.whatsapp as telefone, pc.email' : ''}
           from uj.atribuicoes a
           join uj.eventos e on e.id = a.evento_id
           left join uj.etapas t on t.id = a.etapa_id
           left join pessoas pc on pc.vinculo_id = a.vinculo_id
          where a.comunidade_id = $1 and e.status not in ('rascunho', 'cancelado') and ${NO_PERIODO}
          order by e.inicio, t.ordem nulls first, 5`,
        params,
      )
      return {
        cabecalho: [
          'Evento',
          'Data do evento',
          'Etapa',
          'Função',
          'Pessoa',
          'Situação',
          'No lugar de',
          ...(comContatos ? ['Telefone', 'E-mail'] : []),
        ],
        linhas: rows.map((r) => [
          r['titulo'],
          r['data'],
          r['etapa'],
          r['funcao'],
          r['pessoa'],
          SITUACAO_DA_ESCALA[String(r['estado'])] ?? r['estado'],
          r['substituiu'],
          ...(comContatos ? [r['telefone'], r['email']] : []),
        ]),
      }
    }
    case 'membros': {
      const rows = await consultar(
        `select nome, papel, estado, array['equipe_oracao'] <@ designacoes as equipe,
                to_char(desde at time zone $1, 'DD/MM/YYYY') as desde${contatosDasPessoas}
           from uj.pessoas_da_comunidade() order by nome`,
        [p.fuso],
      )
      return {
        cabecalho: [
          'Nome',
          'Papel',
          'Situação',
          'Equipe de oração',
          'Desde',
          ...(comContatos ? ['E-mail', 'WhatsApp'] : []),
        ],
        linhas: rows.map((r) => [
          r['nome'],
          ehPapel(r['papel']) ? NOME_DO_PAPEL[r['papel']] : r['papel'],
          r['estado'],
          r['equipe'],
          r['desde'],
          ...(comContatos ? [r['email'], r['whatsapp']] : []),
        ]),
      }
    }
  }
}

// ------------------------------------------------------------ rotas

export function registrarRotasDeRelatorios(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId'
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })

  const consultaDeEventos = z.object({
    ...filtrosDoPeriodo,
    categoria: z.string().trim().min(2).max(60).optional(),
    agrupar: z.enum(['semana', 'mes']).default('mes'),
  })

  /** Presença por evento e por período (semana ou mês). */
  app.get(`${base}/relatorios/presenca`, naCom, async (pedido) => {
    exigir(pedido, 'relatorio', 'ler')
    const q = validar(consultaDeEventos, pedido.query)
    return tx(pedido, async (c) => {
      const p = await lerPeriodo(c, pedido.comunidade!.id, q)
      const params = [pedido.comunidade!.id, p.de, p.ate, q.categoria ?? null]
      const filtro = `e.comunidade_id = $1 and e.status not in ('rascunho', 'cancelado')
        and ${NO_PERIODO} and ($4::text is null or e.categoria = $4)`
      const porEvento = (
        await c.query<{ presentes: number }>(
          `select e.id, e.titulo, e.categoria, e.inicio, e.status,
                  count(p.id)::int as presentes,
                  count(p.id) filter (where p.inscricao_id is not null)::int as "presentesInscritos",
                  count(p.id) filter (where p.inscricao_id is null and p.vinculo_id is not null)::int
                    as "presentesMembros",
                  count(p.id) filter (where p.inscricao_id is null and p.vinculo_id is null)::int
                    as "presentesSemInscricao"
             from uj.eventos e left join uj.presencas p on p.evento_id = e.id
            where ${filtro}
            group by e.id order by e.inicio`,
          params,
        )
      ).rows
      const porPeriodo = (
        await c.query<{ eventos: number; presentes: number }>(
          `select to_char(date_trunc($5, e.inicio at time zone e.fuso), 'YYYY-MM-DD') as inicio,
                  count(distinct e.id)::int as eventos, count(p.id)::int as presentes,
                  count(distinct p.vinculo_id)::int as "membrosDistintos"
             from uj.eventos e left join uj.presencas p on p.evento_id = e.id
            where ${filtro}
            group by 1 order by 1`,
          [...params, q.agrupar === 'semana' ? 'week' : 'month'],
        )
      ).rows.map((r) => ({
        ...r,
        mediaPorEvento: r.eventos > 0 ? Math.round((r.presentes / r.eventos) * 10) / 10 : 0,
      }))
      const distintos = (
        await c.query<{ n: number }>(
          `select count(distinct p.vinculo_id)::int as n
             from uj.eventos e join uj.presencas p on p.evento_id = e.id where ${filtro}`,
          params,
        )
      ).rows[0]!.n
      const presentes = porEvento.reduce((s, r) => s + r.presentes, 0)
      return {
        periodo: { ...p, agrupar: q.agrupar },
        totais: {
          eventos: porEvento.length,
          presentes,
          mediaPorEvento:
            porEvento.length > 0 ? Math.round((presentes / porEvento.length) * 10) / 10 : 0,
          membrosDistintos: distintos,
        },
        porPeriodo,
        porEvento,
      }
    })
  })

  /** Inscrições versus presença, por evento. Faltas só contam em evento já realizado. */
  app.get(`${base}/relatorios/inscricoes`, naCom, async (pedido) => {
    exigir(pedido, 'relatorio', 'ler')
    const q = validar(consultaDeEventos, pedido.query)
    return tx(pedido, async (c) => {
      const p = await lerPeriodo(c, pedido.comunidade!.id, q)
      const { rows } = await c.query<{
        realizado: boolean
        confirmadas: number
        compareceram: number
        espera: number
        canceladas: number
        presentesSemInscricao: number
      }>(
        `select e.id, e.titulo, e.inicio, e.status, e.capacidade, e.inicio <= now() as realizado,
                count(i.id) filter (where i.estado = 'confirmada')::int as confirmadas,
                count(i.id) filter (where i.estado = 'espera')::int as espera,
                count(i.id) filter (where i.estado = 'cancelada')::int as canceladas,
                count(i.id) filter (where i.estado <> 'cancelada' and i.origem = 'publica')::int as publicas,
                count(i.id) filter (where i.estado <> 'cancelada' and i.origem = 'membro')::int as "deMembros",
                count(i.id) filter (where i.estado = 'confirmada'
                  and exists (select 1 from uj.presencas x where x.inscricao_id = i.id))::int as compareceram,
                (select count(*)::int from uj.presencas x where x.evento_id = e.id and x.inscricao_id is null)
                  as "presentesSemInscricao"
           from uj.eventos e left join uj.inscricoes i on i.evento_id = e.id
          where e.comunidade_id = $1 and e.status not in ('rascunho', 'cancelado') and ${NO_PERIODO}
            and ($4::text is null or e.categoria = $4)
          group by e.id order by e.inicio`,
        [pedido.comunidade!.id, p.de, p.ate, q.categoria ?? null],
      )
      const porEvento = rows.map((r) => ({
        ...r,
        faltaram: r.realizado ? r.confirmadas - r.compareceram : null,
        taxaDeComparecimento: r.realizado ? taxa(r.compareceram, r.confirmadas) : null,
      }))
      const realizados = porEvento.filter((r) => r.realizado)
      const soma = (lista: typeof porEvento, campo: 'confirmadas' | 'compareceram') =>
        lista.reduce((s, r) => s + r[campo], 0)
      const confirmadasRealizados = soma(realizados, 'confirmadas')
      const compareceram = soma(realizados, 'compareceram')
      return {
        periodo: p,
        totais: {
          eventos: porEvento.length,
          eventosRealizados: realizados.length,
          confirmadas: soma(porEvento, 'confirmadas'),
          espera: porEvento.reduce((s, r) => s + r.espera, 0),
          canceladas: porEvento.reduce((s, r) => s + r.canceladas, 0),
          compareceram,
          faltaram: confirmadasRealizados - compareceram,
          presentesSemInscricao: realizados.reduce((s, r) => s + r.presentesSemInscricao, 0),
          taxaDeComparecimento: taxa(compareceram, confirmadasRealizados),
        },
        porEvento,
      }
    })
  })

  /** Escalas cumpridas (confirmadas em evento já realizado) e substituições. */
  app.get(`${base}/relatorios/escalas`, naCom, async (pedido) => {
    exigir(pedido, 'relatorio', 'ler')
    const q = validar(consultaDeEventos, pedido.query)
    return tx(pedido, async (c) => {
      const p = await lerPeriodo(c, pedido.comunidade!.id, q)
      const ctes = `with ev as (
          select e.id, e.inicio from uj.eventos e
           where e.comunidade_id = $1 and e.status not in ('rascunho', 'cancelado') and ${NO_PERIODO}
             and ($4::text is null or e.categoria = $4)),
        esc as (select a.id, a.evento_id, a.vinculo_id, a.estado, ev.inicio
                  from uj.atribuicoes a join ev on ev.id = a.evento_id),
        subs as (select s.* from uj.substituicoes s join esc on esc.id = s.atribuicao_id)`
      const params = [pedido.comunidade!.id, p.de, p.ate, q.categoria ?? null]
      const totais = (
        await c.query(
          `${ctes}
           select (select count(*)::int from esc) as escalas,
                  (select count(*)::int from esc where estado = 'confirmada') as confirmadas,
                  (select count(*)::int from esc where estado = 'recusada') as recusadas,
                  (select count(*)::int from esc where estado = 'pendente') as "semResposta",
                  (select count(*)::int from esc where estado = 'substituicao_pedida') as "substituicaoPedida",
                  (select count(*)::int from esc where estado = 'confirmada' and inicio <= now()) as cumpridas,
                  (select count(*)::int from esc where estado = 'confirmada' and inicio <= now()
                     and exists (select 1 from uj.presencas x
                                  where x.evento_id = esc.evento_id and x.vinculo_id = esc.vinculo_id))
                    as "cumpridasComPresenca",
                  (select count(*)::int from subs) as "substituicoesPedidas",
                  (select count(*)::int from subs where estado = 'assumida') as "substituicoesAssumidas",
                  (select count(*)::int from subs where estado = 'cancelada') as "substituicoesCanceladas",
                  (select count(*)::int from subs where estado = 'aberta') as "substituicoesAbertas"`,
          params,
        )
      ).rows[0]
      const porPessoa = (
        await c.query(
          `${ctes},
           pessoas as materialized (select vinculo_id, nome from uj.pessoas_da_comunidade()),
           quem as (select vinculo_id from esc union select pedida_por from subs
                    union select assumida_por from subs where assumida_por is not null)
           select q.vinculo_id as "vinculoId", coalesce(pc.nome, 'Pessoa inativa') as nome,
                  (select count(*)::int from esc where esc.vinculo_id = q.vinculo_id) as escalas,
                  (select count(*)::int from esc where esc.vinculo_id = q.vinculo_id
                     and estado = 'confirmada') as confirmadas,
                  (select count(*)::int from esc where esc.vinculo_id = q.vinculo_id
                     and estado = 'recusada') as recusadas,
                  (select count(*)::int from esc where esc.vinculo_id = q.vinculo_id
                     and estado = 'confirmada' and inicio <= now()) as cumpridas,
                  (select count(*)::int from subs where subs.pedida_por = q.vinculo_id)
                    as "substituicoesPedidas",
                  (select count(*)::int from subs where subs.assumida_por = q.vinculo_id)
                    as "substituicoesAssumidas"
             from quem q left join pessoas pc on pc.vinculo_id = q.vinculo_id
            order by 2`,
          params,
        )
      ).rows
      return { periodo: p, totais, porPessoa }
    })
  })

  /** Atividade da comunidade no período: só contagens. */
  app.get(`${base}/relatorios/atividade`, naCom, async (pedido) => {
    exigir(pedido, 'relatorio', 'ler')
    const q = validar(z.object(filtrosDoPeriodo), pedido.query)
    return tx(pedido, async (c) => {
      const p = await lerPeriodo(c, pedido.comunidade!.id, q)
      const { rows } = await c.query(
        `select
           (select count(*)::int from uj.eventos e where e.comunidade_id = $1
              and e.status in ('publicado', 'encerrado') and e.inicio <= now() and ${NO_PERIODO})
             as "eventosRealizados",
           (select count(*)::int from uj.eventos e where e.comunidade_id = $1
              and e.status in ('publicado', 'adiado') and e.inicio > now() and ${NO_PERIODO})
             as "eventosPrevistos",
           (select count(*)::int from uj.eventos e where e.comunidade_id = $1
              and e.status = 'cancelado' and ${NO_PERIODO}) as "eventosCancelados",
           (select count(*)::int from uj.inscricoes i where i.comunidade_id = $1
              and ${quandoNoPeriodo('i.criado_em')}) as inscricoes,
           (select count(*)::int from uj.presencas x where x.comunidade_id = $1
              and ${quandoNoPeriodo('x.ocorrida_em')}) as presencas,
           (select count(*)::int from uj.vinculos v where v.comunidade_id = $1
              and ${quandoNoPeriodo('v.criado_em')}) as "novosVinculos",
           (select count(*)::int from uj.avisos a where a.comunidade_id = $1
              and a.publicado_em is not null and ${quandoNoPeriodo('a.publicado_em')})
             as "avisosPublicados",
           (select count(*)::int from uj.sugestoes s where s.comunidade_id = $1
              and ${quandoNoPeriodo('s.criado_em')}) as "sugestoesRecebidas",
           (select count(*)::int from uj.sugestoes s where s.comunidade_id = $1
              and s.status = 'aceita' and ${quandoNoPeriodo('s.criado_em')}) as "sugestoesAceitas",
           (select count(*)::int from uj.substituicoes s where s.comunidade_id = $1
              and ${quandoNoPeriodo('s.criado_em')}) as "substituicoesPedidas"`,
        [pedido.comunidade!.id, p.de, p.ate, p.fuso],
      )
      return { periodo: p, atividade: rows[0] }
    })
  })

  // ---------------------------------------------------------------- exportações

  const CAMPOS_DA_EXPORTACAO = `id, tipo, com_contatos as "comContatos", filtros,
    nome_arquivo as "nomeArquivo", linhas, criado_em as "criadoEm", expira_em as "expiraEm",
    baixada_em as "baixadaEm", downloads`

  /** As minhas exportações ainda válidas (sem conteúdo e sem token). */
  app.get(`${base}/exportacoes`, naCom, async (pedido) => {
    exigir(pedido, 'exportacao', 'baixar', { proprio: true })
    return tx(pedido, async (c) => {
      await c.query('select uj.expurgar_minhas_exportacoes_vencidas()')
      const { rows } = await c.query(
        `select ${CAMPOS_DA_EXPORTACAO} from uj.exportacoes
          where comunidade_id = $1 and dono_conta_id = $2 order by criado_em desc`,
        [pedido.comunidade!.id, pedido.sessao!.contaId],
      )
      return { exportacoes: rows }
    })
  })

  app.post(`${base}/exportacoes`, naCom, async (pedido) => {
    const e = validar(
      z.object({
        tipo: z.enum(TIPOS_DE_EXPORTACAO),
        comContatos: z.boolean().default(false),
        ...filtrosDoPeriodo,
      }),
      pedido.body,
    )
    exigir(pedido, 'exportacao', e.comContatos ? 'com_contatos' : 'sem_contatos')
    const token = gerarToken()
    return tx(pedido, async (c) => {
      await c.query('select uj.expurgar_minhas_exportacoes_vencidas()')
      const p = await lerPeriodo(c, pedido.comunidade!.id, e)
      const { cabecalho, linhas } = await linhasDaExportacao(
        c,
        pedido.comunidade!.id,
        e.tipo,
        e.comContatos,
        p,
      )
      const nomeArquivo =
        e.tipo === 'membros' ? `membros_${p.hoje}.csv` : `${e.tipo}_${p.de}_a_${p.ate}.csv`
      const filtros = e.tipo === 'membros' ? {} : { de: p.de, ate: p.ate }
      const { rows } = await c.query<{ id: string; expiraEm: Date }>(
        `insert into uj.exportacoes (comunidade_id, tipo, com_contatos, filtros, token_hash,
                                     nome_arquivo, conteudo, linhas)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, expira_em as "expiraEm"`,
        [
          pedido.comunidade!.id,
          e.tipo,
          e.comContatos,
          JSON.stringify(filtros),
          hashDeToken(token),
          nomeArquivo,
          gerarCsv(cabecalho, linhas),
          linhas.length,
        ],
      )
      const id = rows[0]!.id
      // Sem o conteúdo: só o que foi exportado, por quem e quantas linhas.
      await auditar(
        c,
        pedido,
        'exportacao.gerada',
        { tipo: 'exportacao', id },
        { tipo: e.tipo, comContatos: e.comContatos, linhas: linhas.length, ...filtros },
      )
      return {
        id,
        token,
        nomeArquivo,
        linhas: linhas.length,
        expiraEm: rows[0]!.expiraEm,
        baixar: {
          metodo: 'POST',
          caminho: `/api/v1/c/${pedido.comunidade!.id}/exportacoes/${id}/arquivo`,
        },
      }
    })
  })

  /** Baixar: dona, dentro da validade, com o token. Qualquer falha = 404. */
  app.post(`${base}/exportacoes/:exportacaoId/arquivo`, naCom, async (pedido, resposta) => {
    exigir(pedido, 'exportacao', 'baixar', { proprio: true })
    const exportacaoId = idDoCaminho(pedido, 'exportacaoId')
    const corpo = z.object({ token: z.string().regex(/^[\w-]{20,200}$/) }).safeParse(pedido.body)
    if (!corpo.success) throw NAO_ENCONTRADO()
    const arquivo = await tx(pedido, async (c) => {
      const { rows } = await c.query<{
        nomeArquivo: string
        conteudo: string
        tipo: string
        comContatos: boolean
      }>(
        `update uj.exportacoes set downloads = downloads + 1, baixada_em = now()
          where id = $1 and comunidade_id = $2 and token_hash = $3 and expira_em > now()
          returning nome_arquivo as "nomeArquivo", conteudo, tipo, com_contatos as "comContatos"`,
        [exportacaoId, pedido.comunidade!.id, hashDeToken(corpo.data.token)],
      )
      if (!rows[0]) throw NAO_ENCONTRADO()
      await auditar(
        c,
        pedido,
        'exportacao.baixada',
        { tipo: 'exportacao', id: exportacaoId },
        { tipo: rows[0].tipo, comContatos: rows[0].comContatos },
      )
      return rows[0]
    })
    return resposta
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${arquivo.nomeArquivo}"`)
      .send(`${BOM_UTF8}${arquivo.conteudo}`)
  })

  app.delete(`${base}/exportacoes/:exportacaoId`, naCom, async (pedido) => {
    exigir(pedido, 'exportacao', 'baixar', { proprio: true })
    const exportacaoId = idDoCaminho(pedido, 'exportacaoId')
    return tx(pedido, async (c) => {
      const r = await c.query(
        'delete from uj.exportacoes where id = $1 and comunidade_id = $2 and dono_conta_id = $3',
        [exportacaoId, pedido.comunidade!.id, pedido.sessao!.contaId],
      )
      if (!r.rowCount) throw NAO_ENCONTRADO()
      await auditar(c, pedido, 'exportacao.excluida', { tipo: 'exportacao', id: exportacaoId })
      return { ok: true }
    })
  })
}
