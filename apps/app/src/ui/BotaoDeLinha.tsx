import { ALTURA, BORDA, ESPACO, RAIO } from '@uj/tokens'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Texto } from './Texto'
import { useTema } from './tema'

/**
 * O DESENHO de um botão pequeno dentro de uma linha tocável ("Chegou" no
 * check-in). Quando a linha inteira é o alvo (48 pt ou mais, com fila na
 * porta), não pode haver botão de verdade dentro dela: botão dentro de botão
 * some do leitor de tela. A linha leva o nome acessível e a ação; isto só
 * mostra, em texto, o que o toque faz.
 *
 * D75 (teste do dono, 22/11/2026: "Chegou parece etiqueta, não botão"): cápsula de 48 com fundo
 * quente e CONTORNO de 2 na cor de destaque, que é o que faz um botão parecer botão. O estado
 * "Presente" é o oposto (verde, com ícone de check e a palavra), então um toque troca uma coisa
 * que se vê pela outra.
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
        backgroundColor: reduzirTransparencia ? cores.botaoTonalOpaco : solido(cores.quenteFundo),
        borderWidth: BORDA.contraste,
        borderColor: aumentarContraste ? cores.texto : cores.destaque,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Texto variante="botao" style={{ color: cores.destaque }}>
        {texto}
      </Texto>
    </View>
  )
}
