import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, EmPar } from '@/ui/Botao'
import { type AcaoDoMenu, MenuDeAcoes } from '@/ui/FolhaNaTela'
import type { NomeDoIcone } from '@/ui/Icone'
import { useTravaDeEnvio } from '@/ui/navegacao'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { usePode } from '../comunidade/permissoes'
import { textoDoPreparo } from '../offline/formatos'
import { useOffline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { naComunidade, useInvalidarEventos } from './consultas'
import { pessoasDistintas, quantasPessoas } from './Convocacao'
import { acoesDeStatus, dataJaPassou, faseDoEncontro, podeIrAoVivo } from './regras'
import type { LembreteDoEncontro } from './useLembrete'

export interface AcaoPrincipal {
  titulo: string
  icone?: NomeDoIcone
  aoPressionar: () => void
  carregando: boolean
  desabilitado?: boolean
  /** Por que está desabilitado, em palavras (o botão desabilitado sempre diz o motivo). */
  motivo?: string
}

interface Opcoes {
  evento: DetalheDoEvento
  comunidadeId: string
  /** Para onde ir depois de excluir (na tela própria, voltar; no painel, fechar o painel). */
  aoSair: () => void
  /** O lembrete a quem não respondeu: é o primário do encontro publicado ainda longe. */
  lembrete: LembreteDoEncontro
  /** Mostra a parte "Quem vai" (o primário da véspera: "Ver quem vai"). */
  aoVerConvocados: () => void
  /** Compartilhar o encontro (o botão do topo faz o mesmo). */
  aoCompartilhar: () => void
  /**
   * Editar: o detalhe abre a seção "Dados do encontro" (e rola ao topo). Sem ele, quem usa o hook
   * fora do detalhe abre o encontro já com a seção aberta.
   */
  aoEditar?: () => void
  /** A seção "Dados do encontro" está aberta: a barra não oferece "Editar" de novo. */
  editando?: boolean
  /** Há algo digitado e não salvo ali: publicar agora publicaria a versão antiga (e avisaria todos). */
  edicaoSuja?: boolean
}

/** "Publicado. 9 pessoas foram avisadas." (ou a frase honesta de quando não há ninguém a avisar). */
export function textoDePublicado(avisadas: number): string {
  if (avisadas === 0) {
    return 'Publicado. O encontro já aparece para a comunidade. Ninguém foi convocado ainda, então ninguém recebeu aviso.'
  }
  return `Publicado. ${quantasPessoas(avisadas)} ${avisadas === 1 ? 'foi avisada' : 'foram avisadas'}.`
}

/**
 * Ações sobre o encontro (D69, 3.4): um primário que depende da hora ("Publicar e avisar 11
 * pessoas" no rascunho, "Lembrar os 2", "Marcar quem chegou", "Conduzir ao vivo", "Marcar o próximo
 * encontro") e o menu "Mais" em grupos. Publicar não pergunta "tem certeza?" e não espera: publica
 * na hora e avisa as pessoas (D81); quem quiser voltar atrás usa "Cancelar ou adiar". Cada ação só
 * aparece se o papel permite (matriz de `@uj/dominio`) e se a transição de situação é válida. A API confere de novo.
 */
export function useAcoesDoEvento({
  evento,
  comunidadeId,
  aoSair,
  lembrete,
  aoVerConvocados,
  aoCompartilhar,
  aoEditar,
  editando = false,
  edicaoSuja = false,
}: Opcoes) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const offline = useOffline()
  const guardado = usePacoteDoEvento(evento.id).data ?? null
  const travaDoModelo = useTravaDeEnvio()
  const [menuAberto, setMenuAberto] = useState(false)
  // Depois de publicar: a frase que diz o que aconteceu, na própria tela, até a pessoa sair.
  const [mensagemFinal, setMensagemFinal] = useState<string | null>(null)
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}`
  const acoes = acoesDeStatus(evento.status)
  const params = { eventoId: evento.id }
  const fase = faseDoEncontro(evento)
  const avisaria = pessoasDistintas(evento.atribuicoes)

  // Publicar é na hora (D81): sem contagem, o botão diz "Publicando..." enquanto a resposta viaja.
  // O cabeçalho só vira "Publicado" quando o servidor confirmou e a tela recarregou.
  const publicarMutacao = useMutation({
    mutationFn: async () => {
      await api.post(`${base}/status`, { status: 'publicado' })
      await invalidar(evento.id)
    },
    onSuccess: () => {
      const texto = textoDePublicado(avisaria)
      setMensagemFinal(texto)
      mostrarToast({ texto })
    },
  })
  const publicando = publicarMutacao.isPending
  const encerrarMutacao = useMutation({
    mutationFn: () => api.post(`${base}/status`, { status: 'encerrado' }),
    onSuccess: async () => {
      mostrarToast({ texto: 'Encontro encerrado.' })
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
  const registraPresenca = pode('presenca', 'registrar') && podeIrAoVivo(evento.status)
  const noPeriodoDoDia = fase === 'checkin' || fase === 'acontecendo'

  async function publicar() {
    setMensagemFinal(null)
    // Erro de ano: publicar uma data que já passou avisa gente à toa. Esta é a única pergunta que resta.
    if (dataJaPassou(evento.inicio)) {
      const ok = await confirmar({
        titulo: 'Esta data já passou',
        mensagem:
          'O início marcado é anterior a agora: confira o dia e o ano. Publicado, o encontro aparece para todos da comunidade.',
        confirmar: 'Publicar mesmo assim',
      })
      if (!ok) return
    }
    publicarMutacao.mutate()
  }

  async function encerrar() {
    const ok = await confirmar({
      titulo: 'Encerrar este encontro?',
      mensagem:
        'Use quando o encontro já aconteceu. Depois de encerrado, ele não volta a ser publicado.',
      confirmar: 'Encerrar encontro',
    })
    if (ok) encerrarMutacao.mutate()
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

  const irParaStatus = () =>
    // Sem escolha de partida: "Adiar" e "Cancelar" aparecem lado a lado, e a pessoa decide (D74).
    router.push({ pathname: '/evento/[eventoId]/status', params: { eventoId: evento.id } })
  const editar =
    aoEditar ??
    (() => router.push({ pathname: '/evento/[eventoId]', params: { ...params, editar: '1' } }))
  const abrirAoVivo = () => router.push({ pathname: '/evento/[eventoId]/ao-vivo', params })
  const abrirCheckin = () => router.push({ pathname: '/evento/[eventoId]/checkin', params })
  const marcarOProximo = () => router.push('/evento/novo')

  const checkinPossivel = registraPresenca && (fase === 'checkin' || fase === 'acontecendo')
  const aoVivoPossivel = conduz && podeIrAoVivo(evento.status) && noPeriodoDoDia

  // O primário por estado: uma função decide o botão grande da barra.
  let primaria: AcaoPrincipal | null = null
  let secundaria: AcaoPrincipal | null = null
  if (organiza) {
    if (podePublicar) {
      primaria = {
        titulo: publicando
          ? 'Publicando...'
          : evento.status === 'adiado'
            ? 'Publicar de novo'
            : avisaria > 0
              ? `Publicar e avisar ${quantasPessoas(avisaria)}`
              : 'Publicar',
        aoPressionar: () => void publicar(),
        carregando: publicando,
        // Com a edição aberta e por salvar, publicar mandaria a versão antiga e avisaria todos.
        desabilitado: publicando || edicaoSuja,
        ...(edicaoSuja ? { motivo: 'Salve ou descarte as alterações primeiro.' } : {}),
      }
    } else if (evento.status === 'publicado') {
      if (fase === 'terminou') {
        primaria = podeDuplicar
          ? { titulo: 'Marcar o próximo encontro', aoPressionar: marcarOProximo, carregando: false }
          : null
      } else if (fase === 'acontecendo') {
        if (aoVivoPossivel) {
          primaria = { titulo: 'Conduzir ao vivo', aoPressionar: abrirAoVivo, carregando: false }
        }
        if (checkinPossivel) {
          const check = {
            titulo: 'Marcar quem chegou',
            icone: 'qr' as const,
            aoPressionar: abrirCheckin,
            carregando: false,
          }
          if (primaria) secundaria = check
          else primaria = check
        }
      } else if (fase === 'checkin') {
        if (checkinPossivel) {
          primaria = {
            titulo: 'Marcar quem chegou',
            icone: 'qr',
            aoPressionar: abrirCheckin,
            carregando: false,
          }
        }
        if (aoVivoPossivel) {
          const vivo = { titulo: 'Abrir ao vivo', aoPressionar: abrirAoVivo, carregando: false }
          if (primaria) secundaria = vivo
          else primaria = vivo
        }
      } else if (fase === 'vespera' || fase === 'no_dia') {
        primaria = { titulo: 'Ver quem vai', aoPressionar: aoVerConvocados, carregando: false }
        if (checkinPossivel) secundaria = null
      } else if (lembrete.disponivel) {
        primaria = {
          titulo:
            lembrete.estado.fase === 'esperando'
              ? lembrete.rotuloEnviando
              : lembrete.estado.fase === 'enviado'
                ? 'Lembrete enviado'
                : `Lembrar ${lembrete.pendentes === 1 ? 'o 1' : `os ${lembrete.pendentes}`}`,
          icone: lembrete.estado.fase === 'enviado' ? 'check' : 'sino',
          aoPressionar: lembrete.pedir,
          carregando: false,
          desabilitado: lembrete.estado.fase !== 'ocioso' || !offline.online,
          ...(!offline.online ? { motivo: 'Precisa de internet para avisar as pessoas.' } : {}),
        }
      }
    }
    // Com "Dados do encontro" já aberto, "Editar" na barra diria a mesma coisa: a barra some.
    if (
      !primaria &&
      podeEditar &&
      !editando &&
      evento.status !== 'cancelado' &&
      evento.status !== 'encerrado'
    ) {
      primaria = { titulo: 'Editar', aoPressionar: editar, carregando: false }
    }
  }

  const validoAte = guardado ? (offline.validoAte ?? guardado.validoAte) : null
  const doEncontro: (AcaoDoMenu | false)[] = organiza
    ? noGrupo('Encontro', [
        // Mesma regra da seção "Dados do encontro": cancelado e encerrado não se editam. Dentro do
        // detalhe "Editar" só abre a seção (sem seta); fora dele, leva a outra tela.
        podeEditar &&
          !editando &&
          evento.status !== 'cancelado' &&
          evento.status !== 'encerrado' &&
          primaria?.titulo !== 'Editar' && {
            titulo: 'Editar',
            icone: 'editar',
            navega: aoEditar === undefined,
            aoPressionar: editar,
          },
        podeDuplicar && {
          titulo: 'Copiar este encontro',
          icone: 'duplicar',
          descricao: 'O roteiro e a equipe, numa data nova',
          navega: true,
          aoPressionar: () =>
            router.push({ pathname: '/evento/igual-ao-ultimo', params: { origem: evento.id } }),
        },
        {
          titulo: 'Compartilhar',
          icone: 'compartilhar',
          aoPressionar: aoCompartilhar,
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
            titulo: 'Repetição',
            icone: 'repetir',
            descricao: 'Este encontro se repete sozinho',
            navega: true,
            aoPressionar: () =>
              router.push({ pathname: '/serie/[serieId]', params: { serieId: evento.serieId! } }),
          },
        conduz &&
          podeIrAoVivo(evento.status) &&
          !aoVivoPossivel && {
            titulo: 'Conduzir ao vivo',
            icone: 'aoVivo',
            navega: true,
            aoPressionar: abrirAoVivo,
          },
        // A organização já tem a linha "Inscrições" no Resumo: um caminho só (D74).
        pode('inscricao', 'ler_lista') &&
          !organiza && {
            titulo: 'Inscrições',
            icone: 'inscricoes',
            navega: true,
            aoPressionar: () => router.push({ pathname: '/evento/[eventoId]/inscricoes', params }),
          },
        registraPresenca &&
          !checkinPossivel && {
            titulo: 'Marcar quem chegou',
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
  const cuidado: (AcaoDoMenu | false)[] = organiza
    ? noGrupo('Cuidado', [
        podeCancelarOuAdiar &&
          (acoes.adiar || acoes.cancelar) && {
            titulo: 'Cancelar ou adiar',
            icone: 'cancelar',
            descricao: 'Avisa quem foi convocado e quem se inscreveu',
            destrutiva: true,
            navega: true,
            aoPressionar: irParaStatus,
          },
        podeCancelarOuAdiar &&
          acoes.encerrar && {
            titulo: 'Encerrar',
            icone: 'encerrar',
            descricao: 'O encontro já aconteceu',
            aoPressionar: () => void encerrar(),
          },
        podeExcluir && {
          titulo: 'Excluir rascunho',
          icone: 'excluir',
          destrutiva: true,
          aoPressionar: () => void pedirExclusao(),
        },
      ])
    : []
  const itens = [...doEncontro, ...doAparelho, ...cuidado]
  const temMenu = itens.some(Boolean)

  const menu = (
    <MenuDeAcoes
      aberto={menuAberto}
      titulo="Mais"
      acoes={itens}
      aoFechar={() => setMenuAberto(false)}
    />
  )

  return {
    organiza,
    primaria,
    secundaria,
    temMenu,
    menu,
    abrirMenu: () => setMenuAberto(true),
    /**
     * As "outras coisas" do encontro, as mesmas do menu, para a aba Resumo mostrar como linhas sempre
     * visíveis, com texto (D74): quem organiza não precisa abrir um "Mais" para achar o que usa.
     */
    itens: itens.filter((i): i is AcaoDoMenu => !!i),
    publicando,
    /** "Publicando...": o que o cabeçalho diz enquanto a publicação viaja. */
    textoPublicando: publicando ? 'Publicando...' : null,
    /** "Publicado. 9 pessoas foram avisadas.": fica na tela depois de publicar. */
    mensagemFinal,
    /** Publicar não passou: a tela diz isso com o título próprio, e o botão volta para tentar de novo. */
    erroAoPublicar: publicarMutacao.error,
    erro:
      encerrarMutacao.error ??
      excluir.error ??
      salvarModelo.error ??
      preparar.error ??
      remover.error ??
      null,
  }
}

export type AcoesDoEvento = ReturnType<typeof useAcoesDoEvento>

/** Põe as ações (as válidas) num grupo com título do menu "Mais". */
function noGrupo(grupo: string, acoes: (AcaoDoMenu | false)[]): (AcaoDoMenu | false)[] {
  return acoes.map((a) => a && { ...a, grupo })
}

/**
 * Baixa o encontro sozinho quando faz sentido (D69, seção 5.10): publicado, a menos de 7 dias,
 * de quem organiza, conduz ou tem parte, e ainda sem cópia neste aparelho. Uma tentativa por
 * encontro e por abertura da tela; falhar não incomoda (o botão manual segue no "Mais"). Só
 * existe no app nativo: na web não há onde guardar, e nada acontece.
 */
export function useBaixarSozinho(evento: DetalheDoEvento, interessa: boolean) {
  const offline = useOffline()
  const guardado = usePacoteDoEvento(evento.id)
  const tentou = useRef<string | null>(null)
  const fase = faseDoEncontro(evento)
  const noPrazo = fase !== 'terminou' && evento.status === 'publicado' && prazoCurto(evento)
  const quer =
    interessa &&
    noPrazo &&
    offline.disponivel &&
    offline.online &&
    !guardado.isFetching &&
    !guardado.data
  const preparar = offline.prepararEvento
  useEffect(() => {
    if (!quer || tentou.current === evento.id) return
    tentou.current = evento.id
    preparar(evento.id).catch(() => undefined)
  }, [quer, evento.id, preparar])
}

function prazoCurto(evento: Pick<DetalheDoEvento, 'inicio'>): boolean {
  return Date.parse(evento.inicio) - Date.now() <= 7 * 86_400_000
}

/**
 * O botão como ELEMENTO (e não como componente): a `BarraDeAcao` lê `desabilitado` e `motivo` das
 * props dos filhos para escrever o motivo embaixo dos botões, e um componente no meio esconderia isso.
 */
function botaoDaBarra(acao: AcaoPrincipal, principal: boolean) {
  return (
    <Botao
      key={principal ? 'principal' : 'secundario'}
      titulo={acao.titulo}
      tamanho="grande"
      variante={principal ? 'primario' : 'secundario'}
      carregando={acao.carregando}
      {...(acao.desabilitado ? { desabilitado: true } : {})}
      {...(acao.motivo ? { motivo: acao.motivo } : {})}
      aoPressionar={acao.aoPressionar}
      {...(acao.icone ? { icone: acao.icone } : {})}
    />
  )
}

/**
 * Barra de ação do encontro (organização): o secundário (se houver) e o primário do estado, os dois
 * com `flex: 1`. Sem "Mais": o que ele escondia está nas "Outras coisas" do Resumo (D74).
 */
export function BarraDoEvento({ acoes }: { acoes: AcoesDoEvento }) {
  if (!acoes.organiza || (!acoes.primaria && !acoes.secundaria)) return null
  return (
    <BarraDeAcao solta>
      {acoes.secundaria ? botaoDaBarra(acoes.secundaria, false) : null}
      {acoes.primaria ? botaoDaBarra(acoes.primaria, true) : null}
    </BarraDeAcao>
  )
}

/** No painel da web larga (sem barra fixa): a mesma linha, no topo do detalhe. */
export function AcoesNoPainel({ acoes }: { acoes: AcoesDoEvento }) {
  if (!acoes.organiza) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
      {acoes.secundaria ? (
        <View style={{ flex: 1 }}>
          <EmPar>{botaoDaBarra(acoes.secundaria, false)}</EmPar>
        </View>
      ) : null}
      {acoes.primaria ? (
        <View style={{ flex: 1 }}>
          <EmPar>{botaoDaBarra(acoes.primaria, true)}</EmPar>
        </View>
      ) : null}
    </View>
  )
}
