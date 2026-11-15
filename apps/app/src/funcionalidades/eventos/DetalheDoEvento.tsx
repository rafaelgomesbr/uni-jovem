import { RITMO } from '@uj/tokens'
import { router } from 'expo-router'
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
import { Segmentos, type Segmento } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { compartilharTexto } from '@/utilidades/compartilhar'

import { DetalheLocalDoEvento } from '../offline/DetalheLocalDoEvento'
import { useEstaOnline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { AcoesNoPainel, BarraDoEvento, useAcoesDoEvento } from './BarraDoEvento'
import { useEvento } from './consultas'
import { DestaqueDoEvento } from './DestaqueDoEvento'
import { AvisoDeFalha, ErroDaTela } from './Falha'
import { SecaoAnexos, SecaoChecklist, SecaoNotas } from './SecaoChecklist'
import { SecaoEquipe } from './SecaoEquipe'
import { SecaoEtapas } from './SecaoEtapas'
import { SecaoMateriais, SecaoTarefas } from './SecaoTarefas'
import { MetaDoEvento, VisaoGeralDoEvento } from './VisaoGeralDoEvento'

type Visao = 'geral' | 'etapas' | 'equipe' | 'preparacao'

interface Props {
  comunidadeId: string
  eventoId: string
  /** O que fazer ao sair (excluiu o rascunho, evento sumiu). Padrão: voltar. */
  aoSair?: () => void
  /** No painel da direita (web larga): sem tela própria nem barra fixa. */
  painel?: boolean
}

/**
 * Detalhe do evento (3.4.2 e quadro 03), na tela própria (celular) e no
 * painel da direita (web larga). Busca o evento e escolhe a moldura;
 * separado da rota para ser testável sem navegação.
 */
export function DetalheDoEvento({
  comunidadeId,
  eventoId,
  aoSair = () => router.back(),
  painel = false,
}: Props) {
  const evento = useEvento(comunidadeId, eventoId)
  const online = useEstaOnline()
  const guardado = usePacoteDoEvento(eventoId).data ?? null
  const pausado = evento.isPending && evento.fetchStatus === 'paused'
  const semRede = !online || pausado || evento.error instanceof SemConexao

  // Sem conexão e com o evento preparado: a cópia deste aparelho, com o que está pendente.
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
        <Aviso tipo="alerta" titulo="Sem conexão: esta programação abre quando a internet voltar">
          Ela não foi preparada para usar sem internet. Da próxima vez, use Preparar para usar sem
          internet, em Mais ações, antes de sair.
        </Aviso>
      </Moldura>
    )
  }
  if (evento.isPending) {
    return (
      <Moldura painel={painel}>
        <Esqueleto rotulo="Carregando a programação">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Moldura>
    )
  }
  if (evento.error) {
    return (
      <Moldura painel={painel}>
        {ehErroDaApi(evento.error) && evento.error.status === 404 ? (
          <EstadoVazio
            icone="eventos"
            titulo="Programação não encontrada"
            descricao="Ela pode ter sido excluída, ou é de outra comunidade."
            acao={{ titulo: 'Voltar para os programas', aoPressionar: aoSair }}
          />
        ) : (
          <ErroDaTela
            erro={evento.error}
            titulo="A programação não abriu"
            aoTentarDeNovo={() => void evento.refetch()}
          />
        )}
      </Moldura>
    )
  }
  return (
    <Conteudo evento={evento.data} comunidadeId={comunidadeId} aoSair={aoSair} painel={painel} />
  )
}

