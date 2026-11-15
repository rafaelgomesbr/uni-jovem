import { LIMITES_DE_PEDIDOS } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { EstadoDoPedidoDeEntrada, MeuPedidoDeEntrada } from '@/servicos/contrato'
import { Avatar } from '@/ui/Avatar'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip, type TomDoChip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { Secao } from '@/ui/Secao'
import { Texto } from '@/ui/Texto'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'

import { useCancelarPedido, useMeusPedidos } from './consultas'

/** Pendente, aceito e "não aprovado": texto e ícone, nunca só a cor. */
const SITUACAO: Readonly<Record<EstadoDoPedidoDeEntrada, { texto: string; tom: TomDoChip }>> = {
  pendente: { texto: 'Pendente', tom: 'alerta' },
  aceito: { texto: 'Aceito', tom: 'sucesso' },
  nao_aprovado: { texto: 'Não aprovado', tom: 'erro' },
}

const ICONE_DA_SITUACAO = {
  pendente: 'relogio',
  aceito: 'confirmado',
  nao_aprovado: 'cancelar',
} as const

const DIA_MS = 24 * 60 * 60 * 1000

/** A frase de cada situação; a da recusa é a do TC-17 ("pode pedir de novo a partir de"). */
function explicacao(p: MeuPedidoDeEntrada): string {
  const { nome } = p.comunidade
  if (p.estado === 'pendente') {
    return `A liderança da ${nome} ainda vai responder. Se ninguém responder em 30 dias, o pedido vence.`
  }
  if (p.estado === 'aceito') return 'Você já faz parte desta comunidade.'
  const base = p.respondidoEm ?? p.criadoEm
  const volta = new Date(
    Date.parse(base) + LIMITES_DE_PEDIDOS.diasDepoisDeRecusa * DIA_MS,
  ).toISOString()
  return `Seu pedido para ${nome} não foi aprovado. Você pode pedir de novo a partir de ${formatarData(volta)}.`
}

/**
 * "Meus pedidos" (ADR 0007): cada pedido com a comunidade, a situação em
 * texto e o que fazer. Pendente pode ser cancelado (com confirmação); aceito
 * abre a comunidade. Quem pediu nunca vê quem decidiu. Sem pedidos, a seção
 * não aparece (Início: seção vazia é omitida).
 */
export function MeusPedidos() {
  const pedidos = useMeusPedidos()
  if (pedidos.isPending) {
    return (
      <Esqueleto rotulo="Carregando seus pedidos">
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (pedidos.error) {
    return (
      <AvisoDeFalha
        erro={pedidos.error}
        titulo="Seus pedidos não carregaram"
        aoTentarDeNovo={() => void pedidos.refetch()}
      />
    )
  }
  // Estado desconhecido (API mais nova) não aparece em vez de quebrar a tela.
  const visiveis = pedidos.data.filter((p) => p.estado in SITUACAO)
  if (visiveis.length === 0) return null
  return (
    <Secao titulo="Meus pedidos">
      <View style={{ gap: ESPACO.e12 }}>
        {visiveis.map((p) => (
          <Pedido key={p.id} pedido={p} />
        ))}
      </View>
    </Secao>
  )
}

function Pedido({ pedido }: { pedido: MeuPedidoDeEntrada }) {
  const { comunidades, trocarComunidade } = useSessao()
  const cancelar = useCancelarPedido()
  const situacao = SITUACAO[pedido.estado]
  const { nome } = pedido.comunidade
  const participa = comunidades.find((c) => c.id === pedido.comunidade.id)

  async function pedirCancelamento() {
    const ok = await confirmar({
      titulo: 'Cancelar o pedido?',
      mensagem: `A liderança de ${nome} deixa de ver o seu pedido. Dá para pedir de novo depois.`,
      confirmar: 'Cancelar pedido',
      destrutivo: true,
    })
    if (ok) cancelar.mutate(pedido.id)
  }

  return (
    <CartaoDeVidro
      opaco
      acoes={
        pedido.estado === 'pendente' ? (
          <View style={{ alignItems: 'flex-start' }}>
            <Botao
              titulo="Cancelar pedido"
              rotuloAcessivel={`Cancelar o pedido para ${nome}`}
              variante="destrutivo"
              carregando={cancelar.isPending}
              aoPressionar={() => void pedirCancelamento()}
            />
          </View>
        ) : pedido.estado === 'aceito' && participa ? (
          <View style={{ alignItems: 'flex-start' }}>
            <Botao
              titulo="Abrir a comunidade"
              rotuloAcessivel={`Abrir ${nome}`}
              variante="secundario"
              aoPressionar={() => void trocarComunidade(participa.id)}
            />
          </View>
        ) : undefined
      }
    >
      <View
        accessible
        accessibilityLabel={`${nome}. ${situacao.texto}. ${explicacao(pedido)}`}
        style={{ flexDirection: 'row', gap: ESPACO.e12, alignItems: 'flex-start' }}
      >
        <Avatar
          nome={nome}
          {...(pedido.comunidade.cor ? { cor: pedido.comunidade.cor } : {})}
          tamanho="linha"
          decorativo
        />
        <View style={{ flex: 1, gap: ESPACO.e4 }}>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: ESPACO.e8 }}
          >
            <Texto variante="tituloItem">{nome}</Texto>
            <Chip
              texto={situacao.texto}
              tom={situacao.tom}
              icone={ICONE_DA_SITUACAO[pedido.estado]}
            />
          </View>
          <Texto variante="meta" cor="textoSuave">
            {[pedido.comunidade.cidade, `pedido em ${formatarData(pedido.criadoEm)}`]
              .filter(Boolean)
              .join(' · ')}
          </Texto>
          <Texto variante="corpo">{explicacao(pedido)}</Texto>
        </View>
      </View>
      {cancelar.error ? (
        <AvisoDeFalha erro={cancelar.error} titulo="O pedido não foi cancelado" />
      ) : null}
    </CartaoDeVidro>
  )
}
