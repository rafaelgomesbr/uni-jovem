import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Avatar, type DadosDoAvatar } from './Avatar'
import { useNoCartaoLista } from './CartaoDeVidro'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

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
    <View style={{ width: 44, alignItems: 'center' }}>
      <Texto
        variante="tituloCartao"
        tabular
        accessibilityRole="text"
        style={{ fontSize: 20, lineHeight: 24 }}
      >
        {data.dia}
      </Texto>
      <Texto variante="sobrancelha" cor="textoSuave" accessibilityRole="text">
        {data.mes}
      </Texto>
    </View>
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
  }

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
          <Texto variante="legenda" cor="textoSuave" numberOfLines={linhasDaDescricao}>
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

  if (!aoPressionar) return <View style={estilo}>{conteudo}</View>
  return (
    <Pressable
      accessibilityRole={externo ? 'link' : 'button'}
      accessibilityLabel={rotuloAcessivel ?? [titulo, descricao, valor].filter(Boolean).join('. ')}
      accessibilityHint={dica}
      {...(selecionado !== undefined ? { 'aria-selected': selecionado } : {})}
      onPress={aoPressionar}
      style={({ pressed }) => [
        estilo,
        { backgroundColor: pressed || selecionado ? cores.pressionado : 'transparent' },
      ]}
    >
      {conteudo}
    </Pressable>
  )
}

/** Recuo do separador: 18 + 32 + 12 com ladrilho; 18 + 40 + 12 com avatar; 18 + 44 + 12 com data. */
function recuoDoSeparador(props: Partial<PropsDaLinhaDeLista> | undefined): number {
  if (props?.avatar) return 70
  if (props?.data) return 74
  if (props?.icone || props?.inicio) return 62
  return ESPACO.e18
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
