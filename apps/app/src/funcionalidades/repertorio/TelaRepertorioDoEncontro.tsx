import { ehEtapaDeLouvor, resumoDoRepertorio } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { anunciar } from '@/ui/anunciar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { mover } from '@/ui/BotoesDeOrdem'
import { Cartao } from '@/ui/Cartao'
import { Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { frasePraDesfazer, mostrarDesfazer, useSegundosDoDesfazer } from '@/ui/ToastComDesfazer'
import { momentoDoEncontro } from '@/utilidades/momentoDoEncontro'
import { parametro } from '@/utilidades/parametros'

import { usePode } from '../comunidade/permissoes'
import { useEvento } from '../eventos/consultas'
import { VazioComSol } from '../inscricoes/VazioComSol'
import { SemComunidade } from '../navegacao/SemComunidade'
import { BandaDoEncontro } from './BandaDoEncontro'
import { BotaoAvisarABanda } from './BotaoAvisarABanda'
import {
  useMeuRepertorio,
  useRemoverDoRepertorio,
  useReordenarRepertorio,
  useRepertorio,
} from './consultas'
import { FolhaDaMusica } from './FolhaDaMusica'
import { FolhaDeAdicionarMusicas } from './FolhaDeAdicionarMusicas'
import { LinhaDaMusica } from './LinhaDaMusica'
import { descricaoDoItem } from './rotulosDoRepertorio'
import { UsoSemInternet } from './UsoSemInternet'

export { descricaoDoItem }

/**
 * Rota `/evento/[eventoId]/repertorio` (D61, visual A em D71): o repertório do louvor do encontro,
 * a tela com que o regente monta o sábado. Quem organiza adiciona músicas da biblioteca (várias de
 * uma vez), muda o tom do dia, sobe e desce (sempre por botão), tira com Desfazer e avisa a banda
 * com Desfazer de 10 s. Os demais (D73: toda pessoa da comunidade, com vínculo ativo) veem a mesma
 * lista, só leitura, com a ordem, o tom do dia e a banda, e abrem a cifra para ler.
 */
export function TelaRepertorioDoEncontro() {
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  return <RepertorioDoEncontroPorId eventoId={eventoId} />
}

/**
 * O repertório de um encontro pelo id: a tela acima o lê da rota, e o "Meu repertório" de quem não
 * toca (D73) o abre aqui, para o próximo encontro, em vez de dizer "você não está no louvor".
 */
export function RepertorioDoEncontroPorId({ eventoId }: { eventoId: string | null }) {
  const { comunidadeAtiva } = useSessao()
  const evento = useEvento(comunidadeAtiva?.id ?? null, eventoId)

  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha titulo="Repertório">
        <SemComunidade oQue="o repertório" />
      </Tela>
    )
  }
  if (evento.isPending) {
    return (
      <Tela pilha titulo="Repertório">
        <Esqueleto rotulo="Carregando o repertório">
          <LinhaDeEsqueleto altura={88} />
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
        </Esqueleto>
      </Tela>
    )
  }
  if (evento.error) {
    return (
      <Tela pilha titulo="Repertório">
        <ErroDaTela
          erro={evento.error}
          titulo="Não deu para carregar o repertório."
          aoTentarDeNovo={() => void evento.refetch()}
        />
      </Tela>
    )
  }
  return <Repertorio comunidadeId={comunidadeAtiva.id} evento={evento.data} />
}

