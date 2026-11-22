import { onlineManager } from '@tanstack/react-query'
import { screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'

import { criarDeposito } from '@/funcionalidades/offline/deposito'
import { EventosPreparados } from '@/funcionalidades/offline/EventosPreparados'
import { ProvedorOffline } from '@/funcionalidades/offline/ProvedorOffline'
import { baixarRepertorio } from '@/funcionalidades/offline/repertorioOffline'
import { EVENTO_ID } from '@/testes/fixturas'
import { limparAparelho } from '@/testes/offline'
import { pacoteDoRepertorioDeTeste } from '@/testes/repertorio'
import { COMUNIDADE, renderizarTela } from '@/testes/telas'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}))

beforeEach(() => {
  jest.clearAllMocks()
  limparAparelho()
  onlineManager.setOnline(true)
})

describe('baixados para usar sem internet no Início', () => {
  test('o repertório guardado aparece com o número de músicas e abre o Meu repertório', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar({
      contaId: 'conta-eu',
      comunidadeId: COMUNIDADE,
      vinculoId: null,
      validadeDias: 7,
    })
    await baixarRepertorio(p, { get: async () => pacoteDoRepertorioDeTeste() } as never, EVENTO_ID)

    await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <EventosPreparados />
      </ProvedorOffline>,
      {
        papel: 'membro',
        rotas: {
          // A rodada de sincronização confere a versão da cópia: a mesma, "inalterado".
          [`GET /api/v1/c/${COMUNIDADE}/eventos/${EVENTO_ID}/repertorio/pacote`]: () => ({
            status: 200,
            corpo: { versao: 'versao-1', inalterado: true },
          }),
          [`GET /api/v1/c/${COMUNIDADE}/sync/mudancas`]: () => ({
            status: 200,
            corpo: { recomecar: false, mudancas: [], cursor: '1000:0', temMais: false },
          }),
        },
      },
    )

    expect(await screen.findByText('Repertório: Sábado com a juventude')).toBeOnTheScreen()
    expect(screen.getByText(/^2 músicas · /)).toBeOnTheScreen()
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: /^Repertório de Sábado com a juventude/ }))
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
  })

  test('sem nada guardado, a seção nem aparece', async () => {
    await renderizarTela(
      <ProvedorOffline deposito={criarDeposito()}>
        <EventosPreparados />
      </ProvedorOffline>,
      { papel: 'membro' },
    )
    expect(screen.queryByText('Baixados para usar sem internet')).toBeNull()
  })
})
