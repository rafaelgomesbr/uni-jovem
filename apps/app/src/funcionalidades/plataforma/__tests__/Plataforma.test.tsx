import { fireEvent, screen, waitFor } from '@testing-library/react-native'

import { pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'

import { TelaNovaComunidade } from '../TelaNovaComunidade'
import { TelaPlataforma } from '../TelaPlataforma'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}))

const CRIAR = '/api/v1/plataforma/comunidades'
const PROVAR = '/api/auth/2fa/provar'
const LINK = `https://app.exemplo/convite#t=${'b'.repeat(43)}`
const PEDE_CODIGO = {
  status: 403,
  corpo: {
    erro: 'segundo_fator_necessario',
    mensagem: 'Confirme o código do seu autenticador para continuar.',
  },
}

function euCriador() {
  const base = respostaEu('membro')
  return () => ({
    status: 200,
    corpo: { conta: { ...base.conta, criador: true, doisFatores: true }, comunidades: [] },
  })
}

describe('Plataforma do Criador', () => {
  test('"Criar comunidade" aparece mesmo antes do código; a lista pede o código', async () => {
    await renderizarTela(<TelaPlataforma />, {
      rotas: {
        'GET /api/v1/eu': euCriador(),
        [`GET ${CRIAR}`]: () => PEDE_CODIGO,
      },
    })
    expect(await screen.findByRole('button', { name: 'Criar comunidade' })).toBeOnTheScreen()
    expect(await screen.findByLabelText('Código do app autenticador')).toBeOnTheScreen()
  })

  test('step-up: a ação recebe 403, pede o código e repete o mesmo pedido', async () => {
    let tentativas = 0
    const { servidor } = await renderizarTela(<TelaNovaComunidade />, {
      rotas: {
        'GET /api/v1/eu': euCriador(),
        [`POST ${CRIAR}`]: () =>
          ++tentativas === 1
            ? PEDE_CODIGO
            : {
                status: 200,
                corpo: {
                  id: '99999999-9999-4999-8999-000000000001',
                  conviteDoPrimeiroAdmin: { link: LINK, expiraEm: '2026-11-21T12:00:00.000Z' },
                },
              },
        [`POST ${PROVAR}`]: () => ({ status: 200, corpo: { acesso: 'acesso-com-prova' } }),
      },
    })

    await fireEvent.changeText(await screen.findByLabelText('Nome da comunidade'), 'Jovens Norte')
    await fireEvent.press(screen.getByRole('radio', { name: 'Outra pessoa' }))
    await fireEvent.changeText(
      screen.getByLabelText('E-mail de quem vai administrar (opcional)'),
      'lider@exemplo.com',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Criar a comunidade Jovens Norte' }))

    // O pedido do código abre por cima; nada foi criado ainda.
    const codigo = await screen.findByLabelText('Código do app autenticador')
    expect(pedidosPara(servidor, 'POST', CRIAR)).toHaveLength(1)
    await fireEvent.changeText(codigo, '123456')
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('button', { name: 'Copiar link' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', PROVAR)[0]?.corpo).toEqual({ codigo: '123456' })
    const criacoes = pedidosPara(servidor, 'POST', CRIAR)
    expect(criacoes).toHaveLength(2)
    // O mesmo pedido, agora com o token que carrega a prova.
    expect(criacoes[1]?.corpo).toEqual(criacoes[0]?.corpo)
    expect(criacoes[1]?.corpo).toMatchObject({
      nome: 'Jovens Norte',
      emailDoAdmin: 'lider@exemplo.com',
    })
    expect(criacoes[1]?.cabecalhos.authorization).toBe('Bearer acesso-com-prova')
  })

  test('"Eu serei o administrador" prende o convite ao meu e-mail e abre o aceite', async () => {
    const { servidor } = await renderizarTela(<TelaNovaComunidade />, {
      rotas: {
        'GET /api/v1/eu': euCriador(),
        [`POST ${CRIAR}`]: () => ({
          status: 200,
          corpo: {
            id: '99999999-9999-4999-8999-000000000002',
            conviteDoPrimeiroAdmin: { link: LINK, expiraEm: '2026-11-21T12:00:00.000Z' },
          },
        }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Nome da comunidade'), 'Jovens Sul')
    await fireEvent.press(screen.getByRole('button', { name: 'Criar a comunidade Jovens Sul' }))

    expect(await screen.findByText('Agora, entre nela')).toBeOnTheScreen()
    await waitFor(() => expect(pedidosPara(servidor, 'POST', CRIAR)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', CRIAR)[0]?.corpo).toMatchObject({
      nome: 'Jovens Sul',
      emailDoAdmin: 'ana@exemplo.com',
    })
  })
})
