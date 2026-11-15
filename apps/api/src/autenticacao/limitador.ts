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

  /** A chave já passou do limite? (consulta, sem contar uma tentativa) */
  excedido(chave: string): boolean {
    const atual = this.janelas.get(chave)
    if (!atual || this.agora() - atual.inicio >= this.janelaMs) return false
    return atual.contagem >= this.maximo
  }

  /**
   * Conta uma FALHA. Para login: só a senha errada conta, então quem sabe só o
   * e-mail de alguém não consegue trancá-la fora com tentativas certas ou erradas
   * de outra rede (a chave combina e-mail e rede).
   */
  registrar(chave: string): void {
    this.tentar(chave)
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

/** Expande um IPv6 (com `::`) para os 8 grupos, sem zeros à esquerda. */
function gruposIpv6(ip: string): string[] {
  const [esquerda = '', direita] = ip.toLowerCase().split('::')
  const a = esquerda ? esquerda.split(':') : []
  const b = direita !== undefined && direita !== '' ? direita.split(':') : []
  const meio = direita === undefined ? [] : Array(8 - a.length - b.length).fill('0')
  return [...a, ...meio, ...b].map((g) => (parseInt(g, 16) || 0).toString(16))
}

/**
 * IP inteiro e normalizado, para limites em que a faixa pune gente demais
 * (D44: renovar a sessão). IPv4 mapeado em IPv6 vira IPv4; IPv6 sai com os 8
 * grupos, sem zeros à esquerda, para `2001:db8::1` e `2001:db8:0::1` serem um só.
 */
export function ipInteiro(ip: string): string {
  if (ip.includes('.')) return ip.replace(/^::ffff:/i, '')
  return gruposIpv6(ip).join(':')
}

/**
 * IP truncado para log e limite: /24 no IPv4, /48 no IPv6. O IPv6 é
 * normalizado antes (`2001:db8::1` e `2001:db8:0:1::1` caem no mesmo /48).
 */
export function truncarIp(ip: string): string {
  if (ip.includes('.')) {
    const partes = ip.replace(/^::ffff:/i, '').split('.')
    return `${partes.slice(0, 3).join('.')}.0`
  }
  return `${gruposIpv6(ip).slice(0, 3).join(':')}::/48`
}
