import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import {
  formatarDataPorExtenso,
  formatarDiaCurto,
  hojeNoFuso,
  nomeDoMesEAno,
  somarDias,
  type DataLocal,
} from '@/utilidades/datas'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LayoutDividido, useLayoutLargo } from '@/ui/LayoutDividido'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { useEventosNoPeriodo } from '../eventos/consultas'
import { LinhaDoEvento } from '../eventos/LinhaDoEvento'
import { SemComunidade } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import {
  agruparPorDia,
  contarEventos,
  DIAS_DA_LISTA,
  intervaloDoModo,
  limitesParaApi,
  passo,
  type ModoDaAgenda,
} from './calendario'
import { VistaDoMes } from './VistaDoMes'

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

function abrirEvento(id: string) {
  router.push({ pathname: '/evento/[eventoId]', params: { eventoId: id } })
}

function abrirDia(data: DataLocal) {
  router.push({ pathname: '/agenda/[data]', params: { data } })
}

function Agenda({ comunidadeId }: { comunidadeId: string }) {
  const fuso = useFusoDaComunidade()
  const pode = usePode()
  const largo = useLayoutLargo()
  const hoje = hojeNoFuso(fuso)
  const [modo, setModo] = useState<ModoDaAgenda>('mes')
  const [referencia, setReferencia] = useState<DataLocal>(hoje)
  const [selecionado, setSelecionado] = useState<DataLocal>(hoje)
  const intervalo = intervaloDoModo(modo, referencia)
  const { de, ate } = limitesParaApi(intervalo, fuso)
  const eventos = useEventosNoPeriodo(comunidadeId, de, ate)
  const porDia = agruparPorDia(eventos.data ?? [])

  const titulo =
    modo === 'mes'
      ? nomeDoMesEAno(referencia)
      : modo === 'semana'
        ? `Semana de ${formatarDiaCurto(intervalo.inicio)} a ${formatarDiaCurto(somarDias(intervalo.fim, -1))}`
        : `De ${formatarDiaCurto(intervalo.inicio)} a ${formatarDiaCurto(somarDias(intervalo.fim, -1))}`
  const nomeDoPasso =
    modo === 'mes' ? 'Mês' : modo === 'semana' ? 'Semana' : `${DIAS_DA_LISTA} dias`

  function mover(sentido: 1 | -1) {
    const nova = passo(modo, referencia, sentido)
    setReferencia(nova)
    setSelecionado(modo === 'mes' ? nova : intervaloDoModo(modo, nova).inicio)
  }

  const controles = (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Botao
          titulo="Minhas escalas"
          icone="escalas"
          variante="secundario"
          larguraTotal={false}
          aoPressionar={() => router.push('/escalas')}
        />
        <Botao
          titulo="Linha do tempo de hoje"
          icone="relogio"
          variante="secundario"
          larguraTotal={false}
          aoPressionar={() => abrirDia(hoje)}
        />
      </View>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
        <Botao
          titulo="Anterior"
          icone="voltar"
          variante="secundario"
          larguraTotal={false}
          rotuloAcessivel={`Anterior: ${nomeDoPasso.toLowerCase()} anterior`}
          aoPressionar={() => mover(-1)}
        />
        <TextoAnunciado soMudancas variante="tituloItem" centralizado style={{ flex: 1 }}>
          {titulo}
        </TextoAnunciado>
        <Botao
          titulo="Próximo"
          variante="secundario"
          larguraTotal={false}
          rotuloAcessivel={`Próximo: ${nomeDoPasso.toLowerCase()} seguinte`}
          aoPressionar={() => mover(1)}
        />
      </View>
      <Botao
        titulo="Voltar para hoje"
        variante="terciario"
        larguraTotal={false}
        aoPressionar={() => {
          setReferencia(hoje)
          setSelecionado(hoje)
        }}
      />
    </>
  )

  const conteudo = eventos.isPending ? (
    <Carregando texto="Carregando a agenda" />
  ) : eventos.error ? (
    <AvisoDeErro erro={eventos.error} aoTentarDeNovo={() => void eventos.refetch()} />
  ) : modo === 'mes' ? (
    <Cartao>
      <VistaDoMes
        referencia={referencia}
        hoje={hoje}
        selecionado={selecionado}
        porDia={porDia}
        aoEscolher={setSelecionado}
      />
    </Cartao>
  ) : modo === 'semana' ? (
    <VistaDaSemana inicio={intervalo.inicio} hoje={hoje} porDia={porDia} />
  ) : (
    <VistaDeLista porDia={porDia} hoje={hoje} podeCriar={pode('evento', 'criar')} />
  )

  const painelDoDia =
    modo === 'mes' && !eventos.isPending && !eventos.error ? (
      <PainelDoDia dia={selecionado} hoje={hoje} eventos={porDia.get(selecionado) ?? []} />
    ) : null

  if (largo && modo === 'mes') {
    return (
      <TelaDoApp titulo="Agenda" rolar={false} larga>
        <LayoutDividido
          rotuloDoDetalhe="Dia escolhido"
          lista={
            <>
              {controles}
              {conteudo}
            </>
          }
          detalhe={painelDoDia}
        />
      </TelaDoApp>
    )
  }

  return (
    <TelaDoApp titulo="Agenda">
      {controles}
      {conteudo}
      {painelDoDia}
    </TelaDoApp>
  )
}

