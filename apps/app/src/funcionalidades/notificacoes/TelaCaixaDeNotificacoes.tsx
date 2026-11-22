import { ESPACO, RITMO } from '@uj/tokens'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { FlatList, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { Aviso } from '@/ui/Aviso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { Chip } from '@/ui/Chip'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Sol } from '@/ui/Sol'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import {
  ICONE_DO_TIPO,
  agruparPorLeitura,
  destinoDaNotificacao,
  resumoPorTipo,
  rotaDoDestino,
  tempoRelativo,
  textoDeNaoLidas,
  useCaixaDeNotificacoes,
  useMarcarComoLida,
  useMarcarTodasComoLidas,
  useNaoLidas,
  useQuebraDoSino,
  type NotificacaoDaCaixa,
} from './caixa'

const abrirPreferencias = () => router.push('/notificacoes')

/** Termina com ponto, para o leitor de tela pausar entre as partes. */
function frase(texto: string): string {
  return /[.!?]$/.test(texto.trim()) ? texto.trim() : `${texto.trim()}.`
}

/**
 * Tocar abre o destino e marca como lida. Notificação de outra comunidade
 * troca a comunidade ativa antes, porque as telas de destino são da ativa.
 */
function useAbrirNotificacao() {
  const { comunidadeAtiva, comunidades, trocarComunidade } = useSessao()
  const marcar = useMarcarComoLida()
  return async (n: NotificacaoDaCaixa) => {
    if (!n.lida) marcar.mutate(n.id)
    const destino = destinoDaNotificacao(n)
    const rota = rotaDoDestino(destino)
    if (!rota) {
      mostrarToast({ texto: 'Esse item não está mais disponível.', tipo: 'info' })
      return
    }
    // A decisão de um pedido é da conta: quem pediu pode ainda não ser da comunidade.
    if (destino?.tela === 'meus_pedidos') {
      router.push(rota)
      return
    }
    if (n.comunidade.id !== comunidadeAtiva?.id) {
      if (!comunidades.some((c) => c.id === n.comunidade.id)) {
        mostrarToast({ texto: `Você não está mais em ${n.comunidade.nome}.`, tipo: 'info' })
        return
      }
      await trocarComunidade(n.comunidade.id)
    }
    router.push(rota)
  }
}

/**
 * Rota `/caixa-de-notificacoes` (D42, D68): o sino. O que aconteceu nas comunidades da pessoa,
 * em dois grupos, "Novas" e "Antes", cada linha com o título real do aviso ou do encontro (o
 * `assunto` da D66) e a contagem por tipo no alto ("4 avisos novos", "1 convocação nova").
 * Tocar abre o destino (a convocação abre o encontro, o aviso abre o aviso) e marca como lida.
 * Rolagem infinita de 20 em 20, com "Mostrar mais antigas" para quem não rola. Não lida tem a
 * palavra "Nova" (cor nunca é o único sinal). Os ajustes abrem pelo ícone do cabeçalho.
 */
export function TelaCaixaDeNotificacoes() {
  return (
    <Tela
      pilha
      titulo="Notificações"
      descricao="O que aconteceu nas suas comunidades nos últimos 30 dias."
      rolar={false}
      acoes={
        <BotaoIcone
          icone="ajustes"
          texto="Ajustes"
          rotulo="Ajustes: quando o app me avisa"
          aoPressionar={abrirPreferencias}
        />
      }
    >
      <ConteudoDaCaixa />
    </Tela>
  )
}

