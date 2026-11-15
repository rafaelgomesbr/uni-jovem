import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { useNoCartaoLista } from './CartaoDeVidro'
import { ALFA_DESABILITADO, comOpacidade } from './cor'
import { useAnelDeFoco } from './foco'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDaCaixa {
  rotulo: string
  descricao?: string
  marcada: boolean
  aoMudar: (marcada: boolean) => void
  desabilitada?: boolean
}

/**
 * Caixa de marcar (seção 2.12.7): 22×22, raio 6, borda de 1,5; marcada,
 * fundo primário com check de 14 em negrito. A caixa fica no topo da primeira
 * linha do rótulo (entrelinha 22, a mesma altura). Para consentimentos,
 * tarefas e checklist; liga e desliga é `Interruptor`. Dentro do cartão
 * lista, ganha o padding de 18 da linha e o separador recua 52
 * (`RECUO_DA_LISTA.caixa`).
 */
export function CaixaDeMarcar({ rotulo, descricao, marcada, aoMudar, desabilitada }: PropsDaCaixa) {
  const { cores, semFundo } = useTema()
  const noCartaoLista = useNoCartaoLista()
  const anel = useAnelDeFoco(cores.foco)
  const corDoRotulo = desabilitada ? comOpacidade(cores.texto, ALFA_DESABILITADO) : cores.texto
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={rotulo}
      accessibilityHint={descricao}
      aria-checked={marcada}
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
          paddingVertical: 13,
          paddingHorizontal: noCartaoLista ? ESPACO.e18 : 0,
          borderRadius: noCartaoLista ? 0 : RAIO.controle,
        },
        anel.estilo,
      ]}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: RAIO.marca,
          borderWidth: marcada && !desabilitada ? 0 : 1.5,
          borderColor: desabilitada ? cores.tonalBorda : cores.campoBorda,
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
      </View>
    </Pressable>
  )
}
