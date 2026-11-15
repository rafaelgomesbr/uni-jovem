import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Fragment, type ReactElement } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { RespostaDoInicio, TarefaDoInicio } from '@/servicos/contratoDosEventos'
import { AvisoDeFalha } from '@/ui/Falha'
import { formatarDataLocal, dataDoInstante } from '@/utilidades/datas'
import { primeiroNome } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { naComunidade } from '../eventos/consultas'
import { useMudancaNoEvento } from '../eventos/mutacoes'
import {
  AtalhoDaPlataforma,
  EscolherComunidade,
  PrimeirosPassosDoCriador,
  SemComunidadeParaMembro,
} from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { EventosPreparados } from '../offline/EventosPreparados'
import { CartaoDaMissao, useMissaoPendente } from '../onboarding/CartaoDaMissao'
import { CartaoDoVersiculo } from '../versiculo/CartaoDoVersiculo'
import { AvisosDoInicio } from './AvisosDoInicio'
import { CartaoDoProximoEvento } from './CartaoDoProximoEvento'
import { CartaoSuaEscala } from './CartaoSuaEscala'
import { MinhasInscricoes, useMinhasInscricoes } from './MinhasInscricoes'

/** No máximo 5 cartões no Início (2.13). */
const MAXIMO_DE_CARTOES = 5

function saudacao(agora = new Date()): string {
  const hora = agora.getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function useInicio(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.inicio(comunidadeId ?? ''),
    queryFn: () => api.get<RespostaDoInicio>(`${naComunidade(comunidadeId!)}/inicio`),
    enabled: comunidadeId !== null,
  })
}

/**
 * Início (seção 3.2), nas quatro variações: com dados (fiel ao mockup), sem
 * comunidade para o Criador, sem comunidade para o membro e com várias
 * comunidades sem nenhuma escolhida. A saudação é o título, sem "!".
 */
export function TelaInicio() {
  const { conta, comunidadeAtiva, comunidades } = useSessao()
  const nome = primeiroNome(conta?.nome)
  return (
    <TelaDoApp titulo={nome ? `${saudacao()}, ${nome}` : saudacao()}>
      {comunidadeAtiva ? (
        <Inicio comunidadeId={comunidadeAtiva.id} nomeDaComunidade={comunidadeAtiva.nome} />
      ) : comunidades.length > 0 ? (
        <>
          <EscolherComunidade />
          <CartaoDoVersiculo />
        </>
      ) : conta?.criador ? (
        <>
          <PrimeirosPassosDoCriador />
          <CartaoDoVersiculo />
          <AtalhoDaPlataforma />
        </>
      ) : (
        <>
          <SemComunidadeParaMembro />
          <CartaoDoVersiculo />
        </>
      )}
    </TelaDoApp>
  )
}

