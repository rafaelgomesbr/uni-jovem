import { ESPACO, RAIO, RITMO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { CartaoDeVidro, type PropsDoCartaoDeVidro } from './CartaoDeVidro'
import { CartaoDoMomento, type PropsDoCartaoDoMomento } from './CartaoDoMomento'
import { ProvedorDeSuperficie, useTema } from './tema'

/**
 * As três famílias de cartão da direção A (D65):
 * - `tinta`: o cartão de conteúdo. Tinta violeta translúcida, sem desfoque, fio de luz no
 *   topo (claro: branco a 80% com sombra). É o cartão de quase tudo.
 * - `momento`: o destaque da tela (um por tela). Moldura de luz, degradê, brilho e o sol.
 * - `plano`: opaco, sem sombra nem realce. Para o que fica dentro de folha, formulário ou
 *   qualquer lugar onde a tinta translúcida seria ruído (e para o texto em `erro`, que só
 *   passa AA sobre o opaco).
 */
export type VarianteDoCartao = 'tinta' | 'momento' | 'plano'

interface PropsComunsDoCartao {
  children?: ReactNode
  aoPressionar?: () => void
  rotuloAcessivel?: string
  dica?: string
  style?: StyleProp<ViewStyle>
}

export type PropsDoCartao =
  | ({ variante?: 'tinta' } & PropsDoCartaoDeVidro)
  | ({ variante: 'momento' } & PropsDoCartaoDoMomento)
  | ({ variante: 'plano' } & PropsComunsDoCartao)

/** Cartão plano: opaco, borda de 1 (2 com Aumentar contraste), padding 18. */
function CartaoPlano({
  children,
  aoPressionar,
  rotuloAcessivel,
  dica,
  style,
}: PropsComunsDoCartao) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const caixa: ViewStyle = {
    alignSelf: 'stretch',
    padding: RITMO.recuoDoCartao,
    borderRadius: RAIO.cartao,
    backgroundColor: cores.superficie,
    borderWidth: aumentarContraste ? 2 : 1,
    borderColor: aumentarContraste ? cores.texto : cores.superficieBorda,
  }
  return (
    <ProvedorDeSuperficie superficie="opaca">
      {aoPressionar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rotuloAcessivel}
          accessibilityHint={dica}
          onPress={aoPressionar}
          style={({ pressed }) => [
            caixa,
            pressed ? { backgroundColor: cores.pressionado } : null,
            style,
          ]}
        >
          {children}
        </Pressable>
      ) : (
        <View style={[caixa, style]}>{children}</View>
      )}
    </ProvedorDeSuperficie>
  )
}

/**
 * A porta única dos cartões: escolha a `variante` e os filhos fazem o resto (as cores dos
 * filhos leem a superfície certa). Detalhes de cada família em `CartaoDeVidro` (tinta, com
 * sobrancelha, título, ações e variante lista) e `CartaoDoMomento`.
 */
export function Cartao(props: PropsDoCartao) {
  if (props.variante === 'momento') {
    const { variante: _, ...resto } = props
    void _
    return <CartaoDoMomento {...resto} />
  }
  if (props.variante === 'plano') {
    const { variante: _, ...resto } = props
    void _
    return <CartaoPlano {...resto} />
  }
  const { variante: _, ...resto } = props
  void _
  return <CartaoDeVidro {...resto} />
}
