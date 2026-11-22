/**
 * Dados fictícios do repertório e do pacote para tocar sem internet. As letras são inventadas só
 * para o teste (nada de música de terceiros).
 */
import type { PacoteDoRepertorio } from '@/servicos/contratoV3'
import type { EncontroDoMeuRepertorio, ItemDoMeuRepertorio } from '@/servicos/contratoDoRepertorio'

import { EVENTO_ID, INICIO } from './fixturas'
import { FUSO } from './telas'

const DIA_MS = 24 * 3600_000

/** Duas linhas de ChordPro com a letra inventada. */
export const CIFRA_DE_TESTE =
  '{key: G}\n[G]Firmo os meus pés na [D]rocha de manhã\n[Em]Quando o vento [C]vem'
export const LETRA_DA_PRIMEIRA = 'Firmo os meus pés na rocha de manhã'
export const LETRA_DA_SEGUNDA = 'Quando o vento vem'

export const CIFRA_DA_SEGUNDA = '{key: D}\n[D]Canto de [A]manhã\n[Bm]Canto de [G]tarde'

export function itensDeTeste(): ItemDoMeuRepertorio[] {
  return [
    {
      id: 'item-1',
      ordem: 0,
      musicaId: 'mus-1',
      tomDoDia: 'A',
      nota: null,
      titulo: 'Firmes na rocha',
      artista: null,
      tomOriginal: 'G',
      andamentoBpm: 72,
      duracaoSeg: 245,
      link: null,
      cifra: CIFRA_DE_TESTE,
    },
    {
      id: 'item-2',
      ordem: 1,
      musicaId: 'mus-2',
      tomDoDia: null,
      nota: 'Entra só o coro',
      titulo: 'Canto de manhã',
      artista: null,
      tomOriginal: 'D',
      andamentoBpm: null,
      duracaoSeg: null,
      link: null,
      cifra: CIFRA_DA_SEGUNDA,
    },
  ]
}

export function pacoteDoRepertorioDeTeste(
  parcial: Partial<PacoteDoRepertorio> = {},
): PacoteDoRepertorio {
  return {
    versao: 'versao-1',
    geradoEm: new Date().toISOString(),
    validoAte: new Date(Date.now() + 7 * DIA_MS).toISOString(),
    validadeDias: 7,
    evento: {
      id: EVENTO_ID,
      titulo: 'Sábado com a juventude',
      inicio: INICIO,
      fuso: FUSO,
      status: 'publicado',
    },
    minhaParte: [{ funcao: 'Violão', estado: 'confirmada' }],
    itens: itensDeTeste(),
    ...parcial,
  }
}

export function encontroDoMeuRepertorioDeTeste(
  parcial: Partial<EncontroDoMeuRepertorio> = {},
): EncontroDoMeuRepertorio {
  return {
    evento: { id: EVENTO_ID, titulo: 'Sábado com a juventude', inicio: INICIO, fuso: FUSO },
    convocacoes: [{ atribuicaoId: 'atr-violao', funcao: 'Violão', estado: 'confirmada' }],
    itens: itensDeTeste(),
    ...parcial,
  }
}

// ------------------------------------------------------------ PDF da música (D76)

/** Bytes de um texto ASCII (o PDF de teste e os conteúdos que não são PDF). Sem `Buffer`: o app não tem os tipos do Node. */
export function bytesDe(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i) & 0xff
  return bytes
}

/** Os dois têm exatamente os mesmos bytes? */
export function mesmosBytes(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Um PDF mínimo e inventado: começa com `%PDF-`, como a API e o seletor conferem. */
export const BYTES_DO_PDF = bytesDe('%PDF-1.4\n% cifra inventada so para o teste\n%%EOF\n')
export const VERSAO_DO_PDF = 'b'.repeat(64)
export const OUTRA_VERSAO_DO_PDF = 'c'.repeat(64)
export const NOME_DO_PDF = 'firmes-na-rocha.pdf'

export function resumoDoPdfDeTeste(versao = VERSAO_DO_PDF) {
  return { nome: NOME_DO_PDF, tamanho: BYTES_DO_PDF.length, versao }
}

/** O mesmo repertório, mas a primeira música só tem PDF (sem cifra em texto). */
export function itensComPdfDeTeste(soPdf = false): ItemDoMeuRepertorio[] {
  return itensDeTeste().map((item, n) =>
    n === 0
      ? {
          ...item,
          ...(soPdf ? { cifra: null } : {}),
          temPdf: true,
          pdf: resumoDoPdfDeTeste(),
        }
      : item,
  )
}
