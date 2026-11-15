import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { Icone } from './Icone'
import { ALVO } from './medidas'
import { useSetasDoGrupo } from './setasDoGrupo'
import { Texto } from './Texto'
import { useTema } from './tema'

export interface Opcao<T extends string> {
  valor: T
  rotulo: string
  descricao?: string
  desabilitada?: boolean
}

interface PropsDoGrupo<T extends string> {
  rotulo: string
  opcoes: readonly Opcao<T>[]
  valor: T | null
  aoMudar: (valor: T) => void
}

/** Escolha única acessível (papel `radio`), com marca visível além da cor. */
export function GrupoDeOpcoes<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: PropsDoGrupo<T>) {
  const { cores } = useTema()
  const propsDaOpcao = useSetasDoGrupo(opcoes, valor, aoMudar)
  return (
    <View accessibilityRole="radiogroup" aria-label={rotulo} style={{ gap: ESPACO.x2 }}>
      <Texto variante="corpoForte">{rotulo}</Texto>
      {opcoes.map((opcao) => {
        const marcada = opcao.valor === valor
        return (
          <Pressable
            key={opcao.valor}
            {...propsDaOpcao(opcao.valor)}
            accessibilityRole="radio"
            accessibilityLabel={opcao.rotulo}
            accessibilityHint={opcao.descricao}
            aria-checked={marcada}
            aria-disabled={!!opcao.desabilitada}
            disabled={opcao.desabilitada}
            onPress={() => aoMudar(opcao.valor)}
            style={({ pressed }) => ({
              minHeight: ALVO,
              flexDirection: 'row',
              alignItems: 'center',
              gap: ESPACO.x3,
              paddingHorizontal: ESPACO.x4,
              paddingVertical: ESPACO.x3,
              borderRadius: RAIO.medio,
              borderWidth: marcada ? 2 : 1,
              borderColor: marcada ? cores.destaque : cores.borda,
              backgroundColor: marcada || pressed ? cores.superficieRealce : cores.superficie,
              opacity: opcao.desabilitada ? 0.5 : 1,
            })}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: marcada ? cores.destaque : cores.borda,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {marcada ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: cores.destaque,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Texto variante="corpoForte">{opcao.rotulo}</Texto>
              {opcao.descricao ? (
                <Texto variante="apoio" cor="textoSuave">
                  {opcao.descricao}
                </Texto>
              ) : null}
            </View>
            {marcada ? <Icone nome="confirmado" cor={cores.destaque} tamanho={20} /> : null}
          </Pressable>
        )
      })}
    </View>
  )
}
