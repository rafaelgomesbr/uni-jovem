import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { DetalheDaSerie } from '@/servicos/contratoDosEventos'
import { ehErroDaApi } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CampoDeData, CampoDeHora } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { FolhaNaTela, MenuDeAcoes } from '@/ui/FolhaNaTela'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import {
  dataDoInstante,
  DIAS_CURTOS,
  diaDaSemana,
  formatarDataLocal,
  formatarDataPorExtenso,
  formatarDuracao,
  formatarHora,
  formatarQuando,
  hojeNoFuso,
  lerDataDigitada,
  lerHoraDigitada,
  type DataLocal,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { voltarOu } from '@/ui/navegacao'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useInvalidarEventos, useSerie } from './consultas'
import { EditorDeRegra } from './EditorDeRegra'
import { rascunhoDaRegra, regraDoRascunho, type RascunhoDaRegra } from './formulario'
import { ChipDoStatus } from './LinhaDoEvento'
import { descreverRegra } from './nomes'

/** Rota `/serie/[serieId]` (3.4.6): a regra, as próximas datas, mudar a regra e encerrar. */
export function TelaSerie() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const serieId = parametro(useLocalSearchParams<{ serieId: string }>().serieId)
  const serie = useSerie(comunidadeAtiva?.id ?? null, serieId, pode('evento', 'editar'))

  if (!comunidadeAtiva || !serieId) {
    return (
      <Tela pilha>
        <SemComunidade oQue="a repetição" />
      </Tela>
    )
  }
  if (!pode('evento', 'editar')) {
    return (
      <Tela pilha titulo="Repetição">
        <Aviso tipo="info" titulo="Só a organização gerencia repetições">
          Cada data da repetição aparece na agenda como um encontro.
        </Aviso>
      </Tela>
    )
  }
  if (serie.isPending) {
    return (
      <Tela pilha titulo="Repetição">
        <Esqueleto rotulo="Carregando a repetição">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (serie.error) {
    return (
      <Tela pilha titulo="Repetição">
        <ErroDaTela erro={serie.error} aoTentarDeNovo={() => void serie.refetch()} />
      </Tela>
    )
  }
  return <Serie serie={serie.data} comunidadeId={comunidadeAtiva.id} />
}

/** Nenhuma ocorrência saiu do rascunho: a série pode ser excluída (senão, só encerrada). */
function soRascunhos(serie: DetalheDaSerie): boolean {
  return serie.ocorrencias.length > 0 && serie.ocorrencias.every((o) => o.status === 'rascunho')
}

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

function Serie({ serie, comunidadeId }: { serie: DetalheDaSerie; comunidadeId: string }) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const [menu, setMenu] = useState(false)
  const [editandoRegra, setEditandoRegra] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const hora = serie.hora_local.slice(0, 5)
  const ativa = serie.estado !== 'encerrada'
  const podeEncerrar = ativa && pode('evento', 'cancelar_ou_adiar')
  const podeExcluir = ativa && pode('evento', 'excluir') && soRascunhos(serie)

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
            ? 'Repetição excluída com o rascunho dela.'
            : `Repetição excluída com os ${r.apagados} rascunhos dela.`,
      })
      voltarOu('/agenda')
    },
  })

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: 'Excluir esta repetição?',
      mensagem:
        'Nenhuma data foi publicada: a repetição e todas as datas em rascunho somem, sem avisar ninguém. Não dá para desfazer.',
      confirmar: 'Excluir repetição',
      destrutivo: true,
    })
    if (ok) excluir.mutate()
  }

  return (
    <Tela
      pilha
      titulo={serie.titulo}
      descricao="Encontros que se repetem"
      {...(podeEncerrar || podeExcluir
        ? {
            acoes: (
              <BotaoIcone
                icone="maisAcoes"
                rotulo="Mais ações"
                circular
                aoPressionar={() => setMenu(true)}
              />
            ),
          }
        : {})}
    >
      {excluir.error ? (
        <AvisoDeFalha erro={excluir.error} titulo="A repetição não foi excluída" />
      ) : null}
      {!ativa ? (
        <Aviso tipo="info" titulo="Repetição encerrada">
          {serie.encerrada_em
            ? `Encerrada em ${formatarDataLocal(dataDoInstante(serie.encerrada_em, serie.fuso))}. Ela não recebe mais alterações; para continuar os encontros, crie uma repetição nova.`
            : 'Ela não recebe mais alterações; para continuar os encontros, crie uma repetição nova.'}
        </Aviso>
      ) : null}

      <CartaoDeVidro
        sobrancelha="Regra"
        comecaComTitulo
        titulo={descreverRegra(serie.regra, hora)}
        {...(ativa
          ? {
              acoes: (
                <Botao
                  titulo="Editar regra"
                  variante="terciario"
                  alinhado
                  aoPressionar={() => setEditandoRegra(true)}
                />
              ),
            }
          : {})}
      >
        <Texto variante="meta" cor="textoSuave">
          {`Desde ${formatarDataLocal(serie.inicio_em)}${serie.fim_em ? ` até ${formatarDataLocal(serie.fim_em)}` : ', sem data para acabar'}. As datas são criadas com 6 meses de antecedência.`}
        </Texto>
      </CartaoDeVidro>

      {serie.ocorrencias.length === 0 ? (
        <EstadoVazio
          icone="agenda"
          titulo="Nenhuma data futura"
          descricao="A repetição não tem datas pela frente. Mude a regra para criar as próximas."
          acao={
            ativa
              ? { titulo: 'Editar regra', aoPressionar: () => setEditandoRegra(true) }
              : {
                  titulo: 'Ver a agenda',
                  aoPressionar: () =>
                    router.push({ pathname: '/agenda', params: { vista: 'lista' } }),
                }
          }
        />
      ) : (
        <CartaoDeVidro sobrancelha="Próximas datas" lista>
          <Lista>
            {serie.ocorrencias.slice(0, 12).map((o) => {
              const dia = dataDoInstante(o.inicio, serie.fuso)
              const descricao = [
                formatarHora(o.inicio, serie.fuso),
                formatarDuracao(serie.duracao_min),
                o.editadoIndividualmente ? 'editada à parte' : null,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <LinhaDeLista
                  key={o.id}
                  data={{
                    dia: String(Number(dia.slice(8, 10))),
                    mes: DIAS_CURTOS[diaDaSemana(dia)] ?? '',
                  }}
                  titulo={primeiraMaiuscula(formatarDataPorExtenso(dia, false))}
                  descricao={descricao}
                  extra={<ChipDoStatus status={o.status} />}
                  rotuloAcessivel={`${formatarQuando(o.inicio, serie.fuso)}. ${descricao}`}
                  aoPressionar={() =>
                    router.push({ pathname: '/evento/[eventoId]', params: { eventoId: o.id } })
                  }
                />
              )
            })}
          </Lista>
        </CartaoDeVidro>
      )}

      {ativa ? (
        <EditarRegra
          serie={serie}
          comunidadeId={comunidadeId}
          aberta={editandoRegra}
          aoFechar={() => setEditandoRegra(false)}
        />
      ) : null}
      {podeEncerrar ? (
        <EncerrarSerie
          serie={serie}
          comunidadeId={comunidadeId}
          aberta={encerrando}
          aoFechar={() => setEncerrando(false)}
        />
      ) : null}
      <MenuDeAcoes
        aberto={menu}
        titulo="Mais ações"
        aoFechar={() => setMenu(false)}
        acoes={[
          podeEncerrar && {
            titulo: 'Encerrar a repetição',
            icone: 'cancelar',
            descricao: 'Rascunhos somem e as datas publicadas são canceladas',
            destrutiva: true,
            aoPressionar: () => setEncerrando(true),
          },
          podeExcluir && {
            titulo: 'Excluir repetição',
            icone: 'excluir',
            descricao: 'Nenhuma data foi publicada ainda',
            destrutiva: true,
            aoPressionar: () => void pedirExclusao(),
          },
        ]}
      />
    </Tela>
  )
}

