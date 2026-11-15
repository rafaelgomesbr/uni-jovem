import { ALTURA, BORDA, ESPACO, RITMO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { FiltroDeOracao, FiltroDeRespondidos } from '@/servicos/contratoDosModulos'
import { BotaoIcone } from '@/ui/Botao'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Tela } from '@/ui/Tela'
import { useTema } from '@/ui/tema'

import { ErroAoCarregar } from '../agenda/ErroAoCarregar'
import { SemComunidade } from '../navegacao/SemComunidade'
import { CartaoDoPedido } from './CartaoDoPedido'
import { usePedidosDeOracao } from './consultas'

function novoPedido() {
  router.push('/oracao/novo')
}

/**
 * Rota `/oracao` (3.7.1): título "Oração", o "+" no cabeçalho, as pílulas
 * de filtro (de quem e situação, separadas) e um cartão por pedido.
 */
export function TelaOracao() {
  const { comunidadeAtiva } = useSessao()
  return (
    <Tela
      pilha
      titulo="Oração"
      descricao="Cada pedido mostra quem vê."
      {...(comunidadeAtiva
        ? {
            acoes: (
              <BotaoIcone
                icone="adicionar"
                rotulo="Novo pedido de oração"
                circular
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
 * "Respondidos". A segunda turma liga e desliga: nenhuma marcada mostra
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
  const { cores } = useTema()
  const situacao = respondidos === 'incluir' ? [] : [respondidos]
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -RITMO.margemDaTela, flexGrow: 0 }}
      contentContainerStyle={{
        paddingHorizontal: RITMO.margemDaTela,
        alignItems: 'center',
        gap: ESPACO.e8,
      }}
    >
      <PilulasDeFiltro
        rotulo="De quem"
        sangrar={false}
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
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: BORDA.fina, height: ALTURA.chip, backgroundColor: cores.tonalBorda }}
      />
      <PilulasDeFiltro
        rotulo="Situação"
        sangrar={false}
        multipla
        selecionadas={situacao}
        aoMudar={(v) => {
          // Uma de cada vez: a recém-tocada vale; desmarcar volta para todos.
          const nova = v.find((x) => !situacao.includes(x))
          aoMudarRespondidos(nova ?? 'incluir')
        }}
        pilulas={[
          { valor: 'ocultar' as const, rotulo: 'Em oração' },
          { valor: 'somente' as const, rotulo: 'Respondidos' },
        ]}
      />
    </ScrollView>
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
        <ErroAoCarregar
          erro={pedidos.error}
          oQue="os pedidos"
          aoTentarDeNovo={() => void pedidos.refetch()}
        />
      ) : pedidos.data.length === 0 ? (
        <EstadoVazio
          icone="oracao"
          titulo={respondidos === 'somente' ? 'Nenhum pedido respondido' : 'Nenhum pedido por aqui'}
          descricao="Compartilhe um pedido. Ele começa visível só para você, e você decide se a equipe de oração ou a comunidade pode ler."
          acao={{ titulo: 'Novo pedido de oração', icone: 'adicionar', aoPressionar: novoPedido }}
        />
      ) : (
        pedidos.data.map((p) => (
          <CartaoDoPedido key={p.id} pedido={p} comunidadeId={comunidadeId} />
        ))
      )}
    </>
  )
}
