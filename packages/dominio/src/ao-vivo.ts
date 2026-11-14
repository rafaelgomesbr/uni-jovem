/**
 * Andamento ao vivo de um evento: máquina de estados pura. A API aplica os
 * comandos sobre o estado compartilhado; o app aplica os MESMOS comandos sobre
 * um estado local quando está sem conexão (marcado "só neste aparelho").
 */

export type SituacaoAoVivo = 'nao_iniciado' | 'em_andamento' | 'pausado' | 'encerrado'

export interface EstadoAoVivo {
  situacao: SituacaoAoVivo
  etapaAtualId: string | null
  etapaIniciadaEm: string | null
  iniciadoEm: string | null
  pausadoEm: string | null
  encerradoEm: string | null
}

export type ComandoAoVivo =
  | { tipo: 'iniciar' }
  | { tipo: 'avancar' }
  | { tipo: 'voltar' }
  | { tipo: 'ir_para'; etapaId: string }
  | { tipo: 'pausar' }
  | { tipo: 'retomar' }
  | { tipo: 'encerrar' }

export const ESTADO_INICIAL: EstadoAoVivo = {
  situacao: 'nao_iniciado',
  etapaAtualId: null,
  etapaIniciadaEm: null,
  iniciadoEm: null,
  pausadoEm: null,
  encerradoEm: null,
}

export type ResultadoAoVivo = { ok: true; estado: EstadoAoVivo } | { ok: false; motivo: string }

const recusa = (motivo: string): ResultadoAoVivo => ({ ok: false, motivo })

export function aplicarComando(
  estado: EstadoAoVivo,
  comando: ComandoAoVivo,
  etapas: readonly string[],
  agora: Date,
): ResultadoAoVivo {
  const t = agora.toISOString()
  const indice = estado.etapaAtualId ? etapas.indexOf(estado.etapaAtualId) : -1
  const em = (etapaId: string | null): EstadoAoVivo => ({
    ...estado,
    situacao: 'em_andamento',
    etapaAtualId: etapaId,
    etapaIniciadaEm: t,
    pausadoEm: null,
  })

  switch (comando.tipo) {
    case 'iniciar':
      if (estado.situacao !== 'nao_iniciado') return recusa('O evento já foi iniciado.')
      if (etapas.length === 0) return recusa('Cadastre ao menos uma etapa antes de iniciar.')
      return { ok: true, estado: { ...em(etapas[0]!), iniciadoEm: t } }
    case 'avancar':
      if (estado.situacao !== 'em_andamento') return recusa('O evento não está em andamento.')
      if (indice === etapas.length - 1) {
        return {
          ok: true,
          estado: { ...estado, situacao: 'encerrado', encerradoEm: t, pausadoEm: null },
        }
      }
      return { ok: true, estado: em(etapas[indice + 1]!) }
    case 'voltar':
      if (estado.situacao !== 'em_andamento') return recusa('O evento não está em andamento.')
      if (indice <= 0) return recusa('Já está na primeira etapa.')
      return { ok: true, estado: em(etapas[indice - 1]!) }
    case 'ir_para':
      if (estado.situacao !== 'em_andamento' && estado.situacao !== 'pausado') {
        return recusa('O evento não está em andamento.')
      }
      if (!etapas.includes(comando.etapaId)) return recusa('Etapa não encontrada neste evento.')
      return { ok: true, estado: em(comando.etapaId) }
    case 'pausar':
      if (estado.situacao !== 'em_andamento')
        return recusa('Só dá para pausar um evento em andamento.')
      return { ok: true, estado: { ...estado, situacao: 'pausado', pausadoEm: t } }
    case 'retomar':
      if (estado.situacao !== 'pausado') return recusa('O evento não está pausado.')
      return { ok: true, estado: { ...estado, situacao: 'em_andamento', pausadoEm: null } }
    case 'encerrar':
      if (estado.situacao !== 'em_andamento' && estado.situacao !== 'pausado') {
        return recusa('O evento não está em andamento.')
      }
      return {
        ok: true,
        estado: { ...estado, situacao: 'encerrado', encerradoEm: t, pausadoEm: null },
      }
  }
}

/**
 * Atraso (minutos, positivo = atrasado) da etapa atual: início real menos o
 * início previsto. Nulo se o evento não está em andamento.
 */
export function atrasoEmMinutos(
  estado: EstadoAoVivo,
  inicioPrevistoDaEtapa: Date | null,
): number | null {
  if (estado.situacao === 'nao_iniciado' || !estado.etapaIniciadaEm || !inicioPrevistoDaEtapa) {
    return null
  }
  return Math.round(
    (new Date(estado.etapaIniciadaEm).getTime() - inicioPrevistoDaEtapa.getTime()) / 60_000,
  )
}

/** Concessão de condução: renovada a cada comando; expira sem uso. */
export const CONCESSAO_DE_CONDUCAO_S = 120
