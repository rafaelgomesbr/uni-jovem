import { VISIBILIDADE_PADRAO_DE_ORACAO, type VisibilidadeDeOracao } from '@uj/dominio'
import { router } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { origemPublica } from '@/servicos/enderecos'
import { abrirLink } from '@/utilidades/compartilhar'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { AvisoDeFalha } from '../agenda/ErroAoCarregar'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useCriarPedido } from './consultas'
import {
  explicarVisibilidade,
  leitores,
  opcoesDeVisibilidade,
  useContagemDeLeitores,
} from './visibilidade'

/** Aviso fixo junto do campo de texto (TC-06.v1). */
export const AVISO_DO_TEXTO =
  'Escreva só o necessário. Evite nomes e detalhes de saúde de outras pessoas sem a permissão delas. O texto é guardado cifrado, mas não é criptografia de ponta a ponta: quem administra o servidor tem capacidade técnica de ler.'

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
 * de publicar) e a barra de ação com "Publicar pedido". Ampliar o público
 * pede a confirmação nativa.
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
  const [erro, setErro] = useState<string | null>(null)
  const contagem = useContagemDeLeitores(comunidadeId)
  const criar = useCriarPedido(comunidadeId)

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
        mensagem: leitores(visibilidade, contagem),
        confirmar: 'Publicar',
      })
      if (!ok) return
    }
    criar.mutate(
      { texto: texto.trim(), visibilidade },
      {
        onSuccess: () => {
          setTexto('')
          router.back()
        },
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
          multiline
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
      {criar.error ? <AvisoDeFalha erro={criar.error} /> : null}
    </Tela>
  )
}
