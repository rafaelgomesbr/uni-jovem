import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { ComunidadeDoVinculo, PedidoDeEntrada } from '@/servicos/contrato'
import { Avatar } from '@/ui/Avatar'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'

import { useDecidirPedido, type usePedidosDeEntrada } from './consultas'
import { usePode } from './permissoes'

/**
 * Equipe › Pedidos (ADR 0007, admin e organizador): quem pediu para entrar
 * pelo código ou pela busca, com o recado. "Aceitar" cria o vínculo de
 * membro na hora; "Recusar" pergunta antes, porque a pessoa só pode pedir de
 * novo depois de 30 dias.
 */
export function SecaoPedidos({
  comunidade,
  pedidos,
  podeAlterar,
}: {
  comunidade: ComunidadeDoVinculo
  pedidos: ReturnType<typeof usePedidosDeEntrada>
  podeAlterar: boolean
}) {
  const pode = usePode()
  const decidir = useDecidirPedido(comunidade.id)
  const podeDecidir = podeAlterar && pode('pedido_entrada', 'decidir')

  if (pedidos.isPending) {
    return (
      <Esqueleto rotulo="Carregando os pedidos">
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (pedidos.error) {
    return (
      <ErroDaTela
        erro={pedidos.error}
        titulo="Os pedidos não carregaram"
        aoTentarDeNovo={() => void pedidos.refetch()}
      />
    )
  }
  if (pedidos.data.length === 0) {
    const admin = pode('comunidade', 'ver_codigo')
    return (
      <EstadoVazio
        icone="convidar"
        titulo="Nenhum pedido esperando"
        descricao="Quando alguém usar o código ou pedir pela busca, o pedido aparece aqui."
        acao={
          admin
            ? {
                titulo: 'Ver o código',
                icone: 'qr',
                variante: 'secundario',
                aoPressionar: () => router.push('/codigo-da-comunidade'),
              }
            : {
                titulo: 'Ver a agenda',
                variante: 'secundario',
                aoPressionar: () => router.push('/agenda'),
              }
        }
      />
    )
  }

  async function recusar(p: PedidoDeEntrada) {
    const ok = await confirmar({
      titulo: `Recusar o pedido de ${p.nome}?`,
      mensagem: 'A pessoa vê "Não aprovado" e só pode pedir de novo daqui a 30 dias.',
      confirmar: 'Recusar pedido',
      destrutivo: true,
    })
    if (!ok) return
    decidir.mutate(
      { pedidoId: p.id, decisao: 'recusar' },
      { onSuccess: () => mostrarToast({ texto: `Pedido de ${p.nome} recusado.` }) },
    )
  }

  function aceitar(p: PedidoDeEntrada) {
    decidir.mutate(
      { pedidoId: p.id, decisao: 'aceitar' },
      { onSuccess: () => mostrarToast({ texto: `${p.nome} entrou como membro.` }) },
    )
  }

  return (
    <View style={{ gap: ESPACO.e12 }}>
      {decidir.error ? <AvisoDeFalha erro={decidir.error} titulo="O pedido não mudou" /> : null}
      {pedidos.data.map((p) => {
        const ocupado = decidir.isPending && decidir.variables.pedidoId === p.id
        return (
          <CartaoDeVidro
            key={p.id}
            opaco
            {...(podeDecidir
              ? {
                  acoes: (
                    <ParDeBotoes>
                      <Botao
                        titulo="Recusar"
                        rotuloAcessivel={`Recusar o pedido de ${p.nome}`}
                        variante="secundario"
                        desabilitado={decidir.isPending}
                        carregando={ocupado && decidir.variables?.decisao === 'recusar'}
                        aoPressionar={() => void recusar(p)}
                      />
                      <Botao
                        titulo="Aceitar"
                        rotuloAcessivel={`Aceitar o pedido de ${p.nome}`}
                        variante="secundario"
                        desabilitado={decidir.isPending}
                        carregando={ocupado && decidir.variables?.decisao === 'aceitar'}
                        aoPressionar={() => aceitar(p)}
                      />
                    </ParDeBotoes>
                  ),
                }
              : {})}
          >
            <View style={{ flexDirection: 'row', gap: ESPACO.e12, alignItems: 'flex-start' }}>
              <Avatar nome={p.nome} avatar={p.avatar ?? null} tamanho="linha" decorativo />
              <View style={{ flex: 1, gap: ESPACO.e4 }}>
                <Texto variante="tituloItem">{p.nome}</Texto>
                <Texto variante="meta" cor="textoSuave">
                  {[
                    `Pediu em ${formatarData(p.criadoEm)}`,
                    p.origem === 'codigo'
                      ? 'pelo código'
                      : p.origem === 'busca'
                        ? 'pela busca'
                        : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Texto>
                {p.mensagem ? (
                  <Texto variante="corpo" accessibilityLabel={`Recado: ${p.mensagem}`}>
                    {`“${p.mensagem}”`}
                  </Texto>
                ) : (
                  <Texto variante="corpo" cor="textoSuave">
                    Sem recado.
                  </Texto>
                )}
              </View>
            </View>
          </CartaoDeVidro>
        )
      })}
    </View>
  )
}
