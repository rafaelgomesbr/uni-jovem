import { useMutation } from '@tanstack/react-query'
import { ESPACO, type PoseDoSol } from '@uj/tokens'
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { RetratoAoVivo } from '@/servicos/contratoDosEventos'
import { chamadasV3, type MomentoDoInicio, type ParteDoMomento } from '@/servicos/contratoV3'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDoMomento } from '@/ui/CartaoDoMomento'
import { Chip } from '@/ui/Chip'
import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { mostrarDesfazer, useDesfazerPendente } from '@/ui/ToastComDesfazer'
import { mostrarToast } from '@/ui/Toast'
import { formatarHora } from '@/utilidades/datas'

import { naComunidade, useInvalidarEventos } from '../eventos/consultas'
import type { TipoDeEncanto } from './encantos'
import {
  acoesDoLider,
  dataEHorario,
  descreverParte,
  etiquetaDoMomento,
  momentoDoDia,
  type AcaoDoMomento,
} from './momento'
import { dataCurta } from './quando'
import {
  botaoComum,
  LinhaDoMotivo,
  listarNomes,
  ordenarBotoes,
  pessoas,
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
  /** Funções do louvor confirmadas ("5 de 5"), ou `null` se a banda não está completa. */
  bandaCompleta: number | null
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

/** "Falta: bateria", "Falta: bateria, teclado". */
function textoDaFuncaoQueFalta(funcoes: readonly string[]): string {
  return `Falta: ${funcoes.map((f) => f.toLocaleLowerCase('pt-BR')).join(', ')}`
}

function musicasDoLouvor(n: number): string {
  return `Louvor: ${n} ${n === 1 ? 'música' : 'músicas'}`
}

function confirmados(n: number): string {
  return `${n} ${n === 1 ? 'confirmado' : 'confirmados'}.`
}

/**
 * O cartão do momento do LÍDER (3.2 do UX, D68): "o que falta resolver e qual é o próximo
 * passo do sábado". Os botões mais caros da semana moram aqui: "Lembrar os N" (chama a API e
 * espera 10 s com Desfazer, porque avisa pessoas) e "Publicar e avisar N pessoas" (idem). O
 * relógio troca o primário: lembrar, ver convocados, fazer check-in, conduzir ao vivo, marcar
 * o próximo sábado. Sem internet, o que avisa gente fica desabilitado com o motivo escrito.
 */
export function CartaoDoLider({
  comunidadeId,
  momento,
  partes,
  semInternet,
  versaoSalva,
  andamento,
  bandaCompleta,
  poseDoEncanto,
  aoEncanto,
  rodape,
}: Props) {
  const { cores } = useTema()
  const evento = momento.evento
  const lider = momento.lider
  const terminou = !evento && momento.recemTerminado !== null
  const destinos = useDestinosDoEncontro(evento ?? { id: momento.recemTerminado?.id ?? '' })
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
    const n = lider?.avisariaAoPublicar ?? 0
    setPublicacao('espera')
    aoEncanto('publicou', 'Seu primeiro encontro está no ar.')
    mostrarDesfazer({
      texto: n > 0 ? `Publicando e avisando ${pessoas(n)}.` : 'Publicando o encontro.',
      aoDesfazer: () => setPublicacao('nao'),
      aoConfirmar: () => publicar.mutate(),
    })
  }

  // ------------------------------------------------------------------ o que o botão faz
  const dia = momentoDoDia(momento)
  const naHoraDoCheckin = dia === 'dia' && (momento.minutosParaInicio ?? Infinity) <= 120
  const calculadas = acoesDoLider({
    momento: dia,
    rascunho: evento?.status === 'rascunho',
    lembraveis: lider?.lembraveis ?? 0,
    pendentes: lider?.pendentes ?? 0,
    faltaFuncao: lider?.faltaFuncao ?? [],
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

  function botao(acao: AcaoDoMomento, principal: boolean) {
    const variante = principal ? 'primario' : 'secundario'
    const alvoDoEncontro = evento ?? { titulo: momento.recemTerminado?.titulo ?? '' }
    switch (acao) {
      case 'lembrar': {
        if (lembrete === 'espera') {
          return (
            <Botao
              key={acao}
              titulo={`Enviando em ${esperaDoToast?.restante ?? 10} s`}
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
            titulo={`Lembrar os ${lider?.lembraveis ?? 0}`}
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
        if (publicacao !== 'nao') {
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
            desabilitado={semInternet}
            aoPressionar={destinos.verConvocados}
          />
        )
      }
      case 'marcarProximo':
        return (
          <Botao
            key={acao}
            titulo="Marcar o próximo sábado"
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

  const botoes = ordenarBotoes(botao(primaria, true), secundaria ? botao(secundaria, false) : null)

  // ------------------------------------------------------------------ as linhas do cartão
  const rotuloDaParte = partes.filter((p) => p.estado !== 'recusada').map(descreverParte)
  const todosResponderam = !!lider && lider.convocados > 0 && lider.pendentes === 0
  const abertoParaVer = evento && evento.status !== 'rascunho'

  let titulo: string
  let meta: string
  let corpo: ReactNode = null

  if (!evento && terminou && momento.recemTerminado) {
    const r = momento.recemTerminado
    titulo = r.titulo
    meta = `${dataCurta(r.inicio, r.fuso)} · ${formatarHora(r.inicio, r.fuso)}`
    corpo = (
      <Texto variante="rotulo">
        {`${r.titulo} terminou.${
          r.presentes !== null
            ? ` ${r.presentes} ${r.presentes === 1 ? 'presente' : 'presentes'}.`
            : ''
        }`}
      </Texto>
    )
  } else if (!evento) {
    titulo = 'Nenhum encontro marcado.'
    meta = 'O Sábado padrão já vem com o roteiro de sempre.'
  } else {
    titulo = evento.titulo
    meta = [dataEHorario(evento.inicio, evento.duracaoMin, evento.fuso), evento.local?.nome]
      .filter(Boolean)
      .join('\n')
    corpo = (
      <View style={{ gap: ESPACO.e8 }}>
        {evento.status === 'rascunho' ? (
          <Texto variante="rotulo">Ainda não publicado. Ninguém foi avisado.</Texto>
        ) : dia === 'agora' ? (
          <Texto variante="rotulo">
            {textoDoAndamento(andamento, lider?.presentes ?? 0, evento.fuso)}
          </Texto>
        ) : naHoraDoCheckin ? (
          <Texto variante="rotulo">{`${confirmados(lider?.confirmados ?? 0)} ${lider?.inscritos ?? 0} ${
            (lider?.inscritos ?? 0) === 1 ? 'inscrito' : 'inscritos'
          }.`}</Texto>
        ) : dia === 'vespera' || dia === 'dia' ? (
          <Texto variante="rotulo">
            {`${confirmados(lider?.confirmados ?? 0)}${
              lider && lider.faltaFuncao.length
                ? ` ${textoDaFuncaoQueFalta(lider.faltaFuncao)}.`
                : ''
            }`}
          </Texto>
        ) : lider && lider.convocados > 0 ? (
          <>
            <Texto variante="rotulo">{`${lider.responderam} de ${lider.convocados} responderam`}</Texto>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
              <View style={{ flex: 1 }}>
                <BarraDeProgresso
                  fracao={lider.responderam / lider.convocados}
                  rotulo={`${lider.responderam} de ${lider.convocados} responderam`}
                  trilho="tonal"
                />
              </View>
              <Texto variante="legenda" cor="textoSuave" tabular>
                {`${lider.responderam}/${lider.convocados}`}
              </Texto>
            </View>
            {lembrados ? (
              <Texto variante="meta">
                {`Você lembrou ${lembrados.nomes}, hoje às ${lembrados.hora}.`}
              </Texto>
            ) : todosResponderam ? (
              <Texto variante="meta">Todos responderam ✓</Texto>
            ) : faltam.length > 0 ? (
              <Texto variante="meta">{textoDeQuemFalta(faltam, totalQueFalta)}</Texto>
            ) : (lider.pendentes ?? 0) > 0 ? (
              <Texto variante="meta">Quem falta já foi lembrado hoje.</Texto>
            ) : null}
            {lider.faltaFuncao.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
                <Icone nome="avisoAlerta" cor={cores.alerta} tamanho={16} />
                <Texto variante="meta" style={{ flex: 1 }}>
                  {textoDaFuncaoQueFalta(lider.faltaFuncao)}
                </Texto>
              </View>
            ) : null}
            <Texto variante="legenda" cor="textoSuave">
              {musicasDoLouvor(lider.musicas)}
            </Texto>
          </>
        ) : (
          <Texto variante="rotulo">Ninguém foi convocado ainda.</Texto>
        )}
        {abertoParaVer && bandaCompleta !== null && dia !== 'agora' ? (
          <Chip
            tom="sucesso"
            icone="check"
            texto={`Banda completa: ${bandaCompleta} de ${bandaCompleta}.`}
          />
        ) : null}
        {rotuloDaParte.length > 0 ? (
          <Texto
            variante="legenda"
            cor="textoSuave"
          >{`Sua parte: ${rotuloDaParte.join(', ')}`}</Texto>
        ) : null}
      </View>
    )
  }

  const etiqueta = etiquetaDoMomento(momento)
  return (
    <CartaoDoMomento
      momento={dia}
      {...(poseDoEncanto ? { pose: poseDoEncanto } : {})}
      etiqueta={etiqueta}
      aoVivo={dia === 'agora'}
      {...(versaoSalva
        ? { chip: <Chip tom="neutro" texto={`Última versão: ${versaoSalva}`} /> }
        : {})}
      titulo={titulo}
      meta={meta}
      {...(evento ? { aoPressionar: destinos.abrirEncontro, dica: 'Abre o encontro.' } : {})}
      rotuloAcessivel={[etiqueta, titulo, meta.replace('\n', ', ')].join('. ')}
      acoes={
        <View style={{ gap: ESPACO.e8 }}>
          <ParDeBotoes>{botoes}</ParDeBotoes>
          {semInternetParaAvisar ? <LinhaDoMotivo texto={MOTIVO_SEM_INTERNET_PARA_AVISAR} /> : null}
        </View>
      }
    >
      <View style={{ gap: ESPACO.e8 }}>
        {corpo}
        {rodape}
      </View>
    </CartaoDoMomento>
  )
}

/** "Agora: Louvor, até 16:20. Depois: Oração intercessora." (ou o resumo simples sem andamento). */
function textoDoAndamento(
  andamento: RetratoAoVivo | undefined,
  presentes: number,
  fuso: string,
): string {
  const atual = andamento?.etapas.find((e) => e.situacao === 'atual')
  if (!andamento || !atual) {
    return presentes > 0
      ? `Acontecendo agora. ${presentes} ${presentes === 1 ? 'presente' : 'presentes'}.`
      : 'Acontecendo agora.'
  }
  const proxima = andamento.etapas.find((e) => e.situacao === 'proxima')
  return `Agora: ${atual.titulo}, até ${formatarHora(atual.fimPrevisto, fuso)}. Depois: ${proxima?.titulo ?? 'Fim do roteiro'}.`
}
