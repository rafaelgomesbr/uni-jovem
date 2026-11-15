import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { notificar } from '../notificacoes/ganchos.ts'
import {
  auditar,
  exigir,
  idDoCaminho,
  naComunidade,
  comLimiteDeEscrita,
  ESCRITAS_POR_HORA,
} from './contexto.ts'

/**
 * Avisos (F15). Organizador para cima publica, edita, fixa e despublica;
 * membros leem os publicados (a RLS esconde rascunho, despublicado e vencido).
 * Publicar dispara o gancho `aviso_publicado` (F14), depois da transação.
 */

const dataHora = z.iso.datetime({ offset: true, message: 'Data e hora inválidas.' })

const CAMPOS = `a.id, a.titulo, a.texto, a.estado, a.fixado, a.publicado_em as "publicadoEm",
  a.visivel_ate as "visivelAte", a.criado_em as "criadoEm", a.atualizado_em as "atualizadoEm",
  a.versao, p.nome as "autorNome"`

const DE = `from uj.avisos a
  left join (select conta_id, nome from uj.pessoas_da_comunidade()) p on p.conta_id = a.criado_por`

function conflito(atual: unknown): ErroHttp & { atual?: unknown } {
  const e = new ErroHttp(
    'conflito',
    409,
    'Outra pessoa alterou este aviso enquanto você editava. Confira a versão atual antes de salvar.',
  ) as ErroHttp & { atual?: unknown }
  e.atual = atual
  return e
}

