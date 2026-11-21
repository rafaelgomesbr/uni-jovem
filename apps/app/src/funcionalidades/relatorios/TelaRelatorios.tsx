import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { Agrupamento } from '@/servicos/contratoDosModulos'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import {
  dataDoInstante,
  formatarDataLocal,
  hojeNoFuso,
  NOMES_DOS_MESES,
  type DataLocal,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { BotaoIcone } from '@/ui/Botao'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
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

/**
 * Rota `/relatorios?tipo=` (3.7.5). Só organizador para cima (a API também
 * confere). Cabeçalho com o só ícone "Exportar CSV"; pílulas de tipo e de
 * período; números em grade de 2 colunas com algarismos tabulares; gráficos
 * de barra em cartões; e o lembrete de que número não é desempenho.
 */
export function TelaRelatorios() {
  const pode = usePode()
  const { comunidadeAtiva } = useSessao()
  const doParametro = parametro(useLocalSearchParams<{ tipo?: string }>().tipo)
  const tipo: TipoDeRelatorio = ehTipo(doParametro) ? doParametro : 'presenca'
  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo="Relatórios">
        <SemComunidade oQue="os relatórios" />
      </Tela>
    )
  }
  if (!pode('relatorio', 'ler')) {
    return (
      <Tela pilha titulo="Relatórios">
        <Aviso tipo="alerta" titulo="Relatórios são da organização">
          Os relatórios da comunidade ficam com organizadores e administradores. Se precisar de um
          número, peça a quem organiza.
        </Aviso>
      </Tela>
    )
  }
  return (
    <Tela
      pilha
      titulo="Relatórios"
      descricao="Números agregados. Pedidos de oração nunca entram."
      acoes={
        <BotaoIcone
          icone="baixar"
          rotulo="Exportar CSV"
          texto="Exportar"
          circular
          aoPressionar={() => router.push('/relatorios/exportacoes')}
        />
      }
    >
      <PilulasDeFiltro
        rotulo="Relatório"
        pilulas={TIPOS}
        selecionadas={[tipo]}
        aoMudar={(v) => {
          if (v[0]) router.setParams({ tipo: v[0] })
        }}
      />
      <Relatorios comunidadeId={comunidadeAtiva.id} tipo={tipo} />
      <Texto variante="legenda" cor="textoSuave">
        Os números mostram participação, não desempenho.
      </Texto>
    </Tela>
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

/** Carregando (esqueleto da grade e de um gráfico) ou erro com "Tentar de novo". */
function Estado({
  consulta,
}: {
  consulta: { isPending: boolean; error: unknown; refetch: () => unknown }
}) {
  if (consulta.isPending) {
    return (
      <Esqueleto rotulo="Calculando o relatório">
        <CartaoDeEsqueleto titulo />
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  return (
    <EstadoVazio
      icone={consulta.error instanceof SemConexao ? 'semConexao' : 'erro'}
      titulo="Não deu para calcular o relatório"
      descricao={mensagemDoErro(consulta.error)}
      acao={{ titulo: 'Tentar de novo', aoPressionar: () => void consulta.refetch() }}
    />
  )
}

const dataCurta = (iso: string, fuso: string) => formatarDataLocal(dataDoInstante(iso, fuso))

function Presenca({ comunidadeId, filtros, fuso }: PropsDoRelatorio & { fuso: string }) {
  const r = useRelatorio(comunidadeId, 'presenca', filtros)
  if (!r.data) return <Estado consulta={r} />
  const { totais, porPeriodo, porEvento } = r.data
  return (
    <>
      <GradeDeNumeros>
        <Numero rotulo="encontros" valor={totais.eventos} />
        <Numero rotulo="presenças" valor={totais.presentes} />
        <Numero rotulo="média por encontro" valor={totais.mediaPorEvento.toLocaleString('pt-BR')} />
        <Numero rotulo="membros diferentes" valor={totais.membrosDistintos} />
      </GradeDeNumeros>
      <GraficoDeBarras
        titulo={filtros.agrupar === 'mes' ? 'Presenças por mês' : 'Presenças por semana'}
        barras={porPeriodo.map((p) => ({
          rotulo: `${rotuloDoPeriodo(p.inicio, filtros.agrupar)} (${p.eventos} ${p.eventos === 1 ? 'encontro' : 'encontros'})`,
          valor: p.presentes,
          texto: `${p.presentes}`,
        }))}
      />
      <GraficoDeBarras
        titulo="Presenças por encontro"
        barras={porEvento.map((e) => ({
          rotulo: `${e.titulo}, ${dataCurta(e.inicio, fuso)}`,
          valor: e.presentes,
        }))}
      />
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
      <Texto variante="legenda" cor="textoSuave">
        Faltas e comparecimento só contam encontros que já aconteceram.
      </Texto>
      <GraficoDeBarras
        titulo="Confirmadas e presentes por encontro"
        barras={porEvento.map((e) => ({
          rotulo: `${e.titulo}, ${dataCurta(e.inicio, fuso)}${e.realizado ? '' : ' (ainda não aconteceu)'}`,
          valor: e.confirmadas,
          texto: e.realizado
            ? `${e.compareceram} de ${e.confirmadas}`
            : `${e.confirmadas} confirmadas`,
        }))}
      />
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
      <GraficoDeBarras
        titulo="Escalas por pessoa"
        barras={porPessoa.map((p) => ({
          rotulo: p.nome,
          valor: p.escalas,
          texto: `${p.cumpridas} de ${p.escalas} cumpridas`,
        }))}
      />
      <Texto variante="legenda" cor="textoSuave">
        Não há ranking entre pessoas.
      </Texto>
    </>
  )
}

const NOMES_DA_ATIVIDADE: Record<string, string> = {
  eventosRealizados: 'Encontros realizados',
  eventosPrevistos: 'Encontros previstos',
  eventosCancelados: 'Encontros cancelados',
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
    <GraficoDeBarras
      titulo="Atividade no período"
      barras={Object.keys(NOMES_DA_ATIVIDADE).map((k) => ({
        rotulo: NOMES_DA_ATIVIDADE[k]!,
        valor: a[k] ?? 0,
      }))}
    />
  )
}
