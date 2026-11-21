import { useLocalSearchParams } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { parametro } from '@/utilidades/parametros'
import { Tela } from '@/ui/Tela'

import { SemComunidade } from '../navegacao/SemComunidade'
import { DetalheDoEvento } from './DetalheDoEvento'

/** Rota `/evento/[eventoId]`: o detalhe em tela cheia (celular e web estreita), com a própria tela. */
export function TelaEvento() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ eventoId: string; aba?: string }>()
  const eventoId = parametro(params.eventoId)
  // Só a parte dos Convocados abre por link interno (o Início: "Ver quem falta responder").
  const abaInicial = parametro(params.aba) === 'convocados' ? 'equipe' : undefined
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha>
        <SemComunidade oQue="o encontro" />
      </Tela>
    )
  }
  return (
    <DetalheDoEvento
      comunidadeId={comunidadeAtiva.id}
      eventoId={eventoId}
      {...(abaInicial ? { abaInicial } : {})}
    />
  )
}
