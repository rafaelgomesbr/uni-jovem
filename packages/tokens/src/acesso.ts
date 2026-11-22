/**
 * Tokens da tela de acesso (Entrar, Criar conta e convite), D63. Desenho em
 * `docs/design/login-v2-ui-motion.md`. Este arquivo não importa o `index.ts`
 * (que o reexporta): os valores de espaço repetem os de `ESPACO` e `ALTURA`.
 */

/** Coluna única da entrada na web e em tablet: o conteúdo nunca passa disto. */
export const LARGURA_DA_COLUNA_DE_ACESSO = 400

/** Altura dos botões de acesso e dos campos da entrada (`ALTURA.controleAlto`). */
export const ALTURA_DO_ACESSO = 56

/** Altura do acesso terciário (só texto) e dos links de largura total do rodapé. */
export const ALTURA_DO_ACESSO_TERCIARIO = 48

/** Alvo do segundo link do rodapé ("Tenho um convite ou código"). */
export const ALTURA_DO_LINK_DO_RODAPE = 44

/** Ritmo vertical da entrada: tudo múltiplo de 4, agrupado por proximidade. */
export const RITMO_DE_ACESSO = {
  /** Sol de 88 e 96 até o nome. */
  solParaTitulo: 16,
  /** Sol de 112 até o nome. */
  solGrandeParaTitulo: 20,
  tituloParaApoio: 8,
  apoioParaConvite: 16,
  seloParaBotao: 8,
  entreAcessos: 12,
  /** Salto de grupo: acessos e rodapé. */
  acessosParaRodape: 20,
  /** Entre o palco e os acessos, nunca menos. */
  respiroMinimo: 16,
  /** Da sobra, 40% fica em cima e 60% embaixo (arredondado a múltiplo de 8). */
  fatorDoRespiroDeCima: 0.4,
  /** Linha de apoio do campo (6 mais 20), sempre reservada: o erro não empurra o botão. */
  fendaDeErro: 26,
  /** Painel de e-mail: do título ao primeiro campo, no ritmo confortável e no compacto. */
  tituloParaCampoConfortavel: 24,
  tituloParaCampoCompacto: 12,
} as const

/** Lado do sol (a marca) em cada situação. */
export const LADO_DO_SOL = {
  grande: 112,
  medio: 96,
  base: 88,
  compacto: 72,
  /** Fonte grande do sistema e paisagem. */
  minimo: 56,
  /** No painel de e-mail e nas telas de criar conta. */
  mini: 32,
} as const

/** Proporção do halo em relação ao lado do sol. */
export const PROPORCAO_DO_HALO = 2.4

/**
 * Botão "Continuar com o Google" no tema escuro da marca: fundo `#131314`,
 * contorno `#8E918F` de 1 pt por dentro e texto `#E3E3E3`. É o secundário no
 * tema escuro; no claro vale o tema claro da marca (`MARCA_DO_GOOGLE`).
 */
export const MARCA_DO_GOOGLE_ESCURO = {
  fundo: '#131314',
  texto: '#E3E3E3',
  borda: '#8E918F',
  pressionado: '#262627',
  textoInativo: '#8E918F',
} as const

/**
 * Camada de "pressionado" de cada acesso de marca: uma `View` absoluta que só
 * muda de `opacity` (nada de animar cor). Sobre o fundo do botão dá `#E6E6E6`
 * (Apple no escuro), `#292929` (Apple no claro), `#262627` (Google escuro) e
 * `#F2F2F2` (Google claro).
 */
export const CAMADA_DE_TOQUE_DO_ACESSO = {
  appleEscuro: 'rgba(0,0,0,0.10)',
  appleClaro: 'rgba(255,255,255,0.16)',
  googleEscuro: 'rgba(255,255,255,0.08)',
  googleClaro: 'rgba(0,0,0,0.05)',
} as const

/** Cores do sol por tema (o sol é logotipo: fica fora da regra 1.4.11, mas o claro foi acertado). */
export const MARCA_DO_SOL = {
  escuro: {
    corpoTopo: '#FFD166',
    corpoBase: '#FF8A65',
    raio: '#FFD166',
    barra1: '#FFEBDD',
    barra2: '#FFEBDD',
    barra2Alfa: 0.7,
    halo: 'rgba(255,138,101,0.35)',
  },
  claro: {
    corpoTopo: '#E8890C',
    corpoBase: '#C2491F',
    raio: '#B86E00',
    barra1: '#8A2E12',
    barra2: '#8A2E12',
    barra2Alfa: 0.6,
    halo: 'rgba(255,138,101,0.25)',
  },
} as const

/**
 * Geometria do sol no quadro de 1024 do `icon.png`, recortada num quadrado de
 * 712 (x 156 a 868, y 190 a 902). O horizonte fica a 0,6236 da altura.
 */
export const GEOMETRIA_DO_SOL = {
  quadro: { x: 156, y: 190, lado: 712 },
  centro: { x: 512, y: 634 },
  raioDoCorpo: 205,
  /** Raios: cápsulas de 34 de espessura, de 252 a 369 do centro (com as pontas redondas). */
  raios: {
    espessura: 34,
    de: 269,
    ate: 352,
    angulos: [150, 120, 90, 60, 30],
  },
  barra1: { x: 225, y: 665, largura: 574, altura: 38 },
  barra2: { x: 338, y: 754, largura: 348, altura: 37 },
} as const

