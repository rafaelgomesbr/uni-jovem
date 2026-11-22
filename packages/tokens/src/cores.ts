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
  /**
   * Caixa do campo (D64): opaca e um degrau ACIMA do cartão (no escuro, mais clara que ele;
   * antes era um poço mais escuro), igual dentro e fora do cartão.
   */
  campoFundo: string
  /** Borda do campo (3:1 contra o cartão, a folha, o fundo e o próprio fundo do campo). */
  campoBorda: string
  /** Texto de exemplo do campo (placeholder): mais apagado que o valor, 4,5:1 sobre `campoFundo`. */
  campoExemplo: string
  /** Fundo do campo desabilitado (sem borda). */
  campoDesabilitado: string
  texto: string
  /** Meta, ajuda, rótulo de campo, aba inativa (sempre 4,5:1 ou mais). */
  textoSuave: string
  /** Sobrancelha, link, aba ativa, botão terciário. */
  destaque: string
  /** Botão primário, check, interruptor ligado. */
  primaria: string
  primariaPressionada: string
  /** Topo do degradê do botão primário (D64). */
  primariaTopo: string
  /** Base do degradê do botão primário (igual à `primaria` no escuro). */
  primariaBase: string
  sobrePrimaria: string
  /** Contorno de elementos de interface que ainda têm borda (3:1). O botão secundário não tem mais borda (D64). */
  contorno: string
  /** Fundo do botão secundário e do botão de ícone (D64): tom violeta, sem borda. */
  botaoTonal: string
  /** Botão secundário pressionado ou com o ponteiro em cima. */
  botaoTonalPressionado: string
  /** `botaoTonal` com "Reduzir transparência". */
  botaoTonalOpaco: string
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
  /** Anel de foco: coral em tudo (D64), nunca amarelo. */
  foco: string
  /** Halo de 4 pt ao redor do anel de foco do campo e do botão. */
  focoHalo: string
  /** Pílula por trás do item ativo da barra de abas. */
  abaAtivaFundo: string
  /** Anel interno e luz de 22 pt da pílula da aba ativa (direção A, D65). */
  abaAtivaBrilho: string
  /** Base do degradê vertical do fundo (do meio da tela para baixo). */
  fundoProfundo: string
  /** Fio de luz no topo do cartão de tinta (degradê de 42% da altura); transparente no claro. */
  realceDoCartao: string
  /** Degradê de 160 graus do cartão do momento (sempre opaco). */
  momentoTopo: string
  momentoBase: string
  /** Moldura de 1,5 pt do cartão do momento, 140 graus (decorativa). */
  momentoBorda1: string
  momentoBorda2: string
  momentoBorda3: string
  /** Fundos revelados ao deslizar uma convocação (sempre com a palavra e o ícone). */
  aceitarFundo: string
  recusarFundo: string
  /** Toast: mais claro que o fundo e o cartão no escuro; índigo no claro. */
  toastFundo: string
  /** Cabeçalho depois de 6 pt de rolagem. */
  vidroCabecalho: string
  /** Luz de base que sobe com o relógio (elipse na base da tela). */
  brilhoHorizonte: string
  /** Luz de base do estado "terminou". */
  brilhoPoente: string
  /** Fundo do Modo palco: escuro nos dois temas. */
  palco: string
}

export type NomeDoTema = 'escuro' | 'claro'

/** Tema escuro (Aurora noite). */
export const ESCURO: Paleta = {
  fundo: '#12102A',
  superficie: '#1F1B44',
  superficieTranslucida: 'rgba(38,33,82,0.64)',
  superficieBorda: 'rgba(255,255,255,0.14)',
  superficieElevada: '#262250',
  campoFundo: '#322F4C',
  campoBorda: '#7C77A8',
  campoExemplo: '#A7A2D0',
  campoDesabilitado: 'rgba(255,255,255,0.04)',
  texto: '#F5F3FF',
  textoSuave: '#C9C4EC',
  destaque: '#FFB199',
  primaria: '#FF8A65',
  primariaPressionada: '#F0764F',
  primariaTopo: '#FF9A78',
  primariaBase: '#FF8A65',
  sobrePrimaria: '#1A0F0A',
  // Mockup: 30%; 36% para a borda do secundário passar 3:1 contra o cartão (1.11, item 4).
  contorno: 'rgba(255,255,255,0.36)',
  botaoTonal: 'rgba(179,168,255,0.16)',
  botaoTonalPressionado: 'rgba(179,168,255,0.26)',
  botaoTonalOpaco: '#373262',
  tonal: 'rgba(255,255,255,0.08)',
  tonalOpaco: '#312D53',
  tonalBorda: 'rgba(255,255,255,0.18)',
  pressionado: 'rgba(255,255,255,0.08)',
  separador: 'rgba(255,255,255,0.09)',
  esqueleto: 'rgba(255,255,255,0.08)',
  veu: 'rgba(8,6,24,0.62)',
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
  foco: '#FF8A65',
  focoHalo: 'rgba(255,138,101,0.22)',
  abaAtivaFundo: 'rgba(255,138,101,0.20)',
  abaAtivaBrilho: 'rgba(255,138,101,0.45)',
  fundoProfundo: '#0C0A20',
  realceDoCartao: 'rgba(255,255,255,0.06)',
  momentoTopo: '#342C6E',
  momentoBase: '#221D4E',
  momentoBorda1: '#FF8A65',
  momentoBorda2: '#9D8FFF',
  momentoBorda3: '#5B4BDB',
  aceitarFundo: '#17513B',
  recusarFundo: '#432D4F',
  toastFundo: '#2E2A66',
  vidroCabecalho: 'rgba(18,16,42,0.78)',
  brilhoHorizonte: 'rgba(255,160,110,0.40)',
  brilhoPoente: 'rgba(214,80,150,0.38)',
  palco: '#07061A',
}

