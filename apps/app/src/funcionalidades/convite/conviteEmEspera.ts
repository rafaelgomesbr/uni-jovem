/**
 * Convite aberto por quem ainda precisa entrar na conta que já tem. O token
 * fica só em memória até a pessoa entrar; depois disso a tela do convite o
 * retoma e ele é descartado. Nada vai para disco.
 */
let tokenEmEspera: string | null = null

export function guardarConviteEmEspera(token: string): void {
  tokenEmEspera = token
}

export function lerConviteEmEspera(): string | null {
  return tokenEmEspera
}

export function descartarConviteEmEspera(): void {
  tokenEmEspera = null
}
