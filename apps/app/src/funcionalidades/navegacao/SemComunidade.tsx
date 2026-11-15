import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'

/** O que mostrar nas abas enquanto não há comunidade ativa. */
export function SemComunidade({ oQue }: { oQue: string }) {
  const { comunidades } = useSessao()
  if (comunidades.length === 0) {
    return (
      <Cartao>
        <EstadoVazio
          icone="comunidade"
          titulo="Você ainda não participa de uma comunidade"
          descricao="Peça um convite a quem administra a sua comunidade. Quando você abrir o link, ela aparece aqui."
        />
      </Cartao>
    )
  }
  return (
    <Cartao>
      <EstadoVazio
        icone="trocar"
        titulo="Escolha uma comunidade"
        descricao={`Você participa de mais de uma. Escolha a comunidade para ver ${oQue}; dá para trocar a qualquer momento pelo topo da tela.`}
        acao={{
          titulo: 'Escolher comunidade',
          aoPressionar: () => router.push('/trocar-comunidade'),
        }}
      />
    </Cartao>
  )
}
