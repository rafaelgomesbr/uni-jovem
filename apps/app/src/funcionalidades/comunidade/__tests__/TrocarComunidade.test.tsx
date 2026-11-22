import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { renderizarTela, respostaEu } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'

import { TelaTrocarComunidade } from '../TelaTrocarComunidade'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(() => jest.fn()),
}))
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const OUTRA = '33333333-3333-4333-8333-000000000001'

function euComDuas() {
  const eu = respostaEu('membro')
  return {
    ...eu,
    comunidades: [
      ...eu.comunidades,
      { ...eu.comunidades[0]!, id: OUTRA, nome: 'Jovens Norte', papel: 'admin' },
    ],
  }
}

describe('trocar de comunidade (3.7.9)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('a atual vem marcada; o toque troca, fecha a folha e confirma com toast', async () => {
    await renderizarTela(<TelaTrocarComunidade />, {
      rotas: { 'GET /api/v1/eu': () => ({ status: 200, corpo: euComDuas() }) },
    })
    const norte = await screen.findByRole('radio', {
      name: /^Jovens Norte\. Seu papel: Administrador/,
    })
    expect(norte).not.toBeChecked()
    await fireEvent.press(norte)
    await waitFor(() => expect(router.back).toHaveBeenCalled())
    expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Agora em Jovens Norte' })
    expect(
      await screen.findByRole('radio', { name: /^Jovens Norte\..*Comunidade ativa agora\.$/ }),
    ).toBeChecked()
  })

  test('fechar existe sempre (nada só em gesto)', async () => {
    await renderizarTela(<TelaTrocarComunidade />, {
      rotas: { 'GET /api/v1/eu': () => ({ status: 200, corpo: euComDuas() }) },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar' }))
    expect(router.back).toHaveBeenCalled()
  })

  test('a folha também entra em outra, cria e sai da atual (a linha "Comunidades" do Perfil abre esta folha, D70)', async () => {
    await renderizarTela(<TelaTrocarComunidade />, {
      rotas: { 'GET /api/v1/eu': () => ({ status: 200, corpo: euComDuas() }) },
    })
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Entrar em outra comunidade/ }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/comece-por-aqui')
    await fireEvent.press(screen.getByRole('button', { name: /^Criar comunidade/ }))
    expect(router.push).toHaveBeenLastCalledWith('/criar-comunidade')
    // Sair da atual: destrutivo, com a consequência escrita para o leitor de tela.
    await screen.findByRole('radio', { name: /Comunidade ativa agora/ })
    expect(await screen.findByRole('button', { name: /^Sair de Jovens/ })).toBeOnTheScreen()
  })
})
