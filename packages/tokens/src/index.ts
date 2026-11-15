export * from './aurora.ts'
export * from './avatar.ts'
export * from './contraste.ts'
export * from './cores.ts'
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
  /** Botão grande e campo. */
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
  /** Pílula da comunidade (M). */
  pilula: 44,
  /** Pílula de filtro: 36 visual, com folga de toque vertical de 4 (44 efetivo). */
  filtro: 36,
  chip: 24,
  /** Campo multilinha. */
  multilinha: 120,
  /** Multilinha de texto longo em `leitura` (pedido de oração, 3.7.1). */
  multilinhaLonga: 160,
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
  /** Caixa de marcar e linha do esqueleto (10 - 4). */
  marca: 6,
  /** Célula do calendário, ladrilho de 32, segmento interno (14 - 4). */
  celula: 10,
  /** Botão, campo, trilho de segmentos, aviso, toast (M). */
  controle: 14,
  /** Pílula da aba ativa (28 - 8, M). */
  abaAtiva: 20,
  /** Cartão de vidro, cartão de destaque, diálogo (M). */
  cartao: 22,
  /** Barra de abas e topo da folha (M). */
  barra: 28,
  /** Pílula da comunidade, chip, pílula de filtro, avatar (M). */
  pilula: 999,
} as const

/** Espessuras de borda: 1 em tudo (M); 2 com "Aumentar contraste" e no foco do campo. */
export const BORDA = { fina: 1, contraste: 2 } as const

/** Lado do avatar em cada uso (seção 2.12.13). */
export const TAMANHO_DO_AVATAR = {
  aba: 24,
  pilula: 32,
  linha: 40,
  comunidade: 56,
  perfil: 72,
} as const

/** Tamanho das iniciais de cada avatar: 40% do lado (Bricolage 800). */
export const INICIAIS_DO_AVATAR: Readonly<Record<keyof typeof TAMANHO_DO_AVATAR, number>> = {
  aba: 10,
  pilula: 13,
  linha: 16,
  comunidade: 22,
  perfil: 28,
}

/** Barra de abas flutuante (seção 2.12.17, M). */
export const BARRA_DE_ABAS = {
  margemLateral: 16,
  /** Distância do fim: o maior entre (área segura de baixo - 10) e 12; 24 no iPhone com Face ID. */
  descontoDaAreaSegura: 10,
  distanciaMinima: 12,
  preenchimento: 8,
  larguraMinimaDoItem: 58,
  tamanhoDoIcone: 22,
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
  /** Números de relatório e contador do check-in. */
  numero: papel('titulo', '800', 28, 32, { teto: 1.6, tabular: true }),
  /** Código de entrada, dia do bloco de data e campo de código: algarismos largos (tabulares). */
  codigo: papel('titulo', '800', 20, 24, { teto: 1.6, tabular: true }),
  /** Ao vivo. */
  cronometro: papel('titulo', '800', 64, 68, { espacamento: -1, teto: 1.4, tabular: true }),
  /** Versículo, pedido de oração, descrição de evento, corpo de aviso. */
  leitura: papel('texto', '400', 17, 26),
  /** Título de linha, nome de pessoa, título de estado vazio e de aviso. */
  tituloItem: papel('texto', '600', 16, 22),
  /** Texto de interface, descrição de estado vazio, texto de toast. */
  corpo: papel('texto', '400', 15, 22),
  /** Botões, pílula da comunidade, links terciários, segmento ativo (o inativo é 500). */
  botao: papel('texto', '600', 15, 20, { teto: 2 }),
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
  /** Ajuda, contador, referência, status de sincronização: o que dá para pular. */
  legenda: papel('texto', '400', 13, 18),
  /** Etiqueta de seção no cartão e acima de grupos (13, não 12: U-09). */
  sobrancelha: papel('texto', '600', 13, 18, {
    espacamento: 1,
    maiusculas: true,
    teto: 1.6,
    nivel: 3,
  }),
  /** Chip de estado. */
  chip: papel('texto', '600', 12, 16, { teto: 1.6 }),
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
  },
  claro: {
    nenhuma: 'none',
    cartao: '0px 1px 2px rgba(27,24,56,0.06), 0px 6px 16px rgba(27,24,56,0.06)',
    destaque: '0px 10px 30px rgba(31,27,77,0.28)',
    flutuante: '0px 12px 32px rgba(27,24,56,0.14)',
    folha: '0px -8px 40px rgba(27,24,56,0.18)',
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
