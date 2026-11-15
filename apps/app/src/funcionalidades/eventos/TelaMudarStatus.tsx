import { useMutation } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { instanteDeDataEHora, lerDataDigitada, lerHoraDigitada } from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Tela } from '@/ui/Tela'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useEvento, useInvalidarEventos } from './consultas'
import { acoesDeStatus } from './regras'

type Acao = 'cancelar' | 'adiar'

/**
 * Rota `/evento/[eventoId]/status?acao=cancelar|adiar`. O motivo é
 * obrigatório: ele vai para quem está escalado e inscrito.
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
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [erros, setErros] = useState<{ motivo?: string; data?: string; hora?: string }>({})

  const enviar = useMutation({
    mutationFn: (corpo: object) =>
      api.post(`${naComunidade(comunidadeAtiva!.id)}/eventos/${eventoId}/status`, corpo),
    onSuccess: async () => {
      await invalidar(eventoId ?? undefined)
      router.back()
    },
  })

  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela cabecalhoNativo>
        <SemComunidade oQue="a programação" />
      </Tela>
    )
  }
  if (evento.isPending) {
    return (
      <Tela cabecalhoNativo>
        <Carregando />
      </Tela>
    )
  }
  if (evento.error) {
    return (
      <Tela cabecalhoNativo>
        <AvisoDeErro erro={evento.error} aoTentarDeNovo={() => void evento.refetch()} />
      </Tela>
    )
  }
  const e = evento.data
  const permitido =
    pode('evento', 'cancelar_ou_adiar') &&
    (acao === 'adiar' ? acoesDeStatus(e.status).adiar : acoesDeStatus(e.status).cancelar)
  const titulo = acao === 'adiar' ? 'Adiar evento' : 'Cancelar evento'

  if (!permitido) {
    return (
      <Tela cabecalhoNativo titulo={titulo}>
        <Aviso tipo="info" titulo="Não dá para fazer isso agora">
          {pode('evento', 'cancelar_ou_adiar')
            ? 'A situação atual do evento não permite esta mudança.'
            : 'Só a organização cancela ou adia eventos.'}
        </Aviso>
        <Botao titulo="Voltar" variante="secundario" aoPressionar={() => router.back()} />
      </Tela>
    )
  }

  function confirmarEnvio() {
    const novos: typeof erros = {}
    if (motivo.trim().length < 3) novos.motivo = 'Explique o motivo: ele vai para quem participa.'
    let novoInicio: string | null = null
    if (acao === 'adiar' && (data.trim() || hora.trim())) {
      const d = lerDataDigitada(data)
      const h = lerHoraDigitada(hora)
      if (!d) novos.data = 'Use uma data real, no formato DD/MM/AAAA.'
      if (!h) novos.hora = 'Use a hora no formato HH:MM.'
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

  return (
    <Tela cabecalhoNativo titulo={titulo} descricao={e.titulo}>
      <Cartao>
        <Aviso
          tipo="alerta"
          titulo={acao === 'adiar' ? 'Quem participa é avisado' : 'Isto não se desfaz'}
        >
          {acao === 'adiar'
            ? 'O evento fica como adiado até ser publicado de novo. Quem está escalado e inscrito recebe o motivo.'
            : 'Um evento cancelado não volta a ser publicado. Quem está escalado e inscrito recebe o motivo.'}
        </Aviso>
        <Campo
          rotulo="Motivo"
          value={motivo}
          onChangeText={setMotivo}
          erro={erros.motivo ?? null}
          ajuda="Obrigatório. Escreva como você diria para quem vinha."
          multiline
          maxLength={500}
        />
        {acao === 'adiar' ? (
          <>
            <Campo
              rotulo="Nova data (opcional)"
              value={data}
              onChangeText={setData}
              erro={erros.data ?? null}
              ajuda="Em branco, fica sem data nova por enquanto."
              exemplo="22/11/2026"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <Campo
              rotulo="Nova hora (opcional)"
              value={hora}
              onChangeText={setHora}
              erro={erros.hora ?? null}
              exemplo="16:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </>
        ) : null}
        {enviar.error ? <AvisoDeErro erro={enviar.error} /> : null}
        <Botao
          titulo={acao === 'adiar' ? 'Adiar e avisar' : 'Cancelar e avisar'}
          variante={acao === 'adiar' ? 'primario' : 'perigo'}
          carregando={enviar.isPending}
          aoPressionar={confirmarEnvio}
        />
        <Botao titulo="Voltar sem mudar" variante="discreto" aoPressionar={() => router.back()} />
      </Cartao>
    </Tela>
  )
}
