import { NativeTabs } from 'expo-router/native-tabs'
import { Platform } from 'react-native'

import { FAMILIA } from '@/ui/fontes'
import { ICONES } from '@/ui/Icone'
import { useTema } from '@/ui/tema'

import { ABAS } from './abas'

/**
 * Abas nativas no iOS e no Android. No iOS 26 a barra já vem com o vidro do
 * sistema (que respeita Reduzir transparência sozinho); por isso não há cor
 * de fundo no iOS. No Android, superfície opaca do tema.
 */
export function AbasDoApp() {
  const { cores } = useTema()
  return (
    <NativeTabs
      tintColor={cores.destaque}
      iconColor={{ default: cores.textoSuave, selected: cores.destaque }}
      labelStyle={{
        default: { color: cores.textoSuave, fontFamily: FAMILIA.textoForte },
        selected: { color: cores.destaque, fontFamily: FAMILIA.textoForte },
      }}
      {...(Platform.OS === 'android'
        ? { backgroundColor: cores.superficie, indicatorColor: cores.superficieElevada }
        : {})}
    >
      {ABAS.map((aba) => (
        <NativeTabs.Trigger key={aba.rota} name={aba.rota}>
          <NativeTabs.Trigger.Label>{aba.rotulo}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={ICONES[aba.icone].ios} md={ICONES[aba.icone].android} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  )
}
