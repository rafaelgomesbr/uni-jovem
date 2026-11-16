import { useQuery } from '@tanstack/react-query'
import { ESPACO, RAIO, TIPO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
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
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import {
  formatarDataPorExtenso,
  formatarDuracao,
  formatarHora,
  hojeNoFuso,
  somarDias,
  type DataLocal,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto, LinhasDeEsqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Icone } from '@/ui/Icone'
import { LARGURA_DA_HORA } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { voltarOu } from '@/ui/navegacao'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { naComunidade, useEvento, useEventosNoPeriodo } from '../eventos/consultas'
import { NOME_DO_STATUS } from '../eventos/nomes'
import { podeIrAoVivo } from '../eventos/regras'
import { SemComunidade } from '../navegacao/SemComunidade'
import { dataDaRota, limitesParaApi } from './calendario'
import { TOM_DO_STATUS } from './ListaDoDia'
import { LINHA_DO_TEMPO } from './medidas'

/** Rota `/agenda/[data]`: as etapas de cada evento do dia, com hora, duração e progresso. */
export function TelaTimelineDoDia() {
  const { comunidadeAtiva } = useSessao()
  const fuso = useFusoDaComunidade()
  const daRota = dataDaRota(parametro(useLocalSearchParams<{ data: string }>().data))
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Linha do tempo">
        <SemComunidade oQue="a agenda" />
      </Tela>
    )
  }
  if (daRota === 'invalida') {
    return (
      <Tela pilha titulo="Linha do tempo">
        <EstadoVazio
          icone="agenda"
          titulo="Data inválida"
          descricao="Este endereço não traz um dia que a agenda consiga abrir. Confira o link ou vá para hoje."
          acao={{
            titulo: 'Ir para hoje',
            aoPressionar: () => router.setParams({ data: hojeNoFuso(fuso) }),
          }}
        />
      </Tela>
    )
  }
  return (
    <Timeline comunidadeId={comunidadeAtiva.id} data={daRota ?? hojeNoFuso(fuso)} fuso={fuso} />
  )
}

function voltarParaAAgenda() {
  voltarOu('/agenda')
}

/** "Sábado, 15 de novembro de 2026 (hoje)". */
function subtitulo(data: DataLocal, hoje: DataLocal): string {
  const texto = formatarDataPorExtenso(data)
  return `${texto.charAt(0).toLocaleUpperCase('pt-BR')}${texto.slice(1)}${data === hoje ? ' (hoje)' : ''}`
}

/**
 * O evento em andamento ou, se nenhum está, o próximo do dia: ele ganha o
 * cartão de destaque (no máximo um por tela). Dia que já passou não tem.
 */
function indiceDoDestaque(eventos: readonly ResumoDoEvento[], agora: number): number {
  return eventos.findIndex((e) => new Date(e.inicio).getTime() + e.duracaoMin * 60_000 > agora)
}

