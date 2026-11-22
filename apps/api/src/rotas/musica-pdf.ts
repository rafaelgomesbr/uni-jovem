import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { auditar, exigir, idDoCaminho, limiteDeEscrita, naComunidade } from './contexto.ts'

/**
 * PDF anexado à música (D76, migração 0029): a cifra ou a partitura que o músico já tem em
 * arquivo, ao lado da cifra em texto (D61), que continua existindo.
 *
 * ENVIO: `PUT .../conteudos/musicas/:musicaId/pdf?nome=<arquivo.pdf>&direitosConfirmados=true`
 * com o PDF como corpo BRUTO (`Content-Type: application/pdf`). Sem multipart e sem dependência
 * nova: o `fetch` do app, do navegador e do Node mandam um `Blob` ou `Uint8Array` direto.
 *
 * O servidor NÃO executa nem interpreta o PDF: confere a assinatura `%PDF-` nos primeiros bytes,
 * o tamanho real do corpo (teto de 10 MB, o mesmo CHECK do banco) e grava os bytes como vieram.
 * O arquivo só é entregue de volta com `Content-Disposition: attachment` e `nosniff`, então nem um
 * navegador que abrisse o endereço direto o interpretaria como página.
 *
 * DIREITOS AUTORAIS: gravar ou trocar o PDF exige a mesma confirmação da cifra em texto
 * (`direitosConfirmados=true`, 400 `direitos_nao_confirmados` sem ela). O gatilho do banco
 * (UJ100) é a segunda camada.
 *
 * LEITURA: quem lê a música (toda a comunidade, D73). `ETag` é o SHA-256 do arquivo,
 * `Cache-Control: private, no-cache` (o aparelho revalida a cada uso, então quem perdeu o vínculo
 * deixa de receber o arquivo, e o 304 mantém isso barato).
 *
 * LOG: a auditoria leva só o id da música; nome do arquivo e conteúdo nunca vão para log, para
 * auditoria nem para o log de mudanças. O nome, o único dado "de texto" do arquivo, só volta na
 * resposta da própria comunidade.
 */

/** 10 MB: o mesmo teto do CHECK de `uj.musica_pdfs`. */
export const LIMITE_DO_PDF = 10 * 1024 * 1024
const ESCRITAS_DE_PDF_POR_HORA = 30

/** `true` quando a música tem PDF. `id` é a expressão SQL do id da música. */
export const TEM_PDF = (id: string) =>
  `exists (select 1 from uj.musica_pdfs p where p.musica_id = ${id}) as "temPdf"`

/**
 * Resumo do PDF (nome, tamanho e versão = SHA-256 em hexadecimal) ou nulo, sem os bytes. A
 * versão é a mesma do ETag: o aparelho compara e só baixa de novo se mudou.
 */
export const RESUMO_DO_PDF = (id: string) =>
  `(select json_build_object('nome', p.nome, 'tamanho', p.tamanho, 'versao', encode(p.hash, 'hex'))
      from uj.musica_pdfs p where p.musica_id = ${id}) as "pdf"`

const NOME_PADRAO = 'cifra.pdf'
// Controle, zero-width e os de direção de texto, escritos por código para o arquivo não os conter.
const CARACTERES_INVISIVEIS = new RegExp(
  // eslint-disable-next-line no-control-regex
  '[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]',
  'g',
)
const LIMITE_DO_NOME = 120

/**
 * Nome para mostrar na tela: só o último pedaço do caminho, sem caracteres de controle nem de
 * direção de texto (que trocam a ordem em que o nome aparece), em no máximo 120 letras e sempre
 * terminando em `.pdf`.
 */
