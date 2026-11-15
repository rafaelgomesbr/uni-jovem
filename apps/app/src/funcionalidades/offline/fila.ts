import type { ClienteDaApi } from '@/servicos/api'
import { ErroLocal } from '@/servicos/erros'
import { formatarDataEHora } from '@/utilidades/formatos'

import { MENSAGEM_SEM_PREPARO } from './mensagens'
import type {
  AlvoDaPresencaOffline,
  NovaAcao,
  NovaOperacao,
  OperacaoNaFila,
  Particao,
  RespostaDasOperacoes,
  ResultadoDaOperacao,
} from './tipos'
import { uuidV7 } from './uuidV7'

/**
 * Fila de saída (ADR 0005, D28). Toda operação nasce com chave de
 * idempotência (UUID v7), comunidade e vínculo gravados; o envio é em lote e
 * cada resposta é tratada uma a uma:
 * - `aceita` e `ja_aplicada` saem da fila;
 * - `rejeitada` fica em Pendências com o motivo (descartar, copiar, refazer);
 * - `conflito` guarda o estado do servidor para a pessoa escolher.
 */

/** O servidor aceita até 100 operações por lote. */
export const MAXIMO_POR_LOTE = 100
/** E até 50 comandos numa proposta do ao vivo. */
const MAXIMO_DE_COMANDOS = 50

export interface ResultadoDoRegistro {
  /** `desfeita`: a ação anulou outra que ainda não tinha saído do aparelho. */
  situacao: 'nova' | 'repetida' | 'desfeita'
  chave: string | null
}

function mesmoAlvo(a: AlvoDaPresencaOffline, b: AlvoDaPresencaOffline): boolean {
  if ('codigo' in a && 'codigo' in b) return a.codigo.toUpperCase() === b.codigo.toUpperCase()
  if ('inscricaoId' in a && 'inscricaoId' in b) return a.inscricaoId === b.inscricaoId
  if ('vinculoId' in a && 'vinculoId' in b) return a.vinculoId === b.vinculoId
  if ('nomeAvulso' in a && 'nomeAvulso' in b) {
    return a.nomeAvulso.trim().toLowerCase() === b.nomeAvulso.trim().toLowerCase()
  }
  return false
}

/**
 * Guarda uma ação feita sem conexão. A comunidade e o vínculo vêm da PARTIÇÃO
 * (não da tela): trocar de comunidade depois não muda o destino.
 */
