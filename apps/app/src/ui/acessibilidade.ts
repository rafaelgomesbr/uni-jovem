/**
 * Preferências de acessibilidade do sistema (Reduzir movimento, Reduzir
 * transparência, Aumentar contraste). É um armazenamento externo: lido com
 * `useSyncExternalStore`, assinado uma vez para o app inteiro.
 */
import { useSyncExternalStore } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'

export interface PreferenciasDeAcessibilidade {
  reduzirMovimento: boolean
  reduzirTransparencia: boolean
  aumentarContraste: boolean
}

let atual: PreferenciasDeAcessibilidade = {
  reduzirMovimento: false,
  reduzirTransparencia: false,
  aumentarContraste: false,
}
const ouvintes = new Set<() => void>()
let iniciado = false

function atualizar(parcial: Partial<PreferenciasDeAcessibilidade>) {
  const proximo = { ...atual, ...parcial }
  if (
    proximo.reduzirMovimento === atual.reduzirMovimento &&
    proximo.reduzirTransparencia === atual.reduzirTransparencia &&
    proximo.aumentarContraste === atual.aumentarContraste
  ) {
    return
  }
  atual = proximo
  for (const ouvinte of ouvintes) ouvinte()
}

function consultarNaWeb() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  const consultas: [keyof PreferenciasDeAcessibilidade, string][] = [
    ['reduzirMovimento', '(prefers-reduced-motion: reduce)'],
    ['reduzirTransparencia', '(prefers-reduced-transparency: reduce)'],
    ['aumentarContraste', '(prefers-contrast: more)'],
  ]
  for (const [chave, consulta] of consultas) {
    const lista = window.matchMedia(consulta)
    atualizar({ [chave]: lista.matches })
    lista.addEventListener?.('change', (e) => atualizar({ [chave]: e.matches }))
  }
}

function lerComSeguranca(
  chave: keyof PreferenciasDeAcessibilidade,
  leitura: (() => Promise<boolean>) | undefined,
) {
  if (typeof leitura !== 'function') return
  leitura()
    .then((valor) => atualizar({ [chave]: valor }))
    .catch(() => {})
}

function consultarNoCelular() {
  lerComSeguranca('reduzirMovimento', AccessibilityInfo.isReduceMotionEnabled)
  AccessibilityInfo.addEventListener('reduceMotionChanged', (valor) =>
    atualizar({ reduzirMovimento: valor }),
  )
  if (Platform.OS === 'ios') {
    lerComSeguranca('reduzirTransparencia', AccessibilityInfo.isReduceTransparencyEnabled)
    lerComSeguranca('aumentarContraste', AccessibilityInfo.isDarkerSystemColorsEnabled)
    AccessibilityInfo.addEventListener('reduceTransparencyChanged', (valor) =>
      atualizar({ reduzirTransparencia: valor }),
    )
    AccessibilityInfo.addEventListener('darkerSystemColorsChanged', (valor) =>
      atualizar({ aumentarContraste: valor }),
    )
  }
  if (Platform.OS === 'android') {
    lerComSeguranca('aumentarContraste', AccessibilityInfo.isHighTextContrastEnabled)
    AccessibilityInfo.addEventListener('highTextContrastChanged', (valor) =>
      atualizar({ aumentarContraste: valor }),
    )
  }
}

function assinar(ouvinte: () => void): () => void {
  if (!iniciado) {
    iniciado = true
    try {
      if (Platform.OS === 'web') consultarNaWeb()
      else consultarNoCelular()
    } catch {
      // Sem a informação do sistema, ficam os padrões (efeitos ligados).
    }
  }
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

const ler = () => atual

export function usePreferenciasDeAcessibilidade(): PreferenciasDeAcessibilidade {
  return useSyncExternalStore(assinar, ler, ler)
}
