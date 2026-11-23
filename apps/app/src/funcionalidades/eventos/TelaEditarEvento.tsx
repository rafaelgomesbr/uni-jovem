import { useLocalSearchParams } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { Aviso } from '@/ui/Aviso'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { parametro } from '@/utilidades/parametros'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useEvento } from './consultas'
import { EditarDadosDoEncontro } from './EditarDadosDoEncontro'

/**
 * Rota `/evento/[eventoId]/editar`. Dentro do app, editar é a seção "Dados do encontro" do Resumo;
 * esta tela fica para os links antigos (e abre o mesmo formulário, sem perder nada dele).
 */
export function TelaEditarEvento() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const evento = useEvento(comunidadeAtiva?.id ?? null, eventoId)
  const pode = usePode()

  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha>
        <SemComunidade oQue="o encontro" />
      </Tela>
    )
  }
  if (!pode('evento', 'editar')) {
    return (
      <Tela pilha titulo="Editar encontro">
        <Aviso tipo="info" titulo="Só a organização edita encontros">
          Você pode ver o encontro, mas não alterar.
        </Aviso>
      </Tela>
    )
  }
  if (evento.isPending) {
    return (
      <Tela pilha titulo="Editar encontro">
        <Esqueleto rotulo="Carregando o encontro">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (evento.error) {
    return (
      <Tela pilha titulo="Editar encontro">
        <ErroDaTela erro={evento.error} aoTentarDeNovo={() => void evento.refetch()} />
      </Tela>
    )
  }
  const inicial = evento.data
  return (
    <Tela pilha titulo="Editar encontro" descricao={inicial.titulo}>
      <EditarDadosDoEncontro
        comunidadeId={comunidadeAtiva.id}
        inicial={inicial}
        aoSalvar={() =>
          voltarOu({ pathname: '/evento/[eventoId]', params: { eventoId: inicial.id } })
        }
        // Sair com algo digitado já pergunta (o aviso de descarte da própria edição).
        aoCancelar={() =>
          voltarOu({ pathname: '/evento/[eventoId]', params: { eventoId: inicial.id } })
        }
      />
    </Tela>
  )
}
