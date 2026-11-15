import { ESPACO, RAIO, type Paleta } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

export type TipoDeAviso = 'info' | 'sucesso' | 'alerta'

const APARENCIA: Readonly<
  Record<TipoDeAviso, { cor: keyof Paleta; icone: NomeDoIcone; titulo: string }>
> = {
  info: { cor: 'destaque', icone: 'info', titulo: 'Para saber' },
  sucesso: { cor: 'sucesso', icone: 'confirmado', titulo: 'Pronto' },
  alerta: { cor: 'alerta', icone: 'erro', titulo: 'Atenção' },
}

interface PropsDoAviso {
  tipo?: TipoDeAviso
  titulo?: string
  children: ReactNode
  /** Anuncia ao leitor de tela quando aparece (ex.: "a tela foi atualizada"). */
  anunciar?: boolean
}

/**
 * Aviso que não é erro (informação, sucesso, atenção). Ícone e título dizem o
 * tipo; a cor da borda só reforça. Erros usam `AvisoDeErro`.
 */
export function Aviso({ tipo = 'info', titulo, children, anunciar = false }: PropsDoAviso) {
  const { cores } = useTema()
  const a = APARENCIA[tipo]
  return (
    <View
      accessible
      accessibilityRole={anunciar ? 'alert' : 'text'}
      accessibilityLiveRegion={anunciar ? 'polite' : 'none'}
      style={{
        flexDirection: 'row',
        gap: ESPACO.x3,
        padding: ESPACO.x3,
        borderRadius: RAIO.medio,
        borderWidth: 1.5,
        borderColor: cores[a.cor],
        backgroundColor: cores.superficie,
        alignSelf: 'stretch',
      }}
    >
      <Icone nome={a.icone} cor={cores[a.cor]} />
      <View style={{ flex: 1, gap: ESPACO.x1 }}>
        <Texto variante="corpoForte">{titulo ?? a.titulo}</Texto>
        {typeof children === 'string' ? <Texto variante="apoio">{children}</Texto> : children}
      </View>
    </View>
  )
}
