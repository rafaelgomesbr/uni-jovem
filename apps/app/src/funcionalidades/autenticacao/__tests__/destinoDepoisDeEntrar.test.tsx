import { render } from '@testing-library/react-native'
import { router, useGlobalSearchParams, usePathname, useSegments } from 'expo-router'

import type { EstadoDaSessao } from '@/estado/sessao'

import {
  destinoInterno,
  esquecerDestino,
  guardarDestino,
  tomarDestino,
  useDestinoDepoisDeEntrar,
} from '../destinoDepoisDeEntrar'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  usePathname: jest.fn(() => '/'),
  useSegments: jest.fn(() => []),
  useGlobalSearchParams: jest.fn(() => ({})),
}))

const naRota = (caminho: string, segmentos: string[] = [], parametros = {}) => {
  jest.mocked(usePathname).mockReturnValue(caminho)
  jest.mocked(useSegments).mockReturnValue(segmentos as never)
  jest.mocked(useGlobalSearchParams).mockReturnValue(parametros)
}

function Sonda({ estado }: { estado: EstadoDaSessao }) {
  useDestinoDepoisDeEntrar(estado)
  return null
}

beforeEach(() => {
  jest.clearAllMocks()
  esquecerDestino()
  naRota('/')
})

describe('destino depois de entrar (A4)', () => {
  test('aceita só caminho interno do app: nada de redirecionamento aberto', () => {
    expect(destinoInterno('/excluir-conta')).toBe('/excluir-conta')
    expect(destinoInterno('/conteudos?tipo=musicos')).toBe('/conteudos?tipo=musicos')
    expect(destinoInterno('/evento/abc')).toBe('/evento/abc')
    for (const ruim of [
      'https://golpe.exemplo/app',
      '//golpe.exemplo',
      '/\\golpe.exemplo',
      // Montado em partes para o lint não ler como URL de script de verdade.
      ['javascript', 'alert(1)'].join(':'),
      `/${['javascript', 'alert(1)'].join(':')}`,
      'excluir-conta',
      '/excluir conta',
      '/excluir-conta\n',
      '',
      `/${'a'.repeat(600)}`,
    ]) {
      expect(destinoInterno(ruim)).toBeNull()
    }
  })

  test('rotas de entrada e o Início não viram destino', () => {
    for (const rota of ['/', '/entrar', '/segundo-fator', '/convite?token=x', '/redefinir-senha']) {
      expect(destinoInterno(rota)).toBeNull()
    }
    guardarDestino('/excluir-conta')
    guardarDestino('/entrar')
    expect(tomarDestino()).toBe('/excluir-conta')
    // Uso único.
    expect(tomarDestino()).toBeNull()
  })

  test('sem sessão no endereço pedido; depois de entrar, sai do Início para ele', async () => {
    naRota('/excluir-conta')
    const tela = await render(<Sonda estado="anonimo" />)
    // O guarda manda para Entrar: esta rota não apaga o destino.
    naRota('/entrar')
    await tela.rerender(<Sonda estado="anonimo" />)
    // Entrou: o grupo público leva ao Início, e daí segue para o pedido.
    naRota('/')
    await tela.rerender(<Sonda estado="autenticado" />)
    expect(router.replace).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledWith('/excluir-conta')
  })

  test('a consulta vai junto; os parâmetros da própria rota, não', async () => {
    naRota('/conteudos', [], { tipo: 'musicos' })
    const tela = await render(<Sonda estado="anonimo" />)
    naRota('/evento/abc', ['(autenticado)', 'evento', '[eventoId]'], { eventoId: 'abc' })
    await tela.rerender(<Sonda estado="anonimo" />)
    naRota('/')
    await tela.rerender(<Sonda estado="autenticado" />)
    expect(router.replace).toHaveBeenCalledWith('/evento/abc')
  })

  test('sair da conta não deixa destino para a próxima pessoa', async () => {
    naRota('/perfil')
    const tela = await render(<Sonda estado="autenticado" />)
    await tela.rerender(<Sonda estado="anonimo" />)
    naRota('/entrar')
    await tela.rerender(<Sonda estado="anonimo" />)
    naRota('/')
    await tela.rerender(<Sonda estado="autenticado" />)
    expect(router.replace).not.toHaveBeenCalled()
  })

  test('entrar sem destino guardado fica no Início', async () => {
    naRota('/entrar')
    const tela = await render(<Sonda estado="anonimo" />)
    naRota('/')
    await tela.rerender(<Sonda estado="autenticado" />)
    expect(router.replace).not.toHaveBeenCalled()
  })
})
