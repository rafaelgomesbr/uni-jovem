import { BORDA, ESPACO, RAIO } from '@uj/tokens'
import { ActivityIndicator, Platform, Pressable } from 'react-native'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { useAnelDeFoco } from '@/ui/foco'
import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

interface Props {
  orando: boolean
  /** Rótulo completo para o leitor de tela ("Estou orando pelo pedido de ana souza"). */
  rotuloAcessivel: string
  carregando?: boolean
  aoPressionar: () => void
}

/**
 * "Estou orando" (3.7.1): botão médio secundário com o ícone de mãos.
 * Marcado, vira "Orando" com o check, fundo `quenteFundo` e borda
 * `destaque`: o sinal é o rótulo e o ícone, não só a cor. Para o leitor de
 * tela é um botão alternável (`aria-pressed`).
 */
export function BotaoEstouOrando({
  orando,
  rotuloAcessivel,
  carregando = false,
  aoPressionar,
}: Props) {
  const { cores, solido, semFundo } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const anel = useAnelDeFoco(cores.foco)
  const corDoTexto = orando ? cores.destaque : cores.texto
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      aria-pressed={orando}
      aria-busy={carregando}
      aria-disabled={carregando}
      disabled={carregando}
      onPress={aoPressionar}
      onFocus={anel.onFocus}
      onBlur={anel.onBlur}
      android_ripple={{ color: cores.pressionado, borderless: false }}
      style={({ pressed }) => [
        {
          alignSelf: 'flex-start',
          minHeight: ALVO,
          paddingHorizontal: ESPACO.e16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e8,
          borderRadius: RAIO.controle,
          borderWidth: BORDA.fina,
          borderColor: orando ? cores.destaque : cores.contorno,
          backgroundColor: orando
            ? solido(cores.quenteFundo)
            : pressed
              ? solido(cores.pressionado)
              : semFundo,
          // Afundar de leve ao tocar é movimento: some com "Reduzir movimento".
          transform: [{ scale: pressed && !reduzirMovimento ? 0.98 : 1 }],
        },
        anel.estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator
          color={corDoTexto}
          size={Platform.OS === 'android' ? 18 : 'small'}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <Icone nome={orando ? 'check' : 'oracao'} cor={corDoTexto} tamanho={18} />
      )}
      <Texto variante="botao" style={{ color: corDoTexto }}>
        {orando ? 'Orando' : 'Estou orando'}
      </Texto>
    </Pressable>
  )
}