/** Tema claro (Aurora manhã), derivado do escuro. */
export const CLARO: Paleta = {
  fundo: '#F7F5FF',
  superficie: '#FFFFFF',
  // No claro o cartão é branco a 80% com sombra (direção A, D65); sem realce de topo.
  superficieTranslucida: 'rgba(255,255,255,0.80)',
  superficieBorda: 'rgba(27,24,56,0.09)',
  superficieElevada: '#FFFFFF',
  campoFundo: '#F3F1FA',
  campoBorda: '#857FAF',
  campoExemplo: '#6B6690',
  campoDesabilitado: 'rgba(27,24,56,0.04)',
  texto: '#1B1838',
  textoSuave: '#4B4670',
  destaque: '#8A2E12',
  primaria: '#C2491F',
  primariaPressionada: '#A93D18',
  primariaTopo: '#C64B20',
  primariaBase: '#B5431B',
  sobrePrimaria: '#FFFFFF',
  contorno: '#857FAF',
  botaoTonal: 'rgba(75,63,196,0.12)',
  botaoTonalPressionado: 'rgba(75,63,196,0.20)',
  botaoTonalOpaco: '#E9E8F8',
  tonal: 'rgba(27,24,56,0.05)',
  tonalOpaco: '#ECEAF5',
  tonalBorda: 'rgba(27,24,56,0.12)',
  pressionado: 'rgba(27,24,56,0.06)',
  separador: 'rgba(27,24,56,0.09)',
  esqueleto: '#ECE9F8',
  veu: 'rgba(27,24,56,0.42)',
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
  foco: '#C2491F',
  focoHalo: 'rgba(194,73,31,0.18)',
  abaAtivaFundo: 'rgba(194,73,31,0.12)',
  abaAtivaBrilho: 'rgba(194,73,31,0.25)',
  fundoProfundo: '#EFEBFF',
  realceDoCartao: 'rgba(255,255,255,0)',
  momentoTopo: '#FFFFFF',
  momentoBase: '#F1ECFF',
  momentoBorda1: '#C2491F',
  momentoBorda2: '#7C6CFF',
  momentoBorda3: '#4B3FC4',
  aceitarFundo: '#E3F4EA',
  recusarFundo: '#FDE4E1',
  toastFundo: '#1F1B4D',
  vidroCabecalho: 'rgba(247,245,255,0.82)',
  brilhoHorizonte: 'rgba(255,170,120,0.30)',
  brilhoPoente: 'rgba(214,80,150,0.20)',
  palco: '#07061A',
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
    escuro: { fundo: 'rgba(24,21,58,0.78)', borda: 'rgba(255,255,255,0.16)', opaco: '#1B1840' },
    claro: { fundo: 'rgba(255,255,255,0.82)', borda: 'rgba(27,24,56,0.10)', opaco: '#FFFFFF' },
    desfoque: 24,
  },
  /** Cabeçalho depois de 6 pt de rolagem (a borda de baixo é o separador). */
  cabecalho: {
    escuro: { fundo: 'rgba(18,16,42,0.78)', borda: 'rgba(255,255,255,0.09)', opaco: '#12102A' },
    claro: { fundo: 'rgba(247,245,255,0.82)', borda: 'rgba(27,24,56,0.09)', opaco: '#F7F5FF' },
    desfoque: 20,
  },
  folha: {
    escuro: { fundo: 'rgba(38,34,80,0.92)', borda: 'rgba(255,255,255,0.16)', opaco: '#262250' },
    claro: { fundo: 'rgba(255,255,255,0.94)', borda: 'rgba(27,24,56,0.10)', opaco: '#FFFFFF' },
    desfoque: 30,
  },
  /**
   * Cartões de conteúdo: tinta translúcida do mockup (D32). O que tem fundo
   * próprio dentro dele (chip, aviso, botão secundário) é composto sobre a
   * superfície opaca, para o contraste não depender do ponto da Aurora.
   */
  conteudo: 'translucido',
} as const

/**
 * Toast (direção A): sempre escuro, nos dois temas, com texto claro. O fundo vem
 * de `Paleta.toastFundo`; o texto e o "Desfazer" são fixos.
 */
export const TOAST = {
  texto: '#F5F3FF',
  textoSuave: '#C9C4EC',
  acao: '#FFB199',
} as const
