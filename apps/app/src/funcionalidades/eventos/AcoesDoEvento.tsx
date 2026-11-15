import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'

import { usePode } from '../comunidade/permissoes'
import { naComunidade, useInvalidarEventos } from './consultas'
import { acoesDeStatus } from './regras'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
  /** Para onde ir depois de excluir (na tela própria, voltar; no painel, fechar o painel). */
  aoSair: () => void
}

/**
 * Ações de organização sobre o evento. Cada botão só aparece se o papel
 * permite (matriz de `@uj/dominio`) e se a transição de status é válida
 * (`podeMudarStatus`). Para membros, o cartão nem aparece.
 */
export function AcoesDoEvento({ evento, comunidadeId, aoSair }: Props) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const [aviso, setAviso] = useState<string | null>(null)
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}`
  const acoes = acoesDeStatus(evento.status)

  const mudarStatus = useMutation({
    mutationFn: (status: 'publicado' | 'encerrado') => api.post(`${base}/status`, { status }),
    onSuccess: async (_r, status) => {
      setAviso(status === 'publicado' ? 'Evento publicado.' : 'Evento encerrado.')
      await invalidar(evento.id)
    },
  })
  const excluir = useMutation({
    mutationFn: () => api.delete(base),
    onSuccess: async () => {
      await invalidar()
      aoSair()
    },
  })
  const salvarModelo = useMutation({
    mutationFn: () =>
      api.post(`${naComunidade(comunidadeId)}/modelos`, {
        aPartirDoEvento: evento.id,
        nome: evento.titulo.slice(0, 80),
      }),
    onSuccess: () =>
      setAviso(`Modelo "${evento.titulo}" salvo. Ele aparece ao criar uma programação.`),
  })

  const podeEditar = pode('evento', 'editar')
  const podePublicar = pode('evento', 'publicar') && acoes.publicar
  const podeCancelarOuAdiar = pode('evento', 'cancelar_ou_adiar')
  const podeDuplicar = pode('evento', 'criar')
  const podeModelo = pode('modelo', 'gerenciar')
  const podeExcluir = pode('evento', 'excluir') && acoes.excluir
  if (!podeEditar && !podePublicar && !podeCancelarOuAdiar && !podeDuplicar) return null

  async function publicar() {
    const ok = await confirmar({
      titulo: evento.status === 'adiado' ? 'Publicar de novo?' : 'Publicar este evento?',
      mensagem:
        evento.visibilidade === 'publica'
          ? 'Todos da comunidade passam a ver o evento, e a página pública de inscrição fica no ar.'
          : 'Todos da comunidade passam a ver o evento na agenda.',
      confirmar: 'Publicar',
    })
    if (ok) mudarStatus.mutate('publicado')
  }

  async function encerrar() {
    const ok = await confirmar({
      titulo: 'Encerrar este evento?',
      mensagem:
        'Use quando o encontro já aconteceu. Depois de encerrado, ele não volta a ser publicado.',
      confirmar: 'Encerrar evento',
    })
    if (ok) mudarStatus.mutate('encerrado')
  }

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: 'Excluir este rascunho?',
      mensagem: 'O rascunho e tudo o que foi preparado nele são apagados. Não dá para desfazer.',
      confirmar: 'Excluir rascunho',
      destrutivo: true,
    })
    if (ok) excluir.mutate()
  }

  const erro = mudarStatus.error ?? excluir.error ?? salvarModelo.error
  const irPara = (acao: 'cancelar' | 'adiar') =>
    router.push({ pathname: '/evento/[eventoId]/status', params: { eventoId: evento.id, acao } })

  return (
    <Cartao titulo="Organização" icone="editar">
      {aviso ? (
        <Aviso tipo="sucesso" anunciar>
          {aviso}
        </Aviso>
      ) : null}
      {erro ? <AvisoDeErro erro={erro} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        {podePublicar ? (
          <Botao
            titulo={evento.status === 'adiado' ? 'Publicar de novo' : 'Publicar'}
            icone="publicar"
            larguraTotal={false}
            carregando={mudarStatus.isPending && mudarStatus.variables === 'publicado'}
            aoPressionar={() => void publicar()}
          />
        ) : null}
        {podeEditar ? (
          <Botao
            titulo="Editar"
            icone="editar"
            variante="secundario"
            larguraTotal={false}
            aoPressionar={() =>
              router.push({
                pathname: '/evento/[eventoId]/editar',
                params: { eventoId: evento.id },
              })
            }
          />
        ) : null}
        {podeDuplicar ? (
          <Botao
            titulo="Duplicar"
            icone="duplicar"
            variante="secundario"
            larguraTotal={false}
            aoPressionar={() =>
              router.push({
                pathname: '/evento/[eventoId]/duplicar',
                params: { eventoId: evento.id },
              })
            }
          />
        ) : null}
        {podeModelo ? (
          <Botao
            titulo="Salvar como modelo"
            icone="modelo"
            variante="secundario"
            larguraTotal={false}
            carregando={salvarModelo.isPending}
            aoPressionar={() => salvarModelo.mutate()}
          />
        ) : null}
        {evento.serieId && podeEditar ? (
          <Botao
            titulo="Ver a série"
            icone="repetir"
            variante="secundario"
            larguraTotal={false}
            aoPressionar={() =>
              router.push({ pathname: '/serie/[serieId]', params: { serieId: evento.serieId! } })
            }
          />
        ) : null}
        {podeCancelarOuAdiar && acoes.encerrar ? (
          <Botao
            titulo="Encerrar"
            icone="encerrar"
            variante="secundario"
            larguraTotal={false}
            carregando={mudarStatus.isPending && mudarStatus.variables === 'encerrado'}
            aoPressionar={() => void encerrar()}
          />
        ) : null}
        {podeCancelarOuAdiar && acoes.adiar ? (
          <Botao
            titulo="Adiar"
            icone="relogio"
            variante="secundario"
            larguraTotal={false}
            aoPressionar={() => irPara('adiar')}
          />
        ) : null}
        {podeCancelarOuAdiar && acoes.cancelar ? (
          <Botao
            titulo="Cancelar evento"
            icone="cancelar"
            variante="destrutivo"
            larguraTotal={false}
            aoPressionar={() => irPara('cancelar')}
          />
        ) : null}
        {podeExcluir ? (
          <Botao
            titulo="Excluir rascunho"
            icone="excluir"
            variante="destrutivo"
            larguraTotal={false}
            carregando={excluir.isPending}
            aoPressionar={() => void pedirExclusao()}
          />
        ) : null}
      </View>
    </Cartao>
  )
}
