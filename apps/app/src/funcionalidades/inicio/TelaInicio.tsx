import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { RespostaDoInicio } from '@/servicos/contratoDosEventos'
import { AvisoDeFalha } from '@/ui/Falha'
import { primeiroNome } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { naComunidade } from '../eventos/consultas'
import { ComecePorAqui } from '../entrada/ComecePorAqui'
import { PrimeirosPassosDoCriador } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { usePermissaoDoSistema } from '../notificacoes/permissao'
import { EventosPreparados } from '../offline/EventosPreparados'
import { CartaoDaMissao, useMissaoPendente } from '../onboarding/CartaoDaMissao'
import { AvisoDosTermos } from '../privacidade/AvisoDosTermos'
import { CartaoDoVersiculo } from '../versiculo/CartaoDoVersiculo'
import { AvisosDoInicio } from './AvisosDoInicio'
import { CartaoDoProximoEvento } from './CartaoDoProximoEvento'
import { CartaoSuaEscala } from './CartaoSuaEscala'
import { MinhaVisaoGeral } from './MinhaVisaoGeral'
import { MinhasInscricoes, useMinhasInscricoes } from './MinhasInscricoes'

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
 * Início (seção 3.2), nas três variações: com dados (fiel ao mockup), sem
 * comunidade para o Criador e sem comunidade para a conta ("Comece por aqui",
 * ADR 0007). Com várias comunidades, a sessão já abre na última usada (D57).
 * A saudação é o título, sem "!".
 */
export function TelaInicio() {
  const { conta, comunidadeAtiva, comunidades } = useSessao()
  const nome = primeiroNome(conta?.nome)
  // Conta sem comunidade (ADR 0007): "Comece por aqui", com os três caminhos.
  if (!comunidadeAtiva && comunidades.length === 0 && !conta?.criador) {
    return (
      <TelaDoApp
        titulo="Comece por aqui"
        descricao={`${nome ? `${saudacao()}, ${nome}. ` : ''}Para usar o app, entre numa comunidade ou crie a sua.`}
      >
        <AvisoDosTermos />
        <ComecePorAqui />
      </TelaDoApp>
    )
  }
  return (
    <TelaDoApp titulo={nome ? `${saudacao()}, ${nome}` : saudacao()}>
      <AvisoDosTermos />
      {comunidadeAtiva ? (
        <Inicio comunidadeId={comunidadeAtiva.id} nomeDaComunidade={comunidadeAtiva.nome} />
      ) : conta?.criador ? (
        <>
          <PrimeirosPassosDoCriador />
          <CartaoDoVersiculo />
        </>
      ) : null}
    </TelaDoApp>
  )
}

/**
 * O Início da comunidade (D62): o mesmo para o membro e para quem organiza,
 * sem seletor. Ordem fixa: saudação (o título da tela), versículo em uma linha
 * de 44 pt, o próximo encontro, a convocação pendente de outro encontro (só se
 * houver), "Seu resumo" (acordeão fechado), o aviso e o resto.
 */
function Inicio({
  comunidadeId,
  nomeDaComunidade,
}: {
  comunidadeId: string
  nomeDaComunidade: string
}) {
  return (
    <>
      <CartaoDoVersiculo />
      <MinhaVisao comunidadeId={comunidadeId} nomeDaComunidade={nomeDaComunidade} />
    </>
  )
}

function MinhaVisao({
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
  const notificacoes = usePermissaoDoSistema()

  // Sem conexão e sem nada carregado: o que está preparado neste aparelho abre na hora.
  if (inicio.isPending && inicio.fetchStatus === 'paused') {
    return (
      <>
        <Aviso tipo="alerta" titulo="Sem conexão: o Início volta quando a internet voltar">
          O que foi baixado neste aparelho continua aqui.
        </Aviso>
        <EventosPreparados />
      </>
    )
  }
  if (inicio.isPending) {
    return (
      <Esqueleto rotulo={`Carregando ${nomeDaComunidade}`}>
        <CartaoDeEsqueleto titulo />
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (inicio.error) {
    // O versículo não depende da rede: continua; o erro fica no lugar do destaque.
    return (
      <>
        <AvisoDeFalha erro={inicio.error} aoTentarDeNovo={() => void inicio.refetch()} />
        <EventosPreparados />
      </>
    )
  }

  const d = inicio.data
  const [proximo] = d.proximosEventos
  const minhasInscricoes = inscricoes.data ?? []
  // A convocação pendente do mesmo encontro mora dentro do cartão dele; a de outro encontro
  // ganha o cartão próprio. A aceita não vira cartão: vira a linha "Você:" do encontro.
  const pendentes = d.minhasEscalas.filter((e) => e.estado === 'pendente')
  const pendenteDeOutroEncontro = pendentes.find((e) => !proximo || e.eventoId !== proximo.id)
  const doProximo = proximo ? d.minhasEscalas.filter((e) => e.eventoId === proximo.id) : []
  // Enquanto as inscrições carregam, vale "já inscrita": o botão "Inscrever-me" não pisca.
  const inscritaNoProximo =
    !!proximo &&
    (inscricoes.isPending ||
      minhasInscricoes.some((i) => i.evento.id === proximo.id && i.estado !== 'espera'))
  const outrasInscricoes = minhasInscricoes.filter((i) => !proximo || i.evento.id !== proximo.id)
  // "Primeiros passos" é do líder e só depois do primeiro encontro criado (D62).
  const mostraMissao = missaoPendente && podeCriar && d.proximosEventos.length > 0

  return (
    <>
      {proximo ? (
        <CartaoDoProximoEvento
          evento={proximo}
          comunidadeId={comunidadeId}
          fuso={fuso}
          minhasConvocacoes={doProximo}
          inscrita={inscritaNoProximo}
        />
      ) : (
        <EstadoVazio
          icone="eventos"
          titulo="Nenhum encontro marcado"
          descricao={
            podeCriar
              ? 'Monte o próximo: o Sábado padrão já vem com o roteiro de sempre.'
              : 'Ainda não há encontro marcado. Quando a liderança marcar o próximo, ele aparece aqui e você recebe um aviso.'
          }
          {...(podeCriar
            ? {
                acao: {
                  titulo: 'Criar o encontro do sábado',
                  icone: 'adicionar' as const,
                  aoPressionar: () =>
                    router.push({ pathname: '/evento/novo', params: { modelo: 'sabado_padrao' } }),
                },
              }
            : notificacoes === 'negada' || notificacoes === 'nao_perguntada'
              ? {
                  acao: {
                    titulo: 'Ligar os avisos',
                    aoPressionar: () => router.push('/notificacoes'),
                  },
                }
              : {})}
        />
      )}

      {pendenteDeOutroEncontro ? (
        <CartaoSuaEscala
          escala={pendenteDeOutroEncontro}
          total={pendentes.length}
          comunidadeId={comunidadeId}
          fuso={fuso}
        />
      ) : null}

      <MinhaVisaoGeral
        comunidadeId={comunidadeId}
        substituicoesAbertas={d.substituicoesAbertas}
        eventoDaTarefa={d.minhasTarefas[0]?.eventoId ?? null}
      />

      {(d.avisos ?? []).length ? <AvisosDoInicio avisos={d.avisos ?? []} /> : null}
      {outrasInscricoes.length ? <MinhasInscricoes inscricoes={outrasInscricoes} /> : null}
      {mostraMissao ? <CartaoDaMissao /> : null}
    </>
  )
}
