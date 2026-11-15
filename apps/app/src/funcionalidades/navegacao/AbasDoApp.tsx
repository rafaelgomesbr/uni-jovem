import { TabList, TabSlot, Tabs } from 'expo-router/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ContextoDaBarraDeAbas } from '@/ui/Tela'
import { useTema } from '@/ui/tema'

import { espacoDaBarra, itensDaBarraFlutuante, propsDaBarraFlutuante } from './BarraDeAbas'

/**
 * Abas do celular: a barra flutuante do mockup (não a barra nativa do
 * sistema), igual no iOS e no Android. As telas reservam o espaço dela no fim
 * da rolagem pelo `ContextoDaBarraDeAbas`.
 */
export function AbasDoApp() {
  const { cores } = useTema()
  const margens = useSafeAreaInsets()
  return (
    <ContextoDaBarraDeAbas.Provider value={espacoDaBarra(margens.bottom)}>
      <Tabs style={{ flex: 1, backgroundColor: cores.fundo }}>
        <TabSlot key="conteudo" style={{ flex: 1 }} />
        <TabList key="abas" {...propsDaBarraFlutuante(margens.bottom)}>
          {itensDaBarraFlutuante()}
        </TabList>
      </Tabs>
    </ContextoDaBarraDeAbas.Provider>
  )
}