function Inicio({
  comunidadeId,
  nomeDaComunidade,
}: {
  comunidadeId: string
  nomeDaComunidade: string
}) {
  const pode = usePode()
  const fuso = useFusoDaComunidade()
  const inicio = useInicio(comunidadeId)
  const inscricoes = useMinhasInscricoes(comunidadeId)
  const missaoPendente = useMissaoPendente()
  const podeCriar = pode('evento', 'criar')

  // Sem conexão e sem nada carregado: o que está preparado neste aparelho abre na hora.
  if (inicio.isPending && inicio.fetchStatus === 'paused') {
    return (
      <>
        <Aviso tipo="alerta" titulo="Sem conexão: o Início volta quando a internet voltar">
          O que foi preparado neste aparelho continua aqui.
        </Aviso>
        <CartaoDoVersiculo />
        <EventosPreparados />
      </>
    )
  }
  if (inicio.isPending) {
    return (
      <Esqueleto rotulo={`Carregando ${nomeDaComunidade}`}>
        <CartaoDeEsqueleto />
        <CartaoDeEsqueleto titulo />
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (inicio.error) {
    // O versículo não depende da rede: continua; o erro fica no lugar do destaque.
    return (
      <>
        <CartaoDoVersiculo />
        <AvisoDeFalha erro={inicio.error} aoTentarDeNovo={() => void inicio.refetch()} />
        <EventosPreparados />
      </>
    )
  }

  const d = inicio.data
  const [proximo] = d.proximosEventos
  const [escala] = d.minhasEscalas
  const minhasEtapas = proximo
    ? d.minhasEscalas
        .filter((e) => e.eventoId === proximo.id && e.etapaTitulo)
        .map((e) => e.etapaTitulo!)
    : []
  const minhasInscricoes = inscricoes.data ?? []

  // Nada para mostrar: um único estado vazio, com ação (as seções vazias não ocupam cartão).
  const nadaExiste =
    !proximo &&
    !escala &&
    d.minhasTarefas.length === 0 &&
    (d.avisos ?? []).length === 0 &&
    d.substituicoesAbertas === 0 &&
    minhasInscricoes.length === 0

  // Cartões condicionais, só com conteúdo, na ordem da 3.2.1.
  const condicionais = [
    (d.avisos ?? []).length
      ? { chave: 'aviso', no: <AvisosDoInicio avisos={d.avisos ?? []} /> }
      : null,
    d.minhasTarefas.length
      ? {
          chave: 'tarefas',
          no: (
            <CartaoDeVidro sobrancelha="Suas tarefas" intervalo={0}>
              {d.minhasTarefas.slice(0, 3).map((t) => (
                <TarefaDoInicio key={t.id} tarefa={t} comunidadeId={comunidadeId} fuso={fuso} />
              ))}
            </CartaoDeVidro>
          ),
        }
      : null,
    minhasInscricoes.length
      ? { chave: 'inscricoes', no: <MinhasInscricoes inscricoes={minhasInscricoes} /> }
      : null,
    missaoPendente ? { chave: 'missao', no: <CartaoDaMissao /> } : null,
  ].filter((c): c is { chave: string; no: ReactElement } => c !== null)
  const fixos = 1 + (proximo ? 1 : 0) + (escala ? 1 : 0)
  const visiveis = condicionais.slice(0, Math.max(0, MAXIMO_DE_CARTOES - fixos))

  return (
    <>
      <CartaoDoVersiculo />

      {nadaExiste ? (
        <EstadoVazio
          icone="eventos"
          titulo="Nenhum evento marcado"
          descricao={
            podeCriar
              ? 'Monte o próximo encontro: o Sábado padrão já vem com as etapas de sempre.'
              : 'Quando a organização publicar o próximo encontro, ele aparece aqui.'
          }
          acao={
            podeCriar
              ? {
                  titulo: 'Novo Sábado padrão',
                  icone: 'adicionar',
                  aoPressionar: () =>
                    router.push({ pathname: '/evento/novo', params: { modelo: 'sabado_padrao' } }),
                }
              : { titulo: 'Ver a agenda', aoPressionar: () => router.push('/agenda') }
          }
          acaoSecundaria={{
            titulo: 'Informar minha disponibilidade',
            aoPressionar: () => router.push('/escalas'),
          }}
        />
      ) : null}

      {proximo ? (
        <CartaoDoProximoEvento
          evento={proximo}
          comunidadeId={comunidadeId}
          fuso={fuso}
          minhasEtapas={minhasEtapas}
        />
      ) : null}

      {escala ? (
        <CartaoSuaEscala
          escala={escala}
          total={d.minhasEscalas.length}
          comunidadeId={comunidadeId}
          fuso={fuso}
        />
      ) : null}

      {d.substituicoesAbertas > 0 ? (
        <Aviso
          tipo="info"
          titulo="Alguém precisa de substituição"
          acao={{ titulo: 'Ver pedidos', aoPressionar: () => router.push('/escalas') }}
        >
          {d.substituicoesAbertas === 1
            ? 'Há 1 pedido de substituição que você pode assumir.'
            : `Há ${d.substituicoesAbertas} pedidos de substituição que você pode assumir.`}
        </Aviso>
      ) : null}

      {visiveis.map((c) => (
        <Fragment key={c.chave}>{c.no}</Fragment>
      ))}
    </>
  )
}

function TarefaDoInicio({
  tarefa,
  comunidadeId,
  fuso,
}: {
  tarefa: TarefaDoInicio
  comunidadeId: string
  fuso: string
}) {
  const concluir = useMudancaNoEvento(comunidadeId, tarefa.eventoId, (base, _v: void) =>
    api.patch(`${base}/tarefas/${tarefa.id}`, { concluida: true }),
  )
  const prazo = tarefa.prazo ? `até ${formatarDataLocal(dataDoInstante(tarefa.prazo, fuso))}` : null
  return (
    <>
      <CaixaDeMarcar
        rotulo={tarefa.titulo}
        descricao={[tarefa.eventoTitulo, prazo].filter(Boolean).join(' · ')}
        marcada={concluir.isSuccess}
        desabilitada={concluir.isPending || concluir.isSuccess}
        aoMudar={() => concluir.mutate()}
      />
      {concluir.error ? <AvisoDeFalha erro={concluir.error} /> : null}
    </>
  )
}
