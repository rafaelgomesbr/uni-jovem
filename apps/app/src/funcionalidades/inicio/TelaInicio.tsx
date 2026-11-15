import { useQuery } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { RespostaDoInicio, TarefaDoInicio } from '@/servicos/contratoDosEventos'
import { formatarDataLocal, dataDoInstante } from '@/utilidades/datas'
import { primeiroNome } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Texto } from '@/ui/Texto'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { CartaoDaEscala } from '../escalas/CartaoDaEscala'
import { naComunidade } from '../eventos/consultas'
import { LinhaDoEvento } from '../eventos/LinhaDoEvento'
import { useMudancaNoEvento } from '../eventos/mutacoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'

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

export function TelaInicio() {
  const { conta, comunidadeAtiva } = useSessao()
  const nome = primeiroNome(conta?.nome)
  return (
    <TelaDoApp titulo={nome ? `${saudacao()}, ${nome}!` : `${saudacao()}!`}>
      {comunidadeAtiva ? (
        <Inicio comunidadeId={comunidadeAtiva.id} nomeDaComunidade={comunidadeAtiva.nome} />
      ) : (
        <SemComunidade oQue="o que está acontecendo" />
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
  const podeCriar = pode('evento', 'criar')

  if (inicio.isPending) return <Carregando texto={`Carregando ${nomeDaComunidade}`} />
  if (inicio.error) {
    return <AvisoDeErro erro={inicio.error} aoTentarDeNovo={() => void inicio.refetch()} />
  }
  const d = inicio.data

  return (
    <>
      <Texto cor="textoSuave">Isto é o que está acontecendo em {nomeDaComunidade}.</Texto>

      {d.substituicoesAbertas > 0 ? (
        <Aviso tipo="info" titulo="Alguém precisa de substituição">
          <View style={{ gap: ESPACO.x2 }}>
            <Texto variante="apoio">
              {d.substituicoesAbertas === 1
                ? 'Há 1 pedido de substituição que você pode assumir.'
                : `Há ${d.substituicoesAbertas} pedidos de substituição que você pode assumir.`}
            </Texto>
            <Botao
              titulo="Ver os pedidos"
              variante="secundario"
              larguraTotal={false}
              aoPressionar={() => router.push('/escalas')}
            />
          </View>
        </Aviso>
      ) : null}

      <Cartao titulo="Próximos eventos" icone="eventos">
        {d.proximosEventos.length === 0 ? (
          <EstadoVazio
            icone="eventos"
            titulo="Nenhum evento marcado"
            descricao={
              podeCriar
                ? 'Monte o próximo encontro; o Sábado padrão já vem com as etapas de sempre.'
                : 'Quando a organização publicar o próximo encontro, ele aparece aqui.'
            }
            acao={
              podeCriar
                ? {
                    titulo: 'Novo Sábado padrão',
                    icone: 'adicionar',
                    aoPressionar: () =>
                      router.push({
                        pathname: '/evento/novo',
                        params: { modelo: 'sabado_padrao' },
                      }),
                  }
                : {
                    titulo: 'Ver a agenda',
                    icone: 'agenda',
                    aoPressionar: () => router.push('/agenda'),
                  }
            }
          />
        ) : (
          <View style={{ gap: ESPACO.x2 }}>
            {d.proximosEventos.map((e) => (
              <LinhaDoEvento
                key={e.id}
                evento={e}
                fuso={fuso}
                aoPressionar={() =>
                  router.push({ pathname: '/evento/[eventoId]', params: { eventoId: e.id } })
                }
              />
            ))}
            <Botao
              titulo="Ver a agenda completa"
              variante="discreto"
              larguraTotal={false}
              aoPressionar={() => router.push('/agenda')}
            />
          </View>
        )}
      </Cartao>

      <Cartao titulo="Minhas escalas" icone="escalas">
        {d.minhasEscalas.length === 0 ? (
          <EstadoVazio
            icone="escalas"
            titulo="Nenhuma escala para você"
            descricao="Conte à organização em quais dias você pode ajudar; quando escalarem você, a escala aparece aqui para confirmar."
            acao={{
              titulo: 'Informar minha disponibilidade',
              icone: 'agenda',
              aoPressionar: () => router.push('/escalas'),
            }}
          />
        ) : (
          <View style={{ gap: ESPACO.x2 }}>
            {d.minhasEscalas.map((e) => (
              <CartaoDaEscala key={e.id} escala={e} comunidadeId={comunidadeId} fuso={fuso} />
            ))}
            <Botao
              titulo="Ver todas as escalas"
              variante="discreto"
              larguraTotal={false}
              aoPressionar={() => router.push('/escalas')}
            />
          </View>
        )}
      </Cartao>

      <Cartao titulo="Minhas tarefas" icone="tarefas">
        {d.minhasTarefas.length === 0 ? (
          <EstadoVazio
            icone="tarefas"
            titulo="Nenhuma tarefa pendente"
            descricao="As tarefas dos eventos que forem suas aparecem aqui."
            acao={{
              titulo: 'Ver as programações',
              icone: 'programacoes',
              aoPressionar: () => router.push('/programacoes'),
            }}
          />
        ) : (
          <View style={{ gap: ESPACO.x2 }}>
            {d.minhasTarefas.map((t) => (
              <TarefaDoInicio key={t.id} tarefa={t} comunidadeId={comunidadeId} fuso={fuso} />
            ))}
          </View>
        )}
      </Cartao>

      <Cartao titulo="Inscrições" icone="inscricoes">
        {d.proximosEventos.filter((e) => e.status === 'publicado').length === 0 ? (
          <Texto variante="apoio" cor="textoSuave">
            Nenhum evento com inscrição aberta agora.
          </Texto>
        ) : (
          <View style={{ gap: ESPACO.x2 }}>
            <Texto variante="apoio" cor="textoSuave">
              {pode('inscricao', 'ler_lista')
                ? 'Acompanhe as inscrições e faça o check-in dos próximos eventos.'
                : 'Abra um evento para se inscrever e ver o seu código de entrada.'}
            </Texto>
            {d.proximosEventos
              .filter((e) => e.status === 'publicado')
              .map((e) => (
                <Botao
                  key={e.id}
                  titulo={e.titulo}
                  icone="inscricoes"
                  variante="secundario"
                  rotuloAcessivel={
                    pode('inscricao', 'ler_lista')
                      ? `Inscrições de ${e.titulo}`
                      : `Ver ${e.titulo} e me inscrever`
                  }
                  aoPressionar={() =>
                    pode('inscricao', 'ler_lista')
                      ? router.push({
                          pathname: '/evento/[eventoId]/inscricoes',
                          params: { eventoId: e.id },
                        })
                      : router.push({ pathname: '/evento/[eventoId]', params: { eventoId: e.id } })
                  }
                />
              ))}
          </View>
        )}
      </Cartao>

      {/* Espaço reservado: avisos (F15) e versículo do dia (F14) chegam nas próximas fases. */}
      <Cartao titulo="Avisos" icone="info">
        <EstadoVazio
          icone="info"
          titulo="Nenhum aviso por enquanto"
          descricao="Os avisos da organização e o versículo do dia vão aparecer aqui."
          acao={{
            titulo: 'Ver a comunidade',
            icone: 'comunidade',
            aoPressionar: () => router.push('/comunidade'),
          }}
        />
      </Cartao>
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
  const prazo = tarefa.prazo
    ? `prazo ${formatarDataLocal(dataDoInstante(tarefa.prazo, fuso))}`
    : null
  return (
    <View style={{ gap: ESPACO.x1 }}>
      <CaixaDeMarcar
        rotulo={tarefa.titulo}
        descricao={[tarefa.eventoTitulo, prazo].filter(Boolean).join(' · ')}
        marcada={concluir.isSuccess}
        desabilitada={concluir.isPending || concluir.isSuccess}
        aoMudar={() => concluir.mutate()}
      />
      {concluir.error ? <AvisoDeErro erro={concluir.error} /> : null}
    </View>
  )
}
