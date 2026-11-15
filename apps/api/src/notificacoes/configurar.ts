import type { Config } from '../config.ts'
import { lerChaveApns, transporteApns } from './apns.ts'
import { lerContaDeServico, transporteFcm } from './fcm.ts'
import { transporteEmArquivo, transportePorPlataforma, type TransportePush } from './transportes.ts'

/**
 * Transporte de push conforme PUSH_MODO. `desligado` devolve null: o
 * trabalhador nem sobe, e a fila fica para quando o envio for ligado (as
 * notificações vencem em 24 h e o job diário apaga as antigas).
 */
export async function criarTransporteDePush(c: Config): Promise<TransportePush | null> {
  switch (c.PUSH_MODO) {
    case 'desligado':
      return null
    case 'arquivo':
      return transporteEmArquivo(c.PUSH_ARQUIVO!)
    case 'real': {
      const android = c.FCM_CONTA_SERVICO_ARQUIVO
        ? transporteFcm({ conta: await lerContaDeServico(c.FCM_CONTA_SERVICO_ARQUIVO) })
        : undefined
      const ios = c.APNS_CHAVE_ARQUIVO
        ? transporteApns({
            chavePem: await lerChaveApns(c.APNS_CHAVE_ARQUIVO),
            chaveId: c.APNS_CHAVE_ID!,
            timeId: c.APNS_TIME_ID!,
            topico: c.APNS_TOPICO!,
          })
        : undefined
      return transportePorPlataforma({
        ...(android ? { android } : {}),
        ...(ios ? { ios } : {}),
      })
    }
  }
}
