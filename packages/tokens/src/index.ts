export * from './acesso.ts'
export * from './aurora.ts'
export * from './avatar.ts'
export * from './contraste.ts'
export * from './cores.ts'
export * from './movimento.ts'
export * from './pares.ts'

/**
 * Escala de espaço (seção 2.5), de 2 a 40. As telas usam só os valores de
 * layout (4, 8, 12, 16, 20, 24, 32, 40); os valores finos do mockup (2, 6,
 * 10, 14, 18) ficam dentro dos componentes de `src/ui`. O lint confere.
 */
export const ESPACO = {
  /** Só `src/ui`: ícone e rótulo da aba. */
  e2: 2,
  e4: 4,
  /** Só `src/ui`: padding da pílula, acima do título do destaque, ajuda abaixo do campo. */
  e6: 6,
  e8: 8,
  /** Só `src/ui`: entre botões lado a lado, entre avatar e nome na pílula. */
  e10: 10,
  e12: 12,
  /** Só `src/ui`: abaixo do título do destaque, antes das ações no cartão. */
  e14: 14,
  e16: 16,
  /** Só `src/ui`: padding de cartão. */
  e18: 18,
  e20: 20,
  e24: 24,
  e32: 32,
  e40: 40,
} as const

/** Os valores de `ESPACO` que só os componentes de `src/ui` podem usar. */
export const ESPACOS_INTERNOS = ['e2', 'e6', 'e10', 'e14', 'e18'] as const

/** Grade e ritmo (seção 2.13): os espaços que se repetem em toda tela, com nome de uso. */
export const RITMO = {
  /** Margem lateral de toda tela (M). Na web, o conteúdo tem largura máxima de 720. */
  margemDaTela: ESPACO.e20,
  /** Topo: área segura mais 8. */
  topoDaTela: ESPACO.e8,
  /** Intervalo entre blocos (M). */
  entreSecoes: ESPACO.e16,
  /** Entre dois blocos de campo (rótulo, caixa e apoio): o olho sabe a quem o rótulo pertence (D64). */
  entreCampos: ESPACO.e20,
  /** Antes de um grupo novo (sobrancelha fora de cartão). */
  antesDoGrupo: ESPACO.e24,
  /** Entre a sobrancelha de um grupo e o cartão. */
  rotuloDaSecao: ESPACO.e8,
  /** Entre itens dentro de um bloco (campos, parágrafos). */
  entreItens: ESPACO.e12,
  /** Fim das telas de aba: 24 de fundo, 64 de barra e 32 de folga (M). */
  fimDasAbas: 120,
} as const

/** Alvo de toque mínimo (Apple HIG 44 pt; Material 48 dp: 48 no Android). */
export const ALVO_MINIMO = { ios: 44, android: 48, web: 44 } as const

/** Alturas (seção 2.5). */
export const ALTURA = {
  /** Legado (D64): os botões usam `botao` e o campo usa `campo`. Fica para quadrados de 48 (ícone, célula). */
  controle: 48,
  /** Botão médio, dentro de cartão: 44 no iOS e na web, 48 no Android. */
  controleCompacto: ALVO_MINIMO,
  /** Controles do Ao vivo (3.5.1): a tela é usada sob pressão, os alvos crescem. */
  controleAlto: 56,
  /** Botão só ícone. */
  iconeSo: 44,
  /** Item da barra de abas (M). */
  aba: 48,
  /** Linha de lista. */
  linha: 56,
  /** Linha de duas informações e do check-in (D65). */
  linhaAlta: 72,
  /** Pílula da comunidade (M). */
  pilula: 44,
  /** Pílula de filtro (tonal, D64): 40 visual, com folga de toque vertical de 4 (48 efetivo). */
  filtro: 40,
  chip: 24,
  /**
   * Botão (D64): `grande` em formulário, barra de ação e entrada; `medio` dentro de
   * cartão; `compacto` só em linha de lista (40 visual mais `hitSlop` de 4 = alvo de 48).
   */
  botao: { grande: 56, medio: 48, compacto: 40 },
  /** Caixa de campo de uma linha (D64). */
  campo: 56,
  /**
   * Área de texto (D64): cresce com o conteúdo, de 3 a 8 linhas (16 + linhas x 22 + 16 + 2 de
   * borda); em `leitura` (17/26), de 5 a 10 linhas. Passando do máximo, rola por dentro.
   */
  areaDeTexto: {
    padrao: { linhaMinima: 3, linhaMaxima: 8, linha: 22, min: 100, max: 210 },
    leitura: { linhaMinima: 5, linhaMaxima: 10, linha: 26, min: 164, max: 294 },
  },
  /** Trilho de segmentos e polegar (cápsulas, D64). */
  trilho: 48,
  polegar: 40,
  /** Interruptor com trilho próprio: 52 x 32. */
  interruptorLargura: 52,
  interruptorAltura: 32,
  /** Ladrilho de ícone à esquerda da linha. */
  ladrilho: 32,
  /** Barra de progresso (3.3.4 e 3.5.1). */
  progresso: 6,
} as const

