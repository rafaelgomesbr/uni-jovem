import { ESPACO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { Texto } from './Texto'

interface PropsDaSecao {
  /** O nome do grupo, fora do cartão, anunciado como cabeçalho. */
  titulo: string
  /**
   * Como o nome aparece (D83). `rotulo` (padrão): caixa-alta de 14 com espaço entre letras e cor
   * suave, para grupos de formulário e de ajuste. `titulo`: título de seção de 20 em 600, em frase
   * normal, para o bloco que é o assunto da tela ("Hoje: 3 encontros", "Para responder").
   */
  estilo?: 'rotulo' | 'titulo'
  /** Uma frase abaixo do grupo, quando o grupo pede explicação. */
  rodape?: string
  /** Ação curta à direita do nome (ex.: terciário "Ver todos"). */
  acao?: ReactNode
  children: ReactNode
}

/**
 * Grupo novo (seção 2.13 e quadro 04): o nome do grupo fora do cartão, 24 acima (8 mais o intervalo
 * de 16 da tela) e 8 abaixo. Dois níveis de peso na tela (D83): o rótulo pequeno em caixa-alta para
 * agrupar e o título de seção de 20 para o que a pessoa veio ver.
 */
export function Secao({ titulo, estilo = 'rotulo', rodape, acao, children }: PropsDaSecao) {
  return (
    <View style={{ gap: ESPACO.e8, marginTop: ESPACO.e8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 16, gap: ESPACO.e8 }}>
        {estilo === 'titulo' ? (
          <Texto variante="secao" style={{ flex: 1 }}>
            {titulo}
          </Texto>
        ) : (
          <Texto variante="sobrancelha" cor="textoSuave" style={{ flex: 1 }}>
            {titulo}
          </Texto>
        )}
        {acao}
      </View>
      {children}
      {rodape ? (
        <Texto variante="legenda" cor="textoSuave">
          {rodape}
        </Texto>
      ) : null}
    </View>
  )
}
