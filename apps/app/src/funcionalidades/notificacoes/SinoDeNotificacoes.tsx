import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { Pressable, View } from 'react-native'

import { Icone } from '@/ui/Icone'
import { SeloDeContagem } from '@/ui/MarcasDeNovidade'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { textoDeNaoLidas, useNaoLidas } from './caixa'

export function rotuloDoSino(naoLidas: number | undefined): string {
  return naoLidas ? `Notificações, ${textoDeNaoLidas(naoLidas)}` : 'Notificações'
}

/**
 * Sino da linha do topo das raízes de aba (D42): alvo de 48, o selo com o número de não lidas e, a
 * partir da D75 (passada do vovô), a palavra "Notificações" ao lado do ícone: um sino sozinho não
 * diz o que abre. No cabeçalho compacto (a rolagem já escondeu o título) volta a ser só o ícone, que
 * ali tem a mesma ação e economiza a linha. O rótulo falado diz o número inteiro ("Notificações, 3
 * não lidas"). Abre a caixa de notificações.
 */
export function SinoDeNotificacoes({ comTexto = true }: { comTexto?: boolean }) {
  const { cores } = useTema()
  const { data: naoLidas } = useNaoLidas()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloDoSino(naoLidas)}
      accessibilityHint="Abre a caixa de notificações."
      onPress={() => router.push('/caixa-de-notificacoes')}
      style={({ pressed }) => ({
        minWidth: ALTURA.iconeSo,
        minHeight: ALTURA.iconeSo,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: comTexto ? ESPACO.e6 : ESPACO.e2,
        paddingLeft: comTexto ? ESPACO.e4 : 0,
        paddingRight: comTexto ? ESPACO.e12 : 0,
        borderRadius: comTexto ? RAIO.pilula : RAIO.controle,
        backgroundColor: pressed ? cores.pressionado : 'transparent',
      })}
    >
      {/* Mesma caixa de 40 de antes: o selo continua no canto do ícone. */}
      <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
        <Icone nome="sino" cor={cores.texto} tamanho={22} />
        {comTexto ? null : <SeloDeContagem valor={naoLidas ?? 0} />}
      </View>
      {comTexto ? (
        // O nome falado já é o rótulo do botão: o texto é só para quem enxerga.
        <Texto variante="botao" accessibilityElementsHidden importantForAccessibility="no">
          Notificações
        </Texto>
      ) : null}
      {/* Com a palavra, o número fica depois dela: sobre o ícone ele escondia o sino (D79). */}
      {comTexto ? <SeloDeContagem valor={naoLidas ?? 0} emLinha /> : null}
    </Pressable>
  )
}
