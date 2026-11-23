import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO, RITMO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { DetalheDaSerie, DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { ehErroDaApi } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { useConfirmarDescarte, useTravaDeEnvio } from '@/ui/navegacao'
import { Secao } from '@/ui/Secao'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { dataDoInstante, formatarDataLocal, formatarHora } from '@/utilidades/datas'

import { useFusoDaComunidade } from '../comunidade/consultas'
import {
  CamposDoEvento,
  focarPrimeiroErro,
  resumoDosErros,
  useRefsDosCampos,
} from './CamposDoEvento'
import { naComunidade, useInvalidarEventos } from './consultas'
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
    descricao: 'As outras datas da repetição não mudam.',
  },
  {
    valor: 'a_partir_de',
    rotulo: 'Esta e as próximas',
    descricao: 'A repetição se divide nesta data; as anteriores continuam como estão.',
  },
  {
    valor: 'serie',
    rotulo: 'Toda a repetição',
    descricao: 'Vale para as próximas ocorrências que não foram editadas à parte.',
  },
]

interface Conflito {
  atual: DetalheDoEvento
  campos: string[]
}

interface Props {
  comunidadeId: string
  /** O encontro como está agora; a edição parte de uma cópia fixa dele (versão para o conflito). */
  inicial: DetalheDoEvento
  /** Depois de salvar: a rota volta; a seção do encontro se recolhe. */
  aoSalvar: () => void
  /**
   * Avisa quando há algo digitado ainda não salvo: quem hospeda pergunta antes de recolher a seção
   * ou trocar de aba (o que se digitou não fica guardado).
   */
  aoMudarSujo?: (sujo: boolean) => void
  /** O botão "Cancelar": recolhe a seção ou volta (quem hospeda pergunta antes se há algo digitado). */
  aoCancelar: () => void
  /** Dentro da seção do Resumo: sem os títulos e o cartão duplo do formulário avulso. */
  naSecao?: boolean
}

/**
 * Os dados do encontro para editar (D69): título, data, hora, local e o resto em "Mais opções", o
 * alcance da mudança quando o encontro se repete, o conflito de versão (409) e o botão "Salvar
 * alterações" no fim. Não desenha tela nem barra: mora dentro da seção "Dados do encontro" do
 * Resumo e, nos links antigos, dentro da rota `/evento/[eventoId]/editar`.
 */
