/**
 * Formulário de evento e de série: estado digitado, validação e montagem do
 * corpo para a API. Puro, para testar sem tela. Os limites são os mesmos que
 * a API valida (título 2 a 120, duração 5 a 1440, capacidade 1 a 100000).
 */
import { gerarDatas, type DiaDaSemana, type RegraDeRecorrencia } from '@uj/dominio'

import type { DetalheDoEvento, TipoDeLocal, Visibilidade } from '@/servicos/contratoDosEventos'
import {
  dataDoInstante,
  diaDaSemana,
  formatarHora,
  instanteDeDataEHora,
  lerDataDigitada,
  lerHoraDigitada,
  somarDias,
  type DataLocal,
} from '@/utilidades/datas'

/** `null` = sem local; `'novo'` = cadastrar um local junto com o evento. */
export type EscolhaDeLocal = string | null

export interface NovoLocal {
  nome: string
  tipo: TipoDeLocal
  endereco: string
  referencia: string
}

/**
 * Datas em `AAAA-MM-DD` e horas em `HH:MM`, como saem dos seletores nativos
 * (`CampoDeData` e `CampoDeHora`): nada é digitado. Vazio = ainda não escolhido.
 */
export interface RascunhoDoEvento {
  titulo: string
  categoria: string
  data: string
  hora: string
  duracao: string
  local: EscolhaDeLocal
  novoLocal: NovoLocal
  visibilidade: Visibilidade
  capacidade: string
  listaDeEspera: boolean
  inscricaoData: string
  inscricaoHora: string
  descricao: string
  informacoesUteis: string
}

export const LOCAL_NOVO = 'novo'

export function rascunhoVazio(): RascunhoDoEvento {
  return {
    titulo: '',
    categoria: '',
    data: '',
    hora: '',
    duracao: '',
    local: null,
    novoLocal: { nome: '', tipo: 'interno', endereco: '', referencia: '' },
    visibilidade: 'interna',
    capacidade: '',
    listaDeEspera: false,
    inscricaoData: '',
    inscricaoHora: '',
    descricao: '',
    informacoesUteis: '',
  }
}

/** Próximo sábado a partir de hoje (hoje, se já for sábado). */
export function proximoSabado(hoje: DataLocal): DataLocal {
  return somarDias(hoje, (6 - diaDaSemana(hoje) + 7) % 7)
}

export function rascunhoDoEvento(e: DetalheDoEvento): RascunhoDoEvento {
  return {
    ...rascunhoVazio(),
    titulo: e.titulo,
    categoria: e.categoria,
    data: dataDoInstante(e.inicio, e.fuso),
    hora: formatarHora(e.inicio, e.fuso),
    duracao: String(e.duracaoMin),
    local: e.local?.id ?? null,
    visibilidade: e.visibilidade,
    capacidade: e.capacidade ? String(e.capacidade) : '',
    listaDeEspera: e.listaDeEspera,
    inscricaoData: e.inscricaoAte ? dataDoInstante(e.inscricaoAte, e.fuso) : '',
    inscricaoHora: e.inscricaoAte ? formatarHora(e.inscricaoAte, e.fuso) : '',
    descricao: e.descricao ?? '',
    informacoesUteis: e.informacoesUteis ?? '',
  }
}

export type ErrosDoRascunho = Partial<Record<keyof RascunhoDoEvento | 'novoLocal', string>>

export interface EventoValidado {
  titulo: string
  categoria: string
  data: DataLocal
  hora: string
  inicio: string
  /** `undefined` quando pode ficar a cargo do modelo (soma das etapas). */
  duracaoMin: number | undefined
  local: EscolhaDeLocal
  visibilidade: Visibilidade
  capacidade: number | null
  listaDeEspera: boolean
  inscricaoAte: string | null
  descricao: string | null
  informacoesUteis: string | null
}

interface OpcoesDeValidacao {
  fuso: string
  /** Sem modelo, a duração é obrigatória. */
  duracaoOpcional: boolean
  /** Na edição da série toda, a data não vale (o dia vem da regra). */
  ignorarData?: boolean
}

