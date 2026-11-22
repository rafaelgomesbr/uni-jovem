import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Linking } from 'react-native'

import { BASE, COMUNIDADE, FUSO, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { confirmar } from '@/utilidades/confirmar'

import { mensagemDoConvite, TelaCodigoDaComunidade } from '../TelaCodigoDaComunidade'
import { TelaConfigurarComunidade } from '../TelaConfigurarComunidade'
import { RESUMO_DO_TERMO_DO_ADMIN, TelaCriarComunidade } from '../TelaCriarComunidade'
import { TermoDoAdminPendente } from '../TermoDoAdminPendente'

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
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))

const NOVA = '66666666-6666-4666-8666-000000000001'
const DETALHE = {
  id: COMUNIDADE,
  nome: 'Jovens Centro',
  cor: '#5B4BDB',
  fuso: FUSO,
  estado: 'ativa',
  validadeOfflineDias: 14,
  retencaoInscricoesDias: 90,
  versao: 1,
  meuPapel: 'admin',
  idPublico: 'b'.repeat(32),
  cidade: null,
  modoEntrada: 'codigo_com_aprovacao',
  encontravel: false,
  verificacao: 'nova',
  limites: { membrosAtivos: 30, eventoPublico: false },
  uso: { membrosAtivos: 12 },
}

function euSemComunidade(faixaEtaria?: '16_17' | '18_mais') {
  const base = respostaEu('membro')
  return () => ({
    status: 200,
    corpo: { conta: { ...base.conta, ...(faixaEtaria ? { faixaEtaria } : {}) }, comunidades: [] },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(confirmar).mockResolvedValue(true)
  jest.mocked(useLocalSearchParams).mockReturnValue({})
})

describe('Criar comunidade (ADR 0007)', () => {
  test('três passos, o TC-16 palavra por palavra e o TC-03 em bloco separado', async () => {
    const { servidor } = await renderizarTela(<TelaCriarComunidade />, {
      rotas: {
        'GET /api/v1/eu': euSemComunidade('18_mais'),
        'POST /api/v1/comunidades': () => ({
          status: 200,
          corpo: {
            id: NOVA,
            nome: 'Jovens da Vila',
            codigo: 'ABCD2345',
            link: 'https://x/entrar/ABCD2345',
          },
        }),
      },
    })
    expect(await screen.findByText('Nome e cidade')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('O nome precisa ter pelo menos 2 letras.')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Nome da comunidade'), 'Jovens da Vila')
    await fireEvent.changeText(screen.getByLabelText('Cidade (opcional)'), 'Campinas')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Cor e logotipo')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Antes de criar, leia com atenção')).toBeOnTheScreen()
    expect(screen.getByText(RESUMO_DO_TERMO_DO_ADMIN)).toBeOnTheScreen()
    const criar = screen.getByRole('button', { name: 'Criar a comunidade Jovens da Vila' })
    expect(criar).toBeDisabled()
    expect(
      screen.getByText('Para criar a comunidade, é preciso aceitar o Termo do Administrador.'),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Li e aceito o Termo do Administrador da Comunidade.' }),
    )
    // A fé em bloco próprio, na forma da criação.
    expect(screen.getByText(/^Criar e participar da Jovens da Vila/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Concordo que a Jovens da Vila/ }))
    await fireEvent.press(criar)

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/codigo-da-comunidade',
        params: { novo: '1' },
      }),
    )
    expect(pedidosPara(servidor, 'POST', '/api/v1/comunidades')[0]?.corpo).toEqual({
      nome: 'Jovens da Vila',
      cor: '#5B4BDB',
      cidade: 'Campinas',
      aceiteDoTermoDoAdmin: true,
      consentimentoFe: true,
    })
  })

  test('limite atingido (409): título humano e a mensagem da API', async () => {
    await renderizarTela(<TelaCriarComunidade />, {
      rotas: {
        'GET /api/v1/eu': euSemComunidade(),
        'POST /api/v1/comunidades': () => ({
          status: 409,
          corpo: {
            erro: 'limite_de_comunidades_novas',
            mensagem: 'Você já tem uma comunidade nova esperando a verificação.',
          },
        }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Nome da comunidade'), 'Jovens Sul')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }))
    await fireEvent.press(
      await screen.findByRole('checkbox', {
        name: 'Li e aceito o Termo do Administrador da Comunidade.',
      }),
    )
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Concordo que a Jovens Sul/ }))
    await fireEvent.press(screen.getByRole('button', { name: 'Criar a comunidade Jovens Sul' }))
    expect(await screen.findByText('Não dá para criar outra agora')).toBeOnTheScreen()
    expect(
      screen.getByText('Você já tem uma comunidade nova esperando a verificação.'),
    ).toBeOnTheScreen()
  })

  test('16 ou 17 anos: explicação humana e os caminhos para entrar, sem formulário', async () => {
    await renderizarTela(<TelaCriarComunidade />, {
      rotas: { 'GET /api/v1/eu': euSemComunidade('16_17') },
    })
    expect(await screen.findByText('Para criar, é preciso ter 18 anos')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Nome da comunidade')).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Procurar uma comunidade' }))
    expect(router.replace).toHaveBeenCalledWith('/procurar-comunidade')
    await fireEvent.press(screen.getByRole('button', { name: 'Tenho um código' }))
    expect(router.replace).toHaveBeenCalledWith('/tenho-um-codigo')
  })
})

