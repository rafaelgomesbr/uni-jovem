import type { ComponentRef, ReactNode, Ref } from 'react'
import type { TextInput, TextInputProps } from 'react-native'

import { Campo } from './Campo'

export interface PropsDoCampoDeAcesso extends Omit<
  TextInputProps,
  'style' | 'secureTextEntry' | 'accessibilityLabel' | 'placeholder' | 'editable'
> {
  /** Sempre visível acima do campo: placeholder não substitui rótulo. */
  rotulo: string
  /** Erro do campo: ícone mais texto na fenda de baixo, anel de 2 e anúncio (a cor nunca é o único sinal). */
  erro?: string | null
  /** Inválido sem frase própria (a frase do formulário está em outro lugar): anel de erro e `aria-invalid`. */
  invalido?: boolean
  /** Apoio vivo na fenda quando não há erro (o status da senha, "7 de 10 caracteres"). */
  apoio?: string | null
  /** Cada vez que sobe, o campo balança 5 pt (erro ao enviar). */
  disparoDeErro?: number
  /** Campo de senha, com "Mostrar" e "Ocultar" em texto. */
  senha?: boolean
  /** Só exemplo ("nome@exemplo.com"), nunca instrução. */
  exemplo?: string
  /** Só leitura (enviando): sem mudar a cor, o botão já diz que está enviando. */
  somenteLeitura?: boolean
  /** À direita do rótulo, na mesma linha ("Esqueci a senha"). */
  aoLado?: ReactNode
  ref?: Ref<ComponentRef<typeof TextInput>>
}

/**
 * Campo da tela de acesso (D63): o `Campo` (D64) com a fenda de 26 sempre
 * reservada embaixo, para o erro aparecer sem empurrar o botão e a tela caber
 * sem rolar em 375 x 667. Rótulo fixo acima, caixa de 56, anel de foco e de
 * erro em camadas e "Mostrar" com texto vêm todos do `Campo`: uma só caixa
 * para o app inteiro. Declara o campo ao preenchimento do sistema.
 */
export function CampoDeAcesso({
  disparoDeErro = 0,
  somenteLeitura = false,
  ...resto
}: PropsDoCampoDeAcesso) {
  // "Só leitura" da entrada é "enviando": não edita, e nada muda de cor.
  return (
    <Campo
      fenda
      spellCheck={false}
      importantForAutofill="yes"
      disparoDeErro={disparoDeErro}
      semEdicao={somenteLeitura}
      {...resto}
    />
  )
}
