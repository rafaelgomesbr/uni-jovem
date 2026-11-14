/**
 * Limitador de tentativas em janela fixa, em memória. Basta para um processo
 * único (o servidor roda uma instância no Mac mini); com mais de uma instância
 * o limite passa a ser por instância, limitação registrada em docs/RISCOS.md.
 *
 * Chaves combinam finalidade e alvo: `login:ip:1.2.3.0`, `login:email:x@y`.
 */
export class Limitador {
  private readonly janelas = new Map<string, { inicio: number; contagem: number }>()

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
    private readonly agora: () => number = Date.now,
  ) {}

  /** Registra uma tentativa; devolve false se a chave passou do limite. */
  tentar(chave: string): boolean {
    const t = this.agora()
    const atual = this.janelas.get(chave)
    if (!atual || t - atual.inicio >= this.janelaMs) {
      this.janelas.set(chave, { inicio: t, contagem: 1 })
      this.podar(t)
      return true
    }
    atual.contagem++
    return atual.contagem <= this.maximo
  }

  /** Segundos até a janela da chave reabrir (para o cabeçalho Retry-After). */
  segundosParaLiberar(chave: string): number {
    const atual = this.janelas.get(chave)
    if (!atual) return 0
    return Math.max(0, Math.ceil((atual.inicio + this.janelaMs - this.agora()) / 1000))
  }

  zerar(chave: string): void {
    this.janelas.delete(chave)
  }

  private podar(t: number): void {
    if (this.janelas.size < 10_000) return
    for (const [chave, j] of this.janelas) {
      if (t - j.inicio >= this.janelaMs) this.janelas.delete(chave)
    }
  }
}

/** IP truncado para log e limite: /24 no IPv4, /48 no IPv6. */
export function truncarIp(ip: string): string {
  if (ip.includes('.')) {
    const partes = ip.replace(/^::ffff:/, '').split('.')
    return `${partes.slice(0, 3).join('.')}.0`
  }
  return `${ip.split(':').slice(0, 3).join(':')}::`
}
