import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { BotaoIcone } from '@/ui/Botao'
import { CampoDeBusca } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { ErroDaTela } from '@/ui/Falha'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { LayoutDividido, useLayoutLargo } from '@/ui/LayoutDividido'
import { Lista } from '@/ui/LinhaDeLista'
import { LinhaDePilulas, PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Secao } from '@/ui/Secao'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import {
  dataDoInstante,
  hojeNoFuso,
  instanteDeDataEHora,
  NOMES_DOS_MESES,
  somarDias,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { useEventosNoPeriodo } from './consultas'
import { DetalheDoEvento } from './DetalheDoEvento'
import { linhaDoEventoNaLista } from './LinhaDoEvento'

export type Periodo = 'proximos' | 'passados'
export type FiltroDeStatus = 'todos' | 'rascunho' | 'publicado' | 'cancelados'

/** Quanto do passado a lista mostra (o histórico completo fica nos relatórios). */
const DIAS_DO_PASSADO = 180

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Filtro puro da lista (status e busca por título ou categoria). */
export function filtrarEventos(
  eventos: readonly ResumoDoEvento[],
  status: FiltroDeStatus,
  busca: string,
): ResumoDoEvento[] {
  const termo = semAcento(busca.trim())
  return eventos.filter((e) => {
    const casaStatus =
      status === 'todos' ||
      (status === 'cancelados'
        ? e.status === 'cancelado' || e.status === 'adiado'
        : e.status === status)
    const casaBusca =
      !termo || semAcento(e.titulo).includes(termo) || semAcento(e.categoria).includes(termo)
    return casaStatus && casaBusca
  })
}

export interface GrupoDoMes {
  chave: string
  /** "novembro" ou "janeiro de 2027" (fora do ano corrente). */
  rotulo: string
  eventos: ResumoDoEvento[]
}

/** Agrupa por mês (no fuso de cada evento), mantendo a ordem recebida. */
export function agruparPorMes(eventos: readonly ResumoDoEvento[], anoAtual: string): GrupoDoMes[] {
  const grupos: GrupoDoMes[] = []
  for (const e of eventos) {
    const dia = dataDoInstante(e.inicio, e.fuso)
    const chave = dia.slice(0, 7)
    let grupo = grupos.find((g) => g.chave === chave)
    if (!grupo) {
      const mes = NOMES_DOS_MESES[Number(dia.slice(5, 7)) - 1] ?? ''
      const ano = dia.slice(0, 4)
      grupo = { chave, rotulo: ano === anoAtual ? mes : `${mes} de ${ano}`, eventos: [] }
      grupos.push(grupo)
    }
    grupo.eventos.push(e)
  }
  return grupos
}

export function TelaProgramacoes() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <TelaDoApp titulo="Programas">
        <SemComunidade oQue="as programações" />
      </TelaDoApp>
    )
  }
  return <Programacoes comunidadeId={comunidadeAtiva.id} />
}

