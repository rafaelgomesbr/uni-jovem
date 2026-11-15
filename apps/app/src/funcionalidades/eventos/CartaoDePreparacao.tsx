import { BORDA, ESPACO } from '@uj/tokens'
import { Fragment, useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { AvisoDeFalha } from './Falha'

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
  /** `marcar`: caixas de marcar; `lista`: linhas de lista (anexos). */
  tipo?: 'marcar' | 'lista'
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
      <ItensComSeparador itens={itens} editando={emEdicao} />
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

/** Caixas de marcar com o separador recuado até o texto (quadro 03b). */
function ItensComSeparador({
  itens,
  editando,
}: {
  itens: readonly ItemDaPreparacao[]
  editando: boolean
}) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  return (
    <View>
      {itens.map((i, n) => (
        <Fragment key={i.chave}>
          {n > 0 ? (
            <View
              style={{
                height: BORDA.fina,
                marginLeft: ESPACO.e32,
                backgroundColor: aumentarContraste ? cores.campoBorda : cores.separador,
              }}
            />
          ) : null}
          {i.no(editando)}
        </Fragment>
      ))}
    </View>
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
