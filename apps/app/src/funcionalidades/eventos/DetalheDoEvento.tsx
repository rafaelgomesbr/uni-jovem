import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { ehErroDaApi, SemConexao } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'

import { CartaoOfflineDoEvento } from '../offline/CartaoOfflineDoEvento'
import { DetalheLocalDoEvento } from '../offline/DetalheLocalDoEvento'
import { useEstaOnline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { AcoesDoEvento } from './AcoesDoEvento'
import { CabecalhoDoEvento } from './CabecalhoDoEvento'
import { useEvento } from './consultas'
import { SecaoAnexos, SecaoChecklist, SecaoNotas } from './SecaoChecklist'
import { SecaoEquipe } from './SecaoEquipe'
import { SecaoEtapas } from './SecaoEtapas'
import { SecaoParticipacao } from './SecaoParticipacao'
import { SecaoMateriais, SecaoTarefas } from './SecaoTarefas'

interface Props {
  comunidadeId: string
  eventoId: string
  /** O que fazer ao sair (excluiu o rascunho, evento sumiu). Padrão: voltar. */
  aoSair?: () => void
}

/**
 * Conteúdo do evento, usado na tela própria (celular) e no painel da direita
 * (web larga). Separado da busca de rota para ser testável sem navegação.
 */
export function DetalheDoEvento({ comunidadeId, eventoId, aoSair = () => router.back() }: Props) {
  const { comunidadeAtiva } = useSessao()
  const evento = useEvento(comunidadeId, eventoId)
  const online = useEstaOnline()
  const guardado = usePacoteDoEvento(eventoId).data ?? null
  const pausado = evento.isPending && evento.fetchStatus === 'paused'
  const semRede = !online || pausado || evento.error instanceof SemConexao

  // Sem conexão e com o evento preparado: a cópia deste aparelho, com o que está pendente.
  if (semRede && guardado) {
    return <DetalheLocalDoEvento comunidadeId={comunidadeId} guardado={guardado} />
  }
  if (pausado) {
    return (
      <Aviso tipo="alerta" titulo="Sem conexão">
        Esta programação não foi preparada para usar sem internet. Ela abre quando a conexão voltar;
        da próxima vez, toque em Preparar para usar sem internet antes de sair.
      </Aviso>
    )
  }
  if (evento.isPending) return <Carregando texto="Carregando a programação" />
  if (evento.error) {
    if (ehErroDaApi(evento.error) && evento.error.status === 404) {
      return (
        <Cartao>
          <EstadoVazio
            icone="eventos"
            titulo="Programação não encontrada"
            descricao="Ela pode ter sido excluída, ou é de outra comunidade."
            acao={{ titulo: 'Voltar', aoPressionar: aoSair }}
          />
        </Cartao>
      )
    }
    return <AvisoDeErro erro={evento.error} aoTentarDeNovo={() => void evento.refetch()} />
  }

  const e = evento.data
  return (
    <>
      {comunidadeAtiva?.estado === 'suspensa' ? (
        <Aviso tipo="alerta" titulo="Comunidade suspensa">
          Dá para consultar, mas não alterar nada por enquanto.
        </Aviso>
      ) : null}
      <CabecalhoDoEvento evento={e} />
      <AcoesDoEvento evento={e} comunidadeId={comunidadeId} aoSair={aoSair} />
      <CartaoOfflineDoEvento eventoId={e.id} titulo={e.titulo} />
      <SecaoParticipacao evento={e} comunidadeId={comunidadeId} />
      <SecaoEtapas evento={e} comunidadeId={comunidadeId} />
      <SecaoEquipe evento={e} />
      <SecaoTarefas evento={e} comunidadeId={comunidadeId} />
      <SecaoMateriais evento={e} comunidadeId={comunidadeId} />
      <SecaoChecklist evento={e} comunidadeId={comunidadeId} />
      <SecaoNotas evento={e} comunidadeId={comunidadeId} />
      <SecaoAnexos evento={e} comunidadeId={comunidadeId} />
    </>
  )
}
