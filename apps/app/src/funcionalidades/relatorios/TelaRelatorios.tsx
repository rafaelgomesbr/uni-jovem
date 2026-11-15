import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import type { Agrupamento } from '@/servicos/contratoDosModulos'
import {
  dataDoInstante,
  formatarDataLocal,
  hojeNoFuso,
  NOMES_DOS_MESES,
  type DataLocal,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { useRelatorio, type FiltrosDoRelatorio, type TipoDeRelatorio } from './consultas'
import { GradeDeNumeros, GraficoDeBarras, Numero } from './GraficoDeBarras'
import { periodoDosUltimos, SeletorDePeriodo, type Periodo } from './SeletorDePeriodo'

const TIPOS: { valor: TipoDeRelatorio; rotulo: string }[] = [
  { valor: 'presenca', rotulo: 'Presença' },
  { valor: 'inscricoes', rotulo: 'Inscrições' },
  { valor: 'escalas', rotulo: 'Escalas' },
  { valor: 'atividade', rotulo: 'Atividade' },
]

const ehTipo = (v: string | null): v is TipoDeRelatorio => TIPOS.some((t) => t.valor === v)

/** Rótulo de um período agrupado ("nov/2026" ou "semana de 09/11/2026"). */
export function rotuloDoPeriodo(inicio: string, agrupar: Agrupamento): string {
  const [a, m] = inicio.split('-').map(Number) as [number, number]
  if (agrupar === 'mes') return `${(NOMES_DOS_MESES[m - 1] ?? '').slice(0, 3)}/${a}`
  return `semana de ${formatarDataLocal(inicio as DataLocal)}`
}

/** Rota `/relatorios?tipo=`. Só organizador para cima (a API também confere). */
export function TelaRelatorios() {
  const pode = usePode()
  const doParametro = parametro(useLocalSearchParams<{ tipo?: string }>().tipo)
  const tipo: TipoDeRelatorio = ehTipo(doParametro) ? doParametro : 'presenca'
  if (!pode('relatorio', 'ler')) {
    return (
      <TelaDaComunidade oQue="os relatórios" titulo="Relatórios">
        {() => (
          <Aviso tipo="alerta" titulo="Relatórios são da organização">
            Os relatórios da comunidade ficam com organizadores e administradores. Se precisar de um
            número, peça a quem organiza.
          </Aviso>
        )}
      </TelaDaComunidade>
    )
  }
  return (
    <TelaDaComunidade
      oQue="os relatórios"
      titulo="Relatórios"
      descricao="Números agregados da comunidade. Pedidos de oração nunca entram em relatório."
    >
      {(c) => (
        <>
          <Segmentos
            rotulo="Relatório"
            valor={tipo}
            aoMudar={(t) => router.setParams({ tipo: t })}
            segmentos={TIPOS}
          />
          <Relatorios comunidadeId={c.id} tipo={tipo} />
          <Botao
            titulo="Exportar CSV"
            icone="baixar"
            variante="secundario"
            aoPressionar={() => router.push('/relatorios/exportacoes')}
          />
        </>
      )}
    </TelaDaComunidade>
  )
}

function Relatorios({ comunidadeId, tipo }: { comunidadeId: string; tipo: TipoDeRelatorio }) {
  const fuso = useFusoDaComunidade()
  const hoje = hojeNoFuso(fuso)
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDosUltimos(90, hoje))
  const [agrupar, setAgrupar] = useState<Agrupamento>('mes')
  const filtros: FiltrosDoRelatorio = { ...periodo, agrupar }
  return (
    <>
      <Cartao>
        <SeletorDePeriodo hoje={hoje} periodo={periodo} aoMudar={setPeriodo} />
        {tipo === 'presenca' ? (
          <Segmentos
            rotulo="Agrupar por"
            valor={agrupar}
            aoMudar={setAgrupar}
            segmentos={[
              { valor: 'semana', rotulo: 'Semana' },
              { valor: 'mes', rotulo: 'Mês' },
            ]}
          />
        ) : null}
      </Cartao>
      {tipo === 'presenca' ? (
        <Presenca comunidadeId={comunidadeId} filtros={filtros} fuso={fuso} />
      ) : tipo === 'inscricoes' ? (
        <Inscricoes comunidadeId={comunidadeId} filtros={filtros} fuso={fuso} />
      ) : tipo === 'escalas' ? (
        <Escalas comunidadeId={comunidadeId} filtros={filtros} />
      ) : (
        <Atividade comunidadeId={comunidadeId} filtros={filtros} />
      )}
    </>
  )
}

interface PropsDoRelatorio {
  comunidadeId: string
  filtros: FiltrosDoRelatorio
}

function Estado({
  consulta,
}: {
  consulta: { isPending: boolean; error: unknown; refetch: () => unknown }
}) {
  if (consulta.isPending) return <Carregando texto="Calculando o relatório" />
  return <AvisoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
}

const dataCurta = (iso: string, fuso: string) => formatarDataLocal(dataDoInstante(iso, fuso))