function ConteudoDaCaixa() {
  const caixa = useCaixaDeNotificacoes()
  const { data: naoLidas = 0 } = useNaoLidas()
  const quebra = useQuebraDoSino()
  const marcarTodas = useMarcarTodasComoLidas()
  const abrir = useAbrirNotificacao()
  const { comunidades } = useSessao()
  const variasComunidades = comunidades.length > 1

  const itens = useMemo(() => caixa.data?.pages.flatMap((p) => p.notificacoes) ?? [], [caixa.data])
  const grupos = useMemo(() => {
    const { novas, antes } = agruparPorLeitura(itens)
    return [
      ...(novas.length ? [{ chave: 'novas', rotulo: 'Novas', itens: novas }] : []),
      ...(antes.length ? [{ chave: 'antes', rotulo: 'Antes', itens: antes }] : []),
    ]
  }, [itens])

  if (caixa.isPending && caixa.fetchStatus === 'paused') {
    return (
      <Aviso tipo="alerta" titulo="Sem internet">
        As notificações voltam quando a internet voltar.
      </Aviso>
    )
  }
  if (caixa.isPending) {
    return (
      <Esqueleto rotulo="Carregando as notificações">
        <View style={{ gap: ESPACO.e12 }}>
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
        </View>
      </Esqueleto>
    )
  }
  if (caixa.isError && !caixa.data) {
    return (
      <ErroDaTela
        erro={caixa.error}
        titulo="Não deu para carregar as notificações."
        aoTentarDeNovo={() => void caixa.refetch()}
      />
    )
  }
  if (itens.length === 0) {
    return (
      <Cartao>
        <View style={{ alignItems: 'center', gap: ESPACO.e12 }}>
          <Sol pose="escondido" lado={88} />
          <Texto variante="tituloItem" style={{ textAlign: 'center' }}>
            Nenhuma novidade.
          </Texto>
          <Texto variante="corpo" cor="textoSuave" style={{ textAlign: 'center' }}>
            Avisos, convocações e lembretes aparecem aqui.
          </Texto>
        </View>
      </Cartao>
    )
  }

  const temNaoLidas = naoLidas > 0 || itens.some((n) => !n.lida)
  const porTipo = resumoPorTipo(quebra.data)
  const carregarMais = () => {
    if (caixa.hasNextPage && !caixa.isFetchingNextPage && !caixa.isFetchNextPageError) {
      void caixa.fetchNextPage()
    }
  }

  const cabecalho = temNaoLidas ? (
    <View style={{ gap: ESPACO.e12, alignItems: 'flex-start' }}>
      <Texto variante="corpo" cor="textoSuave">
        {naoLidas > 0 ? `Você tem ${textoDeNaoLidas(naoLidas)}.` : 'Há notificações não lidas.'}
      </Texto>
      {porTipo.length > 0 ? (
        <View
          testID="contagem-por-tipo"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}
        >
          {porTipo.map((t) => (
            <Chip key={t.chave} tom="quente" texto={t.texto} />
          ))}
        </View>
      ) : null}
      <Botao
        titulo="Marcar todas como lidas"
        variante="secundario"
        icone="check"
        carregando={marcarTodas.isPending}
        aoPressionar={() =>
          marcarTodas.mutate(undefined, {
            onSuccess: () =>
              mostrarToast({ texto: 'Todas as notificações foram lidas.', tipo: 'sucesso' }),
          })
        }
      />
      {marcarTodas.isError ? (
        <AvisoDeFalha
          erro={marcarTodas.error}
          titulo="Não deu para marcar como lidas"
          aoTentarDeNovo={() => marcarTodas.mutate()}
        />
      ) : null}
    </View>
  ) : null

  const rodape = caixa.isFetchingNextPage ? (
    <Esqueleto rotulo="Carregando mais notificações">
      <CartaoDeEsqueleto />
    </Esqueleto>
  ) : caixa.isFetchNextPageError ? (
    <AvisoDeFalha
      erro={caixa.error}
      titulo="Não deu para carregar as mais antigas"
      aoTentarDeNovo={() => void caixa.fetchNextPage()}
    />
  ) : caixa.hasNextPage ? (
    <Botao
      titulo="Mostrar mais antigas"
      variante="secundario"
      aoPressionar={() => void caixa.fetchNextPage()}
    />
  ) : (
    <Texto variante="legenda" cor="textoSuave">
      As notificações ficam aqui por 30 dias.
    </Texto>
  )

  return (
    <FlatList
      testID="lista-de-notificacoes"
      style={{ flex: 1 }}
      data={grupos}
      keyExtractor={(g) => g.chave}
      initialNumToRender={10}
      onEndReached={carregarMais}
      onEndReachedThreshold={0.5}
      refreshing={caixa.isRefetching && !caixa.isFetchingNextPage}
      onRefresh={() => void caixa.refetch()}
      {...(cabecalho ? { ListHeaderComponent: cabecalho } : {})}
      ListFooterComponent={rodape}
      contentContainerStyle={{ gap: RITMO.entreSecoes, paddingBottom: RITMO.entreSecoes }}
      renderItem={({ item: grupo }) => (
        <Secao titulo={grupo.rotulo}>
          <CartaoDeVidro lista>
            <Lista>
              {grupo.itens.map((n) => (
                <LinhaDaNotificacao
                  key={n.id}
                  notificacao={n}
                  mostrarComunidade={variasComunidades}
                  aoPressionar={() => void abrir(n)}
                />
              ))}
            </Lista>
          </CartaoDeVidro>
        </Secao>
      )}
    />
  )
}

function LinhaDaNotificacao({
  notificacao: n,
  mostrarComunidade,
  aoPressionar,
}: {
  notificacao: NotificacaoDaCaixa
  mostrarComunidade: boolean
  aoPressionar: () => void
}) {
  const quando = tempoRelativo(n.criadoEm)
  // Dentro do app vale o título real (o `assunto`); sem ele, o texto genérico da notificação.
  const conteudo = n.assunto ?? n.texto
  const descricao = mostrarComunidade ? `${n.comunidade.nome}. ${conteudo}` : conteudo
  return (
    <LinhaDeLista
      icone={ICONE_DO_TIPO[n.tipo] ?? 'sino'}
      titulo={n.titulo}
      // O "há 6 dias" na frente da descrição: ao lado do chip "Nova" ele espremia o texto numa coluna
      // de 95 pt (capturas de 22/11/2026), e na frente nunca some no corte das 3 linhas.
      descricao={`${quando} · ${descricao}`}
      linhasDaDescricao={3}
      extra={n.lida ? undefined : <Chip tom="quente" texto="Nova" />}
      rotuloAcessivel={[
        n.lida ? null : 'Nova.',
        frase(n.titulo),
        frase(conteudo),
        `${n.comunidade.nome}, ${quando}.`,
      ]
        .filter(Boolean)
        .join(' ')}
      dica={n.destino || n.eventoId ? 'Abre e marca como lida.' : 'Marca como lida.'}
      aoPressionar={aoPressionar}
    />
  )
}
