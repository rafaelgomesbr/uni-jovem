import { ALTURA, ESPACO } from '@uj/tokens'
import { Pressable, useWindowDimensions, View } from 'react-native'

import type { ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'
import { Botao } from '@/ui/Botao'
import { useTema } from '@/ui/tema'
import { Texto } from '@/ui/Texto'

import { SeloDePdf } from '../pdf/CartaoDoPdf'
import { descricaoDoItem } from './rotulosDoRepertorio'

/** Largura dos dois botões, iguais (cabe "Descer" com o ícone e deixa o título respirar). */
const LARGURA_DOS_BOTOES = 104

interface Props {
  item: ItemDoRepertorio
  posicao: number
  total: number
  /** Mudando a ordem ou o tom agora: os botões esperam. */
  ocupado: boolean
  aoMover: (de: number, para: number) => void
  /** Abre a folha da música: tom do dia, cifra, PDF, links e tirar do repertório. */
  aoAbrir: () => void
}

/**
 * UMA linha por música (auditoria de UX, achados 43 e 4.4): à esquerda o número, o título e o que
 * a música é (tom, andamento, de quem); à direita "Subir" e "Descer", botões com ícone e texto de
 * 48 de altura, do mesmo tamanho e empilhados. A linha inteira (menos os dois botões) é um botão
 * que abre a folha da música: nada de "Mais" solto nem de Tom − e Tom + na lista. Com fonte grande
 * (escala de 1,35 ou mais), os botões vão para baixo do texto, lado a lado.
 *
 * Os recuos são os dos tokens: 16 nas laterais e 12 entre as partes.
 */
export function LinhaDaMusica({ item, posicao, total, ocupado, aoMover, aoAbrir }: Props) {
  const { cores } = useTema()
  const { fontScale } = useWindowDimensions()
  const embaixo = fontScale >= 1.35
  const descricao = descricaoDoItem(item)
  const falado = `Música ${posicao + 1} de ${total}: ${item.titulo}. ${descricao}.${item.nota ? ` Observação: ${item.nota}.` : ''}`
  const lugar = `Posição ${posicao + 1} de ${total}.`

  return (
    <View
      style={{
        flexDirection: embaixo ? 'column' : 'row',
        alignItems: embaixo ? 'stretch' : 'center',
        gap: ESPACO.e12,
        paddingHorizontal: ESPACO.e16,
        paddingVertical: ESPACO.e12,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${falado} Toque para abrir as opções da música.`}
        onPress={aoAbrir}
        style={({ pressed }) => [
          {
            flex: embaixo ? undefined : 1,
            minHeight: ALTURA.botao.medio,
            flexDirection: 'row',
            alignItems: 'center',
            gap: ESPACO.e12,
          },
          pressed ? { backgroundColor: cores.pressionado } : null,
        ]}
      >
        <Texto variante="codigo" cor="destaque" style={{ minWidth: ESPACO.e24 }} centralizado>
          {String(posicao + 1)}
        </Texto>
        <View style={{ flex: 1, gap: ESPACO.e4 }}>
          <Texto variante="tituloItem">{item.titulo}</Texto>
          <Texto variante="meta" cor="textoSuave">
            {descricao}
          </Texto>
          {item.nota ? <Texto variante="meta">{item.nota}</Texto> : null}
          {item.temPdf ? (
            <View style={{ flexDirection: 'row', marginTop: ESPACO.e4 }}>
              <SeloDePdf />
            </View>
          ) : null}
        </View>
      </Pressable>
      <View
        style={
          embaixo
            ? { flexDirection: 'row', gap: ESPACO.e8 }
            : { width: LARGURA_DOS_BOTOES, gap: ESPACO.e8 }
        }
      >
        <View style={embaixo ? { flex: 1 } : undefined}>
          <Botao
            titulo="Subir"
            icone="subir"
            variante="secundario"
            tamanho="medio"
            larguraTotal
            rotuloAcessivel={`Subir ${item.titulo}`}
            dica={posicao === 0 ? `${lugar} Já é a primeira.` : lugar}
            desabilitado={ocupado || posicao === 0}
            aoPressionar={() => aoMover(posicao, posicao - 1)}
          />
        </View>
        <View style={embaixo ? { flex: 1 } : undefined}>
          <Botao
            titulo="Descer"
            icone="descer"
            variante="secundario"
            tamanho="medio"
            larguraTotal
            rotuloAcessivel={`Descer ${item.titulo}`}
            dica={posicao === total - 1 ? `${lugar} Já é a última.` : lugar}
            desabilitado={ocupado || posicao === total - 1}
            aoPressionar={() => aoMover(posicao, posicao + 1)}
          />
        </View>
      </View>
    </View>
  )
}
