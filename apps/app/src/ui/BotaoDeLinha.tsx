import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { View } from 'react-native'

import { Texto } from './Texto'
import { useTema } from './tema'

/**
 * O DESENHO de um botão pequeno dentro de uma linha tocável ("Chegou" no
 * check-in). Quando a linha inteira é o alvo (44 pt ou mais, com fila na
 * porta), não pode haver botão de verdade dentro dela: botão dentro de botão
 * some do leitor de tela. A linha leva o nome acessível e a ação; isto só
 * mostra, em texto, o que o toque faz.
 */
export function BotaoDeLinha({ texto }: { texto: string }) {
  const { cores } = useTema()
  return (
    <View
      style={{
        minHeight: ALTURA.chip + ESPACO.e12,
        paddingHorizontal: ESPACO.e16,
        borderRadius: RAIO.pilula,
        borderWidth: 1,
        borderColor: cores.campoBorda,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Texto variante="botao">{texto}</Texto>
    </View>
  )
}
