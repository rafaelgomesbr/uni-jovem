/**
 * "Quem vai" (D74): UMA lista por encontro, com a pessoa, o que ela faz e a situação na mesma
 * linha. A banda é uma seção da mesma lista. A mesma pessoa pode ter vários papéis: aparece uma
 * vez por seção, com todos os papéis dela ali. Contas puras, sem tela.
 */
import { ehConvocacaoDeLouvor, normalizarFuncaoDaBanda } from '@uj/dominio'

import type { Atribuicao, EstadoDaAtribuicao, Etapa } from '@/servicos/contratoDosEventos'

type EtapaDaLista = Pick<Etapa, 'id' | 'titulo'>

/** Uma convocação já com o texto do papel. */
export interface PapelDaPessoa {
  id: string
  /** "Violão", "Quem ajuda", "Recepção (Boas-vindas)". */
  rotulo: string
  funcao: string
  etapaId: string | null
  estado: EstadoDaAtribuicao
  /** Ainda na espera do Desfazer: o servidor não sabe dela. */
  emEspera: boolean
}

export interface PessoaNaLista {
  vinculoId: string
  nome: string
  papeis: PapelDaPessoa[]
  /** A situação que manda na linha: quem falta responder vem antes de quem já respondeu. */
  estado: EstadoDaAtribuicao
  /** Todos os papéis dela estão na espera do Desfazer. */
  emEspera: boolean
}

export interface QuemVai {
  banda: PessoaNaLista[]
  equipe: PessoaNaLista[]
}

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

/** A convocação é da banda (função de banda, em qualquer etapa, ou qualquer função na etapa do Louvor)? */
export function ehDaBanda(
  a: Pick<Atribuicao, 'funcao' | 'etapaId'>,
  etapas: readonly EtapaDaLista[],
): boolean {
  const etapaTitulo = etapas.find((e) => e.id === a.etapaId)?.titulo ?? null
  return ehConvocacaoDeLouvor({ funcao: a.funcao, etapaTitulo })
}

/** "Violão" na banda; "Quem ajuda" e "Recepção (Boas-vindas)" na equipe. */
export function rotuloDoPapel(
  a: Pick<Atribuicao, 'funcao' | 'etapaId'>,
  etapas: readonly EtapaDaLista[],
): string {
  if (ehDaBanda(a, etapas)) {
    const padrao = normalizarFuncaoDaBanda(a.funcao)
    return padrao === 'Outro' ? primeiraMaiuscula(a.funcao.trim()) : padrao
  }
  const base =
    a.funcao === 'responsável'
      ? 'Quem conduz'
      : a.funcao === 'integrante'
        ? 'Quem ajuda'
        : primeiraMaiuscula(a.funcao.trim())
  const etapa = etapas.find((e) => e.id === a.etapaId)
  return etapa ? `${base} (${etapa.titulo})` : base
}

const PRIORIDADE: readonly EstadoDaAtribuicao[] = [
  'pendente',
  'substituicao_pedida',
  'recusada',
  'confirmada',
]

/** A situação da linha: quem falta responder primeiro, depois a troca, a recusa, e por fim o aceite. */
export function estadoCombinado(estados: readonly EstadoDaAtribuicao[]): EstadoDaAtribuicao {
  return PRIORIDADE.find((e) => estados.includes(e)) ?? 'pendente'
}

const TEXTO_CURTO: Readonly<Record<EstadoDaAtribuicao, string>> = {
  confirmada: 'aceitou',
  pendente: 'aguardando',
  recusada: 'não pode ir',
  substituicao_pedida: 'pediu troca',
}

/**
 * Os papéis em uma frase: "Vocal, Violão". Se a pessoa tem situações diferentes nos papéis,
 * cada um diz a sua: "Vocal (aguardando), Violão (aceitou)".
 */
export function descricaoDosPapeis(pessoa: Pick<PessoaNaLista, 'papeis'>): string {
  const iguais = new Set(pessoa.papeis.map((p) => p.estado)).size <= 1
  return pessoa.papeis
    .map((p) => (iguais ? p.rotulo : `${p.rotulo} (${TEXTO_CURTO[p.estado]})`))
    .join(', ')
}

function agrupar(
  atribuicoes: readonly (Atribuicao & { emEspera?: boolean })[],
  etapas: readonly EtapaDaLista[],
): PessoaNaLista[] {
  const porPessoa = new Map<string, PessoaNaLista>()
  for (const a of atribuicoes) {
    const papel: PapelDaPessoa = {
      id: a.id,
      rotulo: rotuloDoPapel(a, etapas),
      funcao: a.funcao,
      etapaId: a.etapaId,
      estado: a.estado,
      emEspera: a.emEspera === true,
    }
    const atual = porPessoa.get(a.vinculoId)
    if (atual) atual.papeis.push(papel)
    else {
      porPessoa.set(a.vinculoId, {
        vinculoId: a.vinculoId,
        nome: a.nome,
        papeis: [papel],
        estado: a.estado,
        emEspera: papel.emEspera,
      })
    }
  }
  const pessoas = [...porPessoa.values()]
  for (const p of pessoas) {
    p.estado = estadoCombinado(p.papeis.map((x) => x.estado))
    p.emEspera = p.papeis.every((x) => x.emEspera)
  }
  return pessoas
}

/** A ordem da banda na lista: pela primeira função de cada pessoa, na ordem padrão de `@uj/dominio`. */
const ORDEM_DA_BANDA = [
  'Vocal',
  'Violão',
  'Guitarra',
  'Teclado',
  'Baixo',
  'Bateria',
  'Projeção',
  'Som',
  'Outro',
]

/** Separa a lista em banda e equipe; cada pessoa aparece UMA vez por seção, com todos os papéis. */
export function montarQuemVai(
  atribuicoes: readonly (Atribuicao & { emEspera?: boolean })[],
  etapas: readonly EtapaDaLista[],
): QuemVai {
  const banda = agrupar(
    atribuicoes.filter((a) => ehDaBanda(a, etapas)),
    etapas,
  )
  const indice = (p: PessoaNaLista) =>
    Math.min(
      ...p.papeis.map((x) => {
        const i = ORDEM_DA_BANDA.indexOf(normalizarFuncaoDaBanda(x.funcao))
        return i < 0 ? ORDEM_DA_BANDA.length : i
      }),
    )
  banda.sort((a, b) => indice(a) - indice(b))
  return {
    banda,
    equipe: agrupar(
      atribuicoes.filter((a) => !ehDaBanda(a, etapas)),
      etapas,
    ),
  }
}

/** Primeiro nome, para frases ("Bateria: já tem Bruno"). */
export function primeiroNome(nome: string): string {
  return nome.split(' ')[0] ?? nome
}

/**
 * Por que uma função já está preenchida, em uma frase que explica em vez de esconder o botão:
 * "Bateria: já tem Bruno." / "Violão: já têm Ana e Bruno." Nulo se ninguém (ainda) tem a função.
 * Quem recusou não conta.
 */
export function jaTemNaFuncao(rotulo: string, nomes: readonly string[]): string | null {
  if (nomes.length === 0) return null
  const lista =
    nomes.length === 1 ? nomes[0]! : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
  return `${rotulo}: já ${nomes.length === 1 ? 'tem' : 'têm'} ${lista}.`
}
