import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { emTransacao } from '../banco/contexto.ts'
import { NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import {
  bytesDoBase64,
  LIMITE_DO_CORPO,
  processarImagem,
  versaoDoHash,
  type ImagemProcessada,
} from '../imagens/processar.ts'
import {
  auditar,
  ESCRITAS_POR_HORA,
  exigir,
  idDoCaminho,
  limiteDeEscrita,
  naComunidade,
} from './contexto.ts'

/**
 * Foto de perfil e logotipo da comunidade (D33, migração 0018).
 *
 * ENVIO: `PUT` com JSON `{ "imagem": "<base64>" }` (aceita também o prefixo
 * `data:image/...;base64,`). É o formato que o cliente do app já usa em todo
 * pedido (`api.put(caminho, corpo)`), e o `expo-image-picker` e o
 * `expo-image-manipulator` devolvem a imagem em base64 sem arquivo temporário.
 * O acréscimo de um terço do base64 não pesa numa imagem já reduzida pelo app.
 *
 * LEITURA: os bytes da imagem regravada (`image/webp`), com `ETag` (SHA-256),
 * `Cache-Control: private, no-cache` e 304 para `If-None-Match` igual. O
 * `no-cache` faz o aparelho revalidar a cada uso, então quem perdeu o vínculo
 * deixa de receber a foto na próxima vez (404), e o 304 mantém isso barato.
 *
 * Sessão, comunidade, papel e cota são conferidos no `onRequest`, ANTES de o
 * corpo de até 3 MB ser lido: quem não pode enviar não chega a ocupar a API.
 */

interface LinhaDeImagem {
  tipo: string
  hash: string
  /** `null` quando o ETag que o aparelho mandou já é o atual (304). */
  conteudo: Buffer | null
}

const corpoDaImagem = z.object({
  imagem: z.string({ error: 'Envie a imagem.' }).min(1, 'Envie a imagem.'),
})

const ETAG_FORTE = /^"([0-9a-f]{64})"$/

/** ETags do `If-None-Match` (forma fraca aceita, como manda a RFC 9110 para GET). */
function etagsConhecidas(pedido: FastifyRequest): string[] {
  const cabecalho = pedido.headers['if-none-match']
  if (!cabecalho) return []
  const conhecidas: string[] = []
  for (const parte of cabecalho.split(',')) {
    const valor = parte.trim().replace(/^W\//, '')
    if (valor === '*') conhecidas.push('*')
    const m = ETAG_FORTE.exec(valor)
    if (m) conhecidas.push(m[1]!)
    if (conhecidas.length >= 16) break
  }
  return conhecidas
}

/** Expressão SQL do conteúdo: nulo quando o aparelho já tem a versão atual. */
const CONTEUDO_SE_MUDOU = `case when encode(hash, 'hex') = any ($2::text[]) or '*' = any ($2::text[])
            then null else conteudo end as conteudo`

function responderImagem(resposta: FastifyReply, linha: LinhaDeImagem) {
  resposta.header('ETag', `"${linha.hash}"`).header('Cache-Control', 'private, no-cache')
  if (linha.conteudo === null) return resposta.code(304).send()
  return resposta.header('Content-Type', linha.tipo).send(linha.conteudo)
}

function resumo(imagem: ImagemProcessada) {
  return {
    versao: versaoDoHash(imagem.hash.toString('hex')),
    tipo: imagem.tipo,
    largura: imagem.largura,
    altura: imagem.altura,
    bytes: imagem.conteudo.length,
  }
}

export function registrarRotasDeImagens(app: FastifyInstance, api: pg.Pool): void {
  // ================================================================ foto da própria conta

  const naConta = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    emTransacao(
      api,
      { contaId: pedido.sessao!.contaId, comunidadeId: null, prova: pedido.sessao!.prova },
      trabalho,
    )
  // Uma cota para trocar e remover: as duas gravam e auditam.
  const limiteDaFoto = limiteDeEscrita(ESCRITAS_POR_HORA.imagens)

  app.put(
    '/api/v1/eu/foto',
    { bodyLimit: LIMITE_DO_CORPO, onRequest: [app.exigirSessao, limiteDaFoto] },
    async (pedido) => {
      const { imagem } = validar(corpoDaImagem, pedido.body)
      const foto = await processarImagem(bytesDoBase64(imagem))
      const contaId = pedido.sessao!.contaId
      await naConta(pedido, async (c) => {
        try {
          await c.query(
            `insert into uj.fotos_contas (conta_id, conteudo, tipo, hash) values ($1, $2, $3, $4)
             on conflict (conta_id) do update
               set conteudo = excluded.conteudo, tipo = excluded.tipo, hash = excluded.hash`,
            [contaId, foto.conteudo, foto.tipo, foto.hash],
          )
        } catch (e) {
          traduzirErroDoBanco(e)
        }
        // Sem conteúdo nem hash: só o fato.
        await auditar(
          c,
          pedido,
          'conta.foto_alterada',
          { tipo: 'conta', id: contaId },
          { removida: false },
        )
      })
      const r = resumo(foto)
      return { temFoto: true, fotoVersao: r.versao, ...r }
    },
  )

  app.delete('/api/v1/eu/foto', { onRequest: [app.exigirSessao, limiteDaFoto] }, async (pedido) => {
    const contaId = pedido.sessao!.contaId
    await naConta(pedido, async (c) => {
      const r = await c.query('delete from uj.fotos_contas where conta_id = $1', [contaId])
      if (r.rowCount) {
        await auditar(
          c,
          pedido,
          'conta.foto_alterada',
          { tipo: 'conta', id: contaId },
          { removida: true },
        )
      }
    })
    // Idempotente: sem foto, o resultado é o mesmo.
    return { temFoto: false, fotoVersao: null }
  })

  app.get('/api/v1/eu/foto', { preHandler: app.exigirSessao }, async (pedido, resposta) => {
    const linha = await naConta(
      pedido,
      async (c) =>
        (
          await c.query<LinhaDeImagem>(
            `select tipo, encode(hash, 'hex') as hash, ${CONTEUDO_SE_MUDOU}
               from uj.fotos_contas where conta_id = $1`,
            [pedido.sessao!.contaId, etagsConhecidas(pedido)],
          )
        ).rows[0],
    )
    if (!linha) throw NAO_ENCONTRADO()
    return responderImagem(resposta, linha)
  })

  // ================================================================ foto de outra pessoa

  // Só de vínculo ATIVO da comunidade do caminho, para quem tem vínculo ativo
  // nela (o banco confere tudo em uj.foto_da_pessoa). Qualquer outro caso: 404.
  app.get(
    '/api/v1/c/:comunidadeId/pessoas/:vinculoId/foto',
    { preHandler: app.comComunidade },
    async (pedido, resposta) => {
      exigir(pedido, 'vinculo', 'listar')
      const vinculoId = idDoCaminho(pedido, 'vinculoId')
      const linha = await naComunidade(
        api,
        pedido,
        async (c) =>
          (
            await c.query<LinhaDeImagem>(
              `select tipo, encode(hash, 'hex') as hash, conteudo
                 from uj.foto_da_pessoa($1, $2)`,
              [vinculoId, etagsConhecidas(pedido)],
            )
          ).rows[0],
      )
      if (!linha) throw NAO_ENCONTRADO()
      return responderImagem(resposta, linha)
    },
  )

  // ================================================================ logotipo da comunidade

  const exigirTrocarLogo = async (pedido: FastifyRequest) =>
    exigir(pedido, 'comunidade', 'trocar_logo')
  const limiteDoLogo = limiteDeEscrita(ESCRITAS_POR_HORA.imagens)
  const paraTrocarLogo = [app.comComunidade, exigirTrocarLogo, limiteDoLogo]

  app.put(
    '/api/v1/c/:comunidadeId/logo',
    { bodyLimit: LIMITE_DO_CORPO, onRequest: paraTrocarLogo },
    async (pedido) => {
      const { imagem } = validar(corpoDaImagem, pedido.body)
      const logo = await processarImagem(bytesDoBase64(imagem))
      const comunidadeId = pedido.comunidade!.id
      await naComunidade(api, pedido, async (c) => {
        try {
          await c.query(
            `insert into uj.logos_comunidades (comunidade_id, conteudo, tipo, hash)
             values ($1, $2, $3, $4)
             on conflict (comunidade_id) do update
               set conteudo = excluded.conteudo, tipo = excluded.tipo, hash = excluded.hash`,
            [comunidadeId, logo.conteudo, logo.tipo, logo.hash],
          )
        } catch (e) {
          traduzirErroDoBanco(e)
        }
        await auditar(
          c,
          pedido,
          'comunidade.logo_alterado',
          { tipo: 'comunidade', id: comunidadeId },
          { removido: false },
        )
      })
      const r = resumo(logo)
      return { temLogo: true, logoVersao: r.versao, ...r }
    },
  )

  app.delete('/api/v1/c/:comunidadeId/logo', { onRequest: paraTrocarLogo }, async (pedido) => {
    const comunidadeId = pedido.comunidade!.id
    await naComunidade(api, pedido, async (c) => {
      let removidas = 0
      try {
        removidas =
          (
            await c.query('delete from uj.logos_comunidades where comunidade_id = $1', [
              comunidadeId,
            ])
          ).rowCount ?? 0
      } catch (e) {
        traduzirErroDoBanco(e)
      }
      if (removidas > 0) {
        await auditar(
          c,
          pedido,
          'comunidade.logo_alterado',
          { tipo: 'comunidade', id: comunidadeId },
          { removido: true },
        )
      }
    })
    return { temLogo: false, logoVersao: null }
  })

  // Logotipo de uma comunidade que aparece na busca (ADR 0007): qualquer conta
  // autenticada, só enquanto a comunidade estiver ativa e encontrável.
  app.get(
    '/api/v1/comunidades/:idPublico/logo',
    { preHandler: app.exigirSessao },
    async (pedido, resposta) => {
      const idPublico = (pedido.params as { idPublico?: string }).idPublico ?? ''
      if (!/^[0-9a-f]{32}$/.test(idPublico)) throw NAO_ENCONTRADO()
      const linha = await emTransacao(
        api,
        { contaId: pedido.sessao!.contaId, comunidadeId: null },
        async (c) =>
          (
            await c.query<LinhaDeImagem>(
              `select tipo, encode(hash, 'hex') as hash, conteudo
                 from uj.logo_da_comunidade_encontravel($1, $2)`,
              [idPublico, etagsConhecidas(pedido)],
            )
          ).rows[0],
      )
      if (!linha) throw NAO_ENCONTRADO()
      return responderImagem(resposta, linha)
    },
  )

  app.get(
    '/api/v1/c/:comunidadeId/logo',
    { preHandler: app.comComunidade },
    async (pedido, resposta) => {
      exigir(pedido, 'comunidade', 'ler')
      const linha = await naComunidade(
        api,
        pedido,
        async (c) =>
          (
            await c.query<LinhaDeImagem>(
              `select tipo, encode(hash, 'hex') as hash, ${CONTEUDO_SE_MUDOU}
                 from uj.logos_comunidades where comunidade_id = $1`,
              [pedido.comunidade!.id, etagsConhecidas(pedido)],
            )
          ).rows[0],
      )
      if (!linha) throw NAO_ENCONTRADO()
      return responderImagem(resposta, linha)
    },
  )
}
