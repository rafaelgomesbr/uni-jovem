import { useEffect, useSyncExternalStore } from 'react'

import { gravarPreferenciaLocal, lerPreferenciaLocal } from '@/estado/preferenciaLocal'

/**
 * O método de acesso usado da última vez neste aparelho (D63): sobe ao
 * primeiro lugar e ganha o selo "Usado da última vez". Guarda só a marca do
 * método (`apple`, `google` ou `email`), nunca o e-mail nem a conta: é uma
 * preferência de interface, não dado pessoal. Falhar ao ler ou gravar nunca
 * quebra a tela (a pessoa vê a ordem padrão da plataforma).
 */
export type MetodoDeAcesso = 'apple' | 'google' | 'email'

export const CHAVE_DO_ULTIMO_METODO = 'uj.acesso.ultimo-metodo'

const VALIDOS: readonly string[] = ['apple', 'google', 'email']

let atual: MetodoDeAcesso | null = null
let carregado = false
let carregando = false
const ouvintes = new Set<() => void>()

function avisar() {
  for (const ouvinte of ouvintes) ouvinte()
}

function ehMetodo(valor: unknown): valor is MetodoDeAcesso {
  return typeof valor === 'string' && VALIDOS.includes(valor)
}

async function carregar(): Promise<void> {
  if (carregado || carregando) return
  carregando = true
  const salvo = await lerPreferenciaLocal<string>(CHAVE_DO_ULTIMO_METODO)
  carregando = false
  carregado = true
  // Uma entrada que terminou enquanto lia vale mais que o valor antigo do disco.
  if (atual === null && ehMetodo(salvo)) {
    atual = salvo
    avisar()
  }
}

/** Registra o método da entrada que acabou de dar certo. */
export function guardarUltimoMetodo(metodo: MetodoDeAcesso): void {
  atual = metodo
  carregado = true
  void gravarPreferenciaLocal(CHAVE_DO_ULTIMO_METODO, metodo)
  avisar()
}

/** O método usado da última vez, ou `null` (nunca entrou aqui, ainda lendo, ou deu erro ao ler). */
export function useUltimoMetodo(): MetodoDeAcesso | null {
  const metodo = useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
    () => atual,
    () => atual,
  )
  // A leitura do aparelho é o sistema externo: começa quando a primeira tela pede.
  useEffect(() => {
    void carregar()
  }, [])
  return metodo
}

/** Só os testes: volta ao estado de aparelho novo. */
export function esquecerUltimoMetodoParaTeste(): void {
  atual = null
  carregado = false
  carregando = false
  avisar()
}
