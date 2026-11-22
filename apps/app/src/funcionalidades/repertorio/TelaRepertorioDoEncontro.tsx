import { ehEtapaDeLouvor, nomeDoTom, resumoDoRepertorio, transporTom } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { mensagemDoErro } from '@/servicos/erros'
import { anunciar } from '@/ui/anunciar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { BotoesDeOrdem, mover } from '@/ui/BotoesDeOrdem'
import { Campo, CampoDeBusca } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { FolhaNaTela, MenuDeAcoes } from '@/ui/FolhaNaTela'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { mostrarDesfazer } from '@/ui/ToastComDesfazer'
import { momentoDoEncontro } from '@/utilidades/momentoDoEncontro'
import { parametro } from '@/utilidades/parametros'

import { usePode } from '../comunidade/permissoes'
import { useConteudos } from '../conteudos/consultas'
import { useEvento } from '../eventos/consultas'
import { VazioComSol } from '../inscricoes/VazioComSol'
import { SemComunidade } from '../navegacao/SemComunidade'
import { BandaDoEncontro } from './BandaDoEncontro'
import { BotaoAvisarABanda } from './BotaoAvisarABanda'
import {
  useAdicionarMusicas,
  useMeuRepertorio,
  useMudarItemDoRepertorio,
  useRemoverDoRepertorio,
  useReordenarRepertorio,
  useRepertorio,
} from './consultas'
import { descricaoDaMusica } from './rotulosDoRepertorio'
import { UsoSemInternet } from './UsoSemInternet'

/** Busca sem acento e sem caixa. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
}

/** "Tom do dia A (original G) · 72 bpm · 4:05": o que a linha do repertório mostra de cada música. */
export function descricaoDoItem(item: ItemDoRepertorio): string {
  return descricaoDaMusica(
    {
      tomDoDia: item.tomDoDia,
      tomOriginal: item.tomOriginal,
      andamentoBpm: item.andamentoBpm,
      duracaoSeg: item.duracaoSeg,
      artista: item.artista,
      temCifra: item.temCifra,
    },
    { artista: true },
  )
}

