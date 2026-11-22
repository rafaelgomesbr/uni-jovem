import { estadoDoMomento, type EstadoDoMomento } from '@uj/dominio'
import type { MomentoDoDia } from '@uj/tokens'

const DO_ESTADO: Readonly<Record<EstadoDoMomento, MomentoDoDia>> = {
  longe: 'longe',
  vespera: 'vespera',
  no_dia: 'dia',
  acontecendo: 'agora',
  terminou: 'fim',
}

/**
 * O momento do encontro (`longe` a `fim`) para a `Tela` e o cartão do momento: a luz de base e o
 * sol acompanham o relógio. Usa a mesma regra do servidor (`estadoDoMomento`, D66), no fuso do
 * encontro. Sem duração, vale 1 hora.
 */
export function momentoDoEncontro(
  inicioIso: string,
  fuso: string,
  opcoes: { duracaoMin?: number; agora?: Date; ativo?: boolean | 'encerrado' } = {},
): MomentoDoDia {
  const estado = estadoDoMomento({
    agora: opcoes.agora ?? new Date(),
    inicio: new Date(inicioIso),
    duracaoMin: opcoes.duracaoMin ?? 60,
    fuso,
    ...(opcoes.ativo === 'encerrado'
      ? { situacaoAoVivo: 'encerrado' as const }
      : opcoes.ativo
        ? { situacaoAoVivo: 'em_andamento' as const }
        : {}),
  })
  return DO_ESTADO[estado]
}
