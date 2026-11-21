import { ErroDaApi, SemConexao } from '@/servicos/erros'

import { criarClienteDeConsulta, LEITURAS_NOVAS_TENTATIVAS } from '../clienteDeConsulta'

/**
 * `gcTime: Infinity` nas chamadas: sem relógio de limpeza de cache, o Jest encerra.
 * D58: leitura que falha por rede ou tempo tenta mais UMA vez; resposta da API
 * (permissão, validação) não repete; escrita nunca repete.
 */
describe('política de tentativas do cliente de consulta', () => {
  test('leitura sem rede: uma nova tentativa, no total de duas chamadas', async () => {
    const cliente = criarClienteDeConsulta()
    const chamadas = jest.fn(async () => {
      throw new SemConexao()
    })
    await expect(
      cliente.fetchQuery({ queryKey: ['a'], queryFn: chamadas, retryDelay: 0, gcTime: Infinity }),
    ).rejects.toBeInstanceOf(SemConexao)
    expect(LEITURAS_NOVAS_TENTATIVAS).toBe(1)
    expect(chamadas).toHaveBeenCalledTimes(2)
  })

  test('resposta da API é definitiva: não repete', async () => {
    const cliente = criarClienteDeConsulta()
    const chamadas = jest.fn(async () => {
      throw new ErroDaApi(403, 'sem_permissao', 'Sem permissão.')
    })
    await expect(
      cliente.fetchQuery({ queryKey: ['b'], queryFn: chamadas, retryDelay: 0, gcTime: Infinity }),
    ).rejects.toBeInstanceOf(ErroDaApi)
    expect(chamadas).toHaveBeenCalledTimes(1)
  })

  test('escrita nunca repete e falha na hora sem rede', async () => {
    const cliente = criarClienteDeConsulta()
    expect(cliente.getDefaultOptions().mutations).toMatchObject({
      retry: false,
      networkMode: 'always',
    })
    const chamadas = jest.fn(async () => {
      throw new SemConexao()
    })
    const mutacao = cliente
      .getMutationCache()
      .build(cliente, { mutationFn: chamadas, gcTime: Infinity })
    await expect(mutacao.execute(undefined)).rejects.toBeInstanceOf(SemConexao)
    expect(chamadas).toHaveBeenCalledTimes(1)
  })
})
