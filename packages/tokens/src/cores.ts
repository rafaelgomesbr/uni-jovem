/**
 * Cores do Uni Jovem, direção visual A "Aurora" (noite e nascer do sol).
 * Decisão D15 (provisória até o dono escolher entre A, B e C): trocar de
 * direção é trocar ESTES valores; as telas usam só os nomes semânticos.
 *
 * Regras: todo par texto/fundo declarado em PARES_OBRIGATORIOS passa AA
 * (teste `contraste.test.ts`); cor nunca é o único sinal (ícone ou texto junto).
 */

export interface Paleta {
  fundo: string
  superficie: string
  superficieElevada: string
  texto: string
  textoSuave: string
  borda: string
  primaria: string
  sobrePrimaria: string
  /** Texto e ícones em destaque sobre o fundo (links, rótulos de seção). */
  destaque: string
  secundaria: string
  sobreSecundaria: string
  sucesso: string
  alerta: string
  erro: string
  foco: string
  /** Vidro: fundo translúcido e borda; com "Reduzir transparência", usa `superficieElevada`. */
  vidroFundo: string
  vidroBorda: string
}

export const ESCURO: Paleta = {
  fundo: '#12102A',
  superficie: '#1C1940',
  superficieElevada: '#25214F',
  texto: '#F5F3FF',
  textoSuave: '#C9C4EC',
  borda: '#7A73B8',
  primaria: '#FF8A65',
  sobrePrimaria: '#1A0F0A',
  destaque: '#FFB199',
  secundaria: '#9D8FFF',
  sobreSecundaria: '#12102A',
  sucesso: '#7FE0B0',
  alerta: '#FFD166',
  erro: '#FF8A8A',
  foco: '#FFD166',
  vidroFundo: 'rgba(30,27,62,0.72)',
  vidroBorda: 'rgba(255,255,255,0.16)',
}

export const CLARO: Paleta = {
  fundo: '#F7F5FF',
  superficie: '#FFFFFF',
  superficieElevada: '#FFFFFF',
  texto: '#1B1838',
  textoSuave: '#4B4670',
  borda: '#8F89B8',
  primaria: '#B83E1A',
  sobrePrimaria: '#FFFFFF',
  destaque: '#A33713',
  secundaria: '#4B3FC4',
  sobreSecundaria: '#FFFFFF',
  sucesso: '#16794B',
  alerta: '#8A5A00',
  erro: '#B42318',
  foco: '#4B3FC4',
  vidroFundo: 'rgba(255,255,255,0.78)',
  vidroBorda: 'rgba(27,24,56,0.12)',
}

/** Pares que precisam passar no contraste, e o mínimo de cada um. */
export const PARES_OBRIGATORIOS: readonly [keyof Paleta, keyof Paleta, 'texto' | 'interface'][] = [
  ['texto', 'fundo', 'texto'],
  ['texto', 'superficie', 'texto'],
  ['texto', 'superficieElevada', 'texto'],
  ['textoSuave', 'fundo', 'texto'],
  ['textoSuave', 'superficie', 'texto'],
  ['textoSuave', 'superficieElevada', 'texto'],
  ['sobrePrimaria', 'primaria', 'texto'],
  ['sobreSecundaria', 'secundaria', 'texto'],
  ['destaque', 'fundo', 'texto'],
  ['destaque', 'superficie', 'texto'],
  ['sucesso', 'superficie', 'texto'],
  ['alerta', 'superficie', 'texto'],
  ['erro', 'superficie', 'texto'],
  ['erro', 'fundo', 'texto'],
  ['primaria', 'fundo', 'interface'],
  ['borda', 'superficie', 'interface'],
  ['foco', 'fundo', 'interface'],
  ['foco', 'superficie', 'interface'],
]
