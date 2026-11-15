import type { VisibilidadeDeOracao } from '@uj/dominio'
import { ALTURA, ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { PedidoDeOracao } from '@/servicos/contratoDosModulos'
import { ehErroDaApi } from '@/servicos/erros'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { useConfirmarDescarte, voltarOu } from '@/ui/navegacao'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { SemComunidade } from '../navegacao/SemComunidade'
import {
  autorDoPedido,
  CartaoDoPedido,
  MaisAcoesDoPedido,
  podeDenunciar,
  quantosOrando,
} from './CartaoDoPedido'
import {
  useEditarPedido,
  useEstouOrando,
  useMudarVisibilidade,
  usePedidoDeOracao,
} from './consultas'
import { AVISO_DO_TEXTO, entenderComoEGuardado } from './TelaNovoPedido'
import {
  ampliando,
  explicarVisibilidade,
  leitores,
  NOME_DA_VISIBILIDADE,
  opcoesDeVisibilidade,
  useContagemDeLeitores,
  type Contagem,
} from './visibilidade'

function voltarAosPedidos() {
  voltarOu('/oracao')
}

/**
 * Rota `/oracao/[pedidoId]`: o detalhe do pedido (3.7.1) ou, com
 * `?editar=1` (vindo de "Editar ou mudar quem vê"), a edição do texto e de
 * quem vê, cada um com o seu botão.
 */
export function TelaPedidoDeOracao() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ pedidoId: string; editar?: string }>()
  const pedidoId = parametro(params.pedidoId)
  const editar = parametro(params.editar) === '1'
  const titulo = editar ? 'Editar pedido' : 'Pedido de oração'
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo={titulo}>
        <SemComunidade oQue="o pedido" />
      </Tela>
    )
  }
  if (!pedidoId) {
    return (
      <Tela pilha titulo={titulo}>
        <EstadoVazio
          icone="oracao"
          titulo="Pedido não encontrado"
          descricao="O link pode estar incompleto. Os pedidos que você pode ler estão na lista."
          acao={{ titulo: 'Ver os pedidos', aoPressionar: () => router.replace('/oracao') }}
        />
      </Tela>
    )
  }
  const props = {
    comunidadeId: comunidadeAtiva.id,
    nomeDaComunidade: comunidadeAtiva.nome,
    pedidoId,
  }
  return editar ? <EditarPedido {...props} /> : <DetalheDoPedido {...props} />
}

interface PropsDoPedido {
  comunidadeId: string
  nomeDaComunidade: string
  pedidoId: string
}

/**
 * Detalhe (3.7.1): o cartão do pedido completo, quem está orando e a barra
 * de ação com "Estou orando" e "Mais ações".
 */
function DetalheDoPedido({ comunidadeId, pedidoId }: PropsDoPedido) {
  const pedido = usePedidoDeOracao(comunidadeId, pedidoId)
  const orar = useEstouOrando(comunidadeId)
  const [folhaAberta, setFolhaAberta] = useState(false)
  const p = pedido.data
  const autor = p ? autorDoPedido(p).toLowerCase() : ''

  return (
    <Tela
      pilha
      titulo="Pedido de oração"
      {...(p
        ? {
            barraDeAcao: (
              <BarraDeAcao>
                <Botao
                  titulo={p.orando.euEstouOrando ? 'Orando' : 'Estou orando'}
                  icone={p.orando.euEstouOrando ? 'confirmado' : 'oracao'}
                  variante={p.orando.euEstouOrando ? 'secundario' : 'primario'}
                  tamanho="grande"
                  rotuloAcessivel={
                    p.orando.euEstouOrando
                      ? `Deixar de marcar que estou orando pelo ${autor}`
                      : `Estou orando pelo ${autor}`
                  }
                  carregando={orar.isPending}
                  aoPressionar={() => orar.mutate({ id: p.id, orando: !p.orando.euEstouOrando })}
                />
                {p.minha || podeDenunciar(p) ? (
                  <BotaoIcone
                    icone="maisAcoes"
                    texto="Mais"
                    rotulo={`Mais ações do ${autor}`}
                    lado={ALTURA.controle}
                    aoPressionar={() => setFolhaAberta(true)}
                  />
                ) : null}
              </BarraDeAcao>
            ),
          }
        : {})}
    >
      {pedido.isPending ? (
        <Esqueleto rotulo="Carregando o pedido">
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      ) : pedido.error ? (
        <ErroDaTela
          erro={pedido.error}
          oQue="o pedido"
          aoTentarDeNovo={() => void pedido.refetch()}
        />
      ) : (
        <>
          <CartaoDoPedido pedido={pedido.data} comunidadeId={comunidadeId} completo />
          <QuemEstaOrando pedido={pedido.data} />
          {orar.error ? <AvisoDeFalha erro={orar.error} /> : null}
          <MaisAcoesDoPedido
            pedido={pedido.data}
            comunidadeId={comunidadeId}
            aberta={folhaAberta}
            aoFechar={() => setFolhaAberta(false)}
            aoExcluir={voltarAosPedidos}
            aoBloquear={voltarAosPedidos}
          />
        </>
      )}
    </Tela>
  )
}

