/* eslint-disable no-restricted-syntax -- opacidade aqui é a entrada do chip, animação e não estado (D65) */
import { ALTURA, CURVAS, ESPACO, MOLAS, MOVIMENTO_DAS_TELAS, RAIO, type Paleta } from '@uj/tokens'
import { isValidElement, useEffect, type ReactNode } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone, type NomeDoIcone } from './Icone'
import { PontoAoVivo } from './PontoAoVivo'
import { Texto } from './Texto'
import { useTema } from './tema'

/** Variantes da 2.12.12. `local` e `destaque` são os nomes antigos de `quente`. */
export type TomDoChip =
  'neutro' | 'quente' | 'sucesso' | 'alerta' | 'erro' | 'info' | 'local' | 'destaque'

/**
 * A situação de uma pessoa ou de um encontro, com tom, ícone e palavra já escolhidos (D65). Cor
 * nunca é o único sinal: toda situação traz texto, e quase todas um ícone.
 * - `aceitou`: "Confirmado", verde com check;
 * - `aguardando`: "Aguardando", âmbar com relógio;
 * - `naoPode`: "Não pode", vermelho com x;
 * - `aoVivo`: "Ao vivo", quente com o ponto que pulsa;
 * - `novo`: "Novo", violeta;
 * - `rascunho`: "Rascunho", neutro.
 */
export type SituacaoDoChip = 'aceitou' | 'aguardando' | 'naoPode' | 'aoVivo' | 'novo' | 'rascunho'

interface DefinicaoDaSituacao {
  tom: Exclude<TomDoChip, 'local' | 'destaque'>
  texto: string
  icone?: NomeDoIcone
  ponto?: boolean
}

/** A tabela das situações: a única fonte do tom, da palavra e do ícone de cada uma. */
export const SITUACOES_DO_CHIP: Readonly<Record<SituacaoDoChip, DefinicaoDaSituacao>> = {
  aceitou: { tom: 'sucesso', texto: 'Confirmado', icone: 'check' },
  aguardando: { tom: 'alerta', texto: 'Aguardando', icone: 'relogio' },
  naoPode: { tom: 'erro', texto: 'Não pode', icone: 'fechar' },
  aoVivo: { tom: 'quente', texto: 'Ao vivo', ponto: true },
  novo: { tom: 'info', texto: 'Novo' },
  rascunho: { tom: 'neutro', texto: 'Rascunho' },
}

/**
 * A palavra de um chip passado como elemento (para quem monta o rótulo falado de uma linha que se
 * toca: o rótulo próprio esconde os filhos, e sem isto "Aguardando", "Arquivado" ou "3 a enviar"
 * só existiriam para quem enxerga). Devolve `null` se `no` não for um `Chip`.
 */
export function palavraDoChip(no: ReactNode): string | null {
  if (!isValidElement(no) || no.type !== Chip) return null
  const { texto, situacao } = no.props as { texto?: unknown; situacao?: SituacaoDoChip }
  if (typeof texto === 'string' && texto) return texto
  return situacao ? SITUACOES_DO_CHIP[situacao].texto : null
}

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
  /** Uma ou duas palavras. Opcional quando há `situacao` (a palavra padrão dela vale). */
  texto?: string
  tom?: TomDoChip
  /** Situação pronta (tom, ícone e palavra). `texto`, `tom` e `icone` ainda a sobrescrevem. */
  situacao?: SituacaoDoChip
  /** Ícone de 14 à esquerda (check em "Presente", alfinete em "Fixado"). */
  icone?: NomeDoIcone
  /** Ponto de 6 à esquerda ("Ao vivo"): pulsa com o movimento ligado. */
  ponto?: boolean
  /**
   * O chip acabou de mudar de estado: `confirmado` entra com escala de 0,6 a 1 em mola
   * (200 ms); `presente`, de 0,9 a 1 em 160 ms. Com Reduzir movimento, só dissolve (120 ms).
   */
  aparecer?: 'confirmado' | 'presente'
}

/**
 * Chip de estado (seção 2.12.12 e 8.4 da direção A): preenchido, 28 de altura mínima (D75),
 * padding 10 por 4, texto 16/20 600, ícone de 16. Sempre texto; nunca é tocável (o que é tocável é pílula de
 * filtro). Dentro do cartão translúcido, o fundo é composto sobre o opaco.
 */
export function Chip({ texto, tom, situacao, icone, ponto, aparecer }: PropsDoChip) {
  const base = situacao ? SITUACOES_DO_CHIP[situacao] : null
  const palavra = texto ?? base?.texto ?? ''
  const corpo = (
    <CorpoDoChip
      texto={palavra}
      tom={tom ?? base?.tom ?? 'quente'}
      icone={icone ?? base?.icone}
      ponto={ponto ?? base?.ponto ?? false}
    />
  )
  return aparecer ? <EntradaDoChip tipo={aparecer}>{corpo}</EntradaDoChip> : corpo
}

function EntradaDoChip({
  tipo,
  children,
}: {
  tipo: 'confirmado' | 'presente'
  children: ReactNode
}) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const progresso = useSharedValue(0)
  const inicial = tipo === 'confirmado' ? 0.6 : 0.9

  // A entrada é animação: roda uma vez, ao montar.
  useEffect(() => {
    if (reduzirMovimento) {
      progresso.set(
        withTiming(1, {
          duration: MOVIMENTO_DAS_TELAS.dissolver,
          reduceMotion: ReduceMotion.Never,
        }),
      )
    } else if (tipo === 'confirmado') {
      progresso.set(withSpring(1, { ...MOLAS.check, reduceMotion: ReduceMotion.Never }))
    } else {
      progresso.set(
        withTiming(1, {
          duration: MOVIMENTO_DAS_TELAS.chipPresente,
          easing: Easing.bezier(...CURVAS.saida),
          reduceMotion: ReduceMotion.Never,
        }),
      )
    }
    return () => cancelAnimation(progresso)
  }, [tipo, reduzirMovimento, progresso])

  const estilo = useAnimatedStyle(() => ({
    opacity: Math.min(1, progresso.value * 1.6),
    transform: [{ scale: reduzirMovimento ? 1 : inicial + (1 - inicial) * progresso.value }],
  }))
  return (
    <Animated.View testID="chip-entrando" style={[{ alignSelf: 'flex-start' }, estilo]}>
      {children}
    </Animated.View>
  )
}

function CorpoDoChip({
  texto,
  tom,
  icone,
  ponto,
}: {
  texto: string
  tom: TomDoChip
  icone: NomeDoIcone | undefined
  ponto: boolean
}) {
  const { cores, solido } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const nome = tom === 'local' || tom === 'destaque' ? 'quente' : tom
  const [fundo, frente] = TONS[nome]
  const cor = cores[frente]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e6,
        minHeight: ALTURA.chip,
        paddingHorizontal: ESPACO.e10,
        paddingVertical: ESPACO.e4,
        borderRadius: RAIO.pilula,
        backgroundColor: solido(cores[fundo]),
        borderWidth: aumentarContraste ? 1 : 0,
        borderColor: aumentarContraste ? cor : 'transparent',
      }}
    >
      {ponto ? <PontoAoVivo lado={6} cor={cores.primaria} /> : null}
      {icone ? <Icone nome={icone} cor={cor} tamanho={16} peso="semibold" /> : null}
      {/* Sem `numberOfLines`: com fonte grande o texto quebra de linha em vez de ser cortado (D75). */}
      <Texto variante="chip" style={{ color: cor, flexShrink: 1 }}>
        {texto}
      </Texto>
    </View>
  )
}
