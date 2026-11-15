import type pg from 'pg'
import type { MensagemPush, ResultadoDoEnvio, TransportePush } from './transportes.ts'

/**
 * Trabalhador da fila de push, no próprio processo da API (papel uj_auth).
 *
 * Laço: reserva um lote (`uj.push_reservar`, que revalida vínculo, preferência
 * e sessão), envia um a um e grava o resultado (`uj.push_concluir`). Se o
 * processo cair no meio, a reserva vence e o envio volta à fila. Entre lotes,
 * espera `intervaloMs` ou um `acordar()` (gancho de aviso publicado).
 *
 * Parada limpa: `parar()` não pega lote novo, espera o envio em curso e fecha
 * as conexões do transporte.
 */

interface Linha {
  envio_id: string
  para_token: string
  para_plataforma: 'ios' | 'android'
  para_ambiente: 'producao' | 'sandbox' | null
  texto_titulo: string
  texto_corpo: string
  dados: Record<string, unknown>
}

export interface OpcoesDoTrabalhador {
  intervaloMs?: number
  lote?: number
  /** Só código e contagem, nunca token ou texto. */
  aoRegistrar?: (evento: string, detalhes: Record<string, unknown>) => void
}

export class TrabalhadorDePush {
  private parado = true
  private timer: NodeJS.Timeout | null = null
  private rodada: Promise<void> | null = null
  private pedirDeNovo = false
  private readonly intervaloMs: number
  private readonly lote: number

  constructor(
    private readonly pool: pg.Pool,
    private readonly transporte: TransportePush,
    private readonly opcoes: OpcoesDoTrabalhador = {},
  ) {
    this.intervaloMs = opcoes.intervaloMs ?? 5_000
    this.lote = opcoes.lote ?? 50
  }

  iniciar(): void {
    if (!this.parado) return
    this.parado = false
    this.agendar(0)
  }

  /** Antecipa a próxima rodada (há coisa nova na fila). */
  acordar(): void {
    if (this.parado) return
    if (this.rodada) {
      this.pedirDeNovo = true
      return
    }
    this.agendar(0)
  }

  async parar(): Promise<void> {
    this.parado = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    await this.rodada
    await this.transporte.encerrar?.()
  }

  private agendar(ms: number): void {
    if (this.parado) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.rodada = this.rodar().finally(() => {
        this.rodada = null
        const logo = this.pedirDeNovo
        this.pedirDeNovo = false
        this.agendar(logo ? 0 : this.intervaloMs)
      })
    }, ms)
    this.timer.unref()
  }

  private async rodar(): Promise<void> {
    try {
      // Lote cheio: provavelmente há mais; segue sem esperar.
      while (!this.parado && (await this.processarUmaVez()) >= this.lote) {
        /* continua */
      }
    } catch (e) {
      this.opcoes.aoRegistrar?.('push_falha_na_rodada', { erro: (e as Error).message })
    }
  }

  /** Um lote: reserva, envia e conclui. Devolve quantos envios foram tentados. */
  async processarUmaVez(): Promise<number> {
    const { rows } = await this.pool.query<Linha>('select * from uj.push_reservar($1, $2)', [
      this.lote,
      120,
    ])
    for (const l of rows) {
      const m: MensagemPush = {
        token: l.para_token,
        plataforma: l.para_plataforma,
        ambienteApns: l.para_ambiente,
        titulo: l.texto_titulo,
        corpo: l.texto_corpo,
        dados: Object.fromEntries(Object.entries(l.dados).map(([k, v]) => [k, String(v)])),
      }
      let r: ResultadoDoEnvio
      try {
        r = await this.transporte.enviar(m)
      } catch {
        r = { resultado: 'tentar_de_novo', erro: 'transporte_excecao' }
      }
      await this.pool.query('select uj.push_concluir($1, $2, $3)', [
        l.envio_id,
        r.resultado,
        r.resultado === 'enviado' ? null : r.erro,
      ])
      if (r.resultado !== 'enviado') {
        this.opcoes.aoRegistrar?.('push_nao_enviado', {
          resultado: r.resultado,
          erro: r.erro,
          plataforma: m.plataforma,
        })
      }
    }
    return rows.length
  }
}
