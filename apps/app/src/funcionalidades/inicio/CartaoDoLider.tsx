import { useMutation } from '@tanstack/react-query'
import { ESPACO, type PoseDoSol } from '@uj/tokens'
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { RetratoAoVivo } from '@/servicos/contratoDosEventos'
import { chamadasV3, type MomentoDoInicio, type ParteDoMomento } from '@/servicos/contratoV3'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDoMomento } from '@/ui/CartaoDoMomento'
import { Texto } from '@/ui/Texto'
import { mostrarDesfazer, useDesfazerPendente } from '@/ui/ToastComDesfazer'
import { mostrarToast } from '@/ui/Toast'
import { formatarHora } from '@/utilidades/datas'

import { naComunidade, useInvalidarEventos } from '../eventos/consultas'
import type { TipoDeEncanto } from './encantos'
import {
  acoesDoLider,
  estaNoLouvor,
  etiquetaDoMomento,
  frasesDoQueFalta,
  momentoDoDia,
  posicaoNoDia,
  seloDoCartaoDoLider,
  type AcaoDoMomento,
} from './momento'
import { dataEHoraDoCartao } from './quando'
import {
  botaoComum,
  ChipsDoTopo,
  LinhaDoMotivo,
  listarNomes,
  ordenarBotoes,
  pessoas,
  SeloDoCartao,
  textoDaPosicao,
  useDestinosDoEncontro,
} from './PecasDoCartao'

export const MOTIVO_SEM_INTERNET_PARA_AVISAR = 'Precisa de internet para avisar as pessoas.'

type EstadoDoLembrete = 'nao' | 'espera' | 'enviado'
type EstadoDaPublicacao = 'nao' | 'espera' | 'feito'

interface Props {
  comunidadeId: string
  momento: MomentoDoInicio
  /** As partes da própria pessoa (quem organiza também pode servir). */
  partes: readonly ParteDoMomento[]
  semInternet: boolean
  versaoSalva: string | null
  /** O andamento ao vivo, só quando o encontro está acontecendo. */
  andamento: RetratoAoVivo | undefined
  poseDoEncanto?: PoseDoSol
  /** Pede um momento de encanto (a regra "uma vez por conta" mora em quem recebe). */
  aoEncanto: (tipo: TipoDeEncanto, texto: string) => void
  rodape?: ReactNode
}

/** "Faltam: Bruno e Camila", "Falta responder: Bruno". */
function textoDeQuemFalta(faltam: readonly { nome: string }[], total: number): string {
  const nomes = listarNomes(
    faltam.map((f) => f.nome),
    total,
  )
  return total === 1 ? `Falta responder: ${nomes}` : `Faltam: ${nomes}`
}

function confirmados(n: number): string {
  return `${n} ${n === 1 ? 'confirmado' : 'confirmados'}.`
}

/**
 * O cartão do momento do LÍDER (3.2 do UX, D68, D75 e D79): "o que falta resolver e qual é o
 * próximo passo do encontro", ENXUTO: a etiqueta de tempo, o título, a data e a hora numa linha,
 * UMA linha do que importa (o estado), o botão principal e UM botão secundário de verdade. O
 * alerta que o botão principal já diz ("Montar o repertório") não vira frase; o que sobra vira um
 * selo pequeno. Os botões mais caros da semana moram aqui: "Lembrar os N" (chama a API e espera
 * a janela do Desfazer, porque avisa pessoas) e "Publicar e avisar N pessoas" (na hora, D81). Sem internet,
 * o que avisa gente fica desabilitado com o motivo escrito.
 */
