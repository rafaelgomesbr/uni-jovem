import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Alert } from 'react-native'

import { COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'

import { TelaExcluirConta } from '../TelaExcluirConta'
import { TelaPrivacidade } from '../TelaPrivacidade'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

describe('privacidade', () => {
  afterEach(() => jest.restoreAllMocks())

  test('exportar meus dados entrega o arquivo da API para compartilhar', async () => {
    const { shareAsync } = jest.requireMock('expo-sharing') as { shareAsync: jest.Mock }
    const { servidor } = await renderizarTela(<TelaPrivacidade />, {
      rotas: { 'GET /api/v1/eu/exportar': () => ({ status: 200, corpo: { conta: {} } }) },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Gerar arquivo' }))
    await waitFor(() => expect(shareAsync).toHaveBeenCalled())
    expect(shareAsync.mock.calls.at(-1)![1]).toMatchObject({ mimeType: 'application/json' })
    expect(pedidosPara(servidor, 'GET', '/api/v1/eu/exportar')).toHaveLength(1)
  })

  test('excluir conta: único admin recebe o caminho para nomear outra pessoa', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, b) => b?.at(-1)?.onPress?.())
    const { servidor } = await renderizarTela(<TelaExcluirConta />, {
      papel: 'admin',
      rotas: {
        'POST /api/v1/eu/excluir-conta': () => ({
          status: 409,
          corpo: {
            erro: 'unico_admin',
            mensagem: 'Você é a única pessoa administradora de Jovens Centro.',
            acao: 'nomear_admin',
            comunidades: [{ id: COMUNIDADE, nome: 'Jovens Centro' }],
          },
        }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Senha'), 'minha senha')
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir minha conta' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', '/api/v1/eu/excluir-conta')[0]?.corpo).toEqual({
        senha: 'minha senha',
      }),
    )
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Abrir os membros de Jovens Centro' }),
    )
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/comunidade'))
  })
})