export function EditarDadosDoEncontro({
  comunidadeId,
  inicial,
  aoSalvar,
  aoMudarSujo,
  aoCancelar,
  naSecao = false,
}: Props) {
  const fuso = useFusoDaComunidade()
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const refs = useRefsDosCampos()
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
  const trava = useTravaDeEnvio()
  const sujo = JSON.stringify(rascunho) !== JSON.stringify(rascunhoDoEvento(base))
  // O encontro recarregou (publicou, adiou, outra pessoa salvou) e nada foi digitado: parte da versão
  // nova, para o primeiro "Salvar" não dar conflito com uma versão que a pessoa nunca viu.
  // Ajuste de estado durante o render (sem efeito), só quando a versão de fora avançou.
  if (!sujo && inicial.versao > base.versao) {
    setBase(inicial)
    setRascunho(rascunhoDoEvento(inicial))
  }
  // Mudou algo e não salvou: fechar pergunta antes de perder (A5).
  const liberar = useConfirmarDescarte(sujo)
  useEffect(() => {
    aoMudarSujo?.(sujo)
    // Ao sumir (seção recolhida, rota fechada), nada digitado resta.
    return () => aoMudarSujo?.(false)
  }, [sujo, aoMudarSujo])

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
      mostrarToast({ texto: 'Alterações salvas.' })
      liberar()
      aoSalvar()
    },
    // Sem mudança, com conflito ou com erro, a tela continua: dá para enviar de novo.
    onSettled: trava.soltar,
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
      mostrarToast({ texto: 'Alterações salvas na repetição.' })
      liberar()
      aoSalvar()
    },
    onSettled: trava.soltar,
    onError: async (erro, { dados }) => {
      if (!ehErroDaApi(erro, 'confirmar_recriacao')) return
      const ok = await confirmar({
        titulo: 'Recriar as próximas ocorrências?',
        mensagem: erro.mensagem,
        confirmar: 'Recriar e perder as convocações',
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
    focarPrimeiroErro(novos, refs)
    if (!dados || !escopo) return
    if (!trava.pegar()) return
    if (daSerie) salvarSerie.mutate({ dados, confirmarRecriacao: false })
    else salvarOcorrencia.mutate({ dados, versaoBase })
  }

  const erro = salvarOcorrencia.error ?? salvarSerie.error
  const erroVisivel =
    erro &&
    !ehErroDaApi(erro, 'confirmar_recriacao') &&
    !(conflito && ehErroDaApi(erro, 'conflito'))
  const salvando = salvarOcorrencia.isPending || salvarSerie.isPending

  const resumo = resumoDosErros(Object.keys(erros).length)
  const motivo = conflito
    ? 'Resolva o conflito acima primeiro.'
    : 'Escolha acima se a mudança vale só para esta data ou para a repetição.'

  return (
    <View style={{ gap: RITMO.entreSecoes }}>
      {resumo ? (
        <AvisoDeFalha titulo={resumo} mensagem="As mensagens estão junto de cada campo." />
      ) : null}
      {semMudancas ? (
        <Aviso tipo="info" anunciar>
          {`Nada mudou${daSerie ? ' nos campos que valem para a repetição' : ''}. Altere algum campo antes de salvar.`}
        </Aviso>
      ) : null}
      {erroVisivel ? <AvisoDeFalha erro={erro} titulo="As alterações não foram salvas" /> : null}

      {ehSerie ? (
        <Secao titulo="O que você quer mudar?">
          <CartaoDeVidro opaco intervalo={ESPACO.e16}>
            <ListaDeOpcoes
              rotulo="Alcance da mudança"
              valor={escopo}
              aoMudar={setEscopo}
              opcoes={OPCOES_DE_ESCOPO}
            />
            {daSerie ? (
              <Texto variante="legenda" cor="textoSuave">
                Na repetição valem título, categoria, descrição, local, hora e duração. Vagas,
                visibilidade, prazo e informações úteis são de cada data: para mudá-los, escolha Só
                esta ocorrência.
              </Texto>
            ) : null}
          </CartaoDeVidro>
        </Secao>
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
        refs={refs}
        simples
        naSecao={naSecao}
        visiveis={{ data: !daSerie, inscricoes: !daSerie, prazoEEspera: !daSerie }}
        {...(inicial.serieId
          ? {
              aoAbrirSerie: () =>
                router.push({
                  pathname: '/serie/[serieId]',
                  params: { serieId: inicial.serieId! },
                }),
            }
          : {})}
      />

      <View style={{ gap: ESPACO.e8 }}>
        <Botao
          titulo="Salvar alterações"
          tamanho="grande"
          larguraTotal
          carregando={salvando}
          desabilitado={!escopo || conflito !== null}
          motivo={motivo}
          aoPressionar={() => enviar()}
        />
        <Botao
          titulo="Cancelar"
          variante="secundario"
          tamanho="grande"
          larguraTotal
          aoPressionar={aoCancelar}
        />
      </View>
    </View>
  )
}

function valorLegivel(campo: string, e: DetalheDoEvento, fuso: string): string {
  switch (campo) {
    case 'inicio':
      return `${formatarHora(e.inicio, fuso)} de ${formatarDataLocal(dataDoInstante(e.inicio, fuso))}`
    case 'localId':
      return e.local?.nome ?? 'A definir'
    case 'duracaoMin':
      return `${e.duracaoMin} min`
    case 'capacidade':
      return e.capacidade ? String(e.capacidade) : 'Sem limite'
    case 'listaDeEspera':
      return e.listaDeEspera ? 'Sim' : 'Não'
    case 'inscricaoAte':
      return e.inscricaoAte
        ? formatarDataLocal(dataDoInstante(e.inscricaoAte, fuso))
        : 'Até o início'
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
    <>
      <Aviso tipo="alerta" anunciar titulo="Conflito de edição">
        O encontro mudou enquanto você editava. Compare e escolha o que fica.
      </Aviso>
      <CartaoDeVidro
        sobrancelha="Outra pessoa salvou antes de você"
        opaco
        acoes={
          <View style={{ gap: ESPACO.e8 }}>
            <Botao
              titulo="Salvar a minha versão"
              variante="secundario"
              larguraTotal
              aoPressionar={aoManterMinha}
            />
            <Botao
              titulo="Descartar a minha e usar a atual"
              variante="secundario"
              larguraTotal
              aoPressionar={aoUsarAtual}
            />
          </View>
        }
      >
        {conflito.campos.length ? (
          conflito.campos.map((c) => (
            <Texto key={c} variante="corpo">
              {`${NOME_DO_CAMPO[c] ?? c}: na versão atual está "${valorLegivel(c, conflito.atual, fuso)}". A sua mudança substitui isso.`}
            </Texto>
          ))
        ) : (
          <Texto variante="corpo">
            A outra pessoa mudou campos diferentes dos seus: salvar a sua versão mantém as duas
            mudanças.
          </Texto>
        )}
      </CartaoDeVidro>
    </>
  )
}
