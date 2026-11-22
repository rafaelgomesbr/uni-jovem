import { useMutation } from '@tanstack/react-query'
import { ESPACO, type PoseDoSol } from '@uj/tokens'
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { RetratoAoVivo } from '@/servicos/contratoDosEventos'
import { chamadasV3, type MomentoDoInicio, type ParteDoMomento } from '@/servicos/contratoV3'
import { Acordeao } from '@/ui/Acordeao'
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
  estaNoLouvor,
  etiquetaDoMomento,
  frasesDoQueFalta,
  momentoDoDia,
  textoDaFuncaoQueFalta,
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

function musicasDoLouvor(n: number): string {
  return `Louvor: ${n} ${n === 1 ? 'música' : 'músicas'}`
}

function confirmados(n: number): string {
  return `${n} ${n === 1 ? 'confirmado' : 'confirmados'}.`
}

/**
 * O cartão do momento do LÍDER (3.2 do UX, D68 e D75): "o que falta resolver e qual é o próximo
 * passo do encontro". UMA ação em destaque, que muda depois de feita (ver `acoesDoLider`), no
 * máximo 2 frases do que falta e o resto recolhido em "Ver detalhes". Os botões mais caros da
 * semana moram aqui: "Lembrar os N" (chama a API e espera 10 s com Desfazer, porque avisa
 * pessoas) e "Publicar e avisar N pessoas" (idem). O caminho secundário é um link de texto, menos
 * o "Marcar quem chegou" durante o encontro, que é botão. Sem internet, o que avisa gente fica
 * desabilitado com o motivo escrito.
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
    semMusicas: (evento?.musicas ?? lider?.musicas ?? 0) === 0,
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

  /** `modo`: o botão em destaque, um botão ao lado dele, ou só um link de texto (o caminho secundário). */
  function botao(acao: AcaoDoMomento, modo: 'primario' | 'secundario' | 'link') {
    const principal = modo === 'primario'
    const variante = principal ? 'primario' : modo === 'link' ? 'terciario' : 'secundario'
    const alinhado = modo === 'link' ? { alinhado: true as const } : {}
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
            {...alinhado}
            aoPressionar={() =>
              router.push({
                pathname: '/evento/[eventoId]',
                params: { eventoId: momento.recemTerminado?.id ?? '' },
              })
            }
          />
        )
      default:
        return botaoComum(acao, principal, alvoDoEncontro, destinos, modo === 'link')
    }
  }

  // Só o check-in do encontro é botão ao lado do primário; os outros caminhos são links embaixo.
  const secundariaEhBotao = secundaria === 'checkin'
  const botoes = ordenarBotoes(
    botao(primaria, 'primario'),
    secundaria && secundariaEhBotao ? botao(secundaria, 'secundario') : null,
  )
  const linkSecundario = secundaria && !secundariaEhBotao ? botao(secundaria, 'link') : null

  // ------------------------------------------------------------------ as linhas do cartão
  const rotuloDaParte = partes.filter((p) => p.estado !== 'recusada').map(descreverParte)
  const abertoParaVer = evento && evento.status !== 'rascunho'
  const musicas = evento?.musicas ?? lider?.musicas ?? 0

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
    meta = 'Marque o próximo para a comunidade ver e responder.'
  } else {
    titulo = evento.titulo
    meta = [dataEHorario(evento.inicio, evento.duracaoMin, evento.fuso), evento.local?.nome]
      .filter(Boolean)
      .join('\n')
    // Sem andamento nem presentes não há o que dizer: a etiqueta do cartão já é "Acontecendo agora".
    const linhaDoAndamento = textoDoAndamento(andamento, lider?.presentes ?? 0, evento.fuso)
    const nomesQueFaltam = faltam.length > 0 ? textoDeQuemFalta(faltam, totalQueFalta) : ''
    const todosResponderam = !!lider && lider.convocados > 0 && lider.pendentes === 0
    // O que falta, em no máximo 2 frases (D75); o resto vai para "Ver detalhes".
    const frases =
      evento.status === 'rascunho'
        ? [{ texto: 'Ainda não publicado. Ninguém foi avisado.', alerta: false }]
        : dia === 'agora'
          ? linhaDoAndamento
            ? [{ texto: linhaDoAndamento, alerta: false }]
            : []
          : naHoraDoCheckin
            ? [
                {
                  texto: `${confirmados(lider?.confirmados ?? 0)} ${lider?.inscritos ?? 0} ${
                    (lider?.inscritos ?? 0) === 1 ? 'inscrito' : 'inscritos'
                  }.`,
                  alerta: false,
                },
              ]
            : frasesDoQueFalta({
                convocados: lider?.convocados ?? 0,
                pendentes: lider?.pendentes ?? 0,
                quemFalta: nomesQueFaltam,
                lembrou: lembrados
                  ? `Você lembrou ${lembrados.nomes}, hoje às ${lembrados.hora}.`
                  : null,
                faltaFuncao: lider?.faltaFuncao ?? [],
                semMusicas: musicas === 0,
              })
    // O que não é "o que falta" fica recolhido: o andamento da resposta, a banda e a parte da pessoa.
    const temResposta = !!lider && lider.convocados > 0 && !naHoraDoCheckin && dia !== 'agora'
    const temDetalhes =
      evento.status !== 'rascunho' &&
      (temResposta ||
        (abertoParaVer && bandaCompleta !== null && dia !== 'agora') ||
        rotuloDaParte.length > 0)
    corpo = (
      <View style={{ gap: ESPACO.e8 }}>
        {frases.map((f) =>
          f.alerta ? (
            <View
              key={f.texto}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e8 }}
            >
              <Icone nome="avisoAlerta" cor={cores.alerta} tamanho={18} />
              <Texto variante="rotulo" style={{ flex: 1 }}>
                {f.texto}
              </Texto>
            </View>
          ) : (
            <Texto key={f.texto} variante="rotulo">
              {f.texto}
            </Texto>
          ),
        )}
        {temDetalhes ? (
          <Acordeao
            chave="detalhes-do-cartao"
            cabecalho={() => <Texto variante="botao">Ver detalhes</Texto>}
            rotuloRecolhido="Ver detalhes do encontro. Recolhido."
            rotuloAberto="Detalhes do encontro. Aberto."
          >
            <View style={{ gap: ESPACO.e8, paddingBottom: ESPACO.e4 }}>
              {temResposta && lider ? (
                <>
                  <Texto variante="meta">{`${lider.responderam} de ${lider.convocados} responderam`}</Texto>
                  <BarraDeProgresso
                    fracao={lider.responderam / lider.convocados}
                    rotulo={`${lider.responderam} de ${lider.convocados} responderam`}
                    trilho="tonal"
                  />
                  {faltam.length > 0 && !lembrados ? (
                    <Texto variante="meta">{textoDeQuemFalta(faltam, totalQueFalta)}</Texto>
                  ) : null}
                  <Texto variante="meta" cor="textoSuave">
                    {musicasDoLouvor(musicas)}
                  </Texto>
                </>
              ) : null}
              {abertoParaVer && bandaCompleta !== null && dia !== 'agora' ? (
                <Chip
                  tom="sucesso"
                  icone="check"
                  texto={`Banda completa: ${bandaCompleta} de ${bandaCompleta}.`}
                />
              ) : null}
              {rotuloDaParte.length > 0 ? (
                <Texto
                  variante="meta"
                  cor="textoSuave"
                >{`Sua parte: ${rotuloDaParte.join(', ')}`}</Texto>
              ) : null}
            </View>
          </Acordeao>
        ) : null}
        {/* Havendo músicas o repertório fica à mão em qualquer momento, mesmo fora do cartão (D73). */}
        {musicas > 0 && primaria !== 'repertorio' && secundaria !== 'repertorio' ? (
          <Botao
            titulo={destinos.rotuloDoRepertorio}
            variante="terciario"
            alinhado
            icone="musica"
            tamanho="compacto"
            rotuloAcessivel={`${destinos.rotuloDoRepertorio}: ${evento.titulo}`}
            aoPressionar={destinos.repertorio}
          />
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
          <ParDeBotoes larguraMinima={150}>{botoes}</ParDeBotoes>
          {linkSecundario}
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
