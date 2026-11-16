import { useMutation, useQueryClient } from '@tanstack/react-query'
import { duracaoTotal } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { DetalheDoEvento, Etapa } from '@/servicos/contratoDosEventos'
import { anunciar } from '@/ui/anunciar'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { BotoesDeOrdem, mover } from '@/ui/BotoesDeOrdem'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela } from '@/ui/FolhaNaTela'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { formatarDuracao, formatarHora } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import { naComunidade, useInvalidarEventos } from './consultas'
import { reordenarEtapas } from './regras'

interface Props {
  evento: DetalheDoEvento
  comunidadeId: string
  /** Estado vazio de quem não monta etapas: volta para a visão geral. */
  aoVerVisaoGeral: () => void
}

/**
 * Etapas (3.4.2, item 6, e quadro 03a): cartão lista com a hora prevista em
 * coluna, o título e "15 min · Com Ana (violão)"; no rodapé, o total e, para
 * a organização, "Editar etapas". Editar troca as linhas por Subir e Descer
 * (nunca só arrastar) e mostra "Adicionar etapa"; a tela responde na hora e o
 * servidor confirma. Fora da edição, tocar numa etapa abre a etapa e a equipe.
 */
export function SecaoEtapas({ evento, comunidadeId, aoVerVisaoGeral }: Props) {
  const pode = usePode()
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const gerenciar = pode('etapa', 'gerenciar')
  const [editando, setEditando] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
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
    anunciar(`${etapa.titulo} agora é a etapa ${para + 1} de ${ids.length}.`)
  }

  const total = duracaoTotal(evento.etapas)
  const passou = evento.etapas.length > 0 && total > evento.duracaoMin
  const folha = gerenciar ? (
    <NovaEtapa
      aberta={adicionando}
      aoFechar={() => setAdicionando(false)}
      base={base}
      aoCriar={() => invalidar(evento.id)}
    />
  ) : null

  if (evento.etapas.length === 0) {
    return (
      <>
        <EstadoVazio
          icone="etapas"
          titulo="Nenhuma etapa ainda"
          descricao={
            gerenciar
              ? 'Monte o roteiro com as etapas do encontro, cada uma com a sua duração.'
              : 'A organização ainda não montou o roteiro deste encontro.'
          }
          acao={
            gerenciar
              ? {
                  titulo: 'Adicionar etapa',
                  icone: 'adicionar',
                  aoPressionar: () => setAdicionando(true),
                }
              : {
                  titulo: 'Ver a visão geral',
                  variante: 'secundario',
                  aoPressionar: aoVerVisaoGeral,
                }
          }
        />
        {folha}
      </>
    )
  }

  return (
    <>
      {reordenar.error ? <AvisoDeFalha erro={reordenar.error} titulo="A ordem não mudou" /> : null}
      <CartaoDeVidro
        lista
        acoes={
          <View style={{ alignItems: 'flex-start' }}>
            <Texto variante="meta" cor="textoSuave" tabular>
              {`Total ${formatarDuracao(total)} de ${formatarDuracao(evento.duracaoMin)} previstos`}
            </Texto>
            {gerenciar ? (
              editando ? (
                <View style={{ flexDirection: 'row', alignSelf: 'stretch', gap: ESPACO.e16 }}>
                  <Botao
                    titulo="Adicionar etapa"
                    icone="adicionar"
                    variante="terciario"
                    alinhado
                    aoPressionar={() => setAdicionando(true)}
                  />
                  <View style={{ flex: 1 }} />
                  <Botao
                    titulo="Concluir"
                    variante="terciario"
                    alinhado
                    rotuloAcessivel="Concluir a edição das etapas"
                    aoPressionar={() => setEditando(false)}
                  />
                </View>
              ) : (
                <Botao
                  titulo="Editar etapas"
                  variante="terciario"
                  alinhado
                  dica="Mostra os botões Subir e Descer e o Adicionar etapa."
                  aoPressionar={() => setEditando(true)}
                />
              )
            ) : null}
          </View>
        }
      >
        <Lista>
          {evento.etapas.map((etapa, i) => (
            <LinhaDaEtapa
              key={etapa.id}
              etapa={etapa}
              evento={evento}
              posicao={i}
              editando={editando}
              abrir={
                gerenciar
                  ? () =>
                      router.push({
                        pathname: '/evento/[eventoId]/etapa/[etapaId]',
                        params: { eventoId: evento.id, etapaId: etapa.id },
                      })
                  : null
              }
              aoMover={moverEtapa}
            />
          ))}
        </Lista>
      </CartaoDeVidro>
      {passou ? (
        <Aviso tipo="alerta" titulo="As etapas passam da duração">
          {`Somam ${formatarDuracao(total)}, mais que os ${formatarDuracao(evento.duracaoMin)} previstos. Ajuste as etapas ou a duração do evento.`}
        </Aviso>
      ) : null}
      {folha}
    </>
  )
}

