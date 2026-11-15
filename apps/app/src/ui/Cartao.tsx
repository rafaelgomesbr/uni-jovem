import { ESPACO, RAIO, RITMO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { ContextoDeSuperficie, useTema } from './tema'

export type VarianteDoCartao = 'vidro' | 'destaque'

interface PropsDoCartao {
  children?: ReactNode
  /** Sobrancelha do cartão (12 pt, maiúsculas, coral), anunciada como cabeçalho. */
  titulo?: string
  /** Uma linha abaixo da sobrancelha, quando ajuda a entender o cartão. */
  descricao?: string
  /** Ícone pequeno ao lado da sobrancelha, na mesma cor. */
  icone?: NomeDoIcone
  /** Ação curta à direita da sobrancelha (ex.: botão terciário "Ver todos"). */
  acao?: ReactNode
  /**
   * `vidro` (padrão): translúcido sobre a aurora. `destaque`: o item principal
   * da tela, claro no tema escuro (paleta própria para tudo o que vai dentro).
   */
  variante?: VarianteDoCartao
  style?: StyleProp<ViewStyle>
}

/**
 * Cartão da linguagem Aurora: raio 22, preenchimento 18, sobrancelha coral.
 * Com "Reduzir transparência", o vidro vira superfície opaca; com "Aumentar
 * contraste", ganha borda na cor do texto.
 */
export function Cartao({ variante = 'vidro', ...props }: PropsDoCartao) {
  if (variante === 'destaque') {
    return (
      <ContextoDeSuperficie.Provider value="destaque">
        <Moldura {...props} destaque />
      </ContextoDeSuperficie.Provider>
    )
  }
  return <Moldura {...props} destaque={false} />
}

/** O item principal da tela (próximo evento, cabeçalho do evento): claro no tema escuro. */
export function CartaoDestaque(props: Omit<PropsDoCartao, 'variante'>) {
  return <Cartao {...props} variante="destaque" />
}

function Moldura({
  children,
  titulo,
  descricao,
  icone,
  acao,
  style,
  destaque,
}: Omit<PropsDoCartao, 'variante'> & { destaque: boolean }) {
  const { cores } = useTema()
  const { reduzirTransparencia, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const opaco = destaque || reduzirTransparencia || aumentarContraste
  return (
    <View
      style={[
        {
          backgroundColor: opaco ? cores.superficie : cores.cartaoVidro,
          borderRadius: RAIO.grande,
          borderWidth: aumentarContraste ? 2 : destaque ? 0 : 1,
          borderColor: aumentarContraste ? cores.texto : cores.cartaoVidroBorda,
          padding: RITMO.dentroDoCartao,
          gap: RITMO.entreItens,
          alignSelf: 'stretch',
        },
        style,
      ]}
    >
      {titulo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x2, minHeight: 20 }}>
          {icone ? <Icone nome={icone} cor={cores.destaque} tamanho={16} /> : null}
          <View style={{ flex: 1, gap: ESPACO.x1 }}>
            <Texto variante="sobrancelha" accessibilityRole="header" nivel={2}>
              {titulo}
            </Texto>
            {descricao ? (
              <Texto variante="apoio" cor="textoSuave">
                {descricao}
              </Texto>
            ) : null}
          </View>
          {acao}
        </View>
      ) : null}
      {children}
    </View>
  )
}
