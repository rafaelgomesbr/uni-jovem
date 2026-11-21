import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'

import { TelaInicio } from '../../inicio/TelaInicio'
import { lerCodigoDaComunidade } from '../consultas'
import { TelaComunidadeEncontrada } from '../TelaComunidadeEncontrada'
import { TelaDenunciarComunidade } from '../TelaDenunciarComunidade'
import { TelaProcurarComunidade } from '../TelaProcurarComunidade'
import { TelaTenhoUmCodigo } from '../TelaTenhoUmCodigo'

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

const ID_PUBLICO = 'a'.repeat(32)
const NOVA = '55555555-5555-4555-8555-000000000001'
const FE = /^Concordo que a /

/** A conta sem nenhuma comunidade (ADR 0007: conta nova não tem vínculo). */
function semComunidade(faixaEtaria?: '18_mais' | '16_17') {
  const base = respostaEu('membro')
  return () => ({
    status: 200,
    corpo: { conta: { ...base.conta, ...(faixaEtaria ? { faixaEtaria } : {}) }, comunidades: [] },
  })
}

const ENCONTRADA = {
  idPublico: ID_PUBLICO,
  nome: 'Jovens da Vila',
  cidade: 'Campinas',
  cor: '#15803D',
  temLogo: false,
  logoVersao: null,
  verificada: true,
  modoEntrada: 'codigo_com_aprovacao',
}

describe('lerCodigoDaComunidade', () => {
  test('aceita o código com espaço, minúsculas e o link /entrar/<codigo>', () => {
    expect(lerCodigoDaComunidade('abcd 2345')).toBe('ABCD2345')
    expect(lerCodigoDaComunidade('https://unijovem.exemplo/entrar/ABCD-2345')).toBe('ABCD2345')
    // 0, O, 1 e I não existem no alfabeto do código.
    expect(lerCodigoDaComunidade('ABCD0001')).toBeNull()
    expect(lerCodigoDaComunidade('curto')).toBeNull()
  })
})

describe('Comece por aqui (conta sem comunidade)', () => {
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => jest.restoreAllMocks())

  test('três caminhos grandes com texto, o versículo e os próprios pedidos', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, b) => b?.at(-1)?.onPress?.())
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: {
        'GET /api/v1/eu': semComunidade(),
        'GET /api/v1/eu/pedidos': () => ({
          status: 200,
          corpo: {
            pedidos: [
              {
                id: 'p1',
                estado: 'pendente',
                comunidade: { nome: 'Jovens da Vila', cor: '#15803D' },
                criadoEm: '2026-11-15T12:00:00.000Z',
                respondidoEm: null,
              },
              {
                id: 'p2',
                estado: 'nao_aprovado',
                comunidade: { nome: 'Jovens do Centro', cor: '#5B4BDB' },
                criadoEm: '2026-11-01T12:00:00.000Z',
                respondidoEm: '2026-11-02T12:00:00.000Z',
              },
            ],
          },
        }),
        'DELETE /api/v1/eu/pedidos/p1': () => ({ status: 200, corpo: { ok: true } }),
      },
    })

    expect(await screen.findByText('Comece por aqui')).toBeOnTheScreen()
    expect(screen.getByText('Tenho um código ou convite')).toBeOnTheScreen()
    expect(screen.getByText('Procurar minha comunidade')).toBeOnTheScreen()
    expect(screen.getByText('Criar uma comunidade')).toBeOnTheScreen()
    expect(screen.getByText('Versículo do dia')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Usar código ou convite' }))
    expect(router.push).toHaveBeenCalledWith('/tenho-um-codigo')
    await fireEvent.press(screen.getByRole('button', { name: 'Procurar comunidade' }))
    expect(router.push).toHaveBeenCalledWith('/procurar-comunidade')
    await fireEvent.press(screen.getByRole('button', { name: 'Criar comunidade' }))
    expect(router.push).toHaveBeenCalledWith('/criar-comunidade')

    // Situação em texto (chip), nunca só cor; a recusa diz quando pedir de novo.
    expect(await screen.findByText('Pendente')).toBeOnTheScreen()
    expect(screen.getByText('Não aprovado')).toBeOnTheScreen()
    expect(screen.getByText(/pode pedir de novo a partir de 02\/12\/2026/)).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Cancelar o pedido para Jovens da Vila' }),
    )
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', '/api/v1/eu/pedidos/p1')).toHaveLength(1),
    )
  })
})

