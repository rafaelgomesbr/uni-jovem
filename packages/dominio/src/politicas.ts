/**
 * As três políticas de entrada (ADR 0004), separadas, com os valores da
 * ADR 0007 ("app aberto, comunidades livres com rodinhas"). Trocar o valor de
 * `POLITICAS` muda o comportamento da API sem mexer em convites nem em
 * comunidades; os limites das rodinhas também vivem aqui e o banco tem os
 * mesmos números (0022_app_aberto.sql), conferidos por teste.
 */

/** Quem cria conta. */
export const CADASTRO_SIMPLIFICADO = true

export const POLITICAS_DE_CONTA = ['somente_por_convite', 'cadastro_publico'] as const
export type PoliticaDeConta = (typeof POLITICAS_DE_CONTA)[number]

/** Quem cria comunidade. */
export const POLITICAS_DE_COMUNIDADE = ['somente_criador', 'livre_com_limites'] as const
export type PoliticaDeComunidade = (typeof POLITICAS_DE_COMUNIDADE)[number]

/**
 * Como se entra numa comunidade (`comunidades.modo_entrada`). `livre` (entrar
 * sem código nem convite) existe como ponto de extensão e continua NÃO
 * habilitado: o banco e a API recusam.
 */
export const MODOS_DE_ENTRADA = [
  'convite',
  'codigo_com_aprovacao',
  'codigo_direto',
  'livre',
] as const
export type ModoDeEntrada = (typeof MODOS_DE_ENTRADA)[number]

export const MODOS_DE_ENTRADA_HABILITADOS = [
  'convite',
  'codigo_com_aprovacao',
  'codigo_direto',
] as const satisfies readonly ModoDeEntrada[]
export type ModoDeEntradaHabilitado = (typeof MODOS_DE_ENTRADA_HABILITADOS)[number]

/** Modo das comunidades criadas por qualquer conta (ADR 0007). */
export const MODO_DE_ENTRADA_PADRAO: ModoDeEntradaHabilitado = 'codigo_com_aprovacao'

export function modoDeEntradaHabilitado(modo: string): modo is ModoDeEntradaHabilitado {
  return (MODOS_DE_ENTRADA_HABILITADOS as readonly string[]).includes(modo)
}

/** Valores vigentes. Constante única: trocar aqui troca na API inteira. */
export const POLITICAS: Readonly<{
  conta: PoliticaDeConta
  comunidade: PoliticaDeComunidade
}> = {
  conta: 'cadastro_publico',
  comunidade: 'livre_com_limites',
}

/** Com esta política, alguém cria conta sem convite (e-mail, Google ou Apple)? */
export function cadastroSemConviteHabilitado(politica: PoliticaDeConta): boolean {
  return politica === 'cadastro_publico'
}

/**
 * Com esta política, quem pode criar comunidade? O Criador sempre pode (pela
 * Plataforma); uma conta comum só com `livre_com_limites` e e-mail confirmado.
 */
export function podeCriarComunidade(
  politica: PoliticaDeComunidade,
  conta: { criador: boolean; emailConfirmado: boolean },
): boolean {
  if (conta.criador) return true
  return politica === 'livre_com_limites' && (conta.emailConfirmado || CADASTRO_SIMPLIFICADO)
}

/** Verificação da comunidade: `nova` tem rodinhas; `verificada` (pelo Criador) não. */
export const VERIFICACOES = ['nova', 'verificada'] as const
export type Verificacao = (typeof VERIFICACOES)[number]

/** Rodinhas: valem enquanto a comunidade for `nova` (o banco confere de novo). */
export const LIMITES_DA_COMUNIDADE_NOVA = {
  /** Vínculos ativos no máximo. */
  vinculosAtivos: 30,
  /** Evento público (página de inscrição) recusado. */
  eventoPublico: false,
} as const

/** Limites de criação por conta. */
export const LIMITES_DE_CRIACAO = {
  /** Comunidades `nova` criadas pela conta ao mesmo tempo. */
  comunidadesNovasAoMesmoTempo: 1,
  /** Comunidades criadas pela conta, no total. */
  comunidadesCriadasPorConta: 3,
} as const

/** Limites dos pedidos de entrada. */
export const LIMITES_DE_PEDIDOS = {
  pendentesPorConta: 3,
  /** Espera depois de uma recusa, na mesma comunidade. */
  diasDepoisDeRecusa: 30,
  /** Tamanho da mensagem que acompanha o pedido. */
  caracteresDaMensagem: 280,
} as const

/** Busca de comunidades encontráveis. */
export const LIMITES_DA_BUSCA = {
  minimoDeLetras: 3,
  maximoDeResultados: 20,
} as const

/**
 * Código da comunidade: 8 caracteres de um alfabeto sem ambiguidade (sem 0, O,
 * 1 e I). São 32 símbolos: cada um vem de 5 bits, sem viés.
 */
export const ALFABETO_DO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const TAMANHO_DO_CODIGO = 8

/** Normaliza o que a pessoa digitou: maiúsculas, sem espaço nem hífen. */
export function normalizarCodigoDaComunidade(entrada: string): string {
  return entrada.toUpperCase().replace(/[\s-]/g, '')
}

export function ehCodigoDaComunidade(codigo: string): boolean {
  return (
    codigo.length === TAMANHO_DO_CODIGO && [...codigo].every((c) => ALFABETO_DO_CODIGO.includes(c))
  )
}

/**
 * Carência da exclusão de uma comunidade (D77, ADR 0009): dias entre o pedido (da administração, do
 * Criador ou da conta de quem criou) e o apagamento definitivo pela rotina de retenção. Dentro dela
 * a comunidade some das listas e não aceita acessos, e a administração pode desfazer. O banco usa o
 * mesmo número (`agendar_exclusao_da_comunidade`, migração 0030: o teste confere).
 */
export const DIAS_DE_CARENCIA_DA_EXCLUSAO_DA_COMUNIDADE = 30
