import { fireEvent, screen, waitFor } from '@testing-library/react-native'

import { pedidosPara, renderizarTela } from '@/testes/telas'

import { AceitarComConta } from '../AceitarComConta'
import { CadastroPorConvite } from '../CadastroPorConvite'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const TOKEN = 'c'.repeat(43)

async function preencherDados() {
  await fireEvent.changeText(await screen.findByLabelText('Nome'), 'Lia Rocha')
  await fireEvent.changeText(screen.getByLabelText('E-mail'), 'lia@exemplo.com')
}

describe('conta nova por convite', () => {
  test('menor de 16 vê a explicação e o fluxo para sem enviar nada', async () => {
    const { servidor } = await renderizarTela(
      <CadastroPorConvite token={TOKEN} comunidade="Jovens Centro" />,
    )
    await preencherDados()
    await fireEvent.press(screen.getByRole('radio', { name: 'Tenho menos de 16 anos.' }))

    expect(
      await screen.findByText(/Para ter uma conta no Uni Jovem é preciso ter 16 anos ou mais/),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Enviar código' })).toBeNull()
    expect(pedidosPara(servidor, 'POST', '/api/auth/convite/iniciar')).toHaveLength(0)
  })

  test('idade e Termos antes do código; consentimento sobre a fé antes de criar a conta', async () => {
    const { servidor } = await renderizarTela(
      <CadastroPorConvite token={TOKEN} comunidade="Jovens Centro" />,
      {
        rotas: {
          'POST /api/auth/convite/iniciar': () => ({
            status: 200,
            corpo: { verificacaoId: '66666666-6666-4666-8666-000000000001' },
          }),
          'POST /api/auth/convite/concluir': () => ({
            status: 422,
            corpo: { erro: 'parar_aqui', mensagem: 'Fim do teste.' },
          }),
        },
      },
    )
    await preencherDados()
    const enviar = screen.getByRole('button', { name: 'Enviar código' })
    // Nenhuma opção vem marcada e o botão explica o que falta.
    expect(enviar).toBeDisabled()
    expect(screen.getByText('Responda quantos anos você tem.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: /^Tenho 16 ou 17 anos/ }))
    expect(
      screen.getByText('Para criar a conta, é preciso concordar com os Termos de Uso.'),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Li e concordo com os Termos de Uso e a Política de Privacidade.',
      }),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', '/api/auth/convite/iniciar')).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', '/api/auth/convite/iniciar')[0]!.corpo).toMatchObject({
      faixaEtaria: '16_17',
    })

    await fireEvent.changeText(await screen.findByLabelText('Código de 6 números'), '123456')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.changeText(await screen.findByLabelText('Senha'), 'umaSenhaBemLonga#2026')
    await fireEvent.changeText(screen.getByLabelText('Repita a senha'), 'umaSenhaBemLonga#2026')

    const criar = screen.getByRole('button', { name: 'Criar conta e entrar em Jovens Centro' })
    expect(criar).toBeDisabled()
    expect(await screen.findByText('Sobre a sua fé')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Concordo que a Jovens Centro/ }))
    // 16 ou 17 anos: falta a ciência do responsável.
    expect(criar).toBeDisabled()
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Meu pai, minha mãe ou meu responsável legal sabe deste consentimento e concorda.',
      }),
    )
    await fireEvent.press(criar)

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', '/api/auth/convite/concluir')).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', '/api/auth/convite/concluir')[0]!.corpo).toMatchObject({
      faixaEtaria: '16_17',
      aceiteTermos: true,
      consentimentoFe: true,
      responsavelCiente: true,
    })
  })
})

describe('conta existente aceitando convite', () => {
  test('pede o consentimento sobre a fé e, se a API pedir, a faixa de idade', async () => {
    let tentativas = 0
    const { servidor } = await renderizarTela(
      <AceitarComConta token={TOKEN} comunidade="Jovens Centro" papel="Membro" />,
      {
        rotas: {
          'POST /api/auth/convite/aceitar': (p) => {
            tentativas++
            if (!(p.corpo as { faixaEtaria?: string }).faixaEtaria) {
              return {
                status: 422,
                corpo: {
                  erro: 'faixa_etaria_necessaria',
                  mensagem: 'Antes de entrar na comunidade, informe a sua faixa de idade.',
                },
              }
            }
            return { status: 200, corpo: { vinculoId: 'v1' } }
          },
        },
      },
    )
    const entrar = await screen.findByRole('button', {
      name: 'Entrar em Jovens Centro como Membro',
    })
    expect(entrar).toBeDisabled()
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Concordo que a Jovens Centro/ }))
    await fireEvent.press(entrar)

    await fireEvent.press(await screen.findByRole('radio', { name: 'Tenho 18 anos ou mais.' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'Entrar em Jovens Centro como Membro' }),
    )

    expect(
      await screen.findByText('Agora você participa de Jovens Centro como Membro.'),
    ).toBeOnTheScreen()
    expect(tentativas).toBe(2)
    expect(pedidosPara(servidor, 'POST', '/api/auth/convite/aceitar')[1]!.corpo).toEqual({
      token: TOKEN,
      consentimentoFe: true,
      faixaEtaria: '18_mais',
      responsavelCiente: false,
    })
  })
})
