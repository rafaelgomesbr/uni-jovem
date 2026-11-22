/**
 * Formato das respostas da API do repertório do encontro e do Meu repertório
 * (D61). Só tipos: as regras moram na API e em `@uj/dominio`. Datas chegam como ISO.
 */
import type { LinkDaMusica } from '@uj/dominio'

import type { ResumoDoPdf } from './contratoDoPdf'
import type { EstadoDaAtribuicao } from './contratoDosEventos'

/** Item da lista do repertório de um encontro (sem o texto da cifra). */
export interface ItemDoRepertorio {
  id: string
  ordem: number
  musicaId: string
  etapaId: string | null
  /** Tom do dia (só o nome: G, Am, F#m); nulo vale o tom original. */
  tomDoDia: string | null
  nota: string | null
  versao: number
  titulo: string
  artista: string | null
  tomOriginal: string | null
  andamentoBpm: number | null
  duracaoSeg: number | null
  arquivada: boolean
  temCifra: boolean
  /** Links do Drive e do YouTube da música (D80). Opcional: API antiga não manda. */
  links?: LinkDaMusica[]
  /** PDF anexado (D76): o resumo, sem os bytes. Opcional: API antiga não manda. */
  temPdf?: boolean
  pdf?: ResumoDoPdf | null
}

/** Item do Meu repertório: traz a cifra inteira, para transpor e ler no aparelho. */
export interface ItemDoMeuRepertorio {
  id: string
  ordem: number
  musicaId: string
  tomDoDia: string | null
  nota: string | null
  titulo: string
  artista: string | null
  tomOriginal: string | null
  andamentoBpm: number | null
  duracaoSeg: number | null
  link: string | null
  /** Links do Drive e do YouTube da música (D80). Opcional: API antiga não manda. */
  links?: LinkDaMusica[]
  cifra: string | null
  /** PDF anexado (D76): o resumo, sem os bytes. Opcional: API antiga não manda. */
  temPdf?: boolean
  pdf?: ResumoDoPdf | null
}

export interface ConvocacaoDeLouvor {
  atribuicaoId: string
  funcao: string
  estado: EstadoDaAtribuicao
}

export interface EncontroDoMeuRepertorio {
  evento: { id: string; titulo: string; inicio: string; fuso: string }
  convocacoes: ConvocacaoDeLouvor[]
  itens: ItemDoMeuRepertorio[]
}

export interface RespostaDoAviso {
  convocadas: number
  avisadas: number
}
