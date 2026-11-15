import { ALTURA, ESPACO } from '@uj/tokens'
import { Pressable, Switch, View } from 'react-native'

import { ALFA_DESABILITADO, comOpacidade } from './cor'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDoInterruptor {
  rotulo: string
  /** Diz o estado em texto ("Ligado, todos os dias às 07:00"). Padrão: "Ligado" ou "Desligado". */
  descricao?: string
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  desabilitado?: boolean
}

/**
 * Interruptor (seção 2.12.8): o `Switch` nativo à direita de uma linha de 56,
 * com o estado também em texto. No iOS, "Rótulos ligado/desligado" mostra I e
 * O: o sinal além da cor. Para notificações, versículo, Face ID e afins.
 */
export function Interruptor({
  rotulo,
  descricao,
  ligado,
  aoMudar,
  desabilitado = false,
}: PropsDoInterruptor) {
  const { cores, solido, escuro } = useTema()
  // No claro o tonal some no cartão branco: o trilho desligado usa o contorno (3,7:1).
  const desligado = escuro ? solido(cores.tonal) : cores.contorno
  const estado = descricao ?? (ligado ? 'Ligado' : 'Desligado')
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={rotulo}
      accessibilityHint={estado}
      aria-checked={ligado}
      aria-disabled={desabilitado}
      disabled={desabilitado}
      onPress={() => aoMudar(!ligado)}
      style={{
        minHeight: ALTURA.linha,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e12,
        paddingVertical: ESPACO.e8,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Texto
          variante="tituloItem"
          style={desabilitado ? { color: comOpacidade(cores.texto, ALFA_DESABILITADO) } : null}
        >
          {rotulo}
        </Texto>
        <Texto variante="legenda" cor="textoSuave">
          {estado}
        </Texto>
      </View>
      <Switch
        value={ligado}
        onValueChange={aoMudar}
        disabled={desabilitado}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        trackColor={{ false: desligado, true: cores.primaria }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={desligado}
      />
    </Pressable>
  )
}
