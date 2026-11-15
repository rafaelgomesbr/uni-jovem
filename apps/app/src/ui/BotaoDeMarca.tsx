import { ALTURA, ESPACO, MARCA_DO_GOOGLE, RAIO } from '@uj/tokens'
import { ActivityIndicator, Pressable, View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { LogoDoGoogle } from './LogoDoGoogle'
import { Texto } from './Texto'

const MARCA = MARCA_DO_GOOGLE

/**
 * Botão de entrada de marca (Google): fundo branco, texto `#1F1F1F`, borda
 * `#747775` e o "G" oficial, nas cores fixas da marca (não seguem o tema).
 * Mesmas medidas do botão grande: 48, raio 14, rótulo 15/20 600.
 */
export function BotaoDeMarca({
  titulo,
  carregando,
  inativo,
  motivo,
  aoPressionar,
}: {
  titulo: string
  carregando: boolean
  inativo: boolean
  motivo?: string
  aoPressionar: () => void
}) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={titulo}
        {...(motivo && inativo && !carregando ? { accessibilityHint: motivo } : {})}
        aria-disabled={inativo}
        aria-busy={carregando}
        disabled={inativo}
        onPress={aoPressionar}
        style={({ pressed }) => ({
          minHeight: ALTURA.controle,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: ESPACO.e8,
          paddingHorizontal: ESPACO.e20,
          borderRadius: RAIO.controle,
          borderWidth: 1,
          borderColor: MARCA.borda,
          backgroundColor: pressed ? MARCA.pressionado : MARCA.fundo,
          transform: [{ scale: pressed && !reduzirMovimento ? 0.98 : 1 }],
        })}
      >
        {carregando ? <ActivityIndicator color={MARCA.texto} /> : <LogoDoGoogle />}
        <Texto
          variante="botao"
          style={{ color: inativo && !carregando ? MARCA.textoInativo : MARCA.texto }}
        >
          {titulo}
        </Texto>
      </Pressable>
      {motivo && inativo && !carregando ? (
        <Texto variante="legenda" cor="textoSuave" style={{ marginTop: ESPACO.e6 }}>
          {motivo}
        </Texto>
      ) : null}
    </View>
  )
}
