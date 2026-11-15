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
  /** Contorno de controles (campos, botão secundário): passa 3:1 sobre a superfície. */
  borda: string
  /**
   * Contorno de cartões e separadores de lista. Decorativo: o cartão se distingue
   * pela superfície e pela sombra; com "Aumentar contraste", vira `texto`.
   */
  bordaSuave: string
  /** Fundo de realce: item tocado, item escolhido, moldura de ícone. Texto passa AA sobre ele. */
  superficieRealce: string
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
  /** Cartão de conteúdo translúcido (mockup Aurora); com "Reduzir transparência", `superficie`. */
  cartaoVidro: string
  cartaoVidroBorda: string
  /** Contorno do botão secundário. O rótulo identifica o botão; o contorno só desenha. */
  contornoSecundario: string
  /** Chip em pílula (local, categoria): fundo e texto. */
  chipFundo: string
  chipTexto: string
  /** Pílula por trás do item ativo da barra de abas. */
  abaAtiva: string
  /** As duas auroras do fundo: coral (nascer do sol) e violeta (noite). */
  auroraCoral: string
  auroraVioleta: string
}

export const ESCURO: Paleta = {
  fundo: '#12102A',
  superficie: '#1C1940',
  superficieElevada: '#25214F',
  texto: '#F5F3FF',
  textoSuave: '#C9C4EC',
  borda: '#7A73B8',
  bordaSuave: '#332E66',
  superficieRealce: '#2C2862',
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
  cartaoVidro: 'rgba(255,255,255,0.07)',
  cartaoVidroBorda: 'rgba(255,255,255,0.14)',
  contornoSecundario: 'rgba(255,255,255,0.3)',
  chipFundo: 'rgba(255,138,101,0.2)',
  chipTexto: '#FFB199',
  abaAtiva: 'rgba(255,138,101,0.2)',
  auroraCoral: 'rgba(255,138,101,0.55)',
  auroraVioleta: 'rgba(124,108,255,0.45)',
}

export const CLARO: Paleta = {
  fundo: '#F7F5FF',
  superficie: '#FFFFFF',
  superficieElevada: '#FFFFFF',
  texto: '#1B1838',
  textoSuave: '#4B4670',
  borda: '#8F89B8',
  bordaSuave: '#E3DFF4',
  superficieRealce: '#EEEBFF',
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
  cartaoVidro: 'rgba(255,255,255,0.72)',
  cartaoVidroBorda: 'rgba(27,24,56,0.08)',
  contornoSecundario: 'rgba(27,24,56,0.3)',
  chipFundo: '#FFE3D9',
  chipTexto: '#8A2E12',
  abaAtiva: 'rgba(255,138,101,0.2)',
  auroraCoral: 'rgba(255,138,101,0.35)',
  auroraVioleta: 'rgba(124,108,255,0.22)',
}

/**
 * Paleta do cartão de destaque (o item principal da tela, como o próximo
 * evento no Início). No tema escuro ele é CLARO (#F5F3FF, como no mockup); no
 * tema claro, o equivalente é o cartão de noite. Tudo que vai dentro dele
 * (texto, selo, botão) usa esta paleta pelo contexto de `useTema`.
 */
export const DESTAQUE_NO_ESCURO: Paleta = {
  ...CLARO,
  fundo: '#F5F3FF',
  superficie: '#F5F3FF',
  superficieElevada: '#FFFFFF',
  superficieRealce: '#EAE6FF',
  texto: '#1B1838',
  textoSuave: '#4B4670',
  destaque: '#8A2E12',
  sucesso: '#136B42',
  cartaoVidro: 'rgba(27,24,56,0.05)',
  cartaoVidroBorda: 'rgba(27,24,56,0.1)',
}