/** Folha "Editar regra": dia, frequência, hora e a partir de quando valem. */
function EditarRegra({
  serie,
  comunidadeId,
  aberta,
  aoFechar,
}: {
  serie: DetalheDaSerie
  comunidadeId: string
  aberta: boolean
  aoFechar: () => void
}) {
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const [regra, setRegra] = useState<RascunhoDaRegra>(() =>
    rascunhoDaRegra(serie.regra, serie.fim_em),
  )
  const [hora, setHora] = useState<string | null>(serie.hora_local.slice(0, 5))
  const futuras = serie.ocorrencias.filter(
    (o) => o.status === 'rascunho' || o.status === 'publicado',
  )
  const [aPartirDe, setAPartirDe] = useState<string>('agora')
  const [erro, setErro] = useState<string | null>(null)
  const primeira = (
    serie.ocorrencias[0] ? dataDoInstante(serie.ocorrencias[0].inicio, serie.fuso) : serie.inicio_em
  ) as DataLocal

  const salvar = useMutation({
    mutationFn: (confirmarRecriacao: boolean) => {
      const { regra: nova } = regraDoRascunho(regra, primeira)
      const h = hora ? lerHoraDigitada(hora) : null
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
      mostrarToast({
        texto:
          r.recriadas === 1
            ? 'Repetição atualizada: 1 data recriada.'
            : `Repetição atualizada: ${r.recriadas} datas recriadas.`,
      })
      aoFechar()
      await invalidar()
      await consultas.invalidateQueries({ queryKey: CHAVES.serie(comunidadeId, serie.id) })
    },
    onError: async (e) => {
      if (!ehErroDaApi(e, 'confirmar_recriacao')) return
      const ok = await confirmar({
        titulo: 'Recriar as próximas datas?',
        mensagem: e.mensagem,
        confirmar: 'Recriar e perder as convocações',
        destrutivo: true,
      })
      if (ok) salvar.mutate(true)
    },
  })

  return (
    <FolhaNaTela aberta={aberta} titulo="Editar regra" aoFechar={aoFechar}>
      <Texto variante="corpo" cor="textoSuave">
        As próximas datas que não foram editadas à parte são recriadas com a regra nova.
      </Texto>
      <EditorDeRegra
        regra={regra}
        aoMudar={setRegra}
        primeira={primeira}
        hora={hora ? lerHoraDigitada(hora) : null}
        semNaoRepete
      />
      <CampoDeHora rotulo="Hora de início" valor={hora} aoMudar={setHora} erro={erro} />
      <ListaDeOpcoes
        rotulo="A partir de quando"
        valor={aPartirDe}
        aoMudar={setAPartirDe}
        opcoes={[
          {
            valor: 'agora',
            rotulo: 'Toda a repetição, de agora em diante',
            descricao: 'Vale para todas as próximas datas.',
          },
          ...futuras.slice(0, 8).map((o) => ({
            valor: o.id,
            rotulo: `A partir de ${formatarQuando(o.inicio, serie.fuso)}`,
            descricao: 'A repetição se divide nesta data; as anteriores ficam como estão.',
          })),
        ]}
      />
      {salvar.error && !ehErroDaApi(salvar.error, 'confirmar_recriacao') ? (
        <AvisoDeFalha erro={salvar.error} titulo="A regra não mudou" />
      ) : null}
      <Botao
        titulo="Salvar a regra"
        tamanho="grande"
        larguraTotal
        carregando={salvar.isPending}
        aoPressionar={() => {
          if (!hora || !lerHoraDigitada(hora)) return setErro('Escolha a hora de início.')
          setErro(null)
          salvar.mutate(false)
        }}
      />
    </FolhaNaTela>
  )
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
  return partes.length ? `Repetição encerrada: ${partes.join(' e ')}.` : 'Repetição encerrada.'
}

