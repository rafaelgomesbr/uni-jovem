import { ESPACO } from '@uj/tokens'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { Aparecer } from './Aparecer'
import { Botao } from './Botao'
import { focar, type NoDeView } from './foco'
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
 * paredão de campos. O botão que abre continua na tela (com `aria-expanded`),
 * então o foco nunca se perde; ao fechar pelo fim do formulário, o foco
 * volta para ele.
 */
export function Expansivel({
  titulo,
  icone = 'adicionar',
  children,
  desabilitado,
  motivo,
}: PropsDoExpansivel) {
  const [aberto, setAberto] = useState(false)
  // Conta os fechamentos pelo fim do formulário: cada um devolve o foco ao botão.
  const [fechamentos, setFechamentos] = useState(0)
  const botao = useRef<NoDeView>(null)
  useEffect(() => {
    if (fechamentos > 0) focar(botao)
  }, [fechamentos])
  function fechar() {
    setAberto(false)
    setFechamentos((n) => n + 1)
  }
  return (
    <View style={{ gap: ESPACO.e12 }}>
      <Botao
        ref={botao}
        titulo={titulo}
        icone={aberto ? 'fechar' : icone}
        variante={aberto ? 'terciario' : 'secundario'}
        larguraTotal={!aberto}
        expandido={aberto}
        aoPressionar={() => setAberto((a) => !a)}
        desabilitado={desabilitado}
        {...(motivo ? { motivo } : {})}
      />
      {aberto ? (
        <Aparecer style={{ gap: ESPACO.e12 }}>
          {children(fechar)}
          <Botao titulo="Fechar sem salvar" variante="terciario" aoPressionar={fechar} />
        </Aparecer>
      ) : null}
    </View>
  )
}
