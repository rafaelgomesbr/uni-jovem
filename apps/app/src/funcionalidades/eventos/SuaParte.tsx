import { useMutation } from '@tanstack/react-query'
import { ehConvocacaoDeLouvor } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import type { Atribuicao, DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { AvisoDeFalha } from '@/ui/Falha'
import { Texto } from '@/ui/Texto'

import { nomeDaParte } from '../agenda/semanas'
import { useMeuVinculo } from '../comunidade/consultas'
import {
  useInvalidarEscalas,
  useMinhasEscalas,
  useResponderComDesfazer,
} from '../escalas/consultas'
import { estadoEfetivo, useRespostasOtimistas } from '../escalas/respostasOtimistas'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { naComunidade } from './consultas'

/**
 * "Sua parte" (D69, seção 3.4): a primeira coisa depois do título, para quem foi convocado.
 * Pendente: "Aceitar" e "Não posso ir" aqui mesmo, sem diálogo (Desfazer de 10 s). Aceita:
 * "Louvor · Vocal" com o chip "Confirmado", "Abrir o repertório" para quem toca e "Preciso de
 * alguém no meu lugar" (só depois de aceitar). Sem internet, os botões ficam desabilitados com o
 * motivo escrito. Nada aparece para quem não tem parte neste encontro.
 */
export function SuaParte({
  evento,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  const eu = useMeuVinculo()
  const minhas = evento.atribuicoes.filter((a) => a.vinculoId === eu)
  if (minhas.length === 0) return null
  return (
    <View style={{ gap: ESPACO.e12 }}>
      {minhas.map((a) => (
        <CartaoDaParte key={a.id} evento={evento} comunidadeId={comunidadeId} atribuicao={a} />
      ))}
    </View>
  )
}

function CartaoDaParte({
  evento,
  comunidadeId,
  atribuicao,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
  atribuicao: Atribuicao
}) {
  const online = useEstaOnline()
  const otimistas = useRespostasOtimistas()
  const { aceitar, recusar } = useResponderComDesfazer(comunidadeId)
  const invalidar = useInvalidarEscalas(comunidadeId)
  const escalas = useMinhasEscalas(comunidadeId)
  const estado = estadoEfetivo(atribuicao.id, atribuicao.estado, otimistas)
  const etapa = evento.etapas.find((e) => e.id === atribuicao.etapaId) ?? null
  const nome = nomeDaParte({ funcao: atribuicao.funcao, etapaTitulo: etapa?.titulo ?? null })
  const pedidoAberto = escalas.data?.find((e) => e.id === atribuicao.id)?.substituicaoAberta ?? null
  const toca = ehConvocacaoDeLouvor({
    funcao: atribuicao.funcao,
    etapaTitulo: etapa?.titulo ?? null,
  })
  const cancelarPedido = useMutation({
    mutationFn: (id: string) =>
      api.post(`${naComunidade(comunidadeId)}/substituicoes/${id}/cancelar`),
    onSuccess: invalidar,
  })
  const parte = {
    atribuicaoId: atribuicao.id,
    eventoInicio: evento.inicio,
    fuso: evento.fuso,
    funcao: atribuicao.funcao,
    etapaTitulo: etapa?.titulo ?? null,
  }
  // Em rascunho a convocação ainda não saiu: não há o que responder.
  const respondivel = evento.status === 'publicado'
  const motivoSemInternet = online ? undefined : 'Precisa de internet para responder.'

  const chip =
    estado === 'pendente' ? (
      <Chip situacao="aguardando" texto="Aguardando sua resposta" />
    ) : estado === 'confirmada' ? (
      <Chip situacao="aceitou" />
    ) : estado === 'recusada' ? (
      <Chip situacao="naoPode" />
    ) : (
      <Chip texto="Pediu troca" tom="info" icone="trocar" />
    )

  const acoes =
    estado === 'pendente' && respondivel ? (
      <ParDeBotoes>
        <Botao
          titulo="Não posso ir"
          variante="secundario"
          desabilitado={!online}
          {...(motivoSemInternet ? { motivo: motivoSemInternet } : {})}
          rotuloAcessivel={`Não posso ir: ${nome}`}
          aoPressionar={() => recusar(parte)}
        />
        <Botao
          titulo="Aceitar"
          desabilitado={!online}
          rotuloAcessivel={`Aceitar: ${nome}`}
          aoPressionar={() => aceitar(parte)}
        />
      </ParDeBotoes>
    ) : estado === 'confirmada' ? (
      <View style={{ gap: ESPACO.e8, alignItems: 'flex-start' }}>
        {toca ? (
          <Botao
            titulo="Abrir o repertório"
            icone="musica"
            variante="secundario"
            aoPressionar={() => router.push('/meu-repertorio')}
          />
        ) : null}
        <Botao
          titulo="Preciso de alguém no meu lugar"
          variante="terciario"
          alinhado
          aoPressionar={() =>
            router.push({
              pathname: '/escalas/substituicao/[atribuicaoId]',
              params: { atribuicaoId: atribuicao.id },
            })
          }
        />
      </View>
    ) : estado === 'substituicao_pedida' && pedidoAberto ? (
      <Botao
        titulo="Cancelar o pedido"
        variante="secundario"
        carregando={cancelarPedido.isPending}
        aoPressionar={() => cancelarPedido.mutate(pedidoAberto)}
      />
    ) : estado === 'recusada' ? (
      <Botao
        titulo="Mudei de ideia: aceitar"
        variante="terciario"
        alinhado
        desabilitado={!online}
        {...(motivoSemInternet ? { motivo: motivoSemInternet } : {})}
        aoPressionar={() => aceitar(parte)}
      />
    ) : null

  return (
    <CartaoDeVidro
      sobrancelha="Sua parte"
      extra={chip}
      comecaComTitulo
      {...(acoes ? { acoes } : {})}
    >
      <Texto variante="tituloItem">{nome}</Texto>
      {estado === 'pendente' && !respondivel ? (
        <Texto variante="meta" cor="textoSuave">
          Você poderá responder quando o encontro for publicado.
        </Texto>
      ) : null}
      {estado === 'recusada' ? (
        <Texto variante="meta" cor="textoSuave">
          Você avisou que não pode. A liderança será avisada.
        </Texto>
      ) : null}
      {estado === 'substituicao_pedida' ? (
        <Texto variante="meta" cor="textoSuave">
          Você pediu alguém no seu lugar. Você continua na sua parte até alguém assumir.
        </Texto>
      ) : null}
      {cancelarPedido.error ? <AvisoDeFalha erro={cancelarPedido.error} /> : null}
    </CartaoDeVidro>
  )
}
