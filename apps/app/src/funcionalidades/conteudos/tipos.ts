import type { TipoDeConteudo } from '@/servicos/contratoDosModulos'
import type { NomeDoIcone } from '@/ui/Icone'

export interface DefinicaoDeCampo {
  campo: string
  rotulo: string
  obrigatorio?: boolean
  min?: number
  max: number
  multilinha?: boolean
  ajuda?: string
  /** Como o valor vai para a API. */
  formato?: 'texto' | 'link' | 'numero' | 'lista'
}

export interface DefinicaoDoTipo {
  tipo: TipoDeConteudo
  plural: string
  singular: string
  /** "a música", "o músico": para frases. */
  artigo: 'a' | 'o'
  icone: NomeDoIcone
  /** Campo que dá nome ao item (título ou nome). */
  principal: 'titulo' | 'nome'
  campos: DefinicaoDeCampo[]
  /** Campo de arquivamento: músicas e dinâmicas arquivam; pessoas ficam inativas. */
  arquivo: {
    campo: 'arquivada' | 'ativo'
    arquivarRotulo: string
    reativarRotulo: string
    selo: string
  }
}

const observacoes: DefinicaoDeCampo = {
  campo: 'observacoes',
  rotulo: 'Observações',
  max: 2000,
  multilinha: true,
}

export const TIPOS_DE_CONTEUDO: Readonly<Record<TipoDeConteudo, DefinicaoDoTipo>> = {
  musicas: {
    tipo: 'musicas',
    plural: 'Músicas',
    singular: 'música',
    artigo: 'a',
    icone: 'musica',
    principal: 'titulo',
    campos: [
      { campo: 'titulo', rotulo: 'Título', obrigatorio: true, min: 1, max: 120 },
      { campo: 'artista', rotulo: 'Artista ou ministério', max: 120 },
      { campo: 'tom', rotulo: 'Tom', max: 12, ajuda: 'Por exemplo: G, Am, D#.' },
      {
        campo: 'link',
        rotulo: 'Link (vídeo, cifra ou letra)',
        max: 2000,
        formato: 'link',
        ajuda: 'Um link que comece com https://.',
      },
      { campo: 'cifra', rotulo: 'Cifra ou letra', max: 20000, multilinha: true },
      observacoes,
    ],
    arquivo: {
      campo: 'arquivada',
      arquivarRotulo: 'Arquivar música',
      reativarRotulo: 'Tirar do arquivo',
      selo: 'Arquivada',
    },
  },
  musicos: {
    tipo: 'musicos',
    plural: 'Músicos',
    singular: 'músico',
    artigo: 'o',
    icone: 'pessoa',
    principal: 'nome',
    campos: [
      { campo: 'nome', rotulo: 'Nome', obrigatorio: true, min: 2, max: 120 },
      {
        campo: 'instrumentos',
        rotulo: 'Instrumentos',
        max: 400,
        formato: 'lista',
        ajuda: 'Separe por vírgula. Por exemplo: violão, voz.',
      },
      observacoes,
    ],
    arquivo: {
      campo: 'ativo',
      arquivarRotulo: 'Marcar como inativo',
      reativarRotulo: 'Marcar como ativo',
      selo: 'Inativo',
    },
  },
  palestrantes: {
    tipo: 'palestrantes',
    plural: 'Palestrantes',
    singular: 'palestrante',
    artigo: 'o',
    icone: 'pessoa',
    principal: 'nome',
    campos: [
      { campo: 'nome', rotulo: 'Nome', obrigatorio: true, min: 2, max: 120 },
      { campo: 'temas', rotulo: 'Temas', max: 500, multilinha: true },
      { campo: 'origem', rotulo: 'De onde vem', max: 120, ajuda: 'Igreja, cidade ou ministério.' },
      observacoes,
    ],
    arquivo: {
      campo: 'ativo',
      arquivarRotulo: 'Marcar como inativo',
      reativarRotulo: 'Marcar como ativo',
      selo: 'Inativo',
    },
  },
  dinamicas: {
    tipo: 'dinamicas',
    plural: 'Dinâmicas',
    singular: 'dinâmica',
    artigo: 'a',
    icone: 'celebrar',
    principal: 'titulo',
    campos: [
      { campo: 'titulo', rotulo: 'Título', obrigatorio: true, min: 2, max: 120 },
      { campo: 'objetivo', rotulo: 'Objetivo', max: 500, multilinha: true },
      { campo: 'instrucoes', rotulo: 'Como fazer', max: 10000, multilinha: true },
      {
        campo: 'duracaoMin',
        rotulo: 'Duração em minutos',
        max: 3,
        formato: 'numero',
        ajuda: 'De 1 a 600.',
      },
      { campo: 'materiais', rotulo: 'Materiais', max: 2000, multilinha: true },
    ],
    arquivo: {
      campo: 'arquivada',
      arquivarRotulo: 'Arquivar dinâmica',
      reativarRotulo: 'Tirar do arquivo',
      selo: 'Arquivada',
    },
  },
}

export function ehTipoDeConteudo(v: string | null): v is TipoDeConteudo {
  return v !== null && v in TIPOS_DE_CONTEUDO
}

/** Está arquivado (música e dinâmica) ou inativo (músico e palestrante)? */
export function estaArquivado(def: DefinicaoDoTipo, item: Record<string, unknown>): boolean {
  return def.arquivo.campo === 'arquivada' ? item['arquivada'] === true : item['ativo'] === false
}

/** Texto do campo para o formulário. */
export function textoDoCampo(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (Array.isArray(valor)) return valor.join(', ')
  return String(valor)
}

/**
 * Valida o formulário e monta o corpo. Campos vazios viram `null` (apagam o
 * valor na edição); na criação, campos vazios simplesmente não vão.
 */
export function montarCorpo(
  def: DefinicaoDoTipo,
  valores: Record<string, string>,
): { erros: Record<string, string> } | { corpo: Record<string, unknown> } {
  const erros: Record<string, string> = {}
  const corpo: Record<string, unknown> = {}
  for (const c of def.campos) {
    const bruto = (valores[c.campo] ?? '').trim()
    if (!bruto) {
      if (c.obrigatorio) erros[c.campo] = `Informe ${c.rotulo.toLowerCase()}.`
      // A API aceita lista vazia, não nula, para os instrumentos.
      corpo[c.campo] = c.formato === 'lista' ? [] : null
      continue
    }
    if (c.min && bruto.length < c.min) erros[c.campo] = `${c.rotulo}: mínimo de ${c.min} letras.`
    switch (c.formato) {
      case 'link':
        if (!/^https:\/\/\S+$/.test(bruto)) erros[c.campo] = 'Use um link que comece com https://.'
        corpo[c.campo] = bruto
        break
      case 'numero': {
        const n = Number(bruto)
        if (!Number.isInteger(n) || n < 1 || n > 600) erros[c.campo] = 'Use um número de 1 a 600.'
        corpo[c.campo] = n
        break
      }
      case 'lista': {
        const itens = bruto
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
        if (itens.length > 10 || itens.some((x) => x.length > 40)) {
          erros[c.campo] = 'Até 10 itens, cada um com até 40 letras.'
        }
        corpo[c.campo] = itens
        break
      }
      default:
        corpo[c.campo] = bruto
    }
  }
  return Object.keys(erros).length ? { erros } : { corpo }
}
