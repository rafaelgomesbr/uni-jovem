import { ESPACO, RAIO } from '@uj/tokens'
import type { ReactNode, Ref } from 'react'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Cartao } from '@/ui/Cartao'
import type { NoDeTexto } from '@/ui/foco'
import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { soNaWeb } from '@/ui/web'

/*
 * Composições da linguagem Aurora usadas pelas telas de Equipe e Plataforma,
 * montadas sobre `ui/` (Tela com fundo Aurora, Cartao de vidro e de destaque,
 * Texto "sobrancelha"). O que é só desta área (chip com tom, cabeçalho com
 * sobrancelha) fica aqui.
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

/** Sobrancelha + título em Bricolage 800 + descrição: o topo das telas desta área. */
export function CabecalhoDeTela({
  sobrancelha,
  titulo,
  descricao,
  refDoTitulo,
  acao,
}: PropsDoCabecalhoDeTela) {
  return (
    <View style={{ gap: ESPACO.x1 }}>
      {sobrancelha ? <Sobrancelha>{sobrancelha}</Sobrancelha> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x3 }}>
        <Texto
          variante="tituloGrande"
          ref={refDoTitulo}
          nivel={1}
          style={{ flex: 1, letterSpacing: -0.5 }}
          {...soNaWeb({ tabIndex: -1 })}
        >
          {titulo}
        </Texto>
        {acao}
      </View>
      {descricao ? (
        <Texto cor="textoSuave" style={{ marginTop: ESPACO.x1 }}>
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

/**
 * Cartão claro de destaque com título grande: a ação principal da tela (ex.:
 * Convidar pessoas). Dentro dele, texto, chips e botões usam a paleta do
 * destaque (contexto do `Cartao`), com os pares conferidos nos tokens.
 */
export function CartaoDeDestaque({ sobrancelha, titulo, descricao, children }: PropsDoDestaque) {
  return (
    <Cartao variante="destaque" {...(sobrancelha ? { titulo: sobrancelha } : {})}>
      <View style={{ gap: ESPACO.x1 }}>
        <Texto variante="titulo" nivel={2} style={{ fontSize: 24, lineHeight: 30 }}>
          {titulo}
        </Texto>
        {descricao ? (
          <Texto variante="apoio" cor="textoSuave">
            {descricao}
          </Texto>
        ) : null}
      </View>
      {children}
    </Cartao>
  )
}

export type TomDoChip = 'neutro' | 'destaque' | 'sucesso' | 'alerta' | 'erro'

/**
 * Chip em pílula (papel, estado). O texto carrega o sentido; ícone e contorno
 * na cor do tom só reforçam (cor nunca é o único sinal). O texto fica sempre
 * na cor de texto, que passa AA sobre o fundo de realce nos dois temas.
 */
export function Chip({
  texto,
  icone,
  tom = 'neutro',
}: {
  texto: string
  icone?: NomeDoIcone
  tom?: TomDoChip
}) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const corDoTom = tom === 'neutro' ? cores.textoSuave : cores[tom]
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: ESPACO.x1,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: RAIO.pilula,
        backgroundColor: cores.superficieRealce,
        borderWidth: 1,
        borderColor: aumentarContraste
          ? cores.texto
          : tom === 'neutro'
            ? cores.bordaSuave
            : corDoTom,
      }}
    >
      {icone ? <Icone nome={icone} cor={corDoTom} tamanho={14} /> : null}
      <Texto variante="rotulo">{texto}</Texto>
    </View>
  )
}

/** Fila de chips que quebra linha. */
export function Chips({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>{children}</View>
}

/**
 * Tela de pilha desta área: fundo Aurora e o botão Voltar em pílula de vidro
 * da `Tela` (a pilha não desenha cabeçalho nativo: `headerShown: false`).
 */
export function TelaPropria({ children, larga }: { children: ReactNode; larga?: boolean }) {
  return (
    <Tela cabecalhoNativo {...(larga ? { larga } : {})}>
      {children}
    </Tela>
  )
}