/** Folha "Encerrar a série": a partir de que dia, o motivo e o destrutivo cheio. */
function EncerrarSerie({
  serie,
  comunidadeId,
  aberta,
  aoFechar,
}: {
  serie: DetalheDaSerie
  comunidadeId: string
  aberta: boolean
  aoFechar: () => void
}) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const [data, setData] = useState<string | null>(() => proximaOcorrencia(serie))
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
      aoFechar()
      voltarOu('/agenda')
    },
  })

  async function pedir() {
    const d = data ? lerDataDigitada(data) : null
    const novos = {
      ...(d ? {} : { data: 'Escolha o dia a partir do qual a repetição acaba.' }),
      ...(motivo.trim().length >= 3 ? {} : { motivo: 'Explique o motivo.' }),
    }
    setErros(novos)
    if (!d || Object.keys(novos).length) return
    const ok = await confirmar({
      titulo: 'Encerrar a repetição?',
      mensagem: `Nenhuma data a partir de ${formatarDataLocal(d)} vai acontecer. Não dá para desfazer.`,
      confirmar: 'Encerrar a repetição',
      destrutivo: true,
    })
    if (ok) encerrar.mutate({ aPartirDe: d, motivo: motivo.trim() })
  }

  return (
    <FolhaNaTela aberta={aberta} titulo="Encerrar a repetição" aoFechar={aoFechar}>
      <Aviso tipo="alerta" titulo="Quem participa é avisado">
        A partir do dia escolhido, rascunhos somem e encontros publicados são cancelados com o
        motivo, que vai para quem está convocado e inscrito.
      </Aviso>
      <CampoDeData
        rotulo="A partir do dia"
        valor={data}
        aoMudar={setData}
        erro={erros.data ?? null}
        ajuda="Começa pela próxima data da repetição."
      />
      <Campo
        rotulo="Motivo"
        value={motivo}
        onChangeText={setMotivo}
        erro={erros.motivo ?? null}
        multiline
        maxLength={500}
      />
      {encerrar.error ? (
        <AvisoDeFalha erro={encerrar.error} titulo="A repetição não foi encerrada" />
      ) : null}
      <Botao
        titulo="Encerrar e avisar"
        tamanho="grande"
        variante="destrutivoCheio"
        larguraTotal
        carregando={encerrar.isPending}
        aoPressionar={() => void pedir()}
      />
    </FolhaNaTela>
  )
}
