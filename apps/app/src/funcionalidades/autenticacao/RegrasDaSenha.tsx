import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { avaliarSenha } from './politicaDeSenha'

interface PropsDasRegras {
  senha: string
  nome?: string | undefined
  email?: string | undefined
}

/** Lista das regras com o estado de cada uma: ícone e texto, não só cor. */
export function RegrasDaSenha({ senha, nome, email }: PropsDasRegras) {
  const { cores } = useTema()
  const regras = avaliarSenha(senha, { nome, email })
  return (
    <View accessibilityLabel="Regras da senha" style={{ gap: ESPACO.x1 }}>
      <Texto variante="corpoForte">Sua senha precisa ter:</Texto>
      {regras.map((regra) => {
        const ok = regra.atendida === true
        const situacao =
          regra.atendida === null ? 'conferido ao enviar' : ok ? 'atendida' : 'ainda não atendida'
        return (
          <View
            key={regra.id}
            accessible
            accessibilityLabel={`${regra.texto}: ${situacao}`}
            style={{ flexDirection: 'row', gap: ESPACO.x2, alignItems: 'flex-start' }}
          >
            <Icone
              nome={regra.atendida === null ? 'info' : ok ? 'confirmado' : 'info'}
              cor={ok ? cores.sucesso : cores.textoSuave}
              tamanho={18}
            />
            <Texto variante="apoio" cor={ok ? 'texto' : 'textoSuave'} style={{ flex: 1 }}>
              {regra.texto}
              {regra.atendida === true ? ' (ok)' : ''}
            </Texto>
          </View>
        )
      })}
    </View>
  )
}
