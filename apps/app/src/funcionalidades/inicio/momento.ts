import { ehConvocacaoDeLouvor } from '@uj/dominio'
import type { MomentoDoDia } from '@uj/tokens'

import type { MomentoDoInicio, ParteDoMomento } from '@/servicos/contratoV3'
import { formatarHora } from '@/utilidades/datas'

import { dataCurta, diasAte, faixaDeHorario } from './quando'

/**
 * A lógica do cartão do momento (seções 3.1 e 3.2 do UX, D68), sem tela: o que o relógio, o
 * papel e a parte da pessoa decidem. Funções puras, para testar cada linha das tabelas sem
 * montar nada. Os textos que não dependem do relógio ficam nos componentes.
 */

/** O momento do dia que a `Tela` e o sol usam: o relógio do encontro, ou "fim" depois dele. */
export function momentoDoDia(m: MomentoDoInicio): MomentoDoDia {
  if (!m.evento && m.recemTerminado) return 'fim'
  switch (m.estado) {
    case 'vespera':
      return 'vespera'
    case 'no_dia':
      return 'dia'
    case 'acontecendo':
      return 'agora'
    case 'terminou':
      return 'fim'
    default:
      // Quem serviu no encontro de ontem vê o poente até 24 h depois.
      return m.recemTerminado?.euServi ? 'fim' : 'longe'
  }
}

/** "Louvor · Vocal": a etapa e a função (a convocação ao encontro todo é só a função). */
export function descreverParte(p: Pick<ParteDoMomento, 'funcao' | 'etapaTitulo'>): string {
  return p.etapaTitulo ? `${p.etapaTitulo} · ${p.funcao}` : p.funcao
}

/** "no Louvor", "em Recepção": o lugar da pessoa, para frases como "Que bom ter você no Louvor." */
export function emOnde(p: Pick<ParteDoMomento, 'funcao' | 'etapaTitulo'>): string {
  const onde = p.etapaTitulo ?? p.funcao
  const nome = onde.charAt(0).toLocaleUpperCase('pt-BR') + onde.slice(1)
  return nome === 'Louvor' ? 'no Louvor' : `em ${nome}`
}

/** A pessoa toca no louvor neste encontro (convocação de louvor confirmada)? */
export function tocaNoLouvor(
  partes: readonly Pick<ParteDoMomento, 'funcao' | 'etapaTitulo' | 'estado'>[],
): boolean {
  return partes.some(
    (p) =>
      p.estado === 'confirmada' &&
      ehConvocacaoDeLouvor({ funcao: p.funcao, etapaTitulo: p.etapaTitulo }),
  )
}

/** Tempo até o início em linguagem curta: "EM 3 H", "EM 40 MIN". */
function tempoCurto(minutos: number): string {
  if (minutos < 60) return `EM ${Math.max(1, Math.round(minutos))} MIN`
  return `EM ${Math.round(minutos / 60)} H`
}

/**
 * A etiqueta do alto do cartão (a primeira coisa lida): `EM 5 DIAS`, `AMANHÃ · 16:00`,
 * `HOJE · EM 3 H`, `ACONTECENDO AGORA`, `TERMINOU`. O rascunho (só a organização) ganha o
 * prefixo `RASCUNHO · `.
 */
export function etiquetaDoMomento(m: MomentoDoInicio): string {
  const evento = m.evento
  if (!evento) return m.recemTerminado ? 'TERMINOU' : 'NADA MARCADO'
  let texto: string
  switch (m.estado) {
    case 'acontecendo':
      texto = 'ACONTECENDO AGORA'
      break
    case 'terminou':
      texto = 'TERMINOU'
      break
    case 'vespera':
      texto = `AMANHÃ · ${formatarHora(evento.inicio, evento.fuso)}`
      break
    case 'no_dia':
      texto = `HOJE · ${tempoCurto(m.minutosParaInicio ?? 0)}`
      break
    default: {
      const dias = diasAte(evento.inicio, evento.fuso, new Date(m.agora))
      texto = dias <= 1 ? 'AMANHÃ' : `EM ${dias} DIAS`
    }
  }
  return evento.status === 'rascunho' ? `RASCUNHO · ${texto}` : texto
}

/**
 * Quando a cópia que a tela mostra foi salva: "hoje, 14:32" (ou "21/11, 14:32" se foi em outro
 * dia). É o que a etiqueta "Última versão" e a faixa "Sem internet" dizem. Hora do aparelho.
 */
export function quandoFoiSalva(salvaEm: number, agora: Date = new Date()): string {
  const quando = new Date(salvaEm)
  const dois = (n: number) => String(n).padStart(2, '0')
  const hora = `${dois(quando.getHours())}:${dois(quando.getMinutes())}`
  const mesmoDia =
    quando.getFullYear() === agora.getFullYear() &&
    quando.getMonth() === agora.getMonth() &&
    quando.getDate() === agora.getDate()
  return mesmoDia
    ? `hoje, ${hora}`
    : `${dois(quando.getDate())}/${dois(quando.getMonth() + 1)}, ${hora}`
}

