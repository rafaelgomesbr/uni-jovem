export * from './avatar.ts'
export * from './contraste.ts'
export * from './cores.ts'

/** Escala de espaço em múltiplos de 4. */
export const ESPACO = {
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20,
  x6: 24,
  x8: 32,
  x10: 40,
  x12: 48,
} as const

/**
 * Ritmo do layout: os espaços que se repetem em toda tela, com nome de uso.
 * Quem monta tela usa estes; a escala crua (`ESPACO`) fica para ajustes finos.
 */
export const RITMO = {
  /** Margem lateral da tela no celular. */
  margemDaTela: ESPACO.x5,
  /** Margem lateral a partir de `LARGURA_DE_MARGEM_LARGA` (tablet, web). */
  margemDaTelaLarga: ESPACO.x8,
  /** Espaço acima do conteúdo, abaixo da área segura. */
  topoDaTela: ESPACO.x2,
  /** Do título da tela ao primeiro bloco. */
  depoisDoTitulo: ESPACO.x2,
  /** Entre seções (cartões, grupos) de uma tela (mockup: 16). */
  entreSecoes: ESPACO.x4,
  /** Entre o rótulo de uma seção e o conteúdo dela. */
  rotuloDaSecao: ESPACO.x2,
  /** Entre itens dentro de um cartão (campos, parágrafos, botões). */
  entreItens: ESPACO.x3,
  /** Preenchimento interno do cartão (mockup: 18). */
  dentroDoCartao: 18,
  /** Entre botões lado a lado ou empilhados. */
  entreBotoes: ESPACO.x2,
} as const

/** A partir desta largura de janela, a margem da tela cresce para `margemDaTelaLarga`. */
export const LARGURA_DE_MARGEM_LARGA = 600

export const RAIO = {
  pequeno: 10,
  medio: 14,
  /** Cartões e folhas. */
  grande: 22,
  pilula: 999,
} as const

/**
 * Alturas mínimas. Todo controle tocável respeita `ALVO_MINIMO`; linhas de lista
 * e botões ficam um pouco acima para o toque ficar confortável, não só possível.
 */
export const ALTURA = {
  linha: 52,
  linhaComDescricao: 64,
  botao: 48,
  campo: 48,
  /** Moldura quadrada do ícone que abre uma linha de lista. */
  molduraDoIcone: 36,
} as const

/** Lado do avatar em cada tamanho (P em listas densas, M em listas, G no Perfil). */
export const TAMANHO_DO_AVATAR = { P: 32, M: 44, G: 88 } as const

/** Barra de abas flutuante (mockup): medidas e o espaço que ela tira do fim da tela. */
export const BARRA_DE_ABAS = {
  margemLateral: 16,
  distanciaDoFim: 24,
  preenchimento: 8,
  raio: 28,
  alturaDoItem: 48,
  larguraMinimaDoItem: 58,
  raioDoItem: 20,
  tamanhoDoIcone: 22,
  ladoDoAvatar: 26,
} as const

/** Alvo de toque mínimo (Apple HIG 44 pt; Material 48 dp: usamos 48 no Android). */
export const ALVO_MINIMO = { ios: 44, android: 48, web: 44 } as const

/**
 * Tipografia. Títulos em Bricolage Grotesque (personalidade), texto em Inter
 * (legibilidade). Tamanhos em pontos; respeitam o tamanho de fonte do sistema.
 */
export const FONTES = {
  titulo: 'BricolageGrotesque',
  texto: 'Inter',
} as const

export const TIPO = {
  /** Saudação e título das telas principais (mockup: Bricolage 800, 34 pt, -0,5 de espaço). */
  tituloGrande: { tamanho: 34, altura: 38, peso: '800' },
  titulo: { tamanho: 28, altura: 34, peso: '800' },
  subtitulo: { tamanho: 18, altura: 24, peso: '600' },
  /** Rótulo de seção (acima de um grupo de linhas ou cartões). */
  secao: { tamanho: 14, altura: 20, peso: '600' },
  corpo: { tamanho: 16, altura: 24, peso: '400' },
  corpoForte: { tamanho: 16, altura: 24, peso: '600' },
  apoio: { tamanho: 14, altura: 20, peso: '400' },
  legenda: { tamanho: 12, altura: 16, peso: '400' },
  rotulo: { tamanho: 12, altura: 16, peso: '600' },
  /** Sobrancelha acima do conteúdo do cartão: 12 pt, 600, maiúsculas, espaço 1, coral. */
  sobrancelha: { tamanho: 12, altura: 16, peso: '600' },
  /** Rótulo da barra de abas: 11 pt (600 na ativa, 500 nas outras). */
  aba: { tamanho: 11, altura: 14, peso: '500' },
  /** Texto de leitura em destaque (versículo): 17 pt, entrelinha 1,5. */
  leitura: { tamanho: 17, altura: 26, peso: '400' },
} as const

/**
 * Papéis tipográficos: o nome do USO aponta para a variante. Tela nova escolhe
 * pelo papel; a variante é detalhe de implementação.
 */
export const PAPEL_DO_TEXTO = {
  tituloDeTela: 'titulo',
  tituloDeCartao: 'subtitulo',
  tituloDeSecao: 'secao',
  corpo: 'corpo',
  enfase: 'corpoForte',
  apoio: 'apoio',
  legenda: 'legenda',
  rotulo: 'rotulo',
  sobrancelha: 'sobrancelha',
} as const satisfies Record<string, keyof typeof TIPO>

/**
 * Elevação por tema, como `boxShadow` (iOS, Android na nova arquitetura e
 * web). No escuro a sombra quase não aparece: quem separa é a borda suave e o
 * tom da superfície, por isso a sombra ali é só um contorno escuro discreto.
 */
export const ELEVACAO = {
  claro: {
    nenhuma: 'none',
    cartao: '0px 1px 2px rgba(27, 24, 56, 0.06), 0px 4px 14px rgba(27, 24, 56, 0.06)',
    flutuante: '0px 4px 10px rgba(27, 24, 56, 0.08), 0px 12px 32px rgba(27, 24, 56, 0.12)',
  },
  escuro: {
    nenhuma: 'none',
    cartao: '0px 1px 2px rgba(0, 0, 0, 0.28)',
    flutuante: '0px 8px 28px rgba(0, 0, 0, 0.45)',
  },
} as const

export type NivelDeElevacao = keyof typeof ELEVACAO.claro

/** Movimento: durações curtas; com "Reduzir movimento", tudo vira 0. */
export const DURACAO = { rapida: 150, media: 250, lenta: 400 } as const
