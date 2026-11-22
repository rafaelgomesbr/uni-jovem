import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { MinhaEscala, ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { ErroDaTela } from '@/ui/Falha'
import { LinhaDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { Secao } from '@/ui/Secao'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Segmentos } from '@/ui/Segmentos'
import { Sol } from '@/ui/Sol'
import { Texto } from '@/ui/Texto'
import { compartilharTexto } from '@/utilidades/compartilhar'
import {
  dataDoInstante,
  formatarDataPorExtenso,
  hojeNoFuso,
  instanteDeDataEHora,
  formatarHora,
  somarDias,
  type DataLocal,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { useResponderComDesfazer, useMinhasEscalas } from '../escalas/consultas'
import { useRespostasOtimistas } from '../escalas/respostasOtimistas'
import { useEventosNoPeriodo } from '../eventos/consultas'
import { FolhaNovaProgramacao } from '../eventos/FolhaNovaProgramacao'
import { SemComunidade } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { CalendarioEmFolha } from './CalendarioEmFolha'
import { useMinhasInscricoesDaAgenda } from './consultas'
import { LinhaDoEncontro } from './LinhaDoEncontro'
import { PedemAjuda } from './PedemAjuda'
import { agruparEncontrosPorDia, avisoDeHorario, cabecalhoDoDia, type GrupoDoDia } from './dias'
import { dataCurtaDoEncontro, horarioELocal } from './semanas'

export type FiltroDaAgenda = 'todos' | 'meu'

/** Quanto do passado "Ver encontros passados" mostra (o histórico completo fica nos relatórios). */
const DIAS_DO_PASSADO = 180

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
 * Agenda (D69, seção 3.3; D79): a lista por DIA ("Dom., 29 de nov. · 3 encontros"), os encontros do
 * dia por horário, com a parte de cada um na linha e a resposta ali mesmo; dois encontros que se
 * encostam ganham "Ao mesmo tempo que ..."; o filtro "Todos / Só o que é meu" (o que sobrou
 * da aba Escalas); "Pedem ajuda" no alto; o Calendário numa folha, com "Dias em que posso
 * ajudar"; e "Novo encontro" para quem cria. Links de fora: `?filtro=meu`, `?vista=calendario`,
 * `?vista=disponibilidade` e `?dia=AAAA-MM-DD`.
 */
function AgendaDaComunidade({ comunidadeId }: { comunidadeId: string }) {
  const pode = usePode()
  const fuso = useFusoDaComunidade()
  const online = useEstaOnline()
  const podeCriar = pode('evento', 'criar')
  const params = useLocalSearchParams<{ filtro?: string; vista?: string; dia?: string }>()

  // A aba fica montada: um link novo troca o que já está aberto (o padrão "ultima pedida").
  const filtroPedido = parametro(params.filtro) === 'meu' ? 'meu' : null
  const vistaPedida = parametro(params.vista)
  const diaPedido = parametro(params.dia)
  const [filtro, setFiltro] = useState<FiltroDaAgenda>(filtroPedido ?? 'todos')
  const [ultimoFiltro, setUltimoFiltro] = useState(filtroPedido)
  const [calendario, setCalendario] = useState({
    aberto: vistaPedida === 'calendario' || vistaPedida === 'disponibilidade',
    ajuda: vistaPedida === 'disponibilidade',
    chave: 0,
  })
  const [ultimaVista, setUltimaVista] = useState(vistaPedida)
  const [dia, setDia] = useState<DataLocal | null>(
    diaPedido && /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) ? diaPedido : null,
  )
  const [ultimoDia, setUltimoDia] = useState(diaPedido)
  if (filtroPedido !== ultimoFiltro) {
    setUltimoFiltro(filtroPedido)
    if (filtroPedido) setFiltro(filtroPedido)
  }
  if (vistaPedida !== ultimaVista) {
    setUltimaVista(vistaPedida)
    if (vistaPedida === 'calendario' || vistaPedida === 'disponibilidade') {
      setCalendario((c) => ({
        aberto: true,
        ajuda: vistaPedida === 'disponibilidade',
        chave: c.chave + 1,
      }))
    }
  }
  if (diaPedido !== ultimoDia) {
    setUltimoDia(diaPedido)
    if (diaPedido && /^\d{4}-\d{2}-\d{2}$/.test(diaPedido)) setDia(diaPedido)
  }
  const [novoAberto, setNovoAberto] = useState(false)
  const [menuDe, setMenuDe] = useState<ResumoDoEvento | null>(null)
  const [verPassados, setVerPassados] = useState(false)
  // "Rascunhos (N)" é um filtro de verdade (pílula que se marca), não um falso botão (D79).
  const [soRascunhos, setSoRascunhos] = useState(false)

  const hoje = hojeNoFuso(fuso)
  const inicioDeHoje = instanteDeDataEHora(hoje, '00:00', fuso)
  const proximos = useEventosNoPeriodo(comunidadeId, inicioDeHoje, null)
  const doDia = useEventosNoPeriodo(
    dia ? comunidadeId : null,
    dia ? instanteDeDataEHora(dia, '00:00', fuso) : null,
    dia ? instanteDeDataEHora(somarDias(dia, 1), '00:00', fuso) : null,
  )
  const passados = useEventosNoPeriodo(
    verPassados ? comunidadeId : null,
    instanteDeDataEHora(somarDias(hoje, -DIAS_DO_PASSADO), '00:00', fuso),
    inicioDeHoje,
  )
  const escalas = useMinhasEscalas(comunidadeId)
  const inscricoes = useMinhasInscricoesDaAgenda(comunidadeId)
  const otimistas = useRespostasOtimistas()
  const { aceitar, recusar } = useResponderComDesfazer(comunidadeId)

  const partesPorEncontro = new Map<string, MinhaEscala[]>()
  for (const e of escalas.data ?? []) {
    partesPorEncontro.set(e.eventoId, [...(partesPorEncontro.get(e.eventoId) ?? []), e])
  }
  const inscritos = new Set((inscricoes.data ?? []).map((i) => i.evento.id))
  const minha = (e: ResumoDoEvento) =>
    (partesPorEncontro.get(e.id)?.length ?? 0) > 0 || inscritos.has(e.id)

  const base = dia ? doDia : proximos
  const todos = (base.data ?? []).filter((e) => e.status !== 'encerrado' || dia !== null)
  const doFiltro = filtro === 'meu' ? todos.filter(minha) : todos
  const rascunhos = podeCriar
    ? (proximos.data ?? []).filter((e) => e.status === 'rascunho').length
    : 0
  const visiveis = soRascunhos ? doFiltro.filter((e) => e.status === 'rascunho') : doFiltro
  const grupos = dia ? [] : agruparEncontrosPorDia(visiveis)

  const abrir = (e: ResumoDoEvento) =>
    router.push({ pathname: '/evento/[eventoId]', params: { eventoId: e.id } })
  const abrirCalendario = (ajuda: boolean) =>
    setCalendario((c) => ({ aberto: true, ajuda, chave: c.chave + 1 }))

  const linha = (e: ResumoDoEvento, doMesmoDia: readonly ResumoDoEvento[]) => (
    <LinhaDoEncontro
      key={e.id}
      evento={e}
      aviso={
        e.status === 'cancelado'
          ? null
          : avisoDeHorario(
              e,
              doMesmoDia.filter((o) => o.status !== 'cancelado'),
            )
      }
      partes={partesPorEncontro.get(e.id) ?? []}
      inscrito={inscritos.has(e.id)}
      otimistas={otimistas}
      semInternet={!online}
      aoAbrir={() => abrir(e)}
      aoSegurar={() => setMenuDe(e)}
      aoAceitar={(p) =>
        aceitar({
          atribuicaoId: p.id,
          eventoInicio: p.eventoInicio,
          fuso: e.fuso,
          funcao: p.funcao,
          etapaTitulo: p.etapaTitulo,
        })
      }
      aoRecusar={(p) =>
        recusar({
          atribuicaoId: p.id,
          eventoInicio: p.eventoInicio,
          fuso: e.fuso,
          funcao: p.funcao,
          etapaTitulo: p.etapaTitulo,
        })
      }
    />
  )

  const salvaEm =
    proximos.dataUpdatedAt > 0
      ? formatarHora(new Date(proximos.dataUpdatedAt).toISOString(), fuso)
      : null

  const acao = podeCriar ? (
    <Botao
      titulo="Novo encontro"
      icone="adicionar"
      variante="primario"
      tamanho="medio"
      aoPressionar={() => setNovoAberto(true)}
    />
  ) : undefined

  return (
    <TelaDoApp titulo="Agenda" {...(acao ? { acaoComTexto: acao } : {})}>
      {!online ? (
        <Aviso
          tipo="alerta"
          titulo={`Sem internet. Você vê a última versão${salvaEm ? `, salva às ${salvaEm}` : ''}.`}
        />
      ) : null}
      <EntradaEmCascata ordem={1}>
        <View style={{ gap: ESPACO.e12 }}>
          <Segmentos
            rotulo="Filtrar encontros"
            valor={filtro}
            aoMudar={setFiltro}
            segmentos={[
              { valor: 'todos', rotulo: 'Todos' },
              { valor: 'meu', rotulo: 'Só o que é meu' },
            ]}
          />
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: ESPACO.e8,
            }}
          >
            <Botao
              titulo="Calendário"
              icone="agenda"
              variante="secundario"
              tamanho="medio"
              aoPressionar={() => abrirCalendario(false)}
            />
            {rascunhos > 0 ? (
              <PilulasDeFiltro
                rotulo="Filtrar rascunhos"
                pilulas={[{ valor: 'rascunhos', rotulo: 'Rascunhos', contagem: rascunhos }]}
                selecionadas={soRascunhos ? ['rascunhos'] : []}
                aoMudar={(v) => setSoRascunhos(v.includes('rascunhos'))}
                opcional
                quebrar
              />
            ) : null}
          </View>
        </View>
      </EntradaEmCascata>

      {dia ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8, flexWrap: 'wrap' }}
        >
          <Texto variante="rotulo" style={{ flex: 1 }}>
            {`Só o dia ${formatarDataPorExtenso(dia, false)}`}
          </Texto>
          {podeCriar ? (
            <Botao
              titulo="Novo encontro neste dia"
              icone="adicionar"
              variante="secundario"
              aoPressionar={() => setNovoAberto(true)}
            />
          ) : null}
          <Botao titulo="Ver todos" variante="secundario" aoPressionar={() => setDia(null)} />
        </View>
      ) : null}

      {base.isPending ? (
        base.fetchStatus === 'paused' ? (
          <Aviso tipo="alerta" titulo="Sem internet. A agenda volta quando a conexão voltar." />
        ) : (
          <Esqueleto rotulo="Carregando a agenda">
            <LinhaDeEsqueleto altura={88} />
            <LinhaDeEsqueleto altura={88} />
            <LinhaDeEsqueleto altura={88} />
          </Esqueleto>
        )
      ) : base.error ? (
        <ErroDaTela
          erro={base.error}
          titulo="Não deu para carregar a agenda"
          aoTentarDeNovo={() => void base.refetch()}
        />
      ) : (
        <>
          <PedemAjuda comunidadeId={comunidadeId} semInternet={!online} />
          {visiveis.length === 0 ? (
            <Vazio
              filtro={filtro}
              dia={dia}
              podeCriar={podeCriar}
              aoMarcar={() => setNovoAberto(true)}
              aoAjudar={() => abrirCalendario(true)}
              aoVerTodos={() => {
                setDia(null)
                setFiltro('todos')
              }}
            />
          ) : dia ? (
            <View style={{ gap: ESPACO.e12 }}>
              {agruparEncontrosPorDia(visiveis).flatMap((g) =>
                g.itens.map((e) => linha(e, g.itens)),
              )}
            </View>
          ) : (
            grupos.map((g, i) => (
              <EntradaEmCascata key={g.dia} ordem={Math.min(i + 2, 5)}>
                <DiaDaAgenda grupo={g} hoje={hoje} linha={linha} />
              </EntradaEmCascata>
            ))
          )}
        </>
      )}

      {!dia ? (
        <View style={{ gap: ESPACO.e12 }}>
          <Botao
            titulo={verPassados ? 'Esconder encontros passados' : 'Ver encontros passados'}
            variante="secundario"
            icone="relogio"
            expandido={verPassados}
            aoPressionar={() => setVerPassados((v) => !v)}
          />
          {verPassados ? (
            passados.isPending ? (
              <Esqueleto rotulo="Carregando os encontros passados">
                <LinhaDeEsqueleto altura={88} />
              </Esqueleto>
            ) : passados.error ? (
              <ErroDaTela
                erro={passados.error}
                titulo="Não deu para carregar os encontros passados"
                aoTentarDeNovo={() => void passados.refetch()}
              />
            ) : (passados.data ?? []).length === 0 ? (
              <Texto variante="corpo" cor="textoSuave">
                Nenhum encontro nos últimos meses.
              </Texto>
            ) : (
              <Secao titulo="Encontros passados">
                <View style={{ gap: ESPACO.e16 }}>
                  {agruparEncontrosPorDia(passados.data ?? [], true).map((g) => (
                    <DiaDaAgenda key={g.dia} grupo={g} hoje={hoje} linha={linha} />
                  ))}
                </View>
              </Secao>
            )
          ) : null}
        </View>
      ) : null}

      {podeCriar ? (
        <FolhaNovaProgramacao
          aberta={novoAberto}
          aoFechar={() => setNovoAberto(false)}
          {...(dia ? { data: dia } : {})}
        />
      ) : null}
      <CalendarioEmFolha
        key={calendario.chave}
        aberta={calendario.aberto}
        aoFechar={() => setCalendario((c) => ({ ...c, aberto: false }))}
        comunidadeId={comunidadeId}
        fuso={fuso}
        hoje={hoje}
        modoDeAjudaInicial={calendario.ajuda}
        aoEscolherDia={(d) => {
          setCalendario((c) => ({ ...c, aberto: false }))
          setDia(d)
          setFiltro('todos')
        }}
      />
      <MenuDaLinha
        evento={menuDe}
        organiza={podeCriar}
        podeCancelar={pode('evento', 'cancelar_ou_adiar')}
        aoFechar={() => setMenuDe(null)}
      />
    </TelaDoApp>
  )
}