/** "Sáb., 28 de nov. · 16:00 às 17:00". */
export function dataEHorario(inicio: string, duracaoMin: number, fuso: string): string {
  return `${dataCurta(inicio, fuso)} · ${faixaDeHorario(inicio, duracaoMin, fuso)}`
}

// ------------------------------------------------------------------ o que o botão faz

/** O que o botão do cartão faz. O primário muda conforme o relógio, o papel e a parte (D68). */
export type AcaoDoMomento =
  | 'aceitar'
  | 'naoPossoIr'
  | 'aoVivo'
  | 'comoChegar'
  | 'repertorio'
  | 'inscrever'
  | 'ver'
  | 'verProximo'
  | 'publicar'
  | 'editar'
  | 'lembrar'
  | 'convocarFuncao'
  | 'verConvocados'
  | 'checkin'
  | 'conduzir'
  | 'marcarProximo'
  | 'verResumo'

export interface AcoesDoCartao {
  primaria: AcaoDoMomento
  secundaria: AcaoDoMomento | null
}

export interface SituacaoDoMembro {
  momento: MomentoDoDia
  /** Há uma convocação deste encontro esperando resposta (a pendência vence o relógio). */
  pendente: boolean
  /** Toca no louvor com a convocação já confirmada. */
  musicoConfirmado: boolean
  /** Encontro público com inscrição aberta e a pessoa ainda não está inscrita. */
  podeSeInscrever: boolean
  /** O encontro de ontem acabou de terminar e este é o próximo. */
  depoisDeUmEncontro: boolean
}

/**
 * A tabela do membro (3.1 do UX). A convocação pendente vence o relógio: o primário é
 * "Aceitar" até o dia, e no dia também. Acontecendo: "Acompanhar ao vivo". Véspera e dia:
 * "Como chegar". Longe: o músico confirmado abre o repertório, quem pode se inscrever
 * inscreve-se, o resto só vê o encontro.
 */
export function acoesDoMembro(s: SituacaoDoMembro): AcoesDoCartao {
  if (s.pendente) return { primaria: 'aceitar', secundaria: 'naoPossoIr' }
  if (s.momento === 'agora') return { primaria: 'aoVivo', secundaria: null }
  if (s.momento === 'vespera' || s.momento === 'dia') {
    return { primaria: 'comoChegar', secundaria: 'ver' }
  }
  if (s.musicoConfirmado) return { primaria: 'repertorio', secundaria: 'ver' }
  if (s.podeSeInscrever) return { primaria: 'inscrever', secundaria: 'ver' }
  if (s.depoisDeUmEncontro) return { primaria: 'verProximo', secundaria: null }
  return { primaria: 'ver', secundaria: null }
}

export interface SituacaoDoLider {
  momento: MomentoDoDia
  rascunho: boolean
  /** Quantas pessoas o lembrete alcançaria agora ("Lembrar os 2"). */
  lembraveis: number
  /** Convocados sem resposta (inclui quem já foi lembrado nas últimas 24 h). */
  pendentes: number
  /** Funções já convocadas sem ninguém que aceitou. */
  faltaFuncao: readonly string[]
  /** Faltam 2 h ou menos para começar: hora do check-in. */
  naHoraDoCheckin: boolean
  /** O cartão é o do encontro que terminou há menos de 24 h. */
  terminou: boolean
  /** Nada marcado depois do encontro que terminou. */
  proximoAMarcar: boolean
  /** Não há encontro nenhum. */
  semEncontro: boolean
}

/**
 * A tabela do líder (3.2 do UX). Sem encontro, ou terminado sem outro marcado: "Marcar o
 * próximo sábado". Rascunho: "Publicar e avisar N pessoas". Publicado e longe: lembrar quem
 * não respondeu, ou convocar a função que falta, ou só ver o encontro quando está tudo
 * respondido. Véspera: "Ver convocados". No dia, de 2 h antes: "Fazer check-in".
 * Acontecendo: "Conduzir ao vivo".
 */
export function acoesDoLider(s: SituacaoDoLider): AcoesDoCartao {
  if (s.semEncontro || (s.terminou && s.proximoAMarcar)) {
    return { primaria: 'marcarProximo', secundaria: s.terminou ? 'verResumo' : null }
  }
  if (s.rascunho) return { primaria: 'publicar', secundaria: 'editar' }
  if (s.momento === 'agora') return { primaria: 'conduzir', secundaria: 'checkin' }
  if (s.momento === 'dia' && s.naHoraDoCheckin) return { primaria: 'checkin', secundaria: 'aoVivo' }
  if (s.momento === 'vespera' || s.momento === 'dia') {
    return { primaria: 'verConvocados', secundaria: 'ver' }
  }
  // Longe e publicado.
  if (s.lembraveis > 0) return { primaria: 'lembrar', secundaria: 'verConvocados' }
  if (s.faltaFuncao.length > 0) return { primaria: 'convocarFuncao', secundaria: 'verConvocados' }
  if (s.pendentes > 0) return { primaria: 'verConvocados', secundaria: 'ver' }
  return { primaria: 'ver', secundaria: 'repertorio' }
}
