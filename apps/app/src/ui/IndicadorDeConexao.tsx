import { useNetInfo } from '@react-native-community/netinfo'
import { ESPACO, RAIO } from '@uj/tokens'
import { View } from 'react-native'

import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useAnunciar } from './useAnunciar'

/** Selo discreto "Sem conexão". Só aparece quando a rede caiu de fato. */
export function IndicadorDeConexao() {
  const { cores } = useTema()
  const { isConnected } = useNetInfo()
  const semConexao = isConnected === false

  // Avisa o leitor de tela na mudança: o selo visual sozinho não é anunciado.
  useAnunciar(semConexao ? 'Sem conexão com a internet' : null)

  if (!semConexao) return null
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel="Sem conexão com a internet. O que depende da rede fica indisponível."
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: ESPACO.x1,
        paddingHorizontal: ESPACO.x3,
        paddingVertical: ESPACO.x1,
        borderRadius: RAIO.pilula,
        borderWidth: 1,
        borderColor: cores.alerta,
        backgroundColor: cores.superficie,
      }}
    >
      <Icone nome="semConexao" cor={cores.alerta} tamanho={16} />
      <Texto variante="rotulo" cor="alerta">
        Sem conexão
      </Texto>
    </View>
  )
}