function Programacoes({ comunidadeId }: { comunidadeId: string }) {
  const pode = usePode()
  const fuso = useFusoDaComunidade()
  const largo = useLayoutLargo()
  // O evento aberto ao lado fica na URL: dá para recarregar e compartilhar o endereço.
  const selecionado = parametro(useLocalSearchParams<{ evento?: string }>().evento)
  const [periodo, setPeriodo] = useState<Periodo>('proximos')
  const [status, setStatus] = useState<FiltroDeStatus>('todos')
  const [busca, setBusca] = useState('')
  const [novaAberta, setNovaAberta] = useState(false)

  const hoje = hojeNoFuso(fuso)
  const inicioDeHoje = instanteDeDataEHora(hoje, '00:00', fuso)
  const de =
    periodo === 'proximos'
      ? inicioDeHoje
      : instanteDeDataEHora(somarDias(hoje, -DIAS_DO_PASSADO), '00:00', fuso)
  const ate = periodo === 'proximos' ? null : inicioDeHoje
  const eventos = useEventosNoPeriodo(comunidadeId, de, ate)
  const podeCriar = pode('evento', 'criar')

  const filtrados = eventos.data ? filtrarEventos(eventos.data, status, busca) : []
  if (periodo === 'passados') filtrados.reverse()
  const grupos = agruparPorMes(filtrados, hoje.slice(0, 4))
  const comFiltro = status !== 'todos' || busca.trim() !== ''

  function abrir(id: string) {
    if (largo) router.setParams({ evento: id })
    else router.push({ pathname: '/evento/[eventoId]', params: { eventoId: id } })
  }

  const novoSabado = () =>
    router.push({ pathname: '/evento/novo', params: { modelo: 'sabado_padrao' } })

  const lista = (
    <>
      <CampoDeBusca rotulo="Buscar por título ou categoria" valor={busca} aoMudar={setBusca} />
      <Filtros
        periodo={periodo}
        status={status}
        verRascunhos={podeCriar}
        aoMudarPeriodo={setPeriodo}
        aoMudarStatus={setStatus}
      />
      {eventos.isPending ? (
        <Esqueleto rotulo="Carregando as programações">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : eventos.error ? (
        <ErroDaTela
          erro={eventos.error}
          titulo="As programações não abriram"
          aoTentarDeNovo={() => void eventos.refetch()}
        />
      ) : filtrados.length === 0 ? (
        eventos.data.length > 0 || comFiltro ? (
          <EstadoVazio
            icone="programacoes"
            titulo="Nada com esses filtros"
            descricao="Mude a situação ou a busca para ver outras programações."
            acao={{
              titulo: 'Limpar filtros',
              variante: 'secundario',
              aoPressionar: () => {
                setStatus('todos')
                setBusca('')
              },
            }}
          />
        ) : (
          <EstadoVazio
            icone="programacoes"
            titulo={
              periodo === 'proximos' ? 'Nenhuma programação marcada' : 'Nada nos últimos meses'
            }
            descricao={
              podeCriar
                ? 'Comece pelo Sábado padrão: as etapas de sempre já vêm prontas e você ajusta depois.'
                : 'Quando a organização publicar os próximos encontros, eles aparecem aqui.'
            }
            acao={
              podeCriar
                ? { titulo: 'Novo Sábado padrão', icone: 'adicionar', aoPressionar: novoSabado }
                : { titulo: 'Ver a agenda', aoPressionar: () => router.push('/agenda') }
            }
          />
        )
      ) : (
        <>
          <TextoAnunciado soMudancas variante="legenda" cor="textoSuave">
            {filtrados.length === 1 ? '1 programação' : `${filtrados.length} programações`}
          </TextoAnunciado>
          {grupos.map((g, i) => (
            <View key={g.chave} style={i === 0 ? { marginTop: -ESPACO.e16 } : null}>
              <Secao titulo={g.rotulo}>
                <CartaoDeVidro lista>
                  <Lista>
                    {g.eventos.map((e) =>
                      linhaDoEventoNaLista({
                        evento: e,
                        fuso: e.fuso,
                        ...(largo ? { selecionado: e.id === selecionado } : {}),
                        aoPressionar: () => abrir(e.id),
                      }),
                    )}
                  </Lista>
                </CartaoDeVidro>
              </Secao>
            </View>
          ))}
        </>
      )}
      <MenuDeAcoes
        aberto={novaAberta}
        titulo="Nova programação"
        aoFechar={() => setNovaAberta(false)}
        acoes={[
          {
            titulo: 'Sábado padrão',
            icone: 'modelo',
            descricao: 'As etapas de sempre, todas editáveis',
            chip: 'Recomendado',
            navega: true,
            aoPressionar: novoSabado,
          },
          {
            titulo: 'Em branco',
            icone: 'adicionar',
            descricao: 'Você monta as etapas depois',
            navega: true,
            aoPressionar: () => router.push('/evento/novo'),
          },
          pode('modelo', 'ler') && {
            titulo: 'A partir de um modelo',
            icone: 'duplicar',
            descricao: 'Os modelos da comunidade e os do app',
            navega: true,
            aoPressionar: () =>
              router.push({ pathname: '/evento/novo', params: { modelo: 'escolher' } }),
          },
        ]}
      />
    </>
  )

  const mais = podeCriar ? (
    <BotaoIcone
      icone="adicionar"
      rotulo="Nova programação"
      circular
      aoPressionar={() => setNovaAberta(true)}
    />
  ) : undefined

  if (!largo) {
    return (
      <TelaDoApp titulo="Programas" {...(mais ? { acaoDoTitulo: mais } : {})}>
        {lista}
      </TelaDoApp>
    )
  }

  return (
    <TelaDoApp titulo="Programas" rolar={false} larga {...(mais ? { acaoDoTitulo: mais } : {})}>
      <LayoutDividido
        rotuloDoDetalhe="Programação escolhida"
        lista={lista}
        detalhe={
          selecionado ? (
            <DetalheDoEvento
              key={selecionado}
              comunidadeId={comunidadeId}
              eventoId={selecionado}
              painel
              aoSair={() => router.setParams({ evento: '' })}
            />
          ) : (
            <EstadoVazio
              icone="programacoes"
              titulo="Escolha uma programação"
              descricao="Ela abre aqui ao lado, com etapas, equipe, preparação e inscrições."
              {...(podeCriar
                ? {
                    acao: {
                      titulo: 'Novo Sábado padrão',
                      icone: 'adicionar' as const,
                      variante: 'secundario' as const,
                      aoPressionar: novoSabado,
                    },
                  }
                : {})}
            />
          )
        }
      />
    </TelaDoApp>
  )
}

interface PropsDosFiltros {
  periodo: Periodo
  status: FiltroDeStatus
  verRascunhos: boolean
  aoMudarPeriodo: (p: Periodo) => void
  aoMudarStatus: (s: FiltroDeStatus) => void
}

/**
 * Pílulas de filtro numa linha só (3.4.1): o período (escolha única) e a
 * situação (tocar de novo desmarca), com um separador vertical entre os grupos.
 */
function Filtros({
  periodo,
  status,
  verRascunhos,
  aoMudarPeriodo,
  aoMudarStatus,
}: PropsDosFiltros) {
  const situacoes: { valor: Exclude<FiltroDeStatus, 'todos'>; rotulo: string }[] = [
    ...(verRascunhos ? [{ valor: 'rascunho' as const, rotulo: 'Rascunhos' }] : []),
    { valor: 'publicado', rotulo: 'Publicados' },
    { valor: 'cancelados', rotulo: 'Cancelados' },
  ]
  return (
    <LinhaDePilulas>
      <PilulasDeFiltro
        rotulo="Período"
        selecionadas={[periodo]}
        aoMudar={(v) => {
          if (v[0]) aoMudarPeriodo(v[0])
        }}
        pilulas={[
          { valor: 'proximos', rotulo: 'Próximos' },
          { valor: 'passados', rotulo: 'Passados' },
        ]}
      />
      <PilulasDeFiltro
        rotulo="Situação"
        opcional
        selecionadas={status === 'todos' ? [] : [status]}
        aoMudar={(v) => aoMudarStatus(v[0] ?? 'todos')}
        pilulas={situacoes}
      />
    </LinhaDePilulas>
  )
}
