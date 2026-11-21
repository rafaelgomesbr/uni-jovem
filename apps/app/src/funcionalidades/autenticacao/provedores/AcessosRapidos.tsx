import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { BotaoApple } from './BotaoApple'
import { BotaoGoogle } from './BotaoGoogle'

export type ProvedorEmAndamento = 'google' | 'apple'

interface PropsDosAcessosRapidos {
  /** Qual dos dois está falando com o provedor ou com a API agora. */
  carregando: ProvedorEmAndamento | null
  /** Outra ação da tela está em andamento (entrar por e-mail, por exemplo). */
  desabilitado?: boolean
  aoObterTokenDoGoogle: (idToken: string) => void
  aoPedirApple: () => void
  aoFalhar: (mensagem: string) => void
}

/**
 * Os dois acessos rápidos, grandes e na mesma largura: Apple primeiro (só no
 * iOS com conta Apple no aparelho), depois o Google (onde o ID de cliente
 * existe). Cada botão some sozinho quando não existe na plataforma; quem
 * chama usa `useTemProvedor` para saber se há algum. Enquanto um trabalha, o
 * outro fica inativo, para não haver dois pedidos de uma vez.
 */
export function AcessosRapidos({
  carregando,
  desabilitado = false,
  aoObterTokenDoGoogle,
  aoPedirApple,
  aoFalhar,
}: PropsDosAcessosRapidos) {
  const ocupado = carregando !== null
  return (
    <View style={{ gap: ESPACO.e12 }}>
      <BotaoApple
        carregando={carregando === 'apple'}
        desabilitado={desabilitado || (ocupado && carregando !== 'apple')}
        aoPressionar={aoPedirApple}
      />
      <BotaoGoogle
        carregando={carregando === 'google'}
        desabilitado={desabilitado || (ocupado && carregando !== 'google')}
        aoObterToken={aoObterTokenDoGoogle}
        aoFalhar={aoFalhar}
      />
    </View>
  )
}