describe('Código da comunidade (admin)', () => {
  test('código grande, TC-20 conforme o modo e "Trocar código" com confirmação', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ novo: '1' })
    const { servidor } = await renderizarTela(<TelaCodigoDaComunidade />, {
      papel: 'admin',
      rotas: {
        [`GET ${BASE}`]: () => ({ status: 200, corpo: DETALHE }),
        [`GET ${BASE}/codigo`]: () => ({
          status: 200,
          corpo: {
            codigo: 'ABCD2345',
            link: 'https://x/entrar/ABCD2345',
            modoEntrada: 'codigo_direto',
          },
        }),
        [`POST ${BASE}/codigo/trocar`]: () => ({
          status: 200,
          corpo: { codigo: 'WXYZ6789', link: 'https://x/entrar/WXYZ6789' },
        }),
      },
    })
    expect(await screen.findByText('Convide sua equipe')).toBeOnTheScreen()
    expect(screen.getByText('ABCD 2345')).toBeOnTheScreen()
    expect(screen.getByLabelText('QR para entrar na comunidade')).toBeOnTheScreen()
    expect(
      screen.getByText(/Quem tiver este código pode entrar na comunidade como membro/),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Compartilhar no WhatsApp' })).toBeOnTheScreen()
    expect(await screen.findByText(/Comunidade nova: até 30 pessoas/)).toBeOnTheScreen()
    expect(screen.getByText(/Hoje: 12 de 30\./)).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Trocar código' }))
    expect(jest.mocked(confirmar).mock.calls[0]?.[0]).toMatchObject({
      titulo: 'Trocar o código?',
      mensagem:
        'Quem tem o código antigo não vai mais conseguir usá-lo. Quem já entrou continua na comunidade.',
    })
    expect(await screen.findByText('WXYZ 6789')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/codigo/trocar`)).toHaveLength(1)
  })

  test('compartilhar: a mensagem diz a comunidade, o código e o link (D58)', async () => {
    expect(
      mensagemDoConvite(
        'Jovens Centro',
        'XPHVYHFS',
        'https://unijovem.solerte.com.br/entrar/XPHVYHFS',
      ),
    ).toBe(
      'Entre na comunidade Jovens Centro no Uni Jovem. Código: XPHV YHFS. Link: https://unijovem.solerte.com.br/entrar/XPHVYHFS',
    )
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
    await renderizarTela(<TelaCodigoDaComunidade />, {
      papel: 'admin',
      rotas: {
        [`GET ${BASE}`]: () => ({ status: 200, corpo: DETALHE }),
        [`GET ${BASE}/codigo`]: () => ({
          status: 200,
          corpo: {
            codigo: 'XPHVYHFS',
            link: 'https://x/entrar/XPHVYHFS',
            modoEntrada: 'codigo_direto',
          },
        }),
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Compartilhar no WhatsApp' }))
    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1))
    const texto = decodeURIComponent(String(abrir.mock.calls[0]?.[0]).split('text=')[1] ?? '')
    expect(texto).toBe(
      'Entre na comunidade Jovens Centro no Uni Jovem. Código: XPHV YHFS. Link: https://x/entrar/XPHVYHFS',
    )
    abrir.mockRestore()
  })

  test('membro não vê o código', async () => {
    const { servidor } = await renderizarTela(<TelaCodigoDaComunidade />, { papel: 'membro' })
    expect(await screen.findByText('Só a administração vê o código')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', `${BASE}/codigo`)).toHaveLength(0)
  })
})

describe('Configurações: quem pode entrar e aparecer na busca', () => {
  test('modo de entrada com explicação, TC-18 e o PATCH só com o que mudou', async () => {
    const { servidor } = await renderizarTela(<TelaConfigurarComunidade />, {
      papel: 'admin',
      rotas: {
        [`GET ${BASE}`]: () => ({ status: 200, corpo: DETALHE }),
        [`PATCH ${BASE}`]: () => ({ status: 200, corpo: {} }),
      },
    })
    await fireEvent.press(await screen.findByRole('radio', { name: 'Código com entrada direta' }))
    expect(screen.getByText('Quem tem o código entra na hora, como membro.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('switch', { name: 'Aparecer na busca' }))
    expect(screen.getByText(/Ninguém vê, pela busca, quem participa/)).toBeOnTheScreen()
    // Sem cidade, a TC-18 pede a cidade.
    expect(
      screen.getByText('Informe a cidade para as pessoas acharem a comunidade certa.'),
    ).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Cidade (opcional)'), 'Campinas')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Salvar configurações de Jovens Centro' }),
    )
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PATCH', BASE)[0]?.corpo).toEqual({
        cidade: 'Campinas',
        modoEntrada: 'codigo_direto',
        encontravel: true,
      }),
    )
  })
})

describe('Termo do Administrador pendente', () => {
  test('admin com `precisaAceitarTermoDoAdmin` vê a folha e grava o aceite', async () => {
    const base = respostaEu('admin')
    const { servidor } = await renderizarTela(<TermoDoAdminPendente />, {
      papel: 'admin',
      rotas: {
        'GET /api/v1/eu': () => ({
          status: 200,
          corpo: {
            ...base,
            comunidades: [{ ...base.comunidades[0], precisaAceitarTermoDoAdmin: true }],
          },
        }),
        [`POST ${BASE}/termo-do-admin`]: () => ({ status: 200, corpo: { ok: true } }),
      },
    })
    const aceitar = await screen.findByRole('button', { name: 'Aceitar e continuar' })
    expect(aceitar).toBeDisabled()
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Li e aceito o Termo do Administrador da Comunidade.' }),
    )
    await fireEvent.press(aceitar)
    await waitFor(() =>
      // Mesmo contrato da API (`abertura.ts`, rota termo-do-admin): `{ aceite: true }`.
      expect(pedidosPara(servidor, 'POST', `${BASE}/termo-do-admin`)[0]?.corpo).toEqual({
        aceite: true,
      }),
    )
  })
})
