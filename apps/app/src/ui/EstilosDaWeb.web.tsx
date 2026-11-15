import { useEffect } from 'react'

import { useTema } from './tema'

const ID = 'uj-estilos-globais'

/**
 * Foco visível para quem navega por teclado. A cor vem dos tokens, então o
 * estilo é montado aqui (sincronia com o DOM, por isso o efeito).
 */
export function EstilosDaWeb() {
  const { cores } = useTema()
  useEffect(() => {
    let estilo = document.getElementById(ID) as HTMLStyleElement | null
    if (!estilo) {
      estilo = document.createElement('style')
      estilo.id = ID
      document.head.appendChild(estilo)
    }
    estilo.textContent = [
      `:focus-visible { outline: 2px solid ${cores.foco} !important; outline-offset: 2px !important; }`,
      ':focus:not(:focus-visible) { outline: none; }',
      `body { background-color: ${cores.fundo}; }`,
      // "Pular para o conteúdo": fora da vista até receber o foco do teclado.
      '#uj-pular:not(:focus) { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }',
      '#uj-conteudo:focus { outline: none !important; }',
      '@media (prefers-reduced-motion: reduce) {',
      '  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }',
      '}',
    ].join('\n')
  }, [cores.foco, cores.fundo])
  return null
}
