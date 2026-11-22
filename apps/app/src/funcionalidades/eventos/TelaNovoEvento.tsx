import { useMutation, useQueryClient } from '@tanstack/react-query'
import { duracaoTotal } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Visibilidade } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { useConfirmarDescarte, useTravaDeEnvio } from '@/ui/navegacao'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { confirmar } from '@/utilidades/confirmar'
import {
  dataValidaOuNula,
  formatarDuracao,
  hojeNoFuso,
  lerDataDigitada,
  type DataLocal,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import {
  CamposDoEvento,
  focarPrimeiroErro,
  resumoDosErros,
  useRefsDosCampos,
} from './CamposDoEvento'
import { naComunidade, useInvalidarEventos, useModelos } from './consultas'
import { EditorDeRegra } from './EditorDeRegra'
import { dataJaPassou } from './regras'
import {
  LOCAL_NOVO,
  proximoSabado,
  rascunhoVazio,
  regraDoRascunho,
  regraVazia,
  validarRascunho,
  type ErrosDoRascunho,
  type EventoValidado,
  type RascunhoDoEvento,
} from './formulario'

/** Parâmetro da folha "Novo encontro" para escolher um modelo antes. */
const ESCOLHER_MODELO = 'escolher'

/**
 * Sem modelo, categoria e duração são obrigatórias, mas ficam em "Mais opções" (D69: o formulário
 * curto é título, data, hora e local). Os padrões deixam o caminho curto de pé; o modelo escolhido
 * troca os dois pelos dele.
 */
const CATEGORIA_PADRAO = 'Encontro'
const DURACAO_PADRAO = '60'

/** Rota `/evento/novo?modelo=...`: criar evento avulso ou série, do zero ou de modelo. */
export function TelaNovoEvento() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const params = useLocalSearchParams<{ modelo?: string; data?: string }>()
  const modelo = parametro(params.modelo)
  // "Nova programação neste dia" (Agenda): a data já vem escolhida.
  const data = dataValidaOuNula(parametro(params.data))
  if (!comunidadeAtiva) {
    return (
      <Tela pilha modal>
        <SemComunidade oQue="os encontros" />
      </Tela>
    )
  }
  if (!pode('evento', 'criar')) {
    return (
      <Tela pilha modal titulo="Novo encontro">
        <Aviso tipo="info" titulo="Só a organização cria encontros">
          Fale com quem organiza a sua comunidade para montar um encontro.
        </Aviso>
      </Tela>
    )
  }
  return (
    <NovoEvento comunidadeId={comunidadeAtiva.id} modeloInicial={modelo ?? ''} dataInicial={data} />
  )
}

interface Corpo {
  titulo: string
  categoria: string
  descricao: string | null
  localId: string | null
  visibilidade: Visibilidade
  capacidade: number | null
  informacoesUteis: string | null
  duracaoMin?: number
  modelo?: string
}

