import { ehCodigoDaComunidade, NOME_DO_APP, normalizarCodigoDaComunidade } from '@uj/dominio'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Ambiente, Config } from '../config.ts'
import { CSP_PUBLICA, html, pagina, SCRIPT_COPIAR_CODIGO } from './html.ts'

/**
 * Página pública do link do código da comunidade: `GET /entrar/:codigo`
 * (D58). É o que o link compartilhado em "Código da comunidade" abre quando o
 * app não captura o link (app não instalado, ou aberto de dentro de outro app).
 * Com o app instalado, o sistema abre o app direto (link universal / App Link)
 * e esta página nem aparece.
 *
 * Decisão de privacidade: a página NÃO consulta o banco. Só confere o formato
 * do código (8 símbolos do alfabeto). Assim ela não revela o nome da
 * comunidade nem diz se o código existe ou foi trocado (nada de enumeração por
 * força bruta); quem decide é a API, depois do login, em "Tenho um código".
 */

/** Esquema do app por ambiente (o mesmo de `apps/app/app.config.ts`). */
const ESQUEMA_DO_APP: Record<Ambiente, string> = {
  producao: 'unijovem',
  homologacao: 'unijovem-hml',
  desenvolvimento: 'unijovem-hml',
}

/** "XPHVYHFS" vira "XPHV YHFS": mais fácil de ler em voz alta e de conferir. */
export function codigoLegivel(codigo: string): string {
  return `${codigo.slice(0, 4)} ${codigo.slice(4)}`
}

/** O código do caminho, normalizado, ou `null` se não tiver o formato certo. */
export function codigoDoCaminho(bruto: string): string | null {
  // Teto antes de normalizar: o que passa disso nunca é um código.
  if (bruto.length > 40) return null
  const codigo = normalizarCodigoDaComunidade(bruto)
  return ehCodigoDaComunidade(codigo) ? codigo : null
}

export function registrarPaginaDoCodigo(app: FastifyInstance, o: { config: Config }): void {
  const esquema = ESQUEMA_DO_APP[o.config.UJ_AMBIENTE]

  function responder(r: FastifyReply, status: number, conteudo: string) {
    return r
      .code(status)
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Content-Security-Policy', CSP_PUBLICA)
      .header('X-Robots-Tag', 'noindex, nofollow')
      .send(conteudo)
  }

  app.get('/publico/codigo.js', async (_p, r) =>
    r
      .header('Content-Type', 'text/javascript; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .send(SCRIPT_COPIAR_CODIGO),
  )

  app.get('/entrar/:codigo', async (pedido, resposta) => {
    const codigo = codigoDoCaminho((pedido.params as { codigo: string }).codigo)
    if (!codigo) {
      return responder(
        resposta,
        404,
        pagina(
          html`<h1>Código não reconhecido</h1>
            <p class="suave">
              Confira o link com quem compartilhou. O código tem 8 letras e números, como ABCD 2345.
            </p>
            <p><a class="botao" href="/">Ir para o início</a></p>`,
          { titulo: 'Código não reconhecido' },
        ),
      )
    }
    return responder(
      resposta,
      200,
      pagina(
        html`<h1>Você foi convidado(a) para uma comunidade no ${NOME_DO_APP}</h1>
          <div class="cartao">
            <p class="suave">Código da comunidade</p>
            <p class="codigo" id="codigo-legivel" aria-label="Código: ${[...codigo].join(' ')}">
              ${codigoLegivel(codigo)}
            </p>
            <p class="suave">
              Quem tem o código pode entrar ou pedir para entrar, conforme a forma de entrada que a
              liderança escolheu.
            </p>
          </div>
          <div class="acoes">
            <a class="botao" href="${esquema}://entrar/${codigo}">Abrir no app</a>
            <a class="botao secundario" href="/app/tenho-um-codigo?codigo=${codigo}"
              >Continuar no navegador</a
            >
            <button type="button" class="secundario" id="copiar" data-codigo="${codigo}" hidden>
              Copiar código
            </button>
          </div>
          <p id="copiado" class="ok" role="status"></p>
          <p class="suave">
            Com o app instalado, toque em "Abrir no app". Se ele não abrir, use "Continuar no
            navegador" ou, no app, vá em "Tenho um código" e digite o código acima.
          </p>`,
        {
          titulo: `Convite para uma comunidade no ${NOME_DO_APP}`,
          descricao: `Entre numa comunidade no ${NOME_DO_APP} com um código.`,
          scripts: ['/publico/codigo.js'],
        },
      ),
    )
  })
}
