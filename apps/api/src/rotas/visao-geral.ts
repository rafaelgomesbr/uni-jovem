import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { permite } from '@uj/dominio'
import { validar } from '../http.ts'
import { atorDoPedido, exigir, naComunidade } from './contexto.ts'

/**
 * Visão geral do Início (D59): números e atalhos, numa chamada só e sem texto.
 *
 * - `escopo=minha` (padrão, todo membro): contagens da própria pessoa na
 *   comunidade do caminho. Pedido de oração entra só como CONTAGEM dos meus
 *   (pelo `uj.meus_pedidos_de_oracao()`); texto nunca sai por aqui.
 * - `escopo=comunidade` (organizador e admin): números da comunidade inteira.
 *   Membro recebe 403. Só contagens e identificadores de encontro; nenhum nome,
 *   contato nem conteúdo de pessoa. Denúncias abertas só para quem pode lê-las
 *   (admin); para o organizador o campo vem nulo.
 *
 * Tudo roda como `uj_api` no contexto da comunidade: a RLS decide o que cada
 * consulta enxerga, e o filtro por `comunidade_id` é a segunda camada.
 */

const consulta = z.object({ escopo: z.enum(['minha', 'comunidade']).default('minha') })

/** O encontro ainda não terminou. */
const FIM = `e.inicio + make_interval(mins => e.duracao_min)`
const NAO_ACABOU = `${FIM} > now()`
const JA_ACABOU = `${FIM} <= now()`
const EU = `(select uj.vinculo_da_conta_no_contexto())`

const arredondar = (n: number) => Math.round(n * 10) / 10

