import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import type { ReactNode, Ref } from 'react'
import { View } from 'react-native'

import { BotaoIcone } from './Botao'
import type { NoDeTexto } from './foco'
import { voltarOu } from './navegacao'
import { Texto } from './Texto'
import { useTema } from './tema'
import { soNaWeb } from './web'

export type TipoDeCabecalho = 'raiz' | 'pilha' | 'folha'

export interface PropsDoCabecalhoDeTela {
  tipo: TipoDeCabecalho
  titulo?: string
  /** Subtítulo em `corpo` suave, 4 abaixo do título (no máximo 2 linhas na pilha). */
  subtitulo?: string
  /**
   * Bloco próprio 8 abaixo do título (ou do subtítulo), como a meta e os
   * chips do detalhe do evento (quadro 03).
   */
  abaixoDoTitulo?: ReactNode
  /** Raiz: a linha de 44 com a pílula e o status. */
  linhaDoTopo?: ReactNode
  /** Raiz: só ícone de 44 à direita do título ("+", "Convidar"). */
  acaoDoTitulo?: ReactNode
  /** Pilha: ações de 44 à direita do voltar, com intervalo de 8. */
  acoes?: ReactNode
  /** Pilha sem voltar (o link é a entrada, como no convite). */
  semVoltar?: boolean
  /**
   * Pilha aberta como modal (`fullScreenModal`, `modal`): o botão da esquerda
   * é "Fechar" (`xmark`) em vez de "Voltar", e fecha o modal.
   */
  modal?: boolean
  aoVoltar?: () => void
  /** Folha: o fechar (`xmark`, 44) à direita do título. */
  aoFechar?: () => void
  /** Fluxo com passos: "PASSO 2 DE 3" e a barra de segmentos acima do título. */
  passos?: { atual: number; total: number }
  refDoTitulo?: Ref<NoDeTexto>
}

/** Voltar padrão: a tela anterior ou, sem histórico (link aberto direto), o Início. */
export function voltar() {
  voltarOu('/')
}

/**
 * Cabeçalho de tela próprio (seção 2.12.16), no lugar do cabeçalho nativo:
 * - raiz: linha de 44 (pílula e status), 20, `display` 34/38;
 * - pilha: linha de 44 com o voltar circular (rótulo "Voltar"; "Fechar" no
 *   modal) e ações, 12, `tituloTela` 28/32 e subtítulo 4 abaixo;
 * - folha: título `tituloCartao` à esquerda e o fechar à direita.
 */
export function CabecalhoDeTela({
  tipo,
  titulo,
  subtitulo,
  abaixoDoTitulo,
  linhaDoTopo,
  acaoDoTitulo,
  acoes,
  semVoltar = false,
  modal = false,
  aoVoltar = voltar,
  aoFechar,
  passos,
  refDoTitulo,
}: PropsDoCabecalhoDeTela) {
  if (tipo === 'folha') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12, minHeight: 44 }}>
        <Texto variante="tituloCartao" nivel={1} ref={refDoTitulo} style={{ flex: 1 }}>
          {titulo}
        </Texto>
        {aoFechar ? (
          <BotaoIcone icone="fechar" rotulo="Fechar" circular aoPressionar={aoFechar} />
        ) : null}
      </View>
    )
  }

  const linha =
    tipo === 'raiz' ? (
      linhaDoTopo
    ) : semVoltar && !acoes ? null : (
      <View
        style={{
          minHeight: ALTURA.iconeSo,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: ESPACO.e8,
        }}
      >
        {semVoltar ? <View /> : <BotaoDeSaida modal={modal} aoPressionar={aoVoltar} />}
        {acoes ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
            {acoes}
          </View>
        ) : null}
      </View>
    )

  const espacoAteOTitulo = linha ? (tipo === 'raiz' ? ESPACO.e20 : ESPACO.e12) : 0

  return (
    <View>
      {linha}
      {passos ? <Passos {...passos} margem={espacoAteOTitulo} /> : null}
      {titulo ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: ESPACO.e12,
            marginTop: passos ? ESPACO.e12 : espacoAteOTitulo,
          }}
        >
          <Texto
            variante={tipo === 'raiz' ? 'display' : 'tituloTela'}
            ref={refDoTitulo}
            style={{ flex: 1 }}
            {...soNaWeb({ tabIndex: -1 })}
          >
            {titulo}
          </Texto>
          {acaoDoTitulo}
        </View>
      ) : null}
      {subtitulo ? (
        <Texto
          variante="corpo"
          cor="textoSuave"
          numberOfLines={tipo === 'pilha' ? 2 : undefined}
          style={{ marginTop: ESPACO.e4 }}
        >
          {subtitulo}
        </Texto>
      ) : null}
      {abaixoDoTitulo ? <View style={{ marginTop: ESPACO.e8 }}>{abaixoDoTitulo}</View> : null}
    </View>
  )
}

/** O botão da esquerda da pilha: "Voltar" (`chevron.left`) ou, no modal, "Fechar" (`xmark`). */
export function BotaoDeSaida({
  modal,
  aoPressionar,
}: {
  modal: boolean
  aoPressionar: () => void
}) {
  return modal ? (
    <BotaoIcone icone="fechar" rotulo="Fechar" circular aoPressionar={aoPressionar} />
  ) : (
    <BotaoIcone icone="voltar" rotulo="Voltar" circular aoPressionar={aoPressionar} />
  )
}

/** "PASSO 2 DE 3", 8, barra de segmentos de 4 (concluídos e o atual em primária). */
function Passos({ atual, total, margem }: { atual: number; total: number; margem: number }) {
  const { cores, solido } = useTema()
  return (
    <View
      style={{ marginTop: margem, gap: ESPACO.e8 }}
      accessible
      accessibilityLabel={`Passo ${atual} de ${total}`}
    >
      <Texto variante="sobrancelha" accessibilityRole="text">
        {`Passo ${atual} de ${total}`}
      </Texto>
      <View style={{ flexDirection: 'row', gap: ESPACO.e4 }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: RAIO.pilula,
              backgroundColor: i < atual ? cores.primaria : solido(cores.tonal),
            }}
          />
        ))}
      </View>
    </View>
  )
}
