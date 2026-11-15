import { Children } from 'react'

import { Texto, type PropsDoTexto } from './Texto'
import { useAnunciar } from './useAnunciar'

interface PropsDoTextoAnunciado extends Omit<PropsDoTexto, 'accessibilityLiveRegion'> {
  /** Anuncia só quando o texto muda, não quando a tela abre (contagens, mês exibido). */
  soMudancas?: boolean
}

/**
 * Texto que o leitor de tela ouve quando aparece ou muda ("Local salvo.",
 * "3 presenças registradas"). Substitui `accessibilityLiveRegion`, que só
 * funciona no Android: aqui o anúncio vale para iOS, Android e web.
 */
export function TextoAnunciado({ soMudancas = false, children, ...resto }: PropsDoTextoAnunciado) {
  const texto = Children.toArray(children)
    .filter((c) => typeof c === 'string' || typeof c === 'number')
    .join('')
  useAnunciar(texto, { soMudancas })
  return <Texto {...resto}>{children}</Texto>
}