function NovoEvento({
  comunidadeId,
  modeloInicial,
  dataInicial,
}: {
  comunidadeId: string
  modeloInicial: string
  dataInicial: DataLocal | null
}) {
  const pode = usePode()
  const fuso = useFusoDaComunidade()
  const invalidar = useInvalidarEventos(comunidadeId)
  const consultas = useQueryClient()
  const refs = useRefsDosCampos()
  const escolherModelo = modeloInicial === ESCOLHER_MODELO && pode('modelo', 'ler')
  const modelos = useModelos(comunidadeId, pode('modelo', 'ler'))
  const [modelo, setModelo] = useState(modeloInicial === ESCOLHER_MODELO ? '' : modeloInicial)
  const [rascunhoInicial] = useState<RascunhoDoEvento>(() => {
    const r = rascunhoVazio()
    if (modeloInicial !== 'sabado_padrao') {
      return {
        ...r,
        data: dataInicial ?? '',
        categoria: CATEGORIA_PADRAO,
        duracao: DURACAO_PADRAO,
      }
    }
    // Sábado padrão: já sugere o próximo sábado às 16h (tudo editável).
    return {
      ...r,
      titulo: 'Sábado',
      categoria: 'Programação de sábado',
      data: dataInicial ?? proximoSabado(hojeNoFuso(fuso)),
      hora: '16:00',
    }
  })
  const [rascunho, setRascunho] = useState<RascunhoDoEvento>(rascunhoInicial)
  const [regra, setRegra] = useState(regraVazia)
  const trava = useTravaDeEnvio()
  // Uma programação inteira montada e um "Fechar" por engano: pergunta antes de perder (A5).
  const liberar = useConfirmarDescarte(
    JSON.stringify(rascunho) !== JSON.stringify(rascunhoInicial) ||
      JSON.stringify(regra) !== JSON.stringify(regraVazia()),
  )
  const [erros, setErros] = useState<ErrosDoRascunho>({})
  const [erroDoFim, setErroDoFim] = useState<string | null>(null)

  const ehSerie = regra.repeticao !== 'nao'
  const mudar = <K extends keyof RascunhoDoEvento>(campo: K, valor: RascunhoDoEvento[K]) =>
    setRascunho((r) => ({ ...r, [campo]: valor }))

  const embutidos = modelos.data?.embutidos ?? []
  const daComunidade = modelos.data?.daComunidade ?? []
  const etapasDoModelo =
    embutidos.find((m) => m.chave === modelo)?.etapas ??
    daComunidade.find((m) => m.id === modelo)?.etapas ??
    null

  function trocarModelo(valor: string) {
    setModelo(valor)
    const m =
      embutidos.find((x) => x.chave === valor) ?? daComunidade.find((x) => x.id === valor) ?? null
    setRascunho((r) =>
      m
        ? {
            ...r,
            titulo: r.titulo || m.nome,
            categoria: !r.categoria || r.categoria === CATEGORIA_PADRAO ? m.categoria : r.categoria,
            // Com modelo, a duração em branco é a soma das etapas dele.
            duracao: r.duracao === DURACAO_PADRAO ? '' : r.duracao,
          }
        : {
            ...r,
            categoria: r.categoria || CATEGORIA_PADRAO,
            duracao: r.duracao || DURACAO_PADRAO,
          },
    )
  }

  const salvar = useMutation({
    mutationFn: async ({ dados, publicar }: { dados: EventoValidado; publicar: boolean }) => {
      const base = naComunidade(comunidadeId)
      let localId = dados.local
      if (localId === LOCAL_NOVO) {
        const l = rascunho.novoLocal
        const novo = await api.post<{ id: string }>(`${base}/locais`, {
          nome: l.nome.trim(),
          tipo: l.tipo,
          endereco: l.endereco.trim() || null,
          referencia: l.referencia.trim() || null,
        })
        localId = novo.id
        // Se o passo seguinte falhar, tentar de novo não cadastra o local duas vezes.
        setRascunho((r) => ({ ...r, local: novo.id }))
        await consultas.invalidateQueries({ queryKey: CHAVES.locais(comunidadeId) })
      }
      const corpo: Corpo = {
        titulo: dados.titulo,
        categoria: dados.categoria,
        descricao: dados.descricao,
        localId,
        visibilidade: dados.visibilidade,
        capacidade: dados.capacidade,
        informacoesUteis: dados.informacoesUteis,
        ...(dados.duracaoMin !== undefined ? { duracaoMin: dados.duracaoMin } : {}),
        ...(modelo ? { modelo } : {}),
      }
      const { regra: regraDaSerie } = regraDoRascunho(regra, dados.data)
      if (regraDaSerie) {
        const fim = regra.fim.trim() ? lerDataDigitada(regra.fim) : null
        const r = await api.post<{ id: string; ocorrencias: number }>(`${base}/series`, {
          ...corpo,
          regra: regraDaSerie,
          horaLocal: dados.hora,
          inicioEm: dados.data,
          fimEm: fim,
          publicar,
        })
        return { tipo: 'serie' as const, id: r.id }
      }
      const r = await api.post<{ id: string }>(`${base}/eventos`, {
        ...corpo,
        inicio: dados.inicio,
        listaDeEspera: dados.listaDeEspera,
        inscricaoAte: dados.inscricaoAte,
      })
      if (publicar) await api.post(`${base}/eventos/${r.id}/status`, { status: 'publicado' })
      return { tipo: 'evento' as const, id: r.id }
    },
    onSuccess: async (r) => {
      await invalidar()
      liberar()
      if (r.tipo === 'serie')
        router.replace({ pathname: '/serie/[serieId]', params: { serieId: r.id } })
      else router.replace({ pathname: '/evento/[eventoId]', params: { eventoId: r.id } })
    },
    onError: trava.soltar,
  })

  async function enviar(publicar: boolean) {
    const { erros: novos, dados } = validarRascunho(rascunho, {
      fuso,
      duracaoOpcional: !!modelo,
    })
    const fimInvalido = regra.repeticao !== 'nao' && regra.fim.trim() && !lerDataDigitada(regra.fim)
    setErroDoFim(fimInvalido ? 'Escolha o dia em que a repetição acaba.' : null)
    setErros(novos)
    focarPrimeiroErro(novos, refs)
    if (!dados || fimInvalido) return
    if (publicar && dataJaPassou(dados.inicio)) {
      const ok = await confirmar({
        titulo: 'Esta data já passou',
        mensagem:
          'O início marcado é anterior a agora: confira o dia e o ano. Publicado, o encontro aparece para todos da comunidade.',
        confirmar: 'Publicar mesmo assim',
      })
      if (!ok) return
    }
    // Uma programação por envio: o segundo toque, antes da resposta, não cria outra.
    if (!trava.pegar()) return
    salvar.mutate({ dados, publicar })
  }

  const primeira = lerDataDigitada(rascunho.data)
  const resumo = resumoDosErros(Object.keys(erros).length + (erroDoFim ? 1 : 0))

  return (
    <Tela
      pilha
      modal
      titulo="Novo encontro"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Salvar rascunho"
            variante="secundario"
            tamanho="grande"
            dica={
              ehSerie
                ? 'Cria a repetição com as datas em rascunho. Só a organização vê.'
                : 'Só a organização vê rascunhos.'
            }
            carregando={salvar.isPending && !salvar.variables?.publicar}
            desabilitado={salvar.isPending}
            aoPressionar={() => void enviar(false)}
          />
          <Botao
            titulo="Publicar"
            tamanho="grande"
            dica={
              ehSerie
                ? 'Cria a repetição e publica as datas. Todos da comunidade passam a ver.'
                : 'Todos da comunidade passam a ver.'
            }
            carregando={salvar.isPending && !!salvar.variables?.publicar}
            desabilitado={salvar.isPending}
            aoPressionar={() => void enviar(true)}
          />
        </BarraDeAcao>
      }
    >
      {resumo ? (
        <AvisoDeFalha titulo={resumo} mensagem="As mensagens estão junto de cada campo." />
      ) : null}
      {salvar.error ? <AvisoDeFalha erro={salvar.error} titulo="O encontro não foi salvo" /> : null}

      {escolherModelo ? (
        <Secao titulo="Começar de">
          {modelos.isPending ? (
            <Esqueleto rotulo="Carregando os modelos">
              <CartaoDeEsqueleto />
            </Esqueleto>
          ) : modelos.error ? (
            <AvisoDeFalha
              erro={modelos.error}
              titulo="Os modelos não carregaram"
              aoTentarDeNovo={() => void modelos.refetch()}
            />
          ) : (
            <CartaoDeVidro opaco>
              <ListaDeOpcoes
                rotulo="Modelo"
                valor={modelo}
                aoMudar={trocarModelo}
                opcoes={[
                  { valor: '', rotulo: 'Em branco', descricao: 'Você monta as etapas depois.' },
                  ...embutidos.map((m) => ({
                    valor: m.chave,
                    rotulo: m.nome,
                    descricao: `${m.etapas.length} etapas, ${formatarDuracao(duracaoTotal(m.etapas))}.`,
                  })),
                  ...daComunidade.map((m) => ({
                    valor: m.id,
                    rotulo: m.nome,
                    descricao: `Da comunidade. ${m.etapas.length} etapas, ${formatarDuracao(duracaoTotal(m.etapas))}.`,
                  })),
                ]}
              />
            </CartaoDeVidro>
          )}
        </Secao>
      ) : null}

      <CamposDoEvento
        comunidadeId={comunidadeId}
        rascunho={rascunho}
        mudar={mudar}
        erros={erros}
        refs={refs}
        simples
        abrirOpcoes={!!erroDoFim}
        visiveis={{ data: true, inscricoes: true, prazoEEspera: !ehSerie }}
        extraNasOpcoes={
          <>
            <Secao titulo="Repetição">
              <CartaoDeVidro opaco intervalo={ESPACO.e16}>
                <EditorDeRegra
                  regra={regra}
                  aoMudar={setRegra}
                  primeira={primeira}
                  hora={rascunho.hora || null}
                  erroDoFim={erroDoFim}
                />
              </CartaoDeVidro>
            </Secao>
            {ehSerie ? (
              <Aviso tipo="info" titulo="Encontros que se repetem">
                Cada data vira um encontro próprio, que você pode editar sozinho depois. Prazo e
                lista de espera valem por data e são ajustados em cada uma.
              </Aviso>
            ) : null}
          </>
        }
        {...(etapasDoModelo
          ? {
              ajudaDaDuracao: `Em branco, usa a soma das etapas do modelo (${formatarDuracao(duracaoTotal(etapasDoModelo))}).`,
            }
          : {})}
      />
    </Tela>
  )
}
