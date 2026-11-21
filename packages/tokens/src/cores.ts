/**
 * Cores do Uni Jovem, direção visual A "Aurora" (noite e nascer do sol).
 * Valores da seção 2.2 da especificação de design (`docs/design`): (M) copiado
 * do mockup aprovado, (D) derivado dele. As telas usam só os nomes semânticos.
 *
 * Regras: todo par texto/fundo declarado em `paresObrigatorios` passa AA
 * (teste `contraste.test.ts`); cor nunca é o único sinal (ícone ou texto junto).
 */

export interface Paleta {
  /** Fundo da tela. */
  fundo: string
  /** Cartão de vidro opaco (escuro: branco a 7% composto sobre o fundo). */
  superficie: string
  /**
   * Cartão de vidro translúcido (D32: tinta do mockup, sem desfoque). Com
   * "Reduzir transparência" ou "Aumentar contraste", o cartão usa `superficie`.
   */
  superficieTranslucida: string
  /** Borda do cartão de vidro (decorativa). */
  superficieBorda: string
  /** Folha, diálogo e menu (fallback opaco). */
  superficieElevada: string
  /** Caixa do campo: mais funda que o cartão, para o campo existir sem depender da borda. */
  campoFundo: string
  /** Borda do campo (3:1 contra o cartão e contra o próprio fundo do campo). */
  campoBorda: string
  texto: string
  /** Meta, ajuda, rótulo de campo, aba inativa (sempre 4,5:1 ou mais). */
  textoSuave: string
  /** Sobrancelha, link, aba ativa, botão terciário. */
  destaque: string
  /** Botão primário, check, interruptor ligado. */
  primaria: string
  primariaPressionada: string
  sobrePrimaria: string
  /** Borda do botão secundário. */
  contorno: string
  /** Fundo da pílula da comunidade, do botão só ícone e do trilho de segmentos. */
  tonal: string
  /** Tonal com "Reduzir transparência". */
  tonalOpaco: string
  /** Borda da pílula e da pílula de filtro inativa. */
  tonalBorda: string
  /** Camada de toque em linhas e secundários. */
  pressionado: string
  /** Linha entre itens de lista (decorativa). */
  separador: string
  esqueleto: string
  /** Atrás de diálogos (web). */
  veu: string
  sucesso: string
  sucessoFundo: string
  alerta: string
  alertaFundo: string
  erro: string
  erroFundo: string
  /** Botão destrutivo cheio. */
  erroCheio: string
  sobreErro: string
  info: string
  infoFundo: string
  /** Chip quente (local, "Ao vivo", "Fixado") e pílula de filtro ativa. */
  quenteFundo: string
  /** Chip neutro ("Rascunho", "Anônima"). */
  neutroFundo: string
  /** Anel de foco. */
  foco: string
  /** Pílula por trás do item ativo da barra de abas. */
  abaAtivaFundo: string
}

export type NomeDoTema = 'escuro' | 'claro'

/** Tema escuro (Aurora noite). */
export const ESCURO: Paleta = {
  fundo: '#12102A',
  superficie: '#232139',
  superficieTranslucida: 'rgba(255,255,255,0.07)',
  superficieBorda: 'rgba(255,255,255,0.14)',
  superficieElevada: '#2B2848',
  campoFundo: '#1A1833',
  campoBorda: '#736DA8',
  texto: '#F5F3FF',
  textoSuave: '#C9C4EC',
  destaque: '#FFB199',
  primaria: '#FF8A65',
  primariaPressionada: '#F0764F',
  sobrePrimaria: '#1A0F0A',
  // Mockup: 30%; 36% para a borda do secundário passar 3:1 contra o cartão (1.11, item 4).
  contorno: 'rgba(255,255,255,0.36)',
  tonal: 'rgba(255,255,255,0.08)',
  tonalOpaco: '#25233B',
  tonalBorda: 'rgba(255,255,255,0.18)',
  pressionado: 'rgba(255,255,255,0.08)',
  separador: 'rgba(255,255,255,0.08)',
  esqueleto: 'rgba(255,255,255,0.06)',
  veu: 'rgba(8,6,24,0.60)',
  sucesso: '#7FE0B0',
  sucessoFundo: 'rgba(127,224,176,0.16)',
  alerta: '#FFD166',
  alertaFundo: 'rgba(255,209,102,0.16)',
  erro: '#FF8A8A',
  erroFundo: 'rgba(255,138,138,0.16)',
  erroCheio: '#FF8A8A',
  sobreErro: '#2A0A0A',
  info: '#B3A8FF',
  infoFundo: 'rgba(157,143,255,0.16)',
  quenteFundo: 'rgba(255,177,153,0.16)',
  neutroFundo: 'rgba(255,255,255,0.10)',
  foco: '#FFD166',
  abaAtivaFundo: 'rgba(255,138,101,0.20)',
}

