import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { DetalheDaSerie } from '@/servicos/contratoDosEventos'
import { ehErroDaApi } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import {
  dataDoInstante,
  formatarDataLocal,
  formatarQuando,
  hojeNoFuso,
  lerDataDigitada,
  lerHoraDigitada,
  type DataLocal,
} from '@/utilidades/datas'
import { CampoDeData } from '@/ui/CampoDeMomento'
import { mostrarToast } from '@/ui/Toast'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Expansivel } from '@/ui/Expansivel'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useInvalidarEventos, useSerie } from './consultas'
import { EditorDeRegra } from './EditorDeRegra'
import { rascunhoDaRegra, regraDoRascunho, type RascunhoDaRegra } from './formulario'
import { LinhaDoEvento } from './LinhaDoEvento'
import { descreverRegra } from './nomes'

/** Rota `/serie/[serieId]`: a regra, as próximas datas, mudar dia ou horário e encerrar. */
export function TelaSerie() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const serieId = parametro(useLocalSearchParams<{ serieId: string }>().serieId)
  const serie = useSerie(comunidadeAtiva?.id ?? null, serieId, pode('evento', 'editar'))

  if (!comunidadeAtiva || !serieId) {
    return (
      <Tela pilha>
        <SemComunidade oQue="a série" />
      </Tela>
    )
  }
  if (!pode('evento', 'editar')) {
    return (
      <Tela pilha titulo="Série">
        <Aviso tipo="info" titulo="Só a organização gerencia séries">
          Cada data da série aparece na agenda como um evento.
        </Aviso>
      </Tela>
    )
  }
  if (serie.isPending) {
    return (
      <Tela pilha>
        <Carregando texto="Carregando a série" />
      </Tela>
    )
  }
  if (serie.error) {
    return (
      <Tela pilha>
        <AvisoDeErro erro={serie.error} aoTentarDeNovo={() => void serie.refetch()} />
      </Tela>
    )
  }
  return <Serie serie={serie.data} comunidadeId={comunidadeAtiva.id} />
}

