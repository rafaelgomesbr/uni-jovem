/**
 * Dados de teste do cartão do momento (`GET /inicio`, campo `momento`, D66): um encontro no
 * sábado de `INICIO` e um relógio que o aproxima ou afasta. Cada teste muda só o que importa.
 */
import type {
  EventoDoMomento,
  LiderDoMomento,
  MomentoDoInicio,
  ParteDoMomento,
} from '@/servicos/contratoV3'

import { INICIO } from './fixturas'
import { FUSO } from './telas'

const DIA = 86_400_000

/** Instante a `dias` do início do encontro (negativo: antes). */
export const aDias = (dias: number) => new Date(Date.parse(INICIO) + dias * DIA).toISOString()
/** Instante a `horas` do início (negativo: antes). */
export const aHoras = (horas: number) =>
  new Date(Date.parse(INICIO) + horas * 3_600_000).toISOString()

export function eventoDoMomento(parcial: Partial<EventoDoMomento> = {}): EventoDoMomento {
  return {
    id: 'e1',
    titulo: 'Sábado Jovem',
    categoria: 'Programação de sábado',
    inicio: INICIO,
    fim: new Date(Date.parse(INICIO) + 3_600_000).toISOString(),
    duracaoMin: 60,
    fuso: FUSO,
    status: 'publicado',
    visibilidade: 'interna',
    local: {
      nome: 'Salão da igreja',
      tipo: 'externo',
      endereco: 'Rua das Flores, 10',
      latitude: null,
      longitude: null,
      referencia: null,
    },
    ...parcial,
  }
}

export function parteDoMomento(parcial: Partial<ParteDoMomento> = {}): ParteDoMomento {
  return {
    atribuicaoId: 'a1',
    funcao: 'Vocal',
    etapaTitulo: 'Louvor',
    estado: 'pendente',
    ...parcial,
  }
}

export function liderDoMomento(parcial: Partial<LiderDoMomento> = {}): LiderDoMomento {
  return {
    convocados: 11,
    confirmados: 9,
    recusaram: 0,
    pendentes: 2,
    responderam: 9,
    faltamResponder: [
      { vinculoId: 'v1', nome: 'Bruno Tavares', funcoes: ['Violão'] },
      { vinculoId: 'v2', nome: 'Camila Nunes', funcoes: ['Teclado'] },
    ],
    faltamResponderTotal: 2,
    faltaFuncao: ['Bateria'],
    musicas: 0,
    inscritos: 12,
    presentes: 0,
    lembraveis: 2,
    avisariaAoPublicar: 11,
    ...parcial,
  }
}

/** O momento "longe" (5 dias antes): o relógio do servidor é o `agora` dele. */
export function momentoDeTeste(parcial: Partial<MomentoDoInicio> = {}): MomentoDoInicio {
  return {
    agora: aDias(-5),
    evento: eventoDoMomento(),
    estado: 'longe',
    minutosParaInicio: 5 * 24 * 60,
    suaParte: [],
    inscricao: null,
    lider: null,
    recemTerminado: null,
    proximoAMarcar: null,
    ...parcial,
  }
}

/** Longe, véspera, no dia (3 h antes), acontecendo: o relógio e o estado andam juntos. */
export const RELOGIO = {
  longe: { agora: aDias(-5), estado: 'longe', minutosParaInicio: 5 * 24 * 60 },
  vespera: { agora: aHoras(-20), estado: 'vespera', minutosParaInicio: 20 * 60 },
  dia: { agora: aHoras(-3), estado: 'no_dia', minutosParaInicio: 180 },
  diaCheckin: { agora: aHoras(-1), estado: 'no_dia', minutosParaInicio: 60 },
  agora: { agora: aHoras(0.25), estado: 'acontecendo', minutosParaInicio: -15 },
} as const satisfies Record<string, Pick<MomentoDoInicio, 'agora' | 'estado' | 'minutosParaInicio'>>

/** O `GET /inicio` inteiro: o que a tela lê além do `momento`. */
export function inicioComMomento(
  momento: MomentoDoInicio,
  resto: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    proximosEventos: momento.evento
      ? [
          {
            id: momento.evento.id,
            titulo: momento.evento.titulo,
            categoria: momento.evento.categoria,
            inicio: momento.evento.inicio,
            duracaoMin: momento.evento.duracaoMin,
            status: momento.evento.status,
            localNome: momento.evento.local?.nome ?? null,
            localTipo: momento.evento.local?.tipo ?? null,
          },
        ]
      : [],
    minhasEscalas: momento.suaParte.map((p) => ({
      id: p.atribuicaoId,
      funcao: p.funcao,
      estado: p.estado,
      eventoId: momento.evento?.id ?? 'e1',
      eventoTitulo: momento.evento?.titulo ?? 'Sábado Jovem',
      eventoInicio: momento.evento?.inicio ?? INICIO,
      etapaTitulo: p.etapaTitulo,
    })),
    minhasTarefas: [],
    substituicoesAbertas: 0,
    momento,
    ...resto,
  }
}
