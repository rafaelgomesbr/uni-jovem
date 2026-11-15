import { useQuery } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type {
  DetalheDoEvento,
  ResumoDoEvento,
  RetratoAoVivo,
  SituacaoDaEtapaAoVivo,
} from '@/servicos/contratoDosEventos'
import {
  dataValidaOuNula,
  formatarDataPorExtenso,
  formatarDuracao,
  formatarHora,
  hojeNoFuso,
  somarDias,
  type DataLocal,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Icone } from '@/ui/Icone'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { naComunidade, useEvento, useEventosNoPeriodo } from '../eventos/consultas'
import { COR_DO_STATUS, NOME_DO_STATUS } from '../eventos/nomes'
import { podeIrAoVivo } from '../eventos/regras'
import { SemComunidade } from '../navegacao/SemComunidade'
import { limitesParaApi } from './calendario'

/** Rota `/agenda/[data]`: as etapas de cada evento do dia, com hora, duração e progresso. */
export function TelaTimelineDoDia() {
  const { comunidadeAtiva } = useSessao()
  const fuso = useFusoDaComunidade()
  const dataDaRota = dataValidaOuNula(parametro(useLocalSearchParams<{ data: string }>().data))
  const data = dataDaRota ?? hojeNoFuso(fuso)
  if (!comunidadeAtiva) {
    return (
      <Tela cabecalhoNativo>
        <SemComunidade oQue="a agenda" />
      </Tela>
    )
  }
  return <Timeline comunidadeId={comunidadeAtiva.id} data={data} fuso={fuso} />
}

function Timeline({
  comunidadeId,
  data,
  fuso,
}: {
  comunidadeId: string
  data: DataLocal
  fuso: string
}) {
  const { de, ate } = limitesParaApi({ inicio: data, fim: somarDias(data, 1) }, fuso)
  const eventos = useEventosNoPeriodo(comunidadeId, de, ate)
  const hoje = hojeNoFuso(fuso)
  const visiveis = (eventos.data ?? []).filter((e) => e.status !== 'cancelado')

  return (
    <Tela
      cabecalhoNativo
      titulo="Linha do tempo"
      descricao={`${formatarDataPorExtenso(data)}${data === hoje ? ' (hoje)' : ''}`}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        <Botao
          titulo="Dia anterior"
          icone="voltar"
          variante="secundario"
          larguraTotal={false}
          aoPressionar={() => router.setParams({ data: somarDias(data, -1) })}
        />
        <Botao
          titulo="Dia seguinte"
          variante="secundario"
          larguraTotal={false}
          aoPressionar={() => router.setParams({ data: somarDias(data, 1) })}
        />
      </View>
      {eventos.isPending ? (
        <Carregando texto="Carregando o dia" />
      ) : eventos.error ? (
        <AvisoDeErro erro={eventos.error} aoTentarDeNovo={() => void eventos.refetch()} />
      ) : visiveis.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone="agenda"
            titulo="Nenhum evento neste dia"
            descricao="Escolha outro dia na agenda para ver a programação dele."
            acao={{ titulo: 'Voltar para a agenda', aoPressionar: () => router.back() }}
          />
        </Cartao>
      ) : (
        visiveis.map((e) => (
          <EventoNaLinhaDoTempo
            key={e.id}
            resumo={e}
            comunidadeId={comunidadeId}
            acompanhar={data === hoje}
          />
        ))
      )}
    </Tela>
  )
}

const NOME_DA_SITUACAO_DA_ETAPA: Readonly<Record<SituacaoDaEtapaAoVivo, string>> = {
  concluida: 'Concluída',
  atual: 'Agora',
  proxima: 'A seguir',
}

