import { ESPACO, type PoseDoSol } from '@uj/tokens'
import { View } from 'react-native'

import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import type { NomeDoIcone } from '@/ui/Icone'
import { Sol } from '@/ui/Sol'
import { Texto } from '@/ui/Texto'

interface PropsDoVazioComSol {
  titulo: string
  descricao: string
  /** O vazio sempre ensina e tem uma ação, exceto quando a ação não é da pessoa (D65, 5.6). */
  acao?: { titulo: string; aoPressionar: () => void; icone?: NomeDoIcone }
  /** O sol "ainda não": atrás do horizonte. */
  pose?: PoseDoSol
  lado?: number
}

/**
 * Estado vazio de tela inteira ou de bloco grande, no visual A: o sol da marca (decorativo,
 * escondido do leitor de tela), o título, uma frase e o botão. Vive aqui porque `ui/` é a
 * fundação e não tem esta composição; avisos, oração e sugestões usam a mesma.
 */
export function VazioComSol({
  titulo,
  descricao,
  acao,
  pose = 'escondido',
  lado = 88,
}: PropsDoVazioComSol) {
  return (
    <Cartao>
      <View style={{ alignItems: 'center', gap: ESPACO.e12, paddingVertical: ESPACO.e8 }}>
        <Sol pose={pose} lado={lado} />
        <Texto variante="tituloCartao" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {titulo}
        </Texto>
        <Texto
          variante="corpo"
          cor="textoSuave"
          style={{ textAlign: 'center', paddingHorizontal: ESPACO.e16 }}
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
