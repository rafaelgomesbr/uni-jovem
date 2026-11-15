import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { anunciar } from './anunciar'

interface OpcoesDoAnuncio {
  /** `false` para quem já tem `role="alert"`: na web, o navegador anuncia sozinho. */
  naWeb?: boolean
  /** Ignora o valor com que a tela abriu e anuncia só as mudanças (contagens, filtros). */
  soMudancas?: boolean
}

/**
 * Anuncia `texto` quando ele aparece ou muda (erro de campo, aviso novo,
 * presença registrada). `null` ou vazio não anuncia. O leitor de tela é um
 * sistema externo à tela, por isso o efeito.
 */
export function useAnunciar(texto: string | null | undefined, opcoes: OpcoesDoAnuncio = {}) {
  const { naWeb = true, soMudancas = false } = opcoes
  const anterior = useRef<string | null | undefined>(soMudancas ? texto : undefined)
  useEffect(() => {
    if (texto === anterior.current) return
    anterior.current = texto
    if (!texto) return
    if (Platform.OS === 'web' && !naWeb) return
    anunciar(texto)
  }, [texto, naWeb])
}