/**
 * Um dia da Agenda: o cabeçalho ("Dom., 29 de nov. · Amanhã · 3 encontros") e, debaixo dele, os
 * encontros por horário. É o que diz, de relance, que o mesmo dia tem várias atividades (D79).
 */
function DiaDaAgenda({
  grupo,
  hoje,
  linha,
}: {
  grupo: GrupoDoDia<ResumoDoEvento>
  hoje: DataLocal
  linha: (e: ResumoDoEvento, doMesmoDia: readonly ResumoDoEvento[]) => ReactNode
}) {
  return (
    <View testID={`dia-${grupo.dia}`} style={{ gap: ESPACO.e8 }}>
      <Texto variante="tituloItem" nivel={2} accessibilityRole="header">
        {cabecalhoDoDia(grupo.dia, hoje, grupo.itens.length)}
      </Texto>
      <View style={{ gap: ESPACO.e12 }}>{grupo.itens.map((e) => linha(e, grupo.itens))}</View>
    </View>
  )
}

/** Os vazios da Agenda, com os textos do documento (seção 3.3) e uma ação sempre que a pessoa pode agir. */
function Vazio({
  filtro,
  dia,
  podeCriar,
  aoMarcar,
  aoAjudar,
  aoVerTodos,
}: {
  filtro: FiltroDaAgenda
  dia: DataLocal | null
  podeCriar: boolean
  aoMarcar: () => void
  aoAjudar: () => void
  aoVerTodos: () => void
}) {
  const sol = (
    <View style={{ alignItems: 'center' }}>
      <Sol pose="escondido" lado={96} />
    </View>
  )
  if (dia) {
    return (
      <View style={{ gap: ESPACO.e12 }}>
        {sol}
        <EstadoVazio
          icone="agenda"
          titulo="Nenhum encontro neste dia."
          descricao="Escolha outro dia no calendário ou veja a lista inteira."
          acao={{ titulo: 'Ver todos os encontros', aoPressionar: aoVerTodos }}
        />
      </View>
    )
  }
  if (filtro === 'meu') {
    return (
      <View style={{ gap: ESPACO.e12 }}>
        {sol}
        <EstadoVazio
          icone="agenda"
          titulo="Você não tem nenhuma parte nos próximos encontros."
          descricao="Se quiser ajudar, diga em quais dias você pode."
          acao={{ titulo: 'Dias em que posso ajudar', aoPressionar: aoAjudar }}
        />
      </View>
    )
  }
  return (
    <View style={{ gap: ESPACO.e12 }}>
      {sol}
      <EstadoVazio
        icone="agenda"
        titulo="Nenhum encontro marcado."
        descricao={
          podeCriar
            ? 'Marque o próximo para a comunidade ver e responder.'
            : 'Quando a liderança marcar o próximo, ele aparece aqui.'
        }
        {...(podeCriar
          ? {
              // O mesmo "Novo encontro" do topo (um caminho só, D75); aqui secundário para a tela não ter dois primários.
              acao: {
                titulo: 'Novo encontro',
                icone: 'adicionar',
                variante: 'secundario' as const,
                aoPressionar: aoMarcar,
              },
            }
          : {})}
      />
    </View>
  )
}

