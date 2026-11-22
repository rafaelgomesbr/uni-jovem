import { ALTURA, ESPACO, RAIO, TAMANHO_DO_AVATAR, TIPO } from '@uj/tokens'
import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Avatar, type DadosDoAvatar } from './Avatar'
import { useNoCartaoLista } from './CartaoDeVidro'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import { soNaWeb } from './web'

/** Coluna de hora (M): largura mínima de 44, que cresce com a fonte. */
export const LARGURA_DA_HORA = 44

/**
 * Recuo do separador até o texto da linha de baixo (quadro 01c): 18 de
 * padding, o elemento da esquerda e 12. Dentro do cartão lista é o valor
 * cheio; fora dele, a `Lista` desconta os 18 do padding do cartão.
 */
export const RECUO_DA_LISTA = {
  /** Ladrilho de 32. */
  ladrilho: 18 + ALTURA.ladrilho + 12,
  /** Avatar de 40. */
  avatar: 18 + TAMANHO_DO_AVATAR.linha + 12,
  /** Bloco de data ou coluna de hora, de 44. */
  data: 18 + LARGURA_DA_HORA + 12,
  hora: 18 + LARGURA_DA_HORA + 12,
  /** Rádio ou caixa de marcar, de 24. */
  caixa: 18 + 24 + 12,
  /** Sem elemento à esquerda (interruptor, texto). */
  texto: 18,
} as const

/**
 * Subtítulo de um grupo de linhas dentro de um cartão lista ("Para você", "Da
 * organização"): em texto, alinhado ao texto das linhas, e anunciado como cabeçalho.
 */
export function SubtituloDaLista({ texto }: { texto: string }) {
  return (
    <Texto
      variante="sobrancelha"
      cor="textoSuave"
      style={{
        paddingHorizontal: RECUO_DA_LISTA.texto,
        paddingTop: ESPACO.e8,
        paddingBottom: ESPACO.e4,
      }}
    >
      {texto}
    </Texto>
  )
}

export interface DataDaLinha {
  /** "15". */
  dia: string
  /** "NOV". */
  mes: string
}

export interface PropsDaLinhaDeLista {
  titulo: string
  /** Até 2 linhas, em `legenda` suave. */
  descricao?: string
  /** À esquerda: ladrilho de 32 com ícone de 18. */
  icone?: NomeDoIcone
  /** À esquerda: avatar de 40 (pessoa). */
  avatar?: { nome: string; dados?: DadosDoAvatar | null; cor?: string }
  /** À esquerda: bloco de data de 44 de largura (evento). */
  data?: DataDaLinha
  /** À esquerda: a hora em coluna de 44 (`lista` 600, `tabular-nums`), alinhada ao título ("16:05"). */
  hora?: string
  /** À esquerda, qualquer outro elemento (legado). */
  inicio?: ReactNode
  /** À direita: valor ("07:00"), em `corpo` suave, `tabular-nums`. */
  valor?: string
  /** À direita: chip ou outro elemento curto. */
  extra?: ReactNode
  aoPressionar?: () => void
  rotuloAcessivel?: string
  dica?: string
  /** Abre fora do app: `arrow.up.right` no lugar do chevron. */
  externo?: boolean
  /** Ação na própria tela (não navega): sem chevron. */
  semSeta?: boolean
  /** Apaga ou encerra: título em `erro`, ladrilho `erroFundo`, sem chevron. */
  destrutivo?: boolean
  /** Item escolhido numa lista de navegação (web larga). */
  selecionado?: boolean
  /** O item em curso numa sequência (a etapa de agora): fundo quente e `aria-current` na web. */
  atual?: boolean
  /** Linhas da descrição antes das reticências (2 por padrão); 0 tira o limite. */
  linhasDaDescricao?: number
}

/**
 * Linha de lista (seção 2.12.11): altura mínima de 56, padding 10 por 18,
 * elemento à esquerda, 12, título e descrição, e à direita valor, chip ou
 * chevron de 14 (só em linha que navega). Dentro do cartão lista, encosta
 * nas bordas; fora dele, sangra 18 para o texto alinhar com a coluna.
 */
