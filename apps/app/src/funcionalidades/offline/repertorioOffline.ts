import type { ClienteDaApi } from '@/servicos/api'
import { baixarPdfCom } from '@/servicos/contratoDoPdf'
import { pacoteMudou, type PacoteDoRepertorio, type PacoteInalterado } from '@/servicos/contratoV3'
import { ErroDaApi, ErroLocal } from '@/servicos/erros'

import type { Particao, RepertorioGuardado } from './tipos'

/**
 * Repertório do encontro para tocar sem internet (modo músico, fatia 2, D71). O servidor devolve
 * uma `versao` (a mesma do ETag): com ela o aparelho só baixa a cifra de novo se algo mudou. O
 * texto da música (letra e cifra) NUNCA vai para log: este módulo não registra nada.
 *
 * PDF da música (D76): o pacote traz só a referência (nome, tamanho e versão = SHA-256). Este módulo
 * baixa o binário para a mesma partição cifrada, só dos PDFs cuja versão o aparelho não tem (o
 * servidor ainda responde 304 pelo ETag), e tira os que saíram do repertório. Falha de um PDF não
 * derruba o resto: o resumo diz quantos faltam, e "Pronto para tocar sem internet" só vale com todos.
 */

const DIA_MS = 24 * 3600_000
/** Depois do início do encontro, a cópia fica 36 h (cobre o ensaio e o culto) e sai do aparelho. */
export const GUARDAR_APOS_O_INICIO_MS = 36 * 3600_000

/** `pedir` só é preciso para baixar PDF: quem só quer a lista e a cifra não precisa dele. */
type Cliente = Pick<ClienteDaApi, 'get'> & Partial<Pick<ClienteDaApi, 'pedir'>>

export const caminhoDoRepertorio = (comunidadeId: string, eventoId: string) =>
  `/api/v1/c/${comunidadeId}/eventos/${eventoId}/repertorio/pacote`

/** `baixado`: primeira vez; `atualizado`: a versão mudou; `em_dia`: já era a versão atual. */
export type ResultadoDoDownload = 'baixado' | 'atualizado' | 'em_dia'

const maisTarde = (a: string, b: string) => (Date.parse(a) >= Date.parse(b) ? a : b)

/**
 * Baixa o repertório do encontro para a partição. Se já há uma cópia, manda a versão que tem: o
 * servidor responde "inalterado" e só a validade é renovada (cada contato com o servidor renova,
 * D23). Erros (403 fora do louvor, 404, sem conexão) sobem para quem chamou.
 */
export async function baixarRepertorio(
  particao: Particao,
  cliente: Cliente,
  eventoId: string,
  agora: () => Date = () => new Date(),
): Promise<ResultadoDoDownload> {
  const atual = await particao.lerRepertorio(eventoId)
  const base = caminhoDoRepertorio(particao.comunidadeId, eventoId)
  const resposta = await cliente.get<PacoteDoRepertorio | PacoteInalterado>(
    atual ? `${base}?versao=${encodeURIComponent(atual.pacote.versao)}` : base,
  )
  const momento = agora()

  if (!pacoteMudou(resposta)) {
    if (!atual) throw new ErroLocal('O repertório não chegou. Tente de novo com a internet ligada.')
    const validoAte = new Date(momento.getTime() + atual.pacote.validadeDias * DIA_MS).toISOString()
    await particao.gravarRepertorio({ ...atual.pacote, validoAte }, atual.baixadoEm)
    await renovarParticao(particao, atual.pacote.validadeDias, validoAte, momento)
    // O pacote não mudou, mas um PDF pode ter ficado para trás numa tentativa anterior.
    await sincronizarPdfs(particao, cliente, eventoId, atual.pacote, momento)
    return 'em_dia'
  }

  await particao.gravarRepertorio(resposta, momento.toISOString())
  await renovarParticao(particao, resposta.validadeDias, resposta.validoAte, momento)
  await sincronizarPdfs(particao, cliente, eventoId, resposta, momento)
  return atual ? 'atualizado' : 'baixado'
}