export async function registrarAcao(
  particao: Particao,
  acao: NovaAcao,
  agora: Date = new Date(),
): Promise<ResultadoDoRegistro> {
  const meta = await particao.meta()
  if (!meta.vinculoId) throw new ErroLocal(MENSAGEM_SEM_PREPARO)
  const fila = await particao.operacoes()
  // Só o que nunca saiu do aparelho pode ser mexido; o resto pode já ter chegado ao servidor.
  const naoEnviadas = fila.filter((o) => o.estado === 'pendente' && o.tentativas === 0)
  let dados = acao.dados

  switch (acao.tipo) {
    case 'tarefa.concluir': {
      const d = acao.dados
      const anterior = naoEnviadas.find(
        (o) => o.tipo === 'tarefa.concluir' && o.dados.tarefaId === d.tarefaId,
      )
      if (anterior) {
        await particao.removerOperacao(anterior.chave)
        if (anterior.tipo === 'tarefa.concluir' && anterior.dados.concluida !== d.concluida) {
          return { situacao: 'desfeita', chave: null }
        }
      }
      break
    }
    case 'checklist.marcar': {
      const d = acao.dados
      const anterior = naoEnviadas.find(
        (o) => o.tipo === 'checklist.marcar' && o.dados.itemId === d.itemId,
      )
      if (anterior) {
        await particao.removerOperacao(anterior.chave)
        if (anterior.tipo === 'checklist.marcar' && anterior.dados.marcado !== d.marcado) {
          return { situacao: 'desfeita', chave: null }
        }
      }
      break
    }
    case 'presenca.registrar': {
      const d = acao.dados
      // Marcar a mesma pessoa de novo não cria outra presença (o servidor também une).
      const igual = fila.find(
        (o) =>
          o.tipo === 'presenca.registrar' &&
          o.estado === 'pendente' &&
          o.dados.eventoId === d.eventoId &&
          mesmoAlvo(o.dados, d),
      )
      if (igual) return { situacao: 'repetida', chave: igual.chave }
      break
    }
    case 'inscricao.intencao': {
      const d = acao.dados
      const igual = fila.find(
        (o) =>
          o.tipo === 'inscricao.intencao' &&
          o.estado === 'pendente' &&
          o.dados.eventoId === d.eventoId,
      )
      if (igual) return { situacao: 'repetida', chave: igual.chave }
      break
    }
    case 'ao_vivo.proposta': {
      const d = acao.dados
      const doEvento = fila.filter(
        (o) =>
          o.tipo === 'ao_vivo.proposta' &&
          o.estado === 'pendente' &&
          o.dados.eventoId === d.eventoId,
      )
      const aberta = naoEnviadas.find(
        (o) =>
          o.tipo === 'ao_vivo.proposta' &&
          o.dados.eventoId === d.eventoId &&
          o.dados.comandos.length + d.comandos.length <= MAXIMO_DE_COMANDOS,
      )
      if (aberta && aberta.tipo === 'ao_vivo.proposta') {
        await particao.atualizarOperacao(aberta.chave, {
          dados: { ...aberta.dados, comandos: [...aberta.dados.comandos, ...d.comandos] },
        })
        return { situacao: 'nova', chave: aberta.chave }
      }
      // Cada comando aplicado soma 1 à versão: a proposta seguinte parte de onde a anterior termina.
      const ultima = doEvento.at(-1)
      if (ultima && ultima.tipo === 'ao_vivo.proposta') {
        dados = {
          ...d,
          versaoBase: ultima.dados.versaoBase + ultima.dados.comandos.length,
        }
      }
      break
    }
  }

  const op = {
    chave: uuidV7(agora.getTime()),
    tipo: acao.tipo,
    comunidadeId: meta.comunidadeId,
    vinculoId: meta.vinculoId,
    criadaEm: agora.toISOString(),
    dados,
    eventoId: acao.eventoId,
    descricao: acao.descricao,
    contexto: acao.contexto ?? {},
  } as NovaOperacao
  return { situacao: await particao.enfileirar(op), chave: op.chave }
}

/** O que vai para o servidor: nada do contexto local. */
function paraEnvio(op: OperacaoNaFila) {
  return {
    chave: op.chave,
    tipo: op.tipo,
    vinculoId: op.vinculoId,
    criadaEm: op.criadaEm,
    dados: op.dados,
  }
}

export interface ResumoDoEnvio {
  enviadas: number
  aceitas: number
  rejeitadas: number
  conflitos: number
}

async function aplicarResultado(
  particao: Particao,
  op: OperacaoNaFila,
  r: ResultadoDaOperacao,
): Promise<keyof Omit<ResumoDoEnvio, 'enviadas'> | null> {
  switch (r.status) {
    case 'aceita':
    case 'ja_aplicada':
      await particao.removerOperacao(op.chave)
      return 'aceitas'
    case 'rejeitada':
      await particao.atualizarOperacao(op.chave, {
        estado: 'rejeitada',
        motivo: r.motivo ?? 'rejeitada',
        mensagem: r.mensagem ?? 'O servidor não aceitou esta alteração.',
      })
      return 'rejeitadas'
    case 'conflito':
      await particao.atualizarOperacao(op.chave, {
        estado: 'conflito',
        motivo: r.motivo ?? 'conflito',
        mensagem: r.mensagem ?? 'Isto mudou no servidor enquanto você estava sem conexão.',
        estadoDoServidor: r.estado ?? null,
      })
      return 'conflitos'
    default:
      // Resposta desconhecida: fica na fila e vai de novo (a chave impede duplicar).
      return null
  }
}

