import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import type { FiltroDeOracao, FiltroDeRespondidos } from '@/servicos/contratoDosModulos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Segmentos } from '@/ui/Segmentos'

import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { CartaoDoPedido } from './CartaoDoPedido'
import { usePedidosDeOracao } from './consultas'

/** Rota `/oracao`. */
export function TelaOracao() {
  return (
    <TelaDaComunidade
      oQue="os pedidos de oração"
      titulo="Oração"
      descricao="Pedidos que você pode ler nesta comunidade. Cada pedido mostra quem vê."
    >
      {(c) => <ListaDeOracao comunidadeId={c.id} />}
    </TelaDaComunidade>
  )
}

function ListaDeOracao({ comunidadeId }: { comunidadeId: string }) {
  const [filtro, setFiltro] = useState<FiltroDeOracao>('todos')
  const [respondidos, setRespondidos] = useState<FiltroDeRespondidos>('incluir')
  const pedidos = usePedidosDeOracao(comunidadeId, filtro, respondidos)

  return (
    <>
      <Botao
        titulo="Novo pedido de oração"
        icone="adicionar"
        aoPressionar={() => router.push('/oracao/novo')}
      />
      <View style={{ gap: ESPACO.x2 }}>
        <Segmentos
          rotulo="De quem"
          valor={filtro}
          aoMudar={setFiltro}
          segmentos={[
            { valor: 'todos', rotulo: 'Todos' },
            { valor: 'meus', rotulo: 'Meus' },
            { valor: 'outros', rotulo: 'De outras pessoas' },
          ]}
        />
        <Segmentos
          rotulo="Respondidos"
          valor={respondidos}
          aoMudar={setRespondidos}
          segmentos={[
            { valor: 'incluir', rotulo: 'Todos' },
            { valor: 'ocultar', rotulo: 'Em oração' },
            { valor: 'somente', rotulo: 'Respondidos' },
          ]}
        />
      </View>
      {pedidos.isPending ? (
        <Carregando texto="Carregando os pedidos" />
      ) : pedidos.error ? (
        <AvisoDeErro erro={pedidos.error} aoTentarDeNovo={() => void pedidos.refetch()} />
      ) : pedidos.data.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone="oracao"
            titulo={
              respondidos === 'somente' ? 'Nenhum pedido respondido' : 'Nenhum pedido por aqui'
            }
            descricao="Compartilhe um pedido. Ele começa visível só para você, e você decide se a equipe de oração ou a comunidade pode ler."
            acao={{
              titulo: 'Novo pedido de oração',
              icone: 'adicionar',
              aoPressionar: () => router.push('/oracao/novo'),
            }}
          />
        </Cartao>
      ) : (
        pedidos.data.map((p) => (
          <CartaoDoPedido key={p.id} pedido={p} comunidadeId={comunidadeId} />
        ))
      )}
    </>
  )
}
