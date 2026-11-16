import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Substituicao } from '@/servicos/contratoDosEventos'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { confirmar } from '@/utilidades/confirmar'
import {
  DIAS_CURTOS,
  dataDoInstante,
  diaDaSemana,
  falarQuando,
  formatarDataPorExtenso,
  hojeNoFuso,
  instanteDeDataEHora,
  somarDias,
  type DataLocal,
} from '@/utilidades/datas'
import { Botao } from '@/ui/Botao'
import { CampoDeData } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Secao } from '@/ui/Secao'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'
import { parametro } from '@/utilidades/parametros'

import { useFusoDaComunidade, useMeuVinculo } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { naComunidade, useEventosNoPeriodo } from '../eventos/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { CartaoDaEscala, quandoDaEscala } from './CartaoDaEscala'
import {
  useAguardandoResposta,
  useDisponibilidade,
  useInvalidarEscalas,
  useMinhasEscalas,
  useSubstituicoes,
} from './consultas'

type Vista = 'proximas' | 'disponibilidade'

/** `/escalas?vista=disponibilidade` (do Início, "Informar minha disponibilidade") abre ali. */
function vistaDoParametro(valor: string | null): Vista | null {
  return valor === 'proximas' || valor === 'disponibilidade' ? valor : null
}

/**
 * Aba Escalas (D57, 3.4.5): para quem convoca, o cartão "Aguardando
 * resposta" no topo; depois, os segmentos "Próximas" (as minhas convocações
 * e os pedidos de substituição que posso assumir) e "Disponibilidade" (os
 * dias em que posso ajudar, em pílulas).
 */
export function TelaEscalas() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <TelaDoApp titulo="Escalas">
        <SemComunidade oQue="as suas escalas" />
      </TelaDoApp>
    )
  }
  return <Escalas comunidadeId={comunidadeAtiva.id} />
}

function Escalas({ comunidadeId }: { comunidadeId: string }) {
  const pode = usePode()
  const pedida = vistaDoParametro(parametro(useLocalSearchParams<{ vista?: string }>().vista))
  const [vista, setVista] = useState<Vista>(pedida ?? 'proximas')
  // A aba fica montada: um link novo (`?vista=`) troca o segmento já aberto.
  const [ultimaPedida, setUltimaPedida] = useState(pedida)
  if (pedida !== ultimaPedida) {
    setUltimaPedida(pedida)
    if (pedida) setVista(pedida)
  }
  return (
    <TelaDoApp titulo="Escalas">
      {pode('escala', 'atribuir') ? <AguardandoResposta comunidadeId={comunidadeId} /> : null}
      <Segmentos
        rotulo="O que mostrar"
        valor={vista}
        aoMudar={setVista}
        segmentos={[
          { valor: 'proximas', rotulo: 'Próximas' },
          { valor: 'disponibilidade', rotulo: 'Disponibilidade' },
        ]}
      />
      {vista === 'proximas' ? (
        <Proximas comunidadeId={comunidadeId} aoInformar={() => setVista('disponibilidade')} />
      ) : (
        <MinhaDisponibilidade comunidadeId={comunidadeId} />
      )}
    </TelaDoApp>
  )
}