/**
 * Linha do tempo do dia (3.3.4): cabeçalho de pilha com "Dia anterior" e
 * "Dia seguinte"; o evento ao vivo (ou o próximo) em cartão de destaque, com
 * a barra de progresso e as etapas; os outros eventos em cartões de vidro com
 * a mesma lista; e, em cada um, os terciários "Abrir a programação" e
 * "Acompanhar ao vivo".
 */
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
  // O instante de abrir a tela: decide o destaque sem mudar a cada nova renderização.
  const [agora] = useState(() => Date.now())
  const destaque = indiceDoDestaque(visiveis, agora)

  return (
    <Tela
      pilha
      titulo="Linha do tempo"
      descricao={subtitulo(data, hoje)}
      acoes={
        <>
          <BotaoIcone
            icone="voltar"
            rotulo="Dia anterior"
            aoPressionar={() => router.setParams({ data: somarDias(data, -1) })}
          />
          <BotaoIcone
            icone="avancar"
            rotulo="Dia seguinte"
            aoPressionar={() => router.setParams({ data: somarDias(data, 1) })}
          />
        </>
      }
    >
      {eventos.isPending ? (
        <Esqueleto rotulo="Carregando o dia">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      ) : eventos.error ? (
        <ErroDaTela
          erro={eventos.error}
          oQue="o dia"
          aoTentarDeNovo={() => void eventos.refetch()}
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio
          icone="agenda"
          titulo="Nenhum encontro neste dia"
          descricao="Escolha outro dia na agenda para ver os encontros dele."
          acao={{ titulo: 'Voltar para a agenda', aoPressionar: voltarParaAAgenda }}
        />
      ) : (
        visiveis.map((e, i) => (
          <EventoNaLinhaDoTempo
            key={e.id}
            resumo={e}
            comunidadeId={comunidadeId}
            acompanhar={data === hoje}
            emDestaque={i === destaque}
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
  emDestaque,
}: {
  resumo: ResumoDoEvento
  comunidadeId: string
  acompanhar: boolean
  emDestaque: boolean
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
  const retrato = aoVivo.data ?? null
  const emAndamento =
    retrato !== null && retrato.situacao !== 'nao_iniciado' && retrato.situacao !== 'encerrado'

  const meta = [
    formatarHora(resumo.inicio, resumo.fuso),
    formatarDuracao(resumo.duracaoMin),
    resumo.localNome,
  ]
    .filter(Boolean)
    .join(' · ')
  const chip = emAndamento ? (
    <Chip texto="Ao vivo" tom="quente" ponto />
  ) : resumo.status !== 'publicado' ? (
    <Chip texto={NOME_DO_STATUS[resumo.status]} tom={TOM_DO_STATUS[resumo.status]} />
  ) : undefined

  const etapas = detalhe.isPending ? (
    <Esqueleto rotulo="Carregando as etapas">
      <LinhasDeEsqueleto papel="lista" />
    </Esqueleto>
  ) : detalhe.error ? (
    <AvisoDeFalha
      erro={detalhe.error}
      titulo="Não deu para carregar as etapas"
      aoTentarDeNovo={() => void detalhe.refetch()}
    />
  ) : (
    <Etapas evento={detalhe.data} retrato={retrato} />
  )

  const acoes = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: ESPACO.e24 }}>
      <Botao
        titulo="Abrir o encontro"
        variante="terciario"
        alinhado
        rotuloAcessivel={`Abrir o encontro ${resumo.titulo}`}
        aoPressionar={() =>
          router.push({ pathname: '/evento/[eventoId]', params: { eventoId: resumo.id } })
        }
      />
      {temAoVivo ? (
        <Botao
          titulo="Acompanhar ao vivo"
          variante="terciario"
          alinhado
          rotuloAcessivel={`Acompanhar ao vivo: ${resumo.titulo}`}
          aoPressionar={() =>
            router.push({
              pathname: '/evento/[eventoId]/ao-vivo',
              params: { eventoId: resumo.id },
            })
          }
        />
      ) : null}
    </View>
  )

  if (emDestaque) {
    return (
      <CartaoDeDestaque meta={meta} chip={chip} titulo={resumo.titulo} acoes={acoes}>
        {etapas}
      </CartaoDeDestaque>
    )
  }
  return (
    <CartaoDeVidro
      sobrancelha={meta}
      titulo={resumo.titulo}
      {...(chip ? { extra: chip } : {})}
      acoes={acoes}
    >
      {etapas}
    </CartaoDeVidro>
  )
}

function Etapas({ evento, retrato }: { evento: DetalheDoEvento; retrato: RetratoAoVivo | null }) {
  if (evento.etapas.length === 0) {
    return (
      <Texto variante="legenda" cor="textoSuave">
        O roteiro deste encontro ainda não tem etapas.
      </Texto>
    )
  }
  const comecou = retrato !== null && retrato.situacao !== 'nao_iniciado'
  const situacao = new Map(retrato?.etapas.map((e) => [e.id, e.situacao]) ?? [])
  const concluidas = comecou
    ? evento.etapas.filter((e) => situacao.get(e.id) === 'concluida').length
    : 0
  const total = evento.etapas.length
  const resumo = !comecou
    ? 'Horários previstos. O progresso aparece quando o ao vivo começar.'
    : retrato.situacao === 'encerrado'
      ? `Encontro encerrado. ${concluidas} de ${total} etapas concluídas.`
      : `${concluidas} de ${total} etapas${retrato.situacao === 'pausado' ? ' · pausado' : ''}`

  return (
    <View style={{ gap: ESPACO.e12 }}>
      {comecou ? (
        <View style={{ gap: ESPACO.e8 }}>
          <BarraDeProgresso
            fracao={concluidas / total}
            rotulo={`${concluidas} de ${total} etapas concluídas`}
            cor="primaria"
            trilho="tonal"
          />
          <Texto variante="meta" cor="textoSuave" tabular>
            {resumo}
          </Texto>
        </View>
      ) : (
        <Texto variante="meta" cor="textoSuave">
          {resumo}
        </Texto>
      )}
      <View>
        {evento.etapas.map((etapa, i) => {
          const s = comecou ? (situacao.get(etapa.id) ?? 'proxima') : null
          const quem = evento.atribuicoes
            .filter((a) => a.etapaId === etapa.id)
            .map((a) => `${a.nome} (${a.funcao})`)
            .join(', ')
          const inicio = formatarHora(etapa.inicioPrevisto, evento.fuso)
          const fim = formatarHora(etapa.fimPrevisto, evento.fuso)
          return (
            <LinhaDaEtapa
              key={etapa.id}
              hora={inicio}
              titulo={etapa.titulo}
              detalhe={[
                `${inicio} a ${fim}`,
                formatarDuracao(etapa.duracaoMin),
                quem ? `Com ${quem}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              situacao={s}
              ultima={i === evento.etapas.length - 1}
              rotulo={[
                `Etapa ${i + 1} de ${total}`,
                `das ${inicio} às ${fim}`,
                etapa.titulo,
                formatarDuracao(etapa.duracaoMin),
                quem ? `com ${quem}` : null,
                s ? NOME_DA_SITUACAO_DA_ETAPA[s] : null,
              ]
                .filter(Boolean)
                .join(', ')}
            />
          )
        })}
      </View>
    </View>
  )
}

/**
 * Linha de etapa (3.3.4): a hora em coluna de 44 (600, `tabular-nums`), 12,
 * o nó de 12 com o trilho de 2 em `separador`, 12, o título e "16:05 a
 * 16:20 · 15 min · Com Ana (violão)". O nó diz a situação pela forma:
 * concluída é cheia com check, a atual tem anel e miolo, a próxima só anel.
 */
function LinhaDaEtapa({
  hora,
  titulo,
  detalhe,
  situacao,
  ultima,
  rotulo,
}: {
  hora: string
  titulo: string
  detalhe: string
  situacao: SituacaoDaEtapaAoVivo | null
  ultima: boolean
  rotulo: string
}) {
  const { cores } = useTema()
  return (
    <View accessible accessibilityLabel={rotulo} style={{ flexDirection: 'row', gap: ESPACO.e12 }}>
      {/* Largura mínima, não fixa: com fonte grande, a hora cresce sem cortar. */}
      <Texto variante="lista" peso="forte" tabular style={{ minWidth: LARGURA_DA_HORA }}>
        {hora}
      </Texto>
      <View style={{ alignItems: 'center', width: LINHA_DO_TEMPO.no }}>
        <View style={{ height: TIPO.lista.altura, justifyContent: 'center' }}>
          <No situacao={situacao} />
        </View>
        {!ultima ? (
          <View
            style={{ width: LINHA_DO_TEMPO.trilho, flex: 1, backgroundColor: cores.separador }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, paddingBottom: ultima ? 0 : ESPACO.e16 }}>
        <Texto variante="tituloItem">{titulo}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {detalhe}
        </Texto>
      </View>
    </View>
  )
}

function No({ situacao }: { situacao: SituacaoDaEtapaAoVivo | null }) {
  const { cores } = useTema()
  const base = {
    width: LINHA_DO_TEMPO.no,
    height: LINHA_DO_TEMPO.no,
    borderRadius: RAIO.pilula,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }
  if (situacao === 'concluida') {
    return (
      <View style={[base, { backgroundColor: cores.sucesso }]}>
        <Icone nome="check" cor={cores.superficie} tamanho={LINHA_DO_TEMPO.check} peso="forte" />
      </View>
    )
  }
  if (situacao === 'atual') {
    return (
      <View style={[base, { borderWidth: LINHA_DO_TEMPO.anelAtual, borderColor: cores.primaria }]}>
        <View
          style={{
            width: LINHA_DO_TEMPO.miolo,
            height: LINHA_DO_TEMPO.miolo,
            borderRadius: RAIO.pilula,
            backgroundColor: cores.primaria,
          }}
        />
      </View>
    )
  }
  return (
    <View
      style={[base, { borderWidth: LINHA_DO_TEMPO.anelProximo, borderColor: cores.textoSuave }]}
    />
  )
}
