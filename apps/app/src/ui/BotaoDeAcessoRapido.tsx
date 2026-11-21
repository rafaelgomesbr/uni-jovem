import { BotaoDeAcesso } from './BotaoDeAcesso'

export type MarcaDeAcesso = 'apple' | 'google'

export interface PropsDoBotaoDeAcessoRapido {
  marca: MarcaDeAcesso
  /** O texto é sempre o do botão ("Continuar com a Apple"): é também o nome para o leitor de tela. */
  titulo: string
  carregando?: boolean
  inativo?: boolean
  /** Por que está inativo (lido pelo leitor de tela e mostrado embaixo). */
  motivo?: string
  aoPressionar: () => void
}

/**
 * Acesso rápido (Apple e Google) fora da tela de entrada, onde só há os dois
 * provedores (confirmar a conta, conectar, criar conta): a Apple é o botão
 * cheio e o Google, o de contorno, como no desenho da entrada (D63). A
 * hierarquia completa, com selo, Face ID e e-mail, é do `BotaoDeAcesso`.
 */
export function BotaoDeAcessoRapido({
  marca,
  titulo,
  carregando = false,
  inativo = false,
  motivo,
  aoPressionar,
}: PropsDoBotaoDeAcessoRapido) {
  return (
    <BotaoDeAcesso
      marca={marca}
      nivel={marca === 'apple' ? 'primario' : 'secundario'}
      titulo={titulo}
      carregando={carregando}
      inativo={inativo}
      {...(motivo ? { motivo } : {})}
      aoPressionar={aoPressionar}
    />
  )
}
