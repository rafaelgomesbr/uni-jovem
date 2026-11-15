import { BORDA, ESPACO, RAIO } from '@uj/tokens'
import { useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  assinarConfirmacao,
  lerConfirmacao,
  type ConfirmacaoAberta,
} from '@/utilidades/filaDeConfirmacao'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Botao, ParDeBotoes } from './Botao'
import { focar, type NoDeView } from './foco'
import { Texto } from './Texto'
import { ProvedorDeSuperficie, sombra, useTema } from './tema'

/** Largura da caixa (2.12.20); no máximo a tela menos 20 de cada lado. */
const LARGURA_DO_DIALOGO = 340

/**
 * Diálogo de confirmação da web (seção 2.12.20), no lugar do
 * `window.confirm`: `role="alertdialog"`, foco preso, Esc fecha e o foco volta
 * a quem abriu. Montado uma vez na raiz; mostra o pedido aberto por `confirmar`.
 */
export function DialogoDeConfirmacao() {
  const aberta = useSyncExternalStore(assinarConfirmacao, lerConfirmacao, lerConfirmacao)
  return aberta ? <Dialogo aberta={aberta} /> : null
}

/**
 * Caixa de 340 (raio 22, padding 24) na superfície elevada, com a sombra de
 * folha sobre o véu; título em `tituloCartao`, consequência em `corpo` suave
 * e os botões de 48 lado a lado: "Cancelar" (secundário) e a ação com o verbo
 * (primário ou destrutivo cheio).
 */
function Dialogo({ aberta }: { aberta: ConfirmacaoAberta }) {
  const { cores, elevacao } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const id = useId()
  const cancelar = useRef<NoDeView>(null)
  const confirmarRef = useRef<NoDeView>(null)
  const { pedido, responder } = aberta

  // Foco preso no diálogo, Esc cancela e, ao fechar, o foco volta a quem abriu.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    focar(cancelar)
    function teclado(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        responder(false)
        return
      }
      if (e.key !== 'Tab') return
      const botoes = [cancelar.current, confirmarRef.current] as unknown as (HTMLElement | null)[]
      const [primeiro, ultimo] = botoes
      if (!primeiro || !ultimo) return
      const ativo = document.activeElement
      if (e.shiftKey && ativo === primeiro) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault()
        primeiro.focus()
      } else if (ativo !== primeiro && ativo !== ultimo) {
        e.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', teclado)
    return () => {
      document.removeEventListener('keydown', teclado)
      anterior?.focus?.()
    }
  }, [responder])

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 1000,
          alignItems: 'center',
          justifyContent: 'center',
          padding: ESPACO.e20,
          backgroundColor: cores.veu,
        },
      ]}
    >
      <View
        role="alertdialog"
        aria-modal
        aria-labelledby={`titulo-${id}`}
        aria-describedby={`mensagem-${id}`}
        style={{
          width: LARGURA_DO_DIALOGO,
          maxWidth: '100%',
          gap: ESPACO.e8,
          padding: ESPACO.e24,
          borderRadius: RAIO.cartao,
          backgroundColor: cores.superficieElevada,
          borderWidth: aumentarContraste ? BORDA.contraste : 0,
          borderColor: aumentarContraste ? cores.texto : 'transparent',
          ...sombra(elevacao.folha),
        }}
      >
        <ProvedorDeSuperficie superficie="opaca">
          <Texto variante="tituloCartao" nativeID={`titulo-${id}`}>
            {pedido.titulo}
          </Texto>
          <Texto variante="corpo" cor="textoSuave" nativeID={`mensagem-${id}`}>
            {pedido.mensagem}
          </Texto>
          <View style={{ marginTop: ESPACO.e16 }}>
            <ParDeBotoes>
              <Botao
                ref={cancelar}
                titulo="Cancelar"
                variante="secundario"
                tamanho="grande"
                aoPressionar={() => responder(false)}
              />
              <Botao
                ref={confirmarRef}
                titulo={pedido.confirmar}
                variante={pedido.destrutivo ? 'destrutivoCheio' : 'primario'}
                tamanho="grande"
                aoPressionar={() => responder(true)}
              />
            </ParDeBotoes>
          </View>
        </ProvedorDeSuperficie>
      </View>
    </View>
  )
}
