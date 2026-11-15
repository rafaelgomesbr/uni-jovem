import { ALTURA, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { Pressable } from 'react-native'

import { Icone } from '@/ui/Icone'
import { SeloDeContagem } from '@/ui/MarcasDeNovidade'
import { useTema } from '@/ui/tema'

import { textoDeNaoLidas, useNaoLidas } from './caixa'

export function rotuloDoSino(naoLidas: number | undefined): string {
  return naoLidas ? `Notificações, ${textoDeNaoLidas(naoLidas)}` : 'Notificações'
}

/**
 * Sino da linha do topo das raízes de aba (D42): só ícone, alvo de 44, e o
 * selo com o número de não lidas. O rótulo falado diz o número inteiro
 * ("Notificações, 3 não lidas"). Abre a caixa de notificações.
 */
export function SinoDeNotificacoes() {
  const { cores } = useTema()
  const { data: naoLidas } = useNaoLidas()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloDoSino(naoLidas)}
      accessibilityHint="Abre a caixa de notificações."
      onPress={() => router.push('/caixa-de-notificacoes')}
      style={({ pressed }) => ({
        width: ALTURA.iconeSo,
        height: ALTURA.iconeSo,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RAIO.controle,
        backgroundColor: pressed ? cores.pressionado : 'transparent',
      })}
    >
      <Icone nome="sino" cor={cores.texto} tamanho={22} />
      <SeloDeContagem valor={naoLidas ?? 0} />
    </Pressable>
  )
}
