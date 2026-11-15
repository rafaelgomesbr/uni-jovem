import { router, usePreventRemove, type Href } from 'expo-router'
import { useRef, useState } from 'react'

import { confirmar } from '@/utilidades/confirmar'

/**
 * Volta se houver para onde; sem histórico (tela aberta por link, por
 * notificação ou recarregada na web), vai ao destino. Todo sucesso de
 * formulário sai por aqui: um `router.back()` sem saída deixava o formulário
 * preenchido na tela, e o segundo toque criava um duplicado (auditoria A2).
 */
export function voltarOu(destino: Href): void {
  if (router.canGoBack()) router.back()
  else router.replace(destino)
}

/**
 * Pergunta antes de sair de um formulário com algo digitado (auditoria A5):
 * voltar, fechar o modal, o gesto e o voltar do navegador passam pelo
 * `usePreventRemove`. Devolve `liberar`, para chamar antes de sair de
 * propósito (depois de salvar), sem pergunta.
 */
export function useConfirmarDescarte(sujo: boolean): () => void {
  const [liberado, setLiberado] = useState(false)
  const desligar = usePreventRemove(sujo && !liberado, ({ repeat }) => {
    void confirmar({
      titulo: 'Descartar o que você escreveu?',
      mensagem: 'O que você digitou nesta tela não fica guardado.',
      confirmar: 'Descartar',
      destrutivo: true,
    }).then((ok) => {
      if (!ok) return
      setLiberado(true)
      repeat()
    })
  })
  return () => {
    setLiberado(true)
    desligar()
  }
}

export interface TravaDeEnvio {
  /** `true` se pegou a trava (pode enviar); `false` se já há um envio a caminho. */
  pegar: () => boolean
  soltar: () => void
}

/**
 * Um envio por vez, decidido na hora do toque: o `isPending` só chega no
 * render seguinte, e um toque duplo rápido passava antes dele (A2 e M2).
 * Solte quando o envio falhar ou quando a tela continuar aberta depois dele.
 */
export function useTravaDeEnvio(): TravaDeEnvio {
  const enviando = useRef(false)
  return {
    pegar: () => {
      if (enviando.current) return false
      enviando.current = true
      return true
    },
    soltar: () => {
      enviando.current = false
    },
  }
}