/**
 * Raios (seção 2.6). Regra concêntrica: raio interno = raio externo menos o
 * afastamento. Nenhum outro raio é permitido.
 */
export const RAIO = {
  /** Linha do esqueleto (10 - 4). */
  marca: 6,
  /** Caixa de marcar de 24 (D64). */
  caixa: 8,
  /** Célula do calendário, ladrilho de 32, segmento interno (14 - 4). */
  celula: 10,
  /** Aviso e toast (M). Botão é `pilula` e campo é `campo` (D64: a forma diz a função). */
  controle: 14,
  /** Caixa de campo (D64): retângulo de raio 16 para escrever; cápsula é para agir. */
  campo: 16,
  /** Pílula da aba ativa, linha de resposta com deslizar e toast (D65). */
  abaAtiva: 20,
  /** Mesmo valor de `abaAtiva`, com o nome do uso geral (linha de resposta, toast). */
  medio: 20,
  /** Miolo do cartão do momento: 28 menos a moldura de 1,5 (regra concêntrica). */
  miolo: 26.5,
  /** Cartão de vidro, cartão de destaque, diálogo (M). */
  cartao: 22,
  /** Cartão do momento e topo da folha (D65). */
  barra: 28,
  /** Barra de abas flutuante: a metade da altura de 68 (cápsula, D65). */
  barraFlutuante: 34,
  /** Pílula da comunidade, chip, pílula de filtro, avatar (M). */
  pilula: 999,
} as const

/** Espessuras de borda: 1 em tudo (M); 2 com "Aumentar contraste" e no foco do campo. */
export const BORDA = { fina: 1, contraste: 2, anel: 2 } as const

/** Halo de foco do campo e do botão: 4 pt além do anel de 2 (D64). */
export const HALO_DE_FOCO = 4

/** Lado do avatar em cada uso (seção 2.12.13). */
export const TAMANHO_DO_AVATAR = {
  aba: 24,
  pilula: 32,
  linha: 40,
  /** Linha do check-in (72 pt, D65). */
  checkin: 44,
  comunidade: 56,
  perfil: 72,
} as const

/** Tamanho das iniciais de cada avatar: 40% do lado (Bricolage 800). */
export const INICIAIS_DO_AVATAR: Readonly<Record<keyof typeof TAMANHO_DO_AVATAR, number>> = {
  aba: 10,
  pilula: 13,
  linha: 16,
  checkin: 18,
  comunidade: 22,
  perfil: 28,
}

/** Barra de abas flutuante (direção A, D65): cápsula de 68, itens de largura igual. */
export const BARRA_DE_ABAS = {
  margemLateral: 16,
  /** Distância do fim: o maior entre (área segura de baixo - 10) e 12; 24 no iPhone com Face ID. */
  descontoDaAreaSegura: 10,
  distanciaMinima: 12,
  /** Entre a borda e a pílula ativa. */
  preenchimento: 6,
  /** Altura total da cápsula, borda incluída. */
  altura: 68,
  larguraMinimaDoItem: 58,
  tamanhoDoIcone: 22,
  /** A pílula luminosa: anel interno de 1 pt e luz de 22 pt de espalhamento. */
  luzDaPilula: 22,
} as const

