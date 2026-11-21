import { ESPACO, RAIO, TIPO } from '@uj/tokens'
import { useLocalSearchParams } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { ErroDaTela } from '@/ui/Falha'
import { hojeNoFuso, type DataLocal } from '@/utilidades/datas'
import { Aviso } from '@/ui/Aviso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { BlocoDeEsqueleto, CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { LayoutDividido, useLayoutLargo } from '@/ui/LayoutDividido'
import { Segmentos } from '@/ui/Segmentos'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { parametro } from '@/utilidades/parametros'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { useEventosNoPeriodo } from '../eventos/consultas'
import { FolhaNovaProgramacao } from '../eventos/FolhaNovaProgramacao'
import { ListaDeEncontros } from '../eventos/ListaDeEncontros'
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
import { ESCALA_DA_LISTA, VistaDoMes } from './VistaDoMes'

export type VistaDaAgenda = 'calendario' | 'lista'

/** `/agenda?vista=lista` (o redirecionamento da antiga aba Programas) abre na Lista. */
function vistaDoParametro(valor: string | null): VistaDaAgenda | null {
  return valor === 'calendario' || valor === 'lista' ? valor : null
}

export function TelaAgenda() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <TelaDoApp titulo="Agenda">
        <SemComunidade oQue="a agenda" />
      </TelaDoApp>
    )
  }
  return <AgendaDaComunidade comunidadeId={comunidadeAtiva.id} />
}

/**
 * Aba Agenda (D57, D62): junta a lista dos encontros (a antiga aba Programas,
 * 3.4.1) e o calendário (3.3), com o seletor "Lista | Calendário" no topo e
 * "Novo encontro" ao lado do título para quem cria (Sábado padrão, Em branco
 * ou A partir de modelo). Abre sempre na Lista; o Calendário é a opção
 * secundária, para achar um dia distante, e só tem o mês (sem "Semana").
 */
function AgendaDaComunidade({ comunidadeId }: { comunidadeId: string }) {
  const pode = usePode()
  const podeCriar = pode('evento', 'criar')
  const pedida = vistaDoParametro(parametro(useLocalSearchParams<{ vista?: string }>().vista))
  // Abre na Lista (D62): quem abre a agenda quer ver o próximo encontro, não 7 pontinhos num mês.
  const [vista, setVista] = useState<VistaDaAgenda>(() => pedida ?? 'lista')
  // A aba fica montada: um link novo (`?vista=`) troca o modo já aberto.
  const [ultimaPedida, setUltimaPedida] = useState(pedida)
  if (pedida !== ultimaPedida) {
    setUltimaPedida(pedida)
    if (pedida) setVista(pedida)
  }
  const [folhaAberta, setFolhaAberta] = useState(false)
  const abrirFolha = () => setFolhaAberta(true)

  const seletor = (
    <Segmentos
      rotulo="Como ver a agenda"
      valor={vista}
      aoMudar={setVista}
      segmentos={[
        { valor: 'lista', rotulo: 'Lista' },
        { valor: 'calendario', rotulo: 'Calendário' },
      ]}
    />
  )
  // Criar é a ação principal: "Novo encontro" escrito, não só um "+" (auditoria U-06).
  const acao = podeCriar ? (
    <Botao
      titulo="Novo encontro"
      icone="adicionar"
      variante="secundario"
      aoPressionar={abrirFolha}
    />
  ) : undefined

  return (
    <>
      {vista === 'lista' ? (
        <ListaDeEncontros
          comunidadeId={comunidadeId}
          seletor={seletor}
          {...(acao ? { acao } : {})}
          aoCriar={abrirFolha}
          aoVerCalendario={() => setVista('calendario')}
        />
      ) : (
        <Calendario comunidadeId={comunidadeId} seletor={seletor} {...(acao ? { acao } : {})} />
      )}
      {podeCriar ? (
        <FolhaNovaProgramacao aberta={folhaAberta} aoFechar={() => setFolhaAberta(false)} />
      ) : null}
    </>
  )
}

/** Só o mês (D62): para 1 a 3 encontros por semana, a Lista e o mês bastam; "Semana" saiu. */
type ModoDoCalendario = Extract<ModoDaAgenda, 'mes'>

/**
 * Calendário (3.3 e quadro 06): só o mês; a linha do período
 * com o título em `tituloCartao`, o terciário "Hoje" (fora do período atual)
 * e os botões só ícone de anterior e próximo; a grade num cartão de vidro e,
 * abaixo, o dia escolhido.
 */
function Calendario({
  comunidadeId,
  seletor,
  acao,
}: {
  comunidadeId: string
  seletor: ReactNode
  acao?: ReactNode
}) {
  const fuso = useFusoDaComunidade()
  const pode = usePode()
  const podeCriar = pode('evento', 'criar')
  const largo = useLayoutLargo()
  const hoje = hojeNoFuso(fuso)
  const modo: ModoDoCalendario = 'mes'
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
    setSelecionado(nova)
  }

  function irParaHoje() {
    setReferencia(hoje)
    setSelecionado(hoje)
  }

  const controles = (
    <>
      {seletor}
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
        O que foi baixado neste aparelho continua no Início.
      </Aviso>
    ) : (
      <EsqueletoDaAgenda />
    )
  ) : eventos.error ? (
    <ErroDaTela
      erro={eventos.error}
      oQue="a agenda"
      aoTentarDeNovo={() => void eventos.refetch()}
    />
  ) : (
    <VistaDoMes
      referencia={referencia}
      hoje={hoje}
      selecionado={selecionado}
      porDia={porDia}
      aoEscolher={setSelecionado}
    />
  )

  const painelDoDia = pronto ? (
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

  if (largo) {
    return (
      <TelaDoApp titulo="Agenda" rolar={false} larga {...(acao ? { acaoComTexto: acao } : {})}>
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
    <TelaDoApp titulo="Agenda" {...(acao ? { acaoComTexto: acao } : {})}>
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

/** Esqueleto da grade, com a altura do que vai chegar. */
function EsqueletoDaAgenda() {
  const sobrancelha = Math.round(TIPO.sobrancelha.altura * 0.6)
  return (
    <Esqueleto rotulo="Carregando a agenda">
      <BlocoDeEsqueleto altura={ESQUELETO_DA_GRADE.mes} raio={RAIO.cartao} />
      <BlocoDeEsqueleto largura="48%" altura={sobrancelha} />
      <CartaoDeEsqueleto />
    </Esqueleto>
  )
}