export const DESTAQUE_NO_CLARO: Paleta = {
  ...ESCURO,
  fundo: '#25214F',
  superficie: '#25214F',
  superficieElevada: '#2C2862',
  superficieRealce: '#332E6E',
  chipFundo: 'rgba(255,138,101,0.24)',
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
  // Selos de situação também aparecem direto sobre o fundo (ao vivo, listas).
  ['sucesso', 'fundo', 'texto'],
  ['alerta', 'fundo', 'texto'],
  ['destaque', 'superficieElevada', 'texto'],
  ['primaria', 'fundo', 'interface'],
  ['borda', 'superficie', 'interface'],
  ['foco', 'fundo', 'interface'],
  ['foco', 'superficie', 'interface'],
  // Selos e avisos também aparecem sobre a superfície elevada (cabeçalho, folhas).
  ['sucesso', 'superficieElevada', 'texto'],
  ['alerta', 'superficieElevada', 'texto'],
  ['erro', 'superficieElevada', 'texto'],
  ['foco', 'superficieElevada', 'interface'],
  // Contorno de campo direto sobre o fundo (formulários fora de cartão).
  ['borda', 'fundo', 'interface'],
  // Marca de confirmação na cor da superfície sobre o destaque (caixa marcada, avatar escolhido).
  ['superficie', 'destaque', 'interface'],
  // Ícones e contornos na cor primária sobre o cartão.
  ['primaria', 'superficie', 'interface'],
  // Aba aberta no Android: ícone na cor do fundo sobre a pílula em destaque.
  ['fundo', 'destaque', 'interface'],
  // Linguagem Aurora: botão primário, chip e o que vai sobre os cartões translúcidos
  // (os pares com cor translúcida são compostos no teste, ver `PARES_TRANSLUCIDOS`).
  // Realce (item tocado ou escolhido, moldura de ícone): o que vai por cima continua legível.
  ['texto', 'superficieRealce', 'texto'],
  ['textoSuave', 'superficieRealce', 'texto'],
  ['destaque', 'superficieRealce', 'texto'],
  ['erro', 'superficieRealce', 'texto'],
  ['sucesso', 'superficieRealce', 'texto'],
  // Ícone e contorno de chip com tom de alerta sobre o realce.
  ['alerta', 'superficieRealce', 'interface'],
  ['foco', 'superficieRealce', 'interface'],
]

/**
 * Texto sobre o vidro (cabeçalho, barra de abas): o vidro é translúcido, então
 * o teste compõe `vidroFundo` sobre cada superfície que pode passar por baixo.
 */
export const FUNDOS_SOB_O_VIDRO: readonly (keyof Paleta)[] = [
  'fundo',
  'superficie',
  'superficieRealce',
]
export const TEXTOS_SOBRE_O_VIDRO: readonly (keyof Paleta)[] = ['texto', 'textoSuave', 'destaque']

/**
 * Seleção nunca é sinalizada só por `superficieElevada` contra `superficie`
 * (no claro as duas são brancas): item escolhido usa `superficieRealce` e
 * forma (contorno, barra, marca).
 */
export const PROIBIDO_COMO_SINAL_DE_SELECAO: readonly (keyof Paleta)[] = ['superficieElevada']

/** Cores que a comunidade pode ter (ícone por cima em `corSobre`). A primeira é a padrão. */
export const CORES_DA_COMUNIDADE = [
  { valor: '#5B4BDB', rotulo: 'Índigo' },
  { valor: '#C2410C', rotulo: 'Coral' },
  { valor: '#15803D', rotulo: 'Verde' },
  { valor: '#1D4ED8', rotulo: 'Azul' },
  { valor: '#7E22CE', rotulo: 'Roxo' },
  { valor: '#B45309', rotulo: 'Âmbar' },
] as const

/**
 * Pares cuja cor de fundo é translúcida: o teste compõe o fundo sobre `base`
 * (e a base, se também translúcida, sobre `fundo`) antes de medir.
 */
export const PARES_TRANSLUCIDOS: readonly {
  frente: keyof Paleta
  fundo: keyof Paleta
  base: keyof Paleta
  tipo: 'texto' | 'interface'
}[] = [
  { frente: 'texto', fundo: 'cartaoVidro', base: 'fundo', tipo: 'texto' },
  { frente: 'textoSuave', fundo: 'cartaoVidro', base: 'fundo', tipo: 'texto' },
  { frente: 'destaque', fundo: 'cartaoVidro', base: 'fundo', tipo: 'texto' },
  { frente: 'sucesso', fundo: 'cartaoVidro', base: 'fundo', tipo: 'texto' },
  { frente: 'erro', fundo: 'cartaoVidro', base: 'fundo', tipo: 'texto' },
  { frente: 'alerta', fundo: 'cartaoVidro', base: 'fundo', tipo: 'texto' },
  { frente: 'chipTexto', fundo: 'chipFundo', base: 'fundo', tipo: 'texto' },
  { frente: 'textoSuave', fundo: 'vidroFundo', base: 'fundo', tipo: 'texto' },
  { frente: 'destaque', fundo: 'abaAtiva', base: 'vidroFundo', tipo: 'texto' },
]

/**
 * Geometria das auroras (mockup, artboard de 390 pt): o gradiente vai de
 * `aurora*` no centro a 0 em 70% do raio. A coral fica no canto superior
 * direito, atrás só do cabeçalho; o primeiro cartão começa onde ela já caiu
 * para no máximo `ALFA_DA_AURORA_SOB_CARTOES` do valor de pico.
 */
export const AURORA = {
  coral: { lado: 380, topo: -140, direita: -120 },
  violeta: { lado: 360, topo: 120, esquerda: -160 },
  paradaFinal: 0.7,
} as const
export const ALFA_DA_AURORA_SOB_CARTOES = 0.55
