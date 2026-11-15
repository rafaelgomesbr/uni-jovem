import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Config } from '../config.ts'
import { CSP_PUBLICA, html, pagina, Seguro } from './html.ts'
import { markdownParaHtml, semAnexos, semNotasInternas } from './markdown.ts'

/**
 * Páginas públicas de política e suporte, renderizadas no servidor a partir
 * dos rascunhos de `docs/privacidade/` (fonte única: o texto da página é o do
 * documento), sem as notas internas e sem o anexo para o advogado. Todas levam
 * um aviso visível de rascunho enquanto a revisão jurídica (PH-11) não vier.
 *
 * Também os arquivos de associação de domínio (links universais e App Links).
 */

export const PASTA_DOS_DOCUMENTOS = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'privacidade',
)

/** App IDs do iOS (time 8DVJ2U5ZKX): produção e homologação. */
export const APP_IDS_IOS = [
  '8DVJ2U5ZKX.com.solerte.unijovem',
  '8DVJ2U5ZKX.com.solerte.unijovem.hml',
]
export const PACOTES_ANDROID = ['com.solerte.unijovem', 'com.solerte.unijovem.hml']

const AVISO_DE_RASCUNHO = html`<div class="cartao aviso" role="note">
  <p>
    <strong>Rascunho em revisão jurídica.</strong> Este texto ainda pode mudar e não substitui a
    versão final. Trechos marcados com [PREENCHER] ainda serão completados.
  </p>
</div>`

function lerDocumento(pasta: string, arquivo: string): string | null {
  try {
    return readFileSync(join(pasta, arquivo), 'utf8')
  } catch {
    return null
  }
}

