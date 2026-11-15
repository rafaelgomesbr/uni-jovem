import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

import {
  BiometriaRecusada,
  biometriaLigada,
  criarArmazenamentoDoRefresh,
  desligarBiometria,
  ligarBiometria,
  trancarCofre,
} from '../armazenamentoDoRefresh'

/**
 * Cofre da biometria com o SecureStore em memória e AES-GCM de verdade (Node).
 * O dublê do SecureStore ignora `requireAuthentication`; aqui ele passa a
 * recusar a leitura protegida quando o teste simula "cancelou o Face ID".
 */

const cofre = (SecureStore as unknown as { __cofre: Map<string, string> }).__cofre
const ler = SecureStore.getItemAsync as jest.Mock
const gravar = SecureStore.setItemAsync as jest.Mock
const autenticar = LocalAuthentication.authenticateAsync as jest.Mock

let recusarBiometria = false
const lerOriginal = ler.getMockImplementation()!

beforeEach(() => {
  cofre.clear()
  trancarCofre()
  recusarBiometria = false
  jest.clearAllMocks()
  ler.mockImplementation(async (chave: string, opcoes?: SecureStore.SecureStoreOptions) => {
    if (opcoes?.requireAuthentication && recusarBiometria) throw new Error('user canceled')
    return lerOriginal(chave, opcoes)
  })
  autenticar.mockResolvedValue({ success: true })
})

const armazenamento = criarArmazenamentoDoRefresh()!

describe('cofre da biometria', () => {
  test('sem biometria, o refresh fica guardado como sempre', async () => {
    await armazenamento.gravar('refresh-aberto-1')
    expect(cofre.get('uj.refresh')).toBe('refresh-aberto-1')
    expect(await armazenamento.ler()).toBe('refresh-aberto-1')
    expect(await biometriaLigada()).toBe(false)
  })

  test('ligar cifra o refresh, prende a chave à biometria e tira o refresh aberto', async () => {
    await armazenamento.gravar('refresh-aberto-1')
    await ligarBiometria()

    expect(autenticar).toHaveBeenCalledTimes(1)
    expect(await biometriaLigada()).toBe(true)
    expect(cofre.has('uj.refresh')).toBe(false)
    expect(cofre.get('uj.refresh.cifrado')).toBeTruthy()
    expect(cofre.get('uj.refresh.cifrado')).not.toContain('refresh-aberto-1')
    const gravacaoDaChave = gravar.mock.calls.find(([chave]) => chave === 'uj.biometria.chave')
    expect(gravacaoDaChave?.[2]).toMatchObject({
      requireAuthentication: true,
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    })
    // Com o app aberto, a chave está em memória: renovar e regravar não pedem o rosto.
    expect(await armazenamento.ler()).toBe('refresh-aberto-1')
    await armazenamento.gravar('refresh-girado-2')
    expect(await armazenamento.ler()).toBe('refresh-girado-2')
    expect(cofre.has('uj.refresh')).toBe(false)
  })

  test('na abertura, só a biometria libera; cancelar mantém a sessão trancada', async () => {
    await armazenamento.gravar('refresh-aberto-1')
    await ligarBiometria()
    trancarCofre()

    recusarBiometria = true
    await expect(armazenamento.ler()).rejects.toBeInstanceOf(BiometriaRecusada)
    // Nada se perdeu: tentar de novo com o rosto certo abre.
    expect(cofre.get('uj.refresh.cifrado')).toBeTruthy()
    recusarBiometria = false
    expect(await armazenamento.ler()).toBe('refresh-aberto-1')
    const leituraProtegida = ler.mock.calls.find(([chave]) => chave === 'uj.biometria.chave')
    expect(leituraProtegida?.[1]).toMatchObject({ requireAuthentication: true })
  })

  test('no iOS, recusar a confirmação não liga nada', async () => {
    await armazenamento.gravar('refresh-aberto-1')
    autenticar.mockResolvedValue({ success: false, error: 'user_cancel' })
    await expect(ligarBiometria()).rejects.toBeInstanceOf(BiometriaRecusada)
    expect(await biometriaLigada()).toBe(false)
    expect(cofre.get('uj.refresh')).toBe('refresh-aberto-1')
  })

  test('entrar com a senha enquanto trancada recomeça o cofre desligado', async () => {
    await armazenamento.gravar('refresh-antigo')
    await ligarBiometria()
    trancarCofre()

    await armazenamento.gravar('refresh-da-senha')
    expect(await biometriaLigada()).toBe(false)
    expect(cofre.get('uj.refresh')).toBe('refresh-da-senha')
    expect(cofre.has('uj.refresh.cifrado')).toBe(false)
    expect(cofre.has('uj.biometria.chave')).toBe(false)
  })

  test('desligar devolve o refresh ao armazenamento comum', async () => {
    await armazenamento.gravar('refresh-aberto-1')
    await ligarBiometria()
    await desligarBiometria()
    expect(await biometriaLigada()).toBe(false)
    expect(cofre.get('uj.refresh')).toBe('refresh-aberto-1')
    expect(cofre.has('uj.biometria.chave')).toBe(false)
  })

  test('sair apaga tudo, inclusive a chave da biometria', async () => {
    await armazenamento.gravar('refresh-aberto-1')
    await ligarBiometria()
    await armazenamento.apagar()
    expect([...cofre.keys()]).toEqual([])
    expect(await armazenamento.ler()).toBeNull()
  })
})
