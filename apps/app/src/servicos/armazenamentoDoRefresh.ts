import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  AESKeySize,
} from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import type { ArmazenamentoDoRefresh } from './api'
import { confirmarComBiometria } from './biometria'

/**
 * Celular: o refresh fica no Keychain (iOS) ou no Keystore (Android).
 *
 * Com "Usar Face ID para entrar" ligado, o refresh guardado fica CIFRADO
 * (AES-GCM) com uma chave que mora no Keychain/Keystore presa à biometria
 * (`requireAuthentication`). Sem o rosto ou a digital, o aparelho não tem
 * como reabrir a sessão. A chave fica em memória enquanto o app está aberto:
 * o refresh gira a cada renovação (15 min de uso) e regravar não pode pedir a
 * biometria toda vez. Ao fechar o app, ela some, e a próxima abertura pede de novo.
 *
 * Qualquer fim de sessão (sair, aparelho revogado, refresh recusado) desliga a
 * biometria e apaga a chave: o "Entrar com Face ID" só aparece quando há uma
 * sessão trancada para abrir.
 */

const CHAVE = 'uj.refresh'
const CIFRADO = 'uj.refresh.cifrado'
const CHAVE_DA_BIOMETRIA = 'uj.biometria.chave'
const LIGADA = 'uj.biometria.ligada'

// Só depois do primeiro desbloqueio e só neste aparelho: o refresh não vai
// para backup nem migra para outro telefone.
const OPCOES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

// A chave da biometria só existe com senha do aparelho e só com a biometria
// cadastrada hoje: cadastrar outro rosto ou digital invalida a chave (iOS).
const OPCOES_DA_CHAVE: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  requireAuthentication: true,
}

/** A pessoa cancelou ou não passou na biometria: a sessão continua trancada. */
export class BiometriaRecusada extends Error {
  constructor() {
    super('Não foi possível confirmar a biometria.')
    this.name = 'BiometriaRecusada'
  }
}

let chaveEmMemoria: AESEncryptionKey | null = null

/** Tokens são ASCII; vira bytes sem depender de TextEncoder. */
function paraBytes(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    if (c > 127) throw new Error('refresh com caractere inesperado')
    bytes[i] = c
  }
  return bytes
}

function deBytes(bytes: Uint8Array): string {
  let texto = ''
  for (const b of bytes) texto += String.fromCharCode(b)
  return texto
}

async function cifrar(chave: AESEncryptionKey, refresh: string): Promise<string> {
  const selado = await aesEncryptAsync(paraBytes(refresh), chave)
  return selado.combined('base64')
}

async function decifrar(chave: AESEncryptionKey, cifrado: string): Promise<string> {
  const bytes = await aesDecryptAsync(AESSealedData.fromCombined(cifrado), chave)
  return deBytes(bytes)
}

/**
 * Esquece a chave em memória, como ao fechar o app: o próximo `ler` pede a
 * biometria de novo. (Base para trancar ao voltar do segundo plano.)
 */
export function trancarCofre(): void {
  chaveEmMemoria = null
}

export async function biometriaLigada(): Promise<boolean> {
  return (await SecureStore.getItemAsync(LIGADA, OPCOES)) === '1'
}

/** Esquece tudo da biometria (chave, refresh cifrado e a marca). */
async function apagarCofre(): Promise<void> {
  chaveEmMemoria = null
  await SecureStore.deleteItemAsync(LIGADA, OPCOES)
  await SecureStore.deleteItemAsync(CIFRADO, OPCOES)
  await SecureStore.deleteItemAsync(CHAVE_DA_BIOMETRIA, OPCOES_DA_CHAVE).catch(() => undefined)
}

/** Lê a chave pedindo a biometria (o sistema mostra o pedido). */
async function abrirChave(): Promise<AESEncryptionKey | null> {
  let bruta: string | null
  try {
    bruta = await SecureStore.getItemAsync(CHAVE_DA_BIOMETRIA, {
      ...OPCOES_DA_CHAVE,
      authenticationPrompt: 'Desbloquear o Uni Jovem',
    })
  } catch {
    throw new BiometriaRecusada()
  }
  return bruta ? AESEncryptionKey.import(bruta, 'base64') : null
}

/**
 * Liga a biometria para esta sessão. Exige um refresh guardado (sessão aberta)
 * e a confirmação da pessoa: no iOS gravar no Keychain não pede o rosto, então
 * a confirmação vem antes; no Android a própria gravação já pede.
 */
export async function ligarBiometria(): Promise<void> {
  const refresh = await SecureStore.getItemAsync(CHAVE, OPCOES)
  if (!refresh) throw new Error('Não há sessão neste aparelho para proteger.')
  if (Platform.OS === 'ios' && !(await confirmarComBiometria('Confirme para usar o Face ID'))) {
    throw new BiometriaRecusada()
  }
  const chave = await AESEncryptionKey.generate(AESKeySize.AES256)
  try {
    await SecureStore.setItemAsync(CHAVE_DA_BIOMETRIA, await chave.encoded('base64'), {
      ...OPCOES_DA_CHAVE,
      authenticationPrompt: 'Confirme para usar a biometria',
    })
  } catch {
    throw new BiometriaRecusada()
  }
  // Ordem pensada para queda no meio: primeiro o cifrado, depois a marca, por fim some o aberto.
  await SecureStore.setItemAsync(CIFRADO, await cifrar(chave, refresh), OPCOES)
  await SecureStore.setItemAsync(LIGADA, '1', OPCOES)
  await SecureStore.deleteItemAsync(CHAVE, OPCOES)
  chaveEmMemoria = chave
}

/** Desliga: o refresh volta a ficar só no Keychain/Keystore, sem a biometria. */
export async function desligarBiometria(): Promise<void> {
  if (!(await biometriaLigada())) return
  const chave = chaveEmMemoria ?? (await abrirChave())
  const cifrado = await SecureStore.getItemAsync(CIFRADO, OPCOES)
  if (chave && cifrado) {
    await SecureStore.setItemAsync(CHAVE, await decifrar(chave, cifrado), OPCOES)
  }
  await apagarCofre()
}

export function criarArmazenamentoDoRefresh(): ArmazenamentoDoRefresh | null {
  return {
    async ler() {
      if (!(await biometriaLigada())) return SecureStore.getItemAsync(CHAVE, OPCOES)
      const cifrado = await SecureStore.getItemAsync(CIFRADO, OPCOES)
      if (!cifrado) {
        await apagarCofre()
        return null
      }
      chaveEmMemoria ??= await abrirChave()
      if (!chaveEmMemoria) {
        // Chave invalidada (biometria trocada no aparelho): só a senha reabre.
        await apagarCofre()
        return null
      }
      try {
        return await decifrar(chaveEmMemoria, cifrado)
      } catch {
        await apagarCofre()
        return null
      }
    },
    async gravar(valor) {
      if ((await biometriaLigada()) && chaveEmMemoria) {
        await SecureStore.setItemAsync(CIFRADO, await cifrar(chaveEmMemoria, valor), OPCOES)
        return
      }
      // Sessão nova (ex.: entrou com a senha em vez do rosto): a sessão trancada antiga
      // não tem como ser aberta sem a biometria, então o cofre recomeça desligado.
      await apagarCofre()
      await SecureStore.setItemAsync(CHAVE, valor, OPCOES)
    },
    async apagar() {
      await apagarCofre()
      await SecureStore.deleteItemAsync(CHAVE, OPCOES)
    },
  }
}
