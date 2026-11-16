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
import { useTravaDeEnvio } from '@/ui/navegacao'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { usePode } from '../comunidade/permissoes'
import { textoDoPreparo } from '../offline/formatos'
import { useOffline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { naComunidade, useInvalidarEventos } from './consultas'
import { ehHoje, useAoVivoNoDia } from './DestaqueDoEvento'
import { acoesDeStatus, dataJaPassou, podeIrAoVivo } from './regras'

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
 * "Mais ações" com o resto. No dia, quem registra presença ganha "Check-in"
 * na própria barra: é a tarefa da porta, e no "Mais" ninguém achava (U-04).
 * Cada ação só aparece se o papel permite (matriz de `@uj/dominio`) e se a
 * transição de situação é válida. A API confere de novo.
 */
export function useAcoesDoEvento({ evento, comunidadeId, aoSair }: Opcoes) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const offline = useOffline()
  const guardado = usePacoteDoEvento(evento.id).data ?? null
  const noDia = useAoVivoNoDia(evento)
  const travaDoModelo = useTravaDeEnvio()
  const [menuAberto, setMenuAberto] = useState(false)
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}`
  const acoes = acoesDeStatus(evento.status)
  const params = { eventoId: evento.id }

  const mudarStatus = useMutation({
    mutationFn: (status: 'publicado' | 'encerrado') => api.post(`${base}/status`, { status }),
    onSuccess: async (_r, status) => {
      mostrarToast({
        texto: status === 'publicado' ? 'Encontro publicado.' : 'Encontro encerrado.',
      })
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
    onSuccess: () => mostrarToast({ texto: `Modelo salvo. Ele aparece ao criar um encontro.` }),
    // Dois toques não criam dois modelos iguais (M2); depois da resposta, pode salvar de novo.
    onSettled: travaDoModelo.soltar,
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
  const checkinNoDia =
    pode('presenca', 'registrar') && podeIrAoVivo(evento.status) && ehHoje(evento)

  async function publicar() {
    const passou = dataJaPassou(evento.inicio)
    const quemVe =
      evento.visibilidade === 'publica'
        ? 'Todos da comunidade passam a ver o encontro, e a página pública de inscrição fica no ar.'
        : 'Todos da comunidade passam a ver o encontro na agenda.'
    const ok = await confirmar(
      passou
        ? {
            titulo: 'Esta data já passou',
            mensagem: `O início marcado é anterior a agora: confira o dia e o ano. ${quemVe}`,
            confirmar: 'Publicar mesmo assim',
          }
        : {
            titulo: evento.status === 'adiado' ? 'Publicar de novo?' : 'Publicar este encontro?',
            mensagem: quemVe,
            confirmar: 'Publicar',
          },
    )
    if (ok) mudarStatus.mutate('publicado')
  }

  async function encerrar() {
    const ok = await confirmar({
      titulo: 'Encerrar este encontro?',
      mensagem:
        'Use quando o encontro já aconteceu. Depois de encerrado, ele não volta a ser publicado.',
      confirmar: 'Encerrar encontro',
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
      titulo: 'Remover do aparelho?',
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
  const abrirCheckin = () => router.push({ pathname: '/evento/[eventoId]/checkin', params })

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
    ? noGrupo('Organizar', [
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
          aoPressionar: () => {
            if (travaDoModelo.pegar()) salvarModelo.mutate()
          },
        },
        !!evento.serieId &&
          podeEditar && {
            titulo: 'Ver a repetição',
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
        // No dia, o check-in está na barra; aqui, só nos outros dias.
        pode('presenca', 'registrar') &&
          !checkinNoDia && {
            titulo: 'Check-in de presença',
            icone: 'qr',
            navega: true,
            aoPressionar: abrirCheckin,
          },
      ])
    : []
  // Baixar e remover a cópia é de quem organiza ou conduz (D57): para os demais, só ruído.
  const doAparelho: (AcaoDoMenu | false)[] =
    offline.disponivel && (organiza || conduz)
      ? noGrupo('Neste aparelho', [
          {
            titulo: guardado ? 'Atualizar a cópia do aparelho' : 'Baixar para usar sem internet',
            icone: guardado ? 'sincronizar' : 'baixar',
            descricao:
              guardado && validoAte
                ? textoDoPreparo(guardado.baixadoEm, validoAte)
                : 'Roteiro, quem serve e tarefas, cifrados neste aparelho',
            motivo: offline.online ? null : 'Baixar exige conexão com a internet.',
            aoPressionar: () => {
              if (!preparar.isPending) preparar.mutate()
            },
          },
          !!guardado && {
            titulo: 'Remover do aparelho',
            icone: 'excluir',
            aoPressionar: () => void pedirRemocaoDaCopia(),
          },
        ])
      : []
  const destrutivas: (AcaoDoMenu | false)[] = organiza
    ? noGrupo('Organizar', [
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
            titulo: 'Cancelar encontro',
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
      ])
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
    /** No dia, para quem registra presença: abre o check-in direto da barra. */
    checkin: checkinNoDia ? abrirCheckin : null,
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

/** Põe as ações (as válidas) num grupo com título do menu "Mais ações". */
function noGrupo(grupo: string, acoes: (AcaoDoMenu | false)[]): (AcaoDoMenu | false)[] {
  return acoes.map((a) => a && { ...a, grupo })
}

const DICA_DO_MENU = 'Abre a folha com as outras ações do encontro.'

/**
 * "… Mais": o "…" sozinho não diz "menu" para todo mundo (U-05). Vai direto
 * na barra, como elemento (e não como componente próprio): a barra reconhece
 * o botão de ícone pelas props e não o estica.
 */
function botaoMais(acoes: AcoesDoEvento) {
  return (
    <BotaoIcone
      icone="maisAcoes"
      texto="Mais"
      rotulo="Mais ações"
      dica={DICA_DO_MENU}
      lado={ALTURA.controle}
      aoPressionar={acoes.abrirMenu}
    />
  )
}

/** "Check-in" do dia: secundário ao lado do primário ("Abrir ao vivo"); sozinho, é o primário. */
function BotaoCheckin({ acoes }: { acoes: AcoesDoEvento }) {
  if (!acoes.checkin) return null
  return (
    <Botao
      titulo="Check-in"
      icone="qr"
      tamanho="grande"
      variante={acoes.primaria ? 'secundario' : 'primario'}
      rotuloAcessivel="Check-in de presença"
      dica="Marque quem chegou, pelo nome ou pelo QR."
      aoPressionar={acoes.checkin}
    />
  )
}

/**
 * Barra de ação do detalhe (quadro 03): "Mais" à esquerda, o "Check-in" no
 * dia e o primário contextual, os dois com `flex: 1`. Sem primário, só o
 * "Mais" (e o check-in).
 */
export function BarraDoEvento({ acoes }: { acoes: AcoesDoEvento }) {
  if (!acoes.organiza) return null
  return (
    <BarraDeAcao>
      {acoes.temMenu ? botaoMais(acoes) : null}
      {acoes.checkin ? <BotaoCheckin acoes={acoes} /> : null}
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
      {acoes.temMenu ? botaoMais(acoes) : null}
      {acoes.checkin ? (
        <View style={{ flex: 1 }}>
          <EmPar>
            <BotaoCheckin acoes={acoes} />
          </EmPar>
        </View>
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
