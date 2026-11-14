import { ESPACO, RAIO, type Paleta } from '@uj/tokens'
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import { Icone, type NomeDoIcone } from './Icone'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import { useTema } from './tema'

export type VarianteDoBotao = 'primario' | 'secundario' | 'perigo' | 'discreto'

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
}

interface Aparencia {
  fundo: keyof Paleta | 'transparente'
  texto: keyof Paleta
  borda: keyof Paleta | null
}

const APARENCIA: Readonly<Record<VarianteDoBotao, Aparencia>> = {
  primario: { fundo: 'primaria', texto: 'sobrePrimaria', borda: null },
  secundario: { fundo: 'superficie', texto: 'texto', borda: 'borda' },
  perigo: { fundo: 'superficie', texto: 'erro', borda: 'erro' },
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
}: PropsDoBotao) {
  const { cores } = useTema()
  const aparencia = APARENCIA[variante]
  const inativo = desabilitado || carregando
  const corDoTexto = cores[aparencia.texto]
  const mostrarMotivo = desabilitado && !carregando && motivo

  return (
    <View style={[larguraTotal ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rotuloAcessivel ?? titulo}
        accessibilityHint={mostrarMotivo ? motivo : dica}
        accessibilityState={{ disabled: inativo, busy: carregando }}
        disabled={inativo}
        onPress={aoPressionar}
        style={({ pressed }) => ({
          minHeight: ALVO,
          minWidth: ALVO,
          paddingHorizontal: variante === 'discreto' ? ESPACO.x2 : ESPACO.x5,
          paddingVertical: ESPACO.x2,
          borderRadius: RAIO.pilula,
          backgroundColor:
            aparencia.fundo === 'transparente' ? 'transparent' : cores[aparencia.fundo],
          borderWidth: aparencia.borda ? 1.5 : 0,
          borderColor: aparencia.borda ? cores[aparencia.borda] : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: ESPACO.x2,
          opacity: desabilitado && !carregando ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        {carregando ? (
          <ActivityIndicator color={corDoTexto} />
        ) : icone ? (
          <Icone nome={icone} cor={corDoTexto} tamanho={20} />
        ) : null}
        <Texto variante="corpoForte" style={{ color: corDoTexto }} centralizado>
          {titulo}
        </Texto>
      </Pressable>
      {mostrarMotivo ? (
        <Texto variante="apoio" cor="textoSuave" style={{ marginTop: ESPACO.x1 }}>
          {motivo}
        </Texto>
      ) : null}
    </View>
  )
}