function PainelDoDia({
  dia,
  hoje,
  eventos,
}: {
  dia: DataLocal
  hoje: DataLocal
  eventos: ResumoDoEvento[]
}) {
  return (
    <Cartao
      titulo={`${formatarDataPorExtenso(dia)}${dia === hoje ? ' (hoje)' : ''}`}
      icone="agenda"
    >
      {eventos.length === 0 ? (
        <Texto variante="legenda" cor="textoSuave">
          Nada marcado para este dia.
        </Texto>
      ) : (
        <View style={{ gap: ESPACO.e8 }}>
          {eventos.map((e) => (
            <LinhaDoEvento
              key={e.id}
              evento={e}
              fuso={e.fuso}
              soHora
              aoPressionar={() => abrirEvento(e.id)}
            />
          ))}
          <Botao
            titulo="Ver a linha do tempo do dia"
            icone="relogio"
            variante="secundario"
            aoPressionar={() => abrirDia(dia)}
          />
        </View>
      )}
    </Cartao>
  )
}

function VistaDaSemana({
  inicio,
  hoje,
  porDia,
}: {
  inicio: DataLocal
  hoje: DataLocal
  porDia: Map<DataLocal, ResumoDoEvento[]>
}) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
  return (
    <View style={{ gap: ESPACO.e12 }}>
      {dias.map((dia) => {
        const lista = porDia.get(dia) ?? []
        return (
          <Cartao
            key={dia}
            titulo={`${formatarDataPorExtenso(dia, false)}${dia === hoje ? ' (hoje)' : ''}`}
          >
            {lista.length === 0 ? (
              <Texto variante="legenda" cor="textoSuave">
                Sem eventos.
              </Texto>
            ) : (
              <View style={{ gap: ESPACO.e8 }}>
                {lista.map((e) => (
                  <LinhaDoEvento
                    key={e.id}
                    evento={e}
                    fuso={e.fuso}
                    soHora
                    aoPressionar={() => abrirEvento(e.id)}
                  />
                ))}
                <Botao
                  titulo="Linha do tempo"
                  icone="relogio"
                  variante="terciario"
                  larguraTotal={false}
                  rotuloAcessivel={`Linha do tempo: ${formatarDataPorExtenso(dia)}`}
                  aoPressionar={() => abrirDia(dia)}
                />
              </View>
            )}
          </Cartao>
        )
      })}
    </View>
  )
}

function VistaDeLista({
  porDia,
  hoje,
  podeCriar,
}: {
  porDia: Map<DataLocal, ResumoDoEvento[]>
  hoje: DataLocal
  podeCriar: boolean
}) {
  const dias = [...porDia.keys()].sort()
  if (dias.length === 0) {
    return (
      <Cartao>
        <EstadoVazio
          icone="agenda"
          titulo="Nada marcado neste período"
          descricao={
            podeCriar
              ? 'Crie a próxima programação para ela aparecer aqui.'
              : 'Avance para os próximos dias ou volte mais tarde.'
          }
          {...(podeCriar
            ? {
                acao: {
                  titulo: 'Nova programação',
                  icone: 'adicionar' as const,
                  aoPressionar: () => router.push('/evento/novo'),
                },
              }
            : {})}
        />
      </Cartao>
    )
  }
  return (
    <View style={{ gap: ESPACO.e12 }}>
      {dias.map((dia) => (
        <View key={dia} style={{ gap: ESPACO.e8 }}>
          <Texto variante="tituloItem" accessibilityRole="header">
            {formatarDataPorExtenso(dia)}
            {dia === hoje ? ' (hoje)' : ''} · {contarEventos(porDia.get(dia)!.length)}
          </Texto>
          {porDia.get(dia)!.map((e) => (
            <LinhaDoEvento
              key={e.id}
              evento={e}
              fuso={e.fuso}
              soHora
              aoPressionar={() => abrirEvento(e.id)}
            />
          ))}
        </View>
      ))}
    </View>
  )
}
