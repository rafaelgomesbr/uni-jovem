import { ESPACO, POSE_DO_MOMENTO, RAIO, RITMO, type MomentoDoDia, type PoseDoSol } from '@uj/tokens'
import type { ReactNode } from 'react'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { PontoAoVivo } from './PontoAoVivo'
import { Sol } from './Sol'
import { Texto } from './Texto'
import { ProvedorDeSuperficie, useTema } from './tema'

/** O brilho coral do canto: 26% onde o sol está (sem texto), caindo a 0 em 55%. */
const BRILHO_DO_CANTO = 'rgba(255,138,101,0.26)'
const LADO_DO_SOL = 96

export interface PropsDoCartaoDoMomento {
  /** O momento do encontro: escolhe a pose do sol (`longe` a `fim`). */
  momento?: MomentoDoDia
  /** A pose direto, quando o cartão não é de um momento (tem prioridade sobre `momento`). */
  pose?: PoseDoSol
  /** Etiqueta acima do título (`sobrancelha`, `destaque`): "PRÓXIMO ENCONTRO", "AGORA". */
  etiqueta?: string
  /** Ponto pulsante antes da etiqueta: o encontro está acontecendo. */
  aoVivo?: boolean
  /** Ao lado da etiqueta: um chip ("Última versão: hoje, 14:32"). */
  chip?: ReactNode
  /** Título em Bricolage 24/28 ("Sábado Jovem"). */
  titulo?: string
  /**
   * O título é uma frase de estado ("Nenhum encontro marcado."), não o nome de um encontro: aparece
   * como título de seção (20 em 600) e não como o título grande do cartão (D83).
   */
  tituloComoFrase?: boolean
  /** Data e local, em `apoio` (15, `textoSuave`). */
  meta?: string
  children?: ReactNode
  /** Botões (use `ParDeBotoes`: secundário à esquerda, primário à direita). 14 abaixo. */
  acoes?: ReactNode
  /** Sem o sol do canto (estado vazio ou de erro). */
  semSol?: boolean
  /** O cartão inteiro abre o detalhe. As `acoes` ficam fora da área tocável. */
  aoPressionar?: () => void
  rotuloAcessivel?: string
  dica?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Cartão do momento (direção A, D65): "a coisa mais importante agora", um por tela. Moldura de
 * luz de 1,5 pt (coral, violeta claro, índigo, 140 graus) em volta de um miolo em degradê
 * (`momentoTopo` para `momentoBase`, 160 graus), raio 28, sombra `momento`, brilho coral no canto
 * e o sol de 96 pt recortado no mesmo canto. Duas `View`, sem máscara. O miolo é sempre opaco:
 * o texto tem 4,5:1 com o brilho de até 12% nas áreas de texto (pares da D65). Com "Aumentar
 * contraste", a moldura vira uma linha de 2 pt na cor do texto e o brilho some.
 *
 * Dentro dele, só chips `sucesso`, `alerta`, `quente` e `neutro`: `erro` e `info` não passam
 * 4,5:1 sobre o degradê (use o bloco de erro no lugar do cartão).
 */
export function CartaoDoMomento({
  momento = 'longe',
  pose,
  etiqueta,
  aoVivo = false,
  chip,
  titulo,
  tituloComoFrase = false,
  meta,
  children,
  acoes,
  semSol = false,
  aoPressionar,
  rotuloAcessivel,
  dica,
  style,
}: PropsDoCartaoDoMomento) {
  const { cores, elevacao } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const poseFinal = pose ?? POSE_DO_MOMENTO[momento]
  const moldura = aumentarContraste ? 2 : 1.5
  const raioDoMiolo = RAIO.barra - moldura

  const topo = (
    <>
      {etiqueta || chip ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: ESPACO.e8,
            marginBottom: ESPACO.e6,
          }}
        >
          {aoVivo ? <PontoAoVivo /> : null}
          {etiqueta ? <Texto variante="sobrancelha">{etiqueta}</Texto> : null}
          {chip}
        </View>
      ) : null}
      {titulo ? (
        // Frase (estado vazio): título de seção de 20 em 600; senão o nome do encontro, 24 em 800.
        <Texto variante={tituloComoFrase ? 'secao' : 'tituloMomento'}>{titulo}</Texto>
      ) : null}
      {meta ? (
        <Texto variante="apoio" style={{ marginTop: ESPACO.e4 }}>
          {meta}
        </Texto>
      ) : null}
    </>
  )

  return (
    <ProvedorDeSuperficie superficie="opaca">
      <View
        testID="cartao-do-momento"
        style={[
          {
            alignSelf: 'stretch',
            borderRadius: RAIO.barra,
            padding: moldura,
            // O sólido por baixo vale onde o degradê não é desenhado.
            backgroundColor: aumentarContraste ? cores.texto : cores.momentoBorda2,
            ...(aumentarContraste
              ? {}
              : {
                  backgroundImage: `linear-gradient(140deg, ${cores.momentoBorda1}, ${cores.momentoBorda2} 55%, ${cores.momentoBorda3})`,
                  boxShadow: elevacao.momento,
                }),
          },
          style,
        ]}
      >
        <View
          style={{
            borderRadius: raioDoMiolo,
            overflow: 'hidden',
            paddingTop: RITMO.recuoDoCartao,
            paddingHorizontal: RITMO.recuoDoCartao,
            paddingBottom: RITMO.recuoDoCartao,
            backgroundColor: cores.momentoBase,
            backgroundImage: `linear-gradient(160deg, ${cores.momentoTopo}, ${cores.momentoBase})`,
          }}
        >
          {aumentarContraste ? null : (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundImage: `radial-gradient(circle at 100% 0%, ${BRILHO_DO_CANTO}, rgba(255,138,101,0) 55%)`,
              }}
            />
          )}
          {semSol ? null : (
            <View pointerEvents="none" style={{ position: 'absolute', right: 6, top: 2 }}>
              <Sol pose={poseFinal} lado={LADO_DO_SOL} />
            </View>
          )}
          <View style={{ paddingRight: semSol ? 0 : 78, minHeight: semSol ? 0 : 84 }}>
            {aoPressionar ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  rotuloAcessivel ?? [etiqueta, titulo, meta].filter(Boolean).join('. ')
                }
                accessibilityHint={dica}
                onPress={aoPressionar}
                style={({ pressed }) => ({
                  borderRadius: RAIO.celula,
                  backgroundColor: pressed ? cores.pressionado : 'transparent',
                })}
              >
                {topo}
              </Pressable>
            ) : (
              topo
            )}
          </View>
          {children ? <View style={{ marginTop: ESPACO.e16 }}>{children}</View> : null}
          {acoes ? <View style={{ marginTop: ESPACO.e16 }}>{acoes}</View> : null}
        </View>
      </View>
    </ProvedorDeSuperficie>
  )
}
