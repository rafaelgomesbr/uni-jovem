import { NOME_DO_APP } from '@uj/dominio'

/**
 * HTML das páginas públicas. Todo valor entra por `esc` (ou pelo marcador
 * `html` com escape automático): nenhum dado de evento vira HTML cru.
 */

export function esc(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Trecho já seguro (gerado por `html` ou SVG do QR). */
export class Seguro {
  constructor(public readonly texto: string) {}
  toString(): string {
    return this.texto
  }
}

export function html(partes: TemplateStringsArray, ...valores: unknown[]): Seguro {
  let saida = partes[0] ?? ''
  valores.forEach((v, i) => {
    const pedaco = Array.isArray(v)
      ? v.map((x) => (x instanceof Seguro ? x.texto : esc(x))).join('')
      : v instanceof Seguro
        ? v.texto
        : esc(v)
    saida += pedaco + (partes[i + 1] ?? '')
  })
  return new Seguro(saida)
}

export interface OpcoesDaPagina {
  titulo: string
  descricao?: string
  urlCanonica?: string
  cor?: string
  scripts?: string[]
  /** Páginas de política e suporte podem ser indexadas; as de evento, não. */
  indexavel?: boolean
}

export function pagina(corpo: Seguro, o: OpcoesDaPagina): string {
  return html`<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        ${o.indexavel ? '' : html`<meta name="robots" content="noindex, nofollow" />`}
        <meta name="referrer" content="no-referrer" />
        <title>${o.titulo}</title>
        <meta name="description" content="${o.descricao ?? ''}" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="${o.titulo}" />
        <meta property="og:description" content="${o.descricao ?? ''}" />
        ${o.urlCanonica ? html`<meta property="og:url" content="${o.urlCanonica}" />` : ''}
        <meta name="theme-color" content="${o.cor ?? '#12102A'}" />
        <link rel="stylesheet" href="/publico/estilo.css" />
        ${(o.scripts ?? []).map((s) => html`<script src="${s}" defer></script>`)}
      </head>
      <body>
        <main class="folha">${corpo}</main>
        <footer class="rodape">
          <a href="/privacidade">Privacidade</a> · <a href="/termos">Termos</a> ·
          <a href="/suporte">Suporte</a> · ${NOME_DO_APP}
        </footer>
      </body>
    </html>`.texto
}

/** CSP estrita das páginas públicas: só recursos próprios e o Turnstile. */
export const CSP_PUBLICA = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  'frame-src https://challenges.cloudflare.com',
  "style-src 'self'",
  "img-src 'self' data:",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ')

export const ESTILO = `:root{color-scheme:light dark;--fundo:#F7F5FF;--sup:#FFFFFF;--texto:#1B1838;--suave:#4B4670;--prim:#B83E1A;--sobreprim:#FFFFFF;--borda:#8F89B8;--erro:#B42318;--ok:#16794B;--foco:#4B3FC4}
@media (prefers-color-scheme:dark){:root{--fundo:#12102A;--sup:#1C1940;--texto:#F5F3FF;--suave:#C9C4EC;--prim:#FF8A65;--sobreprim:#1A0F0A;--borda:#7A73B8;--erro:#FF8A8A;--ok:#7FE0B0;--foco:#FFD166}}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--texto);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.folha{max-width:640px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:1.9rem;line-height:1.15;margin:.2em 0 .4em}h2{font-size:1.2rem;margin:1.5em 0 .5em}
.selo{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid var(--borda);color:var(--suave);font-size:.85rem}
.cartao{background:var(--sup);border:1px solid var(--borda);border-radius:18px;padding:18px;margin:16px 0}
.suave{color:var(--suave)}.erro{color:var(--erro);font-weight:600}.ok{color:var(--ok);font-weight:600}
label{display:block;font-weight:600;margin:14px 0 6px}input{width:100%;min-height:48px;padding:10px 12px;border-radius:12px;border:1px solid var(--borda);background:var(--sup);color:var(--texto);font-size:1rem}
input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid var(--foco);outline-offset:2px}
.caixa{display:flex;gap:10px;align-items:flex-start;margin:16px 0}.caixa label{margin:0;font-weight:400}.caixa input{width:24px;min-height:24px;margin-top:2px}
button,.botao{display:inline-block;min-height:48px;padding:12px 20px;border:0;border-radius:14px;background:var(--prim);color:var(--sobreprim);font-weight:700;font-size:1rem;text-decoration:none;cursor:pointer}
.isca{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
.qr{background:#fff;padding:12px;border-radius:12px;display:inline-block}.qr svg{width:200px;height:200px}
.rodape{text-align:center;color:var(--suave);font-size:.85rem;padding:24px 16px}.rodape a{color:var(--suave)}
.aviso{border-width:2px}.documento{overflow-wrap:anywhere}blockquote{margin:16px 0;padding:4px 16px;border-left:4px solid var(--borda)}
.tabela{overflow-x:auto;margin:16px 0}table{border-collapse:collapse;width:100%;font-size:.95rem}th,td{border:1px solid var(--borda);padding:8px;text-align:left;vertical-align:top}
code{font-family:ui-monospace,Consolas,monospace;font-size:.9em}a{color:var(--texto)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`

/** Lê o token do fragmento (#t=...) e preenche o formulário de cancelamento. */
export const SCRIPT_CANCELAR = `(function(){var m=location.hash.match(/t=([\\w-]+)/);var c=document.getElementById('token');if(m&&c){c.value=m[1];history.replaceState(null,'',location.pathname);}else{var a=document.getElementById('sem-token');if(a)a.hidden=false;}})();`
