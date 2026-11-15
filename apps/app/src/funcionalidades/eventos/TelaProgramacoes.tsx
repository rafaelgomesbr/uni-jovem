import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { hojeNoFuso, instanteDeDataEHora, somarDias } from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LayoutDividido, useLayoutLargo } from '@/ui/LayoutDividido'
import { Segmentos } from '@/ui/Segmentos'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { useEventosNoPeriodo } from './consultas'
import { DetalheDoEvento } from './DetalheDoEvento'
import { LinhaDoEvento } from './LinhaDoEvento'

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

export function TelaProgramacoes() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <TelaDoApp titulo="Programações">
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

  function abrir(id: string) {
    if (largo) router.setParams({ evento: id })
    else router.push({ pathname: '/evento/[eventoId]', params: { eventoId: id } })
  }

  const lista = (
    <>
      {podeCriar ? (
        <View style={{ gap: ESPACO.x2 }}>
          <Botao
            titulo="Nova programação"
            icone="adicionar"
            aoPressionar={() => router.push('/evento/novo')}
          />
          <Botao
            titulo="Novo Sábado padrão"
            icone="modelo"
            variante="secundario"
            dica="Já vem com as etapas habituais de sábado, todas editáveis."
            aoPressionar={() =>
              router.push({ pathname: '/evento/novo', params: { modelo: 'sabado_padrao' } })
            }
          />
        </View>
      ) : null}
      <View style={{ gap: ESPACO.x3 }}>
        <Segmentos
          rotulo="Período"
          valor={periodo}
          aoMudar={setPeriodo}
          segmentos={[
            { valor: 'proximos', rotulo: 'Próximos' },
            { valor: 'passados', rotulo: 'Passados' },
          ]}
        />
        <Segmentos
          rotulo="Situação"
          valor={status}
          aoMudar={setStatus}
          segmentos={[
            { valor: 'todos', rotulo: 'Todos' },
            ...(podeCriar ? [{ valor: 'rascunho' as const, rotulo: 'Rascunhos' }] : []),
            { valor: 'publicado', rotulo: 'Publicados' },
            { valor: 'cancelados', rotulo: 'Cancelados ou adiados' },
          ]}
        />
        <Campo
          rotulo="Buscar por título ou categoria"
          value={busca}
          onChangeText={setBusca}
          exemplo="Sábado, luau, ação social"
          autoCorrect={false}
        />
      </View>
      {eventos.isPending ? (
        <Carregando texto="Carregando as programações" />
      ) : eventos.error ? (
        <AvisoDeErro erro={eventos.error} aoTentarDeNovo={() => void eventos.refetch()} />
      ) : filtrados.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone="programacoes"
            titulo={
              eventos.data.length === 0
                ? periodo === 'proximos'
                  ? 'Nenhuma programação marcada'
                  : 'Nada nos últimos meses'
                : 'Nada com esses filtros'
            }
            descricao={
              eventos.data.length > 0
                ? 'Mude a situação ou a busca para ver outras programações.'
                : podeCriar
                  ? 'Comece pelo Sábado padrão ou monte uma programação do zero.'
                  : 'Quando a organização publicar os próximos encontros, eles aparecem aqui.'
            }
            {...(eventos.data.length > 0
              ? {
                  acao: {
                    titulo: 'Limpar filtros',
                    aoPressionar: () => {
                      setStatus('todos')
                      setBusca('')
                    },
                  },
                }
              : podeCriar
                ? {
                    acao: {
                      titulo: 'Nova programação',
                      icone: 'adicionar' as const,
                      aoPressionar: () => router.push('/evento/novo'),
                    },
                  }
                : {
                    acao: {
                      titulo: 'Ver a agenda',
                      icone: 'agenda' as const,
                      aoPressionar: () => router.push('/agenda'),
                    },
                  })}
          />
        </Cartao>
      ) : (
        <View style={{ gap: ESPACO.x2 }}>
          <TextoAnunciado soMudancas variante="apoio" cor="textoSuave">
            {filtrados.length === 1 ? '1 programação' : `${filtrados.length} programações`}
          </TextoAnunciado>
          {filtrados.map((e) => (
            <LinhaDoEvento
              key={e.id}
              evento={e}
              fuso={e.fuso}
              selecionado={largo && e.id === selecionado}
              aoPressionar={() => abrir(e.id)}
            />
          ))}
        </View>
      )}
    </>
  )

  if (!largo) return <TelaDoApp titulo="Programações">{lista}</TelaDoApp>

  return (
    <TelaDoApp titulo="Programações" rolar={false} larga>
      <LayoutDividido
        rotuloDoDetalhe="Programação escolhida"
        lista={lista}
        detalhe={
          selecionado ? (
            <DetalheDoEvento
              key={selecionado}
              comunidadeId={comunidadeId}
              eventoId={selecionado}
              aoSair={() => router.setParams({ evento: '' })}
            />
          ) : (
            <Cartao>
              <EstadoVazio
                icone="programacoes"
                titulo="Escolha uma programação"
                descricao="Ela abre aqui ao lado, com etapas, equipe, tarefas e inscrições."
              />
            </Cartao>
          )
        }
      />
    </TelaDoApp>
  )
}
