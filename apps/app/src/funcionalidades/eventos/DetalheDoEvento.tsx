import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { ehErroDaApi } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'

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
