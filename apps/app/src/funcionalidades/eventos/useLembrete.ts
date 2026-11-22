import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { chamadasV3 } from '@/servicos/contratoV3'
import { mostrarToast } from '@/ui/Toast'
import { mostrarDesfazer } from '@/ui/ToastComDesfazer'
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
 * "Lembrar os N" (D66, D69): um lembrete genérico a quem ainda não respondeu. O botão vira
 * "Enviando em 10 s" com Desfazer; só ao fim a API é chamada ("Falta responder", no máximo um
 * por pessoa a cada 24 h). Depois: "Lembrete enviado" e "Você lembrou 2 pessoas, hoje às 10:12".
 * Mora num hook porque a barra do encontro e os Convocados mostram o mesmo botão.
 */
export function useLembrete(evento: DetalheDoEvento, comunidadeId: string) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const [estado, setEstado] = useState<EstadoDoLembrete>({ fase: 'ocioso' })
  const respostas = contarRespostas(evento.atribuicoes)
  const enviar = useMutation({
    mutationFn: () => chamadasV3.lembrarPendentes(comunidadeId, evento.id),
  })
  // Só encontro publicado e que ainda vai acontecer recebe lembrete (a API recusa os outros).
  const pode = evento.status === 'publicado' && !jaComecou(evento.inicio)

  function pedir() {
    const n = respostas.pendentes
    setEstado({ fase: 'esperando' })
    mostrarDesfazer({
      texto: `Lembrando ${quantasPessoas(n)} que ainda não ${n === 1 ? 'respondeu' : 'responderam'}.`,
      aoDesfazer: () => setEstado({ fase: 'ocioso' }),
      aoConfirmar: () => {
        enviar.mutate(undefined, {
          onSuccess: (r) => {
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
          onError: () => {
            setEstado({ fase: 'ocioso' })
            mostrarToast({ texto: 'Não deu para lembrar agora. Tente de novo.', tipo: 'erro' })
          },
        })
      },
    })
  }

  return {
    estado,
    pedir,
    /** Há quem lembrar e o encontro aceita lembrete. */
    disponivel: pode && respostas.pendentes > 0,
    pendentes: respostas.pendentes,
    nomes: respostas.nomesPendentes,
  }
}

export type LembreteDoEncontro = ReturnType<typeof useLembrete>
