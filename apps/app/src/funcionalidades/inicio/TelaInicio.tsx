import { useQuery } from '@tanstack/react-query'
import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { Pressable, View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { RespostaDoInicio, TarefaDoInicio } from '@/servicos/contratoDosEventos'
import { formatarDataLocal, formatarQuando, dataDoInstante } from '@/utilidades/datas'
import { primeiroNome } from '@/utilidades/formatos'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Icone } from '@/ui/Icone'
import { Linha, Lista } from '@/ui/Linha'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { CartaoDaEscala } from '../escalas/CartaoDaEscala'
import { naComunidade } from '../eventos/consultas'
import { LinhaDoEvento } from '../eventos/LinhaDoEvento'
import { useMudancaNoEvento } from '../eventos/mutacoes'
import { EventosPreparados } from '../offline/EventosPreparados'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { CartaoDaMissao } from '../onboarding/CartaoDaMissao'
import { CartaoDoVersiculo } from '../versiculo/CartaoDoVersiculo'
import { useGruposDoMais } from '../navegacao/mais'
import { AvisosDoInicio } from './AvisosDoInicio'
import { CartaoDoProximoEvento } from './CartaoDoProximoEvento'
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
    <TelaDoApp titulo={nome ? `${saudacao()}, ${nome}` : saudacao()}>
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
  const online = useEstaOnline()
  const podeCriar = pode('evento', 'criar')

  // Sem conexão e sem nada carregado: o que está preparado neste aparelho abre na hora.
  if (inicio.isPending && inicio.fetchStatus === 'paused') {
    return (
      <>
        <Aviso tipo="alerta" titulo="Sem conexão">
          O Início aparece quando a internet voltar. Os eventos preparados abrem agora.
        </Aviso>
        <EventosPreparados />
      </>
    )
  }
  if (inicio.isPending) return <Carregando texto={`Carregando ${nomeDaComunidade}`} />
  if (inicio.error) {
    return (
      <>
        <AvisoDeErro erro={inicio.error} aoTentarDeNovo={() => void inicio.refetch()} />
        <EventosPreparados />
      </>
    )
  }
  const d = inicio.data
  const [proximo, ...outros] = d.proximosEventos
  const [escala, ...outrasEscalas] = d.minhasEscalas
  const comInscricao = d.proximosEventos.filter((e) => e.status === 'publicado')
  const minhasEtapas = proximo
    ? d.minhasEscalas
        .filter((e) => e.eventoId === proximo.id && e.etapaTitulo)
        .map((e) => e.etapaTitulo!)
    : []

  return (
    <>
      {online ? null : <EventosPreparados />}

      <CartaoDoVersiculo />

      {proximo ? (
        <CartaoDoProximoEvento
          evento={proximo}
          comunidadeId={comunidadeId}
          fuso={fuso}
          minhasEtapas={minhasEtapas}
        />
      ) : (
        <Cartao titulo="Próximo encontro">
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
                    variante: 'primario',
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
        </Cartao>
      )}

      <Cartao titulo="Sua escala">
        {escala ? (
          <>
            <CartaoDaEscala escala={escala} comunidadeId={comunidadeId} fuso={fuso} />
            {outrasEscalas.length ? (
              <Botao
                titulo={`Ver todas as escalas (${d.minhasEscalas.length})`}
                variante="terciario"
                larguraTotal={false}
                style={{ marginLeft: -ESPACO.x3 }}
                aoPressionar={() => router.push('/escalas')}
              />
            ) : null}
          </>
        ) : (
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
        )}
      </Cartao>

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

      <AvisosDoInicio avisos={d.avisos ?? []} podePublicar={pode('aviso', 'publicar')} />

      <AtalhosDosModulos />

      {outros.length ? (
        <Cartao
          titulo="Depois"
          acao={
            <Botao
              titulo="Agenda"
              variante="terciario"
              larguraTotal={false}
              rotuloAcessivel="Agenda: ver a agenda completa"
              aoPressionar={() => router.push('/agenda')}
            />
          }
        >
          <View style={{ gap: ESPACO.x2 }}>
            {outros.map((e) => (
              <LinhaDoEvento
                key={e.id}
                evento={e}
                fuso={fuso}
                aoPressionar={() =>
                  router.push({ pathname: '/evento/[eventoId]', params: { eventoId: e.id } })
                }
              />
            ))}
          </View>
        </Cartao>
      ) : null}

      <Cartao titulo="Minhas tarefas">
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

      <Cartao titulo="Inscrições abertas">
        {comInscricao.length === 0 ? (
          <EstadoVazio
            icone="inscricoes"
            titulo="Nenhuma inscrição aberta"
            descricao="Quando um evento abrir inscrições, ele aparece aqui."
            acao={{
              titulo: 'Ver a agenda',
              icone: 'agenda',
              aoPressionar: () => router.push('/agenda'),
            }}
          />
        ) : (
          <>
            <Texto variante="apoio" cor="textoSuave">
              {pode('inscricao', 'ler_lista')
                ? 'Acompanhe as inscrições e faça o check-in dos próximos eventos.'
                : 'Abra um evento para se inscrever e ver o seu código de entrada.'}
            </Texto>
            <Lista recuo={0}>
              {comInscricao.map((e) => (
                <Linha
                  key={e.id}
                  icone="inscricoes"
                  titulo={e.titulo}
                  descricao={formatarQuando(e.inicio, fuso)}
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
            </Lista>
          </>
        )}
      </Cartao>

      <CartaoDaMissao />
    </>
  )
}

/**
 * Atalhos dos módulos da comunidade (avisos, oração, sugestões, conteúdos e,
 * para a organização, relatórios): ladrilhos de vidro em duas colunas. Os
 * mesmos módulos estão no Perfil e, na web larga, na barra lateral.
 */
function AtalhosDosModulos() {
  const { cores } = useTema()
  const itens = useGruposDoMais().flatMap((g) => g.itens)
  return (
    <Cartao titulo="Na comunidade">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        {itens.map((i) => (
          <Pressable
            key={i.rotulo}
            accessibilityRole="button"
            accessibilityLabel={`${i.rotulo}. ${i.descricao}`}
            onPress={() => router.push(i.href)}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: '45%',
              minHeight: Math.max(ALVO, 56),
              flexDirection: 'row',
              alignItems: 'center',
              gap: ESPACO.x3,
              paddingHorizontal: ESPACO.x3,
              paddingVertical: ESPACO.x3,
              borderRadius: RAIO.medio,
              borderWidth: 1,
              borderColor: cores.cartaoVidroBorda,
              backgroundColor: pressed ? cores.superficieRealce : cores.cartaoVidro,
            })}
          >
            <Icone nome={i.icone} cor={cores.destaque} tamanho={20} />
            <Texto variante="corpoForte" style={{ flexShrink: 1, fontSize: 15 }}>
              {i.rotulo}
            </Texto>
          </Pressable>
        ))}
      </View>
    </Cartao>
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
