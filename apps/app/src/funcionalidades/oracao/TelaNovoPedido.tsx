import { VISIBILIDADE_PADRAO_DE_ORACAO, type VisibilidadeDeOracao } from '@uj/dominio'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { origemPublica } from '@/servicos/enderecos'
import { AvisoDeFalha } from '@/ui/Falha'
import { abrirLink } from '@/utilidades/compartilhar'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Interruptor } from '@/ui/Interruptor'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { useConfirmarDescarte, useTravaDeEnvio, voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { SemComunidade } from '../navegacao/SemComunidade'
import { useCriarPedido } from './consultas'
import {
  explicarVisibilidade,
  leitores,
  opcoesDeVisibilidade,
  useContagemDeLeitores,
} from './visibilidade'

/**
 * Aviso fixo junto do campo de texto (TC-06.v2, D62). Em palavras comuns e sem
 * perder a verdade: o texto é guardado cifrado, mas quem administra o servidor
 * tem capacidade técnica de ler (não é criptografia de ponta a ponta). Texto
 * legal novo: a revisão jurídica está na PH-11. "Entenda como é guardado"
 * continua ao lado, com o detalhe completo.
 */
export const AVISO_DO_TEXTO =
  'Só quem você escolher vê o pedido. Ele é guardado em código, mas quem cuida do servidor consegue lê-lo, se precisar. Evite nomes e doenças de outras pessoas sem a permissão delas.'

/**
 * O estado do interruptor em texto (o sinal além da cor): UMA frase só, a do
 * estado atual (D62). Antes eram duas ao mesmo tempo e pareciam se contradizer.
 * No anonimato, só a autora vê o nome dela; a comunidade e a liderança, não.
 */
export function estadoDoAnonimato(anonimo: boolean): string {
  return anonimo
    ? 'Ligado: o pedido sai como "Anônimo". Seu nome não aparece para ninguém da comunidade, nem para a liderança; só você sabe que foi você.'
    : 'Desligado: seu nome aparece junto do pedido, para quem puder lê-lo.'
}

/** "Entenda como é guardado": a seção de oração da política de privacidade. */
export function entenderComoEGuardado() {
  void abrirLink(`${origemPublica()}/privacidade#oracao`)
}

/** Rota `/oracao/novo`. */
export function TelaNovoPedido() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Novo pedido">
        <SemComunidade oQue="o novo pedido" />
      </Tela>
    )
  }
  return (
    <FormularioDoPedido comunidadeId={comunidadeAtiva.id} nomeDaComunidade={comunidadeAtiva.nome} />
  )
}

/**
 * Novo pedido (3.7.1): o texto em multilinha com o contador, o aviso de
 * privacidade com "Entenda como é guardado", "Quem vai ver" em lista de
 * opções com a contagem de leitores (e, abaixo, quem vê por extenso, antes
 * de publicar), o interruptor "Publicar como anônimo" (desligado por padrão,
 * e só quando mais alguém pode ler o pedido) e a barra de ação com "Publicar pedido". Ampliar o público pede a
 * confirmação nativa.
 */
function FormularioDoPedido({
  comunidadeId,
  nomeDaComunidade,
}: {
  comunidadeId: string
  nomeDaComunidade: string
}) {
  // Texto só no estado da tela: sair dela descarta, nada vai para o aparelho.
  const [texto, setTexto] = useState('')
  const [visibilidade, setVisibilidade] = useState<VisibilidadeDeOracao>(
    VISIBILIDADE_PADRAO_DE_ORACAO,
  )
  const [anonimo, setAnonimo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const contagem = useContagemDeLeitores(comunidadeId)
  const criar = useCriarPedido(comunidadeId)
  const trava = useTravaDeEnvio()
  const liberar = useConfirmarDescarte(!!texto.trim())
  // Anônimo só faz sentido se alguém mais pode ler: com "Somente eu", o interruptor nem aparece.
  const anonimoPossivel = visibilidade !== 'somente_eu'
  const anonimoDeFato = anonimoPossivel && anonimo

  async function publicar() {
    if (!texto.trim()) {
      setErro('Escreva o seu pedido.')
      return
    }
    setErro(null)
    if (visibilidade !== 'somente_eu') {
      const ok = await confirmar({
        titulo:
          visibilidade === 'comunidade'
            ? 'Publicar para toda a comunidade?'
            : 'Publicar para a equipe de oração?',
        mensagem: anonimoDeFato
          ? `${leitores(visibilidade, contagem)} Seu nome não aparece: o pedido sai como "Anônimo".`
          : leitores(visibilidade, contagem),
        confirmar: 'Publicar',
      })
      if (!ok) return
    }
    if (!trava.pegar()) return
    criar.mutate(
      { texto: texto.trim(), visibilidade, anonimo: anonimoDeFato },
      {
        onSuccess: () => {
          setTexto('')
          liberar()
          voltarOu('/oracao')
        },
        onError: trava.soltar,
      },
    )
  }

  return (
    <Tela
      pilha
      titulo="Novo pedido"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Publicar pedido"
            tamanho="grande"
            carregando={criar.isPending}
            aoPressionar={() => void publicar()}
          />
        </BarraDeAcao>
      }
    >
      <CartaoDeVidro opaco>
        <Campo
          rotulo="Seu pedido"
          value={texto}
          onChangeText={setTexto}
          erro={erro}
          leitura
          maxLength={2000}
          mostrarContador
        />
      </CartaoDeVidro>
      <Aviso
        tipo="info"
        acao={{ titulo: 'Entenda como é guardado', aoPressionar: entenderComoEGuardado }}
      >
        <Texto variante="legenda">{AVISO_DO_TEXTO}</Texto>
      </Aviso>
      <ListaDeOpcoes
        rotulo="Quem vai ver"
        opcoes={opcoesDeVisibilidade(contagem)}
        valor={visibilidade}
        aoMudar={setVisibilidade}
      />
      {/* Quem vê, por extenso, antes de publicar; anunciado quando a escolha muda. */}
      <TextoAnunciado soMudancas variante="legenda" cor="textoSuave">
        {`${explicarVisibilidade(visibilidade, nomeDaComunidade, contagem)} Você pode mudar isso depois, sempre com confirmação.`}
      </TextoAnunciado>
      {anonimoPossivel ? (
        <CartaoDeVidro sobrancelha="Quem vê que foi você" opaco comecaComTitulo>
          <Interruptor
            rotulo="Publicar como anônimo"
            ligado={anonimo}
            aoMudar={setAnonimo}
            descricao={estadoDoAnonimato(anonimo)}
          />
        </CartaoDeVidro>
      ) : null}
      {criar.error ? <AvisoDeFalha erro={criar.error} /> : null}
    </Tela>
  )
}
