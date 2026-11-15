import type { ClienteDaApi } from '@/servicos/api'
import type { DetalheDaComunidade } from '@/servicos/contrato'
import { ErroDaApi } from '@/servicos/erros'

import { enviarFila, type ResumoDoEnvio } from './fila'
import type { PacoteOffline, Particao, RespostaDasMudancas } from './tipos'

/**
 * Uma rodada de sincronização de uma partição: envia a fila, lê o log de
 * mudanças pelo cursor (D13), atualiza os eventos preparados quando algo
 * mudou e renova a validade (D23: `validade_offline_dias` da comunidade).
 */

const DIA_MS = 24 * 3600_000
const MAXIMO_DE_PAGINAS = 20
/** Pacote de evento que terminou há mais de um dia sai do aparelho (pacote mínimo). */
const GUARDAR_APOS_O_FIM_MS = DIA_MS

/** A conta perdeu o acesso à comunidade (404 do servidor): a partição precisa sumir. */
export class AcessoRevogado extends Error {
  constructor() {
    super('O acesso a esta comunidade terminou.')
    this.name = 'AcessoRevogado'
  }
}

const ehRevogacao = (e: unknown) => e instanceof ErroDaApi && e.status === 404

async function semRevogacao<T>(trabalho: () => Promise<T>): Promise<T> {
  try {
    return await trabalho()
  } catch (e) {
    if (ehRevogacao(e)) throw new AcessoRevogado()
    throw e
  }
}

export interface ResumoDaSincronizacao extends ResumoDoEnvio {
  mudancas: number
  recomecou: boolean
  pacotesAtualizados: number
  validoAte: string
}

type Cliente = Pick<ClienteDaApi, 'get' | 'post'>

export const caminhoDoPacote = (comunidadeId: string, eventoId: string) =>
  `/api/v1/c/${comunidadeId}/eventos/${eventoId}/pacote-offline`

/** Grava o pacote e renova a partição (cada contato com o servidor renova a validade). */
export async function guardarPacote(
  particao: Particao,
  pacote: PacoteOffline,
  agora: Date = new Date(),
): Promise<void> {
  await particao.gravarPacote(pacote, agora.toISOString())
  const meta = await particao.meta()
  await particao.atualizarMeta({
    vinculoId: pacote.vinculoId ?? meta.vinculoId,
    validadeDias: pacote.validadeDias,
    validoAte: pacote.validoAte,
    ultimaSincronizacao: agora.toISOString(),
    cursor: meta.cursor ?? pacote.cursor,
  })
}

export async function sincronizarParticao(
  particao: Particao,
  cliente: Cliente,
  agora: () => Date = () => new Date(),
): Promise<ResumoDaSincronizacao> {
  const base = `/api/v1/c/${particao.comunidadeId}`

  const envio = await semRevogacao(() => enviarFila(particao, cliente))
  // Confere o vínculo (404 = revogado) e lê a validade atual da comunidade.
  const detalhe = await semRevogacao(() => cliente.get<DetalheDaComunidade>(base))

  const meta = await particao.meta()
  const pacotes = await particao.pacotes()
  let cursor = meta.cursor
  let mudancas = 0
  let recomecou = false
  if (pacotes.length && cursor) {
    for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina++) {
      const r = await semRevogacao(() =>
        cliente.get<RespostaDasMudancas>(
          `${base}/sync/mudancas?cursor=${encodeURIComponent(cursor ?? '0:0')}`,
        ),
      )
      cursor = r.cursor
      // Cursor anterior à poda (D28): baixa tudo de novo.
      if (r.recomecar) {
        recomecou = true
        break
      }
      // Do log só se usa a contagem: o conteúdo nunca é guardado no aparelho.
      mudancas += r.mudancas.length
      if (!r.temMais) break
    }
  }

  const atualizar = recomecou || mudancas > 0 || envio.aceitas > 0
  let pacotesAtualizados = 0
  let vinculoId = meta.vinculoId
  for (const p of pacotes) {
    const fim = Date.parse(p.inicio) + p.duracaoMin * 60_000
    if (fim + GUARDAR_APOS_O_FIM_MS < agora().getTime()) {
      await particao.removerPacote(p.eventoId)
      continue
    }
    if (!atualizar) continue
    try {
      const novo = await cliente.get<PacoteOffline>(
        caminhoDoPacote(particao.comunidadeId, p.eventoId),
      )
      await particao.gravarPacote(novo, agora().toISOString())
      vinculoId = novo.vinculoId ?? vinculoId
      cursor ??= novo.cursor
      pacotesAtualizados++
    } catch (e) {
      // O evento sumiu ou deixou de ser visível: a cópia sai do aparelho.
      if (ehRevogacao(e)) {
        await particao.removerPacote(p.eventoId)
        continue
      }
      throw e
    }
  }

  const restantes = await particao.pacotes()
  const momento = agora()
  const validoAte = new Date(momento.getTime() + detalhe.validadeOfflineDias * DIA_MS).toISOString()
  await particao.atualizarMeta({
    vinculoId,
    validadeDias: detalhe.validadeOfflineDias,
    validoAte,
    ultimaSincronizacao: momento.toISOString(),
    cursor: restantes.length ? cursor : null,
  })
  return { ...envio, mudancas, recomecou, pacotesAtualizados, validoAte }
}