/**
 * Tipografia. Títulos em Bricolage Grotesque (personalidade), texto em Inter
 * (legibilidade). Tamanhos em pontos; respeitam o tamanho de fonte do sistema.
 */
export const FONTES = {
  titulo: 'BricolageGrotesque',
  texto: 'Inter',
} as const

export interface PapelTipografico {
  familia: keyof typeof FONTES
  peso: '400' | '500' | '600' | '800'
  tamanho: number
  altura: number
  /** Espaçamento entre letras, em pt. */
  espacamento: number
  /** Maiúsculas por estilo (`textTransform`), nunca digitadas. */
  maiusculas: boolean
  /** Teto de escala (`maxFontSizeMultiplier`); `null` = sem teto. */
  teto: number | null
  /** Algarismos de largura fixa. */
  tabular: boolean
  /** Nível de cabeçalho (`aria-level`) quando o papel é título. */
  nivel: 1 | 2 | 3 | null
}

function papel(
  familia: PapelTipografico['familia'],
  peso: PapelTipografico['peso'],
  tamanho: number,
  altura: number,
  extra: Partial<Omit<PapelTipografico, 'familia' | 'peso' | 'tamanho' | 'altura'>> = {},
): PapelTipografico {
  return {
    familia,
    peso,
    tamanho,
    altura,
    espacamento: 0,
    maiusculas: false,
    teto: null,
    tabular: false,
    nivel: null,
    ...extra,
  }
}

/** Papéis tipográficos (seção 2.4). Nenhum tamanho fora desta tabela. */
export const TIPO = {
  /** Saudação do Início; título das 5 raízes de aba. */
  display: papel('titulo', '800', 34, 38, { espacamento: -0.5, teto: 1.6, nivel: 1 }),
  /** Título das telas de pilha e das folhas grandes. */
  tituloTela: papel('titulo', '800', 28, 32, { espacamento: -0.3, teto: 1.8, nivel: 1 }),
  /** Título do cartão de destaque, mês da agenda, nome no Perfil, título de diálogo. */
  tituloCartao: papel('titulo', '800', 24, 28, { espacamento: -0.2, teto: 2, nivel: 2 }),
  /** Título do cartão do momento (D65): um degrau acima do `tituloCartao`. */
  tituloMomento: papel('titulo', '800', 26, 30, { espacamento: -0.2, teto: 2, nivel: 2 }),
  /** Números de relatório. */
  numero: papel('titulo', '800', 28, 32, { teto: 1.6, tabular: true }),
  /** Contador grande do check-in ("9 de 12", D65). */
  contador: papel('titulo', '800', 40, 40, { espacamento: -0.5, teto: 1.6, tabular: true }),
  /** Código de entrada, dia do bloco de data e campo de código: algarismos largos (tabulares). */
  codigo: papel('titulo', '800', 20, 24, { teto: 1.6, tabular: true }),
  /** Ao vivo. */
  cronometro: papel('titulo', '800', 64, 68, { espacamento: -1, teto: 1.4, tabular: true }),
  /** Versículo, pedido de oração, descrição de evento, corpo de aviso. */
  leitura: papel('texto', '400', 17, 26),
  /** Título de linha, nome de pessoa, título de estado vazio e de aviso. */
  tituloItem: papel('texto', '600', 16, 22),
  /** Texto de interface, parágrafo, descrição de estado vazio (16/24 na direção A, D65). */
  corpo: papel('texto', '400', 16, 24),
  /**
   * Botões, pílula da comunidade, links terciários, segmento ativo (o inativo é 500). 16/20 (D64):
   * a Inter já vem calibrada em 16, e espaçar mais abre demais. Nunca em maiúsculas.
   */
  botao: papel('texto', '600', 16, 20, { teto: 2 }),
  /** Texto digitado no campo (D64). 16 evita o zoom automático do Safari ao focar. */
  campo: papel('texto', '400', 16, 22, { teto: 2 }),
  /** Linhas compactas ("16:05 Louvor") e pílulas de filtro (500). */
  lista: papel('texto', '400', 14, 20),
  /**
   * Rótulo de campo, meta forte ("Sábado · 16:00 · 60 min"). 15, não 13: é
   * informação útil, e quem tem 40 a 70 anos lia mal em 13 (auditoria U-09).
   */
  rotulo: papel('texto', '600', 15, 20),
  /**
   * Data, hora, local e a descrição de uma linha de lista: o que informa.
   * Mínimo de 15, como o rótulo (U-09); a `legenda` fica para o dispensável.
   */
  meta: papel('texto', '400', 15, 20),
  /**
   * Ajuda, contador, referência, status de sincronização. 14, não 13 (D62,
   * auditoria de 21/11/2026, A2): a referência do versículo e a ajuda de campo
   * também informam, e 13 pt cansa quem tem 45 anos ou mais.
   */
  legenda: papel('texto', '400', 14, 20),
  /** Etiqueta de seção no cartão e acima de grupos (13, não 12: U-09). */
  sobrancelha: papel('texto', '600', 13, 18, {
    espacamento: 1,
    maiusculas: true,
    teto: 1.6,
    nivel: 3,
  }),
  /** Chip de estado: 13, não 12 (D62). A altura de 24 comporta: 16 de linha e 4 de padding em cima e embaixo. */
  chip: papel('texto', '600', 13, 16, { teto: 1.6 }),
  /**
   * Rótulos da barra de abas: 600 na ativa, 500 nas outras. Teto de 1,6 (era
   * 1,3): quando o rótulo não cabe no item, a barra mostra só os ícones, com o
   * rótulo no leitor de tela e no visualizador de conteúdo grande do iOS.
   */
  aba: papel('texto', '500', 11, 14, { teto: 1.6 }),
} as const satisfies Record<string, PapelTipografico>