/** Corpo do documento: sem o título (vira o h1), sem o cabeçalho de rascunho e sem notas. */
function corpoDoDocumento(md: string): { titulo: string; corpo: string } {
  const linhas = semAnexos(md).split(/\r?\n/)
  const indiceTitulo = linhas.findIndex((l) => /^#\s+/.test(l))
  const titulo = indiceTitulo >= 0 ? linhas[indiceTitulo]!.replace(/^#\s+/, '') : ''
  let i = indiceTitulo + 1
  while (i < linhas.length && !linhas[i]!.trim()) i++
  // O bloco de citação logo abaixo do título é o cabeçalho interno do rascunho.
  while (i < linhas.length && linhas[i]!.trim().startsWith('>')) i++
  return { titulo, corpo: semNotasInternas(linhas.slice(i).join('\n')) }
}

/** O conteúdo da página `/excluir-conta` é a citação da seção 10 de exclusao-de-conta.md. */
export function conteudoDaPaginaDeExclusao(md: string): string {
  const linhas = md.split(/\r?\n/)
  const inicio = linhas.findIndex((l) => /Conteúdo da página \(rascunho\)/.test(l))
  if (inicio < 0) return ''
  let i = inicio + 1
  while (i < linhas.length && !linhas[i]!.trim()) i++
  const bloco: string[] = []
  while (i < linhas.length && linhas[i]!.trim().startsWith('>')) {
    bloco.push(linhas[i++]!.trim().replace(/^>\s?/, ''))
  }
  return semNotasInternas(bloco.join('\n'))
}

export function registrarDocumentosPublicos(
  app: FastifyInstance,
  o: { config: Config; pasta?: string },
): void {
  const pasta = o.pasta ?? PASTA_DOS_DOCUMENTOS

  function responder(r: FastifyReply, status: number, conteudo: string) {
    // Estas páginas podem ser indexadas: o Google Play precisa alcançar /excluir-conta.
    return r
      .code(status)
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Content-Security-Policy', CSP_PUBLICA)
      .send(conteudo)
  }

  function indisponivel(r: FastifyReply, titulo: string) {
    return responder(
      r,
      503,
      pagina(
        html`<h1>${titulo}</h1>
          <p>Esta página está temporariamente indisponível. Tente de novo em alguns minutos.</p>`,
        { titulo, indexavel: false },
      ),
    )
  }

  const documentos: [string, string, string][] = [
    ['/privacidade', 'politica-de-privacidade.md', 'Política de Privacidade'],
    ['/termos', 'termos-de-uso.md', 'Termos de Uso'],
  ]
  for (const [caminho, arquivo, padrao] of documentos) {
    app.get(caminho, async (_pedido, resposta) => {
      const md = lerDocumento(pasta, arquivo)
      if (!md) return indisponivel(resposta, padrao)
      const { titulo, corpo } = corpoDoDocumento(md)
      return responder(
        resposta,
        200,
        pagina(
          html`<h1>${titulo || padrao}</h1>
            ${AVISO_DE_RASCUNHO}
            <div class="documento">${new Seguro(markdownParaHtml(corpo))}</div>`,
          {
            titulo: `${titulo || padrao}`,
            descricao: `${padrao} do Uni Jovem (rascunho em revisão).`,
            urlCanonica: new URL(caminho, o.config.URL_PUBLICA).toString(),
            indexavel: true,
          },
        ),
      )
    })
  }

  app.get('/excluir-conta', async (_pedido, resposta) => {
    const md = lerDocumento(pasta, 'exclusao-de-conta.md')
    const conteudo = md ? conteudoDaPaginaDeExclusao(md) : ''
    if (!conteudo) return indisponivel(resposta, 'Excluir sua conta')
    return responder(
      resposta,
      200,
      pagina(
        html`${AVISO_DE_RASCUNHO}
          <div class="documento">${new Seguro(markdownParaHtml(conteudo))}</div>
          <p><a href="/suporte">Precisa de ajuda? Fale com o suporte</a>.</p>`,
        {
          titulo: 'Excluir sua conta do Uni Jovem',
          descricao: 'Como excluir sua conta do Uni Jovem e o que acontece com seus dados.',
          urlCanonica: new URL('/excluir-conta', o.config.URL_PUBLICA).toString(),
          indexavel: true,
        },
      ),
    )
  })

  app.get('/suporte', async (_pedido, resposta) => {
    const email = o.config.SUPORTE_EMAIL
    const contato = email
      ? html`<a href="mailto:${email}">${email}</a>`
      : html`[PREENCHER: e-mail de suporte]`
    return responder(
      resposta,
      200,
      pagina(
        html`<h1>Suporte do Uni Jovem</h1>
          ${AVISO_DE_RASCUNHO}
          <h2>Como pedir ajuda</h2>
          <p>
            Para dúvidas sobre eventos, escalas ou convites, fale primeiro com a liderança da sua
            comunidade: ela administra os convites, os papéis e a programação.
          </p>
          <p>
            Para problemas no aplicativo, na sua conta ou nos seus dados, escreva para ${contato}.
            Conte o que aconteceu, em qual aparelho e, se puder, o horário. Nunca envie a sua senha
            nem o código do autenticador: a equipe do Uni Jovem não pede essas informações.
          </p>
          <h2>Esqueceu a senha?</h2>
          <p>
            Na tela de entrada do app, toque em "Esqueci a senha" e siga o link enviado ao seu
            e-mail.
          </p>
          <h2>Seus dados</h2>
          <ul>
            <li><a href="/privacidade">Política de Privacidade</a></li>
            <li><a href="/termos">Termos de Uso</a></li>
            <li><a href="/excluir-conta">Como excluir sua conta</a></li>
          </ul>
          <p>
            No app, em Perfil, você também pode exportar uma cópia dos seus dados e excluir a conta.
          </p>`,
        {
          titulo: 'Suporte do Uni Jovem',
          descricao: 'Como pedir ajuda no Uni Jovem.',
          urlCanonica: new URL('/suporte', o.config.URL_PUBLICA).toString(),
          indexavel: true,
        },
      ),
    )
  })

  // ---------------------------------------------------------------- associação de domínio

  // Links universais do iOS: o convite (o token vai no fragmento, que o
  // sistema não envia a ninguém) e as rotas do app na web.
  app.get('/.well-known/apple-app-site-association', async (_pedido, resposta) =>
    resposta.header('Content-Type', 'application/json').send({
      applinks: {
        details: [
          {
            appIDs: APP_IDS_IOS,
            components: [{ '/': '/convite*' }, { '/': '/app/*' }],
          },
        ],
      },
      webcredentials: { apps: APP_IDS_IOS },
    }),
  )

  // App Links do Android. Sem impressão configurada, a lista vai vazia (nenhum
  // app é verificado, o link abre no navegador).
  app.get('/.well-known/assetlinks.json', async (_pedido, resposta) => {
    const impressoes = o.config.ANDROID_SHA256_IMPRESSOES
    return resposta.header('Content-Type', 'application/json').send(
      impressoes.length === 0
        ? []
        : PACOTES_ANDROID.map((pacote) => ({
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: pacote,
              sha256_cert_fingerprints: impressoes,
            },
          })),
    )
  })
}
