import { ESPACO, RAIO, TIPO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { ErroDaTela } from '@/ui/Falha'
import { hojeNoFuso, type DataLocal } from '@/utilidades/datas'
import { Aviso } from '@/ui/Aviso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { BlocoDeEsqueleto, CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LayoutDividido, useLayoutLargo } from '@/ui/LayoutDividido'
import { Segmentos } from '@/ui/Segmentos'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { useEventosNoPeriodo } from '../eventos/consultas'
import { FolhaNovaProgramacao } from '../eventos/FolhaNovaProgramacao'
import { SemComunidade } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import {
  agruparPorDia,
  descreverPeriodo,
  intervaloDoModo,
  limitesParaApi,
  NOMES_DOS_PASSOS,
  passo,
  periodoTemHoje,
  type ModoDaAgenda,
} from './calendario'
import { CartaoDoDia, SobrancelhaDoDia } from './ListaDoDia'
import { ESQUELETO_DA_GRADE } from './medidas'
import { VistaDaSemana } from './VistaDaSemana'
import { ESCALA_DA_LISTA, VistaDoMes } from './VistaDoMes'

export function TelaAgenda() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <TelaDoApp titulo="Agenda">
        <SemComunidade oQue="a agenda" />
      </TelaDoApp>
    )
  }
  return <Agenda comunidadeId={comunidadeAtiva.id} />
}

/**
 * Agenda (3.3 e quadro 06): segmentos Mês, Semana e Lista; a linha do
 * período com o título em `tituloCartao`, o terciário "Hoje" (fora do
 * período atual) e os botões só ícone de anterior e próximo; a grade num
 * cartão de vidro e, abaixo, o dia escolhido. Com fonte grande, abre em Lista.
 */
function Agenda({ comunidadeId }: { comunidadeId: string }) {
  const fuso = useFusoDaComunidade()
  const pode = usePode()
  const podeCriar = pode('evento', 'criar')
  const largo = useLayoutLargo()
  const { fontScale } = useWindowDimensions()
  const hoje = hojeNoFuso(fuso)
  const [modo, setModo] = useState<ModoDaAgenda>(() =>
    fontScale >= ESCALA_DA_LISTA ? 'lista' : 'mes',
  )
  const [referencia, setReferencia] = useState<DataLocal>(hoje)
  const [selecionado, setSelecionado] = useState<DataLocal>(hoje)
  const intervalo = intervaloDoModo(modo, referencia)
  const { de, ate } = limitesParaApi(intervalo, fuso)
  const eventos = useEventosNoPeriodo(comunidadeId, de, ate)
  const porDia = agruparPorDia(eventos.data ?? [])
  const pronto = !eventos.isPending && !eventos.error

  function mover(sentido: 1 | -1) {
    const nova = passo(modo, referencia, sentido)
    setReferencia(nova)
    setSelecionado(modo === 'mes' ? nova : intervaloDoModo(modo, nova).inicio)
  }

  function irParaHoje() {
    setReferencia(hoje)
    setSelecionado(hoje)
  }

  const controles = (
    <>
      <Segmentos
        rotulo="Modo de exibição"
        valor={modo}
        aoMudar={(m) => {
          setModo(m)
          setReferencia(selecionado)
        }}
        segmentos={[
          { valor: 'mes', rotulo: 'Mês' },
          { valor: 'semana', rotulo: 'Semana' },
          { valor: 'lista', rotulo: 'Lista' },
        ]}
      />
      <LinhaDoPeriodo
        titulo={descreverPeriodo(modo, referencia)}
        nomes={NOMES_DOS_PASSOS[modo]}
        mostrarHoje={!periodoTemHoje(modo, referencia, hoje)}
        aoIrParaHoje={irParaHoje}
        aoMover={mover}
      />
    </>
  )

  const grade = eventos.isPending ? (
    eventos.fetchStatus === 'paused' ? (
      <Aviso tipo="alerta" titulo="Sem conexão: a agenda volta quando a internet voltar">
        O que foi preparado neste aparelho continua no Início.
      </Aviso>
    ) : (
      <EsqueletoDaAgenda modo={modo} />
    )
  ) : eventos.error ? (
    <ErroDaTela
      erro={eventos.error}
      oQue="a agenda"
      aoTentarDeNovo={() => void eventos.refetch()}
    />
  ) : modo === 'mes' ? (
    <VistaDoMes
      referencia={referencia}
      hoje={hoje}
      selecionado={selecionado}
      porDia={porDia}
      aoEscolher={setSelecionado}
    />
  ) : modo === 'semana' ? (
    <VistaDaSemana
      inicio={intervalo.inicio}
      hoje={hoje}
      selecionado={selecionado}
      porDia={porDia}
      aoEscolher={setSelecionado}
    />
  ) : (
    <VistaDeLista porDia={porDia} hoje={hoje} podeCriar={podeCriar} aoAvancar={() => mover(1)} />
  )

  const painelDoDia =
    modo !== 'lista' && pronto ? (
      <View style={{ gap: ESPACO.e8 }}>
        <SobrancelhaDoDia
          dia={selecionado}
          hoje={hoje}
          quantidade={porDia.get(selecionado)?.length ?? 0}
        />
        <CartaoDoDia
          dia={selecionado}
          eventos={porDia.get(selecionado) ?? []}
          podeCriar={podeCriar}
        />
      </View>
    ) : null

  // Atalho fixo para as escalas: quem pensa em calendário procura aqui (U-03).
  const escalas = (
    <Botao
      titulo="Minhas escalas"
      icone="escalas"
      variante="secundario"
      dica="Onde você serve e os dias em que não pode."
      aoPressionar={() => router.push('/escalas')}
    />
  )

  if (largo && modo !== 'lista') {
    return (
      <TelaDoApp titulo="Agenda" rolar={false} larga acaoComTexto={escalas}>
        <LayoutDividido
          rotuloDoDetalhe="Dia escolhido"
          lista={
            <>
              {controles}
              {grade}
            </>
          }
          detalhe={painelDoDia}
        />
      </TelaDoApp>
    )
  }

  return (
    <TelaDoApp titulo="Agenda" acaoComTexto={escalas}>
      {controles}
      {grade}
      {painelDoDia}
    </TelaDoApp>
  )
}