/**
 * Rota `/evento/[eventoId]/repertorio` (D61, visual A em D71): o repertório do louvor do encontro,
 * a tela com que o regente monta o sábado. Quem organiza adiciona músicas da biblioteca (várias de
 * uma vez), muda o tom do dia, sobe e desce (sempre por botão), tira com Desfazer e avisa a banda
 * com Desfazer de 10 s. Os demais veem a mesma lista, só leitura, e abrem a cifra.
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
  const mudarTom = useMudarItemDoRepertorio(comunidadeId, evento.id)
  const [adicionando, setAdicionando] = useState(false)
  const [tomEscolhido, setTomEscolhido] = useState<ItemDoRepertorio | null>(null)
  const [menuDoItem, setMenuDoItem] = useState<ItemDoRepertorio | null>(null)
  // Músicas que a pessoa tirou e ainda esperam os 10 s do Desfazer: somem da lista na hora.
  const [tirados, setTirados] = useState<ReadonlySet<string>>(new Set())

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

  /** Tom do dia com − e +: meio tom a partir do que vale hoje; igual ao original volta ao original. */
  function andarNoTom(item: ItemDoRepertorio, passo: -1 | 1) {
    const base = nomeDoTom(item.tomDoDia ?? item.tomOriginal)
    const novo = base ? transporTom(base, passo) : null
    if (!novo) return
    const tomDoDia = novo === nomeDoTom(item.tomOriginal) ? null : novo
    mudarTom.mutate(
      { itemId: item.id, versao: item.versao, tomDoDia },
      { onSuccess: () => anunciar(`Tom do dia de ${item.titulo}: ${novo}.`) },
    )
  }

  /** Tirar não pede "tem certeza?": some da lista e o servidor só é avisado depois dos 10 s. */
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
      aoDesfazer: soltar,
      aoConfirmar: () => remover.mutate(item.id, { onSettled: soltar }),
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
      descricao={evento.titulo}
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
          {lista.length > 0 ? (
            <Cartao sobrancelha="Louvor">
              <Texto variante="tituloItem" tabular>
                {resumo.texto}
              </Texto>
              {resumo.passaDoPrevisto ? (
                <Aviso tipo="alerta" titulo="Passa do tempo da etapa">
                  As músicas somam mais que o tempo previsto para o louvor. É só um aviso: você
                  decide.
                </Aviso>
              ) : null}
            </Cartao>
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
      {mudarTom.error ? <AvisoDeFalha erro={mudarTom.error} titulo="O tom não mudou" /> : null}

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
          <View style={{ gap: ESPACO.e12 }}>
            {lista.map((item, i) => (
              <MusicaParaOrganizar
                key={item.id}
                item={item}
                posicao={i}
                total={lista.length}
                ocupado={reordenar.isPending || mudarTom.isPending}
                aoMover={moverItem}
                aoAndarNoTom={andarNoTom}
                aoAbrirMenu={() => setMenuDoItem(item)}
              />
            ))}
          </View>
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
                  rotuloAcessivel={`Música ${i + 1} de ${lista.length}: ${item.titulo}. ${descricaoDoItem(item)}.${item.nota ? ` Observação: ${item.nota}.` : ''} Abrir a cifra.`}
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
          <FolhaDeAdicionar
            aberta={adicionando}
            aoFechar={() => setAdicionando(false)}
            comunidadeId={comunidadeId}
            eventoId={evento.id}
            jaNoRepertorio={new Set(lista.map((i) => i.musicaId))}
          />
          <FolhaDoTomDoDia
            item={tomEscolhido}
            aoFechar={() => setTomEscolhido(null)}
            comunidadeId={comunidadeId}
            eventoId={evento.id}
          />
          <MenuDeAcoes
            aberto={menuDoItem !== null}
            titulo={menuDoItem?.titulo ?? 'Música'}
            aoFechar={() => setMenuDoItem(null)}
            acoes={
              menuDoItem
                ? [
                    {
                      titulo: 'Escolher o tom do dia',
                      icone: 'musica',
                      descricao: 'Digitar o tom (G, Am, B♭...)',
                      aoPressionar: () => setTomEscolhido(menuDoItem),
                    },
                    {
                      titulo: 'Abrir a cifra',
                      icone: 'conteudo',
                      navega: true,
                      aoPressionar: () => abrirCifraDaBiblioteca(menuDoItem),
                    },
                    {
                      titulo: 'Tirar do repertório',
                      icone: 'excluir',
                      destrutiva: true,
                      descricao:
                        'A música continua na biblioteca. Você tem 10 segundos para desfazer.',
                      aoPressionar: () => tirarComDesfazer(menuDoItem),
                    },
                  ]
                : []
            }
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

/**
 * Uma música para quem organiza: número, título, o tom do dia em texto, e os botões que mexem
 * nela (subir, descer, Tom − e Tom +, Mais). Tudo com texto ou nome acessível e alvo de 44 pt.
 */
function MusicaParaOrganizar({
  item,
  posicao,
  total,
  ocupado,
  aoMover,
  aoAndarNoTom,
  aoAbrirMenu,
}: {
  item: ItemDoRepertorio
  posicao: number
  total: number
  ocupado: boolean
  aoMover: (de: number, para: number) => void
  aoAndarNoTom: (item: ItemDoRepertorio, passo: -1 | 1) => void
  aoAbrirMenu: () => void
}) {
  const descricao = descricaoDoItem(item)
  const falado = `Música ${posicao + 1} de ${total}: ${item.titulo}. ${descricao}.${item.nota ? ` Observação: ${item.nota}.` : ''}`
  const semTom = nomeDoTom(item.tomDoDia ?? item.tomOriginal) === null
  return (
    <Cartao
      sobrancelha={`Música ${posicao + 1}`}
      {...(!item.temCifra ? { extra: <Chip texto="Sem cifra" tom="neutro" /> } : {})}
      acoes={
        <View style={{ gap: ESPACO.e8 }}>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: ESPACO.e8 }}
          >
            <BotoesDeOrdem
              nome={item.titulo}
              posicao={posicao}
              total={total}
              desabilitado={ocupado}
              aoSubir={() => aoMover(posicao, posicao - 1)}
              aoDescer={() => aoMover(posicao, posicao + 1)}
            />
            <Botao
              titulo="Tom −"
              variante="secundario"
              tamanho="medio"
              rotuloAcessivel={`Descer meio tom do dia de ${item.titulo}`}
              desabilitado={ocupado || semTom}
              aoPressionar={() => aoAndarNoTom(item, -1)}
            />
            <Botao
              titulo="Tom +"
              variante="secundario"
              tamanho="medio"
              rotuloAcessivel={`Subir meio tom do dia de ${item.titulo}`}
              desabilitado={ocupado || semTom}
              aoPressionar={() => aoAndarNoTom(item, 1)}
            />
            <Botao
              titulo="Mais"
              variante="terciario"
              tamanho="medio"
              rotuloAcessivel={`Mais ações de ${item.titulo}`}
              aoPressionar={aoAbrirMenu}
            />
          </View>
          {semTom ? (
            <Texto variante="legenda" cor="textoSuave">
              Esta música não tem tom cadastrado. Escolha o tom do dia em Mais.
            </Texto>
          ) : null}
        </View>
      }
    >
      <View accessible accessibilityLabel={falado}>
        <Texto variante="tituloItem">{item.titulo}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {descricao}
        </Texto>
        {item.nota ? <Texto variante="corpo">{item.nota}</Texto> : null}
      </View>
    </Cartao>
  )
}

