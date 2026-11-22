/**
 * Rascunhos provisórios (D74): "Igual ao último sábado" cria o rascunho assim que a tela abre, para
 * mostrar o que foi copiado. Quem salva ou publica o mantém; quem sai sem isso não quis o encontro.
 * A saída normal apaga o rascunho, mas se o app ou a aba fecharem de repente, ele ficaria solto na
 * Agenda ("Rascunhos (22)" no teste de 22/11/2026). Por isso o app anota o provisório no aparelho e,
 * na próxima vez que a tela abrir, apaga os que sobraram. Só rascunho se apaga (a API recusa o
 * resto), então apagar por engano um encontro publicado não é possível.
 */
import { gravarPreferenciaLocal, lerPreferenciaLocal } from '@/estado/preferenciaLocal'

const CHAVE = 'uj.rascunhos-provisorios'

interface Registro {
  comunidadeId: string
  eventoId: string
}

async function ler(): Promise<Registro[]> {
  const lista = await lerPreferenciaLocal<Registro[]>(CHAVE)
  return Array.isArray(lista) ? lista : []
}

/** Anota que este rascunho nasceu de uma conferência e ainda não foi mantido. */
export async function registrarProvisorio(comunidadeId: string, eventoId: string): Promise<void> {
  const lista = await ler()
  if (lista.some((r) => r.eventoId === eventoId)) return
  await gravarPreferenciaLocal(CHAVE, [...lista, { comunidadeId, eventoId }])
}

/** O rascunho foi mantido (salvo ou publicado) ou apagado: deixa de ser provisório. */
export async function esquecerProvisorio(eventoId: string): Promise<void> {
  const lista = await ler()
  if (!lista.some((r) => r.eventoId === eventoId)) return
  await gravarPreferenciaLocal(
    CHAVE,
    lista.filter((r) => r.eventoId !== eventoId),
  )
}

/**
 * Apaga os provisórios que sobraram de outras vezes nesta comunidade (o app fechou no meio) e os
 * esquece. `apagar` falhar por rede deixa o registro para a próxima vez; já não existir (404 ou
 * já publicado) é o mesmo que ter apagado.
 */
export async function limparProvisoriosAbandonados(
  comunidadeId: string,
  apagar: (eventoId: string) => Promise<unknown>,
  naoMexer: readonly string[] = [],
): Promise<number> {
  const sobras = (await ler()).filter(
    (r) => r.comunidadeId === comunidadeId && !naoMexer.includes(r.eventoId),
  )
  let apagados = 0
  for (const sobra of sobras) {
    try {
      await apagar(sobra.eventoId)
      apagados++
    } catch (erro) {
      const status = (erro as { status?: number }).status
      // Não é rede: o rascunho já não existe, ou já foi publicado. O registro não serve mais.
      if (status === undefined || (status !== 404 && status !== 409)) continue
    }
    await esquecerProvisorio(sobra.eventoId)
  }
  return apagados
}
