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
      <Tela cabecalhoNativo>
        <SemComunidade oQue="a série" />
      </Tela>
    )
  }
  if (!pode('evento', 'editar')) {
    return (
      <Tela cabecalhoNativo titulo="Série">
        <Aviso tipo="info" titulo="Só a organização gerencia séries">
          Cada data da série aparece na agenda como um evento.
        </Aviso>
      </Tela>
    )
  }
  if (serie.isPending) {
    return (
      <Tela cabecalhoNativo>
        <Carregando texto="Carregando a série" />
      </Tela>
    )
  }
  if (serie.error) {
    return (
      <Tela cabecalhoNativo>
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
    <Tela cabecalhoNativo titulo={serie.titulo} descricao="Série de encontros">
      <Cartao titulo="Como repete" icone="repetir">
        <Texto variante="corpoForte">{descreverRegra(serie.regra, hora)}</Texto>
        <Texto variante="apoio" cor="textoSuave">
          Desde {formatarDataLocal(serie.inicio_em)}
          {serie.fim_em ? ` até ${formatarDataLocal(serie.fim_em)}` : ', sem data para acabar'}. As
          datas são criadas com 6 meses de antecedência.
        </Texto>
      </Cartao>
      <Cartao titulo="Próximas datas" icone="agenda">
        {serie.ocorrencias.length === 0 ? (
          <Texto variante="apoio" cor="textoSuave">
            Nenhuma data futura nesta série.
          </Texto>
        ) : (
          <View style={{ gap: ESPACO.x2 }}>
            {serie.ocorrencias.slice(0, 12).map((o) => (
              <View key={o.id} style={{ gap: ESPACO.x1 }}>
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
                  <Texto variante="apoio" cor="textoSuave">
                    Editada à parte: mudanças na série toda não alteram esta data.
                  </Texto>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Cartao>
      <MudarRegra serie={serie} comunidadeId={comunidadeId} />
      {pode('evento', 'cancelar_ou_adiar') ? (
        <EncerrarSerie serie={serie} comunidadeId={comunidadeId} />
      ) : null}
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
      <Texto variante="apoio" cor="textoSuave">
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

function EncerrarSerie({ serie, comunidadeId }: { serie: DetalheDaSerie; comunidadeId: string }) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const [data, setData] = useState(formatarDataLocal(hojeNoFuso(serie.fuso)))
  const [motivo, setMotivo] = useState('')
  const [erros, setErros] = useState<{ data?: string; motivo?: string }>({})
  const encerrar = useMutation({
    mutationFn: (corpo: { aPartirDe: string; motivo: string }) =>
      api.post<{ apagados: number; cancelados: number }>(
        `${naComunidade(comunidadeId)}/series/${serie.id}/encerrar`,
        corpo,
      ),
    onSuccess: async () => {
      await invalidar()
      router.back()
    },
  })

  return (
    <Cartao titulo="Encerrar a série" icone="cancelar">
      <Texto variante="apoio" cor="textoSuave">
        A partir da data escolhida, rascunhos somem e eventos publicados são cancelados com o
        motivo, que vai para quem está escalado e inscrito.
      </Texto>
      <Expansivel titulo="Encerrar a série" icone="cancelar">
        {() => (
          <>
            <Campo
              rotulo="A partir do dia"
              value={data}
              onChangeText={setData}
              erro={erros.data ?? null}
              ajuda="Formato DD/MM/AAAA."
              keyboardType="numbers-and-punctuation"
              maxLength={10}
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
              variante="perigo"
              carregando={encerrar.isPending}
              aoPressionar={async () => {
                const d = lerDataDigitada(data)
                const novos = {
                  ...(d ? {} : { data: 'Use uma data real, no formato DD/MM/AAAA.' }),
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
