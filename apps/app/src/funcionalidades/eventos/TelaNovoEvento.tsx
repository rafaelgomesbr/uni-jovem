import { useMutation, useQueryClient } from '@tanstack/react-query'
import { duracaoTotal } from '@uj/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Visibilidade } from '@/servicos/contratoDosEventos'
import { formatarDataLocal, formatarDuracao, hojeNoFuso, lerDataDigitada } from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Tela } from '@/ui/Tela'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { CamposDoEvento } from './CamposDoEvento'
import { naComunidade, useInvalidarEventos, useModelos } from './consultas'
import { EditorDeRegra } from './EditorDeRegra'
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

/** Rota `/evento/novo?modelo=...`: criar evento avulso ou série, do zero ou de modelo. */
export function TelaNovoEvento() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const modelo = parametro(useLocalSearchParams<{ modelo?: string }>().modelo)
  if (!comunidadeAtiva) {
    return (
      <Tela cabecalhoNativo>
        <SemComunidade oQue="as programações" />
      </Tela>
    )
  }
  if (!pode('evento', 'criar')) {
    return (
      <Tela cabecalhoNativo titulo="Nova programação">
        <Aviso tipo="info" titulo="Só a organização cria programações">
          Fale com quem organiza a sua comunidade para montar um encontro.
        </Aviso>
      </Tela>
    )
  }
  return <NovoEvento comunidadeId={comunidadeAtiva.id} modeloInicial={modelo ?? ''} />
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
}: {
  comunidadeId: string
  modeloInicial: string
}) {
  const pode = usePode()
  const fuso = useFusoDaComunidade()
  const invalidar = useInvalidarEventos(comunidadeId)
  const consultas = useQueryClient()
  const modelos = useModelos(comunidadeId, pode('modelo', 'ler'))
  const [modelo, setModelo] = useState(modeloInicial)
  const [rascunho, setRascunho] = useState<RascunhoDoEvento>(() => {
    const r = rascunhoVazio()
    if (modeloInicial !== 'sabado_padrao') return r
    // Sábado padrão: já sugere o próximo sábado às 16h (tudo editável).
    return {
      ...r,
      titulo: 'Sábado',
      categoria: 'Programação de sábado',
      data: formatarDataLocal(proximoSabado(hojeNoFuso(fuso))),
      hora: '16:00',
    }
  })
  const [regra, setRegra] = useState(regraVazia)
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

  function escolherModelo(valor: string) {
    setModelo(valor)
    const m =
      embutidos.find((x) => x.chave === valor) ?? daComunidade.find((x) => x.id === valor) ?? null
    if (!m) return
    setRascunho((r) => ({
      ...r,
      titulo: r.titulo || m.nome,
      categoria: r.categoria || m.categoria,
    }))
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
      if (r.tipo === 'serie')
        router.replace({ pathname: '/serie/[serieId]', params: { serieId: r.id } })
      else router.replace({ pathname: '/evento/[eventoId]', params: { eventoId: r.id } })
    },
  })

  function enviar(publicar: boolean) {
    const { erros: novos, dados } = validarRascunho(rascunho, {
      fuso,
      duracaoOpcional: !!modelo,
    })
    const fimInvalido = regra.repeticao !== 'nao' && regra.fim.trim() && !lerDataDigitada(regra.fim)
    setErroDoFim(fimInvalido ? 'Use uma data real, no formato DD/MM/AAAA.' : null)
    setErros(novos)
    if (!dados || fimInvalido) return
    salvar.mutate({ dados, publicar })
  }

  const primeira = lerDataDigitada(rascunho.data)
  const temErro = Object.keys(erros).length > 0 || !!erroDoFim

  return (
    <Tela cabecalhoNativo titulo="Nova programação">
      {pode('modelo', 'ler') ? (
        <Cartao titulo="Começar de" icone="modelo">
          {modelos.isPending ? (
            <Carregando texto="Carregando os modelos" />
          ) : modelos.error ? (
            <AvisoDeErro erro={modelos.error} aoTentarDeNovo={() => void modelos.refetch()} />
          ) : (
            <GrupoDeOpcoes
              rotulo="Modelo"
              valor={modelo}
              aoMudar={escolherModelo}
              opcoes={[
                { valor: '', rotulo: 'Em branco', descricao: 'Você monta as etapas depois.' },
                ...embutidos.map((m) => ({
                  valor: m.chave,
                  rotulo: m.nome,
                  descricao: `${m.descricao} ${m.etapas.length} etapas, ${formatarDuracao(duracaoTotal(m.etapas))}.`,
                })),
                ...daComunidade.map((m) => ({
                  valor: m.id,
                  rotulo: m.nome,
                  descricao: `Modelo da comunidade. ${m.etapas.length} etapas, ${formatarDuracao(duracaoTotal(m.etapas))}.`,
                })),
              ]}
            />
          )}
        </Cartao>
      ) : null}

      <CamposDoEvento
        comunidadeId={comunidadeId}
        rascunho={rascunho}
        mudar={mudar}
        erros={erros}
        visiveis={{ data: true, inscricoes: true, prazoEEspera: !ehSerie }}
        {...(etapasDoModelo
          ? {
              ajudaDaDuracao: `Em branco, usa a soma das etapas do modelo (${formatarDuracao(duracaoTotal(etapasDoModelo))}).`,
            }
          : {})}
      />

      <Cartao titulo="Repetir" icone="repetir">
        <EditorDeRegra
          regra={regra}
          aoMudar={setRegra}
          primeira={primeira}
          hora={rascunho.hora || null}
          erroDoFim={erroDoFim}
        />
        {ehSerie ? (
          <Aviso tipo="info" titulo="Série de encontros">
            Cada data vira um evento próprio, que você pode editar sozinho depois. Prazo e lista de
            espera valem por ocorrência e são ajustados em cada uma.
          </Aviso>
        ) : null}
      </Cartao>

      {temErro ? (
        <AvisoDeErro
          titulo="Confira os campos"
          mensagem="Alguns campos precisam de ajuste. As mensagens estão ao lado de cada um."
        />
      ) : null}
      {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
      <Botao
        titulo={ehSerie ? 'Criar série como rascunho' : 'Salvar como rascunho'}
        variante="secundario"
        dica="Só a organização vê rascunhos."
        carregando={salvar.isPending && !salvar.variables?.publicar}
        desabilitado={salvar.isPending}
        aoPressionar={() => enviar(false)}
      />
      <Botao
        titulo={ehSerie ? 'Criar série e publicar' : 'Salvar e publicar'}
        icone="publicar"
        dica="Todos da comunidade passam a ver."
        carregando={salvar.isPending && !!salvar.variables?.publicar}
        desabilitado={salvar.isPending}
        aoPressionar={() => enviar(true)}
      />
    </Tela>
  )
}
