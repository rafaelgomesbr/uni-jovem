import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { Icone, type NomeDoIcone } from './Icone'
import { ALVO } from './medidas'
import { useTema } from './tema'

interface PropsDosBotoesDeOrdem {
  /** Nome do item, para o rótulo ("Subir Louvor"). */
  nome: string
  posicao: number
  total: number
  aoSubir: () => void
  aoDescer: () => void
  desabilitado?: boolean
}

function BotaoDeOrdem({
  icone,
  rotulo,
  dica,
  inativo,
  aoPressionar,
}: {
  icone: NomeDoIcone
  rotulo: string
  dica: string
  inativo: boolean
  aoPressionar: () => void
}) {
  const { cores } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={dica}
      aria-disabled={inativo}
      disabled={inativo}
      onPress={aoPressionar}
      style={({ pressed }) => ({
        minWidth: ALVO,
        minHeight: ALVO,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RAIO.pequeno,
        borderWidth: 1.5,
        borderColor: cores.borda,
        backgroundColor: cores.superficie,
        opacity: inativo ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Icone nome={icone} cor={cores.texto} tamanho={20} />
    </Pressable>
  )
}

/**
 * Reordenar sem gesto: botões Subir e Descer com alvo de 44 pt e rótulo que
 * diz o item e a posição. Arrastar pode existir, mas nunca é o único jeito.
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
    <View style={{ flexDirection: 'row', gap: ESPACO.x1 }}>
      <BotaoDeOrdem
        icone="subir"
        rotulo={`Subir ${nome}`}
        dica={posicao === 0 ? `${lugar} Já é o primeiro.` : lugar}
        inativo={desabilitado || posicao === 0}
        aoPressionar={aoSubir}
      />
      <BotaoDeOrdem
        icone="descer"
        rotulo={`Descer ${nome}`}
        dica={posicao === total - 1 ? `${lugar} Já é o último.` : lugar}
        inativo={desabilitado || posicao === total - 1}
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
