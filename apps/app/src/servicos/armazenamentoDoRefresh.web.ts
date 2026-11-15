import type { ArmazenamentoDoRefresh } from './api'

/** Web: o refresh mora num cookie HttpOnly; o JavaScript não guarda nada. */
export function criarArmazenamentoDoRefresh(): ArmazenamentoDoRefresh | null {
  return null
}

/** Biometria é só do celular: na web nada disso existe. */
export class BiometriaRecusada extends Error {
  constructor() {
    super('Não foi possível confirmar a biometria.')
    this.name = 'BiometriaRecusada'
  }
}

export function trancarCofre(): void {}

export async function biometriaLigada(): Promise<boolean> {
  return false
}

export async function ligarBiometria(): Promise<void> {
  throw new BiometriaRecusada()
}

export async function desligarBiometria(): Promise<void> {}
