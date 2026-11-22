import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type {
  Disponibilidade,
  EncontroAguardandoResposta,
  MinhaEscala,
  Substituicao,
} from '@/servicos/contratoDosEventos'
import { mostrarToast } from '@/ui/Toast'
import { mostrarDesfazer } from '@/ui/ToastComDesfazer'
import { confirmar } from '@/utilidades/confirmar'
import { dataDoInstante, type DataLocal } from '@/utilidades/datas'

import { diaDoToast, diaEMesCurto } from '../agenda/semanas'
import { naComunidade, textoDeConsulta } from '../eventos/consultas'
import { definirResposta, limparResposta } from './respostasOtimistas'

export function useMinhasEscalas(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.minhasEscalas(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{ escalas: MinhaEscala[] }>(`${naComunidade(comunidadeId!)}/minhas-escalas`)
        .then((r) => r.escalas),
    enabled: comunidadeId !== null,
  })
}

/** Para quem convoca (D57): encontros publicados com convocação sem resposta ou recusada. */
export function useAguardandoResposta(comunidadeId: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: CHAVES.aguardandoResposta(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{
          encontros: EncontroAguardandoResposta[]
        }>(`${naComunidade(comunidadeId!)}/convocacoes/aguardando-resposta`)
        .then((r) => r.encontros),
    enabled: comunidadeId !== null && habilitado,
  })
}

export function useSubstituicoes(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.substituicoes(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{ substituicoes: Substituicao[] }>(`${naComunidade(comunidadeId!)}/substituicoes`)
        .then((r) => r.substituicoes),
    enabled: comunidadeId !== null,
  })
}

/** Membro recebe só a própria; organização recebe a de todos (a RLS decide). */
export function useDisponibilidade(
  comunidadeId: string | null,
  de: DataLocal,
  ate: DataLocal,
  habilitado = true,
) {
  return useQuery({
    queryKey: CHAVES.disponibilidade(comunidadeId ?? '', de, ate),
    queryFn: () =>
      api
        .get<{ disponibilidade: Disponibilidade[] }>(
          `${naComunidade(comunidadeId!)}/disponibilidade${textoDeConsulta({ de, ate })}`,
        )
        .then((r) => r.disponibilidade),
    enabled: comunidadeId !== null && habilitado,
  })
}