/** Curvas (`cubic-bezier`) da entrada. */
export const CURVAS_DE_ACESSO = {
  /** Entradas e revelações: sobe rápido, assenta devagar. */
  saida: [0.22, 1, 0.36, 1],
  /** Trocas de painel, simétricas. */
  padrao: [0.4, 0, 0.2, 1],
  /** O que sai: começa devagar e termina rápido. */
  saidaDeTela: [0.4, 0, 1, 1],
} as const

/** Molas da entrada (Reanimated). */
export const MOLAS_DE_ACESSO = {
  /** Volta de 0,98 a 1 depois do toque (amortecimento de cerca de 0,65). */
  toque: { damping: 18, stiffness: 320, mass: 0.6 },
  /** O check do sucesso (passa uns 8% do ponto). */
  check: { damping: 12, stiffness: 260, mass: 0.7 },
} as const

interface PassoDaCascata {
  duracao: number
  atraso: number
}

/**
 * Cascata de abertura (7.2): o que cada elemento faz, em ms. Roda uma vez por
 * abertura do app; a tela já responde ao toque no primeiro quadro. O último
 * fim (rodapé 2) é 780 ms.
 */
export const CASCATA_DE_ABERTURA = {
  auroraCoral: { duracao: 800, atraso: 0 },
  halo: { duracao: 700, atraso: 60 },
  barra1: { duracao: 360, atraso: 0 },
  barra2: { duracao: 360, atraso: 60 },
  corpo: { duracao: 560, atraso: 80 },
  /** Cada raio: 200 ms, começando em 300 e de 40 em 40. */
  raio: { duracao: 200, atraso: 300, passo: 40 },
  nome: { duracao: 360, atraso: 180 },
  apoio: { duracao: 360, atraso: 230 },
  botao1: { duracao: 320, atraso: 300 },
  botao2: { duracao: 320, atraso: 350 },
  botao3: { duracao: 320, atraso: 400 },
  rodape1: { duracao: 280, atraso: 450 },
  rodape2: { duracao: 280, atraso: 500 },
} as const satisfies Record<string, PassoDaCascata | (PassoDaCascata & { passo: number })>

/** Entrada curta (retorno e troca entre Entrar e Criar conta): o sol e a aurora não repetem. */
export const ENTRADA_CURTA = { duracao: 260, passo: 30, deslocamento: 16, maximo: 470 } as const

/**
 * Movimento dos controles (D64): a gramática única de botão, campo, segmento e
 * interruptor. Só `opacity` e `transform` (cor muda por camada que altera a
 * opacidade, nunca animada direto). Com "Reduzir movimento": sem escala nem
 * mola, só a camada, em `toqueReduzido`; o foco e o Limpar passam a 0 ms.
 */
export const MOVIMENTO_DOS_CONTROLES = {
  /** Com Reduzir movimento: só dissolve, e dura isto. */
  dissolver: 120,
  toqueDentro: 90,
  toqueFora: 160,
  toqueReduzido: 80,
  escalaDoToque: 0.98,
  /** Anel e halo do campo entram e saem (0 com Reduzir movimento). */
  foco: 160,
  focoSaida: 120,
  /** Habilitar ou desabilitar: a camada de cor muda de opacidade. */
  estado: 140,
  /** A mensagem de erro sobe 4 pt e aparece. */
  mensagemDeErro: 200,
  mensagemDeErroReduzida: 120,
  deslocamentoDaMensagem: 4,
  /** O botão Limpar entra e sai. */
  limpar: 120,
  /** Ponteiro em cima (web): a camada de hover muda de opacidade. */
  hover: 120,
  /** Polegar do segmento escolhido. */
  segmento: 200,
  /** Interruptor com Reduzir movimento: linear, sem mola. */
  interruptorReduzido: 80,
  /** O indicador do botão só aparece depois desta espera (resposta rápida não pisca). */
  esperaDoIndicador: 250,
  indicadorEntra: 140,
  indicadorSai: 100,
  /** Balanço do erro: deslocamentos e duração de cada etapa (ms), 260 no total. */
  balancoDoCampo: {
    amplitude: 5,
    etapas: [
      { dx: -5, duracao: 40 },
      { dx: 5, duracao: 80 },
      { dx: -3, duracao: 70 },
      { dx: 0, duracao: 70 },
    ],
  },
  balancoDoBotao: {
    amplitude: 4,
    etapas: [
      { dx: -4, duracao: 40 },
      { dx: 4, duracao: 80 },
      { dx: -2, duracao: 70 },
      { dx: 0, duracao: 50 },
    ],
  },
} as const

/** Demais movimentos da entrada, em ms e pt. Os dos controles vêm de `MOVIMENTO_DOS_CONTROLES` (apelido). */
export const MOVIMENTO_DE_ACESSO = {
  ...MOVIMENTO_DOS_CONTROLES,
  painelIda: 280,
  painelVolta: 240,
  /** O foco só vai ao campo depois que o painel assentou. */
  focoNoPainel: 280,
  /** O sucesso segura o redirecionamento por este tempo, para o check aparecer. */
  sucesso: 200,
} as const

/** Fim da cascata de abertura: o maior (atraso mais duração) entre os elementos de conteúdo. */
export function fimDaCascataDeAbertura(): number {
  const c = CASCATA_DE_ABERTURA
  const ultimoRaio = c.raio.atraso + c.raio.passo * 4 + c.raio.duracao
  const fins = [
    c.barra1,
    c.barra2,
    c.corpo,
    c.nome,
    c.apoio,
    c.botao1,
    c.botao2,
    c.botao3,
    c.rodape1,
    c.rodape2,
  ].map((p) => p.atraso + p.duracao)
  return Math.max(ultimoRaio, ...fins)
}