/**
 * Deixa na partição exatamente os PDFs que o pacote pede, na versão que ele pede. Baixa só o que
 * falta ou mudou, um de cada vez (cada um pode ter até 10 MB). Sem o `pedir` do cliente, ou sem
 * internet no meio do caminho, o PDF fica para a próxima rodada: o resumo da partição diz quantos
 * faltam e a tela não promete "pronto" antes da hora.
 */
async function sincronizarPdfs(
  particao: Particao,
  cliente: Cliente,
  eventoId: string,
  pacote: PacoteDoRepertorio,
  momento: Date,
): Promise<void> {
  const comPdf = pacote.itens.filter((i) => i.pdf)
  await particao.removerPdfsForaDe(
    eventoId,
    comPdf.map((i) => i.musicaId),
  )
  const pedir = cliente.pedir
  if (!pedir || comPdf.length === 0) return
  const guardados = await particao.versoesDosPdfs(eventoId)
  for (const item of comPdf) {
    const pdf = item.pdf!
    const versaoGuardada = guardados[item.musicaId]
    if (versaoGuardada === pdf.versao) continue
    try {
      const baixado = await baixarPdfCom(
        { pedir },
        particao.comunidadeId,
        item.musicaId,
        versaoGuardada ?? null,
      )
      // 304: o aparelho já tem a versão atual (a guardada). Nada a regravar.
      if (!baixado) continue
      await particao.gravarPdf(
        eventoId,
        item.musicaId,
        { versao: baixado.versao || pdf.versao, nome: pdf.nome },
        baixado.bytes,
        momento.toISOString(),
      )
    } catch {
      // Sem internet, PDF removido (404) ou cota: este PDF fica para a próxima rodada, e o resumo
      // continua dizendo que falta. Nada do arquivo, nem o nome, vai a log.
    }
  }
}

async function renovarParticao(
  particao: Particao,
  validadeDias: number,
  validoAte: string,
  momento: Date,
): Promise<void> {
  const meta = await particao.meta()
  await particao.atualizarMeta({
    validadeDias,
    validoAte: maisTarde(meta.validoAte, validoAte),
    ultimaSincronizacao: momento.toISOString(),
  })
}

/** 403 (fora do louvor) e 404 (rascunho, apagado): a pessoa não pode mais ter a cópia. */
const perdeuOAcesso = (e: unknown) =>
  e instanceof ErroDaApi && (e.status === 403 || e.status === 404)

/**
 * Parte da sincronização da partição: tira as cópias de encontros que já passaram, confere a
 * versão das demais e apaga a de quem perdeu o acesso (saiu do louvor, encontro voltou a rascunho).
 * Falha de rede não derruba a rodada: a cópia antiga continua valendo até vencer.
 */
export async function atualizarRepertorios(
  particao: Particao,
  cliente: Cliente,
  agora: () => Date = () => new Date(),
): Promise<number> {
  let atualizados = 0
  for (const r of await particao.repertorios()) {
    if (Date.parse(r.pacote.evento.inicio) + GUARDAR_APOS_O_INICIO_MS < agora().getTime()) {
      await particao.removerRepertorio(r.eventoId)
      continue
    }
    try {
      if ((await baixarRepertorio(particao, cliente, r.eventoId, agora)) === 'atualizado') {
        atualizados++
      }
    } catch (e) {
      if (perdeuOAcesso(e)) await particao.removerRepertorio(r.eventoId)
    }
  }
  return atualizados
}

/** O encontro está perto? (de 6 h antes até 3 dias à frente): é quando baixar sozinho vale a pena. */
export function encontroEstaPerto(inicioIso: string, agora: Date = new Date()): boolean {
  const falta = Date.parse(inicioIso) - agora.getTime()
  return falta <= 3 * DIA_MS && falta >= -6 * 3600_000
}

/** A cópia guardada ainda vale? (a partição inteira já é apagada ao vencer; isto é a segunda trava). */
export function repertorioVale(r: RepertorioGuardado, agora: Date = new Date()): boolean {
  return Date.parse(r.validoAte) > agora.getTime()
}
