import { ALTURA, BORDA, ESPACO, RAIO, RITMO } from '@uj/tokens'
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  useContext,
  type ReactNode,
} from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useToqueComMola } from './useToqueComMola'

export interface Pilula<T extends string> {
  valor: T
  rotulo: string
  /** Contador opcional ("Rascunhos 2"). */
  contagem?: number
  /** Nome para o leitor de tela quando o rótulo é curto ("Seg" vira "Segunda-feira"). */
  rotuloAcessivel?: string
}

interface PropsDasPilulas<T extends string> {
  /** Nome do grupo para o leitor de tela ("Filtrar programas"). */
  rotulo: string
  pilulas: readonly Pilula<T>[]
  selecionadas: readonly T[]
  aoMudar: (selecionadas: T[]) => void
  /** Várias ao mesmo tempo (papel `checkbox`); por padrão, uma só (papel `radio`). */
  multipla?: boolean
  /**
   * Uma só ou nenhuma (papel `checkbox`): tocar na ativa desmarca e o filtro
   * volta a mostrar tudo ("Em oração" e "Respondidos"; "Publicados" e "Cancelados").
   */
  opcional?: boolean
  /**
   * A linha encosta nas bordas da tela e rola por baixo da margem: o primeiro
   * item fica em x=20 e sobra 20 no fim. Desligue dentro de cartão.
   */
  sangrar?: boolean
  /**
   * As pílulas quebram em mais linhas em vez de rolar de lado. Para uma escolha que não pode ficar
   * escondida à direita (folha de convocar: o "Louvor" cortado fora da tela, D73). Vale só fora
   * de `LinhaDePilulas`.
   */
  quebrar?: boolean
}

/** Dentro de `LinhaDePilulas`: o grupo não rola sozinho, a linha rola por todos. */
const ContextoDaLinha = createContext(false)

/**
 * Pílulas de filtro (seção 2.12.5, D64): tonais, 40 de altura visual com folga
 * de toque de 4 em cima e embaixo (48 efetivo), rolagem horizontal, intervalo de
 * 8. A ativa tem fundo quente, texto em destaque e check de 14: forma além da cor.
 */
export function PilulasDeFiltro<T extends string>({
  rotulo,
  pilulas,
  selecionadas,
  aoMudar,
  multipla = false,
  opcional = false,
  sangrar = true,
  quebrar = false,
}: PropsDasPilulas<T>) {
  const naLinha = useContext(ContextoDaLinha)
  const alternavel = multipla || opcional

  function alternar(valor: T) {
    const ativa = selecionadas.includes(valor)
    if (multipla) {
      aoMudar(ativa ? selecionadas.filter((v) => v !== valor) : [...selecionadas, valor])
      return
    }
    aoMudar(opcional && ativa ? [] : [valor])
  }

  const itens = pilulas.map((p) => (
    <ItemDePilula
      key={p.valor}
      pilula={p}
      ativa={selecionadas.includes(p.valor)}
      papel={alternavel ? 'checkbox' : 'radio'}
      aoPressionar={() => alternar(p.valor)}
    />
  ))
  // Escolha única é um grupo de rádio; as que ligam e desligam, um grupo simples.
  const papelDoGrupo = alternavel
    ? { role: 'group' as const }
    : { accessibilityRole: 'radiogroup' as const }

  if (naLinha) {
    return (
      <View
        {...papelDoGrupo}
        aria-label={rotulo}
        style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}
      >
        {itens}
      </View>
    )
  }

  if (quebrar) {
    return (
      <View
        {...papelDoGrupo}
        aria-label={rotulo}
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: ESPACO.e8 }}
      >
        {itens}
      </View>
    )
  }

  const margem = sangrar ? RITMO.margemDaTela : 0
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      {...papelDoGrupo}
      aria-label={rotulo}
      style={{ marginHorizontal: -margem, flexGrow: 0 }}
      contentContainerStyle={{
        paddingHorizontal: margem,
        paddingVertical: ESPACO.e4,
        gap: ESPACO.e8,
      }}
    >
      {itens}
    </ScrollView>
  )
}

function ItemDePilula<T extends string>({
  pilula: p,
  ativa,
  papel,
  aoPressionar,
}: {
  pilula: Pilula<T>
  ativa: boolean
  papel: 'radio' | 'checkbox'
  aoPressionar: () => void
}) {
  const { cores, solido } = useTema()
  const { aumentarContraste, reduzirTransparencia } = usePreferenciasDeAcessibilidade()
  const toque = useToqueComMola()
  const texto = p.contagem !== undefined ? `${p.rotulo} ${p.contagem}` : p.rotulo
  const falado =
    p.rotuloAcessivel !== undefined
      ? p.contagem !== undefined
        ? `${p.rotuloAcessivel} ${p.contagem}`
        : p.rotuloAcessivel
      : texto
  return (
    <Animated.View style={toque.estiloDoToque}>
      <Pressable
        accessibilityRole={papel}
        accessibilityLabel={falado}
        aria-checked={ativa}
        hitSlop={{ top: 4, bottom: 4 }}
        onPress={aoPressionar}
        onPressIn={toque.aoPressionarDentro}
        onPressOut={toque.aoPressionarFora}
        style={{
          minHeight: ALTURA.filtro,
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e6,
          paddingHorizontal: ESPACO.e16,
          overflow: 'hidden',
          borderRadius: RAIO.pilula,
          // Tonal (D64): a sugestão não parece mais um campo vazio. Ativa: fundo quente, texto em
          // destaque e o check (forma além da cor); Aumentar contraste ganha a borda de 2.
          borderWidth: aumentarContraste ? 2 : 0,
          borderColor: aumentarContraste ? (ativa ? cores.destaque : cores.texto) : 'transparent',
          backgroundColor: ativa
            ? solido(cores.quenteFundo)
            : reduzirTransparencia
              ? cores.botaoTonalOpaco
              : solido(cores.botaoTonal),
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: ativa ? solido(cores.quenteFundo) : cores.botaoTonalPressionado },
            toque.estiloDaCamada,
          ]}
        />
        {ativa ? <Icone nome="check" cor={cores.destaque} tamanho={16} peso="forte" /> : null}
        <Texto
          variante="meta"
          peso={ativa ? 'forte' : 'medio'}
          cor={ativa ? 'destaque' : 'texto'}
          tabular={p.contagem !== undefined}
        >
          {texto}
        </Texto>
      </Pressable>
    </Animated.View>
  )
}

/**
 * Vários grupos de pílulas numa linha só (3.4.1 e 3.7.1), rolando juntos por
 * baixo da margem, com um separador vertical de 1 por 20 entre eles. Cada
 * grupo mantém o próprio nome e papel para o leitor de tela; o separador é
 * só desenho.
 */
export function LinhaDePilulas({ children }: { children: ReactNode }) {
  const { cores } = useTema()
  const grupos = Children.toArray(children).filter(isValidElement)
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -RITMO.margemDaTela, flexGrow: 0 }}
      contentContainerStyle={{
        paddingHorizontal: RITMO.margemDaTela,
        paddingVertical: ESPACO.e4,
        alignItems: 'center',
        gap: ESPACO.e8,
      }}
    >
      <ContextoDaLinha.Provider value>
        {grupos.map((grupo, i) => (
          <Fragment key={grupo.key ?? i}>
            {i > 0 ? (
              <View
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ width: BORDA.fina, height: ESPACO.e20, backgroundColor: cores.tonalBorda }}
              />
            ) : null}
            {grupo}
          </Fragment>
        ))}
      </ContextoDaLinha.Provider>
    </ScrollView>
  )
}
