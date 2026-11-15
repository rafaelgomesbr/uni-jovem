import { useMutation } from '@tanstack/react-query'
import { ALTURA, ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, BotaoIcone, EmPar } from '@/ui/Botao'
import { type AcaoDoMenu, MenuDeAcoes } from '@/ui/FolhaNaTela'
import type { NomeDoIcone } from '@/ui/Icone'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { usePode } from '../comunidade/permissoes'
import { textoDoPreparo } from '../offline/formatos'
import { useOffline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { naComunidade, useInvalidarEventos } from './consultas'
import { useAoVivoNoDia } from './DestaqueDoEvento'
import { acoesDeStatus, podeIrAoVivo } from './regras'

interface AcaoPrincipal {
  titulo: string
  icone?: NomeDoIcone
  aoPressionar: () => void
  carregando: boolean
}

interface Opcoes {
  evento: DetalheDoEvento
  comunidadeId: string
  /** Para onde ir depois de excluir (na tela própria, voltar; no painel, fechar o painel). */
  aoSair: () => void
}

/**
 * Ações sobre o evento (3.4.2, item 9): um primário contextual ("Publicar"
 * no rascunho, "Abrir ao vivo" no dia, "Editar" nos outros casos) e a folha
 * "Mais ações" com o resto. Cada ação só aparece se o papel permite (matriz
 * de `@uj/dominio`) e se a transição de situação é válida. A API confere de novo.
 */
export function useAcoesDoEvento({ evento, comunidadeId, aoSair }: Opcoes) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const offline = useOffline()
  const guardado = usePacoteDoEvento(evento.id).data ?? null
  const noDia = useAoVivoNoDia(evento)
  const [menuAberto, setMenuAberto] = useState(false)
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}`
  const acoes = acoesDeStatus(evento.status)
  const params = { eventoId: evento.id }

  const mudarStatus = useMutation({
    mutationFn: (status: 'publicado' | 'encerrado') => api.post(`${base}/status`, { status }),
    onSuccess: async (_r, status) => {
      mostrarToast({ texto: status === 'publicado' ? 'Evento publicado.' : 'Evento encerrado.' })
      await invalidar(evento.id)
    },
  })
  const excluir = useMutation({
    mutationFn: () => api.delete(base),
    onSuccess: async () => {
      mostrarToast({ texto: 'Rascunho excluído.' })
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
    onSuccess: () => mostrarToast({ texto: `Modelo salvo. Ele aparece ao criar uma programação.` }),
  })
  const preparar = useMutation({
    mutationFn: () => offline.prepararEvento(evento.id),
    // Baixar exige rede de verdade: sem ela, o pedido falha e a tela explica.
    networkMode: 'always',
    onSuccess: () => mostrarToast({ texto: 'Pronto para usar sem internet.' }),
  })
  const remover = useMutation({
    mutationFn: () => offline.removerPacote(evento.id),
    networkMode: 'always',
    onSuccess: () => mostrarToast({ texto: 'A cópia saiu deste aparelho.' }),
  })

  const podeEditar = pode('evento', 'editar')
  const podePublicar = pode('evento', 'publicar') && acoes.publicar
  const podeCancelarOuAdiar = pode('evento', 'cancelar_ou_adiar')
  const podeDuplicar = pode('evento', 'criar')
  const podeModelo = pode('modelo', 'gerenciar')
  const podeExcluir = pode('evento', 'excluir') && acoes.excluir
  const organiza = podeEditar || podePublicar || podeCancelarOuAdiar || podeDuplicar
  const conduz = pode('ao_vivo', 'conduzir')

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

  async function pedirRemocaoDaCopia() {
    const ok = await confirmar({
      titulo: 'Remover deste aparelho?',
      mensagem: `A cópia de "${evento.titulo}" sai do aparelho. Sem internet, ela deixa de abrir.`,
      confirmar: 'Remover',
      destrutivo: true,
    })
    if (ok) remover.mutate()
  }

  const irParaStatus = (acao: 'cancelar' | 'adiar') =>
    router.push({ pathname: '/evento/[eventoId]/status', params: { eventoId: evento.id, acao } })
  const editar = () => router.push({ pathname: '/evento/[eventoId]/editar', params })
  const abrirAoVivo = () => router.push({ pathname: '/evento/[eventoId]/ao-vivo', params })

  const primaria: AcaoPrincipal | null = !organiza
    ? null
    : podePublicar
      ? {
          titulo: evento.status === 'adiado' ? 'Publicar de novo' : 'Publicar',
          aoPressionar: () => void publicar(),
          carregando: mudarStatus.isPending && mudarStatus.variables === 'publicado',
        }
      : noDia
        ? { titulo: 'Abrir ao vivo', aoPressionar: abrirAoVivo, carregando: false }
        : podeEditar
          ? { titulo: 'Editar', aoPressionar: editar, carregando: false }
          : null

  const validoAte = guardado ? (offline.validoAte ?? guardado.validoAte) : null
  const deOrganizacao: (AcaoDoMenu | false)[] = organiza
    ? [
        podeEditar &&
          primaria?.titulo !== 'Editar' && {
            titulo: 'Editar',
            icone: 'editar',
            navega: true,
            aoPressionar: editar,
          },
        podeDuplicar && {
          titulo: 'Duplicar',
          icone: 'duplicar',
          descricao: 'Copia etapas, checklist, tarefas e materiais para outra data',
          navega: true,
          aoPressionar: () => router.push({ pathname: '/evento/[eventoId]/duplicar', params }),
        },
        podeModelo && {
          titulo: 'Salvar como modelo',
          icone: 'modelo',
          aoPressionar: () => salvarModelo.mutate(),
        },
        !!evento.serieId &&
          podeEditar && {
            titulo: 'Ver a série',
            icone: 'repetir',
            navega: true,
            aoPressionar: () =>
              router.push({ pathname: '/serie/[serieId]', params: { serieId: evento.serieId! } }),
          },
        conduz &&
          podeIrAoVivo(evento.status) &&
          !noDia && {
            titulo: 'Conduzir ao vivo',
            icone: 'aoVivo',
            navega: true,
            aoPressionar: abrirAoVivo,
          },
        pode('inscricao', 'ler_lista') && {
          titulo: 'Inscrições',
          icone: 'inscricoes',
          navega: true,
          aoPressionar: () => router.push({ pathname: '/evento/[eventoId]/inscricoes', params }),
        },
        pode('presenca', 'registrar') && {
          titulo: 'Check-in de presença',
          icone: 'qr',
          navega: true,
          aoPressionar: () => router.push({ pathname: '/evento/[eventoId]/checkin', params }),
        },
      ]
    : []
  const doAparelho: (AcaoDoMenu | false)[] = offline.disponivel
    ? [
        {
          titulo: guardado ? 'Atualizar a cópia do aparelho' : 'Preparar para usar sem internet',
          icone: guardado ? 'sincronizar' : 'baixar',
          descricao:
            guardado && validoAte
              ? textoDoPreparo(guardado.baixadoEm, validoAte)
              : 'Programação, equipe e tarefas cifradas neste aparelho',
          motivo: offline.online ? null : 'Preparar exige conexão com a internet.',
          aoPressionar: () => preparar.mutate(),
        },
        !!guardado && {
          titulo: 'Remover deste aparelho',
          icone: 'excluir',
          aoPressionar: () => void pedirRemocaoDaCopia(),
        },
      ]
    : []
  const destrutivas: (AcaoDoMenu | false)[] = organiza
    ? [
        podeCancelarOuAdiar &&
          acoes.adiar && {
            titulo: 'Adiar',
            icone: 'relogio',
            navega: true,
            aoPressionar: () => irParaStatus('adiar'),
          },
        podeCancelarOuAdiar &&
          acoes.encerrar && {
            titulo: 'Encerrar',
            icone: 'encerrar',
            descricao: 'O encontro já aconteceu',
            aoPressionar: () => void encerrar(),
          },
        podeCancelarOuAdiar &&
          acoes.cancelar && {
            titulo: 'Cancelar evento',
            icone: 'cancelar',
            destrutiva: true,
            aoPressionar: () => irParaStatus('cancelar'),
          },
        podeExcluir && {
          titulo: 'Excluir rascunho',
          icone: 'excluir',
          destrutiva: true,
          aoPressionar: () => void pedirExclusao(),
        },
      ]
    : []
  const itens = [...deOrganizacao, ...doAparelho, ...destrutivas]
  const temMenu = itens.some(Boolean)

  const menu = (
    <MenuDeAcoes
      aberto={menuAberto}
      titulo="Mais ações"
      acoes={itens}
      aoFechar={() => setMenuAberto(false)}
    />
  )

  return {
    organiza,
    primaria,
    temMenu,
    menu,
    abrirMenu: () => setMenuAberto(true),
    erro:
      mudarStatus.error ??
      excluir.error ??
      salvarModelo.error ??
      preparar.error ??
      remover.error ??
      null,
  }
}

export type AcoesDoEvento = ReturnType<typeof useAcoesDoEvento>

const DICA_DO_MENU = 'Abre a folha com as outras ações da programação.'

/**
 * Barra de ação do detalhe (quadro 03): "Mais ações" de 48 à esquerda e o
 * primário contextual com `flex: 1`. Sem primário, só o "Mais ações". O só
 * ícone vai direto na barra (ela reconhece e não o estica).
 */
export function BarraDoEvento({ acoes }: { acoes: AcoesDoEvento }) {
  if (!acoes.organiza) return null
  return (
    <BarraDeAcao>
      {acoes.temMenu ? (
        <BotaoIcone
          icone="maisAcoes"
          rotulo="Mais ações"
          dica={DICA_DO_MENU}
          lado={ALTURA.controle}
          aoPressionar={acoes.abrirMenu}
        />
      ) : null}
      {acoes.primaria ? <BotaoPrincipal acao={acoes.primaria} /> : null}
    </BarraDeAcao>
  )
}

function BotaoPrincipal({ acao }: { acao: AcaoPrincipal }) {
  return (
    <Botao
      titulo={acao.titulo}
      tamanho="grande"
      carregando={acao.carregando}
      aoPressionar={acao.aoPressionar}
      {...(acao.icone ? { icone: acao.icone } : {})}
    />
  )
}

/** No painel da web larga (sem barra fixa): a mesma linha, no topo do detalhe. */
export function AcoesNoPainel({ acoes }: { acoes: AcoesDoEvento }) {
  if (!acoes.organiza) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
      {acoes.temMenu ? (
        <BotaoIcone
          icone="maisAcoes"
          rotulo="Mais ações"
          dica={DICA_DO_MENU}
          lado={ALTURA.controle}
          aoPressionar={acoes.abrirMenu}
        />
      ) : null}
      {acoes.primaria ? (
        <View style={{ flex: 1 }}>
          <EmPar>
            <BotaoPrincipal acao={acoes.primaria} />
          </EmPar>
        </View>
      ) : null}
    </View>
  )
}
