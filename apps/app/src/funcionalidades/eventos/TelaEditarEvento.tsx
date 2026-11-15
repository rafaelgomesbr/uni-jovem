import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { DetalheDaSerie, DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { ehErroDaApi } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { formatarHora } from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { CamposDoEvento } from './CamposDoEvento'
import { naComunidade, useEvento, useInvalidarEventos } from './consultas'
import {
  LOCAL_NOVO,
  mudancasDoEvento,
  NOME_DO_CAMPO,
  rascunhoDoEvento,
  validarRascunho,
  type ErrosDoRascunho,
  type EventoValidado,
  type RascunhoDoEvento,
} from './formulario'

export type Escopo = 'esta' | 'a_partir_de' | 'serie'

export const OPCOES_DE_ESCOPO: readonly { valor: Escopo; rotulo: string; descricao: string }[] = [
  {
    valor: 'esta',
    rotulo: 'Só esta ocorrência',
    descricao: 'As outras datas da série não mudam.',
  },
  {
    valor: 'a_partir_de',
    rotulo: 'Esta e as próximas',
    descricao: 'A série se divide nesta data; as anteriores continuam como estão.',
  },
  {
    valor: 'serie',
    rotulo: 'Toda a série',
    descricao: 'Vale para as próximas ocorrências que não foram editadas à parte.',
  },
]

/** Rota `/evento/[eventoId]/editar`. */
export function TelaEditarEvento() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const evento = useEvento(comunidadeAtiva?.id ?? null, eventoId)
  const pode = usePode()

  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela cabecalhoNativo>
        <SemComunidade oQue="a programação" />
      </Tela>
    )
  }
  if (!pode('evento', 'editar')) {
    return (
      <Tela cabecalhoNativo titulo="Editar">
        <Aviso tipo="info" titulo="Só a organização edita programações">
          Você pode ver a programação, mas não alterar.
        </Aviso>
      </Tela>
    )
  }
  if (evento.isPending) {
    return (
      <Tela cabecalhoNativo>
        <Carregando texto="Carregando a programação" />
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
  return <EditarEvento comunidadeId={comunidadeAtiva.id} inicial={evento.data} />
}

interface Conflito {
  atual: DetalheDoEvento
  campos: string[]
}

function EditarEvento({
  comunidadeId,
  inicial,
}: {
  comunidadeId: string
  inicial: DetalheDoEvento
}) {
  const fuso = useFusoDaComunidade()
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  // A edição parte de uma versão fixa: se outra pessoa salvar no meio, isso vira conflito explícito.
  const [base, setBase] = useState(inicial)
  const [rascunho, setRascunho] = useState<RascunhoDoEvento>(() => rascunhoDoEvento(inicial))
  const [erros, setErros] = useState<ErrosDoRascunho>({})
  const [escopo, setEscopo] = useState<Escopo | null>(inicial.serieId ? null : 'esta')
  const [conflito, setConflito] = useState<Conflito | null>(null)
  const [semMudancas, setSemMudancas] = useState(false)
  const ehSerie = inicial.serieId !== null
  const daSerie = escopo === 'serie' || escopo === 'a_partir_de'
  const chaveDoEvento = CHAVES.evento(comunidadeId, inicial.id)
  const caminho = `${naComunidade(comunidadeId)}/eventos/${inicial.id}`

  const mudar = <K extends keyof RascunhoDoEvento>(campo: K, valor: RascunhoDoEvento[K]) =>
    setRascunho((r) => ({ ...r, [campo]: valor }))

  async function garantirLocal(dados: EventoValidado): Promise<string | null> {
    if (dados.local !== LOCAL_NOVO) return dados.local
    const l = rascunho.novoLocal
    const novo = await api.post<{ id: string }>(`${naComunidade(comunidadeId)}/locais`, {
      nome: l.nome.trim(),
      tipo: l.tipo,
      endereco: l.endereco.trim() || null,
      referencia: l.referencia.trim() || null,
    })
    setRascunho((r) => ({ ...r, local: novo.id }))
    await consultas.invalidateQueries({ queryKey: CHAVES.locais(comunidadeId) })
    return novo.id
  }

  const salvarOcorrencia = useMutation({
    mutationFn: async ({
      dados,
      versaoBase,
    }: {
      dados: EventoValidado
      versaoBase: DetalheDoEvento
    }) => {
      const localId = await garantirLocal(dados)
      const mudancas = mudancasDoEvento(versaoBase, dados, localId)
      if (Object.keys(mudancas).length === 0) return 'nada' as const
      await api.patch(caminho, { versao: versaoBase.versao, ...mudancas })
      return 'salvo' as const
    },
    onSuccess: async (r) => {
      if (r === 'nada') {
        setSemMudancas(true)
        return
      }
      await invalidar(inicial.id)
      router.back()
    },
    onError: async (erro, { dados }) => {
      if (!ehErroDaApi(erro, 'conflito')) return
      // Busca a versão atual e mostra o que diverge do que a pessoa escreveu.
      const atual = await consultas.fetchQuery({
        queryKey: chaveDoEvento,
        queryFn: () => api.get<DetalheDoEvento>(caminho),
        staleTime: 0,
      })
      const minhas = mudancasDoEvento(base, dados, dados.local === LOCAL_NOVO ? null : dados.local)
      const campos = Object.keys(minhas).filter((c) => {
        const r = mudancasDoEvento(atual, dados, dados.local === LOCAL_NOVO ? null : dados.local)
        return c in r
      })
      setConflito({ atual, campos })
    },
  })

  const salvarSerie = useMutation({
    mutationFn: async ({
      dados,
      confirmarRecriacao,
    }: {
      dados: EventoValidado
      confirmarRecriacao: boolean
    }) => {
      const serie = await consultas.fetchQuery({
        queryKey: CHAVES.serie(comunidadeId, inicial.serieId!),
        queryFn: () =>
          api.get<DetalheDaSerie>(`${naComunidade(comunidadeId)}/series/${inicial.serieId}`),
        staleTime: 0,
      })
      const localId = await garantirLocal(dados)
      const mudancas: Record<string, unknown> = {}
      if (dados.titulo !== serie.titulo) mudancas.titulo = dados.titulo
      if (dados.categoria !== serie.categoria) mudancas.categoria = dados.categoria
      if (dados.descricao !== (serie.descricao ?? null)) mudancas.descricao = dados.descricao
      if (localId !== serie.local_id) mudancas.localId = localId
      if (dados.duracaoMin !== undefined && dados.duracaoMin !== serie.duracao_min) {
        mudancas.duracaoMin = dados.duracaoMin
      }
      if (dados.hora !== serie.hora_local.slice(0, 5)) mudancas.horaLocal = dados.hora
      if (Object.keys(mudancas).length === 0) return 'nada' as const
      await api.patch(`${naComunidade(comunidadeId)}/series/${inicial.serieId}`, {
        versao: serie.versao,
        escopo: escopo === 'serie' ? 'serie' : 'a_partir_de',
        ...(escopo === 'a_partir_de' ? { aPartirDoEvento: inicial.id } : {}),
        confirmarRecriacao,
        mudancas,
      })
      return 'salvo' as const
    },
    onSuccess: async (r) => {
      if (r === 'nada') {
        setSemMudancas(true)
        return
      }
      await invalidar(inicial.id)
      await consultas.invalidateQueries({ queryKey: CHAVES.serie(comunidadeId, inicial.serieId!) })
      router.back()
    },
    onError: async (erro, { dados }) => {
      if (!ehErroDaApi(erro, 'confirmar_recriacao')) return
      const ok = await confirmar({
        titulo: 'Recriar as próximas ocorrências?',
        mensagem: erro.mensagem,
        confirmar: 'Recriar e perder as escalas',
        destrutivo: true,
      })
      if (ok) salvarSerie.mutate({ dados, confirmarRecriacao: true })
    },
  })

  function enviar(versaoBase: DetalheDoEvento = base) {
    setSemMudancas(false)
    const { erros: novos, dados } = validarRascunho(rascunho, {
      fuso,
      duracaoOpcional: false,
      ignorarData: daSerie,
    })
    setErros(novos)
    if (!dados || !escopo) return
    if (daSerie) salvarSerie.mutate({ dados, confirmarRecriacao: false })
    else salvarOcorrencia.mutate({ dados, versaoBase })
  }

  const erro = salvarOcorrencia.error ?? salvarSerie.error
  const erroVisivel =
    erro &&
    !ehErroDaApi(erro, 'confirmar_recriacao') &&
    !(conflito && ehErroDaApi(erro, 'conflito'))
  const salvando = salvarOcorrencia.isPending || salvarSerie.isPending

  return (
    <Tela cabecalhoNativo titulo="Editar programação" descricao={inicial.titulo}>
      {ehSerie ? (
        <Cartao titulo="O que você quer mudar?" icone="repetir">
          <Texto variante="apoio" cor="textoSuave">
            Este evento faz parte de uma série. Escolha antes de salvar.
          </Texto>
          <GrupoDeOpcoes
            rotulo="Alcance da mudança"
            valor={escopo}
            aoMudar={setEscopo}
            opcoes={OPCOES_DE_ESCOPO}
          />
          {daSerie ? (
            <Aviso
              tipo="info"
              titulo="Na série valem título, categoria, descrição, local, hora e duração"
            >
              Vagas, visibilidade, prazo de inscrição e informações úteis são de cada ocorrência:
              para mudá-los, escolha &quot;Só esta ocorrência&quot;.
            </Aviso>
          ) : null}
        </Cartao>
      ) : null}

      {conflito ? (
        <ConflitoDeEdicao
          conflito={conflito}
          fuso={inicial.fuso}
          aoManterMinha={() => {
            setBase(conflito.atual)
            setConflito(null)
            enviar(conflito.atual)
          }}
          aoUsarAtual={() => {
            setBase(conflito.atual)
            setRascunho(rascunhoDoEvento(conflito.atual))
            setConflito(null)
            salvarOcorrencia.reset()
          }}
        />
      ) : null}

      <CamposDoEvento
        comunidadeId={comunidadeId}
        rascunho={rascunho}
        mudar={mudar}
        erros={erros}
        visiveis={{ data: !daSerie, inscricoes: !daSerie, prazoEEspera: !daSerie }}
      />

      {Object.keys(erros).length ? (
        <AvisoDeErro
          titulo="Confira os campos"
          mensagem="Alguns campos precisam de ajuste. As mensagens estão ao lado de cada um."
        />
      ) : null}
      {semMudancas ? (
        <Aviso tipo="info" anunciar>
          Nada mudou{daSerie ? ' nos campos que valem para a série' : ''}. Altere algum campo antes
          de salvar.
        </Aviso>
      ) : null}
      {erroVisivel ? <AvisoDeErro erro={erro} /> : null}
      <Botao
        titulo="Salvar alterações"
        carregando={salvando}
        desabilitado={!escopo || conflito !== null}
        motivo={
          conflito
            ? 'Resolva o conflito acima primeiro.'
            : 'Escolha acima se a mudança vale só para esta ocorrência ou para a série.'
        }
        aoPressionar={() => enviar()}
      />
    </Tela>
  )
}

function valorLegivel(campo: string, e: DetalheDoEvento, fuso: string): string {
  switch (campo) {
    case 'inicio':
      return `${formatarHora(e.inicio, fuso)} de ${rascunhoDoEvento(e).data}`
    case 'localId':
      return e.local?.nome ?? 'A definir'
    case 'duracaoMin':
      return `${e.duracaoMin} min`
    case 'capacidade':
      return e.capacidade ? String(e.capacidade) : 'Sem limite'
    case 'listaDeEspera':
      return e.listaDeEspera ? 'Sim' : 'Não'
    case 'inscricaoAte':
      return e.inscricaoAte ? rascunhoDoEvento(e).inscricaoData : 'Até o início'
    default: {
      const v = (e as unknown as Record<string, unknown>)[campo]
      return v === null || v === undefined || v === '' ? '(vazio)' : String(v)
    }
  }
}

/** 409: mostra a versão atual e deixa a pessoa escolher, nunca "o último a salvar vence". */
function ConflitoDeEdicao({
  conflito,
  fuso,
  aoManterMinha,
  aoUsarAtual,
}: {
  conflito: Conflito
  fuso: string
  aoManterMinha: () => void
  aoUsarAtual: () => void
}) {
  return (
    <Cartao titulo="Outra pessoa salvou antes de você" icone="erro">
      <Aviso tipo="alerta" anunciar titulo="Conflito de edição">
        A programação mudou enquanto você editava. Compare e escolha o que fica.
      </Aviso>
      {conflito.campos.length ? (
        <View style={{ gap: ESPACO.x2 }}>
          {conflito.campos.map((c) => (
            <Texto key={c} variante="apoio">
              {NOME_DO_CAMPO[c] ?? c}: na versão atual está &quot;
              {valorLegivel(c, conflito.atual, fuso)}&quot;. A sua mudança substitui isso.
            </Texto>
          ))}
        </View>
      ) : (
        <Texto variante="apoio">
          A outra pessoa mudou campos diferentes dos seus: salvar a sua versão mantém as duas
          mudanças.
        </Texto>
      )}
      <Botao titulo="Salvar a minha versão" aoPressionar={aoManterMinha} />
      <Botao
        titulo="Descartar a minha e usar a atual"
        variante="secundario"
        aoPressionar={aoUsarAtual}
      />
    </Cartao>
  )
}
