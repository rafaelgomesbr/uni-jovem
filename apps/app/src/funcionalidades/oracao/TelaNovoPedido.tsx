import { VISIBILIDADE_PADRAO_DE_ORACAO, type VisibilidadeDeOracao } from '@uj/dominio'
import { router } from 'expo-router'
import { useState } from 'react'

import { origemPublica } from '@/servicos/enderecos'
import { abrirLink } from '@/utilidades/compartilhar'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Texto } from '@/ui/Texto'

import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { useCriarPedido } from './consultas'
import {
  explicarVisibilidade,
  leitores,
  opcoesDeVisibilidade,
  useContagemDeLeitores,
} from './visibilidade'

/** Aviso fixo abaixo do campo de texto (TC-06.v1). */
export const AVISO_DO_TEXTO =
  'Escreva só o necessário. Evite nomes e detalhes de saúde de outras pessoas sem a permissão delas. O texto é guardado cifrado, mas não é criptografia de ponta a ponta: quem administra o servidor tem capacidade técnica de ler.'

/** Rota `/oracao/novo`. */
export function TelaNovoPedido() {
  return (
    <TelaDaComunidade oQue="o novo pedido" titulo="Novo pedido de oração">
      {(c) => <FormularioDoPedido comunidadeId={c.id} nomeDaComunidade={c.nome} />}
    </TelaDaComunidade>
  )
}

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
    <>
      <Cartao>
        <Campo
          rotulo="Seu pedido"
          value={texto}
          onChangeText={setTexto}
          erro={erro}
          multiline
          maxLength={2000}
          ajuda="Até 2.000 caracteres."
        />
        <Texto variante="apoio" cor="textoSuave">
          {AVISO_DO_TEXTO}
        </Texto>
        <Botao
          titulo="Entenda como o pedido é guardado"
          icone="documento"
          variante="discreto"
          larguraTotal={false}
          aoPressionar={() => void abrirLink(`${origemPublica()}/privacidade#oracao`)}
        />
      </Cartao>

      <Cartao titulo="Quem vai ver" icone="mostrar">
        <GrupoDeOpcoes
          rotulo="Escolha quem pode ler este pedido"
          opcoes={opcoesDeVisibilidade(nomeDaComunidade, contagem)}
          valor={visibilidade}
          aoMudar={setVisibilidade}
        />
        <Aviso tipo="info" titulo="Antes de publicar">
          {`${explicarVisibilidade(visibilidade, nomeDaComunidade, contagem)} Você pode mudar isso depois, sempre com confirmação.`}
        </Aviso>
      </Cartao>

      {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
      <Botao
        titulo="Publicar pedido"
        icone="publicar"
        carregando={criar.isPending}
        aoPressionar={() => void publicar()}
      />
      <Botao titulo="Cancelar" variante="discreto" aoPressionar={() => router.back()} />
    </>
  )
}
