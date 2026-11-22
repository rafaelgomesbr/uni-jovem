import { ESPACO, type PoseDoSol } from '@uj/tokens'
import { View } from 'react-native'

import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import type { NomeDoIcone } from '@/ui/Icone'
import { Sol } from '@/ui/Sol'
import { Texto } from '@/ui/Texto'

interface Props {
  titulo: string
  descricao: string
  /** Todo vazio tem uma ação, exceto quando ela não é da pessoa (esperar a liderança). */
  acao?: { titulo: string; aoPressionar: () => void; icone?: NomeDoIcone }
  pose?: PoseDoSol
  lado?: number
}

/**
 * Estado vazio de tela inteira no visual A: o sol "ainda não" (decorativo, escondido do leitor
 * de tela), o título, uma frase e a ação. Serve ao Check-in, ao Ao vivo e ao Meu repertório.
 */
export function VazioComSol({ titulo, descricao, acao, pose = 'escondido', lado = 88 }: Props) {
  return (
    <Cartao>
      <View style={{ alignItems: 'center', gap: ESPACO.e12, paddingVertical: ESPACO.e8 }}>
        <Sol pose={pose} lado={lado} />
        <Texto variante="tituloCartao" accessibilityRole="header" centralizado>
          {titulo}
        </Texto>
        <Texto
          variante="corpo"
          cor="textoSuave"
          centralizado
          style={{ paddingHorizontal: ESPACO.e12 }}
        >
          {descricao}
        </Texto>
        {acao ? (
          <Botao
            titulo={acao.titulo}
            aoPressionar={acao.aoPressionar}
            {...(acao.icone ? { icone: acao.icone } : {})}
          />
        ) : null}
      </View>
    </Cartao>
  )
}