export function registrarRotasDeAvisos(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const escrita = comLimiteDeEscrita(app, ESCRITAS_POR_HORA.avisos)
  const base = '/api/v1/c/:comunidadeId/avisos'
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })

  const anunciar = (pedido: FastifyRequest, avisoId: string) =>
    notificar('aviso_publicado', {
      comunidadeId: pedido.comunidade!.id,
      avisoId,
      contaId: pedido.sessao!.contaId,
    })

  app.get(base, naCom, async (pedido) => {
    exigir(pedido, 'aviso', 'ler')
    const q = validar(
      z.object({ estado: z.enum(['rascunho', 'publicado', 'despublicado']).optional() }),
      pedido.query,
    )
    return tx(pedido, async (c) => ({
      avisos: (
        await c.query(
          `select ${CAMPOS} ${DE}
            where a.comunidade_id = $1 and ($2::text is null or a.estado = $2)
            order by a.estado = 'publicado' desc, a.fixado desc,
                     coalesce(a.publicado_em, a.criado_em) desc
            limit 200`,
          [pedido.comunidade!.id, q.estado ?? null],
        )
      ).rows,
    }))
  })

  app.post(base, escrita, async (pedido) => {
    exigir(pedido, 'aviso', 'publicar')
    const a = validar(
      z.object({
        titulo: z.string().trim().min(2, 'Dê um título ao aviso.').max(120),
        texto: z.string().trim().min(1, 'Escreva o aviso.').max(5000),
        publicar: z.boolean().default(false),
        fixado: z.boolean().default(false),
        visivelAte: dataHora.nullish(),
      }),
      pedido.body,
    )
    const criado = await tx(pedido, async (c) => {
      const { rows } = await c.query<{ id: string; estado: string; versao: number }>(
        `insert into uj.avisos (comunidade_id, titulo, texto, estado, fixado, visivel_ate)
         values ($1, $2, $3, $4, $5, $6) returning id, estado, fixado, publicado_em as "publicadoEm", versao`,
        [
          pedido.comunidade!.id,
          a.titulo,
          a.texto,
          a.publicar ? 'publicado' : 'rascunho',
          a.fixado,
          a.visivelAte ?? null,
        ],
      )
      await auditar(
        c,
        pedido,
        'aviso.criado',
        { tipo: 'aviso', id: rows[0]!.id },
        { estado: rows[0]!.estado },
      )
      return rows[0]!
    })
    if (criado.estado === 'publicado') anunciar(pedido, criado.id)
    return criado
  })

  app.get(`${base}/:avisoId`, naCom, async (pedido) => {
    exigir(pedido, 'aviso', 'ler')
    const avisoId = idDoCaminho(pedido, 'avisoId')
    return tx(pedido, async (c) => {
      const { rows } = await c.query(
        `select ${CAMPOS} ${DE} where a.id = $1 and a.comunidade_id = $2`,
        [avisoId, pedido.comunidade!.id],
      )
      if (!rows[0]) throw NAO_ENCONTRADO()
      return rows[0]
    })
  })

  /** Editar texto, validade ou fixação. Fixar só vale para aviso publicado. */
  app.patch(`${base}/:avisoId`, escrita, async (pedido) => {
    exigir(pedido, 'aviso', 'publicar')
    const avisoId = idDoCaminho(pedido, 'avisoId')
    const m = validar(
      z.object({
        versao: z.number().int().min(1),
        titulo: z.string().trim().min(2).max(120).optional(),
        texto: z.string().trim().min(1).max(5000).optional(),
        fixado: z.boolean().optional(),
        visivelAte: dataHora.nullish(),
      }),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      const atual = (
        await c.query<{ estado: string; versao: number }>(
          'select estado, versao from uj.avisos where id = $1 and comunidade_id = $2',
          [avisoId, pedido.comunidade!.id],
        )
      ).rows[0]
      if (!atual) throw NAO_ENCONTRADO()
      if (atual.versao !== m.versao) throw conflito({ versao: atual.versao })
      if (m.fixado === true && atual.estado !== 'publicado') {
        throw new ErroHttp('nao_publicado', 409, 'Publique o aviso antes de fixá-lo.')
      }
      const { rows } = await c.query(
        `update uj.avisos
            set titulo = coalesce($3, titulo), texto = coalesce($4, texto),
                fixado = coalesce($5, fixado),
                visivel_ate = case when $6::boolean then $7::timestamptz else visivel_ate end
          where id = $1 and comunidade_id = $2 and versao = $8
          returning id, estado, fixado, versao`,
        [
          avisoId,
          pedido.comunidade!.id,
          m.titulo ?? null,
          m.texto ?? null,
          m.fixado ?? null,
          m.visivelAte !== undefined,
          m.visivelAte ?? null,
          m.versao,
        ],
      )
      if (!rows[0]) throw conflito({ versao: atual.versao })
      await auditar(
        c,
        pedido,
        'aviso.editado',
        { tipo: 'aviso', id: avisoId },
        { campos: Object.keys(m).filter((k) => k !== 'versao') },
      )
      return rows[0]
    })
  })

  for (const [acao, estado] of [
    ['publicar', 'publicado'],
    ['despublicar', 'despublicado'],
  ] as const) {
    app.post(`${base}/:avisoId/${acao}`, escrita, async (pedido) => {
      exigir(pedido, 'aviso', 'publicar')
      const avisoId = idDoCaminho(pedido, 'avisoId')
      const resultado = await tx(pedido, async (c) => {
        const atual = (
          await c.query<{ estado: string }>(
            'select estado from uj.avisos where id = $1 and comunidade_id = $2',
            [avisoId, pedido.comunidade!.id],
          )
        ).rows[0]
        if (!atual) throw NAO_ENCONTRADO()
        if (estado === 'despublicado' && atual.estado !== 'publicado') {
          throw new ErroHttp('nao_publicado', 409, 'Este aviso não está publicado.')
        }
        const mudou = atual.estado !== estado
        const { rows } = await c.query(
          `update uj.avisos set estado = $3 where id = $1 and comunidade_id = $2
           returning id, estado, fixado, publicado_em as "publicadoEm", versao`,
          [avisoId, pedido.comunidade!.id, estado],
        )
        if (mudou) {
          await auditar(c, pedido, `aviso.${estado}`, { tipo: 'aviso', id: avisoId })
        }
        return { aviso: rows[0] as Record<string, unknown>, mudou }
      })
      if (estado === 'publicado' && resultado.mudou) anunciar(pedido, avisoId)
      return resultado.aviso
    })
  }

  app.delete(`${base}/:avisoId`, escrita, async (pedido) => {
    exigir(pedido, 'aviso', 'publicar')
    const avisoId = idDoCaminho(pedido, 'avisoId')
    return tx(pedido, async (c) => {
      const r = await c.query('delete from uj.avisos where id = $1 and comunidade_id = $2', [
        avisoId,
        pedido.comunidade!.id,
      ])
      if (!r.rowCount) throw NAO_ENCONTRADO()
      await auditar(c, pedido, 'aviso.excluido', { tipo: 'aviso', id: avisoId })
      return { ok: true }
    })
  })
}
