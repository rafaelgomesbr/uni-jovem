/**
 * Monta as capturas finais das lojas: fundo Aurora, legenda curta em
 * Bricolage e a captura crua (scripts/lojas/capturas.ts) com cantos
 * arredondados, sem moldura de aparelho (a Apple recusa moldura de Android e o
 * Google, de iPhone). Saída em JPEG, sem canal alfa, no tamanho exato de cada
 * loja (docs/lojas/capturas.md, seção 1), em docs/lojas/capturas/final.
 *
 *   node --import tsx scripts/lojas/molduras.ts
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { APARELHOS } from './capturas.ts'

const RAIZ = join(import.meta.dirname, '..', '..')
const CRU = join(RAIZ, 'docs', 'lojas', 'capturas', 'cru')
const FINAL = join(RAIZ, 'docs', 'lojas', 'capturas', 'final')
const FONTES = join(RAIZ, 'node_modules', '@expo-google-fonts')

/**
 * Legendas: uma frase curta que descreve o que a tela mostra de fato (diretriz
 * 2.3 da Apple e política de metadados do Google), sem preço nem promessa.
 */
export const LEGENDAS: Record<string, string> = {
  '01-inicio': 'Sua semana no grupo jovem, num olhar',
  '02-programacao': 'A programação do sábado, etapa por etapa',
  '03-ao-vivo': 'Ao vivo: etapa atual e tempo restante',
  '04-escalas': 'Confirme a escala ou peça substituição',
  '05-presenca': 'Presença por QR Code ou pelo nome',
  '06-novo-pedido': 'Você escolhe quem vê o seu pedido',
  '07-agenda': 'Toda a agenda da comunidade',
  '08-equipe': 'Equipe, papéis e convites num lugar só',
  '09-avisos': 'Avisos da liderança, os fixados no topo',
  '10-convidar': 'Entrada só por convite da liderança',
}

function fonte(familia: string, peso: string, arquivo: string): string {
  return pathToFileURL(join(FONTES, familia, peso, arquivo)).href
}

function pagina(captura: string, legenda: string, largura: number, altura: number): string {
  const titulo = Math.round(largura * 0.078)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Bricolage'; src: url('${fonte('bricolage-grotesque', '700Bold', 'BricolageGrotesque_700Bold.ttf')}'); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${largura}px; height: ${altura}px; overflow: hidden; background: #12102A; }
.palco { position: relative; width: 100%; height: 100%; overflow: hidden; }
.coral, .violeta { position: absolute; border-radius: 50%; }
.coral { width: ${largura * 1.1}px; height: ${largura * 1.1}px; top: -${largura * 0.45}px; right: -${largura * 0.4}px;
  background: radial-gradient(circle, rgba(255,138,101,0.55) 0%, rgba(255,138,101,0) 70%); }
.violeta { width: ${largura * 1.2}px; height: ${largura * 1.2}px; top: ${altura * 0.18}px; left: -${largura * 0.55}px;
  background: radial-gradient(circle, rgba(124,108,255,0.45) 0%, rgba(124,108,255,0) 70%); }
h1 { position: absolute; top: ${Math.round(altura * 0.075)}px; left: ${largura * 0.08}px; right: ${largura * 0.08}px;
  font-family: 'Bricolage'; font-weight: 700; font-size: ${titulo}px; line-height: 1.12; letter-spacing: -0.01em;
  color: #FFFFFF; text-align: center; }
.tela { position: absolute; top: ${Math.round(altura * 0.235)}px; left: ${largura * 0.08}px; width: ${largura * 0.84}px;
  border-radius: ${Math.round(largura * 0.085)}px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
.tela img { display: block; width: 100%; }
</style></head><body><div class="palco"><div class="coral"></div><div class="violeta"></div>
<h1>${legenda}</h1><div class="tela"><img src="${pathToFileURL(captura).href}"></div></div></body></html>`
}

async function principal() {
  const navegador = await chromium.launch()
  // Página em arquivo: uma página de setContent não carrega imagem file://.
  const temporaria = mkdtempSync(join(tmpdir(), 'uj-molduras-'))
  try {
    for (const aparelho of APARELHOS) {
      const pasta = join(FINAL, aparelho.nome)
      mkdirSync(pasta, { recursive: true })
      // Só as capturas com legenda atual ficam na pasta que vai para as lojas.
      for (const arquivo of readdirSync(pasta)) {
        if (arquivo.endsWith('.jpg') && !(arquivo.replace(/\.jpg$/, '') in LEGENDAS)) {
          rmSync(join(pasta, arquivo))
        }
      }
      const contexto = await navegador.newContext({
        viewport: { width: aparelho.largura, height: aparelho.altura },
        deviceScaleFactor: 3,
      })
      const page = await contexto.newPage()
      for (const [arquivo, legenda] of Object.entries(LEGENDAS)) {
        const captura = join(CRU, aparelho.nome, `${arquivo}.png`)
        if (!existsSync(captura)) continue
        const html = join(temporaria, `${aparelho.nome}-${arquivo}.html`)
        writeFileSync(html, pagina(captura, legenda, aparelho.largura, aparelho.altura))
        await page.goto(pathToFileURL(html).href, { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        const destino = join(pasta, `${arquivo}.jpg`)
        await page.screenshot({ path: destino, type: 'jpeg', quality: 92 })
        console.log(`${aparelho.nome}/${arquivo}.jpg`)
      }
      await contexto.close()
    }
  } finally {
    await navegador.close()
    rmSync(temporaria, { recursive: true, force: true })
  }
}

await principal()
