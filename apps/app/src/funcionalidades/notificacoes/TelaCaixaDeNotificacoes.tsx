import { RITMO } from '@uj/tokens'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { FlatList, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { formatarData } from '@/utilidades/formatos'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { PontoDeNovo } from '@/ui/MarcasDeNovidade'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import {
  ICONE_DO_TIPO,
  destinoDaNotificacao,
  rotaDoDestino,
  textoDeNaoLidas,
  useCaixaDeNotificacoes,
  useMarcarComoLida,
  useMarcarTodasComoLidas,
  useNaoLidas,
  type NotificacaoDaCaixa,
} from './caixa'

const abrirPreferencias = () => router.push('/notificacoes')

interface GrupoDoDia {
  chave: string
  rotulo: string
  itens: NotificacaoDaCaixa[]
}

function chaveDoDia(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Agrupa por dia no fuso do aparelho: "Hoje", "Ontem" e depois a data absoluta. */
export function agruparPorDia(itens: readonly NotificacaoDaCaixa[], agora = new Date()) {
  const hoje = chaveDoDia(agora)
  const ontem = chaveDoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1))
  const grupos: GrupoDoDia[] = []
  for (const n of itens) {
    const chave = chaveDoDia(new Date(n.criadoEm))
    const ultimo = grupos.at(-1)
    if (ultimo?.chave === chave) {
      ultimo.itens.push(n)
    } else {
      const rotulo = chave === hoje ? 'Hoje' : chave === ontem ? 'Ontem' : formatarData(n.criadoEm)
      grupos.push({ chave, rotulo, itens: [n] })
    }
  }
  return grupos
}

/** Termina com ponto, para o leitor de tela pausar entre as partes. */
function frase(texto: string): string {
  return /[.!?]$/.test(texto.trim()) ? texto.trim() : `${texto.trim()}.`
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
 * Rota `/caixa-de-notificacoes` (D42): o que aconteceu nas comunidades da
 * pessoa, da mais nova para a mais antiga, por dia. Rolagem infinita de 20 em
 * 20, com o botão "Mostrar mais antigas" no fim para quem não rola. Não lida
 * tem ponto e a palavra "Nova" no leitor de tela; o atalho de ajustes abre as
 * preferências (tela que já existia).
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
          rotulo="Preferências de notificação"
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
  const marcarTodas = useMarcarTodasComoLidas()
  const abrir = useAbrirNotificacao()
  const { comunidades } = useSessao()
  const variasComunidades = comunidades.length > 1

  const itens = useMemo(() => caixa.data?.pages.flatMap((p) => p.notificacoes) ?? [], [caixa.data])
  const grupos = useMemo(() => agruparPorDia(itens), [itens])

  if (caixa.isPending) {
    return (
      <Esqueleto rotulo="Carregando as notificações">
        <CartaoDeEsqueleto />
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (caixa.isError && !caixa.data) {
    return (
      <ErroDaTela
        erro={caixa.error}
        oQue="as notificações"
        aoTentarDeNovo={() => void caixa.refetch()}
      />
    )
  }
  if (itens.length === 0) {
    return (
      <EstadoVazio
        icone="sino"
        titulo="Nada por aqui ainda"
        descricao="Quando sair uma convocação, um aviso ou uma mudança num evento, ela aparece aqui."
        acao={{
          titulo: 'Preferências de notificação',
          icone: 'ajustes',
          variante: 'secundario',
          aoPressionar: abrirPreferencias,
        }}
      />
    )
  }

  const temNaoLidas = naoLidas > 0 || itens.some((n) => !n.lida)
  const carregarMais = () => {
    if (caixa.hasNextPage && !caixa.isFetchingNextPage && !caixa.isFetchNextPageError) {
      void caixa.fetchNextPage()
    }
  }

  const cabecalho = temNaoLidas ? (
    <View style={{ gap: RITMO.entreSecoes, alignItems: 'flex-start' }}>
      <Texto variante="corpo" cor="textoSuave">
        {naoLidas > 0 ? `Você tem ${textoDeNaoLidas(naoLidas)}.` : 'Há notificações não lidas.'}
      </Texto>
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
      variante="terciario"
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
  const hora = horaDe(n.criadoEm)
  const descricao = mostrarComunidade ? `${n.comunidade.nome}. ${n.texto}` : n.texto
  return (
    <LinhaDeLista
      icone={ICONE_DO_TIPO[n.tipo] ?? 'sino'}
      titulo={n.titulo}
      descricao={descricao}
      linhasDaDescricao={3}
      valor={hora}
      extra={n.lida ? undefined : <PontoDeNovo />}
      rotuloAcessivel={[
        n.lida ? null : 'Nova.',
        frase(n.titulo),
        frase(n.texto),
        `${n.comunidade.nome}, às ${hora}.`,
      ]
        .filter(Boolean)
        .join(' ')}
      dica={n.destino ? 'Abre e marca como lida.' : 'Marca como lida.'}
      aoPressionar={aoPressionar}
    />
  )
}