/**
 * Escolher músicas da biblioteca para o fim do repertório: marca várias e adiciona de uma vez
 * ("Adicionar 4 músicas"), na ordem em que foram marcadas.
 */
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
  const adicionar = useAdicionarMusicas(comunidadeId, eventoId)
  const [busca, setBusca] = useState('')
  const [marcadas, setMarcadas] = useState<readonly string[]>([])
  const termo = normalizar(busca.trim())

  const disponiveis = (musicas.data ?? []).filter(
    (m) =>
      !m.arquivada &&
      !jaNoRepertorio.has(m.id) &&
      (!termo || normalizar(`${m.titulo} ${m.artista ?? ''}`).includes(termo)),
  )

  function alternar(id: string) {
    setMarcadas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  function fechar() {
    setBusca('')
    setMarcadas([])
    aoFechar()
  }

  function confirmar() {
    adicionar.mutate(marcadas, {
      onSuccess: (n) => {
        mostrarToast({
          texto:
            n === 1
              ? 'Música adicionada ao repertório.'
              : `${n} músicas adicionadas ao repertório.`,
        })
        fechar()
      },
    })
  }

  const entraram = (adicionar.error as { entraram?: number } | null)?.entraram ?? 0

  return (
    <FolhaNaTela aberta={aberta} titulo="Adicionar músicas" aoFechar={fechar}>
      {musicas.isPending ? (
        <Esqueleto rotulo="Carregando as músicas">
          <LinhaDeEsqueleto altura={56} />
          <LinhaDeEsqueleto altura={56} />
        </Esqueleto>
      ) : musicas.error ? (
        <VazioComSol
          titulo="Não deu para carregar as músicas"
          descricao={mensagemDoErro(musicas.error)}
          acao={{ titulo: 'Tentar de novo', aoPressionar: () => void musicas.refetch() }}
        />
      ) : musicas.data.length === 0 ? (
        <VazioComSol
          titulo="A biblioteca está vazia"
          descricao="Cadastre a primeira música da comunidade para montar o repertório."
          acao={{
            titulo: 'Cadastrar música',
            icone: 'adicionar',
            aoPressionar: () => {
              fechar()
              router.push({ pathname: '/conteudos/[tipo]/novo', params: { tipo: 'musicas' } })
            },
          }}
        />
      ) : (
        <>
          <CampoDeBusca rotulo="Buscar na biblioteca" valor={busca} aoMudar={setBusca} />
          {adicionar.error ? (
            <AvisoDeFalha
              erro={adicionar.error}
              titulo={
                entraram > 0
                  ? `Só ${entraram} ${entraram === 1 ? 'música entrou' : 'músicas entraram'}`
                  : 'A música não entrou'
              }
            />
          ) : null}
          <Botao
            titulo={
              marcadas.length === 0
                ? 'Marque as músicas'
                : `Adicionar ${marcadas.length} ${marcadas.length === 1 ? 'música' : 'músicas'}`
            }
            tamanho="grande"
            larguraTotal
            desabilitado={marcadas.length === 0}
            carregando={adicionar.isPending}
            aoPressionar={confirmar}
          />
          {disponiveis.length === 0 ? (
            <Texto variante="corpo" cor="textoSuave">
              {termo
                ? 'Nenhuma música com essa busca. As que já estão no repertório não aparecem.'
                : 'Todas as músicas da biblioteca já estão neste repertório.'}
            </Texto>
          ) : (
            <Lista>
              {disponiveis.map((m) => {
                const marcada = marcadas.includes(m.id)
                const descricao = [
                  m.tom ? `Tom ${m.tom}` : null,
                  m.artista,
                  m.temCifra === false ? 'Sem cifra' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <LinhaDeLista
                    key={m.id}
                    icone="musica"
                    titulo={m.titulo}
                    {...(descricao ? { descricao } : {})}
                    marcada={marcada}
                    semSeta
                    extra={marcada ? <Chip situacao="aceitou" texto="Marcada" /> : undefined}
                    rotuloAcessivel={`${m.titulo}${descricao ? `. ${descricao}` : ''}. ${marcada ? 'Marcada' : 'Não marcada'}. Toque para ${marcada ? 'desmarcar' : 'marcar'}.`}
                    aoPressionar={() => alternar(m.id)}
                  />
                )
              })}
            </Lista>
          )}
        </>
      )}
    </FolhaNaTela>
  )
}

/** Definir o tom do dia por escrito: o nome do tom, com Tom − e + para andar a partir do atual. */
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
