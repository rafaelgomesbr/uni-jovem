import { ESPACO, TIPO } from '@uj/tokens'
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
    // Sem rótulo no contêiner (View sem papel não tem nome): o título visível abre a lista.
    <View style={{ gap: ESPACO.e4 }}>
      <Texto variante="rotulo" cor="textoSuave">
        Sua senha precisa ter:
      </Texto>
      {regras.map((regra) => {
        const ok = regra.atendida === true
        const situacao =
          regra.atendida === null ? 'conferido ao enviar' : ok ? 'atendida' : 'ainda não atendida'
        return (
          <View
            key={regra.id}
            accessible
            accessibilityLabel={`${regra.texto}: ${situacao}`}
            style={{ flexDirection: 'row', gap: ESPACO.e8, alignItems: 'flex-start' }}
          >
            {/* Checklist (3.1.2): ícone e texto por regra; o check é o sinal além da cor. */}
            <View style={{ height: TIPO.corpo.altura, justifyContent: 'center' }}>
              <Icone
                nome={ok ? 'check' : 'pendente'}
                cor={ok ? cores.sucesso : cores.textoSuave}
                tamanho={16}
                peso="forte"
              />
            </View>
            <Texto variante="corpo" cor={ok ? 'texto' : 'textoSuave'} style={{ flex: 1 }}>
              {regra.texto}
              {regra.atendida === true ? ' (ok)' : ''}
            </Texto>
          </View>
        )
      })}
    </View>
  )
}
