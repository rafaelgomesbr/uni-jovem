import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useCallback, useEffect } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { EscalaDoInicio } from '@/servicos/contratoDosEventos'
import type { MomentoDoInicio, ParteDoMomento } from '@/servicos/contratoV3'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Esqueleto, EsqueletoDoMomento, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { Aviso } from '@/ui/Aviso'
import { useSemConexao } from '@/ui/IndicadorDeConexao'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { ALVO } from '@/ui/medidas'
import { Sol } from '@/ui/Sol'
import { Texto } from '@/ui/Texto'
import { primeiroNome } from '@/utilidades/formatos'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { ComecePorAqui } from '../entrada/ComecePorAqui'
import { estadoEfetivo, useRespostasOtimistas } from '../escalas/respostasOtimistas'
import { useResponderComDesfazer } from '../escalas/consultas'
import { PrimeirosPassosDoCriador } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { usePermissaoDoSistema } from '../notificacoes/permissao'
import { EventosPreparados } from '../offline/EventosPreparados'
import { CartaoDaMissao, useMissaoPendente } from '../onboarding/CartaoDaMissao'
import { AvisoDosTermos } from '../privacidade/AvisoDosTermos'
import { CartaoDoVersiculo } from '../versiculo/CartaoDoVersiculo'
import { AvisosDoInicio } from './AvisosDoInicio'
import { useBandaCompleta } from './banda'
import { CartaoDoLider } from './CartaoDoLider'
import { CartaoDoMembro } from './CartaoDoMembro'
import { useAndamentoDoCartao, useInicio, type RespostaDoInicioComMomento } from './consultas'
import { FaixaDoEncanto, HaloDoEncanto, useEncantoDoInicio } from './EncantoDoSol'
import { EncontrosDoDia } from './EncontrosDoDia'
import { MinhaVisaoGeral } from './MinhaVisaoGeral'
import {
  emOnde,
  momentoDoDia,
  quandoFoiSalva,
  textoDaDespedida,
  textoDoObrigado,
  tituloDoBlocoDoDia,
} from './momento'
import { ParaResponder } from './ParaResponder'
import { AvisoDeEspera } from './PecasDoCartao'

export { useInicio } from './consultas'