/** Tudo que mostra escala depende destas três listas, mais o Início, o resumo e o evento. */
export function useInvalidarEscalas(comunidadeId: string) {
  const consultas = useQueryClient()
  return async () => {
    await Promise.all([
      consultas.invalidateQueries({ queryKey: CHAVES.minhasEscalas(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.substituicoes(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.aguardandoResposta(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.inicio(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: ['c', comunidadeId, 'evento'] }),
      // O resumo do Início conta convocações e pedidos de substituição.
      consultas.invalidateQueries({ queryKey: ['c', comunidadeId, 'eventos', 'visao-geral'] }),
    ])
  }
}

export type Resposta = 'confirmar' | 'recusar'

/** O toast depois de responder (D54): a pessoa sabe que a resposta chegou. */
export const TEXTO_DEPOIS_DE_RESPONDER: Readonly<Record<Resposta, string>> = {
  confirmar: 'Você aceitou. A organização já vê sua resposta.',
  recusar: 'Pronto. A organização foi avisada.',
}

/** "Não posso ir" sempre pergunta antes: a organização recebe um aviso. */
export function confirmarQueNaoPodeIr(): Promise<boolean> {
  return confirmar({
    titulo: 'Avisar que você não pode ir?',
    mensagem: 'A organização recebe o aviso para chamar outra pessoa.',
    confirmar: 'Avisar que não posso',
    cancelar: 'Voltar',
    destrutivo: true,
  })
}

/** Aceitar ("confirmar" na API) ou avisar que não pode ir ("recusar") a própria convocação. */
export function useResponderEscala(comunidadeId: string) {
  const invalidar = useInvalidarEscalas(comunidadeId)
  return useMutation({
    mutationFn: ({ atribuicaoId, resposta }: { atribuicaoId: string; resposta: Resposta }) =>
      api.post(`${naComunidade(comunidadeId)}/atribuicoes/${atribuicaoId}/${resposta}`),
    onSuccess: async (_dados, { resposta }) => {
      mostrarToast({ texto: TEXTO_DEPOIS_DE_RESPONDER[resposta] })
      await invalidar()
    },
  })
}

// ------------------------------------------------------------ responder com Desfazer (D69)

/** O que o toast precisa saber da convocação que a pessoa responde. */
export interface ParteParaResponder {
  /** O id da convocação (atribuição). */
  atribuicaoId: string
  eventoInicio: string
  fuso: string
  funcao: string
  /** Título da etapa ("Louvor"); nulo quando a pessoa foi convocada ao encontro todo. */
  etapaTitulo: string | null
}

/** "no Louvor", "em Recepção": o lugar da pessoa, com a preposição que fala melhor. */
function emOnde(p: Pick<ParteParaResponder, 'funcao' | 'etapaTitulo'>): string {
  const onde = p.etapaTitulo ?? p.funcao
  const nome = onde.charAt(0).toLocaleUpperCase('pt-BR') + onde.slice(1)
  return nome === 'Louvor' ? 'no Louvor' : `em ${nome}`
}

export const TEXTO_DE_FALHA_AO_RESPONDER = 'Não deu para registrar sua resposta.'

/**
 * Aceitar e "Não posso ir" sem diálogo (D69, padrão 5.2): o ato aparece feito na hora, o toast
 * dá 10 s para desfazer e SÓ DEPOIS a resposta sai (e a liderança é avisada). Desfazer devolve
 * a convocação a "Aguardando sua resposta" sem ter enviado nada. Se o envio falhar, o toast
 * volta com "Tentar de novo". Sem tela por trás: se a pessoa sair da tela, o envio segue.
 */
export function useResponderComDesfazer(comunidadeId: string) {
  const invalidar = useInvalidarEscalas(comunidadeId)

  async function enviar(parte: ParteParaResponder, resposta: Resposta) {
    try {
      await api.post(`${naComunidade(comunidadeId)}/atribuicoes/${parte.atribuicaoId}/${resposta}`)
      await invalidar()
      limparResposta(parte.atribuicaoId)
    } catch {
      limparResposta(parte.atribuicaoId)
      mostrarDesfazer({
        texto: TEXTO_DE_FALHA_AO_RESPONDER,
        rotuloDoBotao: 'Tentar de novo',
        // O botão do toast repete o envio; sem toque, a convocação segue pendente.
        aoConfirmar: () => undefined,
        aoDesfazer: () => responder(parte, resposta),
      })
    }
  }

  function responder(parte: ParteParaResponder, resposta: Resposta) {
    definirResposta(parte.atribuicaoId, resposta === 'confirmar' ? 'confirmada' : 'recusada')
    mostrarDesfazer({
      texto:
        resposta === 'confirmar'
          ? `Você está ${emOnde(parte)}, ${diaDoToast(parte.eventoInicio, parte.fuso)}.`
          : 'Você avisou que não pode ir.',
      aoDesfazer: () => limparResposta(parte.atribuicaoId),
      aoConfirmar: () => void enviar(parte, resposta),
    })
  }

  return {
    aceitar: (parte: ParteParaResponder) => responder(parte, 'confirmar'),
    recusar: (parte: ParteParaResponder) => responder(parte, 'recusar'),
  }
}

/**
 * "Assumir" um pedido de ajuda: um toque, com Desfazer de 10 s (a pessoa que pediu só é avisada
 * depois). Devolve os pedidos já assumidos na tela (para a linha sumir na hora) e a ação.
 */
export function useAssumirComDesfazer(comunidadeId: string) {
  const invalidar = useInvalidarEscalas(comunidadeId)
  const [assumidos, setAssumidos] = useState<ReadonlySet<string>>(new Set())

  const tirar = (id: string) =>
    setAssumidos((atual) => {
      const novo = new Set(atual)
      novo.delete(id)
      return novo
    })

  function assumir(pedido: {
    id: string
    funcao: string
    etapa: string | null
    inicio: string
    fuso: string
  }) {
    setAssumidos((atual) => new Set(atual).add(pedido.id))
    const dia = diaEMesCurto(dataDoInstante(pedido.inicio, pedido.fuso))
    mostrarDesfazer({
      texto: `Você assumiu ${pedido.etapa ?? pedido.funcao}, ${dia}.`,
      aoDesfazer: () => tirar(pedido.id),
      aoConfirmar: () => {
        api
          .post(`${naComunidade(comunidadeId)}/substituicoes/${pedido.id}/assumir`)
          .then(() => invalidar())
          .then(() => tirar(pedido.id))
          .catch(() => {
            tirar(pedido.id)
            mostrarToast({ texto: 'Não deu para assumir. Tente de novo.', tipo: 'erro' })
          })
      },
    })
  }

  return { assumidos, assumir }
}