export function validarRascunho(
  r: RascunhoDoEvento,
  { fuso, duracaoOpcional, ignorarData = false }: OpcoesDeValidacao,
): { erros: ErrosDoRascunho; dados: EventoValidado | null } {
  const erros: ErrosDoRascunho = {}
  const titulo = r.titulo.trim()
  if (titulo.length < 2) erros.titulo = 'Dê um título com pelo menos 2 letras.'
  const categoria = r.categoria.trim()
  if (categoria.length < 2) erros.categoria = 'Escolha ou escreva uma categoria.'

  const data = lerDataDigitada(r.data)
  if (!data && !ignorarData) erros.data = 'Escolha a data.'
  const hora = lerHoraDigitada(r.hora)
  if (!hora) erros.hora = 'Escolha a hora.'

  let duracaoMin: number | undefined
  if (r.duracao.trim()) {
    const n = Number(r.duracao.trim())
    if (!Number.isInteger(n) || n < 5 || n > 1440) {
      erros.duracao = 'Use minutos inteiros, de 5 a 1440.'
    } else duracaoMin = n
  } else if (!duracaoOpcional) {
    erros.duracao = 'Informe a duração em minutos.'
  }

  let capacidade: number | null = null
  if (r.capacidade.trim()) {
    const n = Number(r.capacidade.trim())
    if (!Number.isInteger(n) || n < 1 || n > 100000) {
      erros.capacidade = 'Use um número de vagas a partir de 1, ou deixe em branco.'
    } else capacidade = n
  }

  let inscricaoAte: string | null = null
  if (r.inscricaoData.trim() || r.inscricaoHora.trim()) {
    const d = lerDataDigitada(r.inscricaoData)
    const h = r.inscricaoHora.trim() ? lerHoraDigitada(r.inscricaoHora) : '23:59'
    if (!d) erros.inscricaoData = 'Escolha o dia do prazo.'
    if (!h) erros.inscricaoHora = 'Escolha a hora do prazo.'
    if (d && h) inscricaoAte = instanteDeDataEHora(d, h, fuso)
  }

  if (r.local === LOCAL_NOVO) {
    const l = r.novoLocal
    if (l.nome.trim().length < 2) erros.novoLocal = 'Dê um nome ao local novo.'
    else if (l.tipo === 'externo' && !l.endereco.trim()) {
      erros.novoLocal = 'Informe o endereço do local externo.'
    }
  }

  const inicio = data && hora ? instanteDeDataEHora(data, hora, fuso) : ''
  if (inicio && inscricaoAte && inscricaoAte > inicio) {
    erros.inscricaoData = 'O prazo de inscrição precisa terminar antes do início do evento.'
  }

  if (Object.keys(erros).length) return { erros, dados: null }
  return {
    erros,
    dados: {
      titulo,
      categoria,
      data: data ?? ('' as DataLocal),
      hora: hora!,
      inicio,
      duracaoMin,
      local: r.local,
      visibilidade: r.visibilidade,
      capacidade,
      listaDeEspera: capacidade !== null && r.listaDeEspera,
      inscricaoAte,
      descricao: r.descricao.trim() || null,
      informacoesUteis: r.informacoesUteis.trim() || null,
    },
  }
}

/** Corpo do PATCH do evento: só o que mudou em relação à versão de base. */
export function mudancasDoEvento(
  base: DetalheDoEvento,
  d: EventoValidado,
  localId: string | null,
): Record<string, unknown> {
  const m: Record<string, unknown> = {}
  if (d.titulo !== base.titulo) m.titulo = d.titulo
  if (d.categoria !== base.categoria) m.categoria = d.categoria
  if (new Date(d.inicio).getTime() !== new Date(base.inicio).getTime()) m.inicio = d.inicio
  if (d.duracaoMin !== undefined && d.duracaoMin !== base.duracaoMin) m.duracaoMin = d.duracaoMin
  if (localId !== (base.local?.id ?? null)) m.localId = localId
  if (d.visibilidade !== base.visibilidade) m.visibilidade = d.visibilidade
  if (d.capacidade !== base.capacidade) m.capacidade = d.capacidade
  if (d.listaDeEspera !== base.listaDeEspera) m.listaDeEspera = d.listaDeEspera
  const prazoBase = base.inscricaoAte ? new Date(base.inscricaoAte).getTime() : null
  const prazoNovo = d.inscricaoAte ? new Date(d.inscricaoAte).getTime() : null
  if (prazoBase !== prazoNovo) m.inscricaoAte = d.inscricaoAte
  if (d.descricao !== (base.descricao ?? null)) m.descricao = d.descricao
  if (d.informacoesUteis !== (base.informacoesUteis ?? null)) {
    m.informacoesUteis = d.informacoesUteis
  }
  return m
}

