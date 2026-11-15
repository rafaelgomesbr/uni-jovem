/**
 * Web: o `announceForAccessibility` do react-native-web é vazio. Uma região
 * `aria-live="polite"` oculta (uma só para o app) recebe o texto; para repetir
 * o mesmo anúncio, ela é esvaziada antes e preenchida no quadro seguinte.
 */

const ID = 'uj-anuncios'
let pendente: ReturnType<typeof setTimeout> | null = null

function regiao(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  let el = document.getElementById(ID)
  if (!el) {
    el = document.createElement('div')
    el.id = ID
    el.setAttribute('aria-live', 'polite')
    el.setAttribute('aria-atomic', 'true')
    el.setAttribute('role', 'status')
    // Visualmente oculta, mas lida (não usar display:none, que cala a região).
    el.setAttribute(
      'style',
      'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0',
    )
    document.body.appendChild(el)
  }
  return el
}

export function anunciar(texto: string): void {
  const limpo = texto.trim()
  const el = regiao()
  if (!limpo || !el) return
  el.textContent = ''
  if (pendente) clearTimeout(pendente)
  pendente = setTimeout(() => {
    el.textContent = limpo
    pendente = null
  }, 60)
}
