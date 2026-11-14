import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Botao } from './Botao'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDoEstadoVazio {
  icone: NomeDoIcone
  titulo: string
  descricao: string
  acao?: { titulo: string; aoPressionar: () => void; icone?: NomeDoIcone }
}

/** Estado vazio explica o porquê e, quando dá, oferece o próximo passo. */
export function EstadoVazio({ icone, titulo, descricao, acao }: PropsDoEstadoVazio) {
  const { cores } = useTema()
  return (
    <View style={{ alignItems: 'center', gap: ESPACO.x3, paddingVertical: ESPACO.x4 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: cores.superficieElevada,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icone nome={icone} cor={cores.destaque} tamanho={28} />
      </View>
      <Texto variante="corpoForte" centralizado accessibilityRole="header">
        {titulo}
      </Texto>
      <Texto variante="apoio" cor="textoSuave" centralizado>
        {descricao}
      </Texto>
      {acao ? (
        <Botao
          titulo={acao.titulo}
          aoPressionar={acao.aoPressionar}
          variante="secundario"
          larguraTotal={false}
          {...(acao.icone ? { icone: acao.icone } : {})}
        />
      ) : null}
    </View>
  )
}
