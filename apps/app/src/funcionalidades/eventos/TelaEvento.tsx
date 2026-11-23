import { useLocalSearchParams } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { parametro } from '@/utilidades/parametros'
import { Tela } from '@/ui/Tela'

import { SemComunidade } from '../navegacao/SemComunidade'
import { DetalheDoEvento } from './DetalheDoEvento'

/** Rota `/evento/[eventoId]`: o detalhe em tela cheia (celular e web estreita), com a própria tela. */
export function TelaEvento() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{
    eventoId: string
    aba?: string
    publicado?: string
    funcao?: string
    bloco?: string
    editar?: string
  }>()
  const eventoId = parametro(params.eventoId)
  // Links internos: "Ver quem falta responder" (Quem vai), o antigo link de uma etapa (Roteiro) e
  // "Convocar bateria" (`?funcao=Bateria&bloco=louvor`), que abre a folha já no papel (D78).
  const funcao = parametro(params.funcao)
  const convocarInicial = funcao ? { funcao, bloco: parametro(params.bloco) } : null
  const aba = parametro(params.aba)
  const abaInicial =
    convocarInicial || aba === 'convocados'
      ? 'convocados'
      : aba === 'roteiro'
        ? 'roteiro'
        : undefined
  // "Editar" do Início e do próprio encontro (`?editar=1`): abre já a seção "Dados do encontro".
  const editarInicial = parametro(params.editar) === '1'
  // Veio de "Igual ao último encontro" depois de publicar: quantas pessoas foram avisadas.
  const avisadas = Number(parametro(params.publicado))
  const avisadasAoPublicar =
    parametro(params.publicado) !== null && Number.isInteger(avisadas) && avisadas >= 0
      ? avisadas
      : undefined
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
      {...(convocarInicial ? { convocarInicial } : {})}
      avisadasAoPublicar={avisadasAoPublicar}
      {...(editarInicial ? { editarInicial } : {})}
    />
  )
}
