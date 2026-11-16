import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { CampoDeBusca } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { ErroDaTela } from '@/ui/Falha'
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

interface PropsDaLista {
  comunidadeId: string
  /** O seletor "Calendário | Lista", no topo, igual nos dois modos. */
  seletor: ReactNode
  /** "Novo encontro", ao lado do título (só para quem cria). */
  acao?: ReactNode
  /** Abre a folha "Novo encontro" (Sábado padrão, Em branco, A partir de modelo). */
  aoCriar: () => void
  /** Volta ao modo Calendário (o estado vazio de quem não cria). */
  aoVerCalendario: () => void
}

/**
 * Agenda no modo Lista (D57, antiga aba Programas, 3.4.1): busca, filtros
 * Próximos e Passados, Rascunhos, Publicados e Cancelados, e os encontros
 * agrupados por mês. Na web larga, o encontro escolhido abre ao lado.
 */
export function ListaDeEncontros({
  comunidadeId,
  seletor,
  acao,
  aoCriar,
  aoVerCalendario,
}: PropsDaLista) {
  const pode = usePode()
  const fuso = useFusoDaComunidade()
  const largo = useLayoutLargo()
  // O evento aberto ao lado fica na URL: dá para recarregar e compartilhar o endereço.
  const selecionado = parametro(useLocalSearchParams<{ evento?: string }>().evento)
  const [periodo, setPeriodo] = useState<Periodo>('proximos')
  const [status, setStatus] = useState<FiltroDeStatus>('todos')
  const [busca, setBusca] = useState('')

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
      {seletor}
      <CampoDeBusca rotulo="Buscar por título ou categoria" valor={busca} aoMudar={setBusca} />
      <Filtros
        periodo={periodo}
        status={status}
        verRascunhos={podeCriar}
        aoMudarPeriodo={setPeriodo}
        aoMudarStatus={setStatus}
      />
      {eventos.isPending ? (
        <Esqueleto rotulo="Carregando os encontros">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : eventos.error ? (
        <ErroDaTela
          erro={eventos.error}
          titulo="Os encontros não abriram"
          aoTentarDeNovo={() => void eventos.refetch()}
        />
      ) : filtrados.length === 0 ? (
        eventos.data.length > 0 || comFiltro ? (
          <EstadoVazio
            icone="programacoes"
            titulo="Nada com esses filtros"
            descricao="Mude a situação ou a busca para ver outros encontros."
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
            titulo={periodo === 'proximos' ? 'Nenhum encontro marcado' : 'Nada nos últimos meses'}
            descricao={
              podeCriar
                ? 'Comece pelo Sábado padrão: as etapas de sempre já vêm prontas e você ajusta depois.'
                : 'Quando a organização publicar os próximos encontros, eles aparecem aqui.'
            }
            acao={
              podeCriar
                ? { titulo: 'Novo Sábado padrão', icone: 'adicionar', aoPressionar: novoSabado }
                : {
                    titulo: 'Ver o calendário',
                    aoPressionar: aoVerCalendario,
                  }
            }
          />
        )
      ) : (
        <>
          <TextoAnunciado soMudancas variante="legenda" cor="textoSuave">
            {filtrados.length === 1 ? '1 encontro' : `${filtrados.length} encontros`}
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
    </>
  )

  if (!largo) {
    return (
      <TelaDoApp titulo="Agenda" {...(acao ? { acaoComTexto: acao } : {})}>
        {lista}
      </TelaDoApp>
    )
  }

  return (
    <TelaDoApp titulo="Agenda" rolar={false} larga {...(acao ? { acaoComTexto: acao } : {})}>
      <LayoutDividido
        rotuloDoDetalhe="Encontro escolhido"
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
              titulo="Escolha um encontro"
              descricao="Ele abre aqui ao lado, com o roteiro, quem serve, a preparação e as inscrições."
              {...(podeCriar
                ? {
                    acao: {
                      titulo: 'Novo encontro',
                      icone: 'adicionar' as const,
                      variante: 'secundario' as const,
                      aoPressionar: aoCriar,
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