/** Nomes humanos dos campos, para a tela de conflito. */
export const NOME_DO_CAMPO: Readonly<Record<string, string>> = {
  titulo: 'Título',
  categoria: 'Categoria',
  inicio: 'Data e hora',
  duracaoMin: 'Duração',
  localId: 'Local',
  visibilidade: 'Visibilidade',
  capacidade: 'Vagas',
  listaDeEspera: 'Lista de espera',
  inscricaoAte: 'Prazo de inscrição',
  descricao: 'Descrição',
  informacoesUteis: 'Informações úteis',
}

// ------------------------------------------------------------ série

export type Repeticao = 'nao' | 'semanal' | 'mensal'
export type SemanaDoMes = 1 | 2 | 3 | 4 | -1

export interface RascunhoDaRegra {
  repeticao: Repeticao
  diasDaSemana: DiaDaSemana[]
  intervaloSemanas: 1 | 2 | 3 | 4
  modoMensal: 'dia_do_mes' | 'semana_do_mes'
  semanaDoMes: SemanaDoMes
  fim: string
}

export function regraVazia(): RascunhoDaRegra {
  return {
    repeticao: 'nao',
    diasDaSemana: [],
    intervaloSemanas: 1,
    modoMensal: 'dia_do_mes',
    semanaDoMes: 1,
    fim: '',
  }
}

/** Rascunho a partir de uma regra salva (para editar dia ou horário da série). */
export function rascunhoDaRegra(regra: RegraDeRecorrencia, fim: string | null): RascunhoDaRegra {
  const base = { ...regraVazia(), fim: fim ?? '' }
  if (regra.frequencia === 'semanal') {
    return {
      ...base,
      repeticao: 'semanal',
      diasDaSemana: [...regra.diasDaSemana],
      intervaloSemanas: Math.min(4, Math.max(1, regra.intervaloSemanas)) as 1 | 2 | 3 | 4,
    }
  }
  if (regra.modo === 'dia_do_mes') return { ...base, repeticao: 'mensal', modoMensal: 'dia_do_mes' }
  return { ...base, repeticao: 'mensal', modoMensal: 'semana_do_mes', semanaDoMes: regra.semana }
}

/** Semana do mês em que a data cai (1 a 4; a 5ª vira "última"). */
export function semanaDoMesDe(data: DataLocal): SemanaDoMes {
  const dia = Number(data.slice(8, 10))
  const n = Math.ceil(dia / 7)
  return n >= 5 ? -1 : (n as 1 | 2 | 3 | 4)
}

/**
 * Regra de recorrência a partir do rascunho e da data da primeira ocorrência.
 * No mensal, o dia (ou o dia da semana) vem da data escolhida.
 */
export function regraDoRascunho(
  r: RascunhoDaRegra,
  primeira: DataLocal,
): { regra: RegraDeRecorrencia | null; erro: string | null } {
  if (r.repeticao === 'semanal') {
    const dias = r.diasDaSemana.length ? r.diasDaSemana : [diaDaSemana(primeira) as DiaDaSemana]
    return {
      regra: { frequencia: 'semanal', intervaloSemanas: r.intervaloSemanas, diasDaSemana: dias },
      erro: null,
    }
  }
  if (r.repeticao === 'mensal') {
    if (r.modoMensal === 'dia_do_mes') {
      return {
        regra: { frequencia: 'mensal', modo: 'dia_do_mes', dia: Number(primeira.slice(8, 10)) },
        erro: null,
      }
    }
    return {
      regra: {
        frequencia: 'mensal',
        modo: 'semana_do_mes',
        semana: r.semanaDoMes,
        diaDaSemana: diaDaSemana(primeira) as DiaDaSemana,
      },
      erro: null,
    }
  }
  return { regra: null, erro: null }
}

/** As próximas datas da regra, para a pessoa conferir antes de salvar. */
export function previaDasDatas(
  regra: RegraDeRecorrencia,
  primeira: DataLocal,
  fim: DataLocal | null,
  quantidade = 4,
): DataLocal[] {
  return gerarDatas(regra, primeira, somarDias(primeira, 400), fim).slice(0, quantidade)
}
