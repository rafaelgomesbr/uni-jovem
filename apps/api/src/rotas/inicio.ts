import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { exigir, naComunidade } from './contexto.ts'

/**
 * Tela de Início (F10): o que importa para a pessoa na comunidade ativa, numa
 * chamada só. Cada lista é curta e já vem filtrada pela RLS (membro não vê
 * rascunho; tarefas e escalas são as da própria pessoa).
 */
export function registrarRotaDeInicio(app: FastifyInstance, api: pg.Pool): void {
  app.get('/api/v1/c/:comunidadeId/inicio', { preHandler: app.comComunidade }, async (pedido) => {
    exigir(pedido, 'evento', 'ler')
    return naComunidade(api, pedido, async (c) => {
      const proximosEventos = (
        await c.query(
          `select e.id, e.titulo, e.categoria, e.inicio, e.duracao_min as "duracaoMin", e.status,
                  l.nome as "localNome", l.tipo as "localTipo"
             from uj.eventos e left join uj.locais l on l.id = e.local_id
            where e.comunidade_id = $1 and e.inicio >= now() - interval '3 hours'
              and e.status in ('publicado', 'adiado', 'rascunho')
            order by e.inicio limit 5`,
          [pedido.comunidade!.id],
        )
      ).rows
      const minhasEscalas = (
        await c.query(
          `select a.id, a.funcao, a.estado, e.id as "eventoId", e.titulo as "eventoTitulo",
                  e.inicio as "eventoInicio", t.titulo as "etapaTitulo"
             from uj.atribuicoes a
             join uj.eventos e on e.id = a.evento_id
             left join uj.etapas t on t.id = a.etapa_id
            where a.vinculo_id = (select uj.vinculo_da_conta_no_contexto())
              and e.inicio >= now() - interval '3 hours' and e.status <> 'cancelado'
            order by e.inicio limit 5`,
        )
      ).rows
      const minhasTarefas = (
        await c.query(
          `select t.id, t.titulo, t.prazo, e.id as "eventoId", e.titulo as "eventoTitulo"
             from uj.tarefas t join uj.eventos e on e.id = t.evento_id
            where t.responsavel_vinculo_id = (select uj.vinculo_da_conta_no_contexto())
              and t.concluida_em is null and e.status <> 'cancelado'
            order by t.prazo nulls last, e.inicio limit 8`,
        )
      ).rows
      const substituicoesAbertas = (
        await c.query<{ n: number }>(
          `select count(*)::int as n from uj.substituicoes s
             join uj.atribuicoes a on a.id = s.atribuicao_id
             join uj.eventos e on e.id = a.evento_id
            where s.estado = 'aberta' and e.inicio >= now()
              and s.pedida_por <> coalesce((select uj.vinculo_da_conta_no_contexto()), '00000000-0000-0000-0000-000000000000')
              and (s.para_vinculo_id is null or s.para_vinculo_id = (select uj.vinculo_da_conta_no_contexto()))`,
        )
      ).rows[0]!.n
      // Avisos publicados (a RLS já esconde rascunho e vencido): fixados primeiro.
      const avisos = (
        await c.query(
          `select id, titulo, texto, fixado, publicado_em as "publicadoEm"
             from uj.avisos
            where comunidade_id = $1 and estado = 'publicado'
              and (visivel_ate is null or visivel_ate > now())
            order by fixado desc, publicado_em desc limit 5`,
          [pedido.comunidade!.id],
        )
      ).rows
      return { proximosEventos, minhasEscalas, minhasTarefas, substituicoesAbertas, avisos }
    })
  })
}
