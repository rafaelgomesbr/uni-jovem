import { ALTURA, ESPACO, RAIO, RITMO, TAMANHO_DO_AVATAR, TIPO } from '@uj/tokens'
import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Avatar, type DadosDoAvatar } from './Avatar'
import { useNoCartaoLista } from './CartaoDeVidro'
import { palavraDoChip } from './Chip'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'
import { soNaWeb } from './web'

/**
 * Coluna de hora (D83): largura mínima de 48 (múltiplo da grade), que cresce com a fonte. "19:05" em
 * 15 pt tabular mede cerca de 41: a coluna fixa mantém o título de todas as linhas no mesmo x.
 */
export const LARGURA_DA_HORA = 48

/**
 * A coluna do horário à esquerda de uma linha (D83): o começo em `apoio` 500 na cor do texto, o fim
 * (quando há) em `apoio` suave embaixo, os dois à esquerda, em algarismos de largura fixa e numa
 * coluna de `LARGURA_DA_HORA`, para o título de toda linha começar no mesmo x. A linha de caixa do
 * começo tem a altura da linha primária (22), então os dois textos ficam na mesma base: o horário não
 * compete com o título (que é 17 em 600) e os horários de linhas seguidas se leem como uma coluna.
 */
export function ColunaDeHora({ inicio, fim }: { inicio: string; fim?: string }) {
  return (
    <View
      accessible={false}
      style={{ minWidth: LARGURA_DA_HORA, alignItems: 'flex-start', gap: ESPACO.e4 }}
    >
      <Texto
        variante="apoio"
        cor="texto"
        peso="medio"
        tabular
        accessibilityRole="text"
        style={{ lineHeight: TIPO.tituloItem.altura }}
      >
        {inicio}
      </Texto>
      {fim ? (
        <Texto variante="apoio" tabular accessibilityRole="text">
          {fim}
        </Texto>
      ) : null}
    </View>
  )
}

/**
 * Recuo do separador até o texto da linha de baixo (quadro 01c): 18 de
 * padding, o elemento da esquerda e 12. Dentro do cartão lista é o valor
 * cheio; fora dele, a `Lista` desconta os 18 do padding do cartão.
 */
