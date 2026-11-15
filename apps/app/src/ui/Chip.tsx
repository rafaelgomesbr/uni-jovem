import { ESPACO, RAIO } from '@uj/tokens'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

/**
 * `local` (padrão): o chip do mockup ("Na igreja"), coral suave. Os demais
 * marcam papel ou situação: fundo de realce, texto na cor do texto, ícone e
 * contorno na cor do tom (o texto carrega o sentido; a cor só reforça).
 */
export type TomDoChip = 'local' | 'neutro' | 'destaque' | 'sucesso' | 'alerta' | 'erro'

interface PropsDoChip {
  texto: string
  icone?: NomeDoIcone
  tom?: TomDoChip
}

/** Chip em pílula. Só informa: não é tocável. Pares conferidos no teste dos tokens. */
export function Chip({ texto, icone, tom = 'local' }: PropsDoChip) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const local = tom === 'local'
  const corDoTom = local ? cores.chipTexto : tom === 'neutro' ? cores.textoSuave : cores[tom]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.x1,
        paddingHorizontal: 10,
        paddingVertical: local ? 4 : 3,
        borderRadius: RAIO.pilula,
        backgroundColor: local ? cores.chipFundo : cores.superficieRealce,
        borderWidth: local && !aumentarContraste ? 0 : 1,
        borderColor: aumentarContraste
          ? cores.texto
          : tom === 'neutro'
            ? cores.bordaSuave
            : corDoTom,
      }}
    >
      {icone ? <Icone nome={icone} cor={corDoTom} tamanho={14} /> : null}
      <Texto variante="rotulo" cor={local ? 'chipTexto' : 'texto'}>
        {texto}
      </Texto>
    </View>
  )
}
