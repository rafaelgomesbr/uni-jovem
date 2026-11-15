import {
  compor,
  ehTranslucida,
  ELEVACAO,
  TEMAS,
  VIDRO,
  type NomeDoTema,
  type Paleta,
} from '@uj/tokens'
import { createContext, useContext, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'

/**
 * Onde o componente está desenhado:
 * - `fundo`: direto na tela (sobre a Aurora);
 * - `translucida`: dentro do cartão de vidro translúcido (D32);
 * - `opaca`: dentro de um cartão opaco (folha, cartão de formulário);
 * - `inversa`: dentro do cartão de destaque ou do toast (paleta inversa).
 */
export type Superficie = 'fundo' | 'translucida' | 'opaca' | 'inversa'

export interface Tema {
  /** A paleta em vigor: a base do tema ou, sob `ProvedorDeTemaInverso`, a inversa. */
  cores: Paleta
  /** As cores em vigor são escuras? (no inverso do escuro, não são). */
  escuro: boolean
  /** Tema do sistema (não muda dentro do inverso). */
  nome: NomeDoTema
  inverso: boolean
  superficie: Superficie
  /** Sombras por nível (`boxShadow`), do tema do sistema. */
  elevacao: (typeof ELEVACAO)[NomeDoTema]
  /** Vidro da barra (barra de abas, cabeçalho compacto, barra de ação). */
  vidro: (typeof VIDRO)['barra'][NomeDoTema]
  /**
   * Fundo próprio de um componente (chip, aviso, trilho): dentro do cartão
   * translúcido, a cor translúcida é composta sobre a superfície opaca, para
   * o contraste não depender do ponto da Aurora (pares em `PARES_QUE_EXIGEM_FUNDO_OPACO`).
   */
  solido: (cor: string) => string
  /** Fundo de controle "sem fundo" (secundário, destrutivo): opaco no cartão translúcido. */
  semFundo: string
}

const ContextoDoInverso = createContext(false)
/** Tema forçado (só o catálogo usa, para mostrar escuro e claro na mesma sessão). */
const ContextoDoTemaForcado = createContext<NomeDoTema | null>(null)
const ContextoDaSuperficie = createContext<Superficie>('fundo')

/** Tema claro ou escuro, sempre seguindo o sistema, com a paleta da superfície em que está. */
export function useTema(): Tema {
  const doSistema: NomeDoTema = useColorScheme() === 'dark' ? 'escuro' : 'claro'
  const nome = useContext(ContextoDoTemaForcado) ?? doSistema
  const inverso = useContext(ContextoDoInverso)
  const superficie = useContext(ContextoDaSuperficie)
  const cores = inverso ? TEMAS[nome].inverso : TEMAS[nome].base
  const translucida = superficie === 'translucida' && ehTranslucida(cores.superficieTranslucida)
  return {
    cores,
    escuro: inverso ? nome === 'claro' : nome === 'escuro',
    nome,
    inverso,
    superficie,
    elevacao: ELEVACAO[nome],
    vidro: VIDRO.barra[nome],
    solido: (cor) => (translucida && ehTranslucida(cor) ? compor(cor, cores.superficie) : cor),
    semFundo: translucida ? cores.superficie : 'transparent',
  }
}

/**
 * Todo filho do cartão de destaque e do toast lê a paleta inversa (claro no
 * tema escuro, índigo no tema claro) sem código especial.
 */
export function ProvedorDeTemaInverso({ children }: { children: ReactNode }) {
  return (
    <ContextoDoInverso.Provider value>
      <ContextoDaSuperficie.Provider value="inversa">{children}</ContextoDaSuperficie.Provider>
    </ContextoDoInverso.Provider>
  )
}

/** Força o tema dos filhos (catálogo de componentes). As telas seguem sempre o sistema. */
export function ProvedorDeTemaForcado({
  nome,
  children,
}: {
  nome: NomeDoTema
  children: ReactNode
}) {
  return <ContextoDoTemaForcado.Provider value={nome}>{children}</ContextoDoTemaForcado.Provider>
}

/** Marca a superfície dos filhos (usado pelos cartões e pela folha). */
export function ProvedorDeSuperficie({
  superficie,
  children,
}: {
  superficie: Exclude<Superficie, 'inversa'>
  children: ReactNode
}) {
  return (
    <ContextoDaSuperficie.Provider value={superficie}>{children}</ContextoDaSuperficie.Provider>
  )
}

/** `boxShadow` do nível, ou nada quando o nível é `none` (escuro: a borda faz o papel). */
export function sombra(valor: string): { boxShadow?: string } {
  return valor === 'none' ? {} : { boxShadow: valor }
}
