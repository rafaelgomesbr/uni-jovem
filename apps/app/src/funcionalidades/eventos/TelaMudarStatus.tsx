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
import { mostrarToast } from '@/ui/Toast'
import { mostrarDesfazer } from '@/ui/ToastComDesfazer'
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
 * Rota `/evento/[eventoId]/status?acao=cancelar|adiar` ("Cancelar ou adiar", D69): a escolha entre
 * adiar e cancelar, o aviso com a consequência escrita ("Vai avisar 11 pessoas"), o motivo
 * (obrigatório: ele vai para quem participa) e, no adiamento, a nova data e hora. "Adiar o
 * encontro" avisa as pessoas só depois de 10 s, com Desfazer. "Cancelar o encontro" é um dos
 * poucos diálogos de verdade: desfaz o que outras pessoas já organizaram e não volta atrás.
 */
export function TelaMudarStatus() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ eventoId: string; acao: string }>()
  const eventoId = parametro(params.eventoId)
  const [acaoPedida, setAcao] = useState<Acao>(
    parametro(params.acao) === 'adiar' ? 'adiar' : 'cancelar',
  )
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
  // Se a situação do encontro só permite uma das duas, a tela já abre nela.
  const acao: Acao =
    acaoPedida === 'adiar'
      ? podeAdiar
        ? 'adiar'
        : 'cancelar'
      : podeCancelar
        ? 'cancelar'
        : 'adiar'
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
    // Adiar avisa gente: o app volta ao encontro e o aviso espera 10 s, com Desfazer.
    const id = e.id
    const comunidadeId = comunidadeAtiva!.id
    const quantas = pessoasDistintas(e.atribuicoes)
    mostrarDesfazer({
      texto: quantas > 0 ? `Adiando e avisando ${quantasPessoas(quantas)}.` : 'Adiando o encontro.',
      aoConfirmar: () => {
        api
          .post(`${naComunidade(comunidadeId)}/eventos/${id}/status`, corpo)
          .then(async () => {
            await invalidar(id)
            mostrarToast({ texto: 'Encontro adiado.' })
          })
          .catch(() =>
            mostrarToast({ texto: 'Não deu para adiar o encontro. Tente de novo.', tipo: 'erro' }),
          )
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
        <BarraDeAcao>
          <Botao
            titulo={acao === 'adiar' ? 'Adiar o encontro' : 'Cancelar o encontro'}
            tamanho="grande"
            variante={acao === 'adiar' ? 'primario' : 'destrutivoCheio'}
            carregando={enviar.isPending}
            aoPressionar={confirmarEnvio}
          />
        </BarraDeAcao>
      }
    >
      {podeAdiar && podeCancelar ? (
        <Segmentos
          rotulo="O que fazer com o encontro"
          valor={acao}
          aoMudar={setAcao}
          segmentos={[
            { valor: 'adiar', rotulo: 'Adiar' },
            { valor: 'cancelar', rotulo: 'Cancelar' },
          ]}
        />
      ) : null}
      <Aviso
        tipo="alerta"
        titulo={acao === 'adiar' ? 'Quem participa é avisado' : 'Isto não se desfaz'}
      >
        {acao === 'adiar'
          ? `O encontro fica como adiado até ser publicado de novo. ${consequencia(e)} Dá para desfazer por 10 segundos.`
          : `Vai cancelar ${e.titulo}. ${consequencia(e)} Um encontro cancelado não volta a ser publicado.`}
      </Aviso>
      {enviar.error ? (
        <AvisoDeFalha
          erro={enviar.error}
          titulo={acao === 'adiar' ? 'O encontro não foi adiado' : 'O encontro não foi cancelado'}
        />
      ) : null}
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
    </Tela>
  )
}
