import { useMutation } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import {
  dataDoInstante,
  formatarDataLocal,
  formatarHora,
  instanteDeDataEHora,
  lerDataDigitada,
  lerHoraDigitada,
  somarDias,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useEvento, useInvalidarEventos } from './consultas'

/** Rota `/evento/[eventoId]/duplicar`: copia etapas, checklist, tarefas e materiais para outra data. */
export function TelaDuplicar() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const evento = useEvento(comunidadeAtiva?.id ?? null, eventoId)
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha>
        <SemComunidade oQue="a programação" />
      </Tela>
    )
  }
  if (evento.isPending) {
    return (
      <Tela pilha>
        <Carregando />
      </Tela>
    )
  }
  if (evento.error) {
    return (
      <Tela pilha>
        <AvisoDeErro erro={evento.error} aoTentarDeNovo={() => void evento.refetch()} />
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
      dataSugerida={formatarDataLocal(somarDias(dataDoInstante(e.inicio, e.fuso), 7))}
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
  const [data, setData] = useState(p.dataSugerida)
  const [hora, setHora] = useState(p.horaSugerida)
  const [erros, setErros] = useState<{ data?: string; hora?: string }>({})
  const duplicar = useMutation({
    mutationFn: (inicio: string) =>
      api.post<{ id: string }>(`${naComunidade(p.comunidadeId)}/eventos/${p.eventoId}/duplicar`, {
        inicio,
      }),
    onSuccess: async (r) => {
      await invalidar()
      router.replace({ pathname: '/evento/[eventoId]', params: { eventoId: r.id } })
    },
  })

  return (
    <Tela pilha titulo="Duplicar" descricao={p.titulo}>
      <Cartao>
        <Texto variante="legenda" cor="textoSuave">
          A cópia nasce como rascunho, com as mesmas etapas, checklist, tarefas e materiais. Escalas
          e inscrições não são copiadas.
        </Texto>
        <Campo
          rotulo="Data da cópia"
          value={data}
          onChangeText={setData}
          erro={erros.data ?? null}
          ajuda="Formato DD/MM/AAAA."
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Campo
          rotulo="Hora de início"
          value={hora}
          onChangeText={setHora}
          erro={erros.hora ?? null}
          ajuda="Formato HH:MM."
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        {duplicar.error ? <AvisoDeErro erro={duplicar.error} /> : null}
        <Botao
          titulo="Criar a cópia"
          icone="duplicar"
          carregando={duplicar.isPending}
          aoPressionar={() => {
            const d = lerDataDigitada(data)
            const h = lerHoraDigitada(hora)
            const novos = {
              ...(d ? {} : { data: 'Use uma data real, no formato DD/MM/AAAA.' }),
              ...(h ? {} : { hora: 'Use a hora no formato HH:MM.' }),
            }
            setErros(novos)
            if (d && h) duplicar.mutate(instanteDeDataEHora(d, h, p.fuso))
          }}
        />
      </Cartao>
    </Tela>
  )
}
