import { useLocalSearchParams } from 'expo-router'
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { Text } from 'react-native'

import type { EstadoDaSessao } from '@/estado/sessao'

import { esquecerDestino, tomarDestino } from '../../autenticacao/destinoDepoisDeEntrar'
import { TelaLinkDoCodigo } from '../TelaLinkDoCodigo'

let mockEstado: EstadoDaSessao = 'autenticado'
jest.mock('@/estado/sessao', () => ({
  useSessao: () => ({ estado: mockEstado }),
}))

/** Pelos parâmetros da rota, mostra o que a tela de destino recebeu. */
function TenhoUmCodigo() {
  const { codigo } = useLocalSearchParams<{ codigo?: string }>()
  return <Text>{`Tenho um código: ${codigo ?? 'sem código'}`}</Text>
}

const rotas = {
  index: () => <Text>Início</Text>,
  '(publico)/entrar': () => <Text>Tela de login</Text>,
  'entrar/[codigo]': TelaLinkDoCodigo,
  '(autenticado)/tenho-um-codigo': TenhoUmCodigo,
}

beforeEach(() => {
  esquecerDestino()
  mockEstado = 'autenticado'
})

describe('link do código /entrar/<codigo> (D58)', () => {
  test('com sessão: vai para "Tenho um código" com o código, sem enviar nada', async () => {
    await renderRouter(rotas, { initialUrl: '/entrar/XPHVYHFS' })
    expect(await screen.findByText('Tenho um código: XPHVYHFS')).toBeOnTheScreen()
  })

  test('código em minúsculas e com hífen também é reconhecido e normalizado', async () => {
    await renderRouter(rotas, { initialUrl: '/entrar/xphv-yhfs' })
    expect(await screen.findByText('Tenho um código: XPHVYHFS')).toBeOnTheScreen()
  })

  test('sem sessão: vai para o login e guarda o link como destino depois de entrar', async () => {
    mockEstado = 'anonimo'
    await renderRouter(rotas, { initialUrl: '/entrar/XPHVYHFS' })
    expect(await screen.findByText('Tela de login')).toBeOnTheScreen()
    // Depois de entrar, o app volta ao link e este segue para o código.
    expect(tomarDestino()).toBe('/entrar/XPHVYHFS')
  })

  test('/entrar sem segmento continua sendo o login', async () => {
    mockEstado = 'anonimo'
    await renderRouter(rotas, { initialUrl: '/entrar' })
    expect(await screen.findByText('Tela de login')).toBeOnTheScreen()
    expect(tomarDestino()).toBeNull()
  })

  test('código inválido: tela com saída humana, sem laço de redirecionamento', async () => {
    await renderRouter(rotas, { initialUrl: '/entrar/ABC' })
    expect(await screen.findByText('Este link não tem um código válido')).toBeOnTheScreen()
    expect(screen.queryByText(/Tenho um código:/)).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao início' }))
    expect(await screen.findByText('Início')).toBeOnTheScreen()
  })

  test('código inválido sem sessão: não guarda destino e não manda para o login', async () => {
    mockEstado = 'anonimo'
    await renderRouter(rotas, { initialUrl: '/entrar/XPHV0HF1' })
    expect(await screen.findByText('Este link não tem um código válido')).toBeOnTheScreen()
    expect(tomarDestino()).toBeNull()
  })
})