/**
 * Linha do período: o título à esquerda, anunciado quando muda; à direita,
 * "Hoje" (só fora do período atual) e os só ícone de 44 com 8 entre eles.
 * Com fonte grande, os botões descem para baixo do título.
 */
function LinhaDoPeriodo({
  titulo,
  nomes,
  mostrarHoje,
  aoIrParaHoje,
  aoMover,
}: {
  titulo: string
  nomes: { anterior: string; proximo: string }
  mostrarHoje: boolean
  aoIrParaHoje: () => void
  aoMover: (sentido: 1 | -1) => void
}) {
  const { fontScale } = useWindowDimensions()
  const empilhar = fontScale >= ESCALA_DA_LISTA
  return (
    <View
      style={{
        flexDirection: empilhar ? 'column' : 'row',
        alignItems: empilhar ? 'flex-start' : 'center',
        gap: ESPACO.e12,
      }}
    >
      <TextoAnunciado soMudancas variante="tituloCartao" style={empilhar ? null : { flex: 1 }}>
        {titulo}
      </TextoAnunciado>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
        {mostrarHoje ? (
          <Botao
            titulo="Hoje"
            variante="terciario"
            dica="Volta para o período de hoje."
            aoPressionar={aoIrParaHoje}
          />
        ) : null}
        <BotaoIcone icone="voltar" rotulo={nomes.anterior} aoPressionar={() => aoMover(-1)} />
        <BotaoIcone icone="avancar" rotulo={nomes.proximo} aoPressionar={() => aoMover(1)} />
      </View>
    </View>
  )
}

/** Esqueleto da grade (ou das listas), com a altura do que vai chegar. */
function EsqueletoDaAgenda({ modo }: { modo: ModoDaAgenda }) {
  const sobrancelha = Math.round(TIPO.sobrancelha.altura * 0.6)
  return (
    <Esqueleto rotulo="Carregando a agenda">
      {modo === 'lista' ? null : (
        <BlocoDeEsqueleto
          altura={modo === 'mes' ? ESQUELETO_DA_GRADE.mes : ESQUELETO_DA_GRADE.semana}
          raio={RAIO.cartao}
        />
      )}
      <BlocoDeEsqueleto largura="48%" altura={sobrancelha} />
      <CartaoDeEsqueleto />
      {modo === 'lista' ? (
        <>
          <BlocoDeEsqueleto largura="48%" altura={sobrancelha} />
          <CartaoDeEsqueleto />
        </>
      ) : null}
    </Esqueleto>
  )
}

/**
 * Lista (3.3.3): um grupo por dia, cada um com a sobrancelha (hoje com o
 * ponto coral e "Hoje") e um cartão lista com as linhas de evento. Vazio:
 * estado vazio com "Nova programação" para quem cria e o período seguinte
 * para os demais.
 */
function VistaDeLista({
  porDia,
  hoje,
  podeCriar,
  aoAvancar,
}: {
  porDia: Map<DataLocal, ResumoDoEvento[]>
  hoje: DataLocal
  podeCriar: boolean
  aoAvancar: () => void
}) {
  const [folhaAberta, setFolhaAberta] = useState(false)
  const dias = [...porDia.keys()].sort()
  if (dias.length === 0) {
    return (
      <>
        <EstadoVazio
          icone="agenda"
          titulo="Nada marcado neste período"
          descricao={
            podeCriar
              ? 'Crie a próxima programação para ela aparecer aqui.'
              : 'Quando a organização marcar algo, aparece aqui. Veja também os dias seguintes.'
          }
          acao={
            podeCriar
              ? {
                  titulo: 'Nova programação',
                  icone: 'adicionar',
                  aoPressionar: () => setFolhaAberta(true),
                }
              : {
                  titulo: 'Ver o período seguinte',
                  variante: 'secundario',
                  aoPressionar: aoAvancar,
                }
          }
        />
        {podeCriar ? (
          <FolhaNovaProgramacao aberta={folhaAberta} aoFechar={() => setFolhaAberta(false)} />
        ) : null}
      </>
    )
  }
  return (
    <>
      {dias.map((dia) => {
        const lista = porDia.get(dia) ?? []
        return (
          <View key={dia} style={{ gap: ESPACO.e8 }}>
            <SobrancelhaDoDia dia={dia} hoje={hoje} quantidade={lista.length} />
            <CartaoDoDia dia={dia} eventos={lista} podeCriar={false} comLinhaDoTempo={false} />
          </View>
        )
      })}
    </>
  )
}
