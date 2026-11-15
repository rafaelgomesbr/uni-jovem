import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Transporte de notificação push: recebe UMA mensagem para UM aparelho e diz o
 * que aconteceu. Quem decide o que fazer com o resultado (repetir, expurgar o
 * token) é o trabalhador, com `uj.push_concluir`.
 *
 * Erros nunca levam o token nem o texto: só um código curto, que vai para o
 * banco (`envios_push.erro`) e para o log.
 */

export interface MensagemPush {
  token: string
  plataforma: 'ios' | 'android'
  ambienteApns: 'producao' | 'sandbox' | null
  titulo: string
  corpo: string
  /** Só identificadores (comunidade, tipo, recurso). Valores em texto. */
  dados: Record<string, string>
}

export type ResultadoDoEnvio =
  | { resultado: 'enviado' }
  | { resultado: 'token_invalido' | 'tentar_de_novo' | 'falhou'; erro: string }

export interface TransportePush {
  enviar(m: MensagemPush): Promise<ResultadoDoEnvio>
  encerrar?(): Promise<void>
}

/** Fim do token, para conferência em desenvolvimento sem gravar o token inteiro. */
export function finalDoToken(token: string): string {
  return `…${token.slice(-6)}`
}

/** Desenvolvimento e testes: grava, uma linha JSON por envio, o que iria para a rede. */
export function transporteEmArquivo(caminho: string): TransportePush {
  return {
    async enviar(m) {
      await mkdir(dirname(caminho), { recursive: true })
      const linha = {
        em: new Date().toISOString(),
        plataforma: m.plataforma,
        ambienteApns: m.ambienteApns,
        token: finalDoToken(m.token),
        titulo: m.titulo,
        corpo: m.corpo,
        dados: m.dados,
      }
      await appendFile(caminho, `${JSON.stringify(linha)}\n`, 'utf8')
      return { resultado: 'enviado' }
    },
  }
}

/** Escolhe o transporte pela plataforma; plataforma sem configuração falha sem repetir. */
export function transportePorPlataforma(t: {
  android?: TransportePush
  ios?: TransportePush
}): TransportePush {
  return {
    async enviar(m) {
      const alvo = m.plataforma === 'ios' ? t.ios : t.android
      if (!alvo) return { resultado: 'falhou', erro: 'plataforma_sem_configuracao' }
      return alvo.enviar(m)
    },
    async encerrar() {
      await Promise.all([t.android?.encerrar?.(), t.ios?.encerrar?.()])
    },
  }
}
