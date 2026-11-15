import { ALTURA, ESPACO, RAIO, type Paleta } from '@uj/tokens'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

/** Variantes da 2.12.12. `local` e `destaque` são os nomes antigos de `quente`. */
export type TomDoChip =
  'neutro' | 'quente' | 'sucesso' | 'alerta' | 'erro' | 'info' | 'local' | 'destaque'

const TONS: Readonly<
  Record<'neutro' | 'quente' | 'sucesso' | 'alerta' | 'erro' | 'info', [keyof Paleta, keyof Paleta]>
> = {
  neutro: ['neutroFundo', 'textoSuave'],
  quente: ['quenteFundo', 'destaque'],
  sucesso: ['sucessoFundo', 'sucesso'],
  alerta: ['alertaFundo', 'alerta'],
  erro: ['erroFundo', 'erro'],
  info: ['infoFundo', 'info'],
}

export interface PropsDoChip {
  /** Uma ou duas palavras. */
  texto: string
  tom?: TomDoChip
  /** Ícone de 12 à esquerda (check em "Presente", alfinete em "Fixado"). */
  icone?: NomeDoIcone
  /** Ponto de 6 à esquerda ("Ao vivo"). */
  ponto?: boolean
}

/**
 * Chip de estado (seção 2.12.12): preenchido, 24 de altura, padding 10 por 4,
 * texto 12/16 600. Sempre texto; nunca é tocável (o que é tocável é pílula de
 * filtro). Dentro do cartão translúcido, o fundo é composto sobre o opaco.
 */
export function Chip({ texto, tom = 'quente', icone, ponto = false }: PropsDoChip) {
  const { cores, solido } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const nome = tom === 'local' || tom === 'destaque' ? 'quente' : tom
  const [fundo, frente] = TONS[nome]
  const cor = cores[frente]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e4,
        minHeight: ALTURA.chip,
        paddingHorizontal: ESPACO.e10,
        paddingVertical: ESPACO.e4,
        borderRadius: RAIO.pilula,
        backgroundColor: solido(cores[fundo]),
        borderWidth: aumentarContraste ? 1 : 0,
        borderColor: aumentarContraste ? cor : 'transparent',
      }}
    >
      {ponto ? (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cor }} />
      ) : null}
      {icone ? <Icone nome={icone} cor={cor} tamanho={12} peso="semibold" /> : null}
      <Texto variante="chip" style={{ color: cor }} numberOfLines={1}>
        {texto}
      </Texto>
    </View>
  )
}