/** "2 sem resposta · 1 não pode ir": o número sempre com a palavra, nunca só a cor. */
export function resumoDasRespostas(pendentes: number, recusadas: number): string {
  return [
    pendentes ? `${pendentes} sem resposta` : null,
    recusadas ? `${recusadas} ${recusadas === 1 ? 'não pode ir' : 'não podem ir'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Para quem convoca (D57): os encontros publicados com convocação ainda sem
 * resposta ou recusada. O toque abre o encontro, onde fica "Convocar
 * pessoa". Sem nada esperando, o cartão não ocupa espaço.
 */
function AguardandoResposta({ comunidadeId }: { comunidadeId: string }) {
  const fuso = useFusoDaComunidade()
  const consulta = useAguardandoResposta(comunidadeId, true)
  if (consulta.isPending) return null
  if (consulta.error) {
    return (
      <AvisoDeFalha
        erro={consulta.error}
        titulo="Não deu para ver quem falta responder"
        aoTentarDeNovo={() => void consulta.refetch()}
      />
    )
  }
  if (consulta.data.length === 0) return null
  return (
    <Secao
      titulo="Aguardando resposta"
      rodape="Encontros publicados com convocação sem resposta ou recusada."
    >
      <CartaoDeVidro lista>
        <Lista>
          {consulta.data.map((e) => {
            const quando = quandoDaEscala(e.inicio, e.fuso || fuso)
            const resumo = resumoDasRespostas(e.pendentes, e.recusadas)
            return (
              <LinhaDeLista
                key={e.id}
                icone={e.recusadas ? 'avisoAlerta' : 'relogio'}
                titulo={e.titulo}
                descricao={`${quando}\n${resumo}`}
                linhasDaDescricao={0}
                rotuloAcessivel={`${e.titulo}, ${falarQuando(e.inicio, e.fuso || fuso)}. ${resumo}. Abrir o encontro`}
                aoPressionar={() =>
                  router.push({ pathname: '/evento/[eventoId]', params: { eventoId: e.id } })
                }
              />
            )
          })}
        </Lista>
      </CartaoDeVidro>
    </Secao>
  )
}

/**
 * As minhas escalas e, abaixo, os pedidos que eu posso assumir. Um primário
 * por tela: "Confirmar" na primeira escala pendente ou, sem pendente,
 * "Assumir" no primeiro pedido.
 */
function Proximas({ comunidadeId, aoInformar }: { comunidadeId: string; aoInformar: () => void }) {
  const fuso = useFusoDaComunidade()
  const escalas = useMinhasEscalas(comunidadeId)
  const pedidos = useSubstituicoes(comunidadeId)
  const pendente = escalas.data?.find((e) => e.estado === 'pendente')?.id ?? null

  return (
    <>
      {escalas.isPending ? (
        <Esqueleto rotulo="Carregando as suas escalas">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      ) : escalas.error ? (
        <ErroDaTela
          erro={escalas.error}
          oQue="as suas escalas"
          aoTentarDeNovo={() => void escalas.refetch()}
        />
      ) : escalas.data.length === 0 ? (
        <EstadoVazio
          icone="escalas"
          titulo="Nenhuma escala para você"
          descricao="Quando a organização escalar você numa etapa, ela aparece aqui para confirmar. Diga os dias em que pode ajudar."
          acao={{ titulo: 'Informar disponibilidade', aoPressionar: aoInformar }}
          acaoSecundaria={{ titulo: 'Ver a agenda', aoPressionar: () => router.push('/agenda') }}
        />
      ) : (
        escalas.data.map((e) => (
          <CartaoDaEscala
            key={e.id}
            escala={e}
            comunidadeId={comunidadeId}
            fuso={fuso}
            primario={e.id === pendente}
          />
        ))
      )}
      <PedidosDeSubstituicao
        comunidadeId={comunidadeId}
        fuso={fuso}
        consulta={pedidos}
        // Sem escala pendente (e sem o estado vazio, que já tem o seu primário), "Assumir" sobe.
        primeiroEhPrimario={escalas.isSuccess && escalas.data.length > 0 && pendente === null}
      />
    </>
  )
}

/**
 * "Pedidos de substituição" (3.4.5): cartão lista com o evento e a etapa, quem
 * pediu e quando, e "Assumir" à direita de cada linha. Sem pedido para mim, a
 * seção não ocupa espaço.
 */
function PedidosDeSubstituicao({
  comunidadeId,
  fuso,
  consulta,
  primeiroEhPrimario,
}: {
  comunidadeId: string
  fuso: string
  consulta: ReturnType<typeof useSubstituicoes>
  primeiroEhPrimario: boolean
}) {
  const invalidar = useInvalidarEscalas(comunidadeId)
  const assumir = useMutation({
    mutationFn: (id: string) =>
      api.post(`${naComunidade(comunidadeId)}/substituicoes/${id}/assumir`),
    onSuccess: invalidar,
  })
  const cancelar = useMutation({
    mutationFn: (id: string) =>
      api.post(`${naComunidade(comunidadeId)}/substituicoes/${id}/cancelar`),
    onSuccess: invalidar,
  })

  async function pedirParaAssumir(s: Substituicao) {
    const ok = await confirmar({
      titulo: 'Assumir esta escala?',
      mensagem: `Você fica no lugar de ${s.pedidaPor} em ${s.evento.titulo}${s.etapa ? `, ${s.etapa}` : ''}.`,
      confirmar: 'Assumir',
    })
    if (ok) assumir.mutate(s.id)
  }

  if (consulta.isPending) return null
  if (consulta.error) {
    return (
      <Secao titulo="Pedidos de substituição">
        <AvisoDeFalha
          erro={consulta.error}
          titulo="Não deu para carregar os pedidos"
          aoTentarDeNovo={() => void consulta.refetch()}
        />
      </Secao>
    )
  }
  const visiveis = consulta.data.filter((s) => s.possoAssumir || s.minha)
  if (visiveis.length === 0) return null
  const primeiroAssumivel = visiveis.find((s) => s.possoAssumir)?.id

  return (
    <Secao titulo="Pedidos de substituição">
      {(assumir.error ?? cancelar.error) ? (
        <AvisoDeFalha erro={assumir.error ?? cancelar.error} />
      ) : null}
      <CartaoDeVidro lista>
        <Lista>
          {visiveis.map((s) => {
            const titulo = s.etapa ? `${s.evento.titulo} · ${s.etapa}` : s.evento.titulo
            const quem = s.minha
              ? 'Seu pedido'
              : s.dirigida
                ? `${s.pedidaPor} pediu direto para você`
                : `${s.pedidaPor} pediu a qualquer pessoa da comunidade`
            const descricao = [
              `${quem} · ${s.funcao}`,
              quandoDaEscala(s.evento.inicio, fuso),
              s.motivo ? `Motivo: ${s.motivo}` : null,
            ]
              .filter(Boolean)
              .join('\n')
            return (
              <LinhaDeLista
                key={s.id}
                icone="trocar"
                titulo={titulo}
                descricao={descricao}
                // Sem limite (0): ao lado do "Assumir" a coluna é estreita, e o motivo só aparece aqui.
                linhasDaDescricao={0}
                extra={
                  s.possoAssumir ? (
                    <Botao
                      titulo="Assumir"
                      variante={
                        primeiroEhPrimario && s.id === primeiroAssumivel ? 'primario' : 'secundario'
                      }
                      rotuloAcessivel={`Assumir a escala de ${s.pedidaPor} em ${s.evento.titulo}`}
                      dica={`${titulo}, ${falarQuando(s.evento.inicio, fuso)}.`}
                      carregando={assumir.isPending && assumir.variables === s.id}
                      aoPressionar={() => void pedirParaAssumir(s)}
                    />
                  ) : (
                    <Botao
                      titulo="Cancelar"
                      variante="secundario"
                      rotuloAcessivel={`Cancelar o meu pedido de substituição em ${s.evento.titulo}`}
                      carregando={cancelar.isPending && cancelar.variables === s.id}
                      aoPressionar={() => cancelar.mutate(s.id)}
                    />
                  )
                }
              />
            )
          })}
        </Lista>
      </CartaoDeVidro>
    </Secao>
  )
}

const SEMANAS_DE_DISPONIBILIDADE = 8
const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

/** Datas para informar: os dias com evento nas próximas semanas, ou os próximos sábados. */
export function datasParaDisponibilidade(
  hoje: DataLocal,
  diasComEvento: readonly DataLocal[],
  extras: readonly DataLocal[],
): DataLocal[] {
  const base = diasComEvento.length
    ? diasComEvento
    : Array.from({ length: 6 }, (_, i) =>
        somarDias(hoje, ((6 - diaDaSemana(hoje) + 7) % 7) + i * 7),
      )
  return [...new Set([...base, ...extras])].filter((d) => d >= hoje).sort()
}

/** "sáb 21 nov": o dia da semana fica, porque nem toda data é sábado. */
export function rotuloDaData(data: DataLocal): string {
  return `${DIAS_CURTOS[diaDaSemana(data)]} ${Number(data.slice(8, 10))} ${MESES_CURTOS[Number(data.slice(5, 7)) - 1]}`
}

/**
 * Disponibilidade (3.4.5): pílulas com as próximas datas, em que ativa quer
 * dizer "posso ajudar" (o check e a borda dizem, além da cor). Tocar marca ou
 * desmarca na hora. Outra data entra pelo seletor nativo, sem digitar.
 */
function MinhaDisponibilidade({ comunidadeId }: { comunidadeId: string }) {
  const fuso = useFusoDaComunidade()
  const eu = useMeuVinculo()
  const invalidar = useInvalidarEscalas(comunidadeId)
  const hoje = hojeNoFuso(fuso)
  const ate = somarDias(hoje, SEMANAS_DE_DISPONIBILIDADE * 7)
  const [extras, setExtras] = useState<DataLocal[]>([])
  const [outra, setOutra] = useState<DataLocal | null>(null)
  // O que foi tocado e ainda não voltou do servidor: a pílula responde na hora.
  const [otimista, setOtimista] = useState<Readonly<Record<string, boolean>>>({})
  const eventos = useEventosNoPeriodo(
    comunidadeId,
    instanteDeDataEHora(hoje, '00:00', fuso),
    instanteDeDataEHora(ate, '00:00', fuso),
  )
  const ultimaExtra = extras.reduce((m, d) => (d > m ? d : m), ate)
  const disponibilidade = useDisponibilidade(comunidadeId, hoje, ultimaExtra)
  const informar = useMutation({
    mutationFn: ({ data, disponivel }: { data: DataLocal; disponivel: boolean }) =>
      api.put(`${naComunidade(comunidadeId)}/disponibilidade/${data}`, { disponivel }),
    onMutate: ({ data, disponivel }) => setOtimista((o) => ({ ...o, [data]: disponivel })),
    onSuccess: () => disponibilidade.refetch().then(invalidar),
    onSettled: (_r, _e, { data }) =>
      setOtimista((o) => Object.fromEntries(Object.entries(o).filter(([d]) => d !== data))),
  })

  const diasComEvento = [
    ...new Set(
      (eventos.data ?? [])
        .filter((e) => e.status === 'publicado' || e.status === 'rascunho')
        .map((e) => dataDoInstante(e.inicio, e.fuso)),
    ),
  ]
  const datas = datasParaDisponibilidade(hoje, diasComEvento, extras)
  const minhas = new Map(
    (disponibilidade.data ?? [])
      .filter((d) => eu === null || d.vinculo_id === eu)
      .map((d) => [d.data, d.disponivel]),
  )
  const marcadas = datas.filter((d) => otimista[d] ?? minhas.get(d) === true)

  function aoMudar(novas: DataLocal[]) {
    const tocada =
      novas.find((d) => !marcadas.includes(d)) ?? marcadas.find((d) => !novas.includes(d))
    if (tocada) informar.mutate({ data: tocada, disponivel: novas.includes(tocada) })
  }

  return (
    <>
      <Texto variante="corpo" cor="textoSuave">
        Toque nos dias em que você pode ajudar. A organização vê isso ao montar as escalas.
      </Texto>
      {eventos.isPending || disponibilidade.isPending ? (
        <Esqueleto rotulo="Carregando as datas">
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : disponibilidade.error ? (
        <ErroDaTela
          erro={disponibilidade.error}
          oQue="a sua disponibilidade"
          aoTentarDeNovo={() => void disponibilidade.refetch()}
        />
      ) : (
        <View style={{ gap: ESPACO.e8 }}>
          <PilulasDeFiltro
            rotulo="Dias em que posso ajudar"
            multipla
            // "sáb 21 nov" cabe na pílula; o leitor de tela ouve "sábado, 21 de novembro".
            pilulas={datas.map((d) => ({
              valor: d,
              rotulo: rotuloDaData(d),
              rotuloAcessivel: formatarDataPorExtenso(d, false),
            }))}
            selecionadas={marcadas}
            aoMudar={aoMudar}
          />
          <Texto variante="legenda" cor="textoSuave">
            {marcadas.length === 0
              ? 'Nenhum dia marcado ainda.'
              : marcadas.length === 1
                ? `Você pode ajudar em 1 dia: ${formatarDataPorExtenso(marcadas[0]!, false)}.`
                : `Você pode ajudar em ${marcadas.length} dias.`}
          </Texto>
        </View>
      )}
      {informar.error ? <AvisoDeFalha erro={informar.error} /> : null}
      <CartaoDeVidro opaco>
        <CampoDeData
          rotulo="Incluir outra data"
          opcional
          valor={outra}
          minimo={hoje}
          ajuda="A data entra na lista acima; toque nela para marcar."
          aoMudar={(d) => {
            setOutra(d)
            if (d >= hoje && !datas.includes(d)) setExtras((x) => [...x, d])
          }}
        />
      </CartaoDeVidro>
    </>
  )
}
