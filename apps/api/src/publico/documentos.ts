import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NOME_DO_APP } from '@uj/dominio'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Ambiente, Config } from '../config.ts'
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

/**
 * O app de cada ambiente (time iOS 8DVJ2U5ZKX). Cada domínio associa SÓ o seu
 * app: o de homologação nunca recebe links nem senhas salvas (webcredentials)
 * do domínio de produção, e o contrário também não. Desenvolvimento usa o app
 * de homologação (apps/app/app.config.ts).
 */
const PACOTE_DO_AMBIENTE: Record<Ambiente, string> = {
  producao: 'com.solerte.unijovem',
  homologacao: 'com.solerte.unijovem.hml',
  desenvolvimento: 'com.solerte.unijovem.hml',
}

export function appIdsIos(ambiente: Ambiente): string[] {
  return [`8DVJ2U5ZKX.${PACOTE_DO_AMBIENTE[ambiente]}`]
}

export function pacotesAndroid(ambiente: Ambiente): string[] {
  return [PACOTE_DO_AMBIENTE[ambiente]]
}

const AVISO_DE_RASCUNHO = html`<div class="cartao aviso" role="note">
  <p>
    <strong>Rascunho em revisão jurídica.</strong> Este texto ainda pode mudar e não substitui a
    versão final. Trechos entre colchetes ainda serão completados.
  </p>
</div>`

/**
 * Marcador de dado que só o dono pode informar (PH-11, contato de suporte).
 * Página pública com ele não vai para produção: a partida recusa
 * (`conferirPaginasPublicas`) e o teste `paginas-publicas` reprova.
 */
export const MARCADOR_PENDENTE = '[PREENCHER'

/** Todas as páginas públicas institucionais e legais, na ordem em que aparecem no rodapé. */
export const PAGINAS_PUBLICAS = ['/', '/privacidade', '/termos', '/suporte', '/excluir-conta']

export interface PaginaPendente {
  caminho: string
  /** Status da resposta: diferente de 200 é página fora do ar (ex.: documento ausente). */
  status: number
  ocorrencias: number
}

/** Páginas públicas que ainda mostram o marcador ou não respondem 200 (só as com problema). */
export async function marcadoresPendentes(
  app: Pick<FastifyInstance, 'inject'>,
): Promise<PaginaPendente[]> {
  const achados: PaginaPendente[] = []
  for (const caminho of PAGINAS_PUBLICAS) {
    const r = await app.inject({ method: 'GET', url: caminho })
    const ocorrencias = r.body.split(MARCADOR_PENDENTE).length - 1
    if (ocorrencias > 0 || r.statusCode !== 200) {
      achados.push({ caminho, status: r.statusCode, ocorrencias })
    }
  }
  return achados
}

/**
 * Na partida: em produção, página pública com [PREENCHER] (ou fora do ar)
 * impede a subida (lança, com a lista); fora dela, só devolve o aviso para o log.
 */
export async function conferirPaginasPublicas(
  app: Pick<FastifyInstance, 'inject'>,
  ambiente: Ambiente,
): Promise<string | null> {
  const pendentes = await marcadoresPendentes(app)
  if (pendentes.length === 0) return null
  const lista = pendentes
    .map((p) =>
      p.status === 200
        ? `${p.caminho} (${p.ocorrencias} marcador(es))`
        : `${p.caminho} (${p.status})`,
    )
    .join(', ')
  const mensagem = `Páginas públicas incompletas ou fora do ar (${MARCADOR_PENDENTE}]): ${lista}. Os dados vêm do dono (PH-11).`
  if (ambiente === 'producao') throw new Error(mensagem)
  return mensagem
}

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

  // Página inicial do domínio: quem chega pelo navegador (ou pela revisão das
  // lojas) vê o que é o app, que a entrada é por convite e os links legais.
  app.get('/', async (_pedido, resposta) =>
    responder(
      resposta,
      200,
      pagina(
        html`<h1>${NOME_DO_APP}</h1>
          <p>
            Organização da liderança jovem da sua comunidade: eventos, escalas, inscrições, avisos e
            pedidos de oração num só lugar.
          </p>
          <div class="cartao">
            <h2>Como entrar</h2>
            <p>
              A entrada é só por convite. Peça o link à liderança da sua comunidade e abra-o no
              celular ou no computador.
            </p>
            <p><a class="botao" href="/app">Abrir o ${NOME_DO_APP} na web</a></p>
          </div>
          <h2>Informações</h2>
          <ul>
            <li><a href="/privacidade">Política de Privacidade</a></li>
            <li><a href="/termos">Termos de Uso</a></li>
            <li><a href="/suporte">Suporte</a></li>
            <li><a href="/excluir-conta">Como excluir sua conta</a></li>
          </ul>`,
        {
          titulo: NOME_DO_APP,
          descricao: `${NOME_DO_APP}: organização da liderança jovem da sua comunidade.`,
          urlCanonica: new URL('/', o.config.URL_PUBLICA).toString(),
          indexavel: true,
        },
      ),
    ),
  )

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
            descricao: `${padrao} do ${NOME_DO_APP} (rascunho em revisão).`,
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
          titulo: `Excluir sua conta do ${NOME_DO_APP}`,
          descricao: `Como excluir sua conta do ${NOME_DO_APP} e o que acontece com seus dados.`,
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
        html`<h1>Suporte do ${NOME_DO_APP}</h1>
          ${AVISO_DE_RASCUNHO}
          <h2>Como pedir ajuda</h2>
          <p>
            Para dúvidas sobre eventos, escalas ou convites, fale primeiro com a liderança da sua
            comunidade: ela administra os convites, os papéis e a programação.
          </p>
          <p>
            Para problemas no aplicativo, na sua conta ou nos seus dados, escreva para ${contato}.
            Conte o que aconteceu, em qual aparelho e, se puder, o horário. Nunca envie a sua senha
            nem o código do autenticador: a equipe do ${NOME_DO_APP} não pede essas informações.
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
          titulo: `Suporte do ${NOME_DO_APP}`,
          descricao: `Como pedir ajuda no ${NOME_DO_APP}.`,
          urlCanonica: new URL('/suporte', o.config.URL_PUBLICA).toString(),
          indexavel: true,
        },
      ),
    )
  })

  // ---------------------------------------------------------------- associação de domínio

  // Links universais do iOS: o convite (o token vai no fragmento, que o
  // sistema não envia a ninguém) e as rotas do app na web.
  const appIds = appIdsIos(o.config.UJ_AMBIENTE)
  app.get('/.well-known/apple-app-site-association', async (_pedido, resposta) =>
    resposta.header('Content-Type', 'application/json').send({
      applinks: {
        details: [
          {
            appIDs: appIds,
            components: [{ '/': '/convite*' }, { '/': '/app/*' }],
          },
        ],
      },
      webcredentials: { apps: appIds },
    }),
  )

  // App Links do Android. Sem impressão configurada, a lista vai vazia (nenhum
  // app é verificado, o link abre no navegador).
  app.get('/.well-known/assetlinks.json', async (_pedido, resposta) => {
    const impressoes = o.config.ANDROID_SHA256_IMPRESSOES
    return resposta.header('Content-Type', 'application/json').send(
      impressoes.length === 0
        ? []
        : pacotesAndroid(o.config.UJ_AMBIENTE).map((pacote) => ({
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
