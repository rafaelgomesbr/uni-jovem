/**
 * Contrato das rotas de D77 (ver docs/design/v3/api-v3.md): limpar os próximos encontros e
 * excluir a comunidade. Os nomes são os da API.
 */

/** `GET /api/v1/c/:id/eventos/limpar-proximos`: o que a limpeza alcançaria agora. */
export interface ResumoDosProximosEncontros {
  /** Tudo que ainda não começou, em qualquer situação. */
  total: number
  rascunhos: number
  publicados: number
  adiados: number
  cancelados: number
  encerrados: number
  /** Quem receberia o aviso se os publicados e adiados fossem cancelados (sem contar a própria pessoa). */
  pessoasAAvisar: number
  /** Repetições que seguem criando encontros depois da limpeza. */
  repeticoesAtivas: number
}

/** `apagar`: some tudo e não avisa ninguém. `cancelar_e_avisar`: rascunhos somem, o resto vira cancelado e avisa. */
export type ModoDeLimpeza = 'apagar' | 'cancelar_e_avisar'

/** `POST /api/v1/c/:id/eventos/limpar-proximos`. */
export interface ResultadoDaLimpeza {
  ok: true
  modo: ModoDeLimpeza
  apagados: number
  cancelados: number
  pessoasAvisadas: number
}

/** `POST /api/v1/c/:id/excluir`. */
export interface ResultadoDoPedidoDeExclusao {
  ok: true
  estado: 'exclusao_agendada'
  /** Quando a comunidade é apagada de vez (30 dias depois do pedido). */
  apagadaEm: string
}

/** `GET /api/v1/eu/comunidades-em-exclusao`: as que a pessoa (administradora) ainda pode desfazer. */
export interface ComunidadeEmExclusao {
  id: string
  nome: string
  apagadaEm: string
  pedidaEm: string
}
