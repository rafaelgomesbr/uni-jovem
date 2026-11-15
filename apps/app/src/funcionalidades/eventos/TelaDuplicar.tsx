import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CampoDeData, CampoDeHora } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import {
  dataDoInstante,
  formatarHora,
  instanteDeDataEHora,
  lerDataDigitada,
  lerHoraDigitada,
  somarDias,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'

import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useEvento, useInvalidarEventos } from './consultas'

/** Rota `/evento/[eventoId]/duplicar`: copia etapas, checklist, tarefas e materiais para outra data. */
export function TelaDuplicar() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const evento = useEvento(comunidadeAtiva?.id ?? null, eventoId)
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha modal>
        <SemComunidade oQue="a programação" />
      </Tela>
    )
  }
  if (evento.isPending) {
    return (
      <Tela pilha modal titulo="Duplicar">
        <Esqueleto rotulo="Carregando a programação">
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (evento.error) {
    return (
      <Tela pilha modal titulo="Duplicar">
        <ErroDaTela erro={evento.error} aoTentarDeNovo={() => void evento.refetch()} />
      </Tela>
    )
  }
  const e = evento.data
  return (
    <Duplicar
      comunidadeId={comunidadeAtiva.id}
      eventoId={e.id}
      titulo={e.titulo}
      fuso={e.fuso}
      // Sugestão: uma semana depois, mesmo horário.
      dataSugerida={somarDias(dataDoInstante(e.inicio, e.fuso), 7)}
      horaSugerida={formatarHora(e.inicio, e.fuso)}
    />
  )
}

function Duplicar(p: {
  comunidadeId: string
  eventoId: string
  titulo: string
  fuso: string
  dataSugerida: string
  horaSugerida: string
}) {
  const invalidar = useInvalidarEventos(p.comunidadeId)
  const [data, setData] = useState<string | null>(p.dataSugerida)
  const [hora, setHora] = useState<string | null>(p.horaSugerida)
  const [erros, setErros] = useState<{ data?: string; hora?: string }>({})
  const duplicar = useMutation({
    mutationFn: (inicio: string) =>
      api.post<{ id: string }>(`${naComunidade(p.comunidadeId)}/eventos/${p.eventoId}/duplicar`, {
        inicio,
      }),
    onSuccess: async (r) => {
      await invalidar()
      mostrarToast({ texto: 'Cópia criada como rascunho.' })
      router.replace({ pathname: '/evento/[eventoId]', params: { eventoId: r.id } })
    },
  })

  function criar() {
    const d = data ? lerDataDigitada(data) : null
    const h = hora ? lerHoraDigitada(hora) : null
    setErros({
      ...(d ? {} : { data: 'Escolha a data da cópia.' }),
      ...(h ? {} : { hora: 'Escolha a hora.' }),
    })
    if (d && h) duplicar.mutate(instanteDeDataEHora(d, h, p.fuso))
  }

  const algumErro = !!(erros.data || erros.hora)
  return (
    <Tela
      pilha
      modal
      titulo="Duplicar"
      descricao={p.titulo}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Criar a cópia"
            tamanho="grande"
            carregando={duplicar.isPending}
            aoPressionar={criar}
          />
        </BarraDeAcao>
      }
    >
      {duplicar.error ? (
        <AvisoDeFalha erro={duplicar.error} titulo="A cópia não foi criada" />
      ) : null}
      <CartaoDeVidro sobrancelha="Nova data" opaco intervalo={ESPACO.e16}>
        <Texto variante="corpo" cor="textoSuave">
          A cópia nasce como rascunho, com as mesmas etapas, checklist, tarefas e materiais. Escalas
          e inscrições não são copiadas.
        </Texto>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
          <View style={{ flex: 1.4 }}>
            <CampoDeData
              rotulo="Data"
              valor={data}
              aoMudar={setData}
              erro={erros.data ?? null}
              reservarApoio={algumErro}
            />
          </View>
          <View style={{ flex: 1 }}>
            <CampoDeHora
              rotulo="Hora"
              valor={hora}
              aoMudar={setHora}
              erro={erros.hora ?? null}
              reservarApoio={algumErro}
            />
          </View>
        </View>
      </CartaoDeVidro>
    </Tela>
  )
}
