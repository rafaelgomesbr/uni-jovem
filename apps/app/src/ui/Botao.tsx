import { ALTURA, ESPACO, RAIO, type Paleta } from '@uj/tokens'
import { useId, type Ref } from 'react'
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone, type NomeDoIcone } from './Icone'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import type { NoDeView } from './foco'
import { useTema } from './tema'
import { soNaWeb } from './web'

/**
 * Hierarquia: `primario` (a ação principal da tela, no máximo uma por bloco),
 * `secundario` (contorno), `terciario` (só texto, para "ver todos", "voltar").
 * `discreto` é o nome antigo de `terciario`. `perigo` apaga ou encerra algo.
 */
export type VarianteDoBotao = 'primario' | 'secundario' | 'terciario' | 'perigo' | 'discreto'

export interface PropsDoBotao {
  titulo: string
  aoPressionar: () => void
  variante?: VarianteDoBotao
  carregando?: boolean
  desabilitado?: boolean
  /** Por que o botão está desabilitado. Aparece abaixo dele e é lido pelo leitor de tela. */
  motivo?: string
  icone?: NomeDoIcone
  /** Quando o título sozinho não basta fora de contexto (ex.: "Revogar" + nome do aparelho). */
  rotuloAcessivel?: string
  dica?: string
  larguraTotal?: boolean
  style?: StyleProp<ViewStyle>
  /** Botão que abre e fecha um bloco: o leitor de tela anuncia aberto ou fechado. */
  expandido?: boolean
  /** Para devolver o foco ao botão (ex.: depois de fechar o que ele abriu). */
  ref?: Ref<NoDeView>
}

interface Aparencia {
  fundo: keyof Paleta | 'transparente'
  texto: keyof Paleta
  borda: keyof Paleta | null
}

const APARENCIA: Readonly<Record<VarianteDoBotao, Aparencia>> = {
  primario: { fundo: 'primaria', texto: 'sobrePrimaria', borda: null },
  // Mockup: contorno translúcido, sem fundo (o cartão de vidro aparece por trás).
  secundario: { fundo: 'transparente', texto: 'texto', borda: 'contornoSecundario' },
  terciario: { fundo: 'transparente', texto: 'destaque', borda: null },
  perigo: { fundo: 'transparente', texto: 'erro', borda: 'erro' },
  discreto: { fundo: 'transparente', texto: 'destaque', borda: null },
}

export function Botao({
  titulo,
  aoPressionar,
  variante = 'primario',
  carregando = false,
  desabilitado = false,
  motivo,
  icone,
  rotuloAcessivel,
  dica,
  larguraTotal = true,
  style,
  expandido,
  ref,
}: PropsDoBotao) {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const aparencia = APARENCIA[variante]
  const soTexto = aparencia.fundo === 'transparente' && aparencia.borda === null
  const idDoMotivo = `motivo-${useId()}`
  const inativo = desabilitado || carregando
  const corDoTexto = cores[aparencia.texto]
  const mostrarMotivo = desabilitado && !carregando && motivo

  return (
    <View style={[larguraTotal ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rotuloAcessivel ?? titulo}
        accessibilityHint={mostrarMotivo ? motivo : dica}
        ref={ref}
        aria-disabled={inativo}
        {...(expandido !== undefined ? { 'aria-expanded': expandido } : {})}
        aria-busy={carregando}
        {...(mostrarMotivo ? soNaWeb({ 'aria-describedby': idDoMotivo }) : {})}
        disabled={inativo}
        onPress={aoPressionar}
        style={({ pressed }) => ({
          // Primário, secundário e destrutivo: 48 (mockup). Terciário: só o alvo mínimo.
          minHeight: soTexto ? ALVO : Math.max(ALVO, ALTURA.botao),
          minWidth: ALVO,
          paddingHorizontal: soTexto ? ESPACO.x3 : ESPACO.x5,
          paddingVertical: ESPACO.x2,
          borderRadius: soTexto ? RAIO.pilula : RAIO.medio,
          // Toque: o primário escurece um pouco; os demais ganham o fundo de realce.
          backgroundColor:
            pressed && variante !== 'primario'
              ? cores.superficieRealce
              : aparencia.fundo === 'transparente'
                ? 'transparent'
                : cores[aparencia.fundo],
          borderWidth: aparencia.borda ? 1 : 0,
          borderColor: aparencia.borda ? cores[aparencia.borda] : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: ESPACO.x2,
          opacity:
            desabilitado && !carregando ? 0.5 : pressed && variante === 'primario' ? 0.88 : 1,
          // Afundar de leve ao tocar é movimento: some com "Reduzir movimento".
          transform: [{ scale: pressed && !reduzirMovimento ? 0.98 : 1 }],
        })}
      >
        {carregando ? (
          <ActivityIndicator color={corDoTexto} />
        ) : icone ? (
          <Icone nome={icone} cor={corDoTexto} tamanho={20} />
        ) : null}
        <Texto
          variante="corpoForte"
          style={{ color: corDoTexto, fontSize: 15, lineHeight: 20 }}
          centralizado
        >
          {titulo}
        </Texto>
      </Pressable>
      {mostrarMotivo ? (
        <Texto
          variante="apoio"
          cor="textoSuave"
          nativeID={idDoMotivo}
          style={{ marginTop: ESPACO.x1 }}
        >
          {motivo}
        </Texto>
      ) : null}
    </View>
  )
}