/**
 * O menu de pressionar e segurar (padrão 5.7): só o que já existe no "Mais" do encontro. Nada
 * exclusivo do gesto: cada item também está dentro do encontro.
 */
function MenuDaLinha({
  evento,
  organiza,
  podeCancelar,
  aoFechar,
}: {
  evento: ResumoDoEvento | null
  organiza: boolean
  podeCancelar: boolean
  aoFechar: () => void
}) {
  async function compartilhar(e: ResumoDoEvento) {
    const dia = dataCurtaDoEncontro(e.inicio, e.fuso)
    await compartilharTexto(
      `${e.titulo}, ${dia}, ${formatarHora(e.inicio, e.fuso)}${e.localNome ? `, ${e.localNome}` : ''}.`,
    )
  }
  const e = evento
  return (
    <MenuDeAcoes
      aberto={e !== null}
      titulo={e?.titulo ?? 'Encontro'}
      aoFechar={aoFechar}
      acoes={
        e
          ? [
              {
                titulo: 'Ver o encontro',
                icone: 'eventos',
                descricao: horarioELocal(e),
                navega: true,
                aoPressionar: () =>
                  router.push({ pathname: '/evento/[eventoId]', params: { eventoId: e.id } }),
              },
              {
                titulo: 'Compartilhar',
                icone: 'compartilhar',
                aoPressionar: () => compartilhar(e),
              },
              organiza && {
                titulo: 'Copiar este encontro',
                icone: 'duplicar',
                navega: true,
                aoPressionar: () =>
                  router.push({ pathname: '/evento/igual-ao-ultimo', params: { origem: e.id } }),
              },
              podeCancelar &&
                (e.status === 'publicado' || e.status === 'adiado') && {
                  titulo: 'Cancelar ou adiar',
                  icone: 'cancelar',
                  destrutiva: true,
                  navega: true,
                  aoPressionar: () =>
                    router.push({
                      pathname: '/evento/[eventoId]/status',
                      params: { eventoId: e.id },
                    }),
                },
            ]
          : []
      }
    />
  )
}

/** Usado pelos testes: o dia (AAAA-MM-DD) de um encontro no fuso dele. */
export const diaDoEncontro = (e: Pick<ResumoDoEvento, 'inicio' | 'fuso'>) =>
  dataDoInstante(e.inicio, e.fuso)