export type NomeDoPapel = keyof typeof TIPO

/** Elevação por tema (seção 2.7), como `boxShadow`. `none`: sem sombra. */
export const ELEVACAO = {
  escuro: {
    nenhuma: 'none',
    // No escuro a borda faz o papel da sombra (fidelidade ao mockup).
    cartao: 'none',
    destaque: 'none',
    flutuante: '0px 12px 32px rgba(0,0,0,0.40)',
    folha: '0px -8px 40px rgba(0,0,0,0.50)',
    // Brilho coral do botão primário (D64) e o realce de 1 pt no topo dele.
    botao: '0px 6px 16px rgba(255,138,101,0.28)',
    realceDoBotao: 'inset 0px 1px 0px rgba(255,255,255,0.30)',
    // Cartão do momento: queda funda mais um brilho coral (D65).
    momento: '0px 24px 48px -14px rgba(8,4,40,0.70), 0px 0px 70px -22px rgba(255,138,101,0.38)',
  },
  claro: {
    nenhuma: 'none',
    cartao: '0px 1px 2px rgba(27,24,56,0.06), 0px 8px 20px rgba(27,24,56,0.07)',
    destaque: '0px 10px 30px rgba(31,27,77,0.28)',
    flutuante: '0px 12px 32px rgba(27,24,56,0.14)',
    folha: '0px -8px 40px rgba(27,24,56,0.18)',
    botao: '0px 6px 14px rgba(194,73,31,0.30)',
    realceDoBotao: 'inset 0px 1px 0px rgba(255,255,255,0.22)',
    momento: '0px 20px 44px -14px rgba(75,63,196,0.30), 0px 2px 6px rgba(27,24,56,0.06)',
  },
} as const

export type NivelDeElevacao = keyof typeof ELEVACAO.claro

/**
 * Movimento (seção 2.9). Não há animação decorativa contínua. Com "Reduzir
 * movimento": toque sem escala, `aparecer` só dissolve em 120, esqueleto estático.
 */
export const DURACAO = {
  /** Cor de pressionado e escala 0,98. */
  toque: 120,
  /** Cabeçalho compacto e toast (sobe 8 e aparece). */
  aparecer: 200,
  /** `aparecer` com "Reduzir movimento": só dissolve. */
  aparecerReduzido: 120,
  /** Pulso do esqueleto, ida e volta. */
  pulso: 1200,
  /** O esqueleto só aparece depois disto, para não piscar em carga rápida. */
  atrasoDoEsqueleto: 300,
} as const
