import { useMutation, useQueryClient } from '@tanstack/react-query'
import { duracaoTotal } from '@uj/dominio'
import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { AccessibilityInfo, View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { formatarDuracao, formatarHora } from '@/utilidades/datas'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { BotoesDeOrdem, mover } from '@/ui/BotoesDeOrdem'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Expansivel } from '@/ui/Expansivel'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { usePode } from '../comunidade/permissoes'
import { naComunidade, useInvalidarEventos } from './consultas'
import { reordenarEtapas } from './regras'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
}

/**
 * Programação do evento: etapas com hora prevista, duração e quem cuida de
 * cada uma. Reordenar é por botões Subir e Descer (sem depender de arrastar);
 * a tela responde na hora e o servidor confirma.
 */
export function SecaoEtapas({ evento, comunidadeId }: Props) {
  const { cores } = useTema()
  const pode = usePode()
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const gerenciar = pode('etapa', 'gerenciar')
  const chave = CHAVES.evento(comunidadeId, evento.id)
  const base = `${naComunidade(comunidadeId)}/eventos/${evento.id}`

  const reordenar = useMutation({
    mutationFn: (ids: string[]) => api.put(`${base}/etapas/ordem`, { ids }),
    onMutate: async (ids) => {
      await consultas.cancelQueries({ queryKey: chave })
      const anterior = consultas.getQueryData<DetalheDoEvento>(chave)
      if (anterior) consultas.setQueryData(chave, reordenarEtapas(anterior, ids))
      return { anterior }
    },
    onError: (_erro, _ids, contexto) => {
      if (contexto?.anterior) consultas.setQueryData(chave, contexto.anterior)
    },
    onSettled: () => invalidar(evento.id),
  })

  function moverEtapa(de: number, para: number) {
    const etapa = evento.etapas[de]
    if (!etapa) return
    const ids = mover(
      evento.etapas.map((e) => e.id),
      de,
      para,
    )
    reordenar.mutate(ids)
    AccessibilityInfo.announceForAccessibility(
      `${etapa.titulo} agora é a etapa ${para + 1} de ${ids.length}.`,
    )
  }

  const total = duracaoTotal(evento.etapas)
  const pessoasDaEtapa = (etapaId: string) =>
    evento.atribuicoes.filter((a) => a.etapaId === etapaId)

  return (
    <Cartao titulo="Programação" icone="etapas">
      {evento.etapas.length === 0 ? (
        <EstadoVazio
          icone="etapas"
          titulo="Nenhuma etapa ainda"
          descricao={
            gerenciar
              ? 'Monte a programação com as etapas do encontro, cada uma com a sua duração.'
              : 'A organização ainda não montou a programação deste evento.'
          }
        />
      ) : (
        <View style={{ gap: ESPACO.x2 }}>
          {evento.etapas.map((etapa, i) => {
            const pessoas = pessoasDaEtapa(etapa.id)
            const horario = `${formatarHora(etapa.inicioPrevisto, evento.fuso)} a ${formatarHora(etapa.fimPrevisto, evento.fuso)}`
            const quem = pessoas.map((p) => `${p.nome} (${p.funcao})`).join(', ')
            return (
              <View
                key={etapa.id}
                style={{
                  gap: ESPACO.x2,
                  padding: ESPACO.x3,
                  borderRadius: RAIO.medio,
                  borderWidth: 1,
                  borderColor: cores.borda,
                }}
              >
                <View
                  accessible
                  accessibilityLabel={`Etapa ${i + 1} de ${evento.etapas.length}: ${etapa.titulo}. Das ${horario}, ${formatarDuracao(etapa.duracaoMin)}.${quem ? ` Com ${quem}.` : ' Ninguém escalado.'}`}
                  style={{ gap: 2 }}
                >
                  <Texto variante="rotulo" cor="textoSuave">
                    {i + 1}. {horario} · {formatarDuracao(etapa.duracaoMin)}
                  </Texto>
                  <Texto variante="corpoForte">{etapa.titulo}</Texto>
                  {etapa.descricao ? (
                    <Texto variante="apoio" cor="textoSuave">
                      {etapa.descricao}
                    </Texto>
                  ) : null}
                  <Texto variante="apoio" cor="textoSuave">
                    {quem ? `Com: ${quem}` : 'Ninguém escalado'}
                  </Texto>
                </View>
                {gerenciar ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: ESPACO.x2,
                    }}
                  >
                    <BotoesDeOrdem
                      nome={etapa.titulo}
                      posicao={i}
                      total={evento.etapas.length}
                      aoSubir={() => moverEtapa(i, i - 1)}
                      aoDescer={() => moverEtapa(i, i + 1)}
                    />
                    <Botao
                      titulo="Editar e escalar"
                      icone="editar"
                      variante="secundario"
                      larguraTotal={false}
                      rotuloAcessivel={`Editar e escalar pessoas para ${etapa.titulo}`}
                      aoPressionar={() =>
                        router.push({
                          pathname: '/evento/[eventoId]/etapa/[etapaId]',
                          params: { eventoId: evento.id, etapaId: etapa.id },
                        })
                      }
                    />
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      )}
      {reordenar.error ? <AvisoDeErro erro={reordenar.error} /> : null}
      {evento.etapas.length > 0 ? (
        <Texto variante="apoio" cor="textoSuave">
          Total das etapas: {formatarDuracao(total)}. Duração prevista do evento:{' '}
          {formatarDuracao(evento.duracaoMin)}.
        </Texto>
      ) : null}
      {evento.etapas.length > 0 && total > evento.duracaoMin ? (
        <Aviso tipo="alerta" titulo="Programação maior que o evento">
          As etapas somam {formatarDuracao(total)}, mais que a duração prevista. Ajuste as etapas ou
          a duração do evento.
        </Aviso>
      ) : null}
      {gerenciar ? <NovaEtapa base={base} aoCriar={() => invalidar(evento.id)} /> : null}
    </Cartao>
  )
}

function NovaEtapa({ base, aoCriar }: { base: string; aoCriar: () => Promise<void> }) {
  const [titulo, setTitulo] = useState('')
  const [duracao, setDuracao] = useState('10')
  const [erros, setErros] = useState<{ titulo?: string; duracao?: string }>({})
  const criar = useMutation({
    mutationFn: (corpo: { titulo: string; duracaoMin: number }) =>
      api.post(`${base}/etapas`, corpo),
    onSuccess: aoCriar,
  })

  return (
    <Expansivel titulo="Adicionar etapa">
      {(fechar) => (
        <>
          <Campo
            rotulo="Nome da etapa"
            value={titulo}
            onChangeText={setTitulo}
            erro={erros.titulo ?? null}
            exemplo="Louvor"
            maxLength={120}
          />
          <Campo
            rotulo="Duração em minutos"
            value={duracao}
            onChangeText={setDuracao}
            erro={erros.duracao ?? null}
            keyboardType="number-pad"
            maxLength={3}
          />
          {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
          <Botao
            titulo="Salvar etapa"
            carregando={criar.isPending}
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
              criar.mutate(
                { titulo: titulo.trim(), duracaoMin: minutos },
                {
                  onSuccess: () => {
                    setTitulo('')
                    setDuracao('10')
                    fechar()
                  },
                },
              )
            }}
          />
        </>
      )}
    </Expansivel>
  )
}
