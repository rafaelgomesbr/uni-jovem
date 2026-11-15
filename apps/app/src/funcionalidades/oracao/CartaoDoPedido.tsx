import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { PedidoDeOracao } from '@/servicos/contratoDosModulos'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { Avatar, PilhaDeAvatares } from '@/ui/Avatar'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { BotaoDenunciar } from '../denuncias/BotaoDenunciar'
import { useEstouOrando, useExcluirPedido, useMarcarRespondido } from './consultas'
import { NOME_DA_VISIBILIDADE } from './visibilidade'

function orandoTexto(p: PedidoDeOracao): string {
  const { total, euEstouOrando } = p.orando
  if (total === 0) return 'Ninguém marcou que está orando ainda.'
  if (euEstouOrando && total === 1) return 'Você está orando por este pedido.'
  if (euEstouOrando)
    return `Você e mais ${total - 1} ${total === 2 ? 'pessoa estão' : 'pessoas estão'} orando.`
  return `${total} ${total === 1 ? 'pessoa está orando' : 'pessoas estão orando'}.`
}

export function CartaoDoPedido({
  pedido,
  comunidadeId,
}: {
  pedido: PedidoDeOracao
  comunidadeId: string
}) {
  const orar = useEstouOrando(comunidadeId)
  const respondido = useMarcarRespondido(comunidadeId)
  const excluir = useExcluirPedido(comunidadeId)
  const { conta } = useSessao()
  const autor = pedido.minha ? 'Seu pedido' : `Pedido de ${pedido.autorNome ?? 'uma pessoa'}`
  const erro = orar.error ?? respondido.error ?? excluir.error

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: 'Excluir este pedido?',
      mensagem: 'O pedido some para todos que podiam ler. Não dá para desfazer.',
      confirmar: 'Excluir pedido',
      destrutivo: true,
    })
    if (ok) excluir.mutate(pedido.id)
  }

  return (
    <Cartao>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x3 }}>
        <Avatar
          nome={pedido.minha ? (conta?.nome ?? 'Você') : (pedido.autorNome ?? 'Uma pessoa')}
          {...(pedido.minha ? { avatar: conta?.avatar ?? null } : {})}
          tamanho="M"
          decorativo
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Texto variante="corpoForte">{autor}</Texto>
          <Texto variante="apoio" cor="textoSuave" style={{ fontSize: 13 }}>
            {formatarData(pedido.criadoEm)}
          </Texto>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        <Selo texto={`Quem vê: ${NOME_DA_VISIBILIDADE[pedido.visibilidade]}`} cor="destaque" />
        {pedido.respondidoEm ? <Selo texto="Respondido" cor="sucesso" /> : null}
      </View>
      <Texto variante="leitura">
        {pedido.texto ?? 'Não foi possível mostrar o texto deste pedido.'}
      </Texto>
      {pedido.minha ? (
        <Texto variante="apoio" cor="textoSuave">
          {pedido.quemVe}
        </Texto>
      ) : null}
      {/* Quem está orando: avatares (decorativos) e a frase que diz quantos. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x2 }}>
        <PilhaDeAvatares nomes={pedido.orando.pessoas} />
        <Texto variante="apoio" cor="textoSuave" style={{ flex: 1 }}>
          {orandoTexto(pedido)}
        </Texto>
      </View>
      {erro ? <AvisoDeErro erro={erro} /> : null}
      <View style={{ gap: ESPACO.x2 }}>
        <Botao
          titulo={
            pedido.orando.euEstouOrando ? 'Deixar de marcar que estou orando' : 'Estou orando'
          }
          icone="oracao"
          variante={pedido.orando.euEstouOrando ? 'secundario' : 'primario'}
          rotuloAcessivel={
            pedido.orando.euEstouOrando
              ? `Deixar de marcar que estou orando pelo ${autor.toLowerCase()}`
              : `Estou orando pelo ${autor.toLowerCase()}`
          }
          carregando={orar.isPending}
          aoPressionar={() => orar.mutate({ id: pedido.id, orando: !pedido.orando.euEstouOrando })}
        />
        {pedido.minha ? (
          <>
            <Botao
              titulo={pedido.respondidoEm ? 'Desmarcar respondido' : 'Marcar como respondido'}
              icone="confirmado"
              variante="secundario"
              carregando={respondido.isPending}
              aoPressionar={() =>
                respondido.mutate({ id: pedido.id, respondido: !pedido.respondidoEm })
              }
            />
            <Botao
              titulo="Editar ou mudar quem vê"
              icone="editar"
              variante="secundario"
              aoPressionar={() =>
                router.push({ pathname: '/oracao/[pedidoId]', params: { pedidoId: pedido.id } })
              }
            />
            <Botao
              titulo="Excluir"
              icone="excluir"
              variante="perigo"
              carregando={excluir.isPending}
              aoPressionar={() => void pedirExclusao()}
            />
          </>
        ) : null}
        {!pedido.minha && pedido.visibilidade === 'comunidade' ? (
          <BotaoDenunciar
            comunidadeId={comunidadeId}
            recursoTipo="pedido_oracao"
            recursoId={pedido.id}
            descricao={`o ${autor.toLowerCase()}`}
          />
        ) : null}
      </View>
    </Cartao>
  )
}