describe('Tenho um código', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useLocalSearchParams).mockReturnValue({})
  })

  test('código não reconhecido: erro humano no campo, nada vai para a API', async () => {
    const { servidor } = await renderizarTela(<TelaTenhoUmCodigo />, {
      rotas: { 'GET /api/v1/eu': semComunidade() },
    })
    await fireEvent.changeText(await screen.findByLabelText('Código ou link'), 'xyz')
    await fireEvent.press(screen.getByRole('checkbox', { name: FE }))
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar na comunidade' }))
    expect(await screen.findByText(/Não reconhecemos esse código/)).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', '/api/v1/entrada')).toHaveLength(0)
  })

  test('código vindo do link (D58): preenche o campo, não envia sozinho e mantém o consentimento', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ codigo: 'XPHVYHFS' })
    const { servidor } = await renderizarTela(<TelaTenhoUmCodigo />, {
      rotas: { 'GET /api/v1/eu': semComunidade() },
    })
    const campo = await screen.findByLabelText('Código ou link')
    expect(campo.props.value).toBe('XPHVYHFS')
    expect(screen.getByText(/Código do link: XPHV YHFS/)).toBeOnTheScreen()
    // Nada foi enviado, e o botão segue exigindo o consentimento sobre a fé.
    expect(screen.getByRole('button', { name: 'Entrar na comunidade' })).toBeDisabled()
    expect(pedidosPara(servidor, 'POST', '/api/v1/entrada')).toHaveLength(0)
  })

  test('código do link fora do formato: mensagem humana e campo vazio', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ codigo: 'XPHV0HF1' })
    const { servidor } = await renderizarTela(<TelaTenhoUmCodigo />, {
      rotas: { 'GET /api/v1/eu': semComunidade() },
    })
    const campo = await screen.findByLabelText('Código ou link')
    expect(campo.props.value).toBe('')
    expect(screen.getByText(/O código deste link não parece certo/)).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', '/api/v1/entrada')).toHaveLength(0)
  })

  test('sem o consentimento sobre a fé (TC-03.v4), o botão fica desabilitado com o motivo', async () => {
    await renderizarTela(<TelaTenhoUmCodigo />, { rotas: { 'GET /api/v1/eu': semComunidade() } })
    await fireEvent.changeText(await screen.findByLabelText('Código ou link'), 'ABCD2345')
    expect(screen.getByText('Sobre a sua fé')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Entrar na comunidade' })).toBeDisabled()
    expect(screen.getByText(/Sem essa concordância não conseguimos incluir você/)).toBeOnTheScreen()
  })

  test('código com entrada direta: entra, a comunidade vira a ativa e o app vai ao Início', async () => {
    const { servidor } = await renderizarTela(<TelaTenhoUmCodigo />, {
      rotas: {
        'GET /api/v1/eu': semComunidade(),
        'POST /api/v1/entrada': () => ({
          status: 200,
          corpo: { resultado: 'membro', comunidade: { id: NOVA, nome: 'Jovens da Vila' } },
        }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Código ou link'), 'abcd 2345')
    await fireEvent.press(screen.getByRole('checkbox', { name: FE }))
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar na comunidade' }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
    expect(pedidosPara(servidor, 'POST', '/api/v1/entrada')[0]?.corpo).toEqual({
      codigo: 'ABCD2345',
      consentimentoFe: true,
      responsavelCiente: false,
    })
  })

  test('16 ou 17 anos: a caixa do responsável aparece de saída e vai junto', async () => {
    const { servidor } = await renderizarTela(<TelaTenhoUmCodigo />, {
      rotas: {
        'GET /api/v1/eu': semComunidade('16_17'),
        'POST /api/v1/entrada': () => ({
          status: 200,
          corpo: { resultado: 'pedido_pendente', comunidade: { nome: 'Jovens da Vila' } },
        }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Código ou link'), 'ABCD2345')
    await fireEvent.changeText(
      screen.getByLabelText('Mensagem para a liderança (opcional)'),
      'Sou a Marta',
    )
    await fireEvent.press(screen.getByRole('checkbox', { name: FE }))
    const responsavel = screen.getByRole('checkbox', { name: /^Meu pai, minha mãe/ })
    expect(screen.getByRole('button', { name: 'Entrar na comunidade' })).toBeDisabled()
    await fireEvent.press(responsavel)
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar na comunidade' }))
    // Pedido pendente: a confirmação na tela, sem sair dela.
    expect(await screen.findByText('Pedido enviado')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', '/api/v1/entrada')[0]?.corpo).toEqual({
      codigo: 'ABCD2345',
      consentimentoFe: true,
      responsavelCiente: true,
      mensagem: 'Sou a Marta',
    })
  })

  test('a API pede a idade: a pergunta aparece e a idade vai no próximo envio', async () => {
    let tentativa = 0
    const { servidor } = await renderizarTela(<TelaTenhoUmCodigo />, {
      rotas: {
        'GET /api/v1/eu': semComunidade(),
        'POST /api/v1/entrada': () =>
          ++tentativa === 1
            ? {
                status: 422,
                corpo: {
                  erro: 'faixa_etaria_necessaria',
                  mensagem: 'Antes de entrar na comunidade, informe a sua faixa de idade.',
                },
              }
            : {
                status: 200,
                corpo: { resultado: 'membro', comunidade: { id: NOVA, nome: 'Jovens da Vila' } },
              },
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Código ou link'), 'ABCD2345')
    await fireEvent.press(screen.getByRole('checkbox', { name: FE }))
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar na comunidade' }))
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tenho 18 anos ou mais.' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar na comunidade' }))
    await waitFor(() => expect(pedidosPara(servidor, 'POST', '/api/v1/entrada')).toHaveLength(2))
    expect(pedidosPara(servidor, 'POST', '/api/v1/entrada')[1]?.corpo).toMatchObject({
      faixaEtaria: '18_mais',
    })
  })
})

describe('Procurar e pedir para entrar', () => {
  beforeEach(() => jest.clearAllMocks())

  test('a busca só roda com 3 letras; o resultado mostra cidade e o selo com texto', async () => {
    const { servidor } = await renderizarTela(<TelaProcurarComunidade />, {
      rotas: {
        'GET /api/v1/eu': semComunidade(),
        'GET /api/v1/comunidades/busca': () => ({ status: 200, corpo: [ENCONTRADA] }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Nome da comunidade'), 'Jo')
    await fireEvent.press(screen.getByRole('button', { name: 'Procurar' }))
    expect(await screen.findByText('Digite pelo menos 3 letras do nome.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', '/api/v1/comunidades/busca')).toHaveLength(0)

    await fireEvent.changeText(screen.getByLabelText('Nome da comunidade'), 'Jovens')
    await fireEvent.changeText(screen.getByLabelText('Cidade (opcional)'), 'Campinas')
    await fireEvent.press(screen.getByRole('button', { name: 'Procurar' }))
    const linha = await screen.findByRole('button', {
      name: 'Jovens da Vila, Campinas, verificada. Abrir',
    })
    expect(screen.getByText('Verificada')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', '/api/v1/comunidades/busca')[0]?.url).toContain(
      'q=Jovens&cidade=Campinas',
    )
    await fireEvent.press(linha)
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/comunidade-encontrada/[idPublico]',
      params: { idPublico: ID_PUBLICO },
    })
  })

  test('pedir para entrar leva a mensagem e o consentimento; "Denunciar" leva o idPublico', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ idPublico: ID_PUBLICO })
    const { servidor, consultas } = await renderizarTela(<TelaComunidadeEncontrada />, {
      rotas: {
        'GET /api/v1/eu': semComunidade(),
        [`POST /api/v1/comunidades/${ID_PUBLICO}/pedidos`]: () => ({
          status: 200,
          corpo: { resultado: 'pedido_pendente', comunidade: { nome: 'Jovens da Vila' } },
        }),
      },
    })
    consultas.setQueryData(CHAVES.comunidadeEncontrada(ID_PUBLICO), ENCONTRADA)

    const pedir = await screen.findByRole('button', { name: 'Pedir para entrar em Jovens da Vila' })
    // TC-17 palavra por palavra, com o nome da comunidade.
    expect(screen.getByText(/A liderança da Jovens da Vila vai ver seu nome/)).toBeOnTheScreen()
    expect(pedir).toBeDisabled()
    await fireEvent.changeText(
      screen.getByLabelText('Mensagem para a liderança (opcional)'),
      'Sou a Ana, do grupo de sábado',
    )
    await fireEvent.press(screen.getByRole('checkbox', { name: FE }))
    await fireEvent.press(pedir)
    expect(await screen.findByText('Pedido enviado')).toBeOnTheScreen()
    expect(
      pedidosPara(servidor, 'POST', `/api/v1/comunidades/${ID_PUBLICO}/pedidos`)[0]?.corpo,
    ).toEqual({
      consentimentoFe: true,
      responsavelCiente: false,
      mensagem: 'Sou a Ana, do grupo de sábado',
    })
    jest.mocked(useLocalSearchParams).mockReturnValue({})
  })

  test('sem a busca no cache (tela aberta por link), a tela manda procurar de novo', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ idPublico: ID_PUBLICO })
    await renderizarTela(<TelaComunidadeEncontrada />, {
      rotas: { 'GET /api/v1/eu': semComunidade() },
    })
    expect(await screen.findByText('Procure de novo')).toBeOnTheScreen()
    jest.mocked(useLocalSearchParams).mockReturnValue({})
  })

  test('denunciar comunidade (TC-19): motivo obrigatório e o detalhe opcional', async () => {
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ idPublico: ID_PUBLICO, nome: 'Jovens da Vila' })
    const { servidor } = await renderizarTela(<TelaDenunciarComunidade />, {
      rotas: {
        'GET /api/v1/eu': semComunidade(),
        [`POST /api/v1/comunidades/${ID_PUBLICO}/denuncias`]: () => ({
          status: 200,
          corpo: { id: 'd1', mensagem: 'Recebemos sua denúncia.' },
        }),
      },
    })
    expect(await screen.findByText('Denunciar Jovens da Vila?')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Enviar denúncia' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam ou propaganda' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }))
    expect(await screen.findByText('Denúncia enviada. Obrigado por avisar.')).toBeOnTheScreen()
    expect(
      pedidosPara(servidor, 'POST', `/api/v1/comunidades/${ID_PUBLICO}/denuncias`)[0]?.corpo,
    ).toEqual({ motivo: 'spam' })
    jest.mocked(useLocalSearchParams).mockReturnValue({})
  })
})