function saudacao(agora = new Date()): string {
  const hora = agora.getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Início (seções 3.1 e 3.2 do UX, D68), nas três variações: com dados (o cartão do momento, do
 * membro ou do líder), sem comunidade para o Criador e sem comunidade para a conta ("Comece por
 * aqui", ADR 0007). A saudação é o título, sem "!". A Aurora acompanha o relógio do encontro:
 * o `momento` da `Tela` e a pose do sol no cartão falam juntos.
 */
export function TelaInicio() {
  const { conta, comunidadeAtiva, comunidades } = useSessao()
  const inicio = useInicio(comunidadeAtiva?.id ?? null)
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
  const momento = inicio.data?.momento
  return (
    <TelaDoApp
      titulo={nome ? `${saudacao()}, ${nome}` : saudacao()}
      momento={momento ? momentoDoDia(momento) : 'longe'}
    >
      <AvisoDosTermos />
      {comunidadeAtiva ? (
        <Inicio
          comunidadeId={comunidadeAtiva.id}
          nomeDaComunidade={comunidadeAtiva.nome}
          inicio={inicio}
        />
      ) : conta?.criador ? (
        <>
          <PrimeirosPassosDoCriador />
          <CartaoDoVersiculo />
        </>
      ) : null}
    </TelaDoApp>
  )
}

type ConsultaDoInicio = ReturnType<typeof useInicio>

/**
 * O Início da comunidade (D62, D68). Ordem fixa, nunca muda de lugar, só o conteúdo: saudação (o
 * título da tela), versículo em uma linha, cartão do momento, "Para responder", "Seu resumo"
 * (acordeão fechado) e o aviso em uma linha. Cada estado assíncrono tem a sua tela: esqueleto
 * com a forma final, erro com saída no lugar do cartão e o que o aparelho já guardou.
 */
function Inicio({
  comunidadeId,
  nomeDaComunidade,
  inicio,
}: {
  comunidadeId: string
  nomeDaComunidade: string
  inicio: ConsultaDoInicio
}) {
  const pode = usePode()
  const organiza = pode('evento', 'publicar')
  const semConexao = useSemConexao()
  const semInternet = semConexao || inicio.fetchStatus === 'paused'

  // Sem conexão e sem nada carregado: o que está preparado neste aparelho abre na hora.
  if (inicio.isPending && inicio.fetchStatus === 'paused') {
    return (
      <>
        <CartaoDoVersiculo />
        <Aviso tipo="alerta" titulo="Sem internet: o Início volta quando a internet voltar">
          O que foi baixado neste aparelho continua aqui.
        </Aviso>
        <EventosPreparados />
      </>
    )
  }
  if (inicio.isPending || (inicio.data && !inicio.data.momento)) {
    return (
      <>
        <CartaoDoVersiculo />
        <Esqueleto rotulo={`Carregando ${nomeDaComunidade}`}>
          <View style={{ gap: ESPACO.e16 }}>
            <EsqueletoDoMomento />
            <LinhaDeEsqueleto altura={72} />
            <LinhaDeEsqueleto altura={64} />
          </View>
        </Esqueleto>
      </>
    )
  }
  if (!inicio.data) {
    // O versículo, o resumo e o aviso não dependem do cartão: seguem, e o erro fica no lugar dele.
    return (
      <>
        <CartaoDoVersiculo />
        <AvisoDeFalha
          erro={inicio.error}
          titulo={
            organiza
              ? 'Não deu para carregar o encontro.'
              : 'Não deu para carregar o próximo encontro.'
          }
          mensagem="Confira a internet e tente de novo."
          aoTentarDeNovo={() => void inicio.refetch()}
        />
        <MinhaVisaoGeral
          comunidadeId={comunidadeId}
          substituicoesAbertas={0}
          eventoDaTarefa={null}
        />
        <EventosPreparados />
      </>
    )
  }
  return (
    <ConteudoDoInicio
      comunidadeId={comunidadeId}
      dados={inicio.data}
      salvaEm={inicio.dataUpdatedAt}
      semInternet={semInternet}
      organiza={organiza}
    />
  )
}

function ConteudoDoInicio({
  comunidadeId,
  dados,
  salvaEm,
  semInternet,
  organiza,
}: {
  comunidadeId: string
  dados: RespostaDoInicioComMomento
  salvaEm: number
  semInternet: boolean
  organiza: boolean
}) {
  const momento = dados.momento as MomentoDoInicio
  const evento = momento.evento
  const fusoDaComunidade = useFusoDaComunidade()
  const fuso = evento?.fuso ?? fusoDaComunidade
  const dia = momentoDoDia(momento)
  const notificacoes = usePermissaoDoSistema()
  const missaoPendente = useMissaoPendente()
  const otimistas = useRespostasOtimistas()
  const responder = useResponderComDesfazer(comunidadeId)
  const { emCena, animando, mostrar, encerrar } = useEncantoDoInicio()
  const andamento = useAndamentoDoCartao(
    comunidadeId,
    evento?.id ?? null,
    organiza && dia === 'agora',
  )
  const banda = useBandaCompleta(
    comunidadeId,
    evento?.id ?? null,
    organiza && (momento.lider?.convocados ?? 0) > 0,
  )

  const versaoSalva = semInternet ? quandoFoiSalva(salvaEm) : null

  // As partes da pessoa neste encontro, com a resposta em espera (Desfazer) já aplicada.
  const partes: ParteDoMomento[] = momento.suaParte.map((p) => ({
    ...p,
    estado: estadoEfetivo(p.atribuicaoId, p.estado, otimistas),
  }))
  const emEspera = new Set(
    partes.filter((p) => otimistas.has(p.atribuicaoId)).map((p) => p.atribuicaoId),
  )

  const aoTudoEmDia = useCallback(() => mostrar('tudoEmDia', 'Tudo em dia.'), [mostrar])
  const aoEncanto = useCallback(
    (tipo: Parameters<typeof mostrar>[0], texto: string) => void mostrar(tipo, texto),
    [mostrar],
  )

  // O encanto da banda completa: a primeira vez que o líder vê as funções todas confirmadas.
  useEffect(() => {
    if (banda !== null) void mostrar('banda', `Banda completa: ${banda} de ${banda}.`)
  }, [banda, mostrar])

  function aceitar(parte: ParteDoMomento) {
    if (!evento) return
    responder.aceitar({
      atribuicaoId: parte.atribuicaoId,
      eventoInicio: evento.inicio,
      fuso: evento.fuso,
      funcao: parte.funcao,
      etapaTitulo: parte.etapaTitulo,
    })
    void mostrar('aceitar', `Que bom ter você ${emOnde(parte)}.`)
  }
  function recusar(parte: ParteDoMomento) {
    if (!evento) return
    responder.recusar({
      atribuicaoId: parte.atribuicaoId,
      eventoInicio: evento.inicio,
      fuso: evento.fuso,
      funcao: parte.funcao,
      etapaTitulo: parte.etapaTitulo,
    })
  }
  function aceitarDeOutro(item: EscalaDoInicio) {
    responder.aceitar(parteParaResponder(item, fuso))
    void mostrar('aceitar', `Que bom ter você ${emOnde(item)}.`)
  }
  function recusarDeOutro(item: EscalaDoInicio) {
    responder.recusar(parteParaResponder(item, fuso))
  }

  // "Para responder": o que espera a pessoa em OUTROS encontros (o do cartão responde dentro dele;
  // quem organiza responde aqui também, porque o cartão dela é o da liderança).
  const paraResponder = dados.minhasEscalas.filter(
    (e) => e.estado === 'pendente' && (organiza || !evento || e.eventoId !== evento.id),
  )

  const faixaAoLado =
    emCena && emCena.tipo !== 'tudoEmDia' && emCena.tipo !== 'presenca' ? (
      <FaixaDoEncanto key={emCena.texto} texto={emCena.texto} aoTerminar={encerrar} />
    ) : null
  const faixaDoResumo =
    emCena?.tipo === 'tudoEmDia' ? (
      <FaixaDoEncanto key={emCena.texto} texto={emCena.texto} aoTerminar={encerrar} />
    ) : null
  const encantoDoCartao = emCena?.tipo === 'aceitar' || emCena?.tipo === 'publicou'
  const poseDoEncanto = animando && emCena?.tipo === 'aceitar' ? ('pleno' as const) : undefined

  // Só com o cartão já no encontro seguinte: aí a faixa diz de qual encontro fala (o que acabou).
  const despedida =
    momento.recemTerminado && evento && organiza
      ? textoDaDespedida(momento.recemTerminado, new Date(momento.agora))
      : momento.recemTerminado?.euServi && !organiza
        ? textoDoObrigado(momento.recemTerminado, new Date(momento.agora))
        : null

  const cartao = organiza ? (
    <CartaoDoLider
      comunidadeId={comunidadeId}
      momento={momento}
      partes={partes}
      semInternet={semInternet}
      versaoSalva={versaoSalva}
      andamento={andamento.data}
      {...(poseDoEncanto ? { poseDoEncanto } : {})}
      aoEncanto={aoEncanto}
      rodape={faixaAoLado}
    />
  ) : evento ? (
    <CartaoDoMembro
      momento={momento}
      evento={evento}
      partes={partes}
      emEspera={emEspera}
      semInternet={semInternet}
      versaoSalva={versaoSalva}
      {...(poseDoEncanto ? { poseDoEncanto } : {})}
      aoAceitar={aceitar}
      aoRecusar={recusar}
      rodape={faixaAoLado}
    />
  ) : (
    <VazioDoMembro
      comLigarOsAvisos={notificacoes === 'negada' || notificacoes === 'nao_perguntada'}
    />
  )

  // Dois ou mais encontros no mesmo dia: o cartão é o próximo e o bloco lista todos (D79).
  const tituloDoBloco = tituloDoBlocoDoDia(momento)

  // "Primeiros passos" é do líder e só depois do primeiro encontro criado (D62).
  const mostraMissao =
    missaoPendente && organiza && (dados.proximosEventos.length > 0 || !!momento.recemTerminado)

  return (
    <>
      <EntradaEmCascata ordem={1}>
        <CartaoDoVersiculo />
      </EntradaEmCascata>

      <EntradaEmCascata ordem={2}>
        <View style={{ gap: ESPACO.e12 }}>
          {semInternet ? (
            <AvisoDeEspera
              icone="semConexao"
              texto={`Sem internet. Você vê a última versão, salva ${
                versaoSalva?.startsWith('hoje') ? 'às' : 'em'
              } ${versaoSalva?.replace('hoje, ', '') ?? ''}.`}
            />
          ) : null}
          {despedida ? <LinhaDeDespedida texto={despedida} /> : null}
          <View>
            <HaloDoEncanto ativo={animando && encantoDoCartao} />
            {cartao}
          </View>
        </View>
      </EntradaEmCascata>

      {tituloDoBloco && evento ? (
        <EntradaEmCascata ordem={3}>
          <EncontrosDoDia
            titulo={tituloDoBloco}
            encontros={momento.doDia ?? []}
            idDoCartao={evento.id}
          />
        </EntradaEmCascata>
      ) : null}

      {paraResponder.length > 0 ? (
        <EntradaEmCascata ordem={3}>
          <ParaResponder
            itens={paraResponder}
            fuso={fuso}
            semInternet={semInternet}
            aoAceitar={aceitarDeOutro}
            aoRecusar={recusarDeOutro}
          />
        </EntradaEmCascata>
      ) : null}

      <EntradaEmCascata ordem={4}>
        <View style={{ gap: ESPACO.e4 }}>
          <MinhaVisaoGeral
            comunidadeId={comunidadeId}
            substituicoesAbertas={dados.substituicoesAbertas}
            eventoDaTarefa={dados.minhasTarefas[0]?.eventoId ?? null}
            aoTudoEmDia={aoTudoEmDia}
          />
          {faixaDoResumo}
        </View>
      </EntradaEmCascata>

      {(dados.avisos ?? []).length ? (
        <EntradaEmCascata ordem={5}>
          <AvisosDoInicio avisos={dados.avisos ?? []} />
        </EntradaEmCascata>
      ) : null}
      {mostraMissao ? <CartaoDaMissao /> : null}
    </>
  )
}

function parteParaResponder(item: EscalaDoInicio, fuso: string) {
  return {
    atribuicaoId: item.id,
    eventoInicio: item.eventoInicio,
    fuso,
    funcao: item.funcao,
    etapaTitulo: item.etapaTitulo,
  }
}

/** "Obrigado por servir ontem." (ou "O encontro de ontem terminou. 12 presentes."), com o sol no poente. */
function LinhaDeDespedida({ texto }: { texto: string }) {
  return (
    <View
      testID="linha-de-despedida"
      style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8, minHeight: ALVO }}
    >
      <Sol pose="poente" lado={32} halo={false} />
      <Texto variante="corpo" peso="medio" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  )
}

/**
 * Sem encontro marcado, para o membro (3.1 do UX): o sol atrás do horizonte, o que aconteceu e o
 * que vai acontecer. Se os avisos do aparelho estão desligados, o botão "Ligar os avisos".
 */
function VazioDoMembro({ comLigarOsAvisos }: { comLigarOsAvisos: boolean }) {
  return (
    <Cartao>
      <View style={{ alignItems: 'center', gap: ESPACO.e12 }}>
        <Sol pose="escondido" lado={104} />
        <Texto variante="tituloItem" style={{ textAlign: 'center' }}>
          Ainda não há encontro marcado.
        </Texto>
        <Texto variante="corpo" cor="textoSuave" style={{ textAlign: 'center' }}>
          Quando a liderança marcar o próximo, ele aparece aqui e você recebe um aviso.
        </Texto>
        {comLigarOsAvisos ? (
          <Botao titulo="Ligar os avisos" aoPressionar={() => router.push('/notificacoes')} />
        ) : null}
      </View>
    </Cartao>
  )
}
