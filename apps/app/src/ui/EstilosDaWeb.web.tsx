import { useEffect } from 'react'

import { useTema } from './tema'

const ID = 'uj-estilos-globais'

/**
 * Foco visível para quem navega por teclado. A cor vem dos tokens, então o
 * estilo é montado aqui (sincronia com o DOM, por isso o efeito).
 */
export function EstilosDaWeb() {
  const { cores, escuro } = useTema()
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
      // Campo (D64): o anel é a camada arredondada da própria caixa; sem o contorno reto por fora.
      '[data-campo]:focus-visible { outline: none !important; }',
      // Hover (web): fundo 3% mais perto do contraste e borda um passo adiante (no claro escurece, para manter 3:1).
      `[data-campo-caixa="normal"]:hover { border-color: color-mix(in srgb, ${cores.campoBorda} 92%, ${escuro ? '#FFFFFF' : '#000000'}) !important; background-color: color-mix(in srgb, ${cores.campoFundo} 97%, ${escuro ? '#FFFFFF' : '#000000'}) !important; }`,
      // Data e hora: o seletor do navegador cobre a caixa toda (tocar em qualquer ponto abre), sem o segundo ícone à direita.
      '[data-campo-momento] { position: relative; }',
      '[data-campo-momento]::-webkit-calendar-picker-indicator { position: absolute; inset: 0; width: auto; height: auto; margin: 0; padding: 0; opacity: 0; cursor: pointer; }',
      // Preenchimento do sistema: o amarelo do navegador não entra (sem o truque de `transition` longa:
      // a regra de Reduzir movimento abaixo a força a 0,01 ms).
      `[data-campo]:-webkit-autofill, [data-campo]:-webkit-autofill:hover, [data-campo]:-webkit-autofill:focus { -webkit-box-shadow: 0 0 0 1000px ${cores.campoFundo} inset !important; box-shadow: 0 0 0 1000px ${cores.campoFundo} inset !important; -webkit-text-fill-color: ${cores.texto} !important; caret-color: ${cores.primaria}; }`,
      `body { background-color: ${cores.fundo}; }`,
      // "Pular para o conteúdo": fora da vista até receber o foco do teclado.
      '#uj-pular:not(:focus) { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }',
      '#uj-conteudo:focus { outline: none !important; }',
      '@media (prefers-reduced-motion: reduce) {',
      '  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }',
      '}',
    ].join('\n')
  }, [
    cores.foco,
    cores.fundo,
    cores.campoBorda,
    cores.campoFundo,
    cores.texto,
    cores.primaria,
    escuro,
  ])
  return null
}