function Serie({ serie, comunidadeId }: { serie: DetalheDaSerie; comunidadeId: string }) {
  const pode = usePode()
  const hora = serie.hora_local.slice(0, 5)
  return (
    <Tela pilha titulo={serie.titulo} descricao="Série de encontros">
      <Cartao titulo="Como repete" icone="repetir">
        <Texto variante="tituloItem">{descreverRegra(serie.regra, hora)}</Texto>
        <Texto variante="legenda" cor="textoSuave">
          Desde {formatarDataLocal(serie.inicio_em)}
          {serie.fim_em ? ` até ${formatarDataLocal(serie.fim_em)}` : ', sem data para acabar'}. As
          datas são criadas com 6 meses de antecedência.
        </Texto>
      </Cartao>
      <Cartao titulo="Próximas datas" icone="agenda">
        {serie.ocorrencias.length === 0 ? (
          <Texto variante="legenda" cor="textoSuave">
            Nenhuma data futura nesta série.
          </Texto>
        ) : (
          <View style={{ gap: ESPACO.e8 }}>
            {serie.ocorrencias.slice(0, 12).map((o) => (
              <View key={o.id} style={{ gap: ESPACO.e4 }}>
                <LinhaDoEvento
                  evento={{
                    id: o.id,
                    titulo: serie.titulo,
                    inicio: o.inicio,
                    duracaoMin: serie.duracao_min,
                    status: o.status,
                  }}
                  fuso={serie.fuso}
                  aoPressionar={() =>
                    router.push({ pathname: '/evento/[eventoId]', params: { eventoId: o.id } })
                  }
                />
                {o.editadoIndividualmente ? (
                  <Texto variante="legenda" cor="textoSuave">
                    Editada à parte: mudanças na série toda não alteram esta data.
                  </Texto>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Cartao>
      {serie.estado === 'encerrada' ? (
        <Aviso tipo="info" titulo="Série encerrada">
          {serie.encerrada_em
            ? `Encerrada em ${formatarDataLocal(dataDoInstante(serie.encerrada_em, serie.fuso))}. Ela não recebe mais alterações; para continuar os encontros, crie uma série nova.`
            : 'Ela não recebe mais alterações; para continuar os encontros, crie uma série nova.'}
        </Aviso>
      ) : (
        <>
          <MudarRegra serie={serie} comunidadeId={comunidadeId} />
          {pode('evento', 'cancelar_ou_adiar') ? (
            <EncerrarSerie serie={serie} comunidadeId={comunidadeId} />
          ) : null}
          {pode('evento', 'excluir') && soRascunhos(serie) ? (
            <ExcluirSerie serie={serie} comunidadeId={comunidadeId} />
          ) : null}
        </>
      )}
    </Tela>
  )
}

function MudarRegra({ serie, comunidadeId }: { serie: DetalheDaSerie; comunidadeId: string }) {
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const [regra, setRegra] = useState<RascunhoDaRegra>(() =>
    rascunhoDaRegra(serie.regra, serie.fim_em),
  )
  const [hora, setHora] = useState(serie.hora_local.slice(0, 5))
  const futuras = serie.ocorrencias.filter(
    (o) => o.status === 'rascunho' || o.status === 'publicado',
  )
  const [aPartirDe, setAPartirDe] = useState<string>('agora')
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState<string | null>(null)
  const primeira = (
    serie.ocorrencias[0] ? dataDoInstante(serie.ocorrencias[0].inicio, serie.fuso) : serie.inicio_em
  ) as DataLocal

  const salvar = useMutation({
    mutationFn: (confirmarRecriacao: boolean) => {
      const { regra: nova } = regraDoRascunho(regra, primeira)
      const h = lerHoraDigitada(hora)
      return api.patch<{ afetadas: number; recriadas: number }>(
        `${naComunidade(comunidadeId)}/series/${serie.id}`,
        {
          versao: serie.versao,
          escopo: aPartirDe === 'agora' ? 'serie' : 'a_partir_de',
          ...(aPartirDe === 'agora' ? {} : { aPartirDoEvento: aPartirDe }),
          confirmarRecriacao,
          mudancas: {
            ...(nova ? { regra: nova } : {}),
            ...(h ? { horaLocal: h } : {}),
            fimEm: regra.fim.trim() ? lerDataDigitada(regra.fim) : null,
          },
        },
      )
    },
    onSuccess: async (r) => {
      setPronto(`Série atualizada: ${r.recriadas} data(s) recriada(s).`)
      await invalidar()
      await consultas.invalidateQueries({ queryKey: CHAVES.serie(comunidadeId, serie.id) })
    },
    onError: async (e) => {
      if (!ehErroDaApi(e, 'confirmar_recriacao')) return
      const ok = await confirmar({
        titulo: 'Recriar as próximas datas?',
        mensagem: e.mensagem,
        confirmar: 'Recriar e perder as escalas',
        destrutivo: true,
      })
      if (ok) salvar.mutate(true)
    },
  })

  return (
    <Cartao titulo="Mudar dia ou horário" icone="editar">
      <Texto variante="legenda" cor="textoSuave">
        As próximas datas que não foram editadas à parte são recriadas com a regra nova.
      </Texto>
      <Expansivel titulo="Mudar a regra" icone="editar">
        {() => (
          <>
            <EditorDeRegra
              regra={regra}
              aoMudar={setRegra}
              primeira={primeira}
              hora={lerHoraDigitada(hora)}
              semNaoRepete
            />
            <Campo
              rotulo="Hora de início"
              value={hora}
              onChangeText={setHora}
              erro={erro}
              ajuda="Formato HH:MM, no horário da comunidade."
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <GrupoDeOpcoes
              rotulo="A partir de quando"
              valor={aPartirDe}
              aoMudar={setAPartirDe}
              opcoes={[
                {
                  valor: 'agora',
                  rotulo: 'Toda a série, de agora em diante',
                  descricao: 'Vale para todas as próximas datas.',
                },
                ...futuras.slice(0, 8).map((o) => ({
                  valor: o.id,
                  rotulo: `A partir de ${formatarQuando(o.inicio, serie.fuso)}`,
                  descricao: 'A série se divide nesta data; as anteriores ficam como estão.',
                })),
              ]}
            />
            {pronto ? (
              <Aviso tipo="sucesso" anunciar>
                {pronto}
              </Aviso>
            ) : null}
            {salvar.error && !ehErroDaApi(salvar.error, 'confirmar_recriacao') ? (
              <AvisoDeErro erro={salvar.error} />
            ) : null}
            <Botao
              titulo="Salvar a regra nova"
              carregando={salvar.isPending}
              aoPressionar={() => {
                if (!lerHoraDigitada(hora)) return setErro('Use a hora no formato HH:MM.')
                if (regra.fim.trim() && !lerDataDigitada(regra.fim)) {
                  return setErro('A data de término não é válida (use DD/MM/AAAA).')
                }
                setErro(null)
                setPronto(null)
                salvar.mutate(false)
              }}
            />
          </>
        )}
      </Expansivel>
    </Cartao>
  )
}

/** Nenhuma ocorrência saiu do rascunho: a série pode ser excluída (senão, só encerrada). */
function soRascunhos(serie: DetalheDaSerie): boolean {
  return serie.ocorrencias.length > 0 && serie.ocorrencias.every((o) => o.status === 'rascunho')
}

/** A próxima data que ainda vai acontecer (o padrão de "encerrar a partir de"). */
function proximaOcorrencia(serie: DetalheDaSerie): DataLocal {
  const agora = Date.now()
  const proxima = serie.ocorrencias.find(
    (o) =>
      new Date(o.inicio).getTime() >= agora &&
      (o.status === 'rascunho' || o.status === 'publicado' || o.status === 'adiado'),
  )
  return proxima ? dataDoInstante(proxima.inicio, serie.fuso) : hojeNoFuso(serie.fuso)
}

/** "2 datas canceladas e 1 rascunho apagado", para a confirmação depois de encerrar. */
function resumoDoEncerramento(r: { apagados: number; cancelados: number }): string {
  const partes = [
    r.cancelados
      ? `${r.cancelados} ${r.cancelados === 1 ? 'data cancelada' : 'datas canceladas'}`
      : null,
    r.apagados
      ? `${r.apagados} ${r.apagados === 1 ? 'rascunho apagado' : 'rascunhos apagados'}`
      : null,
  ].filter(Boolean)
  return partes.length ? `Série encerrada: ${partes.join(' e ')}.` : 'Série encerrada.'
}

function ExcluirSerie({ serie, comunidadeId }: { serie: DetalheDaSerie; comunidadeId: string }) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const excluir = useMutation({
    mutationFn: () =>
      api.delete<{ ok: boolean; apagados: number }>(
        `${naComunidade(comunidadeId)}/series/${serie.id}`,
      ),
    onSuccess: async (r) => {
      await invalidar()
      mostrarToast({
        texto:
          r.apagados === 1
            ? 'Série excluída com o rascunho dela.'
            : `Série excluída com os ${r.apagados} rascunhos dela.`,
      })
      router.back()
    },
  })
  return (
    <Cartao titulo="Excluir a série">
      <Texto variante="legenda" cor="textoSuave">
        Nenhuma data desta série foi publicada: ela pode ser excluída inteira, sem avisar ninguém.
      </Texto>
      {excluir.error ? <AvisoDeErro erro={excluir.error} /> : null}
      <Botao
        titulo="Excluir série"
        variante="destrutivo"
        carregando={excluir.isPending}
        aoPressionar={async () => {
          const ok = await confirmar({
            titulo: 'Excluir esta série?',
            mensagem: 'A série e todas as datas em rascunho somem. Não dá para desfazer.',
            confirmar: 'Excluir série',
            destrutivo: true,
          })
          if (ok) excluir.mutate()
        }}
      />
    </Cartao>
  )
}

function EncerrarSerie({ serie, comunidadeId }: { serie: DetalheDaSerie; comunidadeId: string }) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const [data, setData] = useState<DataLocal | null>(() => proximaOcorrencia(serie))
  const [motivo, setMotivo] = useState('')
  const [erros, setErros] = useState<{ data?: string; motivo?: string }>({})
  const encerrar = useMutation({
    mutationFn: (corpo: { aPartirDe: string; motivo: string }) =>
      api.post<{ apagados: number; cancelados: number; estado: 'ativa' | 'encerrada' }>(
        `${naComunidade(comunidadeId)}/series/${serie.id}/encerrar`,
        corpo,
      ),
    onSuccess: async (r) => {
      await invalidar()
      mostrarToast({ texto: resumoDoEncerramento(r) })
      router.back()
    },
  })

  return (
    <Cartao titulo="Encerrar a série" icone="cancelar">
      <Texto variante="legenda" cor="textoSuave">
        A partir da data escolhida, rascunhos somem e eventos publicados são cancelados com o
        motivo, que vai para quem está escalado e inscrito.
      </Texto>
      <Expansivel titulo="Encerrar a série" icone="cancelar">
        {() => (
          <>
            <CampoDeData
              rotulo="A partir do dia"
              valor={data}
              aoMudar={setData}
              erro={erros.data ?? null}
              ajuda="Começa pela próxima data da série."
            />
            <Campo
              rotulo="Motivo"
              value={motivo}
              onChangeText={setMotivo}
              erro={erros.motivo ?? null}
              ajuda="Obrigatório."
              multiline
              maxLength={500}
            />
            {encerrar.error ? <AvisoDeErro erro={encerrar.error} /> : null}
            <Botao
              titulo="Encerrar e avisar"
              variante="destrutivo"
              carregando={encerrar.isPending}
              aoPressionar={async () => {
                const d = data ? lerDataDigitada(data) : null
                const novos = {
                  ...(d ? {} : { data: 'Escolha o dia a partir do qual a série acaba.' }),
                  ...(motivo.trim().length >= 3 ? {} : { motivo: 'Explique o motivo.' }),
                }
                setErros(novos)
                if (!d || Object.keys(novos).length) return
                const ok = await confirmar({
                  titulo: 'Encerrar a série?',
                  mensagem: `Nenhuma data a partir de ${formatarDataLocal(d)} vai acontecer. Não dá para desfazer.`,
                  confirmar: 'Encerrar a série',
                  destrutivo: true,
                })
                if (ok) encerrar.mutate({ aPartirDe: d, motivo: motivo.trim() })
              }}
            />
          </>
        )}
      </Expansivel>
    </Cartao>
  )
}
