import { ESPACO } from '@uj/tokens'
import type { ReactNode, Ref } from 'react'
import { View } from 'react-native'

import { CartaoDeDestaque as Destaque } from '@/ui/CartaoDeDestaque'
import { Chip as ChipDeEstado, type TomDoChip } from '@/ui/Chip'
import type { NoDeTexto } from '@/ui/foco'
import type { NomeDoIcone } from '@/ui/Icone'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { soNaWeb } from '@/ui/web'

export type { TomDoChip }

/*
 * Composições antigas das telas de Equipe e Plataforma. As telas desta área
 * já usam os componentes de `ui/` direto (Tela com título, CartaoDeDestaque,
 * Chip); o que fica aqui serve a quem ainda não migrou (Trocar de comunidade)
 * e desenha com os mesmos componentes novos.
 */

/** Rótulo curto em maiúsculas, coral, acima de um título ("sobrancelha"). */
export function Sobrancelha({ children }: { children: string }) {
  return <Texto variante="sobrancelha">{children}</Texto>
}

interface PropsDoCabecalhoDeTela {
  sobrancelha?: string
  titulo: string
  descricao?: string
  refDoTitulo?: Ref<NoDeTexto>
  /** Conteúdo à direita do título (ex.: botão curto). */
  acao?: ReactNode
}

/** Sobrancelha + título + descrição (legado: as telas novas passam o título para a `Tela`). */
export function CabecalhoDeTela({
  sobrancelha,
  titulo,
  descricao,
  refDoTitulo,
  acao,
}: PropsDoCabecalhoDeTela) {
  return (
    <View style={{ gap: ESPACO.e4 }}>
      {sobrancelha ? <Sobrancelha>{sobrancelha}</Sobrancelha> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
        <Texto
          variante="tituloTela"
          ref={refDoTitulo}
          nivel={1}
          style={{ flex: 1 }}
          {...soNaWeb({ tabIndex: -1 })}
        >
          {titulo}
        </Texto>
        {acao}
      </View>
      {descricao ? (
        <Texto cor="textoSuave" style={{ marginTop: ESPACO.e4 }}>
          {descricao}
        </Texto>
      ) : null}
    </View>
  )
}

interface PropsDoDestaque {
  sobrancelha?: string
  titulo: string
  descricao?: string
  children?: ReactNode
}

/** O cartão de destaque de `ui/` com a ação principal como filho. */
export function CartaoDeDestaque({ sobrancelha, titulo, descricao, children }: PropsDoDestaque) {
  return (
    <Destaque
      {...(sobrancelha ? { sobrancelha } : {})}
      titulo={titulo}
      {...(descricao ? { descricao } : {})}
      {...(children ? { acoes: <View style={{ gap: ESPACO.e8 }}>{children}</View> } : {})}
    />
  )
}

/** Chip de estado (2.12.12), preenchido; o ícone opcional reforça o texto. */
export function Chip({
  texto,
  icone,
  tom = 'neutro',
}: {
  texto: string
  icone?: NomeDoIcone
  tom?: TomDoChip
}) {
  return <ChipDeEstado texto={texto} tom={tom} {...(icone ? { icone } : {})} />
}

/** Fila de chips que quebra linha. */
export function Chips({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>{children}</View>
}

/** Tela de pilha desta área, sem título próprio (legado). */
export function TelaPropria({ children, larga }: { children: ReactNode; larga?: boolean }) {
  return (
    <Tela pilha {...(larga ? { larga } : {})}>
      {children}
    </Tela>
  )
}
