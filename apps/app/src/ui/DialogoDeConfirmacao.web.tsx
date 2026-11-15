import { ESPACO, RAIO, RITMO } from '@uj/tokens'
import { useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  assinarConfirmacao,
  lerConfirmacao,
  type ConfirmacaoAberta,
} from '@/utilidades/filaDeConfirmacao'

import { Botao } from './Botao'
import { focar, type NoDeView } from './foco'
import { Texto } from './Texto'
import { useTema } from './tema'

/**
 * Diálogo de confirmação da web (`role="alertdialog"`). Montado uma vez na
 * raiz; mostra o pedido aberto por `confirmar`.
 */
export function DialogoDeConfirmacao() {
  const aberta = useSyncExternalStore(assinarConfirmacao, lerConfirmacao, lerConfirmacao)
  return aberta ? <Dialogo aberta={aberta} /> : null
}

function Dialogo({ aberta }: { aberta: ConfirmacaoAberta }) {
  const { cores, elevacao } = useTema()
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
          backgroundColor: 'rgba(10, 8, 30, 0.55)',
        },
      ]}
    >
      <View
        role="alertdialog"
        aria-modal
        aria-labelledby={`titulo-${id}`}
        aria-describedby={`mensagem-${id}`}
        style={{
          width: '100%',
          maxWidth: 440,
          gap: RITMO.entreItens,
          padding: ESPACO.e24,
          borderRadius: RAIO.cartao,
          backgroundColor: cores.superficie,
          borderWidth: 1,
          borderColor: cores.separador,
          boxShadow: elevacao.flutuante,
        }}
      >
        <Texto variante="tituloItem" nativeID={`titulo-${id}`}>
          {pedido.titulo}
        </Texto>
        <Texto cor="textoSuave" nativeID={`mensagem-${id}`}>
          {pedido.mensagem}
        </Texto>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap-reverse',
            justifyContent: 'flex-end',
            gap: ESPACO.e8,
            marginTop: ESPACO.e8,
          }}
        >
          <Botao
            ref={cancelar}
            titulo="Cancelar"
            variante="secundario"
            larguraTotal={false}
            aoPressionar={() => responder(false)}
          />
          <Botao
            ref={confirmarRef}
            titulo={pedido.confirmar}
            variante={pedido.destrutivo ? 'destrutivoCheio' : 'primario'}
            larguraTotal={false}
            aoPressionar={() => responder(true)}
          />
        </View>
      </View>
    </View>
  )
}
