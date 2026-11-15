import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Substituicao } from '@/servicos/contratoDosEventos'
import { confirmar } from '@/utilidades/confirmar'
import {
  dataDoInstante,
  diaDaSemana,
  formatarDataPorExtenso,
  formatarQuando,
  hojeNoFuso,
  instanteDeDataEHora,
  lerDataDigitada,
  somarDias,
  type DataLocal,
} from '@/utilidades/datas'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { useFusoDaComunidade, useMeuVinculo } from '../comunidade/consultas'
import { naComunidade, useEventosNoPeriodo } from '../eventos/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { CartaoDaEscala } from './CartaoDaEscala'
import {
  useDisponibilidade,
  useInvalidarEscalas,
  useMinhasEscalas,
  useSubstituicoes,
} from './consultas'

/** Rota `/escalas`: minhas escalas, substituições abertas e disponibilidade por data. */
export function TelaEscalas() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <Tela pilha>
        <SemComunidade oQue="as suas escalas" />
      </Tela>
    )
  }
  const id = comunidadeAtiva.id
  return (
    <Tela pilha titulo="Escalas" descricao={`Em ${comunidadeAtiva.nome}`}>
      <MinhasEscalas comunidadeId={id} />
      <SubstituicoesAbertas comunidadeId={id} />
      <MinhaDisponibilidade comunidadeId={id} />
    </Tela>
  )
}

function MinhasEscalas({ comunidadeId }: { comunidadeId: string }) {
  const fuso = useFusoDaComunidade()
  const escalas = useMinhasEscalas(comunidadeId)
  return (
    <Cartao titulo="Minhas escalas" icone="escalas">
      {escalas.isPending ? (
        <Carregando texto="Carregando as suas escalas" />
      ) : escalas.error ? (
        <AvisoDeErro erro={escalas.error} aoTentarDeNovo={() => void escalas.refetch()} />
      ) : escalas.data.length === 0 ? (
        <EstadoVazio
          icone="escalas"
          titulo="Nenhuma escala para você"
          descricao="Quando a organização escalar você numa etapa, ela aparece aqui para confirmar. Informe abaixo os dias em que pode ajudar."
          acao={{
            titulo: 'Ver a agenda',
            icone: 'agenda',
            aoPressionar: () => router.push('/agenda'),
          }}
        />
      ) : (
        <View style={{ gap: ESPACO.e8 }}>
          {escalas.data.map((e) => (
            <CartaoDaEscala key={e.id} escala={e} comunidadeId={comunidadeId} fuso={fuso} />
          ))}
        </View>
      )}
    </Cartao>
  )
}

function SubstituicoesAbertas({ comunidadeId }: { comunidadeId: string }) {
  const fuso = useFusoDaComunidade()
  const lista = useSubstituicoes(comunidadeId)
  const invalidar = useInvalidarEscalas(comunidadeId)
  const assumir = useMutation({
    mutationFn: (id: string) =>
      api.post(`${naComunidade(comunidadeId)}/substituicoes/${id}/assumir`),
    onSuccess: invalidar,
  })
  const cancelar = useMutation({
    mutationFn: (id: string) =>
      api.post(`${naComunidade(comunidadeId)}/substituicoes/${id}/cancelar`),
    onSuccess: invalidar,
  })

  async function pedirParaAssumir(s: Substituicao) {
    const ok = await confirmar({
      titulo: 'Assumir esta escala?',
      mensagem: `Você fica no lugar de ${s.pedidaPor} em ${s.evento.titulo}${s.etapa ? `, ${s.etapa}` : ''}.`,
      confirmar: 'Assumir',
    })
    if (ok) assumir.mutate(s.id)
  }

  const visiveis = lista.data?.filter((s) => s.possoAssumir || s.minha) ?? []

  return (
    <Cartao titulo="Pedidos de substituição" icone="trocar">
      {lista.isPending ? (
        <Carregando texto="Carregando os pedidos" />
      ) : lista.error ? (
        <AvisoDeErro erro={lista.error} aoTentarDeNovo={() => void lista.refetch()} />
      ) : visiveis.length === 0 ? (
        <Texto variante="legenda" cor="textoSuave">
          Nenhum pedido aberto para você agora.
        </Texto>
      ) : (
        <View style={{ gap: ESPACO.e12 }}>
          {(assumir.error ?? cancelar.error) ? (
            <AvisoDeErro erro={assumir.error ?? cancelar.error} />
          ) : null}
          {visiveis.map((s) => (
            <View key={s.id} style={{ gap: ESPACO.e4 }}>
              <Texto variante="tituloItem">
                {s.evento.titulo}
                {s.etapa ? ` · ${s.etapa}` : ''}
              </Texto>
              <Texto variante="legenda" cor="textoSuave">
                {[
                  s.minha ? 'Seu pedido' : `Pedido por ${s.pedidaPor}`,
                  s.funcao,
                  formatarQuando(s.evento.inicio, fuso),
                  s.dirigida
                    ? s.minha
                      ? 'para uma pessoa'
                      : 'pedido direto para você'
                    : 'aberto à equipe',
                ].join(' · ')}
              </Texto>
              {s.motivo ? <Texto variante="corpo">Motivo: {s.motivo}</Texto> : null}
              {s.possoAssumir ? (
                <Botao
                  titulo="Assumir"
                  icone="confirmado"
                  larguraTotal={false}
                  rotuloAcessivel={`Assumir a escala de ${s.pedidaPor} em ${s.evento.titulo}`}
                  carregando={assumir.isPending && assumir.variables === s.id}
                  aoPressionar={() => void pedirParaAssumir(s)}
                />
              ) : (
                <Botao
                  titulo="Cancelar meu pedido"
                  variante="secundario"
                  larguraTotal={false}
                  carregando={cancelar.isPending && cancelar.variables === s.id}
                  aoPressionar={() => cancelar.mutate(s.id)}
                />
              )}
            </View>
          ))}
        </View>
      )}
    </Cartao>
  )
}

