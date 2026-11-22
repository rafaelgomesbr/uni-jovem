import { gravarPreferenciaLocal, lerPreferenciaLocal } from '@/estado/preferenciaLocal'

/**
 * Os cinco momentos de encanto do sol (6.3 do UX, 9.2 da direção A, D68). Cada um acontece UMA
 * vez por conta (guardado no aparelho: reinstalar pode repetir, e tudo bem) e, no máximo, um
 * por sessão do app. Nunca bloqueiam o toque. Quem exibe é a tela de cada momento; aqui mora
 * só a regra de "já viu?".
 *
 * 1. `aceitar`: o primeiro "Aceitar" da conta (Início).
 * 2. `presenca`: a primeira presença marcada pela liderança (Check-in).
 * 3. `publicou`: o primeiro encontro publicado (Início, Encontro).
 * 4. `tudoEmDia`: a primeira vez que o resumo diz "Tudo em dia" (Início).
 * 5. `banda`: a banda completa (Início do líder).
 */
export type TipoDeEncanto = 'aceitar' | 'presenca' | 'publicou' | 'tudoEmDia' | 'banda'

/** O texto de cada momento (também é o que a pessoa lê com Reduzir movimento). */
export const TEXTO_DO_ENCANTO: Readonly<Record<TipoDeEncanto, string>> = {
  aceitar: 'Que bom ter você {onde}.',
  presenca: 'Primeira presença marcada. Bom encontro!',
  publicou: 'Seu primeiro encontro está no ar.',
  tudoEmDia: 'Tudo em dia.',
  banda: 'Banda completa: {n} de {n}.',
}

/** Quanto tempo a faixa de texto fica (e o que "Reduzir movimento" mostra no lugar da animação). */
export const DURACAO_DO_ENCANTO_MS = 4_000

const chaveDaConta = (contaId: string) => `uj.encantos.${contaId}`

type Vistos = Partial<Record<TipoDeEncanto, true>>

/** O app já mostrou um encanto nesta sessão? Só um por vez de abertura do app. */
let jaHouveNestaSessao = false

/** Para os testes: cada teste começa como uma sessão nova, de uma conta que nunca viu nada. */
export function reiniciarEncantosParaTestes(): void {
  jaHouveNestaSessao = false
}

/**
 * Pede para mostrar um encanto. Devolve `true` (e já grava que a conta viu) só se a conta
 * nunca viu este e nenhum outro apareceu nesta sessão; senão `false`, e nada é gravado: o
 * momento fica para a próxima sessão. Falhar ao ler ou gravar nunca quebra a tela.
 */
export async function reivindicarEncanto(
  contaId: string | null | undefined,
  tipo: TipoDeEncanto,
): Promise<boolean> {
  if (!contaId || jaHouveNestaSessao) return false
  const vistos = (await lerPreferenciaLocal<Vistos>(chaveDaConta(contaId))) ?? {}
  // Outra chamada pode ter ganhado enquanto a leitura esperava.
  if (vistos[tipo] || jaHouveNestaSessao) return false
  jaHouveNestaSessao = true
  await gravarPreferenciaLocal(chaveDaConta(contaId), { ...vistos, [tipo]: true })
  return true
}

/** A conta já viu este encanto? (Para quem só quer ler, sem consumir.) */
export async function encantoJaVisto(
  contaId: string | null | undefined,
  tipo: TipoDeEncanto,
): Promise<boolean> {
  if (!contaId) return true
  const vistos = (await lerPreferenciaLocal<Vistos>(chaveDaConta(contaId))) ?? {}
  return !!vistos[tipo]
}