export function nomeSeguroDoArquivo(bruto: string | undefined): string {
  const limpo = (bruto ?? '').normalize('NFC').replace(CARACTERES_INVISIVEIS, '')
  const ultimo = limpo.split(/[\\/]/).pop() ?? ''
  const nome = ultimo.replace(/\s+/g, ' ').replace(/^\.+/, '').trim()
  if (!nome) return NOME_PADRAO
  const base = nome.replace(/\.pdf$/i, '').trim()
  if (!base) return NOME_PADRAO
  return `${[...base]
    .slice(0, LIMITE_DO_NOME - 4)
    .join('')
    .trim()}.pdf`
}

/** O PDF começa com `%PDF-` seguido de um número de versão (`1.7`, `2.0`). */
export function pareceUmPdf(bytes: Buffer): boolean {
  return bytes.length >= 8 && /^%PDF-[1-9]\.\d/.test(bytes.toString('latin1', 0, 8))
}

/** Nome no cabeçalho: uma forma ASCII para clientes antigos e a forma completa (RFC 6266). */
function contentDisposition(nome: string): string {
  const ascii = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
  const completo = encodeURIComponent(nome).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename="${ascii}"; filename*=UTF-8''${completo}`
}

const ETAG_FORTE = /^"([0-9a-f]{64})"$/

/** ETags do `If-None-Match` (a forma fraca também vale, como manda a RFC 9110 para GET). */
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

const consulta = z.object({
  nome: z.string().max(1000).optional(),
  direitosConfirmados: z.enum(['true', 'false']).optional(),
})

const NAO_E_PDF = () =>
  new ErroHttp(
    'arquivo_nao_e_pdf',
    415,
    'Este arquivo não parece ser um PDF. Escolha um arquivo PDF e tente de novo.',
  )

const DIREITOS_NAO_CONFIRMADOS = () =>
  new ErroHttp(
    'direitos_nao_confirmados',
    400,
    'Confirme que a sua comunidade pode usar esta letra e esta cifra antes de salvar.',
  )

interface LinhaDoPdf {
  nome: string
  hash: string
  /** `null` quando o ETag que o aparelho mandou já é o atual (304). */
  conteudo: Buffer | null
}

export function registrarRotasDePdfDaMusica(app: FastifyInstance, api: pg.Pool): void {
  // Plugin próprio: o analisador de corpo "qualquer tipo" vale só para estas rotas. Um corpo que
  // não é PDF chega ao tratador e ganha a mensagem em português, em vez do 415 genérico.
  void app.register(async (escopo) => {
    escopo.addContentTypeParser('*', { parseAs: 'buffer' }, (_pedido, corpo, feito) => {
      feito(null, corpo)
    })

    const rota = '/api/v1/c/:comunidadeId/conteudos/musicas/:musicaId/pdf'
    const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
      naComunidade(api, pedido, async (c) => {
        try {
          return await trabalho(c)
        } catch (e) {
          if (e instanceof ErroHttp) throw e
          traduzirErroDoBanco(e)
        }
      })
    const exigirLer = async (pedido: FastifyRequest) => exigir(pedido, 'conteudo', 'ler')
    const exigirGerenciar = async (pedido: FastifyRequest) =>
      exigir(pedido, 'conteudo', 'gerenciar')
    const limite = limiteDeEscrita(ESCRITAS_DE_PDF_POR_HORA)
    // Sessão, comunidade, papel e cota ANTES de o corpo de até 10 MB ser lido: quem não pode
    // enviar não chega a ocupar a API.
    const paraGravar = [escopo.comComunidade, exigirGerenciar, limite]

    /** A música existe NESTA comunidade? Senão, 404 (nunca confirma que existe em outra). */
    async function exigirMusica(c: pg.PoolClient, comunidadeId: string, musicaId: string) {
      const { rowCount } = await c.query(
        'select 1 from uj.musicas where id = $1 and comunidade_id = $2',
        [musicaId, comunidadeId],
      )
      if (!rowCount) throw NAO_ENCONTRADO()
    }

    escopo.put(rota, { bodyLimit: LIMITE_DO_PDF, onRequest: paraGravar }, async (pedido) => {
      const musicaId = idDoCaminho(pedido, 'musicaId')
      const comunidadeId = pedido.comunidade!.id
      const q = validar(consulta, pedido.query)
      // A existência da música vem antes de qualquer conferência do corpo.
      await tx(pedido, (c) => exigirMusica(c, comunidadeId, musicaId))
      if (q.direitosConfirmados !== 'true') throw DIREITOS_NAO_CONFIRMADOS()
      const tipo = (pedido.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase()
      const corpo = pedido.body
      if (tipo !== 'application/pdf' || !Buffer.isBuffer(corpo) || !pareceUmPdf(corpo)) {
        throw NAO_E_PDF()
      }
      const nome = nomeSeguroDoArquivo(q.nome)
      return tx(pedido, async (c) => {
        const antes = await c.query('select 1 from uj.musica_pdfs where musica_id = $1', [musicaId])
        // O tamanho e o SHA-256 saem do próprio corpo, no banco: nada vem do cliente.
        const { rows } = await c.query<{ nome: string; tamanho: number; versao: string }>(
          `insert into uj.musica_pdfs
             (comunidade_id, musica_id, nome, conteudo, tamanho, hash, direito_confirmado_em)
           values ($1, $2, $3, $4::bytea, octet_length($4::bytea), sha256($4::bytea), now())
           on conflict (musica_id) do update
             set nome = excluded.nome, conteudo = excluded.conteudo, tamanho = excluded.tamanho,
                 hash = excluded.hash, direito_confirmado_em = excluded.direito_confirmado_em
           returning nome, tamanho, encode(hash, 'hex') as versao`,
          [comunidadeId, musicaId, nome, corpo],
        )
        await auditar(c, pedido, antes.rowCount ? 'conteudo.pdf_trocado' : 'conteudo.pdf_anexado', {
          tipo: 'musicas',
          id: musicaId,
        })
        return { temPdf: true, pdf: rows[0]! }
      })
    })

    escopo.delete(rota, { onRequest: paraGravar }, async (pedido) => {
      const musicaId = idDoCaminho(pedido, 'musicaId')
      const comunidadeId = pedido.comunidade!.id
      return tx(pedido, async (c) => {
        await exigirMusica(c, comunidadeId, musicaId)
        const r = await c.query(
          'delete from uj.musica_pdfs where musica_id = $1 and comunidade_id = $2',
          [musicaId, comunidadeId],
        )
        if (r.rowCount) {
          await auditar(c, pedido, 'conteudo.pdf_removido', { tipo: 'musicas', id: musicaId })
        }
        // Idempotente: sem PDF, o resultado é o mesmo.
        return { temPdf: false, pdf: null }
      })
    })

    escopo.get(
      rota,
      { onRequest: [escopo.comComunidade, exigirLer] },
      async (pedido, resposta: FastifyReply) => {
        const musicaId = idDoCaminho(pedido, 'musicaId')
        const linha = await tx(
          pedido,
          async (c) =>
            (
              await c.query<LinhaDoPdf>(
                `select nome, encode(hash, 'hex') as hash,
                        case when encode(hash, 'hex') = any ($3::text[]) or '*' = any ($3::text[])
                             then null else conteudo end as conteudo
                   from uj.musica_pdfs where musica_id = $1 and comunidade_id = $2`,
                [musicaId, pedido.comunidade!.id, etagsConhecidas(pedido)],
              )
            ).rows[0],
        )
        if (!linha) throw NAO_ENCONTRADO()
        resposta
          .header('ETag', `"${linha.hash}"`)
          .header('Cache-Control', 'private, no-cache')
          .header('Content-Disposition', contentDisposition(linha.nome))
        if (linha.conteudo === null) return resposta.code(304).send()
        return resposta.header('Content-Type', 'application/pdf').send(linha.conteudo)
      },
    )
  })
}
