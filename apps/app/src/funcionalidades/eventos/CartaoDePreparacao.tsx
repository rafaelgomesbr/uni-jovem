import { ESPACO } from '@uj/tokens'
import { Fragment, useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { Botao, BotaoIcone } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { Lista, RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'

export interface ItemDaPreparacao {
  chave: string
  /** A linha do item; recebe se a lista está em edição (para mostrar o Remover). */
  no: (editando: boolean) => ReactNode
}

interface Props {
  sobrancelha: string
  /** Uma linha quando não há nada ("Nenhuma tarefa ainda."). */
  vazio: string
  itens: readonly ItemDaPreparacao[]
  /** `marcar`: caixas de marcar; `lista`: linhas de lista (anexos); `texto`: blocos de texto (notas). */
  tipo?: 'marcar' | 'lista' | 'texto'
  /** Terciário "+ Adicionar ..." do rodapé; com `motivo`, desabilitado com a explicação. */
  adicionar?: { titulo: string; aoPressionar: () => void; motivo?: string } | null
  /** Quem gerencia pode entrar em edição (Remover em cada item). */
  editavel?: boolean
  /** Linha de apoio logo abaixo da sobrancelha ("Só a organização vê"). */
  apoio?: string
  erro?: unknown
}

/**
 * Bloco da Preparação (3.4.2, item 8, e quadro 03b): sobrancelha dentro do
 * cartão, os itens com separador, o vazio de uma linha e, no rodapé, o
 * terciário "Adicionar" alinhado ao texto. Remover fica atrás de "Editar",
 * para a lista não virar uma parede de botões (e nada fica só em gesto).
 */
export function CartaoDePreparacao({
  sobrancelha,
  vazio,
  itens,
  tipo = 'marcar',
  adicionar,
  editavel = false,
  apoio,
  erro,
}: Props) {
  const [editando, setEditando] = useState(false)
  const emEdicao = editando && editavel && itens.length > 0
  const rodape =
    adicionar || (editavel && itens.length > 0) ? (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e16 }}>
        {adicionar && !emEdicao ? (
          <Botao
            titulo={adicionar.titulo}
            icone="adicionar"
            variante="terciario"
            alinhado
            aoPressionar={adicionar.aoPressionar}
            {...(adicionar.motivo ? { desabilitado: true, motivo: adicionar.motivo } : {})}
          />
        ) : null}
        <View style={{ flex: 1 }} />
        {editavel && itens.length > 0 ? (
          <Botao
            titulo={emEdicao ? 'Concluir' : 'Editar'}
            variante="terciario"
            alinhado
            rotuloAcessivel={
              emEdicao ? `Concluir a edição: ${sobrancelha}` : `Editar: ${sobrancelha}`
            }
            expandido={emEdicao}
            aoPressionar={() => setEditando((e) => !e)}
          />
        ) : null}
      </View>
    ) : undefined

  const conteudo =
    itens.length === 0 ? (
      <Texto variante="corpo" cor="textoSuave">
        {vazio}
      </Texto>
    ) : tipo === 'lista' ? (
      // As linhas chegam com a própria chave: a `Lista` lê as props delas para recuar o separador.
      <Lista>{itens.map((i) => i.no(emEdicao))}</Lista>
    ) : (
      // Separador recuado até o texto: depois da caixa de 22 e do intervalo de 12 (quadro 03b).
      <Lista recuo={tipo === 'marcar' ? RECUO_DA_LISTA.caixa : RECUO_DA_LISTA.texto}>
        {itens.map((i) => (
          <Fragment key={i.chave}>{i.no(emEdicao)}</Fragment>
        ))}
      </Lista>
    )

  return (
    <>
      {erro ? <AvisoDeFalha erro={erro} /> : null}
      <CartaoDeVidro
        sobrancelha={sobrancelha}
        lista={tipo === 'lista' && itens.length > 0}
        intervalo={0}
        {...(rodape ? { acoes: rodape } : {})}
      >
        {apoio ? (
          <Texto variante="legenda" cor="textoSuave">
            {apoio}
          </Texto>
        ) : null}
        {conteudo}
      </CartaoDeVidro>
    </>
  )
}

/** Item com o "Remover" de 44 à direita, que só aparece em edição. */
export function ComRemover({
  editando,
  rotulo,
  aoRemover,
  children,
}: {
  editando: boolean
  /** "Remover a tarefa Comprar o brinde". */
  rotulo: string
  aoRemover: () => void
  children: ReactNode
}) {
  if (!editando) return <>{children}</>
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
      <View style={{ flex: 1 }}>{children}</View>
      <BotaoIcone icone="excluir" rotulo={rotulo} aoPressionar={aoRemover} />
    </View>
  )
}