/** Quem está orando: os nomes que a API manda; sem nomes (pedido privado), só a contagem. */
function QuemEstaOrando({ pedido }: { pedido: PedidoDeOracao }) {
  const { pessoas, total } = pedido.orando
  return (
    <Secao titulo="Quem está orando">
      {pessoas.length === 0 ? (
        <Texto variante="corpo" cor="textoSuave">
          {total === 0 ? 'Ninguém marcou que está orando ainda.' : `${quantosOrando(pedido)}.`}
        </Texto>
      ) : (
        <CartaoDeVidro lista>
          <Lista>
            {pessoas.map((nome, i) => (
              <LinhaDeLista key={`${nome}-${i}`} avatar={{ nome }} titulo={nome} />
            ))}
          </Lista>
        </CartaoDeVidro>
      )}
    </Secao>
  )
}

/** Edição: só de quem escreveu. Texto e quem vê se salvam separados. */
function EditarPedido(props: PropsDoPedido) {
  const pedido = usePedidoDeOracao(props.comunidadeId, props.pedidoId)
  const contagem = useContagemDeLeitores(props.comunidadeId)
  return (
    <Tela pilha titulo="Editar pedido">
      {pedido.isPending ? (
        <Esqueleto rotulo="Carregando o pedido">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : pedido.error ? (
        <ErroDaTela
          erro={pedido.error}
          oQue="o pedido"
          aoTentarDeNovo={() => void pedido.refetch()}
        />
      ) : !pedido.data.minha ? (
        <Aviso tipo="alerta" titulo="Só quem escreveu altera">
          Este pedido não é seu. Você pode marcar que está orando na lista de pedidos.
        </Aviso>
      ) : (
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
      )}
    </Tela>
  )
}

function EditarTexto({ comunidadeId, pedido }: { comunidadeId: string; pedido: PedidoDeOracao }) {
  const [texto, setTexto] = useState(pedido.texto ?? '')
  const editar = useEditarPedido(comunidadeId)
  const mudou = texto.trim() !== (pedido.texto ?? '').trim()
  // Texto mudado e não salvo: sair pergunta antes (A5). Nada vai para o aparelho.
  useConfirmarDescarte(mudou)
  return (
    <CartaoDeVidro
      sobrancelha="Texto"
      opaco
      intervalo={ESPACO.e16}
      acoes={
        <Botao
          titulo="Salvar texto"
          variante="secundario"
          desabilitado={!mudou || !texto.trim()}
          motivo={texto.trim() ? 'Altere o texto para salvar.' : 'O pedido não pode ficar vazio.'}
          carregando={editar.isPending}
          aoPressionar={() =>
            editar.mutate(
              { id: pedido.id, texto: texto.trim(), versao: pedido.versao },
              { onSuccess: () => mostrarToast({ texto: 'Texto salvo.' }) },
            )
          }
        />
      }
    >
      <Campo
        rotulo="Seu pedido"
        value={texto}
        onChangeText={setTexto}
        multiline
        maxLength={2000}
        mostrarContador
      />
      <Aviso
        tipo="info"
        acao={{ titulo: 'Entenda como é guardado', aoPressionar: entenderComoEGuardado }}
      >
        <Texto variante="legenda">{AVISO_DO_TEXTO}</Texto>
      </Aviso>
      {editar.error ? <AvisoDeFalha erro={editar.error} /> : null}
    </CartaoDeVidro>
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
    mudar.mutate(
      { id: pedido.id, de, para: escolhida },
      {
        onSuccess: () =>
          mostrarToast({ texto: `Agora quem vê: ${NOME_DA_VISIBILIDADE[escolhida]}.` }),
      },
    )
  }

  return (
    <CartaoDeVidro
      sobrancelha="Quem vê"
      opaco
      intervalo={ESPACO.e16}
      acoes={
        <Botao
          titulo="Mudar quem vê"
          variante="secundario"
          desabilitado={!mudou}
          motivo="Escolha um público diferente do atual."
          carregando={mudar.isPending}
          aoPressionar={() => void aplicar()}
        />
      }
    >
      <Texto variante="corpo">
        Agora: {NOME_DA_VISIBILIDADE[pedido.visibilidade]}. {pedido.quemVe}
      </Texto>
      <ListaDeOpcoes
        rotulo="Escolha o novo público"
        opcoes={opcoesDeVisibilidade(contagem)}
        valor={escolhida}
        aoMudar={setEscolhida}
      />
      {mudou ? (
        <Texto variante="legenda" cor="textoSuave">
          {explicarVisibilidade(escolhida, nomeDaComunidade, contagem)}
        </Texto>
      ) : null}
      {ehErroDaApi(mudar.error, 'visibilidade_mudou') ? (
        <AvisoDeFalha
          erro={mudar.error}
          titulo="Quem vê já tinha mudado"
          aoTentarDeNovo={recarregar}
        />
      ) : mudar.error ? (
        <AvisoDeFalha erro={mudar.error} />
      ) : null}
    </CartaoDeVidro>
  )
}