function LinhaDaEtapa({
  etapa,
  evento,
  posicao,
  editando,
  abrir,
  aoMover,
}: {
  etapa: Etapa
  evento: DetalheDoEvento
  posicao: number
  editando: boolean
  abrir: (() => void) | null
  aoMover: (de: number, para: number) => void
}) {
  const quantas = evento.etapas.length
  const pessoas = evento.atribuicoes.filter((a) => a.etapaId === etapa.id)
  const horario = `${formatarHora(etapa.inicioPrevisto, evento.fuso)} a ${formatarHora(etapa.fimPrevisto, evento.fuso)}`
  const quem = pessoas.map((p) => `${p.nome} (${p.funcao})`).join(', ')
  const nomes = pessoas.map((p) => p.nome.split(' ')[0]).join(', ')
  const falado = `Etapa ${posicao + 1} de ${quantas}: ${etapa.titulo}. Das ${horario}, ${formatarDuracao(etapa.duracaoMin)}.${quem ? ` Com ${quem}.` : ' Ninguém escalado.'}`
  // Fora da edição, a etapa é lida de uma vez (com toque ou sem), com a hora e quem cuida.
  return (
    <LinhaDeLista
      hora={formatarHora(etapa.inicioPrevisto, evento.fuso)}
      titulo={etapa.titulo}
      descricao={`${formatarDuracao(etapa.duracaoMin)} · ${nomes ? `Com ${nomes}` : 'Ninguém escalado'}`}
      {...(editando
        ? {
            extra: (
              <BotoesDeOrdem
                nome={etapa.titulo}
                posicao={posicao}
                total={quantas}
                aoSubir={() => aoMover(posicao, posicao - 1)}
                aoDescer={() => aoMover(posicao, posicao + 1)}
              />
            ),
          }
        : abrir
          ? {
              aoPressionar: abrir,
              rotuloAcessivel: falado,
              dica: 'Abre a etapa para editar e escalar.',
            }
          : { rotuloAcessivel: falado })}
    />
  )
}

/** "Adicionar etapa" numa folha: Nome e Duração lado a lado (2 para 1) e "Salvar etapa". */
function NovaEtapa({
  aberta,
  aoFechar,
  base,
  aoCriar,
}: {
  aberta: boolean
  aoFechar: () => void
  base: string
  aoCriar: () => Promise<void>
}) {
  const [titulo, setTitulo] = useState('')
  const [duracao, setDuracao] = useState('10')
  const [erros, setErros] = useState<{ titulo?: string; duracao?: string }>({})
  const criar = useMutation({
    mutationFn: (corpo: { titulo: string; duracaoMin: number }) =>
      api.post(`${base}/etapas`, corpo),
    onSuccess: aoCriar,
  })

  function salvar() {
    const minutos = Number(duracao)
    const novos = {
      ...(titulo.trim() ? {} : { titulo: 'Dê um nome à etapa.' }),
      ...(Number.isInteger(minutos) && minutos >= 1 && minutos <= 600
        ? {}
        : { duracao: 'Use de 1 a 600 minutos.' }),
    }
    setErros(novos)
    if (Object.keys(novos).length) return
    criar.mutate(
      { titulo: titulo.trim(), duracaoMin: minutos },
      {
        onSuccess: () => {
          mostrarToast({ texto: `Etapa ${titulo.trim()} adicionada.` })
          setTitulo('')
          setDuracao('10')
          aoFechar()
        },
      },
    )
  }

  const algumErro = !!(erros.titulo || erros.duracao)
  return (
    <FolhaNaTela aberta={aberta} titulo="Adicionar etapa" aoFechar={aoFechar}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
        <View style={{ flex: 2 }}>
          <Campo
            rotulo="Nome da etapa"
            value={titulo}
            onChangeText={setTitulo}
            erro={erros.titulo ?? null}
            exemplo="Louvor"
            maxLength={120}
            reservarApoio={algumErro}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            rotulo="Duração"
            value={duracao}
            onChangeText={setDuracao}
            erro={erros.duracao ?? null}
            sufixo="min"
            keyboardType="number-pad"
            maxLength={3}
            reservarApoio={algumErro}
          />
        </View>
      </View>
      {criar.error ? <AvisoDeFalha erro={criar.error} titulo="A etapa não foi salva" /> : null}
      <Botao
        titulo="Salvar etapa"
        tamanho="grande"
        larguraTotal
        carregando={criar.isPending}
        aoPressionar={salvar}
      />
    </FolhaNaTela>
  )
}