/** Tema claro (Aurora manhã), derivado do escuro. */
export const CLARO: Paleta = {
  fundo: '#F7F5FF',
  superficie: '#FFFFFF',
  // No claro o cartão é branco opaco com sombra: não há tinta translúcida.
  superficieTranslucida: '#FFFFFF',
  superficieBorda: 'rgba(27,24,56,0.08)',
  superficieElevada: '#FFFFFF',
  campoFundo: '#FFFFFF',
  campoBorda: '#857FAF',
  texto: '#1B1838',
  textoSuave: '#4B4670',
  destaque: '#8A2E12',
  primaria: '#C2491F',
  primariaPressionada: '#A93D18',
  sobrePrimaria: '#FFFFFF',
  contorno: '#857FAF',
  tonal: 'rgba(27,24,56,0.05)',
  tonalOpaco: '#ECEAF5',
  tonalBorda: 'rgba(27,24,56,0.12)',
  pressionado: 'rgba(27,24,56,0.06)',
  separador: 'rgba(27,24,56,0.08)',
  esqueleto: '#ECE9F8',
  veu: 'rgba(27,24,56,0.40)',
  sucesso: '#16794B',
  sucessoFundo: '#E3F4EA',
  alerta: '#8A5A00',
  alertaFundo: '#FFF1D6',
  erro: '#B42318',
  erroFundo: '#FDE4E1',
  erroCheio: '#B42318',
  sobreErro: '#FFFFFF',
  info: '#4B3FC4',
  infoFundo: '#ECEAFD',
  quenteFundo: '#FFE3D9',
  neutroFundo: '#EEEBFA',
  foco: '#4B3FC4',
  abaAtivaFundo: 'rgba(194,73,31,0.12)',
}

/**
 * Inverso do escuro: o cartão de destaque claro e o toast. Os valores são os do
 * mockup e, onde ele não define, os do tema claro.
 */
export const INVERSO_DO_ESCURO: Paleta = {
  ...CLARO,
  fundo: '#F5F3FF',
  superficie: '#F5F3FF',
  superficieTranslucida: '#F5F3FF',
  texto: '#1B1838',
  textoSuave: '#4B4670',
  destaque: '#8A2E12',
  quenteFundo: '#FFE3D9',
  primaria: '#C2491F',
  sobrePrimaria: '#FFFFFF',
  contorno: '#857FAF',
  separador: 'rgba(27,24,56,0.10)',
}

/** Inverso do claro: índigo profundo, "a noite dentro do dia". */
export const INVERSO_DO_CLARO: Paleta = {
  ...ESCURO,
  fundo: '#1F1B4D',
  superficie: '#1F1B4D',
  superficieTranslucida: '#1F1B4D',
  texto: '#F5F3FF',
  textoSuave: '#C9C4EC',
  destaque: '#FFB199',
  quenteFundo: 'rgba(255,177,153,0.18)',
  primaria: '#FF8A65',
  sobrePrimaria: '#1A0F0A',
  contorno: 'rgba(255,255,255,0.36)',
  separador: 'rgba(255,255,255,0.10)',
}

/** Paleta base e inversa de cada tema. O inverso se aplica por `ProvedorDeTemaInverso`. */
export const TEMAS: Readonly<Record<NomeDoTema, { base: Paleta; inverso: Paleta }>> = {
  escuro: { base: ESCURO, inverso: INVERSO_DO_ESCURO },
  claro: { base: CLARO, inverso: INVERSO_DO_CLARO },
}

/** Cores que a comunidade pode ter (iniciais e ícone por cima em branco). A primeira é a padrão. */
export const CORES_DA_COMUNIDADE = [
  { valor: '#5B4BDB', rotulo: 'Índigo' },
  { valor: '#C2410C', rotulo: 'Coral' },
  { valor: '#15803D', rotulo: 'Verde' },
  { valor: '#1D4ED8', rotulo: 'Azul' },
  { valor: '#7E22CE', rotulo: 'Roxo' },
  { valor: '#B45309', rotulo: 'Âmbar' },
] as const

/**
 * Botão "Continuar com o Google": cores fixas da marca (não seguem o tema),
 * como pede a diretriz do Google para o botão sobre fundo escuro.
 */
export const MARCA_DO_GOOGLE = {
  fundo: '#FFFFFF',
  texto: '#1F1F1F',
  borda: '#747775',
  pressionado: '#F2F2F2',
  textoInativo: '#767676',
} as const

/**
 * Botão "Continuar com a Apple": preto com texto e logotipo brancos no tema
 * claro, branco com preto no escuro (as duas versões oficiais da marca). Cores
 * fixas, fora da paleta do tema.
 */
export const MARCA_DA_APPLE = {
  claro: { fundo: '#000000', texto: '#FFFFFF', pressionado: '#2A2A2A', textoInativo: '#A0A0A0' },
  escuro: { fundo: '#FFFFFF', texto: '#000000', pressionado: '#E6E6E6', textoInativo: '#6B6B6B' },
} as const

/** Iniciais sobre as cores de comunidade e de pessoa: sempre branco (todas passam 4,5:1). */
export const INICIAIS_SOBRE_COR = '#FFFFFF'

/**
 * Vidro: só no que flutua (barra de abas, cabeçalho compacto, barra de ação,
 * folha). Com "Reduzir transparência" vira `opaco` com a mesma borda; com
 * "Aumentar contraste", opaco com borda de 2 na cor do texto.
 */
export const VIDRO = {
  barra: {
    escuro: { fundo: 'rgba(30,27,62,0.86)', borda: 'rgba(255,255,255,0.16)', opaco: '#1E1B3E' },
    claro: { fundo: 'rgba(255,255,255,0.80)', borda: 'rgba(27,24,56,0.10)', opaco: '#FFFFFF' },
    desfoque: 20,
  },
  folha: {
    escuro: { fundo: 'rgba(43,40,72,0.92)', borda: 'rgba(255,255,255,0.16)', opaco: '#2B2848' },
    claro: { fundo: 'rgba(255,255,255,0.92)', borda: 'rgba(27,24,56,0.10)', opaco: '#FFFFFF' },
    desfoque: 30,
  },
  /**
   * Cartões de conteúdo: tinta translúcida do mockup (D32). O que tem fundo
   * próprio dentro dele (chip, aviso, botão secundário) é composto sobre a
   * superfície opaca, para o contraste não depender do ponto da Aurora.
   */
  conteudo: 'translucido',
} as const