export function LinhaDeLista({
  titulo,
  descricao,
  icone,
  avatar,
  data,
  hora,
  inicio,
  valor,
  extra,
  aoPressionar,
  rotuloAcessivel,
  dica,
  externo = false,
  semSeta = false,
  destrutivo = false,
  selecionado,
  atual = false,
  linhasDaDescricao = 2,
}: PropsDaLinhaDeLista) {
  const { cores, solido, superficie } = useTema()
  const noCartaoLista = useNoCartaoLista()
  // No cartão translúcido, o título em `erro` não passa AA no pico da Aurora: o ladrilho carrega a cor.
  const corDoTitulo = destrutivo
    ? superficie === 'translucida'
      ? 'texto'
      : 'erro'
    : selecionado
      ? 'destaque'
      : 'texto'
  const navega = !!aoPressionar && !semSeta && !destrutivo

  const esquerda = avatar ? (
    <Avatar
      nome={avatar.nome}
      avatar={avatar.dados ?? null}
      {...(avatar.cor ? { cor: avatar.cor } : {})}
      tamanho="linha"
      decorativo
    />
  ) : data ? (
    <View style={{ width: LARGURA_DA_HORA, alignItems: 'center' }}>
      <Texto variante="codigo" accessibilityRole="text">
        {data.dia}
      </Texto>
      <Texto variante="sobrancelha" cor="textoSuave" accessibilityRole="text">
        {data.mes}
      </Texto>
    </View>
  ) : hora ? (
    <Texto
      variante="lista"
      peso="forte"
      tabular
      accessibilityRole="text"
      style={{
        minWidth: LARGURA_DA_HORA,
        alignSelf: 'flex-start',
        // A hora alinha com a primeira linha do título (16/22), não com o centro da linha.
        lineHeight: TIPO.tituloItem.altura,
      }}
    >
      {hora}
    </Texto>
  ) : icone ? (
    <View
      style={{
        width: ALTURA.ladrilho,
        height: ALTURA.ladrilho,
        borderRadius: RAIO.celula,
        backgroundColor: solido(destrutivo ? cores.erroFundo : cores.tonal),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icone nome={icone} cor={destrutivo ? cores.erro : cores.destaque} tamanho={18} />
    </View>
  ) : (
    (inicio ?? null)
  )

  const estilo: ViewStyle = {
    minHeight: ALTURA.linha,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACO.e12,
    paddingVertical: ESPACO.e10,
    paddingHorizontal: ESPACO.e18,
    ...(noCartaoLista ? {} : { marginHorizontal: -ESPACO.e18, borderRadius: RAIO.controle }),
    ...(atual ? { backgroundColor: solido(cores.quenteFundo) } : {}),
  }
  const marcaDeAtual = atual ? soNaWeb({ 'aria-current': 'step' }) : {}

  const conteudo = (
    <>
      {selecionado ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: ESPACO.e12,
            bottom: ESPACO.e12,
            width: 3,
            borderRadius: 2,
            backgroundColor: cores.destaque,
          }}
        />
      ) : null}
      {esquerda}
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="tituloItem" cor={corDoTitulo}>
          {titulo}
        </Texto>
        {descricao ? (
          // Data, hora, local ou o que a linha abre: informação útil, em 15 (U-09).
          <Texto variante="meta" cor="textoSuave" numberOfLines={linhasDaDescricao}>
            {descricao}
          </Texto>
        ) : null}
      </View>
      {valor ? (
        <Texto variante="corpo" cor="textoSuave" tabular>
          {valor}
        </Texto>
      ) : null}
      {extra}
      {navega ? (
        <Icone
          nome={externo ? 'externo' : 'avancar'}
          cor={cores.textoSuave}
          tamanho={14}
          peso="semibold"
        />
      ) : null}
    </>
  )

  if (!aoPressionar) {
    // Sem toque, o rótulo próprio faz a linha ser lida de uma vez (a hora, quem cuida, a situação).
    return (
      <View
        {...(rotuloAcessivel ? { accessible: true, accessibilityLabel: rotuloAcessivel } : {})}
        {...marcaDeAtual}
        style={estilo}
      >
        {conteudo}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole={externo ? 'link' : 'button'}
      accessibilityLabel={rotuloAcessivel ?? [titulo, descricao, valor].filter(Boolean).join('. ')}
      accessibilityHint={dica}
      {...(selecionado !== undefined ? { 'aria-selected': selecionado } : {})}
      {...marcaDeAtual}
      onPress={aoPressionar}
      style={({ pressed }) => [
        estilo,
        pressed || selecionado ? { backgroundColor: cores.pressionado } : null,
      ]}
    >
      {conteudo}
    </Pressable>
  )
}

/** Recuo do separador pelo elemento à esquerda da linha de cima (`RECUO_DA_LISTA`). */
function recuoDoSeparador(props: Partial<PropsDaLinhaDeLista> | undefined): number {
  if (props?.avatar) return RECUO_DA_LISTA.avatar
  if (props?.data) return RECUO_DA_LISTA.data
  if (props?.hora) return RECUO_DA_LISTA.hora
  if (props?.icone || props?.inicio) return RECUO_DA_LISTA.ladrilho
  return RECUO_DA_LISTA.texto
}

interface PropsDaLista {
  children: ReactNode
  /** Recuo fixo do separador (padrão: segue o elemento à esquerda da linha de cima). */
  recuo?: number
}

/**
 * Linhas com separador de 1 recuado entre elas (nunca antes da primeira nem
 * depois da última). Com "Aumentar contraste", o separador fica mais forte.
 */
export function Lista({ children, recuo }: PropsDaLista) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const noCartaoLista = useNoCartaoLista()
  const itens = Children.toArray(children).filter(isValidElement)
  return (
    <View>
      {itens.map((item, i) => {
        const anterior = itens[i - 1]?.props as Partial<PropsDaLinhaDeLista> | undefined
        // Fora do cartão lista a linha sangra 18: o separador começa no mesmo x do texto.
        const margem = (recuo ?? recuoDoSeparador(anterior)) - (noCartaoLista ? 0 : ESPACO.e18)
        return (
          <Fragment key={item.key ?? i}>
            {i > 0 ? (
              <View
                style={{
                  height: 1,
                  marginLeft: Math.max(0, margem),
                  backgroundColor: aumentarContraste ? cores.campoBorda : cores.separador,
                }}
              />
            ) : null}
            {item}
          </Fragment>
        )
      })}
    </View>
  )
}
