import type { MarcaDoAcesso, NivelDoAcesso } from '@/ui/aparenciaDoAcesso'

import type { MetodoDeAcesso } from './ultimoMetodo'

export interface ItemDoAcesso {
  marca: Extract<MarcaDoAcesso, 'apple' | 'google' | 'email' | 'biometria'>
  nivel: NivelDoAcesso
  /** Ganha o selo "Usado da última vez" (texto mais ícone: a cor nunca é o único sinal). */
  selo: boolean
}

interface Entrada {
  plataforma: 'ios' | 'android' | 'web'
  /** A Apple está disponível (iOS com conta Apple no aparelho). */
  apple: boolean
  /** O ID de cliente do Google da plataforma existe. */
  google: boolean
  /** Sessão guardada neste aparelho esperando o Face ID (`biometria.travada`). */
  biometria: boolean
  ultimoMetodo: MetodoDeAcesso | null
}

/**
 * A ordem e o peso dos acessos em `entrada.inicio` (UX 4):
 * - o padrão da plataforma: iOS é Apple, Google e e-mail; Android e web são
 *   Google e e-mail (a Apple não existe fora do iOS);
 * - o método usado da última vez sobe ao primeiro lugar e ganha o selo;
 * - o Face ID, havendo sessão guardada, é sempre o primeiro e o único coral;
 * - o primeiro é primário; o segundo, secundário; o terceiro, terciário (só o
 *   e-mail vira só texto; o Google no terceiro lugar fica em contorno);
 * - sem nenhum provedor, só o e-mail (que a tela já abre aberto).
 */
export function ordemDosAcessos({
  plataforma,
  apple,
  google,
  biometria,
  ultimoMetodo,
}: Entrada): ItemDoAcesso[] {
  const disponiveis: MetodoDeAcesso[] = [
    ...(apple && plataforma === 'ios' ? (['apple'] as const) : []),
    ...(google ? (['google'] as const) : []),
    'email',
  ]
  const ordenados =
    ultimoMetodo && disponiveis.includes(ultimoMetodo)
      ? [ultimoMetodo, ...disponiveis.filter((m) => m !== ultimoMetodo)]
      : disponiveis
  const niveis: readonly NivelDoAcesso[] = ['primario', 'secundario', 'terciario']
  const itens: ItemDoAcesso[] = ordenados.map((marca, i) => ({
    marca,
    nivel: niveis[i] ?? 'terciario',
    selo: marca === ultimoMetodo && disponiveis.length > 1,
  }))
  return biometria ? [{ marca: 'biometria', nivel: 'primario', selo: false }, ...itens] : itens
}
