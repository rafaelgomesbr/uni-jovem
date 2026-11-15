import { useLocalSearchParams } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { parametro } from '@/utilidades/parametros'
import { Tela } from '@/ui/Tela'

import { SemComunidade } from '../navegacao/SemComunidade'
import { DetalheDoEvento } from './DetalheDoEvento'

/** Rota `/evento/[eventoId]`: o detalhe em tela cheia (celular e web estreita). */
export function TelaEvento() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  return (
    <Tela cabecalhoNativo>
      {comunidadeAtiva && eventoId ? (
        <DetalheDoEvento comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
      ) : (
        <SemComunidade oQue="a programação" />
      )}
    </Tela>
  )
}
