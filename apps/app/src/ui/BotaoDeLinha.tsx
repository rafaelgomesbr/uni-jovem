import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Texto } from './Texto'
import { useTema } from './tema'

/**
 * O DESENHO de um botão pequeno dentro de uma linha tocável ("Chegou" no
 * check-in). Quando a linha inteira é o alvo (44 pt ou mais, com fila na
 * porta), não pode haver botão de verdade dentro dela: botão dentro de botão
 * some do leitor de tela. A linha leva o nome acessível e a ação; isto só
 * mostra, em texto, o que o toque faz.
 *
 * Mesma gramática do `Botao` (D64): cápsula tonal de 40, sem contorno.
 */
export function BotaoDeLinha({ texto }: { texto: string }) {
  const { cores, solido } = useTema()
  const { reduzirTransparencia, aumentarContraste } = usePreferenciasDeAcessibilidade()
  return (
    <View
      style={{
        minHeight: ALTURA.botao.compacto,
        paddingHorizontal: ESPACO.e16,
        borderRadius: RAIO.pilula,
        backgroundColor: reduzirTransparencia ? cores.botaoTonalOpaco : solido(cores.botaoTonal),
        borderWidth: aumentarContraste ? 2 : 0,
        borderColor: aumentarContraste ? cores.texto : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Texto variante="botao">{texto}</Texto>
    </View>
  )
}
