import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CampoDeData, CampoDeHora } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { frasePraDesfazer, mostrarDesfazer, useSegundosDoDesfazer } from '@/ui/ToastComDesfazer'
import { instanteDeDataEHora, lerDataDigitada, lerHoraDigitada } from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { voltarOu } from '@/ui/navegacao'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useEvento, useInvalidarEventos } from './consultas'
import { pessoasDistintas, quantasPessoas } from './Convocacao'
import { acoesDeStatus } from './regras'

type Acao = 'cancelar' | 'adiar'

/** "Vai avisar 3 pessoas convocadas e quem se inscreveu": a consequência escrita, sem rodeio. */
function consequencia(evento: DetalheDoEvento): string {
  const convocados = pessoasDistintas(evento.atribuicoes)
  return convocados === 0
    ? 'Vai avisar quem se inscreveu.'
    : `Vai avisar ${quantasPessoas(convocados)} ${convocados === 1 ? 'convocada' : 'convocadas'} e quem se inscreveu.`
}

/**
 * Rota `/evento/[eventoId]/status?acao=cancelar|adiar` ("Cancelar ou adiar", D69, D74): a tela
 * abre SEM escolha feita (antes abria em "Adiar", e quem queria cancelar tocava no botão grande da
 * frente achando que tinha cancelado). "Adiar" e "Cancelar" aparecem lado a lado, cada um com o que
 * faz; só depois da escolha vêm o aviso com a consequência escrita ("Vai avisar 11 pessoas"), o motivo
 * (obrigatório: ele vai para quem participa) e, no adiamento, a nova data e hora. "Adiar o encontro"
 * avisa as pessoas só depois da contagem, com Desfazer. "Cancelar o encontro" diz "Isto não se desfaz".
 */