function Moldura({
  painel,
  titulo,
  acoes,
  barra,
  children,
}: {
  painel: boolean
  titulo?: string
  acoes?: ReactNode
  barra?: ReactNode
  children: ReactNode
}) {
  if (painel) return <View style={{ gap: RITMO.entreSecoes }}>{children}</View>
  return (
    <Tela
      pilha
      {...(titulo ? { titulo } : {})}
      {...(acoes ? { acoes } : {})}
      {...(barra ? { barraDeAcao: barra } : {})}
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
}: {
  evento: Evento
  comunidadeId: string
  aoSair: () => void
  painel: boolean
}) {
  const { comunidadeAtiva } = useSessao()
  const acoes = useAcoesDoEvento({ evento: e, comunidadeId, aoSair })
  const [visao, setVisao] = useState<Visao>('geral')

  // Membro: Visão geral e Etapas; a Preparação aparece quando há o que marcar.
  const temPreparacao =
    acoes.organiza ||
    e.tarefas.length + e.materiais.length + e.checklist.length + e.anexos.length > 0
  const visoes: Segmento<Visao>[] = [
    { valor: 'geral', rotulo: 'Visão geral' },
    { valor: 'etapas', rotulo: 'Etapas' },
    ...(acoes.organiza ? [{ valor: 'equipe' as const, rotulo: 'Equipe' }] : []),
    ...(temPreparacao ? [{ valor: 'preparacao' as const, rotulo: 'Preparação' }] : []),
  ]
  const atual = visoes.some((v) => v.valor === visao) ? visao : 'geral'
  const publica = e.visibilidade === 'publica' && e.status === 'publicado'

  async function compartilhar() {
    const r = await compartilharTexto(
      `${e.titulo}: inscreva-se pelo link\n${linkPublicoDoEvento(e.idPublico)}`,
    )
    if (r === 'copiado') mostrarToast({ texto: 'Link da página pública copiado.', tipo: 'info' })
    else if (r === 'falhou')
      mostrarToast({ texto: 'Não foi possível compartilhar agora.', tipo: 'erro' })
  }

  const doTopo =
    publica || (!acoes.organiza && acoes.temMenu) ? (
      <>
        {publica ? (
          <BotaoIcone
            icone="compartilhar"
            rotulo="Compartilhar"
            dica="Manda o link da página pública de inscrição."
            circular
            aoPressionar={() => void compartilhar()}
          />
        ) : null}
        {!acoes.organiza && acoes.temMenu ? (
          <BotaoIcone
            icone="maisAcoes"
            rotulo="Mais ações"
            circular
            aoPressionar={acoes.abrirMenu}
          />
        ) : null}
      </>
    ) : undefined

  const meta = <MetaDoEvento evento={e} />
  const corpo = (
    <>
      {comunidadeAtiva?.estado === 'suspensa' ? (
        <Aviso tipo="alerta" titulo="Comunidade suspensa">
          Dá para consultar, mas não alterar nada por enquanto.
        </Aviso>
      ) : null}
      {acoes.erro ? <AvisoDeFalha erro={acoes.erro} /> : null}
      <DestaqueDoEvento evento={e} comunidadeId={comunidadeId} />
      <Segmentos
        rotulo="Partes da programação"
        segmentos={visoes}
        valor={atual}
        aoMudar={setVisao}
      />
      {atual === 'geral' ? (
        <VisaoGeralDoEvento evento={e} comunidadeId={comunidadeId} />
      ) : atual === 'etapas' ? (
        <SecaoEtapas
          evento={e}
          comunidadeId={comunidadeId}
          aoVerVisaoGeral={() => setVisao('geral')}
        />
      ) : atual === 'equipe' ? (
        <SecaoEquipe evento={e} />
      ) : (
        <>
          <SecaoTarefas evento={e} comunidadeId={comunidadeId} />
          <SecaoMateriais evento={e} comunidadeId={comunidadeId} />
          <SecaoChecklist evento={e} comunidadeId={comunidadeId} />
          <SecaoNotas evento={e} comunidadeId={comunidadeId} />
          <SecaoAnexos evento={e} comunidadeId={comunidadeId} />
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
        {meta}
        <AcoesNoPainel acoes={acoes} />
        {corpo}
      </View>
    )
  }
  return (
    <Moldura
      painel={false}
      titulo={e.titulo}
      {...(doTopo ? { acoes: doTopo } : {})}
      {...(acoes.organiza ? { barra: <BarraDoEvento acoes={acoes} /> } : {})}
    >
      {meta}
      {corpo}
    </Moldura>
  )
}
