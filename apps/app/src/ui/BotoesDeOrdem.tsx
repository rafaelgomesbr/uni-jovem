import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { BotaoIcone } from './Botao'

interface PropsDosBotoesDeOrdem {
  /** Nome do item, para o rótulo ("Subir Louvor"). */
  nome: string
  posicao: number
  total: number
  aoSubir: () => void
  aoDescer: () => void
  desabilitado?: boolean
}

/**
 * Reordenar sem gesto: botões só ícone Subir e Descer (44, tonal) com rótulo
 * que diz o item e a posição. Arrastar pode existir, mas nunca é o único jeito.
 */
export function BotoesDeOrdem({
  nome,
  posicao,
  total,
  aoSubir,
  aoDescer,
  desabilitado = false,
}: PropsDosBotoesDeOrdem) {
  const lugar = `Posição ${posicao + 1} de ${total}.`
  return (
    <View style={{ flexDirection: 'row', gap: ESPACO.e8 }}>
      <BotaoIcone
        icone="subir"
        rotulo={`Subir ${nome}`}
        dica={posicao === 0 ? `${lugar} Já é o primeiro.` : lugar}
        desabilitado={desabilitado || posicao === 0}
        aoPressionar={aoSubir}
      />
      <BotaoIcone
        icone="descer"
        rotulo={`Descer ${nome}`}
        dica={posicao === total - 1 ? `${lugar} Já é o último.` : lugar}
        desabilitado={desabilitado || posicao === total - 1}
        aoPressionar={aoDescer}
      />
    </View>
  )
}

/** Move o item de `de` para `para` numa cópia da lista. */
export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  const copia = [...lista]
  if (para < 0 || para >= copia.length || de === para) return copia
  const [item] = copia.splice(de, 1)
  copia.splice(para, 0, item as T)
  return copia
}
