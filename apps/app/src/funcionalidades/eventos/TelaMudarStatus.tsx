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
import { Tela } from '@/ui/Tela'
import { mostrarToast } from '@/ui/Toast'
import { instanteDeDataEHora, lerDataDigitada, lerHoraDigitada } from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { voltarOu } from '@/ui/navegacao'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useEvento, useInvalidarEventos } from './consultas'
import { acoesDeStatus } from './regras'

type Acao = 'cancelar' | 'adiar'

/** "3 pessoas escaladas e quem se inscreveu recebem o motivo." */
function consequencia(evento: DetalheDoEvento): string {
  const escalados = new Set(
    evento.atribuicoes.filter((a) => a.estado !== 'recusada').map((a) => a.vinculoId),
  ).size
  const quem =
    escalados === 0
      ? 'Quem se inscreveu recebe'
      : escalados === 1
        ? '1 pessoa escalada e quem se inscreveu recebem'
        : `${escalados} pessoas escaladas e quem se inscreveu recebem`
  return `${quem} o motivo.`
}

/**
 * Rota `/evento/[eventoId]/status?acao=cancelar|adiar` (3.4.6): o aviso com a
 * consequência, o motivo (obrigatório: ele vai para quem participa) e, no
 * adiamento, a nova data e hora pelos seletores. Na barra, o destrutivo
 * cheio "Cancelar evento" ou o primário "Adiar evento".
 */
export function TelaMudarStatus() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ eventoId: string; acao: string }>()
  const eventoId = parametro(params.eventoId)
  const acao: Acao = parametro(params.acao) === 'adiar' ? 'adiar' : 'cancelar'
  const evento = useEvento(comunidadeAtiva?.id ?? null, eventoId)
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeAtiva?.id ?? '')
  const [motivo, setMotivo] = useState('')
  const [data, setData] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [erros, setErros] = useState<{ motivo?: string; data?: string; hora?: string }>({})
  const titulo = acao === 'adiar' ? 'Adiar encontro' : 'Cancelar encontro'

  const enviar = useMutation({
    mutationFn: (corpo: object) =>
      api.post(`${naComunidade(comunidadeAtiva!.id)}/eventos/${eventoId}/status`, corpo),
    onSuccess: async () => {
      await invalidar(eventoId ?? undefined)
      mostrarToast({ texto: acao === 'adiar' ? 'Encontro adiado.' : 'Encontro cancelado.' })
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
  const permitido =
    pode('evento', 'cancelar_ou_adiar') &&
    (acao === 'adiar' ? acoesDeStatus(e.status).adiar : acoesDeStatus(e.status).cancelar)

  if (!permitido) {
    return (
      <Tela pilha modal titulo={titulo}>
        <Aviso tipo="info" titulo="Não dá para fazer isso agora">
          {pode('evento', 'cancelar_ou_adiar')
            ? 'A situação atual do encontro não permite esta mudança.'
            : 'Só a organização cancela ou adia eventos.'}
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
    enviar.mutate({
      status: acao === 'adiar' ? 'adiado' : 'cancelado',
      motivo: motivo.trim(),
      ...(novoInicio ? { novoInicio } : {}),
    })
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
            titulo={titulo}
            tamanho="grande"
            variante={acao === 'adiar' ? 'primario' : 'destrutivoCheio'}
            carregando={enviar.isPending}
            aoPressionar={confirmarEnvio}
          />
        </BarraDeAcao>
      }
    >
      <Aviso
        tipo="alerta"
        titulo={acao === 'adiar' ? 'Quem participa é avisado' : 'Isto não se desfaz'}
      >
        {acao === 'adiar'
          ? `O encontro fica como adiado até ser publicado de novo. ${consequencia(e)}`
          : `Um encontro cancelado não volta a ser publicado. ${consequencia(e)}`}
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