function EventoNaLinhaDoTempo({
  resumo,
  comunidadeId,
  acompanhar,
}: {
  resumo: ResumoDoEvento
  comunidadeId: string
  acompanhar: boolean
}) {
  const detalhe = useEvento(comunidadeId, resumo.id)
  const temAoVivo = podeIrAoVivo(resumo.status)
  // Progresso real vem do ao vivo; no dia, atualiza a cada 30 s (sem prender conexão).
  const aoVivo = useQuery({
    queryKey: CHAVES.aoVivo(comunidadeId, resumo.id),
    queryFn: () =>
      api.get<RetratoAoVivo>(`${naComunidade(comunidadeId)}/eventos/${resumo.id}/ao-vivo`),
    enabled: temAoVivo,
    refetchInterval: acompanhar ? 30_000 : false,
  })

  return (
    <Cartao>
      <View style={{ gap: ESPACO.x1 }}>
        <Texto variante="subtitulo">{resumo.titulo}</Texto>
        <Texto variante="apoio" cor="textoSuave">
          {formatarHora(resumo.inicio, resumo.fuso)} · {formatarDuracao(resumo.duracaoMin)}
          {resumo.localNome ? ` · ${resumo.localNome}` : ''}
        </Texto>
        {resumo.status !== 'publicado' ? (
          <Selo texto={NOME_DO_STATUS[resumo.status]} cor={COR_DO_STATUS[resumo.status]} />
        ) : null}
      </View>
      {detalhe.isPending ? (
        <Carregando texto="Carregando as etapas" />
      ) : detalhe.error ? (
        <AvisoDeErro erro={detalhe.error} aoTentarDeNovo={() => void detalhe.refetch()} />
      ) : (
        <Etapas evento={detalhe.data} retrato={aoVivo.data ?? null} />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        <Botao
          titulo="Abrir a programação"
          variante="secundario"
          larguraTotal={false}
          rotuloAcessivel={`Abrir a programação de ${resumo.titulo}`}
          aoPressionar={() =>
            router.push({ pathname: '/evento/[eventoId]', params: { eventoId: resumo.id } })
          }
        />
        {temAoVivo ? (
          <Botao
            titulo="Ao vivo"
            icone="aoVivo"
            variante="secundario"
            larguraTotal={false}
            rotuloAcessivel={`Abrir o ao vivo de ${resumo.titulo}`}
            aoPressionar={() =>
              router.push({
                pathname: '/evento/[eventoId]/ao-vivo',
                params: { eventoId: resumo.id },
              })
            }
          />
        ) : null}
      </View>
    </Cartao>
  )
}

function Etapas({ evento, retrato }: { evento: DetalheDoEvento; retrato: RetratoAoVivo | null }) {
  const { cores } = useTema()
  if (evento.etapas.length === 0) {
    return (
      <Texto variante="apoio" cor="textoSuave">
        A programação deste evento ainda não tem etapas.
      </Texto>
    )
  }
  const comecou = retrato !== null && retrato.situacao !== 'nao_iniciado'
  const situacao = new Map(retrato?.etapas.map((e) => [e.id, e.situacao]) ?? [])
  const concluidas = comecou
    ? evento.etapas.filter((e) => situacao.get(e.id) === 'concluida').length
    : 0
  const total = evento.etapas.length

  return (
    <View style={{ gap: ESPACO.x2 }}>
      {comecou ? (
        <>
          <BarraDeProgresso
            fracao={concluidas / total}
            rotulo={`${concluidas} de ${total} etapas concluídas`}
          />
          <Texto variante="apoio">
            {retrato.situacao === 'encerrado'
              ? 'Evento encerrado.'
              : `${concluidas} de ${total} etapas concluídas${retrato.situacao === 'pausado' ? ' (pausado)' : ''}.`}
          </Texto>
        </>
      ) : (
        <Texto variante="apoio" cor="textoSuave">
          Horários previstos. O progresso aparece quando o ao vivo começar.
        </Texto>
      )}
      {evento.etapas.map((etapa, i) => {
        const s = comecou ? (situacao.get(etapa.id) ?? 'proxima') : null
        const quem = evento.atribuicoes
          .filter((a) => a.etapaId === etapa.id)
          .map((a) => `${a.nome} (${a.funcao})`)
          .join(', ')
        const inicio = formatarHora(etapa.inicioPrevisto, evento.fuso)
        const fim = formatarHora(etapa.fimPrevisto, evento.fuso)
        const ultima = i === evento.etapas.length - 1
        return (
          <View
            key={etapa.id}
            accessible
            accessibilityLabel={[
              `Etapa ${i + 1} de ${total}`,
              `das ${inicio} às ${fim}`,
              etapa.titulo,
              formatarDuracao(etapa.duracaoMin),
              quem ? `com ${quem}` : null,
              s ? NOME_DA_SITUACAO_DA_ETAPA[s] : null,
            ]
              .filter(Boolean)
              .join(', ')}
            style={{ flexDirection: 'row', gap: ESPACO.x3 }}
          >
            {/* Largura mínima, não fixa: com fonte grande, a hora cresce sem cortar. */}
            <Texto variante="rotulo" tabular style={{ minWidth: 48, paddingTop: 2 }}>
              {inicio}
            </Texto>
            <View style={{ alignItems: 'center' }}>
              <Icone
                nome={s === 'concluida' ? 'confirmado' : s === 'atual' ? 'aoVivo' : 'pendente'}
                cor={s === 'atual' ? cores.destaque : cores.textoSuave}
                tamanho={20}
              />
              {!ultima ? (
                <View style={{ width: 2, flex: 1, minHeight: 24, backgroundColor: cores.borda }} />
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 2, paddingBottom: ESPACO.x3 }}>
              <Texto variante="corpoForte">{etapa.titulo}</Texto>
              <Texto variante="apoio" cor="textoSuave">
                {inicio} a {fim} · {formatarDuracao(etapa.duracaoMin)}
                {s ? ` · ${NOME_DA_SITUACAO_DA_ETAPA[s]}` : ''}
              </Texto>
              {quem ? (
                <Texto variante="apoio" cor="textoSuave">
                  Com: {quem}
                </Texto>
              ) : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}
