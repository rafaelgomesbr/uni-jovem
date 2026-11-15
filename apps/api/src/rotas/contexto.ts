import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { doisFatoresRecente } from '../autenticacao/jwt.ts'
import { Limitador, truncarIp } from '../autenticacao/limitador.ts'
import { emTransacao } from '../banco/contexto.ts'
import {
  ehPapel,
  permite,
  type Acao,
  type Ator,
  type Designacao,
  type Papel,
  type Recurso,
} from '@uj/dominio'
import { ErroHttp, NAO_ENCONTRADO, SEM_PERMISSAO } from '../http.ts'

/**
 * Contexto de comunidade de um pedido. A comunidade sai do CAMINHO da rota e só
 * vale se a conta autenticada tiver vínculo ativo nela, conferido no banco.
 * Sem vínculo, a resposta é 404 (não 403): não se confirma que a comunidade existe.
 */
export interface ComunidadeDoPedido {
  id: string
  papel: Papel
  designacoes: Designacao[]
  estado: 'ativa' | 'suspensa'
}

declare module 'fastify' {
  interface FastifyRequest {
    comunidade: ComunidadeDoPedido | null
  }
}

const uuid = z.uuid()

export function idDoCaminho(pedido: FastifyRequest, nome: string): string {
  const valor = (pedido.params as Record<string, string | undefined>)[nome]
  const r = uuid.safeParse(valor)
  if (!r.success) throw NAO_ENCONTRADO()
  return r.data
}

const NIVEL_PARA_PAPEL: Record<number, Papel> = { 30: 'admin', 20: 'organizador', 10: 'membro' }

export function registrarContextoDeComunidade(app: FastifyInstance, api: pg.Pool): void {
  app.decorateRequest('comunidade', null)

  app.decorate('comComunidade', async (pedido: FastifyRequest) => {
    await app.exigirSessao(pedido)
    const comunidadeId = idDoCaminho(pedido, 'comunidadeId')
    const sessao = pedido.sessao!
    const linha = await emTransacao(
      api,
      { contaId: sessao.contaId, comunidadeId, prova: sessao.prova },
      async (c) =>
        (
          await c.query<{ nivel: number; designacoes: string[]; estado: string | null }>(
            `select uj.nivel_no_contexto() as nivel, uj.designacoes_no_contexto() as designacoes,
                    (select estado from uj.comunidades where id = $1) as estado`,
            [comunidadeId],
          )
        ).rows[0],
    )
    const papel = linha ? NIVEL_PARA_PAPEL[linha.nivel] : undefined
    if (!linha || !papel || (linha.estado !== 'ativa' && linha.estado !== 'suspensa')) {
      throw NAO_ENCONTRADO()
    }
    pedido.comunidade = {
      id: comunidadeId,
      papel,
      designacoes: linha.designacoes.filter((d): d is Designacao => d === 'equipe_oracao'),
      estado: linha.estado,
    }
  })
}

declare module 'fastify' {
  interface FastifyInstance {
    comComunidade: (pedido: FastifyRequest) => Promise<void>
  }
}

/** O ator da matriz de permissões, a partir do pedido já com comunidade. */
export function atorDoPedido(pedido: FastifyRequest): Ator {
  const c = pedido.comunidade
  return {
    papel: c && ehPapel(c.papel) ? c.papel : null,
    designacoes: c?.designacoes ?? [],
    proprietarioComDoisFatores: pedido.sessao !== null && criadorComProva(pedido),
  }
}

export function exigir<R extends Recurso>(
  pedido: FastifyRequest,
  recurso: R,
  acao: Acao<R>,
  alvo?: { proprio: boolean },
): void {
  if (!permite(atorDoPedido(pedido), recurso, acao, alvo)) throw SEM_PERMISSAO()
  // Escrita em comunidade suspensa: o banco recusa; aqui a mensagem é clara.
  if (pedido.comunidade?.estado === 'suspensa' && !acaoDeLeitura(acao)) {
    throw new ErroHttp(
      'comunidade_suspensa',
      409,
      'Esta comunidade está suspensa: dá para consultar, mas não alterar.',
    )
  }
}

function acaoDeLeitura(acao: string): boolean {
  return acao === 'ler' || acao.startsWith('ler_') || acao === 'listar' || acao === 'acompanhar'
}

function criadorComProva(pedido: FastifyRequest): boolean {
  const s = pedido.sessao
  return s !== null && s.prova !== null && doisFatoresRecente(s)
}

/** Ações de plataforma: o token precisa trazer prova de 2FA recente. */
export function exigirCriador(pedido: FastifyRequest): void {
  if (!criadorComProva(pedido)) {
    throw new ErroHttp(
      'segundo_fator_necessario',
      403,
      'Confirme o código do seu autenticador para continuar.',
    )
  }
}

/** Transação com o contexto do pedido (conta, comunidade do caminho, prova). */
export function naComunidade<T>(
  api: pg.Pool,
  pedido: FastifyRequest,
  trabalho: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const s = pedido.sessao!
  return emTransacao(
    api,
    { contaId: s.contaId, comunidadeId: pedido.comunidade?.id ?? null, prova: s.prova },
    trabalho,
  )
}

export async function auditar(
  c: pg.PoolClient,
  pedido: FastifyRequest,
  acao: string,
  recurso: { tipo?: string; id?: string } = {},
  detalhes: Record<string, unknown> = {},
  comunidadeId: string | null = pedido.comunidade?.id ?? null,
): Promise<void> {
  await c.query(
    `insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes, ip_truncado)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      pedido.sessao!.contaId,
      comunidadeId,
      acao,
      recurso.tipo ?? null,
      recurso.id ?? null,
      JSON.stringify(detalhes),
      // IP truncado (/24, /48): o mapa de dados promete parte do endereço, nunca ele inteiro.
      pedido.ip ? truncarIp(pedido.ip) : null,
    ],
  )
}

/**
 * Escritas por conta e por hora, por módulo (B6 da revisão de segurança): um
 * aparelho ou script com sessão válida não enche a comunidade de sugestões,
 * pedidos, avisos ou operações offline. Em memória, por processo (o servidor
 * roda uma instância; ver docs/RISCOS.md).
 */
export const ESCRITAS_POR_HORA = {
  sugestoes: 30,
  oracao: 60,
  avisos: 60,
  sincronizacao: 120,
  // Foto de perfil e logotipo: cada envio decodifica e regrava uma imagem.
  imagens: 20,
} as const

/**
 * Gancho do limite de escrita por conta (depois da sessão). Cada chamada tem a
 * sua própria contagem: um módulo não gasta a cota de outro.
 */
export function limiteDeEscrita(maximoPorHora: number) {
  const limitador = new Limitador(maximoPorHora, 60 * 60_000)
  return async (pedido: FastifyRequest, resposta: FastifyReply) => {
    const chave = pedido.sessao!.contaId
    if (limitador.tentar(chave)) return
    resposta.header('Retry-After', String(limitador.segundosParaLiberar(chave)))
    throw new ErroHttp(
      'muitas_escritas',
      429,
      'Muitas alterações seguidas. Espere alguns minutos e tente de novo.',
    )
  }
}

/** Opções de rota: contexto de comunidade e, depois dele, o limite de escrita. */
export function comLimiteDeEscrita(app: FastifyInstance, maximoPorHora: number) {
  return { preHandler: [app.comComunidade, limiteDeEscrita(maximoPorHora)] }
}
