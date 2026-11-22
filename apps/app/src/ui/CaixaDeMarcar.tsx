import { ESPACO, RAIO } from '@uj/tokens'
import type { Ref } from 'react'
import { Pressable, View } from 'react-native'

import { useNoCartaoLista } from './CartaoDeVidro'
import { ALFA_DESABILITADO, comOpacidade } from './cor'
import { useAnelDeFoco, type NoDeView } from './foco'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useAnunciar } from './useAnunciar'
import { soNaWeb } from './web'

interface PropsDaCaixa {
  rotulo: string
  descricao?: string
  marcada: boolean
  aoMudar: (marcada: boolean) => void
  desabilitada?: boolean
  /**
   * O que falta (ex.: tocou em continuar sem marcar). Aparece embaixo do
   * rótulo com o ícone de erro, a caixa ganha borda de 2 na cor de erro (forma
   * além da cor) e o leitor de tela ouve o texto.
   */
  erro?: string | null
  /** Para levar o foco à caixa quando ela é o que falta. */
  ref?: Ref<NoDeView>
}

/**
 * Caixa de marcar (seção 2.12.7, D64): 24×24, raio 8, borda de 2 em `campoBorda`;
 * marcada, fundo primário com check de 14 em negrito. A caixa fica no topo da
 * primeira linha do rótulo. Para consentimentos,
 * tarefas e checklist; liga e desliga é `Interruptor`. Dentro do cartão
 * lista, ganha o padding de 18 da linha e o separador recua 52
 * (`RECUO_DA_LISTA.caixa`).
 */
export function CaixaDeMarcar({
  rotulo,
  descricao,
  marcada,
  aoMudar,
  desabilitada,
  erro,
  ref,
}: PropsDaCaixa) {
  const { cores, semFundo, superficie } = useTema()
  const mostrarErro = !!erro && !desabilitada
  // No cartão translúcido, o texto em `erro` não passa AA no pico da Aurora: ícone na cor, texto em `texto`.
  const corDoErro = superficie === 'translucida' ? 'texto' : 'erro'
  useAnunciar(mostrarErro ? erro : null)
  const noCartaoLista = useNoCartaoLista()
  const anel = useAnelDeFoco(cores.foco)
  const corDoRotulo = desabilitada ? comOpacidade(cores.texto, ALFA_DESABILITADO) : cores.texto
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={rotulo}
      accessibilityHint={mostrarErro ? `Erro: ${erro}` : descricao}
      aria-checked={marcada}
      {...(mostrarErro ? soNaWeb({ 'aria-invalid': true }) : {})}
      ref={ref}
      aria-disabled={!!desabilitada}
      disabled={desabilitada}
      onPress={() => aoMudar(!marcada)}
      onFocus={anel.onFocus}
      onBlur={anel.onBlur}
      style={[
        {
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: ESPACO.e12,
          paddingVertical: ESPACO.e12,
          paddingHorizontal: noCartaoLista ? ESPACO.e18 : 0,
          borderRadius: noCartaoLista ? 0 : RAIO.controle,
        },
        anel.estilo,
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: RAIO.caixa,
          borderWidth: marcada && !desabilitada ? 0 : 2,
          borderColor: desabilitada
            ? cores.tonalBorda
            : mostrarErro
              ? cores.erro
              : cores.campoBorda,
          backgroundColor: marcada && !desabilitada ? cores.primaria : semFundo,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {marcada ? (
          <Icone
            nome="check"
            cor={desabilitada ? corDoRotulo : cores.sobrePrimaria}
            tamanho={14}
            peso="forte"
          />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Texto variante="corpo" style={{ color: corDoRotulo }}>
          {rotulo}
        </Texto>
        {descricao ? (
          <Texto variante="legenda" cor="textoSuave">
            {descricao}
          </Texto>
        ) : null}
        {mostrarErro ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: ESPACO.e6,
              marginTop: ESPACO.e6,
            }}
          >
            <View style={{ height: 20, justifyContent: 'center' }}>
              <Icone nome="erroDeCampo" cor={cores.erro} tamanho={16} />
            </View>
            <Texto variante="meta" peso="forte" cor={corDoErro} style={{ flex: 1 }}>
              {erro}
            </Texto>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}
