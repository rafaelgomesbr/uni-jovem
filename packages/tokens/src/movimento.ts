/**
 * Movimento, sol e luz de fundo da direção A "Aurora Viva" (D65 e D67). Valores
 * do protótipo `docs/design/v3/a/prototipo.html` e da especificação
 * `docs/design/v3/a/especificacao.md` (seções 7 e 9). Só `opacity` e
 * `transform`, com uma exceção declarada: a altura da linha que encolhe e do
 * acordeão (200 ms, `padrao`).
 *
 * Este arquivo não importa o `index.ts` (que o reexporta).
 */

/** As curvas da direção A, como `cubic-bezier`. `luz` é `ease-in-out` (a deriva). */
export const CURVAS = {
  saida: [0.22, 1, 0.36, 1],
  padrao: [0.4, 0, 0.2, 1],
  saidaDeTela: [0.4, 0, 1, 1],
  /** O sol e a luz de fundo nascem: sobe rápido, assenta devagar. */
  nasce: [0.16, 1, 0.3, 1],
  /** Pílula da aba ativa: passa um pouco do ponto e volta. */
  pilula: [0.34, 1.3, 0.5, 1],
  /** Mola em CSS (web), a mesma do botão. */
  mola: [0.34, 1.45, 0.5, 1],
} as const

/** Molas de Reanimated para o que a web faz com `CURVAS.mola`. */
export const MOLAS = {
  toque: { damping: 18, stiffness: 320, mass: 0.6 },
  check: { damping: 12, stiffness: 260, mass: 0.7 },
  /** A pílula da aba: amortecida, uns 8% além do alvo. */
  pilula: { damping: 16, stiffness: 300, mass: 0.7 },
} as const

/** Durações e deslocamentos das telas e dos componentes da fundação (ms e pt). */
export const MOVIMENTO_DAS_TELAS = {
  /** Com Reduzir movimento, tudo que deslocava só dissolve nisto. */
  dissolver: 120,
  /** Troca de aba: a tela nova dissolve (a que sai, em `abaDissolveSai`). */
  abaDissolve: 160,
  abaDissolveSai: 120,
  /** A pílula luminosa da barra de abas e o ícone ativo. */
  pilulaDaAba: 260,
  /** Entrada da tela: até 5 blocos, 200 ms cada, passo de 30 ms (fim em 350). */
  cascata: { duracao: 200, passo: 30, maximo: 5, deslocamento: 12 },
  /** Pilha: abrir (a de baixo recua 22% e esmaece até 0,5) e voltar. */
  pilhaIda: 350,
  pilhaVolta: 300,
  /** Folha: sobe em 340 ms, desce em 240 ms; o véu leva 200. */
  folhaIda: 340,
  folhaVolta: 240,
  veu: 200,
  /** A linha que responde encolhe (altura, a exceção declarada). */
  linhaEncolhe: 200,
  /** Acordeão e segmento escolhido. */
  acordeao: 200,
  segmento: 200,
  /** Chip: "Confirmado" aparece com escala 0,6 a 1 (mola); "Presente" 0,9 a 1. */
  chipAparece: 200,
  chipPresente: 160,
  seloEstoura: 160,
  avatarDaPilula: 200,
  /** Cabeçalho que vira vidro. */
  cabecalhoVidro: 200,
  /** Toast: entra em 200 ms, sai em 160 ms; com Desfazer, a contagem dura 10 s. */
  toast: { entra: 200, sai: 160, deslocamento: 8, contagem: 10_000 },
  /** O pulso do esqueleto, ida e volta, e o dissolve de entrada dele (depois de 300 ms). */
  esqueleto: { pulso: 1200, opacidadeMinima: 0.5, aparece: 160 },
  /** Ponto "ao vivo": opacidade de 1 a 0,4 em 1,6 s. */
  ponto: { ciclo: 1600, opacidadeMinima: 0.4 },
  /** Sol: troca de pose e atraso entre os raios (nascem do mais à esquerda). */
  sol: { pose: 600, passoDoRaio: 40, halo: 1000 },
  /** Luz de fundo que sobe com o relógio. */
  luz: 900,
} as const

/** As cinco poses do sol (seção 7 da especificação): uma por momento do encontro. */
export type PoseDoSol = 'escondido' | 'nascendo' | 'pleno' | 'radiante' | 'poente'

export const POSES_DO_SOL_EM_ORDEM = [
  'escondido',
  'nascendo',
  'pleno',
  'radiante',
  'poente',
] as const satisfies readonly PoseDoSol[]

/** O que cada pose é, em palavras (para a alternativa de texto e o catálogo). */
export const NOME_DA_POSE: Readonly<Record<PoseDoSol, string>> = {
  escondido: 'Antes do amanhecer',
  nascendo: 'Nascendo',
  pleno: 'Pleno',
  radiante: 'Radiante',
  poente: 'Poente',
}

export interface ValoresDaPose {
  /** Quanto o corpo desce, em unidades do quadro de 712 (o horizonte recorta). */
  corpoY: number
  raios: { opacidade: number; escala: number }
  halo: { opacidade: number; escala: number }
  /** Opacidade das duas barras de horizonte (a segunda já nasce a 70%). */
  barra1: number
  barra2: number
  /** O poente troca as cores do corpo e dos raios. */
  poente: boolean
}

