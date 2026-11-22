import { RITMO } from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { DetalheDoEvento as Evento } from '@/servicos/contratoDosEventos'
import { linkPublicoDoEvento } from '@/servicos/enderecos'
import { ehErroDaApi, SemConexao } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { BotaoIcone } from '@/ui/Botao'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { voltarOu } from '@/ui/navegacao'
import { Segmentos, type Segmento } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { compartilharTexto } from '@/utilidades/compartilhar'
import { formatarHora } from '@/utilidades/datas'

import { dataCurtaDoEncontro } from '../agenda/semanas'
import { useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { DetalheLocalDoEvento } from '../offline/DetalheLocalDoEvento'
import { useEstaOnline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { CartaoDoRepertorioNoEncontro } from '../repertorio/CartaoDoRepertorioNoEncontro'
import {
  AcoesNoPainel,
  BarraDoEvento,
  textoDePublicado,
  useAcoesDoEvento,
  useBaixarSozinho,
} from './BarraDoEvento'
import { useEvento } from './consultas'
import { MetaDoEvento } from './MetaDoEvento'
import {
  AvisoDeStatus,
  InscricaoDoMembro,
  Preparacao,
  QuandoEOnde,
  QuemServe,
  RoteiroEnxuto,
  SobreOEncontro,
  temPreparacao,
} from './PartesDaPagina'
import { faseDoEncontro, momentoDaFase } from './regras'
import { QuemVai } from './QuemVai'
import { ResumoDoEncontro } from './ResumoDoEncontro'
import { SecaoEtapas } from './SecaoEtapas'
import { SuaParte } from './SuaParte'
import { useLembrete } from './useLembrete'

/** As três abas da organização (D69). O membro não tem abas: a página é uma só. */
export type Visao = 'resumo' | 'roteiro' | 'convocados'

interface Props {
  comunidadeId: string
  eventoId: string
  /** O que fazer ao sair (excluiu o rascunho, evento sumiu). Padrão: voltar. */
  aoSair?: () => void
  /** No painel da direita (web larga): sem tela própria nem barra fixa. */
  painel?: boolean
  /** A aba que abre primeiro ("Faltam: Bruno e Camila" do Início abre os Quem vai). */
  abaInicial?: Visao | undefined
  /** Acabou de publicar em outra tela ("Igual ao último sábado"): quantas pessoas foram avisadas. */
  avisadasAoPublicar?: number | undefined
}

/**
 * O encontro (D69, seção 3.4), na tela própria (celular) e no painel da direita (web larga). Para
 * o membro, UMA página: "Sua parte" no alto, quando e onde, o roteiro enxuto, quem serve, a
 * inscrição e o resto. Para a organização, a mesma abertura e três abas (Resumo, Roteiro,
 * Convocados), com "Mais" em grupos e o botão principal do momento na barra. Busca o encontro e
 * escolhe a moldura; separado da rota para ser testável sem navegação.
 */
export function DetalheDoEvento({
  comunidadeId,
  eventoId,
  aoSair = () => voltarOu('/agenda'),
  painel = false,
  abaInicial,
  avisadasAoPublicar,
}: Props) {
  const pode = usePode()
  // Baixar para usar sem internet é coisa de quem organiza ou conduz (D57).
  const baixa = pode('evento', 'editar') || pode('ao_vivo', 'conduzir')
  const evento = useEvento(comunidadeId, eventoId)
  const online = useEstaOnline()
  const guardado = usePacoteDoEvento(eventoId).data ?? null
  const pausado = evento.isPending && evento.fetchStatus === 'paused'
  const semRede = !online || pausado || evento.error instanceof SemConexao

  // Sem conexão e com o encontro preparado: a cópia deste aparelho, com o que está pendente.
  if (semRede && guardado) {
    return (
      <Moldura painel={painel}>
        <DetalheLocalDoEvento comunidadeId={comunidadeId} guardado={guardado} />
      </Moldura>
    )
  }
  if (pausado) {
    return (
      <Moldura painel={painel}>
        <Aviso tipo="alerta" titulo="Sem conexão: este encontro abre quando a internet voltar">
          {baixa
            ? 'Ele não foi baixado neste aparelho. Da próxima vez, antes de sair, abra o encontro, toque em Mais e depois em Baixar para usar sem internet.'
            : 'Ele não foi baixado neste aparelho. Quem organiza pode baixar o encontro para usar sem internet.'}
        </Aviso>
      </Moldura>
    )
  }
  if (evento.isPending) {
    return (
      <Moldura painel={painel}>
        <Esqueleto rotulo="Carregando o encontro">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Moldura>
    )
  }
  if (evento.error) {
    // Encontro removido, de outra comunidade ou sem internet: a mesma frase, sem termo técnico.
    const naoAchou = ehErroDaApi(evento.error) && evento.error.status === 404
    return (
      <Moldura painel={painel}>
        <EstadoVazio
          icone={naoAchou ? 'eventos' : 'erro'}
          titulo="Não deu para abrir este encontro."
          descricao="Pode ter sido removido ou você está sem internet."
          acao={{ titulo: 'Tentar de novo', aoPressionar: () => void evento.refetch() }}
          acaoSecundaria={{ titulo: 'Voltar para a Agenda', aoPressionar: aoSair }}
        />
      </Moldura>
    )
  }
  return (
    <Conteudo
      evento={evento.data}
      comunidadeId={comunidadeId}
      aoSair={aoSair}
      painel={painel}
      abaInicial={abaInicial}
      avisadasAoPublicar={avisadasAoPublicar}
    />
  )
}

function Moldura({
  painel,
  titulo,
  abaixoDoTitulo,
  acoes,
  barra,
  momento,
  children,
}: {
  painel: boolean
  titulo?: string
  abaixoDoTitulo?: ReactNode
  acoes?: ReactNode
  barra?: ReactNode
  momento?: 'longe' | 'vespera' | 'dia' | 'agora' | 'fim'
  children: ReactNode
}) {
  if (painel) return <View style={{ gap: RITMO.entreSecoes }}>{children}</View>
  return (
    <Tela
      pilha
      {...(titulo ? { titulo } : {})}
      {...(abaixoDoTitulo ? { abaixoDoTitulo } : {})}
      {...(acoes ? { acoes } : {})}
      {...(barra ? { barraDeAcao: barra } : {})}
      {...(momento ? { momento } : {})}
    >
      {children}
    </Tela>
  )
}

function Conteudo({
  evento: e,
  comunidadeId,
  aoSair,
  painel,
  abaInicial,
  avisadasAoPublicar,
}: {
  evento: Evento
  comunidadeId: string
  aoSair: () => void
  painel: boolean
  abaInicial: Visao | undefined
  avisadasAoPublicar: number | undefined
}) {
  const { comunidadeAtiva } = useSessao()
  const eu = useMeuVinculo()
  const pode = usePode()
  const [aba, setAba] = useState<Visao>(abaInicial ?? 'resumo')
  const lembrete = useLembrete(e, comunidadeId)

  async function compartilhar() {
    const linha = `${e.titulo}, ${dataCurtaDoEncontro(e.inicio, e.fuso)}, ${formatarHora(e.inicio, e.fuso)}${e.local ? `, ${e.local.nome}` : ''}.`
    const publica = e.visibilidade === 'publica' && e.status === 'publicado'
    const r = await compartilharTexto(
      publica ? `${linha}\n${linkPublicoDoEvento(e.idPublico)}` : linha,
    )
    if (r === 'copiado') mostrarToast({ texto: 'Texto copiado.', tipo: 'info' })
    else if (r === 'falhou')
      mostrarToast({ texto: 'Não foi possível compartilhar agora.', tipo: 'erro' })
  }

  const acoes = useAcoesDoEvento({
    evento: e,
    comunidadeId,
    aoSair,
    lembrete,
    aoVerConvocados: () => setAba('convocados'),
    aoCompartilhar: () => void compartilhar(),
  })
  const temParte = e.atribuicoes.some((a) => a.vinculoId === eu && a.estado !== 'recusada')
  // O encontro vai ser usado por quem organiza, conduz ou serve: baixa sozinho quando faz sentido.
  useBaixarSozinho(e, acoes.organiza || pode('ao_vivo', 'conduzir') || temParte)

  const abas: Segmento<Visao>[] = [
    { valor: 'resumo', rotulo: 'Resumo' },
    { valor: 'roteiro', rotulo: 'Roteiro' },
    { valor: 'convocados', rotulo: 'Quem vai' },
  ]
  const publicado = e.status === 'publicado'
  const mensagemFinal =
    acoes.mensagemFinal ??
    (avisadasAoPublicar !== undefined && publicado ? textoDePublicado(avisadasAoPublicar) : null)
  const doTopo =
    publicado || (!acoes.organiza && acoes.temMenu) ? (
      <>
        {publicado ? (
          <BotaoIcone
            icone="compartilhar"
            texto="Compartilhar"
            rotulo="Compartilhar"
            dica="Manda o dia, a hora e o local do encontro."
            circular
            aoPressionar={() => void compartilhar()}
          />
        ) : null}
        {!acoes.organiza && acoes.temMenu ? (
          <BotaoIcone
            icone="maisAcoes"
            texto="Mais"
            rotulo="Mais ações"
            circular
            aoPressionar={acoes.abrirMenu}
          />
        ) : null}
      </>
    ) : undefined

  const corpo = (
    <>
      {comunidadeAtiva?.estado === 'suspensa' ? (
        <Aviso tipo="alerta" titulo="Comunidade suspensa">
          Dá para consultar, mas não alterar nada por enquanto.
        </Aviso>
      ) : null}
      {acoes.erro ? <AvisoDeFalha erro={acoes.erro} /> : null}
      {/* Depois de publicar a tela diz o que houve, em frase inteira, e não some sozinha. */}
      {mensagemFinal ? (
        <Aviso tipo="sucesso" anunciar>
          {mensagemFinal}
        </Aviso>
      ) : null}
      <SuaParte evento={e} comunidadeId={comunidadeId} />
      {acoes.organiza ? (
        <>
          <Segmentos rotulo="Partes do encontro" segmentos={abas} valor={aba} aoMudar={setAba} />
          {aba === 'resumo' ? (
            <ResumoDoEncontro
              evento={e}
              comunidadeId={comunidadeId}
              aoVerConvocados={() => setAba('convocados')}
              outrasCoisas={acoes.itens}
            />
          ) : aba === 'roteiro' ? (
            <>
              <SecaoEtapas
                evento={e}
                comunidadeId={comunidadeId}
                aoVerVisaoGeral={() => setAba('resumo')}
              />
              <CartaoDoRepertorioNoEncontro evento={e} comunidadeId={comunidadeId} />
            </>
          ) : (
            <QuemVai evento={e} comunidadeId={comunidadeId} lembrete={lembrete} />
          )}
        </>
      ) : (
        <>
          <AvisoDeStatus evento={e} />
          <QuandoEOnde evento={e} />
          <RoteiroEnxuto evento={e} />
          <QuemServe evento={e} />
          {/* D73: o repertório do encontro é de toda a comunidade; o cartão só aparece havendo músicas. */}
          <CartaoDoRepertorioNoEncontro evento={e} comunidadeId={comunidadeId} />
          <InscricaoDoMembro evento={e} comunidadeId={comunidadeId} />
          <SobreOEncontro evento={e} />
          {temPreparacao(e) ? <Preparacao evento={e} comunidadeId={comunidadeId} /> : null}
        </>
      )}
      {acoes.menu}
    </>
  )

  if (painel) {
    return (
      <View style={{ gap: RITMO.entreSecoes }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: RITMO.entreItens }}>
          <Texto variante="tituloTela" style={{ flex: 1 }}>
            {e.titulo}
          </Texto>
          {doTopo}
        </View>
        <MetaDoEvento evento={e} publicando={acoes.textoPublicando} />
        <AcoesNoPainel acoes={acoes} />
        {corpo}
      </View>
    )
  }
  return (
    <Moldura
      painel={false}
      titulo={e.titulo}
      abaixoDoTitulo={<MetaDoEvento evento={e} publicando={acoes.textoPublicando} />}
      momento={momentoDaFase(faseDoEncontro(e))}
      {...(doTopo ? { acoes: doTopo } : {})}
      {...(acoes.organiza ? { barra: <BarraDoEvento acoes={acoes} /> } : {})}
    >
      {corpo}
    </Moldura>
  )
}
