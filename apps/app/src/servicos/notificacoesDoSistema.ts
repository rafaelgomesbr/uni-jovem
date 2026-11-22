/**
 * Ponte com as notificações do sistema (iOS e Android). Na web, ver o
 * arquivo `.web.ts`: lá não há notificação (o Início mostra tudo).
 *
 * - Permissão é pedida só em contexto, por uma tela que explica o benefício
 *   (TC-09); nada aqui pede permissão sozinho.
 * - O versículo é agendado LOCALMENTE (funciona sem internet).
 * - O token nativo (APNs ou FCM) vai para a API, sem serviço intermediário.
 */
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { Linking, Platform } from 'react-native'

import { PREFIXO, type VersiculoAgendado } from '@/funcionalidades/versiculo/plano'

export type EstadoDaPermissao = 'concedida' | 'negada' | 'nao_perguntada' | 'indisponivel'

export const NOTIFICACOES_DISPONIVEIS = true

const CANAL_DO_VERSICULO = 'versiculo'
const CANAL_DOS_AVISOS = 'avisos'

function traduzir(p: Notifications.NotificationPermissionsStatus): EstadoDaPermissao {
  if (Platform.OS === 'ios') {
    const s = p.ios?.status
    if (
      s === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      s === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      s === Notifications.IosAuthorizationStatus.EPHEMERAL
    ) {
      return 'concedida'
    }
    if (s === Notifications.IosAuthorizationStatus.DENIED) return 'negada'
    return 'nao_perguntada'
  }
  if (p.granted) return 'concedida'
  // No Android 13+, depois de negar duas vezes o sistema não pergunta mais.
  return p.canAskAgain === false || p.status === 'denied' ? 'negada' : 'nao_perguntada'
}

export async function estadoDaPermissao(): Promise<EstadoDaPermissao> {
  try {
    return traduzir(await Notifications.getPermissionsAsync())
  } catch {
    return 'indisponivel'
  }
}

/** Chame só depois de a pessoa tocar em "Ativar" numa tela que explica (TC-09). */
export async function pedirPermissao(): Promise<EstadoDaPermissao> {
  try {
    await prepararCanais()
    return traduzir(await Notifications.requestPermissionsAsync())
  } catch {
    return 'indisponivel'
  }
}

export async function abrirAjustes(): Promise<void> {
  try {
    await Linking.openSettings()
  } catch {
    // Sem atalho no sistema: a tela já explica o caminho.
  }
}

/** Android: o canal define som e importância (precisa existir antes de agendar). */
async function prepararCanais() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CANAL_DO_VERSICULO, {
    name: 'Versículo do dia',
    description: 'Um versículo por dia, no horário que você escolher.',
    importance: Notifications.AndroidImportance.DEFAULT,
  })
  // Avisos enviados pelo servidor (convocações, lembretes): o FCM aponta para este canal.
  await Notifications.setNotificationChannelAsync(CANAL_DOS_AVISOS, {
    name: 'Avisos do grupo',
    description: 'Convocações, lembretes e avisos da sua comunidade.',
    importance: Notifications.AndroidImportance.HIGH,
  })
}

let apresentacaoConfigurada = false

/** Com o app aberto, a notificação aparece como banner (o padrão a esconderia no iOS). */
export function configurarApresentacao() {
  if (apresentacaoConfigurada) return
  apresentacaoConfigurada = true
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}

async function cancelarAgendados() {
  const agendadas = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(
    agendadas
      .filter((n) => n.identifier.startsWith(PREFIXO))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  )
}

/**
 * Troca os versículos agendados pelo plano novo. Só mexe nos do versículo
 * (identificador com prefixo próprio). Sem permissão, só cancela.
 */
export async function agendarVersiculos(plano: readonly VersiculoAgendado[]): Promise<number> {
  await cancelarAgendados()
  if (plano.length === 0 || (await estadoDaPermissao()) !== 'concedida') return 0
  await prepararCanais()
  for (const v of plano) {
    await Notifications.scheduleNotificationAsync({
      identifier: v.id,
      content: { title: v.titulo, body: v.corpo, data: { tipo: 'versiculo' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: v.quando,
        ...(Platform.OS === 'android' ? { channelId: CANAL_DO_VERSICULO } : {}),
      },
    })
  }
  return plano.length
}

export async function cancelarVersiculos(): Promise<void> {
  try {
    await cancelarAgendados()
  } catch {
    // Nada agendado ou módulo indisponível: nada a cancelar.
  }
}

export interface TokenDoAparelho {
  plataforma: 'ios' | 'android'
  token: string
  ambienteApns?: 'producao' | 'sandbox'
}

/**
 * Token nativo do aparelho (APNs no iOS, FCM no Android). Só com permissão.
 * Build de desenvolvimento usa o APNs de testes; homologação e produção, o real.
 */
export async function tokenDoAparelho(): Promise<TokenDoAparelho | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null
  if ((await estadoDaPermissao()) !== 'concedida') return null
  try {
    const t = await Notifications.getDevicePushTokenAsync()
    if (typeof t.data !== 'string' || !t.data) return null
    if (Platform.OS === 'android') return { plataforma: 'android', token: t.data }
    const variante = (Constants.expoConfig?.extra as { variante?: string } | undefined)?.variante
    return {
      plataforma: 'ios',
      token: t.data,
      ambienteApns: variante === 'desenvolvimento' ? 'sandbox' : 'producao',
    }
  } catch {
    // Sem chaves de push configuradas no build (ou sem Google Play): segue sem push remoto.
    return null
  }
}
