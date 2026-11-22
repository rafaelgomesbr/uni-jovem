import { VISIBILIDADE_PADRAO_DE_ORACAO, type VisibilidadeDeOracao } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { origemPublica } from '@/servicos/enderecos'
import { mensagemDoErro } from '@/servicos/erros'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela } from '@/ui/FolhaNaTela'
import { abrirLink } from '@/utilidades/compartilhar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Interruptor } from '@/ui/Interruptor'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { useConfirmarDescarte, useTravaDeEnvio, voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { SemComunidade } from '../navegacao/SemComunidade'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { useCriarPedido } from './consultas'
import {
  explicarVisibilidade,
  opcoesDeVisibilidade,
  quemVaiVer,
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
      <Tela pilha titulo="Pedir oração">
        <SemComunidade oQue="o novo pedido" />
      </Tela>
    )
  }
  return (
    <FormularioDoPedido comunidadeId={comunidadeAtiva.id} nomeDaComunidade={comunidadeAtiva.nome} />
  )
}

/**
 * Novo pedido (D70, fluxo h): o texto, "Quem vai ver" em lista de opções com a contagem de
 * leitores, o interruptor "Publicar como anônimo" (desligado por padrão, e só quando mais
 * alguém pode ler) e "Publicar pedido". Com "Somente eu" publica direto. Com mais leitores,
 * abre a folha de resumo ("Vai aparecer como Anônimo para 15 pessoas."), o único passo de
 * confirmação: é decisão de privacidade (D55, D62). O texto nunca vai para o armazenamento
 * do aparelho: vive só nesta tela, e sem internet o botão diz isso em vez de prometer
 * guardar.
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
  const [resumoAberto, setResumoAberto] = useState(false)
  const online = useEstaOnline()
  const contagem = useContagemDeLeitores(comunidadeId)
  const criar = useCriarPedido(comunidadeId)
  const trava = useTravaDeEnvio()
  const liberar = useConfirmarDescarte(!!texto.trim())
  // Anônimo só faz sentido se alguém mais pode ler: com "Somente eu", o interruptor nem aparece.
  const anonimoPossivel = visibilidade !== 'somente_eu'
  const anonimoDeFato = anonimoPossivel && anonimo

  function publicar() {
    if (!texto.trim()) {
      setErro('Escreva o seu pedido.')
      return
    }
    setErro(null)
    // "Somente eu": ninguém mais lê, não há o que resumir.
    if (visibilidade === 'somente_eu') enviar()
    else setResumoAberto(true)
  }

  function enviar() {
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
      titulo="Pedir oração"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Publicar pedido"
            tamanho="grande"
            carregando={criar.isPending}
            desabilitado={!online}
            {...(online
              ? {}
              : {
                  motivo: 'Precisa de internet para publicar. O texto não é guardado no aparelho.',
                })}
            aoPressionar={publicar}
          />
        </BarraDeAcao>
      }
    >
      <Cartao variante="plano">
        <Campo
          rotulo="Seu pedido"
          value={texto}
          onChangeText={setTexto}
          erro={erro}
          leitura
          maxLength={2000}
          mostrarContador
        />
      </Cartao>
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
        <Cartao variante="plano">
          <Interruptor
            rotulo="Publicar como anônimo"
            ligado={anonimo}
            aoMudar={setAnonimo}
            descricao={estadoDoAnonimato(anonimo)}
          />
        </Cartao>
      ) : null}
      {criar.error ? (
        <AvisoDeFalha
          erro={criar.error}
          titulo="Não deu para publicar"
          mensagem={`${mensagemDoErro(criar.error)} O texto está só nesta tela: não é guardado no aparelho, então tente de novo antes de sair.`}
        />
      ) : null}
      <ResumoDaPublicacao
        aberta={resumoAberto}
        aoFechar={() => setResumoAberto(false)}
        resumo={quemVaiVer(visibilidade, anonimoDeFato, contagem)}
        anonimo={anonimoDeFato}
        aoPublicar={() => {
          setResumoAberto(false)
          enviar()
        }}
      />
    </Tela>
  )
}

/**
 * Folha de resumo, uma vez, antes de publicar para mais gente: a frase de quem vai ver, o
 * aviso de privacidade em palavras comuns (conteúdo legal mantido, D62) e o botão com o
 * verbo ("Publicar como Anônimo"). "Voltar" fecha sem publicar; o texto continua na tela.
 */
function ResumoDaPublicacao({
  aberta,
  aoFechar,
  resumo,
  anonimo,
  aoPublicar,
}: {
  aberta: boolean
  aoFechar: () => void
  resumo: string
  anonimo: boolean
  aoPublicar: () => void
}) {
  return (
    <FolhaNaTela aberta={aberta} titulo="Antes de publicar" aoFechar={aoFechar}>
      <View style={{ gap: ESPACO.e16 }}>
        <Texto variante="tituloItem">{resumo}</Texto>
        <Texto variante="corpo" cor="textoSuave">
          {AVISO_DO_TEXTO}
        </Texto>
        <Botao
          titulo="Entenda como é guardado"
          variante="terciario"
          alinhado
          aoPressionar={entenderComoEGuardado}
        />
        <ParDeBotoes>
          <Botao titulo="Voltar" variante="secundario" aoPressionar={aoFechar} />
          <Botao
            titulo={anonimo ? 'Publicar como Anônimo' : 'Publicar com meu nome'}
            aoPressionar={aoPublicar}
          />
        </ParDeBotoes>
      </View>
    </FolhaNaTela>
  )
}
