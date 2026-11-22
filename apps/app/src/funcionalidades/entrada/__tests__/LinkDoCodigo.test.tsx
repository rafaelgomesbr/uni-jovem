import { useLocalSearchParams } from 'expo-router'
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { Text } from 'react-native'

import type { EstadoDaSessao } from '@/estado/sessao'

import { ErroDaApi } from '@/servicos/erros'

import { esquecerDestino, tomarDestino } from '../../autenticacao/destinoDepoisDeEntrar'
import { usePreviaDoCodigo } from '../consultas'
import { TelaLinkDoCodigo } from '../TelaLinkDoCodigo'

// A prévia é uma consulta pública (React Query): aqui ela é substituída por um estado fixo por teste.
jest.mock('../consultas', () => ({
  ...jest.requireActual('../consultas'),
  usePreviaDoCodigo: jest.fn(),
}))

const PREVIA = {
  comunidade: {
    nome: 'Jovens Esperança',
    cor: '#5B4BDB',
    temLogo: false,
    pessoas: 15,
    modoEntrada: 'codigo_direto' as const,
    proximoEncontro: {
      titulo: 'Sábado Jovem',
      inicio: '2026-11-28T19:00:00.000Z',
      fuso: 'America/Sao_Paulo',
    },
  },
}

function previa(estado: { data?: typeof PREVIA; error?: unknown; isPending?: boolean }) {
  jest.mocked(usePreviaDoCodigo).mockReturnValue({
    data: estado.data,
    error: estado.error ?? null,
    isPending: estado.isPending ?? false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof usePreviaDoCodigo>)
}

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
  jest.clearAllMocks()
  esquecerDestino()
  mockEstado = 'autenticado'
  previa({ data: PREVIA })
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

  test('sem sessão: mostra a prévia pública ANTES do login e guarda o link como destino', async () => {
    mockEstado = 'anonimo'
    await renderRouter(rotas, { initialUrl: '/entrar/XPHVYHFS' })
    // Nome, cor (no avatar), pessoas e o próximo encontro público, sem pedir nada antes.
    expect(await screen.findByText('Você foi convidado para Jovens Esperança')).toBeOnTheScreen()
    expect(screen.getByText('15 pessoas')).toBeOnTheScreen()
    expect(screen.getByText('Sábado Jovem')).toBeOnTheScreen()
    expect(screen.queryByText('Tela de login')).toBeNull()
    // Depois de entrar, o app volta ao link e este segue para o código.
    expect(tomarDestino()).toBe('/entrar/XPHVYHFS')
    expect(usePreviaDoCodigo).toHaveBeenCalledWith('XPHVYHFS')
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar ou criar conta' }))
    expect(await screen.findByText('Tela de login')).toBeOnTheScreen()
  })

  test('sem sessão e carregando: esqueleto da forma final, sem erro', async () => {
    mockEstado = 'anonimo'
    previa({ isPending: true })
    await renderRouter(rotas, { initialUrl: '/entrar/XPHVYHFS' })
    expect(await screen.findByRole('button', { name: 'Entrar ou criar conta' })).toBeOnTheScreen()
    expect(screen.queryByText(/Código não encontrado/)).toBeNull()
  })

  test('sem sessão e código que não entra (404 igual): mensagem humana e destino esquecido', async () => {
    mockEstado = 'anonimo'
    previa({ error: new ErroDaApi(404, 'nao_encontrado', 'Não encontramos esta comunidade.') })
    await renderRouter(rotas, { initialUrl: '/entrar/XPHVYHFS' })
    expect(
      await screen.findByText(
        'Código não encontrado. Confira as letras e os números, ou peça outro à liderança.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ir para o login' })).toBeOnTheScreen()
    expect(tomarDestino()).toBeNull()
  })

  test('sem sessão e limite de consultas (429): avisa, mas deixa seguir e guarda o destino', async () => {
    mockEstado = 'anonimo'
    previa({ error: new ErroDaApi(429, 'muitas_tentativas', 'Muitas tentativas.') })
    await renderRouter(rotas, { initialUrl: '/entrar/XPHVYHFS' })
    expect(await screen.findByText(/Muitas consultas agora/)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Entrar ou criar conta' })).toBeOnTheScreen()
    expect(tomarDestino()).toBe('/entrar/XPHVYHFS')
  })

  test('com sessão: não consulta a prévia aqui (a tela de código é quem mostra)', async () => {
    await renderRouter(rotas, { initialUrl: '/entrar/XPHVYHFS' })
    expect(await screen.findByText('Tenho um código: XPHVYHFS')).toBeOnTheScreen()
    expect(usePreviaDoCodigo).not.toHaveBeenCalledWith('XPHVYHFS')
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
