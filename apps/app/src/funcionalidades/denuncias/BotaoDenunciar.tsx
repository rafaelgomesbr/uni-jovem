import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '@/servicos/api'
import type { MotivoDaDenuncia, RecursoDenunciavel } from '@/servicos/contratoDosModulos'
import { AvisoDeFalha } from '@/ui/Falha'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Expansivel } from '@/ui/Expansivel'
import { ListaDeOpcoes, type Opcao } from '@/ui/ListaDeOpcoes'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { naComunidade } from '../eventos/consultas'
import { desbloquearPessoa, EXPLICACAO_DO_BLOQUEIO, useBloquear } from './bloqueios'

export const NOME_DO_MOTIVO: Readonly<Record<MotivoDaDenuncia, string>> = {
  ofensivo: 'Ofensivo ou desrespeitoso',
  dados_de_terceiros: 'Expõe dados de outra pessoa',
  spam: 'Propaganda ou repetido',
  risco: 'Alguém pode estar em risco',
  outro: 'Outro motivo',
}

const OPCOES: readonly Opcao<MotivoDaDenuncia>[] = (
  Object.keys(NOME_DO_MOTIVO) as MotivoDaDenuncia[]
).map((valor) => ({ valor, rotulo: NOME_DO_MOTIVO[valor] }))

interface Props {
  comunidadeId: string
  recursoTipo: RecursoDenunciavel
  recursoId: string
  /** Para o leitor de tela saber o que está sendo denunciado (ex.: "o aviso Reunião"). */
  descricao: string
  /**
   * Oferece "Bloquear esta pessoa" junto da denúncia (padrão). Falso quando
   * não há pessoa a identificar, como numa sugestão anônima: a API recusaria.
   */
  podeBloquear?: boolean
  /**
   * Depois de bloquear. Útil na tela de detalhe de um pedido ou de uma
   * sugestão, que some para quem bloqueou: a tela pode voltar à lista.
   */
  aoBloquear?: () => void
}

/**
 * Denunciar conteúdo (Apple 1.2): motivo e detalhe opcional. Quem denunciou
 * não aparece para a administração; a API confere se a pessoa vê o conteúdo.
 * Ao lado, "Bloquear esta pessoa": esconde dela, só para quem bloqueia, os
 * pedidos de oração e as sugestões de quem escreveu.
 */
export function BotaoDenunciar({
  comunidadeId,
  recursoTipo,
  recursoId,
  descricao,
  podeBloquear = true,
  aoBloquear,
}: Props) {
  const [motivo, setMotivo] = useState<MotivoDaDenuncia | null>(null)
  const [detalhe, setDetalhe] = useState('')
  const enviar = useMutation({
    mutationFn: () =>
      api.post<{ id: string; mensagem: string }>(`${naComunidade(comunidadeId)}/denuncias`, {
        recursoTipo,
        recursoId,
        motivo,
        ...(detalhe.trim() ? { detalhe: detalhe.trim() } : {}),
      }),
    // O detalhe pode citar o conteúdo: não fica guardado depois do envio.
    gcTime: 0,
  })

  const bloquear = podeBloquear ? (
    <BloquearPessoa
      comunidadeId={comunidadeId}
      recursoTipo={recursoTipo}
      recursoId={recursoId}
      descricao={descricao}
      {...(aoBloquear ? { aoBloquear } : {})}
    />
  ) : null

  if (enviar.isSuccess) {
    return (
      <>
        <Aviso tipo="sucesso" anunciar>
          {enviar.data.mensagem}
        </Aviso>
        {bloquear}
      </>
    )
  }

  return (
    <>
      <Expansivel titulo="Denunciar" icone="denuncia">
        {() => (
          <>
            <Texto variante="legenda" cor="textoSuave">
              A administração da comunidade vai analisar {descricao}. Ela não vê quem denunciou.
            </Texto>
            <ListaDeOpcoes
              rotulo="Qual é o problema?"
              opcoes={OPCOES}
              valor={motivo}
              aoMudar={setMotivo}
            />
            <Campo
              rotulo="Quer explicar? (opcional)"
              value={detalhe}
              onChangeText={setDetalhe}
              multiline
              maxLength={500}
            />
            {enviar.error ? <AvisoDeFalha erro={enviar.error} /> : null}
            <Botao
              titulo="Enviar denúncia"
              variante="destrutivo"
              desabilitado={motivo === null}
              motivo="Escolha o motivo para enviar."
              carregando={enviar.isPending}
              aoPressionar={() => enviar.mutate()}
            />
          </>
        )}
      </Expansivel>
      {bloquear}
    </>
  )
}

interface PropsDoBloqueio {
  comunidadeId: string
  recursoTipo: RecursoDenunciavel
  recursoId: string
  descricao: string
  aoBloquear?: () => void
}

/**
 * "Bloquear esta pessoa", com confirmação que diz o que muda e como desfazer.
 * Depois, um toast com "Desfazer" (o cartão do pedido some na hora, então o
 * desfazer não depende deste componente continuar montado).
 */
function BloquearPessoa({
  comunidadeId,
  recursoTipo,
  recursoId,
  descricao,
  aoBloquear,
}: PropsDoBloqueio) {
  const consultas = useQueryClient()
  const bloquear = useBloquear(comunidadeId)

  async function desfazer(bloqueioId: string) {
    try {
      await desbloquearPessoa(consultas, comunidadeId, bloqueioId)
      mostrarToast({ texto: 'Bloqueio desfeito.', tipo: 'info' })
    } catch {
      mostrarToast({
        texto: 'Não deu para desfazer agora. Tente em Perfil, Pessoas bloqueadas.',
        tipo: 'erro',
      })
    }
  }

  async function pedir() {
    const certeza = await confirmar({
      titulo: 'Bloquear esta pessoa?',
      mensagem: EXPLICACAO_DO_BLOQUEIO,
      confirmar: 'Bloquear',
      destrutivo: true,
    })
    if (!certeza) return
    bloquear.mutate(
      { recursoTipo, recursoId },
      {
        onSuccess: (r) => {
          mostrarToast({
            texto: 'Pessoa bloqueada. Ela não é avisada.',
            acao: { titulo: 'Desfazer', aoPressionar: () => void desfazer(r.id) },
          })
          aoBloquear?.()
        },
      },
    )
  }

  return (
    <>
      {bloquear.error ? (
        <AvisoDeFalha erro={bloquear.error} titulo="Não deu para bloquear" />
      ) : null}
      <Botao
        titulo="Bloquear esta pessoa"
        icone="ocultar"
        variante="terciario"
        alinhado
        carregando={bloquear.isPending}
        // Começa pelo texto visível (quem usa comando de voz diz o que vê).
        rotuloAcessivel={`Bloquear esta pessoa, quem escreveu ${descricao}`}
        dica="Esconde, só para você, os pedidos de oração e as sugestões dessa pessoa nesta comunidade."
        aoPressionar={() => void pedir()}
      />
    </>
  )
}
