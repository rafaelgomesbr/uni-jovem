import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import {
  auditar,
  comLimiteDeEscrita,
  ESCRITAS_POR_HORA,
  exigir,
  idDoCaminho,
  naComunidade,
} from './contexto.ts'

/**
 * Bloqueio individual (Apple 1.2, D35).
 *
 * - Por comunidade: o bloqueio nasce de algo que a pessoa vê NESTA comunidade
 *   (pedido de oração, sugestão, aviso ou a pessoa na lista) e só vale aqui.
 * - Esconde, só para quem bloqueou, os pedidos de oração e as sugestões não
 *   anônimos da outra pessoa (a RLS e `uj.sugestoes_visiveis` filtram; D55). Avisos e
 *   programação continuam: são informação da comunidade (D36).
 * - Quem foi bloqueado não fica sabendo: nada muda para ela, a lista só mostra
 *   os bloqueios de quem pergunta, e a auditoria vai sem comunidade (a
 *   administração, que pode ser a pessoa bloqueada, não a lê). Papel não muda.
 */

const ORIGENS = ['pedido_oracao', 'sugestao', 'aviso'] as const

const pedidoDeBloqueio = z.union([
  z.strictObject({ recursoTipo: z.enum(ORIGENS), recursoId: z.uuid() }),
  z.strictObject({ vinculoId: z.uuid() }),
])

/** O que o app mostra depois de bloquear (sem nome: quem bloqueou já sabe quem é). */
export const MENSAGEM_DO_BLOQUEIO =
  'Pronto. Você não vai mais ver os pedidos de oração e as sugestões desta pessoa nesta comunidade. Ela não é avisada.'

interface LinhaDoBloqueio {
  id: string
  vinculoId: string | null
  nome: string
  avatarIcone: string | null
  avatarCor: string | null
  fotoVersao: string | null
  bloqueadoEm: Date
}

export function registrarRotasDeBloqueios(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const escrita = comLimiteDeEscrita(app, ESCRITAS_POR_HORA.bloqueios)
  const base = '/api/v1/c/:comunidadeId/bloqueios'
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })

  app.post(base, escrita, async (pedido) => {
    exigir(pedido, 'bloqueio', 'criar')
    const corpo = validar(pedidoDeBloqueio, pedido.body)
    const [tipo, recurso] =
      'vinculoId' in corpo
        ? (['vinculo', corpo.vinculoId] as const)
        : ([corpo.recursoTipo, corpo.recursoId] as const)
    return tx(pedido, async (c) => {
      let r: { id: string; novo: boolean }
      try {
        r = (
          await c.query<{ id: string; novo: boolean }>('select * from uj.bloquear($1, $2)', [
            tipo,
            recurso,
          ])
        ).rows[0]!
      } catch (e) {
        throw erroDoBloqueio(e, tipo)
      }
      if (r.novo) {
        // Sem comunidade de propósito: a administração lê a auditoria da comunidade.
        await auditar(
          c,
          pedido,
          'bloqueio.criado',
          { tipo: 'bloqueio', id: r.id },
          { origem: tipo },
          null,
        )
      }
      return { id: r.id, mensagem: MENSAGEM_DO_BLOQUEIO }
    })
  })

  app.get(base, naCom, async (pedido) => {
    exigir(pedido, 'bloqueio', 'ler_proprios', { proprio: true })
    return tx(pedido, async (c) => {
      const { rows } = await c.query<LinhaDoBloqueio>(
        `select id, vinculo_id as "vinculoId", nome, avatar_icone as "avatarIcone",
                avatar_cor as "avatarCor", foto_versao as "fotoVersao", criado_em as "bloqueadoEm"
           from uj.meus_bloqueios()`,
      )
      return {
        bloqueios: rows.map((r) => ({
          id: r.id,
          vinculoId: r.vinculoId,
          nome: r.nome,
          avatar: r.avatarIcone ? { icone: r.avatarIcone, cor: r.avatarCor } : null,
          fotoVersao: r.fotoVersao,
          bloqueadoEm: r.bloqueadoEm,
        })),
      }
    })
  })

  app.delete(`${base}/:bloqueioId`, escrita, async (pedido) => {
    exigir(pedido, 'bloqueio', 'desfazer', { proprio: true })
    const bloqueioId = idDoCaminho(pedido, 'bloqueioId')
    return tx(pedido, async (c) => {
      // A RLS só deixa ver e apagar os próprios bloqueios desta comunidade.
      const r = await c.query('delete from uj.bloqueios where id = $1 and comunidade_id = $2', [
        bloqueioId,
        pedido.comunidade!.id,
      ])
      if (!r.rowCount) throw NAO_ENCONTRADO()
      await auditar(c, pedido, 'bloqueio.desfeito', { tipo: 'bloqueio', id: bloqueioId }, {}, null)
      return { ok: true }
    })
  })
}

function erroDoBloqueio(e: unknown, tipo: string): Error {
  switch ((e as { code?: string }).code) {
    case 'UJ080':
      return NAO_ENCONTRADO()
    case 'UJ081':
      return new ErroHttp(
        'autoria_anonima',
        422,
        `${tipo === 'pedido_oracao' ? 'Este pedido é anônimo' : 'Esta sugestão é anônima'}: não dá para saber quem escreveu, então não dá para bloquear. Se houver um problema, use "Denunciar".`,
      )
    case 'UJ082':
      return new ErroHttp(
        'bloquear_a_si',
        422,
        'Este conteúdo é seu. Não dá para bloquear você mesmo.',
      )
    case 'UJ083':
      return new ErroHttp(
        'pessoa_removida',
        422,
        'Quem escreveu isto não participa mais da comunidade. Não há quem bloquear.',
      )
    default:
      try {
        traduzirErroDoBanco(e)
      } catch (traduzido) {
        return traduzido as Error
      }
  }
}
