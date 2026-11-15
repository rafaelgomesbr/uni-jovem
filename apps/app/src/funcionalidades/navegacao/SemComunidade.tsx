import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'

import { AtalhosParaComecar } from '../comunidade/AtalhosParaComecar'

/**
 * O que mostrar nas abas enquanto não há comunidade ativa. Sem nenhuma, os
 * caminhos para começar (Criador cria a primeira; os demais entram com o
 * convite), mantidos pela área de comunidade.
 */
export function SemComunidade({ oQue }: { oQue: string }) {
  const { comunidades } = useSessao()
  if (comunidades.length === 0) return <AtalhosParaComecar />
  return (
    <Cartao>
      <EstadoVazio
        icone="trocar"
        titulo="Escolha uma comunidade"
        descricao={`Você participa de mais de uma. Escolha a comunidade para ver ${oQue}; dá para trocar a qualquer momento pelo topo da tela.`}
        acao={{
          titulo: 'Escolher comunidade',
          variante: 'primario',
          aoPressionar: () => router.push('/trocar-comunidade'),
        }}
      />
    </Cartao>
  )
}
