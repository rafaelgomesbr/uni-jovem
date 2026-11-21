import {
  ehEtapaDeLouvor,
  formatarDuracaoDaMusica,
  nomeDoTom,
  resumoDoRepertorio,
  transporTom,
} from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { anunciar } from '@/ui/anunciar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { BotoesDeOrdem, mover } from '@/ui/BotoesDeOrdem'
import { Campo, CampoDeBusca } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { FolhaNaTela } from '@/ui/FolhaNaTela'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'

import { useConteudos } from '../conteudos/consultas'
import { usePode } from '../comunidade/permissoes'
import { useEvento } from '../eventos/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { BotaoAvisarABanda } from './BotaoAvisarABanda'
import {
  useAdicionarMusica,
  useMeuRepertorio,
  useMudarItemDoRepertorio,
  useReordenarRepertorio,
  useRemoverDoRepertorio,
  useRepertorio,
} from './consultas'

/** Busca sem acento e sem caixa. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
}

/** "Tom do dia A (original G) · 72 bpm · 4:05": o que a linha do repertório mostra de cada música. */
export function descricaoDoItem(item: ItemDoRepertorio): string {
  const partes: string[] = []
  if (item.tomDoDia) {
    partes.push(
      item.tomOriginal && item.tomOriginal !== item.tomDoDia
        ? `Tom do dia ${item.tomDoDia} (original ${item.tomOriginal})`
        : `Tom do dia ${item.tomDoDia}`,
    )
  } else if (item.tomOriginal) {
    partes.push(`Tom ${item.tomOriginal}`)
  } else {
    partes.push('Tom não informado')
  }
  if (item.andamentoBpm) partes.push(`${item.andamentoBpm} bpm`)
  const duracao = formatarDuracaoDaMusica(item.duracaoSeg)
  if (duracao) partes.push(duracao)
  if (item.artista) partes.push(item.artista)
  return partes.join(' · ')
}

/**
 * Rota `/evento/[eventoId]/repertorio` (D61): o repertório do louvor do
 * encontro. Quem organiza adiciona músicas da biblioteca, define o tom do
 * dia, sobe e desce (sempre com botões), tira e avisa a banda. Os demais veem
 * a mesma lista, só leitura, e abrem a cifra.
 */