export const RECUO_DA_LISTA = {
  /** Ladrilho de 32. */
  ladrilho: RITMO.recuoDoCartao + ALTURA.ladrilho + 12,
  /** Avatar de 40. */
  avatar: RITMO.recuoDoCartao + TAMANHO_DO_AVATAR.linha + 12,
  /** Bloco de data ou coluna de hora, de 48. */
  data: RITMO.recuoDoCartao + LARGURA_DA_HORA + 12,
  hora: RITMO.recuoDoCartao + LARGURA_DA_HORA + 12,
  /** Rádio ou caixa de marcar, de 24. */
  caixa: RITMO.recuoDoCartao + 24 + 12,
  /** Sem elemento à esquerda (interruptor, texto). */
  texto: RITMO.recuoDoCartao,
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
  /** Até 2 linhas, em `apoio` (15, `textoSuave`). */
  descricao?: string
  /** À esquerda: ladrilho de 32 com ícone de 18. */
  icone?: NomeDoIcone
  /** À esquerda: avatar de 40 (pessoa). */
  avatar?: { nome: string; dados?: DadosDoAvatar | null; cor?: string }
  /** À esquerda: bloco de data de 48 de largura (evento). */
  data?: DataDaLinha
  /** À esquerda: a hora em coluna fixa de 48 (`apoio` 500, `tabular-nums`), alinhada ao título ("16:05"). */
  hora?: string
  /** À esquerda, qualquer outro elemento (legado). */
  inicio?: ReactNode
  /** À direita: valor ("07:00"), em `apoio`, `tabular-nums`. */
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
  /**
   * `checkin`: linha de 72 pt com avatar de 44 (a fila na porta: o alvo é a linha inteira). A
   * `normal` tem 56 pt (D65). Use `checkin` também para linhas de duas informações.
   */
  variante?: 'normal' | 'checkin'
  /**
   * Indisponível agora (opacidade 0,72, sem toque). Diga o motivo em `descricao`: "Já
   * convocado". O texto, nunca só a opacidade, é o sinal.
   */
  desabilitada?: boolean
  /** O item está marcado (presente, escolhido): `aria-checked` e a camada tonal fica ligada. */
  marcada?: boolean
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
  variante = 'normal',
  desabilitada = false,
  marcada,
}: PropsDaLinhaDeLista) {
  const { cores, solido, superficie } = useTema()
  const noCartaoLista = useNoCartaoLista()
  // No cartão translúcido, o título em `erro` não passa AA no pico da Aurora: o ladrilho carrega a cor.
  const corDoTitulo = desabilitada
    ? 'textoSuave'
    : destrutivo
      ? superficie === 'translucida'
        ? 'texto'
        : 'erro'
      : selecionado
        ? 'destaque'
        : 'texto'
  const navega = !!aoPressionar && !semSeta && !destrutivo && !desabilitada
  // Com um chip ao lado a coluna do texto fica estreita: sem limite de linhas, para o fim da frase
  // nunca virar reticências (D79).
  const limiteDaDescricao = extra && linhasDaDescricao === 2 ? 0 : linhasDaDescricao

  const esquerda = avatar ? (
    <Avatar
      nome={avatar.nome}
      avatar={avatar.dados ?? null}
      {...(avatar.cor ? { cor: avatar.cor } : {})}
      tamanho={variante === 'checkin' ? 'checkin' : 'linha'}
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
    // Alinhada à primeira linha do título, não ao centro da linha toda.
    <View style={{ alignSelf: 'flex-start' }}>
      <ColunaDeHora inicio={hora} />
    </View>
  ) : icone ? (
    <View
      style={{
        width: ALTURA.ladrilho,
        height: ALTURA.ladrilho,
        borderRadius: RAIO.celula,
        // Ladrilho quente (direção A): o ícone em `destaque` sobre `quenteFundo`.
        backgroundColor: solido(destrutivo ? cores.erroFundo : cores.quenteFundo),
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
    minHeight: variante === 'checkin' ? ALTURA.linhaAlta : ALTURA.linha,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACO.e12,
    paddingVertical: ESPACO.e12,
    paddingHorizontal: RITMO.recuoDoCartao,
    ...(noCartaoLista
      ? {}
      : { marginHorizontal: -RITMO.recuoDoCartao, borderRadius: RAIO.controle }),
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
      <View style={{ flex: 1, gap: ESPACO.e4 }}>
        {/* Linha primária 17/600 e secundária 15/400 suave (D83): dois níveis que a vista separa. */}
        <Texto variante="tituloItem" cor={corDoTitulo}>
          {titulo}
        </Texto>
        {descricao ? (
          <Texto variante="apoio" cor="textoSuave" numberOfLines={limiteDaDescricao}>
            {descricao}
          </Texto>
        ) : null}
      </View>
      {valor ? (
        <Texto variante="apoio" cor="textoSuave" tabular>
          {valor}
        </Texto>
      ) : null}
      {extra ? <View style={{ alignSelf: 'center' }}>{extra}</View> : null}
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

  if (!aoPressionar || desabilitada) {
    // Sem toque, o rótulo próprio faz a linha ser lida de uma vez (a hora, quem cuida, a situação).
    return (
      <View
        {...(rotuloAcessivel ? { accessible: true, accessibilityLabel: rotuloAcessivel } : {})}
        {...(desabilitada ? { accessibilityState: { disabled: true } } : {})}
        {...marcaDeAtual}
        style={estilo}
      >
        {conteudo}
      </View>
    )
  }
  return (
    <Pressable
      // Linha que marca e desmarca (presença no check-in) é uma caixa de marcar para o leitor de tela.
      accessibilityRole={marcada !== undefined ? 'checkbox' : externo ? 'link' : 'button'}
      accessibilityLabel={
        rotuloAcessivel ??
        [titulo, descricao, valor, palavraDoChip(extra)].filter(Boolean).join('. ')
      }
      accessibilityHint={dica}
      {...(selecionado !== undefined ? { 'aria-selected': selecionado } : {})}
      {...(marcada !== undefined ? { accessibilityState: { checked: marcada } } : {})}
      {...marcaDeAtual}
      onPress={aoPressionar}
      style={({ pressed }) => [
        estilo,
        // A camada de toque é a tonal do botão (direção A): o mesmo violeta em todo o app.
        pressed || selecionado || marcada ? { backgroundColor: cores.botaoTonal } : null,
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
        const margem =
          (recuo ?? recuoDoSeparador(anterior)) - (noCartaoLista ? 0 : RITMO.recuoDoCartao)
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
