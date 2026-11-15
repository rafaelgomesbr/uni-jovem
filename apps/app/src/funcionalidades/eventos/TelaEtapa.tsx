import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { DetalheDoEvento, Etapa } from '@/servicos/contratoDosEventos'
import { confirmar } from '@/utilidades/confirmar'
import { dataDoInstante, formatarDuracao, formatarHora } from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Linha } from '@/ui/Linha'
import { Segmentos } from '@/ui/Segmentos'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { SeletorDePessoa } from '../comunidade/SeletorDePessoa'
import { useDisponibilidade } from '../escalas/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useEvento, useInvalidarEventos } from './consultas'
import { COR_DO_ESTADO_DA_ATRIBUICAO, NOME_DO_ESTADO_DA_ATRIBUICAO } from './nomes'

/** Valor do parâmetro para a equipe do evento como um todo (sem etapa). */
export const EQUIPE_GERAL = 'geral'

/**
 * Rota `/evento/[eventoId]/etapa/[etapaId]`: editar a etapa e escalar
 * responsáveis e integrantes. Com `etapaId = geral`, a equipe do evento.
 */
export function TelaEtapa() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ eventoId: string; etapaId: string }>()
  const eventoId = parametro(params.eventoId)
  const etapaId = parametro(params.etapaId)
  const evento = useEvento(comunidadeAtiva?.id ?? null, eventoId)

  if (!comunidadeAtiva || !eventoId || !etapaId) {
    return (
      <Tela cabecalhoNativo>
        <SemComunidade oQue="a programação" />
      </Tela>
    )
  }
  if (evento.isPending) {
    return (
      <Tela cabecalhoNativo>
        <Carregando />
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
  const etapa = etapaId === EQUIPE_GERAL ? null : evento.data.etapas.find((e) => e.id === etapaId)
  if (etapa === undefined) {
    return (
      <Tela cabecalhoNativo>
        <EstadoVazio
          icone="etapas"
          titulo="Etapa não encontrada"
          descricao="Ela pode ter sido removida por outra pessoa."
          acao={{ titulo: 'Voltar', aoPressionar: () => router.back() }}
        />
      </Tela>
    )
  }
  return (
    <Tela
      cabecalhoNativo
      titulo={etapa ? etapa.titulo : 'Equipe do evento'}
      descricao={evento.data.titulo}
    >
      {etapa ? (
        <EditarEtapa
          key={`${etapa.id}-${etapa.versao}`}
          etapa={etapa}
          evento={evento.data}
          comunidadeId={comunidadeAtiva.id}
        />
      ) : null}
      <Equipe evento={evento.data} etapa={etapa} comunidadeId={comunidadeAtiva.id} />
    </Tela>
  )
}

function EditarEtapa({
  etapa,
  evento,
  comunidadeId,
}: {
  etapa: Etapa
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const [titulo, setTitulo] = useState(etapa.titulo)
  const [duracao, setDuracao] = useState(String(etapa.duracaoMin))
  const [descricao, setDescricao] = useState(etapa.descricao ?? '')
  const [erros, setErros] = useState<{ titulo?: string; duracao?: string }>({})
  const [salvo, setSalvo] = useState(false)
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}/etapas/${etapa.id}`

  const salvar = useMutation({
    mutationFn: (corpo: object) => api.patch(base, { versao: etapa.versao, ...corpo }),
    onSuccess: async () => {
      setSalvo(true)
      await invalidar(evento.id)
    },
  })
  const remover = useMutation({
    mutationFn: () => api.delete(base),
    onSuccess: async () => {
      await invalidar(evento.id)
      router.back()
    },
  })
  if (!pode('etapa', 'gerenciar')) return null

  async function pedirRemocao() {
    const ok = await confirmar({
      titulo: `Remover a etapa ${etapa.titulo}?`,
      mensagem: 'As etapas seguintes sobem de posição e os horários são recalculados.',
      confirmar: 'Remover etapa',
      destrutivo: true,
    })
    if (ok) remover.mutate()
  }

  return (
    <Cartao titulo="Etapa" icone="etapas">
      <Texto variante="apoio" cor="textoSuave">
        Prevista das {formatarHora(etapa.inicioPrevisto, evento.fuso)} às{' '}
        {formatarHora(etapa.fimPrevisto, evento.fuso)} ({formatarDuracao(etapa.duracaoMin)}).
      </Texto>
      <Campo
        rotulo="Nome da etapa"
        value={titulo}
        onChangeText={(v) => {
          setSalvo(false)
          setTitulo(v)
        }}
        erro={erros.titulo ?? null}
        maxLength={120}
      />
      <Campo
        rotulo="Duração em minutos"
        value={duracao}
        onChangeText={(v) => {
          setSalvo(false)
          setDuracao(v)
        }}
        erro={erros.duracao ?? null}
        keyboardType="number-pad"
        maxLength={3}
      />
      <Campo
        rotulo="Descrição (opcional)"
        value={descricao}
        onChangeText={(v) => {
          setSalvo(false)
          setDescricao(v)
        }}
        multiline
        maxLength={2000}
      />
      {salvo ? (
        <Aviso tipo="sucesso" anunciar>
          Etapa salva.
        </Aviso>
      ) : null}
      {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
      <Botao
        titulo="Salvar etapa"
        carregando={salvar.isPending}
        aoPressionar={() => {
          const minutos = Number(duracao)
          const novos = {
            ...(titulo.trim() ? {} : { titulo: 'Dê um nome à etapa.' }),
            ...(Number.isInteger(minutos) && minutos >= 1 && minutos <= 600
              ? {}
              : { duracao: 'Use um número de 1 a 600 minutos.' }),
          }
          setErros(novos)
          if (Object.keys(novos).length) return
          salvar.mutate({
            titulo: titulo.trim(),
            duracaoMin: minutos,
            descricao: descricao.trim() || null,
          })
        }}
      />
      {remover.error ? <AvisoDeErro erro={remover.error} /> : null}
      <Botao
        titulo="Remover etapa"
        icone="excluir"
        variante="perigo"
        carregando={remover.isPending}
        aoPressionar={() => void pedirRemocao()}
      />
    </Cartao>
  )
}

type Funcao = 'responsável' | 'integrante' | 'outra'

function Equipe({
  evento,
  etapa,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  etapa: Etapa | null
  comunidadeId: string
}) {
  const pode = usePode()
  const invalidar = useInvalidarEventos(comunidadeId)
  const [pessoa, setPessoa] = useState<string | null>(null)
  const [funcao, setFuncao] = useState<Funcao>(etapa ? 'responsável' : 'integrante')
  const [outra, setOutra] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}/atribuicoes`
  const dia = dataDoInstante(evento.inicio, evento.fuso)
  const verDisponibilidade = pode('disponibilidade', 'ler')
  const disponibilidade = useDisponibilidade(comunidadeId, dia, dia, verDisponibilidade)
  const indisponiveis = new Map(
    (disponibilidade.data ?? [])
      .filter((d) => !d.disponivel)
      .map((d) => [d.vinculo_id, d.observacao]),
  )

  const atribuicoes = evento.atribuicoes.filter((a) => a.etapaId === (etapa?.id ?? null))
  const adicionar = useMutation({
    mutationFn: (corpo: object) => api.post(base, corpo),
    onSuccess: () => invalidar(evento.id),
  })
  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`${base}/${id}`),
    onSuccess: () => invalidar(evento.id),
  })
  const atribuir = pode('escala', 'atribuir')

  async function pedirRemocao(id: string, nome: string) {
    const ok = await confirmar({
      titulo: `Tirar ${nome} da escala?`,
      mensagem: 'A pessoa deixa de ver esta escala entre as suas.',
      confirmar: 'Tirar da escala',
      destrutivo: true,
    })
    if (ok) remover.mutate(id)
  }

  return (
    <Cartao titulo={etapa ? 'Quem cuida desta etapa' : 'Equipe do evento'} icone="escalas">
      {atribuicoes.length === 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Ninguém escalado ainda.
        </Texto>
      ) : (
        <View style={{ gap: ESPACO.x1 }}>
          {atribuicoes.map((a) => (
            <View key={a.id} style={{ gap: ESPACO.x1 }}>
              <Linha
                titulo={a.nome}
                descricao={a.funcao}
                extra={
                  <Selo
                    texto={NOME_DO_ESTADO_DA_ATRIBUICAO[a.estado]}
                    cor={COR_DO_ESTADO_DA_ATRIBUICAO[a.estado]}
                  />
                }
              />
              {atribuir ? (
                <Botao
                  titulo="Tirar da escala"
                  variante="discreto"
                  icone="excluir"
                  larguraTotal={false}
                  rotuloAcessivel={`Tirar ${a.nome} (${a.funcao}) da escala`}
                  aoPressionar={() => void pedirRemocao(a.id, a.nome)}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
      {remover.error ? <AvisoDeErro erro={remover.error} /> : null}
      {atribuir ? (
        <View style={{ gap: ESPACO.x3 }}>
          <Texto variante="corpoForte" accessibilityRole="header">
            Escalar alguém
          </Texto>
          <Segmentos
            rotulo="Função"
            valor={funcao}
            aoMudar={setFuncao}
            segmentos={[
              { valor: 'responsável', rotulo: 'Responsável' },
              { valor: 'integrante', rotulo: 'Integrante' },
              { valor: 'outra', rotulo: 'Outra função' },
            ]}
          />
          {funcao === 'outra' ? (
            <Campo
              rotulo="Nome da função"
              value={outra}
              onChangeText={setOutra}
              exemplo="Som, recepção, fotografia"
              maxLength={60}
            />
          ) : null}
          <SeletorDePessoa
            comunidadeId={comunidadeId}
            rotulo="Pessoa"
            valor={pessoa}
            aoMudar={setPessoa}
            observacao={(p) =>
              indisponiveis.has(p.vinculoId)
                ? `Avisou que não pode neste dia${indisponiveis.get(p.vinculoId) ? `: ${indisponiveis.get(p.vinculoId)}` : ''}`
                : undefined
            }
          />
          {erro ? <AvisoDeErro mensagem={erro} titulo="Falta escolher" /> : null}
          {adicionar.error ? <AvisoDeErro erro={adicionar.error} /> : null}
          <Botao
            titulo="Escalar"
            icone="convidar"
            carregando={adicionar.isPending}
            aoPressionar={() => {
              const nomeDaFuncao = funcao === 'outra' ? outra.trim() : funcao
              if (!pessoa) return setErro('Escolha a pessoa.')
              if (nomeDaFuncao.length < 2) return setErro('Diga qual é a função.')
              setErro(null)
              adicionar.mutate(
                { vinculoId: pessoa, etapaId: etapa?.id ?? null, funcao: nomeDaFuncao },
                { onSuccess: () => setPessoa(null) },
              )
            }}
          />
        </View>
      ) : null}
    </Cartao>
  )
}
