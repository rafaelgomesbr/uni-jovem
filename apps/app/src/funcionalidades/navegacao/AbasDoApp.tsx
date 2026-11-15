import { useEffect } from 'react'
import { TabList, TabSlot, Tabs } from 'expo-router/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ContextoDaBarraDeAbas } from '@/ui/Tela'
import { useTema } from '@/ui/tema'
import { registrarRodape } from '@/ui/Toast'

import {
  espacoDaBarra,
  itensDaBarraFlutuante,
  propsDaBarraFlutuante,
  useTecladoAberto,
} from './BarraDeAbas'

/**
 * Abas do celular: a barra flutuante do mockup (não a barra nativa do
 * sistema), igual no iOS e no Android. As telas reservam o espaço dela no fim
 * da rolagem pelo `ContextoDaBarraDeAbas`; o toast aparece 12 acima dela.
 */
export function AbasDoApp() {
  const { cores } = useTema()
  const margens = useSafeAreaInsets()
  const teclado = useTecladoAberto()
  const espaco = espacoDaBarra(margens.bottom)
  // O toast vive na raiz: a barra diz onde termina enquanto está na tela.
  useEffect(() => registrarRodape(teclado ? 0 : espaco), [espaco, teclado])
  return (
    <ContextoDaBarraDeAbas.Provider value={espaco}>
      <Tabs style={{ flex: 1, backgroundColor: cores.fundo }}>
        <TabSlot key="conteudo" style={{ flex: 1 }} />
        <TabList key="abas" {...propsDaBarraFlutuante(margens.bottom, teclado)}>
          {itensDaBarraFlutuante()}
        </TabList>
      </Tabs>
    </ContextoDaBarraDeAbas.Provider>
  )
}