export function TelaRepertorioDoEncontro() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
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
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (evento.error) {
    return (
      <Tela pilha titulo="Repertório">
        <ErroDaTela
          erro={evento.error}
          titulo="O repertório não abriu"
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
  const [mudandoTom, setMudandoTom] = useState<ItemDoRepertorio | null>(null)

  const etapaDoLouvor = evento.etapas.find((e) => ehEtapaDeLouvor(e.titulo)) ?? null
  const euToco = (meu.data ?? []).some((e) => e.evento.id === evento.id)
  const publicado = evento.status === 'publicado'

  if (itens.isPending) {
    return (
      <Tela pilha titulo="Repertório" descricao={evento.titulo}>
        <Esqueleto rotulo="Carregando o repertório">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (itens.error) {
    return (
      <Tela pilha titulo="Repertório" descricao={evento.titulo}>
        <ErroDaTela
          erro={itens.error}
          titulo="O repertório não abriu"
          aoTentarDeNovo={() => void itens.refetch()}
        />
      </Tela>
    )
  }

  const lista = [...itens.data].sort((a, b) => a.ordem - b.ordem)
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

  async function pedirParaTirar(item: ItemDoRepertorio) {
    const ok = await confirmar({
      titulo: `Tirar ${item.titulo} do repertório?`,
      mensagem: 'A música continua na biblioteca; só sai deste encontro.',
      confirmar: 'Tirar do repertório',
      destrutivo: true,
    })
    if (ok) remover.mutate(item.id)
  }

  return (
    <Tela
      pilha
      titulo="Repertório"
      descricao={evento.titulo}
      {...(edita
        ? {
            barraDeAcao: (
              <BarraDeAcao
                {...(publicado
                  ? {}
                  : {
                      aviso: (
                        <Texto variante="legenda" cor="textoSuave">
                          Publique o encontro para avisar a banda.
                        </Texto>
                      ),
                    })}
              >
                <BotaoAvisarABanda
                  comunidadeId={comunidadeId}
                  eventoId={evento.id}
                  publicado={publicado}
                  tamanho="grande"
                />
                <Botao
                  titulo="Adicionar música"
                  icone="adicionar"
                  tamanho="grande"
                  aoPressionar={() => setAdicionando(true)}
                />
              </BarraDeAcao>
            ),
          }
        : {})}
    >
      {euToco ? (
        <Botao
          titulo="Abrir o meu repertório"
          variante="secundario"
          icone="musica"
          aoPressionar={() => router.push('/meu-repertorio')}
        />
      ) : null}
      {resumo.texto ? (
        <Texto variante="corpo" cor="textoSuave" tabular>
          {resumo.texto}
        </Texto>
      ) : null}
      {resumo.passaDoPrevisto ? (
        <Aviso tipo="alerta" titulo="Passa do tempo da etapa">
          As músicas somam mais que o tempo previsto para o louvor. É só um aviso: você decide.
        </Aviso>
      ) : null}
      {reordenar.error ? <AvisoDeFalha erro={reordenar.error} titulo="A ordem não mudou" /> : null}
      {remover.error ? <AvisoDeFalha erro={remover.error} titulo="A música não saiu" /> : null}

      {lista.length === 0 ? (
        <EstadoVazio
          icone="musica"
          titulo="Nenhuma música no repertório"
          descricao={
            edita
              ? 'Escolha na biblioteca as músicas do louvor deste encontro, na ordem em que serão tocadas.'
              : 'A organização ainda não montou o repertório deste encontro.'
          }
          acao={
            edita
              ? {
                  titulo: 'Adicionar música',
                  icone: 'adicionar',
                  aoPressionar: () => setAdicionando(true),
                }
              : { titulo: 'Voltar ao encontro', aoPressionar: () => router.back() }
          }
        />
      ) : (
        lista.map((item, i) => (
          <LinhaDoRepertorio
            key={item.id}
            item={item}
            posicao={i}
            total={lista.length}
            edita={edita}
            ocupado={reordenar.isPending || remover.isPending}
            aoMover={moverItem}
            aoMudarTom={() => setMudandoTom(item)}
            aoTirar={() => void pedirParaTirar(item)}
          />
        ))
      )}

      {edita ? (
        <>
          <FolhaDeAdicionar
            aberta={adicionando}
            aoFechar={() => setAdicionando(false)}
            comunidadeId={comunidadeId}
            eventoId={evento.id}
            jaNoRepertorio={new Set(lista.map((i) => i.musicaId))}
          />
          <FolhaDoTomDoDia
            item={mudandoTom}
            aoFechar={() => setMudandoTom(null)}
            comunidadeId={comunidadeId}
            eventoId={evento.id}
          />
        </>
      ) : null}
    </Tela>
  )
}

function LinhaDoRepertorio({
  item,
  posicao,
  total,
  edita,
  ocupado,
  aoMover,
  aoMudarTom,
  aoTirar,
}: {
  item: ItemDoRepertorio
  posicao: number
  total: number
  edita: boolean
  ocupado: boolean
  aoMover: (de: number, para: number) => void
  aoMudarTom: () => void
  aoTirar: () => void
}) {
  const descricao = descricaoDoItem(item)
  const falado = `Música ${posicao + 1} de ${total}: ${item.titulo}. ${descricao}.${item.nota ? ` Observação: ${item.nota}.` : ''}${item.temCifra ? '' : ' Sem cifra.'}`
  return (
    <CartaoDeVidro
      sobrancelha={`Música ${posicao + 1}`}
      {...(!item.temCifra ? { extra: <Chip texto="Sem cifra" tom="neutro" /> } : {})}
      acoes={
        edita ? (
          <View style={{ gap: ESPACO.e8 }}>
            <BotoesDeOrdem
              nome={item.titulo}
              posicao={posicao}
              total={total}
              desabilitado={ocupado}
              aoSubir={() => aoMover(posicao, posicao - 1)}
              aoDescer={() => aoMover(posicao, posicao + 1)}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
              <Botao
                titulo="Tom do dia"
                variante="secundario"
                rotuloAcessivel={`Mudar o tom do dia de ${item.titulo}`}
                aoPressionar={aoMudarTom}
              />
              <Botao
                titulo="Tirar"
                variante="destrutivo"
                rotuloAcessivel={`Tirar ${item.titulo} do repertório`}
                aoPressionar={aoTirar}
              />
            </View>
          </View>
        ) : (
          <Botao
            titulo="Abrir cifra"
            variante="terciario"
            alinhado
            rotuloAcessivel={`Abrir a cifra de ${item.titulo}`}
            aoPressionar={() =>
              router.push({
                pathname: '/conteudos/[tipo]/[itemId]',
                params: { tipo: 'musicas', itemId: item.musicaId },
              })
            }
          />
        )
      }
    >
      <View accessible accessibilityLabel={falado}>
        <Texto variante="tituloItem">{item.titulo}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {descricao}
        </Texto>
        {item.nota ? <Texto variante="corpo">{item.nota}</Texto> : null}
      </View>
    </CartaoDeVidro>
  )
}

/** Escolher uma música da biblioteca para entrar no fim do repertório. */
function FolhaDeAdicionar({
  aberta,
  aoFechar,
  comunidadeId,
  eventoId,
  jaNoRepertorio,
}: {
  aberta: boolean
  aoFechar: () => void
  comunidadeId: string
  eventoId: string
  jaNoRepertorio: ReadonlySet<string>
}) {
  const musicas = useConteudos(comunidadeId, 'musicas', aberta)
  const adicionar = useAdicionarMusica(comunidadeId, eventoId)
  const [busca, setBusca] = useState('')
  const termo = normalizar(busca.trim())

  const disponiveis = (musicas.data ?? []).filter(
    (m) =>
      !m.arquivada &&
      !jaNoRepertorio.has(m.id) &&
      (!termo || normalizar(`${m.titulo} ${m.artista ?? ''}`).includes(termo)),
  )

  return (
    <FolhaNaTela aberta={aberta} titulo="Adicionar música" aoFechar={aoFechar}>
      {musicas.isPending ? (
        <Esqueleto rotulo="Carregando as músicas">
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : musicas.error ? (
        <EstadoVazio
          icone={musicas.error instanceof SemConexao ? 'semConexao' : 'erro'}
          titulo="Não deu para carregar as músicas"
          descricao={mensagemDoErro(musicas.error)}
          acao={{ titulo: 'Tentar de novo', aoPressionar: () => void musicas.refetch() }}
        />
      ) : musicas.data.length === 0 ? (
        <EstadoVazio
          icone="musica"
          titulo="A biblioteca está vazia"
          descricao="Cadastre a primeira música da comunidade para montar o repertório."
          acao={{
            titulo: 'Cadastrar música',
            icone: 'adicionar',
            aoPressionar: () => {
              aoFechar()
              router.push({ pathname: '/conteudos/[tipo]/novo', params: { tipo: 'musicas' } })
            },
          }}
        />
      ) : (
        <>
          <CampoDeBusca rotulo="Buscar na biblioteca" valor={busca} aoMudar={setBusca} />
          {adicionar.error ? (
            <AvisoDeFalha erro={adicionar.error} titulo="A música não entrou" />
          ) : null}
          {disponiveis.length === 0 ? (
            <Texto variante="corpo" cor="textoSuave">
              {termo
                ? 'Nenhuma música com essa busca. As que já estão no repertório não aparecem.'
                : 'Todas as músicas da biblioteca já estão neste repertório.'}
            </Texto>
          ) : (
            <Lista>
              {disponiveis.map((m) => (
                <LinhaDeLista
                  key={m.id}
                  icone="musica"
                  titulo={m.titulo}
                  descricao={[
                    m.tom ? `Tom ${m.tom}` : null,
                    m.artista,
                    m.temCifra === false ? 'Sem cifra' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  rotuloAcessivel={`Adicionar ${m.titulo} ao repertório`}
                  semSeta
                  aoPressionar={
                    adicionar.isPending
                      ? undefined
                      : () =>
                          adicionar.mutate(
                            { musicaId: m.id },
                            {
                              onSuccess: () => {
                                mostrarToast({ texto: `${m.titulo} entrou no repertório.` })
                                setBusca('')
                                aoFechar()
                              },
                            },
                          )
                  }
                />
              ))}
            </Lista>
          )}
        </>
      )}
    </FolhaNaTela>
  )
}

/** Definir o tom do dia: meio tom para cima ou para baixo a partir do atual, ou o nome do tom. */
function FolhaDoTomDoDia({
  item,
  aoFechar,
  comunidadeId,
  eventoId,
}: {
  item: ItemDoRepertorio | null
  aoFechar: () => void
  comunidadeId: string
  eventoId: string
}) {
  return (
    <FolhaNaTela aberta={item !== null} titulo="Tom do dia" aoFechar={aoFechar}>
      {item ? (
        <CampoDoTom
          key={item.id}
          item={item}
          aoFechar={aoFechar}
          comunidadeId={comunidadeId}
          eventoId={eventoId}
        />
      ) : null}
    </FolhaNaTela>
  )
}

function CampoDoTom({
  item,
  aoFechar,
  comunidadeId,
  eventoId,
}: {
  item: ItemDoRepertorio
  aoFechar: () => void
  comunidadeId: string
  eventoId: string
}) {
  const mudar = useMudarItemDoRepertorio(comunidadeId, eventoId)
  const [texto, setTexto] = useState(item.tomDoDia ?? item.tomOriginal ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const atual = nomeDoTom(texto)

  function andar(semitons: number) {
    const base = atual ?? nomeDoTom(item.tomOriginal)
    const novo = base ? transporTom(base, semitons) : null
    if (novo) {
      setTexto(novo)
      setErro(null)
    }
  }

  function salvar() {
    const vazio = texto.trim() === ''
    if (!vazio && atual === null) {
      setErro('Use um tom como G, Am, F#m ou Bb.')
      return
    }
    // Tom igual ao original (ou vazio) volta ao tom original: nada a guardar.
    const tomDoDia = vazio || atual === nomeDoTom(item.tomOriginal) ? null : atual
    mudar.mutate(
      { itemId: item.id, versao: item.versao, tomDoDia },
      {
        onSuccess: () => {
          mostrarToast({ texto: `Tom do dia de ${item.titulo} salvo.` })
          aoFechar()
        },
      },
    )
  }

  return (
    <>
      <Texto variante="corpo" cor="textoSuave">
        {item.tomOriginal
          ? `${item.titulo}: o tom original é ${item.tomOriginal}. O tom do dia vale só neste encontro.`
          : `${item.titulo}: sem tom original cadastrado. O tom do dia vale só neste encontro.`}
      </Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Botao
          titulo="Tom −"
          variante="secundario"
          rotuloAcessivel="Descer meio tom"
          desabilitado={!atual && !item.tomOriginal}
          aoPressionar={() => andar(-1)}
        />
        <Botao
          titulo="Tom +"
          variante="secundario"
          rotuloAcessivel="Subir meio tom"
          desabilitado={!atual && !item.tomOriginal}
          aoPressionar={() => andar(1)}
        />
        {item.tomOriginal ? (
          <Botao
            titulo="Tom original"
            variante="terciario"
            rotuloAcessivel="Voltar ao tom original"
            aoPressionar={() => {
              setTexto(item.tomOriginal ?? '')
              setErro(null)
            }}
          />
        ) : null}
      </View>
      <Campo
        rotulo="Tom do dia"
        opcional
        value={texto}
        onChangeText={(t) => {
          setTexto(t)
          setErro(null)
        }}
        erro={erro}
        ajuda="Por exemplo: A, Bb, F#m. Vazio vale o tom original."
        maxLength={12}
        autoCapitalize="characters"
      />
      {mudar.error ? <AvisoDeFalha erro={mudar.error} titulo="O tom não foi salvo" /> : null}
      <Botao
        titulo="Salvar tom do dia"
        tamanho="grande"
        larguraTotal
        carregando={mudar.isPending}
        aoPressionar={salvar}
      />
    </>
  )
}
