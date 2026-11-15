/**
 * Avatar da conta: um ícone de uma lista fechada sobre uma cor de uma paleta
 * fechada. Listas fechadas porque a API guarda só os nomes (nada de imagem
 * enviada pela pessoa: sem moderação, sem armazenamento, sem dado biométrico).
 *
 * Os NOMES são o contrato com a API (`PUT /api/v1/eu/avatar`); trocar um nome
 * aqui exige trocar lá. A cor de cada item vale nos dois temas: o avatar é a
 * identidade da pessoa e não muda de tom quando o sistema muda de tema.
 */

export const ICONES_DO_AVATAR = [
  'nascer',
  'sol',
  'lua',
  'estrela',
  'coracao',
  'chama',
  'folha',
  'flor',
  'montanha',
  'onda',
  'nuvem',
  'raio',
  'musica',
  'microfone',
  'livro',
  'cafe',
  'bola',
  'jogo',
  'paleta',
  'camera',
  'aviao',
  'bicicleta',
  'pata',
  'globo',
] as const

export type IconeDoAvatar = (typeof ICONES_DO_AVATAR)[number]

/** Nome legível de cada ícone, para o leitor de tela na grade de escolha. */
export const NOME_DO_ICONE_DO_AVATAR: Readonly<Record<IconeDoAvatar, string>> = {
  nascer: 'Sol nascendo',
  sol: 'Sol',
  lua: 'Lua',
  estrela: 'Estrela',
  coracao: 'Coração',
  chama: 'Chama',
  folha: 'Folha',
  flor: 'Flor',
  montanha: 'Montanha',
  onda: 'Onda',
  nuvem: 'Nuvem',
  raio: 'Raio',
  musica: 'Música',
  microfone: 'Microfone',
  livro: 'Livro',
  cafe: 'Café',
  bola: 'Bola',
  jogo: 'Controle de jogo',
  paleta: 'Paleta de pintura',
  camera: 'Câmera',
  aviao: 'Avião',
  bicicleta: 'Bicicleta',
  pata: 'Pata',
  globo: 'Globo',
}

export interface CorDoAvatar {
  /** Fundo do círculo. */
  fundo: string
  /** Ícone e iniciais por cima: passa 4,5:1 sobre o fundo (teste de contraste). */
  frente: string
  /** Nome legível, para o leitor de tela na grade de escolha. */
  nome: string
}

/** Paleta da direção Aurora: céu da noite (escuras) e nascer do sol (claras). */
export const CORES_DO_AVATAR = {
  aurora: { fundo: '#B23A17', frente: '#FFFFFF', nome: 'Aurora' },
  violeta: { fundo: '#4B3FC4', frente: '#FFFFFF', nome: 'Violeta' },
  noite: { fundo: '#25214F', frente: '#FFFFFF', nome: 'Noite' },
  verde: { fundo: '#16794B', frente: '#FFFFFF', nome: 'Verde' },
  azul: { fundo: '#1F5FA8', frente: '#FFFFFF', nome: 'Azul' },
  rosa: { fundo: '#A3235E', frente: '#FFFFFF', nome: 'Rosa' },
  petroleo: { fundo: '#0E6873', frente: '#FFFFFF', nome: 'Petróleo' },
  ambar: { fundo: '#FFD166', frente: '#1A0F0A', nome: 'Âmbar' },
  pessego: { fundo: '#FFB199', frente: '#1A0F0A', nome: 'Pêssego' },
  lilas: { fundo: '#C9C4EC', frente: '#12102A', nome: 'Lilás' },
  menta: { fundo: '#7FE0B0', frente: '#0B2A1C', nome: 'Menta' },
  ceu: { fundo: '#9FD3F5', frente: '#0B1F33', nome: 'Céu' },
} as const satisfies Record<string, CorDoAvatar>

export type NomeDaCorDoAvatar = keyof typeof CORES_DO_AVATAR

export const NOMES_DAS_CORES_DO_AVATAR = Object.keys(CORES_DO_AVATAR) as NomeDaCorDoAvatar[]

export function ehIconeDoAvatar(valor: unknown): valor is IconeDoAvatar {
  return typeof valor === 'string' && (ICONES_DO_AVATAR as readonly string[]).includes(valor)
}

export function ehCorDoAvatar(valor: unknown): valor is NomeDaCorDoAvatar {
  return typeof valor === 'string' && Object.hasOwn(CORES_DO_AVATAR, valor)
}

/**
 * Cor estável derivada do nome, para quem ainda não escolheu avatar: a mesma
 * pessoa tem sempre a mesma cor, em qualquer tela e aparelho.
 */
export function corDoAvatarPeloNome(nome: string): NomeDaCorDoAvatar {
  let soma = 0
  for (const letra of nome.trim().toLowerCase()) {
    soma = (soma * 31 + (letra.codePointAt(0) ?? 0)) % 2_147_483_647
  }
  return NOMES_DAS_CORES_DO_AVATAR[soma % NOMES_DAS_CORES_DO_AVATAR.length]!
}

/** Até duas iniciais: primeiro e último nome ("Ana Souza Lima" vira "AL"). */
export function iniciaisDoNome(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p))
  if (partes.length === 0) return '?'
  const primeira = [...partes[0]!][0] ?? ''
  const ultima = partes.length > 1 ? ([...partes.at(-1)!][0] ?? '') : ''
  return (primeira + ultima).toLocaleUpperCase('pt-BR')
}
