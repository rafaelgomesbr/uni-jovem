import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { ehConvocacaoDeLouvor, ehEtapaDeLouvor, nomeDoTom } from '@uj/dominio'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Repertório do encontro e "Meu repertório" (D61, fatia 1 do modo músico).
 *
 * Permissões da matriz que já existiam: ler o repertório é `etapa.ler`
 * (membro), montar e ordenar é `etapa.gerenciar` (organizador), avisar a banda
 * é `escala.atribuir` (quem convoca) e o Meu repertório é `escala.ler`, mas
 * só devolve o que é da própria pessoa convocada. A RLS do banco é a segunda
 * camada: rascunho só para organizador, tudo da comunidade do contexto.
 *
 * A letra e a cifra nunca vão para log, para auditoria nem para o texto de
 * notificação: a auditoria leva só ids e contagens.
 */

const tomDoDia = z
  .string()
  .trim()
  .max(12)
  .refine((v) => v === '' || nomeDoTom(v) !== null, 'Use um tom como G, Am ou F#m.')
  .transform((v) => (v === '' ? null : nomeDoTom(v)))

const nota = z
  .string()
  .trim()
  .max(300, 'Encurte a observação: até 300 letras.')
  .transform((v) => (v === '' ? null : v))

function conflito(atual: unknown): ErroHttp & { atual?: unknown } {
  const e = new ErroHttp(
    'conflito',
    409,
    'Outra pessoa alterou o repertório enquanto você editava. Confira a lista atual antes de salvar de novo.',
  ) as ErroHttp & { atual?: unknown }
  e.atual = atual
  return e
}

const ERROS_DO_BANCO: Record<string, [string, number, string]> = {
  UJ101: ['nao_encontrado', 404, 'Não encontramos este encontro.'],
  UJ102: [
    'encontro_fora_do_ar',
    409,
    'Só dá para avisar a banda de um encontro publicado que ainda não terminou. Publique o encontro antes.',
  ],
}

function traduzir(e: unknown): never {
  if (e instanceof ErroHttp) throw e
  const codigo = (e as { code?: string }).code
  const t = codigo ? ERROS_DO_BANCO[codigo] : undefined
  if (t) throw new ErroHttp(t[0], t[1], t[2])
  if (codigo === '23505') {
    throw new ErroHttp('ja_no_repertorio', 409, 'Esta música já está no repertório deste encontro.')
  }
  traduzirErroDoBanco(e)
}

/** Itens do repertório de um encontro, com o que a lista precisa da música (sem a cifra). */
const SELECAO_DO_ITEM = `r.id, r.ordem, r.musica_id as "musicaId", r.etapa_id as "etapaId",
       r.tom_do_dia as "tomDoDia", r.nota, r.versao,
       m.titulo, m.artista, m.tom as "tomOriginal", m.andamento_bpm as "andamentoBpm",
       m.duracao_seg as "duracaoSeg", m.arquivada,
       (m.cifra is not null and btrim(m.cifra) <> '') as "temCifra"`

