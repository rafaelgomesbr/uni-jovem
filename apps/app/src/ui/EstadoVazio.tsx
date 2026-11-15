import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Botao, type VarianteDoBotao } from './Botao'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDoEstadoVazio {
  icone: NomeDoIcone
  titulo: string
  descricao: string
  acao?: {
    titulo: string
    aoPressionar: () => void
    icone?: NomeDoIcone
    /** Padrão: secundário (o vazio raramente é a ação principal da tela). */
    variante?: VarianteDoBotao
  }
}

/** Estado vazio explica o porquê e, quando dá, oferece o próximo passo. */
export function EstadoVazio({ icone, titulo, descricao, acao }: PropsDoEstadoVazio) {
  const { cores } = useTema()
  return (
    <View
      style={{
        alignItems: 'center',
        gap: ESPACO.x2,
        paddingVertical: ESPACO.x6,
        paddingHorizontal: ESPACO.x2,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: cores.superficieRealce,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: ESPACO.x2,
        }}
      >
        <Icone nome={icone} cor={cores.destaque} tamanho={30} />
      </View>
      <Texto variante="subtitulo" centralizado accessibilityRole="header" nivel={3}>
        {titulo}
      </Texto>
      <Texto variante="apoio" cor="textoSuave" centralizado style={{ maxWidth: 360 }}>
        {descricao}
      </Texto>
      {acao ? (
        <Botao
          titulo={acao.titulo}
          aoPressionar={acao.aoPressionar}
          variante={acao.variante ?? 'secundario'}
          larguraTotal={false}
          style={{ alignSelf: 'center', marginTop: ESPACO.x3 }}
          {...(acao.icone ? { icone: acao.icone } : {})}
        />
      ) : null}
    </View>
  )
}
