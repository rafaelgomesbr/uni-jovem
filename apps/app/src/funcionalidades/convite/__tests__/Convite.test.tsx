import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { lerComunidadeAtiva } from '@/estado/comunidadeAtivaSalva'
import { COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'

import { AceitarComConta } from '../AceitarComConta'
import { CadastroPorConvite } from '../CadastroPorConvite'
import { TelaConvite } from '../TelaConvite'
import { apagarTravaDeIdade } from '../travaDeIdade'

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

const parametros = useLocalSearchParams as jest.Mock

// "Menos de 16" trava o cadastro no aparelho por 24 horas (TC-01.v2): cada teste começa sem a trava.
beforeEach(() => apagarTravaDeIdade())

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
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
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
          'POST /api/auth/convite/criar': () => ({
            status: 422,
            corpo: { erro: 'parar_aqui', mensagem: 'Fim do teste.' },
          }),
        },
      },
    )
    await preencherDados()
    const enviar = screen.getByRole('button', { name: 'Continuar' })
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
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(pedidosPara(servidor, 'POST', '/api/auth/convite/iniciar')).toHaveLength(0)
    expect(screen.queryByLabelText('Código de 6 números')).toBeNull()
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
      expect(pedidosPara(servidor, 'POST', '/api/auth/convite/criar')).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', '/api/auth/convite/criar')[0]!.corpo).toMatchObject({
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
    // Sem marcar, o botão não envia nada: o que falta aparece junto da caixa.
    await fireEvent.press(entrar)
    expect(
      await screen.findByText('Para entrar na comunidade, marque a concordância sobre a sua fé.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('checkbox', { name: /^Concordo que a Jovens Centro/ })).toHaveProp(
      'accessibilityHint',
      'Erro: Para entrar na comunidade, marque a concordância sobre a sua fé.',
    )
    expect(pedidosPara(servidor, 'POST', '/api/auth/convite/aceitar')).toHaveLength(0)
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Concordo que a Jovens Centro/ }))
    expect(
      screen.queryByText('Para entrar na comunidade, marque a concordância sobre a sua fé.'),
    ).toBeNull()
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

  test('a API diz que a conta já participa: estado claro com "Abrir", nunca um botão mudo', async () => {
    await renderizarTela(
      <AceitarComConta token={TOKEN} comunidade="Jovens Centro" papel="Membro" />,
      {
        rotas: {
          'POST /api/auth/convite/aceitar': () => ({
            status: 409,
            corpo: { erro: 'ja_participa', mensagem: 'Você já participa desta comunidade.' },
          }),
        },
      },
    )
    await fireEvent.press(
      await screen.findByRole('checkbox', { name: /^Concordo que a Jovens Centro/ }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Entrar em Jovens Centro como Membro' }),
    )

    expect(await screen.findByText('Você já faz parte de Jovens Centro')).toBeOnTheScreen()
    expect(screen.queryByText('Sobre a sua fé')).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir Jovens Centro' }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
    expect(await lerComunidadeAtiva('conta-eu')).toBe(COMUNIDADE)
  })

  test('convite usado ou vencido: a mensagem da API em tela inteira, com saída', async () => {
    await renderizarTela(
      <AceitarComConta token={TOKEN} comunidade="Jovens Centro" papel="Membro" />,
      {
        rotas: {
          'POST /api/auth/convite/aceitar': () => ({
            status: 409,
            corpo: {
              erro: 'convite_indisponivel',
              mensagem: 'Este convite já foi usado. Peça um novo a quem convidou você.',
            },
          }),
        },
      },
    )
    await fireEvent.press(
      await screen.findByRole('checkbox', { name: /^Concordo que a Jovens Centro/ }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Entrar em Jovens Centro como Membro' }),
    )

    expect(await screen.findByText('Este convite não vale mais')).toBeOnTheScreen()
    expect(
      screen.getByText('Este convite já foi usado. Peça um novo a quem convidou você.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ir para o Início' })).toBeOnTheScreen()
  })

  test('outra falha: aviso em linguagem humana acima dos botões, e dá para tentar de novo', async () => {
    let tentativas = 0
    await renderizarTela(
      <AceitarComConta token={TOKEN} comunidade="Jovens Centro" papel="Membro" />,
      {
        rotas: {
          'POST /api/auth/convite/aceitar': () => {
            tentativas++
            return tentativas === 1
              ? { status: 503, corpo: { erro: 'indisponivel', mensagem: 'Tente de novo já já.' } }
              : { status: 200, corpo: { vinculoId: 'v1' } }
          },
        },
      },
    )
    await fireEvent.press(
      await screen.findByRole('checkbox', { name: /^Concordo que a Jovens Centro/ }),
    )
    const entrar = screen.getByRole('button', { name: 'Entrar em Jovens Centro como Membro' })
    await fireEvent.press(entrar)

    expect(await screen.findByText('Não deu para entrar na comunidade')).toBeOnTheScreen()
    expect(screen.getByText('Tente de novo já já.')).toBeOnTheScreen()
    await fireEvent.press(entrar)
    expect(
      await screen.findByText('Agora você participa de Jovens Centro como Membro.'),
    ).toBeOnTheScreen()
  })
})

describe('convite aberto por quem já está conectado', () => {
  beforeEach(() => jest.clearAllMocks())

  function consultaDoConvite(nome: string, cor: string) {
    return {
      'POST /api/auth/convite/consultar': () => ({
        status: 200,
        corpo: { situacao: 'valido', comunidade: { nome, cor }, papel: 'membro' },
      }),
    }
  }

  test('da comunidade em que já participa: "Você já faz parte", sem o aceite', async () => {
    parametros.mockReturnValue({ '#': `t=${TOKEN}` })
    // A comunidade de teste da sessão: Jovens Centro, #5B4BDB.
    await renderizarTela(<TelaConvite />, { rotas: consultaDoConvite('Jovens Centro', '#5B4BDB') })

    expect(await screen.findByText('Você já faz parte de Jovens Centro')).toBeOnTheScreen()
    expect(screen.queryByText('Sobre a sua fé')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Entrar em/ })).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir Jovens Centro' }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
  })

  test('de outra comunidade: o aceite continua', async () => {
    parametros.mockReturnValue({ '#': `t=${TOKEN}` })
    await renderizarTela(<TelaConvite />, { rotas: consultaDoConvite('Jovens Norte', '#C2410C') })

    expect(await screen.findByText('Você recebeu um convite')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Entrar em Jovens Norte como Membro' })).toBeEnabled()
    expect(screen.queryByText(/Você já faz parte/)).toBeNull()
  })
})
