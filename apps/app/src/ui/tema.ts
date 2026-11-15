import {
  CLARO,
  DESTAQUE_NO_CLARO,
  DESTAQUE_NO_ESCURO,
  ELEVACAO,
  ESCURO,
  type Paleta,
} from '@uj/tokens'
import { createContext, useContext } from 'react'
import { useColorScheme } from 'react-native'

export interface Tema {
  cores: Paleta
  escuro: boolean
  /** Sombras do tema (`boxShadow`), por nível. */
  elevacao: (typeof ELEVACAO)['claro' | 'escuro']
  /** Dentro de um cartão de destaque (paleta invertida)? */
  noDestaque: boolean
}

/**
 * Superfície com paleta própria: dentro do cartão de destaque (claro no tema
 * escuro, noite no tema claro), todo texto, selo e botão usa a paleta dele.
 */
export const ContextoDeSuperficie = createContext<'normal' | 'destaque'>('normal')

/** Tema claro ou escuro, sempre seguindo o sistema. */
export function useTema(): Tema {
  const escuro = useColorScheme() === 'dark'
  const noDestaque = useContext(ContextoDeSuperficie) === 'destaque'
  return {
    cores: noDestaque ? (escuro ? DESTAQUE_NO_ESCURO : DESTAQUE_NO_CLARO) : escuro ? ESCURO : CLARO,
    // No cartão de destaque do tema escuro, o que vai dentro é "claro" (e vice-versa).
    escuro: noDestaque ? !escuro : escuro,
    elevacao: escuro ? ELEVACAO.escuro : ELEVACAO.claro,
    noDestaque,
  }
}