const SEMANAS_DE_DISPONIBILIDADE = 8

/** Datas para informar: os dias com evento nas próximas semanas, ou os próximos sábados. */
export function datasParaDisponibilidade(
  hoje: DataLocal,
  diasComEvento: readonly DataLocal[],
  extras: readonly DataLocal[],
): DataLocal[] {
  const base = diasComEvento.length
    ? diasComEvento
    : Array.from({ length: 6 }, (_, i) =>
        somarDias(hoje, ((6 - diaDaSemana(hoje) + 7) % 7) + i * 7),
      )
  return [...new Set([...base, ...extras])].filter((d) => d >= hoje).sort()
}

function MinhaDisponibilidade({ comunidadeId }: { comunidadeId: string }) {
  const fuso = useFusoDaComunidade()
  const eu = useMeuVinculo()
  const invalidar = useInvalidarEscalas(comunidadeId)
  const hoje = hojeNoFuso(fuso)
  const ate = somarDias(hoje, SEMANAS_DE_DISPONIBILIDADE * 7)
  const [extras, setExtras] = useState<DataLocal[]>([])
  const [outra, setOutra] = useState('')
  const [erroDaData, setErroDaData] = useState<string | null>(null)
  const eventos = useEventosNoPeriodo(
    comunidadeId,
    instanteDeDataEHora(hoje, '00:00', fuso),
    instanteDeDataEHora(ate, '00:00', fuso),
  )
  const ultimaExtra = extras.reduce((m, d) => (d > m ? d : m), ate)
  const disponibilidade = useDisponibilidade(comunidadeId, hoje, ultimaExtra)
  const informar = useMutation({
    mutationFn: ({ data, disponivel }: { data: DataLocal; disponivel: boolean }) =>
      api.put(`${naComunidade(comunidadeId)}/disponibilidade/${data}`, { disponivel }),
    onSuccess: () => disponibilidade.refetch().then(invalidar),
  })

  const diasComEvento = [
    ...new Set(
      (eventos.data ?? [])
        .filter((e) => e.status === 'publicado' || e.status === 'rascunho')
        .map((e) => dataDoInstante(e.inicio, e.fuso)),
    ),
  ]
  const datas = datasParaDisponibilidade(hoje, diasComEvento, extras)
  const minhas = new Map(
    (disponibilidade.data ?? [])
      .filter((d) => eu === null || d.vinculo_id === eu)
      .map((d) => [d.data, d.disponivel]),
  )

  return (
    <Cartao titulo="Minha disponibilidade" icone="agenda">
      <Texto variante="legenda" cor="textoSuave">
        Diga em quais dias você pode ajudar. A organização vê isso ao montar as escalas.
      </Texto>
      {eventos.isPending || disponibilidade.isPending ? (
        <Carregando texto="Carregando as datas" />
      ) : disponibilidade.error ? (
        <AvisoDeErro
          erro={disponibilidade.error}
          aoTentarDeNovo={() => void disponibilidade.refetch()}
        />
      ) : (
        <View style={{ gap: ESPACO.e12 }}>
          {informar.error ? <AvisoDeErro erro={informar.error} /> : null}
          {datas.map((data) => {
            const valor = minhas.get(data)
            return (
              <View key={data} style={{ gap: ESPACO.e4 }}>
                <Texto variante="tituloItem">{formatarDataPorExtenso(data)}</Texto>
                <Segmentos
                  rotulo={`Disponibilidade em ${formatarDataPorExtenso(data)}`}
                  valor={valor === undefined ? null : valor ? 'sim' : 'nao'}
                  aoMudar={(v) => informar.mutate({ data, disponivel: v === 'sim' })}
                  segmentos={[
                    { valor: 'sim', rotulo: 'Posso ajudar' },
                    { valor: 'nao', rotulo: 'Não posso' },
                  ]}
                />
                {valor === undefined ? (
                  <Texto variante="legenda" cor="textoSuave">
                    Ainda não informado.
                  </Texto>
                ) : null}
              </View>
            )
          })}
        </View>
      )}
      <Campo
        rotulo="Outra data"
        value={outra}
        onChangeText={setOutra}
        erro={erroDaData}
        ajuda="Formato DD/MM/AAAA. A data entra na lista acima."
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Botao
        titulo="Incluir data"
        variante="secundario"
        icone="adicionar"
        aoPressionar={() => {
          const d = lerDataDigitada(outra)
          if (!d || d < hoje) {
            setErroDaData('Use uma data a partir de hoje, no formato DD/MM/AAAA.')
            return
          }
          setErroDaData(null)
          setExtras((x) => [...x, d])
          setOutra('')
        }}
      />
    </Cartao>
  )
}