export function registrarRotasDeRepertorio(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId'
  const ev = `${base}/eventos/:eventoId`
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        traduzir(e)
      }
    })

  /** O encontro existe nesta comunidade (e a pessoa o vê, pela RLS)? Senão, 404. */
  async function exigirEvento(c: pg.PoolClient, comunidadeId: string, eventoId: string) {
    const { rows } = await c.query<{ id: string }>(
      'select id from uj.eventos where id = $1 and comunidade_id = $2',
      [eventoId, comunidadeId],
    )
    if (!rows[0]) throw NAO_ENCONTRADO()
  }

  /** Serializa as mudanças do repertório de um encontro (ordem não colide em corrida). */
  async function travar(c: pg.PoolClient, eventoId: string) {
    await c.query('select pg_advisory_xact_lock(hashtextextended($1, 27))', [eventoId])
  }

  // ---------------------------------------------------------------- repertório do encontro

  app.get(`${ev}/repertorio`, naCom, async (pedido) => {
    exigir(pedido, 'etapa', 'ler')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      await exigirEvento(c, comunidadeId, eventoId)
      const { rows } = await c.query(
        `select ${SELECAO_DO_ITEM}
           from uj.repertorio_itens r join uj.musicas m on m.id = r.musica_id
          where r.evento_id = $1 and r.comunidade_id = $2
          order by r.ordem`,
        [eventoId, comunidadeId],
      )
      return { itens: rows }
    })
  })

  app.post(`${ev}/repertorio`, naCom, async (pedido) => {
    exigir(pedido, 'etapa', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const corpo = validar(
      z.object({
        musicaId: z.uuid(),
        etapaId: z.uuid().nullish(),
        tomDoDia: tomDoDia.nullish(),
        nota: nota.nullish(),
      }),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      await exigirEvento(c, comunidadeId, eventoId)
      // Música ou etapa de outra comunidade (ou de outro encontro): 404, nunca 400.
      const musica = await c.query(
        'select 1 from uj.musicas where id = $1 and comunidade_id = $2',
        [corpo.musicaId, comunidadeId],
      )
      if (!musica.rowCount) throw NAO_ENCONTRADO()
      const etapas = (
        await c.query<{ id: string; titulo: string }>(
          'select id, titulo from uj.etapas where evento_id = $1 and comunidade_id = $2 order by ordem',
          [eventoId, comunidadeId],
        )
      ).rows
      if (corpo.etapaId && !etapas.some((e) => e.id === corpo.etapaId)) throw NAO_ENCONTRADO()
      // Sem etapa escolhida, o repertório fica na etapa do Louvor, se o encontro tiver uma.
      const etapaId = corpo.etapaId ?? etapas.find((e) => ehEtapaDeLouvor(e.titulo))?.id ?? null
      await travar(c, eventoId)
      const { rows } = await c.query<{ id: string; ordem: number; versao: number }>(
        `insert into uj.repertorio_itens (comunidade_id, evento_id, etapa_id, musica_id, ordem, tom_do_dia, nota)
         values ($1, $2, $3, $4,
                 (select coalesce(max(ordem) + 1, 0) from uj.repertorio_itens where evento_id = $2),
                 $5, $6)
         returning id, ordem, versao`,
        [
          comunidadeId,
          eventoId,
          etapaId,
          corpo.musicaId,
          corpo.tomDoDia ?? null,
          corpo.nota ?? null,
        ],
      )
      await auditar(c, pedido, 'repertorio.item_adicionado', { tipo: 'evento', id: eventoId })
      return rows[0]
    })
  })

  app.patch(`${ev}/repertorio/:repertorioItemId`, naCom, async (pedido) => {
    exigir(pedido, 'etapa', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const itemId = idDoCaminho(pedido, 'repertorioItemId')
    const corpo = validar(
      z.object({
        versao: z.number().int().min(1).optional(),
        tomDoDia: tomDoDia.nullish(),
        nota: nota.nullish(),
      }),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      const { rows } = await c.query<{ id: string; versao: number }>(
        `update uj.repertorio_itens
            set tom_do_dia = case when $4::boolean then $5 else tom_do_dia end,
                nota = case when $6::boolean then $7 else nota end
          where id = $1 and evento_id = $2 and comunidade_id = $3 and ($8::int is null or versao = $8)
          returning id, versao`,
        [
          itemId,
          eventoId,
          comunidadeId,
          corpo.tomDoDia !== undefined,
          corpo.tomDoDia ?? null,
          corpo.nota !== undefined,
          corpo.nota ?? null,
          corpo.versao ?? null,
        ],
      )
      if (!rows[0]) {
        const existe = await c.query(
          'select versao from uj.repertorio_itens where id = $1 and evento_id = $2 and comunidade_id = $3',
          [itemId, eventoId, comunidadeId],
        )
        if (existe.rows[0]) throw conflito(existe.rows[0])
        throw NAO_ENCONTRADO()
      }
      await auditar(c, pedido, 'repertorio.item_alterado', { tipo: 'evento', id: eventoId })
      return rows[0]
    })
  })

  app.delete(`${ev}/repertorio/:repertorioItemId`, naCom, async (pedido) => {
    exigir(pedido, 'etapa', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const itemId = idDoCaminho(pedido, 'repertorioItemId')
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      await travar(c, eventoId)
      const r = await c.query<{ ordem: number }>(
        `delete from uj.repertorio_itens where id = $1 and evento_id = $2 and comunidade_id = $3
         returning ordem`,
        [itemId, eventoId, comunidadeId],
      )
      if (!r.rowCount) throw NAO_ENCONTRADO()
      // Fecha o buraco na ordem.
      await c.query(
        'update uj.repertorio_itens set ordem = ordem - 1 where evento_id = $1 and ordem > $2',
        [eventoId, r.rows[0]!.ordem],
      )
      await auditar(c, pedido, 'repertorio.item_removido', { tipo: 'evento', id: eventoId })
      return { ok: true }
    })
  })

  /** Reordenar: a lista nova precisa ter exatamente os itens atuais (senão 409, como nas etapas). */
  app.put(`${ev}/repertorio/ordem`, naCom, async (pedido) => {
    exigir(pedido, 'etapa', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const { ids } = validar(z.object({ ids: z.array(z.uuid()).min(1).max(100) }), pedido.body)
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      await exigirEvento(c, comunidadeId, eventoId)
      await travar(c, eventoId)
      const atuais = (
        await c.query<{ id: string }>(
          'select id from uj.repertorio_itens where evento_id = $1 and comunidade_id = $2 for update',
          [eventoId, comunidadeId],
        )
      ).rows.map((r) => r.id)
      if (
        atuais.length !== ids.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((i) => atuais.includes(i))
      ) {
        throw conflito({ itens: atuais })
      }
      for (const [ordem, id] of ids.entries()) {
        await c.query(
          'update uj.repertorio_itens set ordem = $3 where id = $1 and evento_id = $2',
          [id, eventoId, ordem],
        )
      }
      await auditar(c, pedido, 'repertorio.reordenado', { tipo: 'evento', id: eventoId })
      return { ok: true }
    })
  })

  // ---------------------------------------------------------------- avisar a banda

  /**
   * "Avisar a banda": uma notificação genérica ("Repertório atualizado", sem
   * nome de música) às pessoas convocadas ao louvor, pela fila de 0011 (que
   * respeita a preferência "Escalas" de cada uma). Quem recusou não recebe, e
   * quem avisa não se avisa. A resposta diz a quantas pessoas o aviso saiu.
   */
  app.post(`${ev}/repertorio/avisar`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'atribuir')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      await exigirEvento(c, comunidadeId, eventoId)
      const { rows } = await c.query<{
        id: string
        vinculoId: string
        funcao: string
        etapaTitulo: string | null
        etapaComRepertorio: boolean
      }>(
        `select a.id, a.vinculo_id as "vinculoId", a.funcao, t.titulo as "etapaTitulo",
                (a.etapa_id is not null and exists (
                   select 1 from uj.repertorio_itens r
                    where r.evento_id = a.evento_id and r.etapa_id = a.etapa_id)) as "etapaComRepertorio"
           from uj.atribuicoes a left join uj.etapas t on t.id = a.etapa_id
          where a.evento_id = $1 and a.comunidade_id = $2 and a.estado <> 'recusada'`,
        [eventoId, comunidadeId],
      )
      const daBanda = rows.filter((a) => ehConvocacaoDeLouvor(a))
      const convocadas = new Set(daBanda.map((a) => a.vinculoId)).size
      if (daBanda.length === 0) return { convocadas: 0, avisadas: 0 }
      const { rows: r } = await c.query<{ n: number }>(
        'select uj.avisar_banda($1, $2::uuid[]) as n',
        [eventoId, daBanda.map((a) => a.id)],
      )
      const avisadas = r[0]!.n
      await auditar(
        c,
        pedido,
        'repertorio.banda_avisada',
        { tipo: 'evento', id: eventoId },
        {
          convocadas,
          avisadas,
        },
      )
      return { convocadas, avisadas }
    })
  })

  // ---------------------------------------------------------------- meu repertório

  /**
   * Os próximos encontros publicados em que a pessoa tem convocação de louvor
   * (aceita, pendente ou com troca pedida; recusada não conta), com o
   * repertório na ordem, o tom do dia e a cifra. Quem não foi convocado ao
   * louvor recebe a lista vazia. A cifra vai inteira para a pessoa transpor e
   * ler no aparelho: a transposição usa a mesma função de `@uj/dominio`.
   */
  app.get(`${base}/meu-repertorio`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'ler')
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      const minhas = (
        await c.query<{
          atribuicaoId: string
          funcao: string
          estado: string
          etapaTitulo: string | null
          etapaComRepertorio: boolean
          eventoId: string
          eventoTitulo: string
          inicio: Date
          fuso: string
        }>(
          `select a.id as "atribuicaoId", a.funcao, a.estado, t.titulo as "etapaTitulo",
                  (a.etapa_id is not null and exists (
                     select 1 from uj.repertorio_itens r
                      where r.evento_id = a.evento_id and r.etapa_id = a.etapa_id)) as "etapaComRepertorio",
                  e.id as "eventoId", e.titulo as "eventoTitulo", e.inicio, e.fuso
             from uj.atribuicoes a
             join uj.eventos e on e.id = a.evento_id
             left join uj.etapas t on t.id = a.etapa_id
            where a.comunidade_id = $1
              and a.vinculo_id = (select uj.vinculo_da_conta_no_contexto())
              and a.estado <> 'recusada'
              and e.status = 'publicado'
              and e.inicio + make_interval(mins => e.duracao_min) > now()
            order by e.inicio, a.criado_em
            limit 60`,
          [comunidadeId],
        )
      ).rows.filter((a) => ehConvocacaoDeLouvor(a))

      const porEvento = new Map<string, typeof minhas>()
      for (const a of minhas) porEvento.set(a.eventoId, [...(porEvento.get(a.eventoId) ?? []), a])
      const eventos = [...porEvento.entries()].slice(0, 3)
      if (eventos.length === 0) return { encontros: [] }

      const itens = (
        await c.query<{ eventoId: string }>(
          `select r.evento_id as "eventoId", r.id, r.ordem, r.musica_id as "musicaId",
                  r.tom_do_dia as "tomDoDia", r.nota,
                  m.titulo, m.artista, m.tom as "tomOriginal", m.andamento_bpm as "andamentoBpm",
                  m.duracao_seg as "duracaoSeg", m.link, m.cifra
             from uj.repertorio_itens r join uj.musicas m on m.id = r.musica_id
            where r.comunidade_id = $1 and r.evento_id = any ($2::uuid[])
            order by r.evento_id, r.ordem`,
          [comunidadeId, eventos.map(([id]) => id)],
        )
      ).rows

      return {
        encontros: eventos.map(([eventoId, convocacoes]) => {
          const primeira = convocacoes[0]!
          return {
            evento: {
              id: eventoId,
              titulo: primeira.eventoTitulo,
              inicio: primeira.inicio,
              fuso: primeira.fuso,
            },
            convocacoes: convocacoes.map((a) => ({
              atribuicaoId: a.atribuicaoId,
              funcao: a.funcao,
              estado: a.estado,
            })),
            itens: itens
              .filter((i) => i.eventoId === eventoId)
              .map(({ eventoId: _evento, ...resto }) => resto),
          }
        }),
      }
    })
  })
}
