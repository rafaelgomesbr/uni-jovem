import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { chamadasV3 } from '@/servicos/contratoV3'
import { mostrarDesfazer, useRestanteDoDesfazer } from '@/ui/ToastComDesfazer'
import { formatarHora } from '@/utilidades/datas'

import { useInvalidarEventos } from './consultas'
import { quantasPessoas } from './Convocacao'
import { contarRespostas } from './respostas'

export type EstadoDoLembrete =
  { fase: 'ocioso' } | { fase: 'esperando' } | { fase: 'enviado'; texto: string }

/** O encontro já começou? Uma função à parte: o relógio não é lido durante a renderização. */
function jaComecou(inicio: string): boolean {
  return new Date(inicio).getTime() <= Date.now()
}

/**
 * "Lembrar os N" (D66, D69, D74): um lembrete genérico a quem ainda não respondeu. O botão vira
 * "Enviando em 9 s" (o número que a faixa conta, nunca um escrito à mão) com Desfazer; ao fim da
 * contagem, ao sair da tela ou do app, a API é chamada ("Falta responder", no máximo um por pessoa
 * a cada 24 h). Falha de rede repete sozinha; falha de vez vira "Tentar de novo". Depois: "Lembrete
 * enviado" e "Você lembrou 2 pessoas, hoje às 10:12". Mora num hook porque a barra do encontro e o
 * Quem vai mostram o mesmo botão.
 */
export function useLembrete(evento: DetalheDoEvento, comunidadeId: string) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const [estado, setEstado] = useState<EstadoDoLembrete>({ fase: 'ocioso' })
  const respostas = contarRespostas(evento.atribuicoes)
  const enviar = useMutation({
    mutationFn: () => chamadasV3.lembrarPendentes(comunidadeId, evento.id),
  })
  const restante = useRestanteDoDesfazer()
  // Só encontro publicado e que ainda vai acontecer recebe lembrete (a API recusa os outros).
  const pode = evento.status === 'publicado' && !jaComecou(evento.inicio)

  function pedir() {
    const n = respostas.pendentes
    setEstado({ fase: 'esperando' })
    mostrarDesfazer({
      texto: `Lembrando ${quantasPessoas(n)} que ainda não ${n === 1 ? 'respondeu' : 'responderam'}.`,
      aoDesfazer: () => setEstado({ fase: 'ocioso' }),
      textoDaFalha: 'Não deu para lembrar agora. Ninguém foi lembrado. Toque em Tentar de novo.',
      aoFalhar: () => setEstado({ fase: 'ocioso' }),
      aoConfirmar: async () => {
        setEstado({ fase: 'esperando' })
        const r = await enviar.mutateAsync()
        const hora = formatarHora(new Date().toISOString(), evento.fuso)
        setEstado({
          fase: 'enviado',
          texto:
            r.lembradas > 0
              ? `Você lembrou ${quantasPessoas(r.lembradas)}, hoje às ${hora}.`
              : 'Ninguém para lembrar agora: quem falta já foi lembrado nas últimas 24 horas.',
        })
        void invalidar(evento.id)
      },
    })
  }

  return {
    estado,
    pedir,
    /** O texto do botão enquanto espera: "Enviando em 9 s" (ou "Enviando..." se já saiu). */
    rotuloEnviando: restante === null ? 'Enviando...' : `Enviando em ${restante} s`,
    /** Há quem lembrar e o encontro aceita lembrete. */
    disponivel: pode && respostas.pendentes > 0,
    pendentes: respostas.pendentes,
    nomes: respostas.nomesPendentes,
  }
}

export type LembreteDoEncontro = ReturnType<typeof useLembrete>
