import { ESPACO, RAIO } from '@uj/tokens'
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'

import { LARGURA_DA_BARRA_LATERAL, NOME_DO_APP } from '@/constantes'
import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { Vidro } from '@/ui/Vidro'

import { ABAS } from './abas'

interface PropsDoBotaoDaAba extends Omit<TabTriggerSlotProps, 'ref'> {
  rotulo: string
  icone: NomeDoIcone
  lateral: boolean
}

/**
 * Botão de aba. O `ref` que o TabTrigger repassa é descartado de propósito:
 * o tipo dele (`Ref<View>` do componente) não casa com o do Pressable e nada
 * aqui precisa do nó.
 */
function BotaoDaAba({
  rotulo,
  icone,
  lateral,
  isFocused,
  onPress,
  onLongPress,
}: PropsDoBotaoDaAba) {
  const { cores } = useTema()
  const cor = isFocused ? cores.destaque : cores.textoSuave
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: !!isFocused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        minHeight: ALVO,
        minWidth: ALVO,
        flex: lateral ? undefined : 1,
        flexDirection: lateral ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: lateral ? 'flex-start' : 'center',
        gap: lateral ? ESPACO.x3 : 2,
        paddingHorizontal: lateral ? ESPACO.x3 : ESPACO.x1,
        paddingVertical: ESPACO.x2,
        borderRadius: RAIO.medio,
        backgroundColor: isFocused ? cores.superficieElevada : 'transparent',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icone nome={icone} cor={cor} tamanho={lateral ? 22 : 24} />
      <Texto variante={lateral ? 'corpoForte' : 'rotulo'} style={{ color: cor }}>
        {rotulo}
      </Texto>
    </Pressable>
  )
}

/**
 * Web: barra lateral em telas largas e barra inferior em telas estreitas.
 * As abas ficam como filhas diretas da TabList (e ela, filha direta de
 * `Tabs`): é só ali que o `Tabs` procura os gatilhos. O vidro da barra
 * inferior fica por trás, como fundo. A ordem no DOM acompanha a visual
 * (navegação antes do conteúdo na lateral). O TabSlot fica sempre na mesma
 * posição entre os filhos, então a tela não remonta ao redimensionar.
 */
export function AbasDoApp() {
  const { cores } = useTema()
  const { width } = useWindowDimensions()
  const lateral = width >= LARGURA_DA_BARRA_LATERAL

  const lista = (
    <TabList
      key="abas"
      accessibilityRole="tablist"
      accessibilityLabel="Seções do app"
      style={
        lateral
          ? {
              width: 248,
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: ESPACO.x1,
              padding: ESPACO.x4,
              borderRightWidth: 1,
              borderRightColor: cores.borda,
              backgroundColor: cores.superficie,
            }
          : {
              flexDirection: 'row',
              justifyContent: 'space-around',
              paddingHorizontal: ESPACO.x2,
              paddingVertical: ESPACO.x1,
              borderTopWidth: 1,
              borderTopColor: cores.borda,
            }
      }
    >
      {lateral ? null : <Vidro style={StyleSheet.absoluteFill} />}
      {lateral ? (
        <View style={{ paddingVertical: ESPACO.x4, paddingHorizontal: ESPACO.x3 }}>
          <Texto variante="titulo" accessibilityRole="text">
            {NOME_DO_APP}
          </Texto>
        </View>
      ) : null}
      {ABAS.map((aba) => (
        <TabTrigger key={aba.rota} name={aba.rota} href={aba.href} asChild>
          <BotaoDaAba rotulo={aba.rotulo} icone={aba.icone} lateral={lateral} />
        </TabTrigger>
      ))}
    </TabList>
  )

  return (
    <Tabs
      style={{ flex: 1, flexDirection: lateral ? 'row' : 'column', backgroundColor: cores.fundo }}
    >
      {lateral ? lista : null}
      <TabSlot key="conteudo" style={{ flex: 1 }} />
      {lateral ? null : lista}
    </Tabs>
  )
}
