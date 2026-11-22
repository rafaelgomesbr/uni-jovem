import { router } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { FiltroDeOracao, FiltroDeRespondidos } from '@/servicos/contratoDosModulos'
import { Botao } from '@/ui/Botao'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { LinhaDePilulas, PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Tela } from '@/ui/Tela'

import { VazioComSol } from '../comunidade/VazioComSol'
import { SemComunidade } from '../navegacao/SemComunidade'
import { CartaoDoPedido } from './CartaoDoPedido'
import { usePedidosDeOracao } from './consultas'

function novoPedido() {
  router.push('/oracao/novo')
}

/**
 * Rota `/oracao` (3.7.1): título "Oração", "Novo pedido" no cabeçalho (com
 * texto: o "+" sozinho não dizia o que fazia, U-06), as pílulas de filtro (de
 * quem e situação, separadas) e um cartão por pedido.
 */
export function TelaOracao() {
  const { comunidadeAtiva } = useSessao()
  return (
    <Tela
      pilha
      titulo="Pedidos de oração"
      descricao="Cada pedido mostra quem vê."
      {...(comunidadeAtiva
        ? {
            acoes: (
              <Botao
                titulo="Pedir oração"
                icone="oracao"
                variante="secundario"
                aoPressionar={novoPedido}
              />
            ),
          }
        : {})}
    >
      {comunidadeAtiva ? (
        <ListaDeOracao comunidadeId={comunidadeAtiva.id} />
      ) : (
        <SemComunidade oQue="os pedidos de oração" />
      )}
    </Tela>
  )
}

/**
 * Pílulas "Todos", "Meus", "De outras pessoas", separador, "Em oração" e
 * "Respondidos". A segunda turma é uma só ou nenhuma: nenhuma marcada mostra
 * todos. Uma linha só, rolando por baixo da margem.
 */
function Filtros({
  filtro,
  aoMudarFiltro,
  respondidos,
  aoMudarRespondidos,
}: {
  filtro: FiltroDeOracao
  aoMudarFiltro: (f: FiltroDeOracao) => void
  respondidos: FiltroDeRespondidos
  aoMudarRespondidos: (r: FiltroDeRespondidos) => void
}) {
  const situacao = respondidos === 'incluir' ? [] : [respondidos]
  return (
    <LinhaDePilulas>
      <PilulasDeFiltro
        rotulo="De quem"
        selecionadas={[filtro]}
        aoMudar={(v) => {
          if (v[0]) aoMudarFiltro(v[0])
        }}
        pilulas={[
          { valor: 'todos', rotulo: 'Todos' },
          { valor: 'meus', rotulo: 'Meus' },
          { valor: 'outros', rotulo: 'De outras pessoas' },
        ]}
      />
      <PilulasDeFiltro
        rotulo="Situação"
        opcional
        selecionadas={situacao}
        // Desmarcar a ativa volta para todos.
        aoMudar={(v) => aoMudarRespondidos(v[0] ?? 'incluir')}
        pilulas={[
          { valor: 'ocultar' as const, rotulo: 'Em oração' },
          { valor: 'somente' as const, rotulo: 'Respondidos' },
        ]}
      />
    </LinhaDePilulas>
  )
}

function ListaDeOracao({ comunidadeId }: { comunidadeId: string }) {
  const [filtro, setFiltro] = useState<FiltroDeOracao>('todos')
  const [respondidos, setRespondidos] = useState<FiltroDeRespondidos>('incluir')
  const pedidos = usePedidosDeOracao(comunidadeId, filtro, respondidos)

  return (
    <>
      <Filtros
        filtro={filtro}
        aoMudarFiltro={setFiltro}
        respondidos={respondidos}
        aoMudarRespondidos={setRespondidos}
      />
      {pedidos.isPending ? (
        <Esqueleto rotulo="Carregando os pedidos">
          <CartaoDeEsqueleto />
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : pedidos.error ? (
        <ErroDaTela
          erro={pedidos.error}
          oQue="os pedidos"
          aoTentarDeNovo={() => void pedidos.refetch()}
        />
      ) : pedidos.data.length === 0 ? (
        <VazioComSol
          titulo={respondidos === 'somente' ? 'Nenhum pedido respondido.' : 'Nenhum pedido ainda.'}
          descricao={
            respondidos === 'somente'
              ? 'Quando um pedido for marcado como respondido, ele aparece aqui.'
              : 'Quem pedir oração aparece aqui. Você pode ser o primeiro: o pedido começa visível só para você.'
          }
          acao={{ titulo: 'Pedir oração', icone: 'oracao', aoPressionar: novoPedido }}
          pose="escondido"
        />
      ) : (
        pedidos.data.map((p) => (
          <CartaoDoPedido key={p.id} pedido={p} comunidadeId={comunidadeId} />
        ))
      )}
    </>
  )
}
