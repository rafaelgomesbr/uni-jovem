import { fireEvent, screen } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'

import { TelaComunidadeEncontrada } from '../TelaComunidadeEncontrada'
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

// Sem internet: o aparelho diz; as telas desabilitam o envio e escrevem o motivo (UX v3, 5.10).
jest.mock('@/ui/IndicadorDeConexao', () => ({
  ...jest.requireActual('@/ui/IndicadorDeConexao'),
  useSemConexao: () => true,
}))

const ID_PUBLICO = 'a'.repeat(32)

function semComunidade() {
  const base = respostaEu('membro')
  return () => ({ status: 200, corpo: { conta: base.conta, comunidades: [] } })
}

describe('entrar numa comunidade sem internet', () => {
  beforeEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}))

  test('Tenho um código: o botão fica desabilitado com o motivo escrito e nada é enviado', async () => {
    const { servidor } = await renderizarTela(<TelaTenhoUmCodigo />, {
      rotas: { 'GET /api/v1/eu': semComunidade() },
    })
    await fireEvent.changeText(await screen.findByLabelText('Código ou link'), 'ABCD2345')
    expect(screen.getByRole('button', { name: 'Entrar na comunidade' })).toBeDisabled()
    expect(screen.getByText('Precisa de internet para entrar.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', '/api/v1/entrada')).toHaveLength(0)
  })

  test('Comunidade encontrada: "Pedir para entrar" também diz que precisa de internet', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ idPublico: ID_PUBLICO })
    const { consultas } = await renderizarTela(<TelaComunidadeEncontrada />, {
      rotas: { 'GET /api/v1/eu': semComunidade() },
    })
    consultas.setQueryData(CHAVES.comunidadeEncontrada(ID_PUBLICO), {
      idPublico: ID_PUBLICO,
      nome: 'Jovens da Vila',
      cidade: 'Campinas',
      cor: '#15803D',
      temLogo: false,
      logoVersao: null,
      verificada: true,
      modoEntrada: 'codigo_com_aprovacao',
    })
    const botao = await screen.findByRole('button', {
      name: 'Pedir para entrar em Jovens da Vila',
    })
    expect(botao).toBeDisabled()
    expect(screen.getByText('Precisa de internet para pedir.')).toBeOnTheScreen()
  })
})
