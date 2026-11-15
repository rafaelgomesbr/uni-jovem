/**
 * Contas do ao vivo, puras: tempo decorrido e restante da etapa, atraso
 * acumulado e quais comandos fazem sentido agora. Os comandos usam a MESMA
 * máquina de estados da API (`aplicarComando` de `@uj/dominio`), então a
 * tela nunca oferece um comando que o servidor recusaria por regra.
 */
import { aplicarComando, type ComandoAoVivo, type SituacaoAoVivo } from '@uj/dominio'

import type { EtapaAoVivo, RetratoAoVivo } from '@/servicos/contratoDosEventos'

export interface TempoDaEtapa {
  atual: EtapaAoVivo | null
  indiceAtual: number
  proxima: EtapaAoVivo | null
  decorridoMs: number
  /** Negativo quando a etapa passou do previsto. `null` sem etapa em curso. */
  restanteMs: number | null
  /** Atraso acumulado em minutos (positivo = atrasado; negativo = adiantado). */
  atrasoMin: number | null
  concluidas: number
  total: number
  /** Antes de começar: minutos de atraso para o início previsto (0 se ainda no horário). */
  atrasoParaComecarMin: number
}

export function calcularTempo(r: RetratoAoVivo, agoraMs: number): TempoDaEtapa {
  const indiceAtual = r.etapas.findIndex((e) => e.id === r.etapaAtualId)
  const atual = indiceAtual >= 0 ? r.etapas[indiceAtual]! : null
  const proxima =
    r.situacao === 'nao_iniciado'
      ? (r.etapas[0] ?? null)
      : r.situacao === 'encerrado'
        ? null
        : (r.etapas[indiceAtual + 1] ?? null)
  const concluidas = r.etapas.filter((e) => e.situacao === 'concluida').length
  const atrasoParaComecarMin =
    r.situacao === 'nao_iniciado'
      ? Math.max(0, Math.floor((agoraMs - Date.parse(r.evento.inicio)) / 60_000))
      : 0

  if (!atual || !r.etapaIniciadaEm || r.situacao === 'nao_iniciado') {
    return {
      atual: null,
      indiceAtual,
      proxima,
      decorridoMs: 0,
      restanteMs: null,
      atrasoMin: r.atrasoMin,
      concluidas,
      total: r.etapas.length,
      atrasoParaComecarMin,
    }
  }
  // Pausado ou encerrado: o relógio para no momento da pausa ou do fim.
  const fimDaContagem =
    r.situacao === 'pausado' && r.pausadoEm
      ? Date.parse(r.pausadoEm)
      : r.situacao === 'encerrado' && r.encerradoEm
        ? Date.parse(r.encerradoEm)
        : agoraMs
  const decorridoMs = Math.max(0, fimDaContagem - Date.parse(r.etapaIniciadaEm))
  const previstoMs = atual.duracaoMin * 60_000
  const excedenteMin = Math.max(0, Math.floor((decorridoMs - previstoMs) / 60_000))
  return {
    atual,
    indiceAtual,
    proxima,
    decorridoMs,
    restanteMs: previstoMs - decorridoMs,
    atrasoMin: r.atrasoMin === null ? null : r.atrasoMin + excedenteMin,
    concluidas,
    total: r.etapas.length,
    atrasoParaComecarMin,
  }
}

export function descreverAtraso(min: number | null): string {
  if (min === null) return 'Sem andamento ainda'
  if (min === 0) return 'No horário'
  if (min > 0) return `${min} min de atraso`
  return `${-min} min adiantado`
}

export const NOME_DA_SITUACAO: Readonly<Record<SituacaoAoVivo, string>> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
}

export type ControleDoAoVivo = 'iniciar' | 'voltar' | 'avancar' | 'pausar' | 'retomar' | 'encerrar'

/** Controles que aparecem em cada situação (os demais não fazem sentido na hora). */
export const CONTROLES_POR_SITUACAO: Readonly<Record<SituacaoAoVivo, readonly ControleDoAoVivo[]>> =
  {
    nao_iniciado: ['iniciar'],
    em_andamento: ['voltar', 'avancar', 'pausar', 'encerrar'],
    pausado: ['retomar', 'encerrar'],
    encerrado: [],
  }

/**
 * Pode executar o comando agora? Devolve o motivo da recusa (o mesmo texto
 * da API) para mostrar junto do botão desabilitado.
 */
export function motivoDaRecusa(r: RetratoAoVivo, controle: ControleDoAoVivo): string | null {
  const resultado = aplicarComando(
    r,
    { tipo: controle } as ComandoAoVivo,
    r.etapas.map((e) => e.id),
    new Date(),
  )
  return resultado.ok ? null : resultado.motivo
}