export function TelaMudarStatus() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ eventoId: string; acao: string }>()
  const eventoId = parametro(params.eventoId)
  // Sem escolha de partida: só vale o que um link pediu de propósito (`?acao=`).
  const [acaoPedida, setAcao] = useState<Acao | null>(() => {
    const pedida = parametro(params.acao)
    return pedida === 'adiar' || pedida === 'cancelar' ? pedida : null
  })
  const segundos = useSegundosDoDesfazer()
  const evento = useEvento(comunidadeAtiva?.id ?? null, eventoId)
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeAtiva?.id ?? '')
  const [motivo, setMotivo] = useState('')
  const [data, setData] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [erros, setErros] = useState<{ motivo?: string; data?: string; hora?: string }>({})
  const titulo = 'Cancelar ou adiar'

  const enviar = useMutation({
    mutationFn: (corpo: object) =>
      api.post(`${naComunidade(comunidadeAtiva!.id)}/eventos/${eventoId}/status`, corpo),
    onSuccess: async () => {
      await invalidar(eventoId ?? undefined)
      mostrarToast({ texto: 'Encontro cancelado.' })
      voltarOu(eventoId ? { pathname: '/evento/[eventoId]', params: { eventoId } } : '/agenda')
    },
  })

  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha modal>
        <SemComunidade oQue="o encontro" />
      </Tela>
    )
  }
  if (evento.isPending) {
    return (
      <Tela pilha modal titulo={titulo}>
        <Esqueleto rotulo="Carregando o encontro">
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (evento.error) {
    return (
      <Tela pilha modal titulo={titulo}>
        <ErroDaTela erro={evento.error} aoTentarDeNovo={() => void evento.refetch()} />
      </Tela>
    )
  }
  const e = evento.data
  const { adiar: podeAdiar, cancelar: podeCancelar } = acoesDeStatus(e.status)
  // Se a situação do encontro só permite uma das duas, não há o que escolher: a tela já abre nela.
  const acao: Acao | null =
    podeAdiar && !podeCancelar
      ? 'adiar'
      : podeCancelar && !podeAdiar
        ? 'cancelar'
        : acaoPedida === 'adiar' && podeAdiar
          ? 'adiar'
          : acaoPedida === 'cancelar' && podeCancelar
            ? 'cancelar'
            : null
  const permitido = pode('evento', 'cancelar_ou_adiar') && (podeAdiar || podeCancelar)

  if (!permitido) {
    return (
      <Tela pilha modal titulo={titulo}>
        <Aviso tipo="info" titulo="Não dá para fazer isso agora">
          {pode('evento', 'cancelar_ou_adiar')
            ? 'A situação atual do encontro não permite esta mudança.'
            : 'Só a organização cancela ou adia encontros.'}
        </Aviso>
      </Tela>
    )
  }

  function confirmarEnvio() {
    if (!acao) return
    const novos: typeof erros = {}
    if (motivo.trim().length < 3) novos.motivo = 'Explique o motivo: ele vai para quem participa.'
    let novoInicio: string | null = null
    if (acao === 'adiar' && (data || hora)) {
      const d = data ? lerDataDigitada(data) : null
      const h = hora ? lerHoraDigitada(hora) : null
      if (!d) novos.data = 'Escolha a nova data.'
      if (!h) novos.hora = 'Escolha a nova hora.'
      if (d && h) novoInicio = instanteDeDataEHora(d, h, e.fuso)
    }
    setErros(novos)
    if (Object.keys(novos).length) return
    const corpo = {
      status: acao === 'adiar' ? 'adiado' : 'cancelado',
      motivo: motivo.trim(),
      ...(novoInicio ? { novoInicio } : {}),
    }
    if (acao === 'cancelar') {
      enviar.mutate(corpo)
      return
    }
    // Adiar avisa gente: o app volta ao encontro e o aviso espera a contagem, com Desfazer. Sai também
    // se a pessoa sair da tela ou do app (D74) e repete se a rede falhar.
    const id = e.id
    const comunidadeId = comunidadeAtiva!.id
    const quantas = pessoasDistintas(e.atribuicoes)
    mostrarDesfazer({
      texto: quantas > 0 ? `Adiando e avisando ${quantasPessoas(quantas)}.` : 'Adiando o encontro.',
      textoDaFalha:
        'Não deu para adiar o encontro. Nada foi enviado nem ninguém foi avisado. Toque em Tentar de novo.',
      // A própria ação leva a pessoa de volta ao encontro: essa navegação não envia na hora.
      seguePeloCaminho: true,
      aoConfirmar: async () => {
        await api.post(`${naComunidade(comunidadeId)}/eventos/${id}/status`, corpo)
        await invalidar(id)
        mostrarToast({
          texto:
            quantas > 0
              ? `Encontro adiado. ${quantasPessoas(quantas)} ${quantas === 1 ? 'foi avisada' : 'foram avisadas'}.`
              : 'Encontro adiado.',
        })
      },
    })
    voltarOu({ pathname: '/evento/[eventoId]', params: { eventoId: id } })
  }

  const erroDaData = !!(erros.data || erros.hora)
  return (
    <Tela
      pilha
      modal
      titulo={titulo}
      descricao={e.titulo}
      barraDeAcao={
        <BarraDeAcao solta>
          <Botao
            titulo={
              acao === 'adiar'
                ? 'Adiar o encontro'
                : acao === 'cancelar'
                  ? 'Cancelar o encontro'
                  : 'Escolha adiar ou cancelar'
            }
            tamanho="grande"
            variante={acao === 'cancelar' ? 'destrutivoCheio' : 'primario'}
            carregando={enviar.isPending}
            desabilitado={acao === null}
            {...(acao === null ? { motivo: 'Escolha acima o que fazer com o encontro.' } : {})}
            aoPressionar={confirmarEnvio}
          />
        </BarraDeAcao>
      }
    >
      {podeAdiar && podeCancelar ? (
        <>
          <Segmentos
            rotulo="O que fazer com o encontro"
            valor={acao}
            aoMudar={setAcao}
            segmentos={[
              { valor: 'adiar', rotulo: 'Adiar' },
              { valor: 'cancelar', rotulo: 'Cancelar' },
            ]}
          />
          {acao === null ? (
            <View style={{ gap: ESPACO.e12 }}>
              <Texto variante="corpo">
                <Texto variante="corpo" peso="forte">
                  Adiar:{' '}
                </Texto>
                o encontro continua, em outra data. Quem participa é avisado.
              </Texto>
              <Texto variante="corpo">
                <Texto variante="corpo" peso="forte">
                  Cancelar:{' '}
                </Texto>
                o encontro termina e não volta. Quem participa é avisado. Isto não se desfaz.
              </Texto>
            </View>
          ) : null}
        </>
      ) : null}
      {acao === null ? null : (
        <Aviso
          tipo="alerta"
          titulo={acao === 'adiar' ? 'Quem participa é avisado' : 'Isto não se desfaz'}
        >
          {acao === 'adiar'
            ? `O encontro fica como adiado até ser publicado de novo. ${consequencia(e)} ${frasePraDesfazer(segundos)}`
            : `Vai cancelar ${e.titulo}. ${consequencia(e)} Um encontro cancelado não volta a ser publicado.`}
        </Aviso>
      )}
      {enviar.error ? (
        <AvisoDeFalha
          erro={enviar.error}
          titulo={acao === 'adiar' ? 'O encontro não foi adiado' : 'O encontro não foi cancelado'}
        />
      ) : null}
      {acao === null ? null : (
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          <Campo
            rotulo="Motivo"
            value={motivo}
            onChangeText={setMotivo}
            erro={erros.motivo ?? null}
            ajuda="Escreva como você diria para quem vinha."
            multiline
            maxLength={500}
          />
          {acao === 'adiar' ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
              <View style={{ flex: 1.4 }}>
                <CampoDeData
                  rotulo="Nova data"
                  opcional
                  valor={data}
                  aoMudar={setData}
                  erro={erros.data ?? null}
                  ajuda="Em branco, fica sem data nova por enquanto."
                  reservarApoio
                />
              </View>
              <View style={{ flex: 1 }}>
                <CampoDeHora
                  rotulo="Nova hora"
                  opcional
                  valor={hora}
                  aoMudar={setHora}
                  erro={erros.hora ?? null}
                  reservarApoio={erroDaData}
                />
              </View>
            </View>
          ) : null}
        </CartaoDeVidro>
      )}
    </Tela>
  )
}