export function CartaoDoLider({
  comunidadeId,
  momento,
  partes,
  semInternet,
  versaoSalva,
  andamento,
  poseDoEncanto,
  aoEncanto,
  rodape,
}: Props) {
  const evento = momento.evento
  const lider = momento.lider
  const terminou = !evento && momento.recemTerminado !== null
  const destinos = useDestinosDoEncontro(evento ?? { id: momento.recemTerminado?.id ?? '' }, {
    toco: estaNoLouvor(partes),
    musicas: evento?.musicas ?? lider?.musicas ?? 0,
    organiza: true,
  })
  const invalidar = useInvalidarEventos(comunidadeId)
  const esperaDoToast = useDesfazerPendente()

  const [lembrete, setLembrete] = useState<EstadoDoLembrete>('nao')
  const [lembrados, setLembrados] = useState<{ nomes: string; hora: string } | null>(null)
  const [publicacao, setPublicacao] = useState<EstadoDaPublicacao>('nao')

  const lembrar = useMutation({
    mutationFn: () => chamadasV3.lembrarPendentes(comunidadeId, evento!.id),
    onSuccess: async () => {
      setLembrete('enviado')
      await invalidar(evento?.id)
    },
    onError: () => {
      setLembrete('nao')
      mostrarDesfazer({
        texto: 'Não deu para lembrar agora. Toque para tentar de novo.',
        rotuloDoBotao: 'Tentar de novo',
        aoConfirmar: () => undefined,
        aoDesfazer: () => pedirLembrete(),
      })
    },
  })

  const publicar = useMutation({
    mutationFn: () =>
      api.post(`${naComunidade(comunidadeId)}/eventos/${evento!.id}/status`, {
        status: 'publicado',
      }),
    onSuccess: async () => {
      setPublicacao('feito')
      aoEncanto('publicou', 'Seu primeiro encontro está no ar.')
      const n = lider?.avisariaAoPublicar ?? 0
      mostrarToast({
        texto:
          n > 0 ? `Publicado. ${pessoas(n)} ${n === 1 ? 'avisada' : 'avisadas'}.` : 'Publicado.',
        tipo: 'sucesso',
      })
      await invalidar(evento?.id)
    },
    onError: () => {
      setPublicacao('nao')
      mostrarDesfazer({
        texto: 'Não deu para publicar agora. Toque para tentar de novo.',
        rotuloDoBotao: 'Tentar de novo',
        aoConfirmar: () => undefined,
        aoDesfazer: () => pedirPublicacao(),
      })
    },
  })

  const faltam = lider?.faltamResponder ?? []
  const totalQueFalta = lider?.faltamResponderTotal ?? faltam.length

  function pedirLembrete() {
    if (!evento) return
    const nomes = listarNomes(
      faltam.map((f) => f.nome),
      totalQueFalta,
    )
    setLembrete('espera')
    mostrarDesfazer({
      texto: nomes ? `Lembrando ${nomes}.` : 'Lembrando quem falta.',
      aoDesfazer: () => setLembrete('nao'),
      aoConfirmar: () => {
        setLembrados({ nomes, hora: formatarHora(new Date().toISOString(), evento.fuso) })
        lembrar.mutate()
      },
    })
  }

  function pedirPublicacao() {
    if (!evento) return
    // Publicar é na hora (D81): sem contagem. "espera" é só a resposta viajando.
    setPublicacao('espera')
    publicar.mutate()
  }

  // ------------------------------------------------------------------ o que o botão faz
  const dia = momentoDoDia(momento)
  const naHoraDoCheckin = dia === 'dia' && (momento.minutosParaInicio ?? Infinity) <= 120
  const musicas = evento?.musicas ?? lider?.musicas ?? 0
  const calculadas = acoesDoLider({
    momento: dia,
    rascunho: evento?.status === 'rascunho',
    lembraveis: lider?.lembraveis ?? 0,
    pendentes: lider?.pendentes ?? 0,
    faltaFuncao: lider?.faltaFuncao ?? [],
    semMusicas: musicas === 0,
    semConvocados: !!lider && lider.convocados === 0,
    naHoraDoCheckin,
    terminou,
    proximoAMarcar: momento.proximoAMarcar !== false,
    semEncontro: !evento && !terminou,
  })
  // Depois de lembrar, o botão fica em "Lembrete enviado" até a tela ser fechada.
  const { primaria, secundaria } =
    lembrete !== 'nao' && evento?.status !== 'rascunho'
      ? { primaria: 'lembrar' as const, secundaria: 'verConvocados' as const }
      : calculadas

  const semInternetParaAvisar =
    semInternet && ['lembrar', 'publicar', 'marcarProximo', 'convocarFuncao'].includes(primaria)

  /** `modo`: o botão em destaque ou o secundário (um botão de verdade, abaixo dele: D79). */
  function botao(acao: AcaoDoMomento, modo: 'primario' | 'secundario') {
    const principal = modo === 'primario'
    const variante = principal ? 'primario' : 'secundario'
    const alvoDoEncontro = evento ?? { titulo: momento.recemTerminado?.titulo ?? '' }
    switch (acao) {
      case 'lembrar': {
        if (lembrete === 'espera') {
          return (
            <Botao
              key={acao}
              titulo={`Enviando em ${esperaDoToast?.restante ?? 5} s`}
              variante={variante}
              icone="relogio"
              desabilitado
              aoPressionar={() => undefined}
            />
          )
        }
        if (lembrete === 'enviado') {
          return (
            <Botao
              key={acao}
              titulo="Lembrete enviado"
              variante={variante}
              icone="check"
              desabilitado
              aoPressionar={() => undefined}
            />
          )
        }
        return (
          <Botao
            key={acao}
            titulo={`Lembrar ${pessoas(lider?.lembraveis ?? 0)}`}
            variante={variante}
            desabilitado={semInternet}
            rotuloAcessivel={`Lembrar ${listarNomes(
              faltam.map((f) => f.nome),
              totalQueFalta,
            )} de responder`}
            aoPressionar={pedirLembrete}
          />
        )
      }
      case 'publicar': {
        const n = lider?.avisariaAoPublicar ?? 0
        // Enquanto a resposta viaja o botão diz o que acontece: nunca "Publicado" antes de sair.
        if (publicacao === 'espera') {
          return (
            <Botao
              key={acao}
              titulo="Publicando..."
              variante={variante}
              carregando
              desabilitado
              aoPressionar={() => undefined}
            />
          )
        }
        if (publicacao === 'feito') {
          return (
            <Botao
              key={acao}
              titulo="Publicado"
              variante={variante}
              icone="check"
              desabilitado
              aoPressionar={() => undefined}
            />
          )
        }
        return (
          <Botao
            key={acao}
            titulo={n > 0 ? `Publicar e avisar ${pessoas(n)}` : 'Publicar'}
            variante={variante}
            desabilitado={semInternet}
            rotuloAcessivel={`Publicar o encontro ${evento?.titulo ?? ''}${
              n > 0 ? ` e avisar ${pessoas(n)}` : ''
            }`}
            aoPressionar={pedirPublicacao}
          />
        )
      }
      case 'convocarFuncao': {
        const funcao = (lider?.faltaFuncao[0] ?? '').toLocaleLowerCase('pt-BR')
        return (
          <Botao
            key={acao}
            titulo={`Convocar ${funcao}`}
            variante={variante}
            icone="pessoas"
            desabilitado={semInternet}
            aoPressionar={() => destinos.convocarFuncao(lider?.faltaFuncao[0] ?? '')}
          />
        )
      }
      case 'chamar':
        return (
          <Botao
            key={acao}
            titulo="Chamar quem vai"
            variante={variante}
            icone="pessoas"
            aoPressionar={destinos.verConvocados}
          />
        )
      case 'marcarProximo':
        return (
          <Botao
            key={acao}
            titulo="Marcar o próximo encontro"
            variante={variante}
            desabilitado={semInternet}
            aoPressionar={destinos.marcarProximo}
          />
        )
      case 'verResumo':
        return (
          <Botao
            key={acao}
            titulo="Ver o resumo"
            variante={variante}
            icone="documento"
            aoPressionar={() =>
              router.push({
                pathname: '/evento/[eventoId]',
                params: { eventoId: momento.recemTerminado?.id ?? '' },
              })
            }
          />
        )
      default:
        return botaoComum(acao, principal, alvoDoEncontro, destinos)
    }
  }

  // O caminho secundário é UM botão de verdade (D79). Havendo músicas, o repertório à mão vence o
  // "Ver o encontro" genérico (D73): o cartão inteiro já abre o encontro.
  const secundariaFinal =
    secundaria === 'ver' && musicas > 0 && primaria !== 'repertorio' ? 'repertorio' : secundaria
  const botoes = ordenarBotoes(
    botao(primaria, 'primario'),
    secundariaFinal ? botao(secundariaFinal, 'secundario') : null,
  )

  // ------------------------------------------------------------------ as linhas do cartão
  // Enxuto (D79): a data e a hora numa linha, UMA linha do que importa e, no máximo, um selo.
  let titulo: string
  let meta: string
  let corpo: ReactNode = null
  // "Nenhum encontro marcado." é uma frase de estado, não o nome de um encontro: título de seção (D83).
  let tituloComoFrase = false

  if (!evento && terminou && momento.recemTerminado) {
    const r = momento.recemTerminado
    titulo = r.titulo
    meta = dataEHoraDoCartao(r.inicio, r.fuso)
    corpo = (
      <Texto variante="corpo" peso="medio">
        {`O encontro terminou.${
          r.presentes !== null
            ? ` ${r.presentes} ${r.presentes === 1 ? 'presente' : 'presentes'}.`
            : ''
        }`}
      </Texto>
    )
  } else if (!evento) {
    titulo = 'Nenhum encontro marcado.'
    tituloComoFrase = true
    meta = 'Marque o próximo para a comunidade ver e responder.'
  } else {
    titulo = evento.titulo
    meta = dataEHoraDoCartao(evento.inicio, evento.fuso)
    // Sem andamento nem presentes não há o que dizer: a etiqueta do cartão já é "Acontecendo agora".
    const linhaDoAndamento = textoDoAndamento(andamento, lider?.presentes ?? 0, evento.fuso)
    const nomesQueFaltam = faltam.length > 0 ? textoDeQuemFalta(faltam, totalQueFalta) : ''
    const linhaDoEstado =
      evento.status === 'rascunho'
        ? 'Ainda não publicado. Ninguém foi avisado.'
        : dia === 'agora'
          ? linhaDoAndamento
          : naHoraDoCheckin
            ? `${confirmados(lider?.confirmados ?? 0)} ${lider?.inscritos ?? 0} ${
                (lider?.inscritos ?? 0) === 1 ? 'inscrito' : 'inscritos'
              }.`
            : (frasesDoQueFalta({
                convocados: lider?.convocados ?? 0,
                pendentes: lider?.pendentes ?? 0,
                quemFalta: nomesQueFaltam,
                lembrou: lembrados
                  ? `Você lembrou ${lembrados.nomes}, hoje às ${lembrados.hora}.`
                  : null,
                faltaFuncao: [],
                semMusicas: false,
              })[0]?.texto ?? null)
    const comSelo = evento.status !== 'rascunho' && dia !== 'agora' && !naHoraDoCheckin
    const selo = comSelo
      ? seloDoCartaoDoLider({
          primaria,
          faltaFuncao: lider?.faltaFuncao ?? [],
          semMusicas: musicas === 0,
        })
      : null
    corpo =
      linhaDoEstado || selo ? (
        <View style={{ gap: ESPACO.e8, alignItems: 'flex-start' }}>
          {linhaDoEstado ? (
            <Texto variante="corpo" peso="medio">
              {linhaDoEstado}
            </Texto>
          ) : null}
          {selo ? <SeloDoCartao texto={selo} /> : null}
        </View>
      ) : null
  }

  const etiqueta = etiquetaDoMomento(momento)
  const posicao = posicaoNoDia(momento)
  return (
    <CartaoDoMomento
      momento={dia}
      {...(poseDoEncanto ? { pose: poseDoEncanto } : {})}
      etiqueta={etiqueta}
      aoVivo={dia === 'agora'}
      chip={<ChipsDoTopo posicao={posicao} versaoSalva={versaoSalva} />}
      titulo={titulo}
      tituloComoFrase={tituloComoFrase}
      meta={meta}
      {...(evento ? { aoPressionar: destinos.abrirEncontro, dica: 'Abre o encontro.' } : {})}
      rotuloAcessivel={[etiqueta, posicao ? textoDaPosicao(posicao) : null, titulo, meta]
        .filter(Boolean)
        .join('. ')}
      acoes={
        <View style={{ gap: ESPACO.e8 }}>
          <ParDeBotoes empilhar>{botoes}</ParDeBotoes>
          {semInternetParaAvisar ? <LinhaDoMotivo texto={MOTIVO_SEM_INTERNET_PARA_AVISAR} /> : null}
        </View>
      }
    >
      {corpo || rodape ? (
        <View style={{ gap: ESPACO.e8 }}>
          {corpo}
          {rodape}
        </View>
      ) : null}
    </CartaoDoMomento>
  )
}

/**
 * "Agora: Louvor, até 16:20. Depois: Oração intercessora." Sem andamento, só os presentes (a
 * etiqueta do cartão já diz "Acontecendo agora"); sem eles, `null`.
 */
function textoDoAndamento(
  andamento: RetratoAoVivo | undefined,
  presentes: number,
  fuso: string,
): string | null {
  const atual = andamento?.etapas.find((e) => e.situacao === 'atual')
  if (!andamento || !atual) {
    return presentes > 0 ? `${presentes} ${presentes === 1 ? 'presente' : 'presentes'}.` : null
  }
  const proxima = andamento.etapas.find((e) => e.situacao === 'proxima')
  return `Agora: ${atual.titulo}, até ${formatarHora(atual.fimPrevisto, fuso)}. Depois: ${proxima?.titulo ?? 'Fim do roteiro'}.`
}
