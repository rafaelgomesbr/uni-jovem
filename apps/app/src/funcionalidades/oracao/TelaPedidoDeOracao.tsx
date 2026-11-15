import type { VisibilidadeDeOracao } from '@uj/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import type { PedidoDeOracao } from '@/servicos/contratoDosModulos'
import { ehErroDaApi } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Texto } from '@/ui/Texto'

import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { useEditarPedido, useMudarVisibilidade, usePedidoDeOracao } from './consultas'
import { AVISO_DO_TEXTO } from './TelaNovoPedido'
import {
  ampliando,
  explicarVisibilidade,
  leitores,
  NOME_DA_VISIBILIDADE,
  opcoesDeVisibilidade,
  useContagemDeLeitores,
  type Contagem,
} from './visibilidade'

/** Rota `/oracao/[pedidoId]`: editar o texto e mudar quem vê, cada um com o seu botão. */
export function TelaPedidoDeOracao() {
  const pedidoId = parametro(useLocalSearchParams<{ pedidoId: string }>().pedidoId)
  return (
    <TelaDaComunidade oQue="o pedido" titulo="Seu pedido de oração">
      {(c) =>
        pedidoId ? (
          <Pedido comunidadeId={c.id} nomeDaComunidade={c.nome} pedidoId={pedidoId} />
        ) : null
      }
    </TelaDaComunidade>
  )
}

function Pedido(props: { comunidadeId: string; nomeDaComunidade: string; pedidoId: string }) {
  const pedido = usePedidoDeOracao(props.comunidadeId, props.pedidoId)
  const contagem = useContagemDeLeitores(props.comunidadeId)
  if (pedido.isPending) return <Carregando texto="Carregando o pedido" />
  if (pedido.error) {
    return <AvisoDeErro erro={pedido.error} aoTentarDeNovo={() => void pedido.refetch()} />
  }
  if (!pedido.data.minha) {
    return (
      <Aviso tipo="alerta" titulo="Só quem escreveu altera">
        Este pedido não é seu. Você pode marcar que está orando na lista de pedidos.
      </Aviso>
    )
  }
  return (
    <>
      {/* A chave recria o formulário quando o servidor manda uma versão nova. */}
      <EditarTexto key={`t${pedido.data.versao}`} {...props} pedido={pedido.data} />
      <MudarVisibilidade
        key={`v${pedido.data.visibilidade}`}
        {...props}
        pedido={pedido.data}
        contagem={contagem}
        recarregar={() => void pedido.refetch()}
      />
    </>
  )
}

function EditarTexto({ comunidadeId, pedido }: { comunidadeId: string; pedido: PedidoDeOracao }) {
  const [texto, setTexto] = useState(pedido.texto ?? '')
  const editar = useEditarPedido(comunidadeId)
  const mudou = texto.trim() !== (pedido.texto ?? '').trim()
  return (
    <Cartao titulo="Texto" icone="editar">
      <Campo rotulo="Seu pedido" value={texto} onChangeText={setTexto} multiline maxLength={2000} />
      <Texto variante="apoio" cor="textoSuave">
        {AVISO_DO_TEXTO}
      </Texto>
      {editar.error ? <AvisoDeErro erro={editar.error} /> : null}
      {editar.isSuccess && !mudou ? (
        <Texto variante="apoio" cor="sucesso" accessibilityLiveRegion="polite">
          Texto salvo.
        </Texto>
      ) : null}
      <Botao
        titulo="Salvar texto"
        variante="secundario"
        desabilitado={!mudou || !texto.trim()}
        motivo={texto.trim() ? 'Altere o texto para salvar.' : 'O pedido não pode ficar vazio.'}
        carregando={editar.isPending}
        aoPressionar={() =>
          editar.mutate({ id: pedido.id, texto: texto.trim(), versao: pedido.versao })
        }
      />
    </Cartao>
  )
}

function MudarVisibilidade({
  comunidadeId,
  nomeDaComunidade,
  pedido,
  contagem,
  recarregar,
}: {
  comunidadeId: string
  nomeDaComunidade: string
  pedido: PedidoDeOracao
  contagem: Contagem
  recarregar: () => void
}) {
  const [escolhida, setEscolhida] = useState<VisibilidadeDeOracao>(pedido.visibilidade)
  const mudar = useMudarVisibilidade(comunidadeId)
  const mudou = escolhida !== pedido.visibilidade

  /** TC-07.v1: antes e depois, e o que muda para quem já leu. */
  async function aplicar() {
    const de = pedido.visibilidade
    const ok = await confirmar({
      titulo: `Mudar a visibilidade para ${NOME_DA_VISIBILIDADE[escolhida]}?`,
      mensagem: [
        `Antes: ${explicarVisibilidade(de, nomeDaComunidade, contagem)}`,
        `Depois: ${explicarVisibilidade(escolhida, nomeDaComunidade, contagem)}`,
        ampliando(de, escolhida)
          ? `Mais pessoas vão poder ler este pedido. ${leitores(escolhida, contagem)}`
          : 'Quem já leu pode ter lido antes desta mudança.',
      ].join('\n\n'),
      confirmar: 'Mudar',
    })
    if (!ok) return
    mudar.mutate({ id: pedido.id, de, para: escolhida })
  }

  return (
    <Cartao titulo="Quem vê" icone="mostrar">
      <Texto>
        Agora: {NOME_DA_VISIBILIDADE[pedido.visibilidade]}. {pedido.quemVe}
      </Texto>
      <GrupoDeOpcoes
        rotulo="Escolha o novo público"
        opcoes={opcoesDeVisibilidade(nomeDaComunidade, contagem)}
        valor={escolhida}
        aoMudar={setEscolhida}
      />
      {ehErroDaApi(mudar.error, 'visibilidade_mudou') ? (
        <AvisoDeErro
          erro={mudar.error}
          titulo="Quem vê já tinha mudado"
          aoTentarDeNovo={recarregar}
        />
      ) : mudar.error ? (
        <AvisoDeErro erro={mudar.error} />
      ) : null}
      <Botao
        titulo="Mudar quem vê"
        variante="secundario"
        desabilitado={!mudou}
        motivo="Escolha um público diferente do atual."
        carregando={mudar.isPending}
        aoPressionar={() => void aplicar()}
      />
      <Botao titulo="Voltar aos pedidos" variante="discreto" aoPressionar={() => router.back()} />
    </Cartao>
  )
}
