import { ESPACO } from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { Botao } from './Botao'
import type { NomeDoIcone } from './Icone'

interface PropsDoExpansivel {
  /** Texto do botão que abre (ex.: "Adicionar tarefa"). */
  titulo: string
  icone?: NomeDoIcone
  /** Recebe `fechar` para o formulário se recolher depois de salvar. */
  children: (fechar: () => void) => ReactNode
  desabilitado?: boolean
  motivo?: string
}

/**
 * Formulário curto que só aparece quando pedido, para a tela não virar um
 * paredão de campos. O botão informa se está aberto (estado `expanded`).
 */
export function Expansivel({
  titulo,
  icone = 'adicionar',
  children,
  desabilitado,
  motivo,
}: PropsDoExpansivel) {
  const [aberto, setAberto] = useState(false)
  if (!aberto) {
    return (
      <Botao
        titulo={titulo}
        icone={icone}
        variante="secundario"
        aoPressionar={() => setAberto(true)}
        desabilitado={desabilitado}
        {...(motivo ? { motivo } : {})}
      />
    )
  }
  return (
    <View style={{ gap: ESPACO.x3 }}>
      {children(() => setAberto(false))}
      <Botao titulo="Fechar sem salvar" variante="discreto" aoPressionar={() => setAberto(false)} />
    </View>
  )
}
