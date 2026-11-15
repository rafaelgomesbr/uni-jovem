import { TIPOS_DE_OPERACAO, type TipoDeOperacao } from './tipos'

/**
 * Pedido de oração NUNCA vai para o banco local (CLAUDE.md, seção 5; matriz
 * offline). O pacote do servidor já vem sem oração; esta é a segunda trava,
 * do lado do aparelho: qualquer campo cujo nome fale de oração é descartado
 * antes de gravar, e nenhuma operação fora da lista fechada entra na fila.
 */

const PALAVRAS_DE_ORACAO = new Set(['oracao', 'oracoes', 'prayer', 'prayers'])

/**
 * Compara palavra por palavra (camelCase e snake_case), sem acento: pega
 * `pedidosDeOracao`, `texto_da_oracao` e `oracoes`, mas não `decoracao`.
 */
export function ehCampoDeOracao(nome: string): boolean {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((palavra) => PALAVRAS_DE_ORACAO.has(palavra))
}

/** Cópia profunda sem nenhum campo de oração. */
export function semOracao<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map((v) => semOracao(v)) as T
  if (valor && typeof valor === 'object') {
    const limpo: Record<string, unknown> = {}
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      if (ehCampoDeOracao(chave)) continue
      limpo[chave] = semOracao(v)
    }
    return limpo as T
  }
  return valor
}

export function tipoPermitidoOffline(tipo: string): tipo is TipoDeOperacao {
  return (TIPOS_DE_OPERACAO as readonly string[]).includes(tipo)
}
