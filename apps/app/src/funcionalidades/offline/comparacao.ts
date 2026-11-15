/**
 * "Sua versão" × "versão do servidor" de uma operação em conflito, em texto
 * humano. A pessoa escolhe; nada é decidido em silêncio (ADR 0005).
 */
import type { RetratoAoVivo } from '@/servicos/contratoDosEventos'

import { NOME_DA_SITUACAO } from '../aoVivo/tempo'
import { quandoNoAparelho } from './formatos'
import type { ComandoOffline, OperacaoNaFila } from './tipos'
import { retratoLocal } from './vistaLocal'

export const ROTULO_DO_COMANDO: Readonly<Record<ComandoOffline, string>> = {
  iniciar: 'Iniciar',
  avancar: 'Avançar etapa',
  voltar: 'Voltar etapa',
  ir_para: 'Ir para uma etapa',
  pausar: 'Pausar',
  retomar: 'Retomar',
  encerrar: 'Encerrar',
}

function ehRetrato(v: unknown): v is RetratoAoVivo {
  return !!v && typeof v === 'object' && 'situacao' in v && 'etapas' in v
}

function resumoDoAndamento(r: RetratoAoVivo): string[] {
  const atual = r.etapas.find((e) => e.situacao === 'atual')
  const concluidas = r.etapas.filter((e) => e.situacao === 'concluida').length
  return [
    `Situação: ${NOME_DA_SITUACAO[r.situacao]}`,
    atual ? `Etapa atual: ${atual.titulo}` : null,
    `${concluidas} de ${r.etapas.length} etapas concluídas`,
    r.condutor?.nome ? `Conduzido por ${r.condutor.nome}` : null,
  ].filter((l): l is string => l !== null)
}

export function suaVersao(op: OperacaoNaFila): string[] {
  const quando = `Feita em ${quandoNoAparelho(op.criadaEm)}`
  switch (op.tipo) {
    case 'tarefa.concluir':
      return [op.dados.concluida ? 'Concluir a tarefa' : 'Reabrir a tarefa', quando]
    case 'checklist.marcar':
      return [op.dados.marcado ? 'Marcar o item' : 'Desmarcar o item', quando]
    case 'ao_vivo.proposta': {
      const linhas = op.dados.comandos.map(
        (c) => `${ROTULO_DO_COMANDO[c.comando]} às ${quandoNoAparelho(c.ocorridoEm)}`,
      )
      const base = op.contexto.baseAoVivo
      return base
        ? [...linhas, ...resumoDoAndamento(retratoLocal(base, op.dados.comandos, new Date()))]
        : linhas
    }
    case 'presenca.registrar':
      return [`Presença${op.contexto.nome ? ` de ${op.contexto.nome}` : ''}`, quando]
    case 'inscricao.intencao':
      return ['Intenção de inscrição', quando]
  }
}

export function versaoDoServidor(op: OperacaoNaFila): string[] {
  const s = op.estadoDoServidor
  if (ehRetrato(s)) return resumoDoAndamento(s)
  if (s && typeof s === 'object') {
    const marca =
      (s as { concluida_em?: string | null }).concluida_em ??
      (s as { marcado_em?: string | null }).marcado_em
    if (marca) return [`Concluído em ${quandoNoAparelho(marca)} por outra pessoa`]
    if (marca === null) return ['Aberto no servidor']
  }
  return [op.mensagem ?? 'O servidor tem outra versão.']
}
