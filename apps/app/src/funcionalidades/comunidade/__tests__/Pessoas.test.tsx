import { fireEvent, screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'

import { BASE, MEU_VINCULO, PESSOAS, renderizarTela } from '@/testes/telas'

import { TelaPessoas } from '../TelaPessoas'

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

const SO_EU = () => ({
  status: 200,
  corpo: {
    membros: [
      {
        ...PESSOAS[0]!,
        papel: 'admin',
        estado: 'ativo',
        designacoes: [],
        email: null,
        whatsapp: null,
        criador: false,
        desde: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
})

describe('Pessoas (rota /pessoas, aberta pelo mural)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('lista todos com o papel em texto e busca pelo nome, sem acento', async () => {
    await renderizarTela(<TelaPessoas />, { papel: 'membro' })
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.getByText('Carla Dias')).toBeOnTheScreen()
    expect(screen.getAllByText('Membro').length).toBeGreaterThan(0)

    await fireEvent.changeText(screen.getByLabelText('Buscar pelo nome'), 'carlá')
    expect(screen.getByText('Carla Dias')).toBeOnTheScreen()
    expect(screen.queryByText('Bruno Lima')).toBeNull()

    await fireEvent.changeText(screen.getByLabelText('Buscar pelo nome'), 'zzz')
    expect(await screen.findByText('Ninguém com esse nome')).toBeOnTheScreen()
    // O campo e o vazio oferecem "Limpar a busca": os dois limpam.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Limpar a busca' }).at(-1)!)
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
  })

  test('quem pode mudar papel abre a pessoa; ninguém abre a si mesmo', async () => {
    await renderizarTela(<TelaPessoas />, { papel: 'admin' })
    const usuario = userEvent.setup()
    await usuario.press(
      await screen.findByRole('button', { name: /^Bruno Lima\. Membro\. Abrir para mudar/ }),
    )
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/membro/[vinculoId]',
      params: { vinculoId: PESSOAS[1]!.vinculoId },
    })
    expect(MEU_VINCULO).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Ana Souza \(você\)\. .*Abrir/ })).toBeNull()
  })

  test('membro não abre ninguém (a lista é só para ler)', async () => {
    await renderizarTela(<TelaPessoas />, { papel: 'membro' })
    await screen.findByText('Bruno Lima')
    expect(screen.queryByRole('button', { name: /Abrir para mudar/ })).toBeNull()
  })

  test('só você: o vazio diz o que fazer e a administração ganha "Convidar"', async () => {
    await renderizarTela(<TelaPessoas />, {
      papel: 'admin',
      rotas: { [`GET ${BASE}/membros`]: SO_EU },
    })
    expect(await screen.findByText('Por enquanto, só você.')).toBeOnTheScreen()
    expect(screen.getByText('Convide o grupo para o Uni Jovem.')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Convidar' }))
    expect(router.push).toHaveBeenLastCalledWith('/convidar')
  })

  test('só você, sem poder convidar: texto de espera e nenhum botão', async () => {
    await renderizarTela(<TelaPessoas />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/membros`]: () => ({
          status: 200,
          corpo: {
            membros: [{ ...SO_EU().corpo.membros[0]!, papel: 'membro' }],
          },
        }),
      },
    })
    expect(await screen.findByText('Por enquanto, só você.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Convidar' })).toBeNull()
  })

  test('erro: texto humano e "Tentar de novo"', async () => {
    await renderizarTela(<TelaPessoas />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/membros`]: () => ({
          status: 500,
          corpo: { codigo: 'erro_interno', mensagem: 'falha' },
        }),
      },
    })
    expect(await screen.findByText('As pessoas não carregaram')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })
})
