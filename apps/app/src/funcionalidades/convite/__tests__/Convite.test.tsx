import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { lerComunidadeAtiva } from '@/estado/comunidadeAtivaSalva'
import { COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'

import { AceitarComConta } from '../AceitarComConta'
import { CadastroPorConvite } from '../CadastroPorConvite'
import {
  descartarConviteEmEspera,
  guardarConviteEmEspera,
  lerConviteEmEspera,
} from '../conviteEmEspera'
import { TelaConvite } from '../TelaConvite'
import { apagarTravaDeIdade, marcarMenorDe16 } from '../travaDeIdade'

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

async function irParaEmailESenha() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Criar conta com e-mail' }))
  await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'lia@exemplo.com')
  await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), 'umaSenhaBemLonga#2026')
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
}

async function preencherNome() {
  await fireEvent.changeText(await screen.findByLabelText('Como você se chama?'), 'Lia Rocha')
}

describe('conta nova por convite', () => {
  test('começa pelo convite e pelos acessos; "Criar conta com e-mail" é primário sem provedores', async () => {
    await renderizarTela(<CadastroPorConvite token={TOKEN} comunidade="Jovens Centro" />)
    expect(await screen.findByRole('header', { name: 'Crie sua conta' })).toBeOnTheScreen()
    expect(screen.getByText('Crie sua conta para participar da Jovens Centro.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Criar conta com e-mail' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Já tem conta? Entrar' })).toBeOnTheScreen()
  })

  test('"Já tem conta? Entrar" guarda o convite e abre o e-mail, para voltar a ele depois de entrar', async () => {
    await renderizarTela(<CadastroPorConvite token={TOKEN} comunidade="Jovens Centro" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Já tem conta? Entrar' }))
    expect(lerConviteEmEspera()).toBe(TOKEN)
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrar', params: { modo: 'email' } })
    descartarConviteEmEspera()
  })

  test('menor de 16 vê a explicação e o fluxo para sem enviar nada', async () => {
    const { servidor } = await renderizarTela(
      <CadastroPorConvite token={TOKEN} comunidade="Jovens Centro" />,
    )
    await irParaEmailESenha()
    await preencherNome()
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tenho menos de 16 anos.' }))

    expect(
      await screen.findByText(/Para ter uma conta no Uni Jovem é preciso ter 16 anos ou mais/),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
    expect(pedidosPara(servidor, 'POST', '/api/auth/convite/criar')).toHaveLength(0)
  })

  test('e-mail e senha, depois "Falta pouco" (idade e Termos) e, por fim, a fé; sem WhatsApp e sem código', async () => {
    const { servidor } = await renderizarTela(
      <CadastroPorConvite token={TOKEN} comunidade="Jovens Centro" />,
      {
        rotas: {
          'POST /api/auth/convite/criar': () => ({
            status: 422,
            corpo: { erro: 'parar_aqui', mensagem: 'Fim do teste.' },
          }),
        },
      },
    )
    await irParaEmailESenha()
    expect(await screen.findByRole('header', { name: 'Falta pouco' })).toBeOnTheScreen()
    // Nem WhatsApp opcional, nem código por e-mail.
    expect(screen.queryByLabelText(/WhatsApp/)).toBeNull()
    expect(screen.queryByLabelText('Código de 6 números')).toBeNull()
    await preencherNome()
    const continuar = screen.getByRole('button', { name: 'Continuar' })
    // Nenhuma opção vem marcada e o botão explica o que falta.
    expect(continuar).toBeDisabled()
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

    const criar = await screen.findByRole('button', {
      name: 'Criar conta e participar da Jovens Centro',
    })
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
    const corpo = pedidosPara(servidor, 'POST', '/api/auth/convite/criar')[0]!.corpo as object
    expect(corpo).toMatchObject({
      token: TOKEN,
      email: 'lia@exemplo.com',
      nome: 'Lia Rocha',
      senha: 'umaSenhaBemLonga#2026',
      faixaEtaria: '16_17',
      aceiteTermos: true,
      consentimentoFe: true,
      responsavelCiente: true,
    })
    expect(corpo).not.toHaveProperty('whatsapp')
  })

  test('senha curta: diz quantos caracteres faltam, sem pedir a senha duas vezes', async () => {
    await renderizarTela(<CadastroPorConvite token={TOKEN} comunidade="Jovens Centro" />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Criar conta com e-mail' }))
    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'lia@exemplo.com')
    await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), 'curta123')
    expect(screen.getByText('8 de 10 caracteres')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(
      await screen.findByText('Faltam 2 caracteres. Use pelo menos 10; uma frase curta funciona.'),
    ).toBeOnTheScreen()
    expect(screen.queryByLabelText('Repita a senha')).toBeNull()
  })

  test('o aparelho travado por menos de 16 não abre o cadastro', async () => {
    await marcarMenorDe16()
    await renderizarTela(<CadastroPorConvite token={TOKEN} comunidade="Jovens Centro" />)
    expect(await screen.findByText('Ainda não dá para criar a conta')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Criar conta com e-mail' })).toBeNull()
  })
})

describe('conta nova por convite: acessos rápidos e sem confirmação de e-mail', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  })

  test('com o Google: ele vem antes do e-mail, que fica em contorno; nada de código por e-mail', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-123.apps.googleusercontent.com'
    await renderizarTela(<CadastroPorConvite token={TOKEN} comunidade="Jovens Centro" />)

    const google = await screen.findByRole('button', { name: 'Continuar com o Google' })
    expect(google).toBeOnTheScreen()
    const nomes = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string)
    expect(nomes.indexOf('Continuar com o Google')).toBeLessThan(
      nomes.indexOf('Criar conta com e-mail'),
    )
    expect(screen.queryByText(/código de 6 números/i)).toBeNull()
    expect(screen.queryByText(/confirmar o e-mail/i)).toBeNull()
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

describe('convite que não serve', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    descartarConviteEmEspera()
  })

  test('sair do convite vencido esquece o token em espera: nada de voltar a ele a cada entrada', async () => {
    guardarConviteEmEspera(TOKEN)
    parametros.mockReturnValue({})
    await renderizarTela(<TelaConvite />, {
      rotas: {
        'POST /api/auth/convite/consultar': () => ({
          status: 200,
          corpo: { situacao: 'expirado' },
        }),
      },
    })
    expect(await screen.findByText('Este convite venceu')).toBeOnTheScreen()
    expect(lerConviteEmEspera()).toBe(TOKEN)
    await fireEvent.press(screen.getByRole('button', { name: 'Ir para o Início' }))
    expect(router.replace).toHaveBeenCalledWith('/')
    expect(lerConviteEmEspera()).toBeNull()
  })
})