function Repertorio({ comunidadeId, evento }: { comunidadeId: string; evento: DetalheDoEvento }) {
  const pode = usePode()
  const edita = pode('etapa', 'gerenciar')
  const itens = useRepertorio(comunidadeId, evento.id)
  const meu = useMeuRepertorio(comunidadeId)
  const reordenar = useReordenarRepertorio(comunidadeId, evento.id)
  const remover = useRemoverDoRepertorio(comunidadeId, evento.id)
  const [adicionando, setAdicionando] = useState(false)
  // A música aberta na folha (tom do dia, cifra, links, tirar).
  const [musicaAberta, setMusicaAberta] = useState<ItemDoRepertorio | null>(null)
  // Músicas que a pessoa tirou e ainda esperam os 10 s do Desfazer: somem da lista na hora.
  const [tirados, setTirados] = useState<ReadonlySet<string>>(new Set())
  const segundosDoDesfazer = useSegundosDoDesfazer()

  const etapaDoLouvor = evento.etapas.find((e) => ehEtapaDeLouvor(e.titulo)) ?? null
  const euToco = (meu.data ?? []).some((e) => e.evento.id === evento.id)
  const publicado = evento.status === 'publicado'
  const momento = momentoDoEncontro(evento.inicio, evento.fuso, { duracaoMin: evento.duracaoMin })

  if (itens.isPending) {
    return (
      <Tela pilha titulo="Repertório" descricao={evento.titulo} momento={momento}>
        <Esqueleto rotulo="Carregando o repertório">
          <LinhaDeEsqueleto altura={88} />
          <LinhaDeEsqueleto altura={72} />
          <LinhaDeEsqueleto altura={72} />
        </Esqueleto>
      </Tela>
    )
  }
  if (itens.error) {
    return (
      <Tela pilha titulo="Repertório" descricao={evento.titulo} momento={momento}>
        <ErroDaTela
          erro={itens.error}
          titulo="Não deu para carregar o repertório."
          aoTentarDeNovo={() => void itens.refetch()}
        />
      </Tela>
    )
  }

  const todos = [...itens.data].sort((a, b) => a.ordem - b.ordem)
  const lista = todos.filter((i) => !tirados.has(i.id))
  const resumo = resumoDoRepertorio(lista, etapaDoLouvor?.duracaoMin ?? null)

  function moverItem(de: number, para: number) {
    const item = lista[de]
    if (!item) return
    const ids = mover(
      lista.map((i) => i.id),
      de,
      para,
    )
    reordenar.mutate(ids)
    anunciar(`${item.titulo} agora é a música ${para + 1} de ${ids.length}.`)
  }

  /** Tirar não pede "tem certeza?": some da lista e o servidor só é avisado depois da contagem. */
  function tirarComDesfazer(item: ItemDoRepertorio) {
    setTirados((atual) => new Set(atual).add(item.id))
    const soltar = () =>
      setTirados((atual) => {
        const novo = new Set(atual)
        novo.delete(item.id)
        return novo
      })
    mostrarDesfazer({
      texto: `${item.titulo} saiu do repertório.`,
      textoDaFalha: `Não deu para tirar ${item.titulo}. A música continua no repertório. Toque em Tentar de novo.`,
      aoDesfazer: soltar,
      aoFalhar: soltar,
      // Sai ao fim da contagem, ao sair da tela ou do app (D74), e repete se a rede falhar.
      aoConfirmar: async () => {
        setTirados((atual) => new Set(atual).add(item.id))
        await remover.mutateAsync(item.id)
        soltar()
      },
    })
  }

  const avisoDoRascunho = publicado ? undefined : (
    <Texto variante="legenda" cor="textoSuave">
      Publique o encontro para avisar a banda.
    </Texto>
  )

  return (
    <Tela
      pilha
      titulo="Repertório"
      descricao={lista.length > 0 ? `${evento.titulo} · ${resumo.texto}` : evento.titulo}
      momento={momento}
      {...(edita
        ? {
            barraDeAcao: (
              <BarraDeAcao {...(avisoDoRascunho ? { aviso: avisoDoRascunho } : {})}>
                <BotaoAvisarABanda
                  comunidadeId={comunidadeId}
                  eventoId={evento.id}
                  publicado={publicado}
                  tamanho="grande"
                />
                {/* "Adicionar" no botão e "músicas" no rótulo: ao lado de "Avisar a banda" o texto longo
                    quebrava em duas linhas a 390 pt (capturas de 22/11/2026). */}
                <Botao
                  titulo="Adicionar"
                  rotuloAcessivel="Adicionar músicas"
                  icone="adicionar"
                  tamanho="grande"
                  aoPressionar={() => setAdicionando(true)}
                />
              </BarraDeAcao>
            ),
          }
        : {})}
    >
      <EntradaEmCascata ordem={1}>
        <View style={{ gap: ESPACO.e12 }}>
          {lista.length > 0 && resumo.passaDoPrevisto ? (
            <Aviso tipo="alerta" titulo="Passa do tempo da etapa">
              As músicas somam mais que o tempo previsto para o louvor. É só um aviso: você decide.
            </Aviso>
          ) : null}
          {euToco ? (
            <Botao
              titulo="Abrir o meu repertório"
              variante="secundario"
              icone="musica"
              aoPressionar={() => router.push('/meu-repertorio')}
            />
          ) : null}
        </View>
      </EntradaEmCascata>

      {reordenar.error ? <AvisoDeFalha erro={reordenar.error} titulo="A ordem não mudou" /> : null}
      {remover.error ? <AvisoDeFalha erro={remover.error} titulo="A música não saiu" /> : null}

      {lista.length === 0 ? (
        <VazioComSol
          titulo="Nenhuma música no repertório"
          descricao={
            edita
              ? 'Escolha na biblioteca as músicas do louvor deste encontro, na ordem em que serão tocadas.'
              : 'A organização ainda não montou o repertório deste encontro.'
          }
          acao={
            edita
              ? {
                  titulo: 'Adicionar músicas',
                  icone: 'adicionar',
                  aoPressionar: () => setAdicionando(true),
                }
              : { titulo: 'Voltar ao encontro', aoPressionar: () => router.back() }
          }
        />
      ) : edita ? (
        <EntradaEmCascata ordem={2}>
          <Cartao lista>
            <Lista recuo={ESPACO.e16}>
              {lista.map((item, i) => (
                <LinhaDaMusica
                  key={item.id}
                  item={item}
                  posicao={i}
                  total={lista.length}
                  ocupado={reordenar.isPending}
                  aoMover={moverItem}
                  aoAbrir={() => setMusicaAberta(item)}
                />
              ))}
            </Lista>
          </Cartao>
        </EntradaEmCascata>
      ) : (
        <EntradaEmCascata ordem={2}>
          <Cartao lista>
            <Lista>
              {lista.map((item, i) => (
                <LinhaDeLista
                  key={item.id}
                  variante="checkin"
                  hora={String(i + 1)}
                  titulo={item.titulo}
                  descricao={descricaoDoItem(item)}
                  rotuloAcessivel={`Música ${i + 1} de ${lista.length}: ${item.titulo}. ${descricaoDoItem(item)}.${item.nota ? ` Observação: ${item.nota}.` : ''} Abrir a cifra${item.temPdf ? ' e o PDF' : ''}.`}
                  aoPressionar={() => abrirCifraDaBiblioteca(item)}
                />
              ))}
            </Lista>
          </Cartao>
        </EntradaEmCascata>
      )}

      <EntradaEmCascata ordem={3}>
        <BandaDoEncontro evento={evento} podeConvocar={edita} />
      </EntradaEmCascata>

      {euToco || edita ? <UsoSemInternet eventoId={evento.id} /> : null}

      {edita ? (
        <>
          <FolhaDeAdicionarMusicas
            aberta={adicionando}
            aoFechar={() => setAdicionando(false)}
            comunidadeId={comunidadeId}
            eventoId={evento.id}
            jaNoRepertorio={new Set(lista.map((i) => i.musicaId))}
          />
          <FolhaDaMusica
            item={musicaAberta}
            aoFechar={() => setMusicaAberta(null)}
            comunidadeId={comunidadeId}
            eventoId={evento.id}
            aoAbrirCifra={abrirCifraDaBiblioteca}
            aoTirar={tirarComDesfazer}
            fraseDoDesfazer={frasePraDesfazer(segundosDoDesfazer)}
          />
        </>
      ) : null}
    </Tela>
  )
}

function abrirCifraDaBiblioteca(item: ItemDoRepertorio) {
  router.push({
    pathname: '/conteudos/[tipo]/[itemId]',
    params: { tipo: 'musicas', itemId: item.musicaId },
  })
}