function Presenca({ comunidadeId, filtros, fuso }: PropsDoRelatorio & { fuso: string }) {
  const r = useRelatorio(comunidadeId, 'presenca', filtros)
  if (!r.data) return <Estado consulta={r} />
  const { totais, porPeriodo, porEvento } = r.data
  return (
    <>
      <GradeDeNumeros>
        <Numero rotulo="eventos" valor={totais.eventos} />
        <Numero rotulo="presenças" valor={totais.presentes} />
        <Numero rotulo="média por evento" valor={totais.mediaPorEvento.toLocaleString('pt-BR')} />
        <Numero rotulo="membros diferentes" valor={totais.membrosDistintos} />
      </GradeDeNumeros>
      <Cartao>
        <GraficoDeBarras
          titulo={filtros.agrupar === 'mes' ? 'Presenças por mês' : 'Presenças por semana'}
          barras={porPeriodo.map((p) => ({
            rotulo: `${rotuloDoPeriodo(p.inicio, filtros.agrupar)} (${p.eventos} ${p.eventos === 1 ? 'evento' : 'eventos'})`,
            valor: p.presentes,
            texto: `${p.presentes}`,
          }))}
        />
      </Cartao>
      <Cartao>
        <GraficoDeBarras
          titulo="Presenças por evento"
          barras={porEvento.map((e) => ({
            rotulo: `${e.titulo}, ${dataCurta(e.inicio, fuso)}`,
            valor: e.presentes,
          }))}
        />
      </Cartao>
    </>
  )
}

function Inscricoes({ comunidadeId, filtros, fuso }: PropsDoRelatorio & { fuso: string }) {
  const r = useRelatorio(comunidadeId, 'inscricoes', filtros)
  if (!r.data) return <Estado consulta={r} />
  const { totais, porEvento } = r.data
  return (
    <>
      <GradeDeNumeros>
        <Numero rotulo="inscrições confirmadas" valor={totais.confirmadas} />
        <Numero rotulo="compareceram" valor={totais.compareceram} />
        <Numero rotulo="faltaram" valor={totais.faltaram} />
        <Numero
          rotulo="taxa de comparecimento"
          valor={
            totais.taxaDeComparecimento === null ? 'sem dados' : `${totais.taxaDeComparecimento}%`
          }
        />
        <Numero rotulo="na lista de espera" valor={totais.espera} />
        <Numero rotulo="presentes sem inscrição" valor={totais.presentesSemInscricao} />
      </GradeDeNumeros>
      <Texto variante="apoio" cor="textoSuave">
        Faltas e comparecimento só contam eventos que já aconteceram.
      </Texto>
      <Cartao>
        <GraficoDeBarras
          titulo="Confirmadas e presentes por evento"
          barras={porEvento.map((e) => ({
            rotulo: `${e.titulo}, ${dataCurta(e.inicio, fuso)}${e.realizado ? '' : ' (ainda não aconteceu)'}`,
            valor: e.confirmadas,
            texto: e.realizado
              ? `${e.compareceram} de ${e.confirmadas}`
              : `${e.confirmadas} confirmadas`,
          }))}
        />
      </Cartao>
    </>
  )
}

function Escalas({ comunidadeId, filtros }: PropsDoRelatorio) {
  const r = useRelatorio(comunidadeId, 'escalas', filtros)
  if (!r.data) return <Estado consulta={r} />
  const { totais, porPessoa } = r.data
  return (
    <>
      <GradeDeNumeros>
        <Numero rotulo="escalas" valor={totais.escalas} />
        <Numero rotulo="cumpridas" valor={totais.cumpridas} />
        <Numero rotulo="recusadas" valor={totais.recusadas} />
        <Numero rotulo="sem resposta" valor={totais.semResposta} />
        <Numero rotulo="substituições pedidas" valor={totais.substituicoesPedidas} />
        <Numero rotulo="substituições assumidas" valor={totais.substituicoesAssumidas} />
      </GradeDeNumeros>
      <Cartao>
        <GraficoDeBarras
          titulo="Escalas por pessoa"
          barras={porPessoa.map((p) => ({
            rotulo: p.nome,
            valor: p.escalas,
            texto: `${p.cumpridas} de ${p.escalas} cumpridas`,
          }))}
        />
      </Cartao>
      <Texto variante="apoio" cor="textoSuave">
        Os números mostram participação, não desempenho: não há ranking entre pessoas.
      </Texto>
    </>
  )
}

const NOMES_DA_ATIVIDADE: Record<string, string> = {
  eventosRealizados: 'Eventos realizados',
  eventosPrevistos: 'Eventos previstos',
  eventosCancelados: 'Eventos cancelados',
  inscricoes: 'Inscrições',
  presencas: 'Presenças',
  novosVinculos: 'Pessoas novas na comunidade',
  avisosPublicados: 'Avisos publicados',
  sugestoesRecebidas: 'Sugestões recebidas',
  sugestoesAceitas: 'Sugestões aceitas',
  substituicoesPedidas: 'Substituições pedidas',
}

function Atividade({ comunidadeId, filtros }: PropsDoRelatorio) {
  const r = useRelatorio(comunidadeId, 'atividade', filtros)
  if (!r.data) return <Estado consulta={r} />
  const a = r.data.atividade as unknown as Record<string, number>
  return (
    <Cartao>
      <GraficoDeBarras
        titulo="Atividade no período"
        barras={Object.keys(NOMES_DA_ATIVIDADE).map((k) => ({
          rotulo: NOMES_DA_ATIVIDADE[k]!,
          valor: a[k] ?? 0,
        }))}
      />
    </Cartao>
  )
}
