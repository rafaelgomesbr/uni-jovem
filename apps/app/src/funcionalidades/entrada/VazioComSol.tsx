import { ESPACO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Sol } from '@/ui/Sol'
import { Texto } from '@/ui/Texto'
import { useAnunciar } from '@/ui/useAnunciar'

interface AcaoDoVazio {
  titulo: string
  aoPressionar: () => void
  /** Padrão: primário. */
  variante?: 'primario' | 'secundario' | 'terciario'
}

interface PropsDoVazioComSol {
  titulo: string
  descricao: string
  /** A ação da pessoa (todo vazio que é dela tem uma). Sem ela, o texto diz o que vai acontecer. */
  acao?: AcaoDoVazio
  acaoSecundaria?: AcaoDoVazio
  /** O sol: antes do amanhecer (vazio, "ainda não"), nascendo, pleno ("tudo em dia") ou poente. */
  pose?: 'escondido' | 'nascendo' | 'pleno' | 'poente'
  /** Anuncia ao leitor de tela quando aparece (erro, resultado de busca). */
  anunciar?: boolean
  /** Abaixo das ações: links de texto discretos (as outras saídas). */
  rodape?: ReactNode
}

/**
 * Estado vazio de tela inteira da direção A (UX v3, 5.6): o sol da marca em 104 pt (decorativo,
 * parado), o título, uma frase que diz por que está vazio e o que fazer, e a ação. Dentro de um
 * cartão de tinta para o texto nunca ficar nu sobre o brilho do fundo (regra 12 da fundação).
 * Só para a tela inteira vazia ou de primeira vez, nunca para linha ou seção.
 */
export function VazioComSol({
  titulo,
  descricao,
  acao,
  acaoSecundaria,
  pose = 'escondido',
  anunciar = false,
  rodape,
}: PropsDoVazioComSol) {
  useAnunciar(anunciar ? `${titulo}. ${descricao}` : null)
  return (
    <Cartao>
      <View style={{ alignItems: 'center', gap: ESPACO.e8, paddingVertical: ESPACO.e8 }}>
        <Sol pose={pose} lado={104} />
        <Texto variante="tituloCartao" accessibilityRole="header" centralizado>
          {titulo}
        </Texto>
        <Texto variante="corpo" cor="textoSuave" centralizado>
          {descricao}
        </Texto>
        {acao || acaoSecundaria ? (
          <View style={{ alignSelf: 'stretch', gap: ESPACO.e8, marginTop: ESPACO.e8 }}>
            {acao ? (
              <Botao
                titulo={acao.titulo}
                variante={acao.variante ?? 'primario'}
                tamanho="grande"
                larguraTotal
                aoPressionar={acao.aoPressionar}
              />
            ) : null}
            {acaoSecundaria ? (
              <Botao
                titulo={acaoSecundaria.titulo}
                variante={acaoSecundaria.variante ?? 'terciario'}
                aoPressionar={acaoSecundaria.aoPressionar}
              />
            ) : null}
          </View>
        ) : null}
        {rodape ? (
          <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>{rodape}</View>
        ) : null}
      </View>
    </Cartao>
  )
}
