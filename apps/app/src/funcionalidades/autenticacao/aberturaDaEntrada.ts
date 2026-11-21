/**
 * A cascata de abertura (780 ms) roda uma vez por abertura do app, na primeira
 * vez que a tela de entrada aparece. Voltar de Criar conta, fechar o painel de
 * e-mail ou chegar com convite guardado entra na versão curta. A memória é do
 * módulo (some ao fechar o app), nada vai para disco.
 */
let jaMostrada = false

/** Primeira vez desta abertura do app? Quem pergunta consome o direito de abrir completa. */
export function consumirAberturaCompleta(): boolean {
  const primeira = !jaMostrada
  jaMostrada = true
  return primeira
}

/** Só os testes: volta a ser a primeira abertura. */
export function reiniciarAberturaParaTeste(): void {
  jaMostrada = false
}