export function registrarRotaDeVisaoGeral(app: FastifyInstance, api: pg.Pool): void {
  app.get(
    '/api/v1/c/:comunidadeId/visao-geral',
    { preHandler: app.comComunidade },
    async (pedido) => {
      const { escopo } = validar(consulta, pedido.query ?? {})
      if (escopo === 'comunidade') exigir(pedido, 'relatorio', 'ler')
      else exigir(pedido, 'evento', 'ler')
      const comunidadeId = pedido.comunidade!.id

      if (escopo === 'minha') {
        return naComunidade(api, pedido, async (c) => {
          const { rows } = await c.query(
            `select
               (select count(*)::int from uj.atribuicoes a join uj.eventos e on e.id = a.evento_id
                 where a.comunidade_id = $1 and a.vinculo_id = ${EU} and a.estado = 'pendente'
                   and e.status in ('publicado', 'adiado') and ${NAO_ACABOU})
                 as "convocacoesParaResponder",
               (select count(*)::int from uj.atribuicoes a join uj.eventos e on e.id = a.evento_id
                 where a.comunidade_id = $1 and a.vinculo_id = ${EU} and a.estado = 'confirmada'
                   and e.status in ('publicado', 'adiado') and ${NAO_ACABOU})
                 as "convocacoesProximas",
               (select count(*)::int from uj.tarefas t join uj.eventos e on e.id = t.evento_id
                 where t.comunidade_id = $1 and t.responsavel_vinculo_id = ${EU}
                   and t.concluida_em is null and e.status <> 'cancelado')
                 as "tarefasAbertas",
               (select count(*)::int from uj.inscricoes i join uj.eventos e on e.id = i.evento_id
                 where i.comunidade_id = $1 and i.vinculo_id = ${EU}
                   and i.estado in ('confirmada', 'espera')
                   and e.status in ('publicado', 'adiado') and ${NAO_ACABOU})
                 as "inscricoes",
               (select count(*)::int from uj.eventos e
                 where e.comunidade_id = $1 and e.status in ('publicado', 'encerrado')
                   and e.inicio < now() and e.inicio >= now() - interval '30 days'
                   and exists (select 1 from uj.presencas p
                                where p.evento_id = e.id and p.vinculo_id = ${EU}))
                 as "presentes30dias",
               (select count(*)::int from uj.eventos e
                 where e.comunidade_id = $1 and e.status in ('publicado', 'encerrado')
                   and e.inicio < now() and e.inicio >= now() - interval '30 days')
                 as "encontros30dias",
               (select count(*)::int from uj.pedidos_oracao p
                 where p.comunidade_id = $1 and p.respondido_em is null
                   and p.id in (select uj.meus_pedidos_de_oracao()))
                 as "oracoesAtivas"`,
            [comunidadeId],
          )
          const r = rows[0] as Record<string, number>
          return {
            escopo,
            convocacoesParaResponder: r['convocacoesParaResponder']!,
            convocacoesProximas: r['convocacoesProximas']!,
            tarefasAbertas: r['tarefasAbertas']!,
            inscricoes: r['inscricoes']!,
            presenca30dias: {
              presentes: r['presentes30dias']!,
              encontros: r['encontros30dias']!,
            },
            oracoesAtivas: r['oracoesAtivas']!,
          }
        })
      }

      const veDenuncias = permite(atorDoPedido(pedido), 'denuncia', 'ler')
      return naComunidade(api, pedido, async (c) => {
        const { rows } = await c.query(
          `select
             (select count(*)::int from uj.pessoas_da_comunidade() where estado = 'ativo')
               as "pessoasAtivas",
             (select count(*) filter (where a.estado = 'pendente')::int
                from uj.atribuicoes a join uj.eventos e on e.id = a.evento_id
               where a.comunidade_id = $1 and e.status = 'publicado' and ${NAO_ACABOU})
               as "semResposta",
             (select count(*) filter (where a.estado = 'recusada')::int
                from uj.atribuicoes a join uj.eventos e on e.id = a.evento_id
               where a.comunidade_id = $1 and e.status = 'publicado' and ${NAO_ACABOU})
               as "recusadas",
             (select count(*)::int from uj.pedidos_de_entrada
               where comunidade_id = $1 and estado = 'pendente') as "pedidosDeEntrada",
             (select count(*)::int from uj.denuncias
               where comunidade_id = $1 and estado = 'aberta') as "denunciasAbertas",
             (select count(*)::int from uj.tarefas t join uj.eventos e on e.id = t.evento_id
               where t.comunidade_id = $1 and t.concluida_em is null and t.prazo < now()
                 and e.status <> 'cancelado') as "tarefasAtrasadas",
             (select count(*)::int from (
                select e.id from uj.eventos e
                 where e.comunidade_id = $1 and e.status in ('publicado', 'encerrado')
                   and ${JA_ACABOU}
                 order by e.inicio desc limit 5) ultimos) as "ultimosEncontros",
             (select coalesce(sum(n), 0)::int from (
                select (select count(*) from uj.presencas p where p.evento_id = e.id) as n
                  from uj.eventos e
                 where e.comunidade_id = $1 and e.status in ('publicado', 'encerrado')
                   and ${JA_ACABOU}
                 order by e.inicio desc limit 5) soma) as "presentesNosUltimos"`,
          [comunidadeId],
        )
        const r = rows[0] as Record<string, number>
        // Próximos 14 dias: só encontros publicados, com a situação das convocações.
        const proximos = (
          await c.query(
            `select e.id, e.titulo, e.inicio, e.fuso,
                    count(a.id)::int as convocados,
                    count(a.id) filter (where a.estado = 'pendente')::int as "semResposta",
                    count(a.id) filter (where a.estado = 'recusada')::int as recusadas
               from uj.eventos e
               left join uj.atribuicoes a on a.evento_id = e.id and a.comunidade_id = e.comunidade_id
              where e.comunidade_id = $1 and e.status = 'publicado' and ${NAO_ACABOU}
                and e.inicio < now() + interval '14 days'
              group by e.id
              order by e.inicio
              limit 5`,
            [comunidadeId],
          )
        ).rows
        const ultimos = r['ultimosEncontros']!
        return {
          escopo,
          pessoasAtivas: r['pessoasAtivas']!,
          proximosEncontros: proximos,
          convocacoes: { semResposta: r['semResposta']!, recusadas: r['recusadas']! },
          pedidosDeEntrada: r['pedidosDeEntrada']!,
          denunciasAbertas: veDenuncias ? r['denunciasAbertas']! : null,
          presencaMedia: {
            encontros: ultimos,
            media: ultimos > 0 ? arredondar(r['presentesNosUltimos']! / ultimos) : null,
          },
          tarefasAtrasadas: r['tarefasAtrasadas']!,
        }
      })
    },
  )
}