/** Tabela única de poses: `Sol` só interpola entre estas linhas. */
export const POSES_DO_SOL: Readonly<Record<PoseDoSol, ValoresDaPose>> = {
  escondido: {
    corpoY: 215,
    raios: { opacidade: 0, escala: 0.55 },
    halo: { opacidade: 0.35, escala: 1 },
    barra1: 1,
    barra2: 0.7,
    poente: false,
  },
  nascendo: {
    corpoY: 108,
    raios: { opacidade: 0, escala: 0.7 },
    halo: { opacidade: 0.6, escala: 1 },
    barra1: 1,
    barra2: 0.7,
    poente: false,
  },
  pleno: {
    corpoY: 0,
    raios: { opacidade: 1, escala: 1 },
    halo: { opacidade: 0.7, escala: 1 },
    barra1: 1,
    barra2: 0.7,
    poente: false,
  },
  radiante: {
    corpoY: 0,
    raios: { opacidade: 1, escala: 1.14 },
    halo: { opacidade: 1, escala: 1.15 },
    barra1: 1,
    barra2: 0.7,
    poente: false,
  },
  poente: {
    corpoY: 62,
    raios: { opacidade: 0.55, escala: 0.78 },
    halo: { opacidade: 0.45, escala: 1 },
    barra1: 0.55,
    barra2: 0.55,
    poente: true,
  },
}

/** Cores do sol no poente (o corpo vai do âmbar ao rosa; no claro, mais fundo). */
export const SOL_POENTE = {
  escuro: { corpoTopo: '#FFB36B', corpoBase: '#D4508A', raio: '#FFB36B' },
  claro: { corpoTopo: '#D9650C', corpoBase: '#A83A55', raio: '#A8560A' },
} as const

/** Os cinco momentos do encontro, do mais longe ao que já terminou. */
export type MomentoDoDia = 'longe' | 'vespera' | 'dia' | 'agora' | 'fim'

export const MOMENTOS_EM_ORDEM = [
  'longe',
  'vespera',
  'dia',
  'agora',
  'fim',
] as const satisfies readonly MomentoDoDia[]

/** A pose do sol de cada momento (o sol e o fundo falam juntos). */
export const POSE_DO_MOMENTO: Readonly<Record<MomentoDoDia, PoseDoSol>> = {
  longe: 'escondido',
  vespera: 'nascendo',
  dia: 'pleno',
  agora: 'radiante',
  fim: 'poente',
}

export interface LuzDoMomento {
  /** Brilho coral do canto: opacidade, escala e deslocamento. */
  coral: { opacidade: number; escala: number; x: number; y: number }
  /** Elipse do horizonte, na base: opacidade e deslocamento vertical (pt). */
  horizonte: { opacidade: number; y: number }
  /** Elipse do poente: só no "terminou". */
  poente: { opacidade: number; y: number }
}

/** O relógio no fundo (seção 7 da especificação): cada momento reposiciona a luz em 900 ms. */
export const LUZ_POR_MOMENTO: Readonly<Record<MomentoDoDia, LuzDoMomento>> = {
  longe: {
    coral: { opacidade: 0.85, escala: 1, x: 0, y: 0 },
    horizonte: { opacidade: 0.3, y: 70 },
    poente: { opacidade: 0, y: 70 },
  },
  vespera: {
    coral: { opacidade: 0.92, escala: 1.03, x: 0, y: 0 },
    horizonte: { opacidade: 0.45, y: 36 },
    poente: { opacidade: 0, y: 36 },
  },
  dia: {
    coral: { opacidade: 1, escala: 1.06, x: 0, y: 6 },
    horizonte: { opacidade: 0.65, y: 6 },
    poente: { opacidade: 0, y: 6 },
  },
  agora: {
    coral: { opacidade: 1, escala: 1.12, x: -10, y: 10 },
    horizonte: { opacidade: 0.95, y: -26 },
    poente: { opacidade: 0, y: -26 },
  },
  fim: {
    coral: { opacidade: 0.7, escala: 0.96, x: 0, y: 0 },
    horizonte: { opacidade: 0.15, y: 44 },
    poente: { opacidade: 0.95, y: 44 },
  },
}

/** Geometria das duas elipses de base (iguais ao protótipo): a luz sai por baixo da tela. */
export const LUZ_DE_BASE = {
  /** Sangra 70 pt de cada lado, 190 abaixo da borda, 380 de altura. */
  sangriaLateral: 70,
  sangriaInferior: 190,
  altura: 380,
  /** `radial-gradient(ellipse at 50% 58%, cor 0%, transparente 68%)`. */
  centroY: 0.58,
  paradaFinal: 0.68,
} as const

/** Toast com Desfazer (WCAG 2.2.1): quanto tempo a pessoa tem e o que ela ouve. */
export const DESFAZER = {
  segundos: 10,
  /** Sem Desfazer (só informação): 4 s. */
  informacaoMs: 4000,
  /** Quanto o leitor de tela ouve ao aparecer (uma vez). */
  anuncio: (segundos: number) => `Desfazer disponível por ${segundos} segundos`,
} as const

/** Deslizar para responder: frações da largura da linha. */
export const DESLIZAR = {
  /** Passou disto para a direita: aceita (e mostra Desfazer). */
  limiarParaAceitar: 0.4,
  /** Passou disto para a esquerda: abre o "Não posso ir" (nunca envia sozinho). */
  limiarParaRevelar: 0.2,
  /** Onde a linha fica aberta à esquerda. */
  aberturaDaEsquerda: 0.34,
  /** Limites do arrasto: o dedo não leva a linha além disto. */
  maximoParaDireita: 0.55,
  maximoParaEsquerda: 0.38,
  /** Quando a pessoa deve ter arrastado mais de 8 pt, quase na horizontal, para valer. */
  inicio: { distancia: 8, razaoHorizontal: 1.5, cancelaNaVertical: 10 },
  /** Volta ou sai em 250 ms (`saida`); o aceite espera 120 ms para a saída aparecer. */
  duracao: 250,
  atrasoDoAceite: 120,
  /** A linha que aceita sai com 110% da largura. */
  saida: 1.1,
} as const
