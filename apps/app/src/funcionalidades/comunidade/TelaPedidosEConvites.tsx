import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { Aviso } from '@/ui/Aviso'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { parametro } from '@/utilidades/parametros'

import { SemComunidade } from '../navegacao/SemComunidade'
import { useConvites, usePedidosDeEntrada } from './consultas'
import { usePode } from './permissoes'
import { SecaoConvites } from './SecaoConvites'
import { SecaoPedidos } from './SecaoPedidos'

type Aba = 'pedidos' | 'convites'

function abaDoParametro(valor: string | null): Aba | null {
  return valor === 'pedidos' || valor === 'convites' ? valor : null
}

/**
 * Rota `/pedidos-de-entrada`: "Pedidos de entrada e convites", dentro da Organização do
 * mural (D70). Dois segmentos, como eram na aba: Pedidos (administração e organizador,
 * ADR 0007) e Convites (administração). O toque na notificação de pedido chega aqui com
 * `?segmento=pedidos`.
 */
export function TelaPedidosEConvites() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Pedidos de entrada">
        <SemComunidade oQue="os pedidos de entrada" />
      </Tela>
    )
  }
  return <Conteudo comunidade={comunidadeAtiva} />
}

function Conteudo({
  comunidade,
}: {
  comunidade: NonNullable<ReturnType<typeof useSessao>['comunidadeAtiva']>
}) {
  const pode = usePode()
  const verPedidos = pode('pedido_entrada', 'ler')
  const verConvites = pode('convite', 'listar')
  const pedidos = usePedidosDeEntrada(comunidade.id, verPedidos)
  const convites = useConvites(comunidade.id, verConvites)
  const segmento = abaDoParametro(parametro(useLocalSearchParams<{ segmento?: string }>().segmento))
  const [aba, setAba] = useState<Aba>(segmento ?? (verPedidos ? 'pedidos' : 'convites'))
  const ativa = comunidade.estado === 'ativa'
  const podeConvidar = pode('convite', 'criar')
  if (!verPedidos && !verConvites) {
    return (
      <Tela pilha titulo="Pedidos de entrada">
        <Aviso tipo="alerta" titulo="Pedidos de entrada são da organização">
          Quem organiza a comunidade decide quem entra. Se alguém quer entrar, peça à liderança.
        </Aviso>
      </Tela>
    )
  }

  const pendentes = pedidos.data?.length ?? 0
  const validos = convites.data?.filter((c) => c.situacao === 'valido').length ?? 0
  const segmentos = [
    ...(verPedidos
      ? [{ valor: 'pedidos' as const, rotulo: pendentes ? `Pedidos (${pendentes})` : 'Pedidos' }]
      : []),
    ...(verConvites
      ? [{ valor: 'convites' as const, rotulo: validos ? `Convites (${validos})` : 'Convites' }]
      : []),
  ]
  const visivel: Aba =
    (aba === 'pedidos' && !verPedidos) || (aba === 'convites' && !verConvites)
      ? verPedidos
        ? 'pedidos'
        : 'convites'
      : aba

  return (
    <Tela
      pilha
      titulo="Pedidos de entrada"
      descricao="Quem pediu para entrar e os convites que você criou."
    >
      {segmentos.length > 1 ? (
        <Segmentos
          rotulo="Pedidos de entrada e convites"
          valor={visivel}
          aoMudar={setAba}
          segmentos={segmentos}
        />
      ) : null}
      {visivel === 'convites' ? (
        <SecaoConvites comunidade={comunidade} podeAlterar={ativa && podeConvidar} />
      ) : (
        <SecaoPedidos comunidade={comunidade} pedidos={pedidos} podeAlterar={ativa} />
      )}
    </Tela>
  )
}
