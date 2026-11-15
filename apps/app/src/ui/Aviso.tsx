import { ESPACO, RAIO, type Paleta } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { useAnunciar } from './useAnunciar'
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
 *
 * Só vira um elemento único para o leitor de tela quando o conteúdo é texto:
 * com botões dentro, cada um precisa continuar alcançável no VoiceOver.
 */
export function Aviso({ tipo = 'info', titulo, children, anunciar = false }: PropsDoAviso) {
  const { cores } = useTema()
  const a = APARENCIA[tipo]
  const soTexto = typeof children === 'string'
  const tituloFinal = titulo ?? a.titulo
  // Com texto, o papel `alert` já fala na web; com botões dentro, não há alerta e a web anuncia.
  useAnunciar(anunciar ? (soTexto ? `${tituloFinal}. ${children}` : tituloFinal) : null, {
    naWeb: !soTexto,
  })
  return (
    <View
      {...(soTexto ? { accessible: true, accessibilityRole: anunciar ? 'alert' : 'text' } : {})}
      style={{
        flexDirection: 'row',
        gap: ESPACO.x3,
        padding: ESPACO.x4,
        borderRadius: RAIO.medio,
        borderWidth: 1.5,
        borderColor: cores[a.cor],
        backgroundColor: cores.superficie,
        alignSelf: 'stretch',
      }}
    >
      <Icone nome={a.icone} cor={cores[a.cor]} />
      <View style={{ flex: 1, gap: ESPACO.x1 }}>
        <Texto variante="corpoForte">{tituloFinal}</Texto>
        {soTexto ? <Texto variante="apoio">{children}</Texto> : children}
      </View>
    </View>
  )
}