/**
 * Envia a fila da partição em lotes, em ordem. Erro de rede ou de sessão
 * sobe para quem chamou; o que já foi tratado fica tratado.
 */
export async function enviarFila(
  particao: Particao,
  cliente: Pick<ClienteDaApi, 'post'>,
): Promise<ResumoDoEnvio> {
  const resumo: ResumoDoEnvio = { enviadas: 0, aceitas: 0, rejeitadas: 0, conflitos: 0 }
  const pendentes = (await particao.operacoes()).filter((o) => o.estado === 'pendente')

  // Defesa extra: operação gravada para outra comunidade nunca é enviada daqui.
  for (const op of pendentes.filter((o) => o.comunidadeId !== particao.comunidadeId)) {
    await particao.atualizarOperacao(op.chave, {
      estado: 'rejeitada',
      motivo: 'outra_comunidade',
      mensagem: 'Esta alteração é de outra comunidade e não foi enviada.',
    })
    resumo.rejeitadas++
  }
  const envio = pendentes.filter((o) => o.comunidadeId === particao.comunidadeId)

  for (let i = 0; i < envio.length; i += MAXIMO_POR_LOTE) {
    const lote = envio.slice(i, i + MAXIMO_POR_LOTE)
    // Antes de enviar: daqui em diante a operação pode ter chegado, então não se mexe mais nela.
    for (const op of lote) {
      await particao.atualizarOperacao(op.chave, { tentativas: op.tentativas + 1 })
    }
    const resposta = await cliente.post<RespostaDasOperacoes>(
      `/api/v1/c/${particao.comunidadeId}/sync/operacoes`,
      { operacoes: lote.map(paraEnvio) },
    )
    resumo.enviadas += lote.length
    for (const [indice, r] of (resposta.resultados ?? []).entries()) {
      const op = (r.chave ? lote.find((o) => o.chave === r.chave) : undefined) ?? lote[indice]
      if (!op) continue
      const contagem = await aplicarResultado(particao, op, r)
      if (contagem) resumo[contagem]++
    }
  }
  return resumo
}

export async function descartarOperacao(particao: Particao, chave: string): Promise<void> {
  await particao.removerOperacao(chave)
}

/**
 * Refaz uma operação rejeitada ou em conflito: chave NOVA (a antiga já foi
 * respondida) e hora de agora. No ao vivo, parte da versão atual do servidor.
 */
export async function refazerOperacao(
  particao: Particao,
  chave: string,
  agora: Date = new Date(),
): Promise<string | null> {
  const op = (await particao.operacoes()).find((o) => o.chave === chave)
  if (!op) return null
  const meta = await particao.meta()
  let dados = op.dados
  let contexto = op.contexto
  if (op.tipo === 'ao_vivo.proposta' && op.estado === 'conflito') {
    const servidor = op.estadoDoServidor as { versao?: unknown } | null
    if (servidor && typeof servidor.versao === 'number') {
      dados = { ...op.dados, versaoBase: servidor.versao }
      contexto = { ...op.contexto, baseAoVivo: op.estadoDoServidor as never }
    }
  }
  const nova = {
    chave: uuidV7(agora.getTime()),
    tipo: op.tipo,
    comunidadeId: particao.comunidadeId,
    vinculoId: meta.vinculoId ?? op.vinculoId,
    criadaEm: agora.toISOString(),
    dados,
    eventoId: op.eventoId,
    descricao: op.descricao,
    contexto,
  } as NovaOperacao
  await particao.enfileirar(nova)
  await particao.removerOperacao(op.chave)
  return nova.chave
}

/** Texto para "Copiar": legível por gente, sem identificadores internos. */
export function textoParaCopiar(op: OperacaoNaFila): string {
  return [
    op.descricao,
    `Feita em ${formatarDataEHora(op.criadaEm)}.`,
    op.mensagem ? `Resposta do servidor: ${op.mensagem}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}
