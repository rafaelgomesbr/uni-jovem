import { fireEvent, screen } from '@testing-library/react-native'
import { router } from 'expo-router'

import { BASE, COMUNIDADE, renderizarTela, respostaEu } from '@/testes/telas'

import { TelaPerfil } from '../TelaPerfil'

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

function euComoCriador() {
  const base = respostaEu('admin')
  return () => ({ status: 200, corpo: { ...base, conta: { ...base.conta, criador: true } } })
}

/** O detalhe da comunidade com o id público (para "Denunciar comunidade"). */
const DETALHE = () => ({
  status: 200,
  corpo: {
    id: COMUNIDADE,
    idPublico: 'publico-123',
    nome: 'Jovens Centro',
    cor: '#5B4BDB',
    fuso: 'America/Sao_Paulo',
    estado: 'ativa',
    validadeOfflineDias: 14,
    retencaoInscricoesDias: 90,
    versao: 1,
    meuPapel: 'membro',
  },
})

/** Os módulos da comunidade que saíram do Perfil (D57): agora na aba Comunidade. */
const QUE_SAIRAM = [
  'Avisos',
  'Oração',
  'Pedidos de oração',
  'Sugestões',
  'Conteúdos',
  'Relatórios',
  'Locais',
  'Modelos',
  'Denúncias',
]

describe('Perfil só com a conta (D57)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('a conta em cima e nenhum módulo da comunidade, nem para o admin', async () => {
    await renderizarTela(<TelaPerfil />, { papel: 'admin' })
    expect(await screen.findByRole('button', { name: /^Editar perfil/ })).toBeOnTheScreen()
    for (const nome of [
      'Ajustes de notificação',
      'Segurança',
      'Versículo do dia',
      'Privacidade e dados',
      'Ajuda e sobre',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(`^${nome}`) })).toBeOnTheScreen()
    }
    for (const nome of QUE_SAIRAM) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${nome}[.]`) })).toBeNull()
    }
    // As escalas viraram aba; "Pendências" agora se chama "Uso sem internet".
    expect(screen.queryByRole('button', { name: /^Minhas escalas/ })).toBeNull()
    expect(screen.queryByText(/Pendências/)).toBeNull()
    // Só o Criador vê a Plataforma.
    expect(screen.queryByRole('button', { name: /^Plataforma do Criador/ })).toBeNull()
  })

  test('"Mais opções" no fim: bloqueadas, uso sem internet, outra comunidade, criar e denunciar', async () => {
    await renderizarTela(<TelaPerfil />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}`]: DETALHE },
    })
    expect(await screen.findByText('Mais opções')).toBeOnTheScreen()
    for (const [nome, destino] of [
      ['Pessoas bloqueadas', '/bloqueados'],
      ['Uso sem internet', '/pendencias'],
      ['Entrar em outra comunidade', '/comece-por-aqui'],
      ['Criar comunidade', '/criar-comunidade'],
    ] as const) {
      await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${nome}`) }))
      expect(router.push).toHaveBeenLastCalledWith(destino)
    }
    await fireEvent.press(await screen.findByRole('button', { name: /^Denunciar comunidade/ }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/denunciar-comunidade',
      params: { idPublico: 'publico-123', nome: 'Jovens Centro' },
    })
  })

  test('o Criador vê a Plataforma do Criador (só aqui) e cria pela Plataforma', async () => {
    await renderizarTela(<TelaPerfil />, { rotas: { 'GET /api/v1/eu': euComoCriador() } })
    await fireEvent.press(await screen.findByRole('button', { name: /^Plataforma do Criador/ }))
    expect(router.push).toHaveBeenLastCalledWith('/plataforma')
    await fireEvent.press(screen.getByRole('button', { name: 'Criar comunidade' }))
    expect(router.push).toHaveBeenLastCalledWith('/plataforma/nova')
  })

  test('"Ajustes de notificação" abre as preferências', async () => {
    await renderizarTela(<TelaPerfil />, { papel: 'membro' })
    await fireEvent.press(await screen.findByRole('button', { name: /^Ajustes de notificação/ }))
    expect(router.push).toHaveBeenLastCalledWith('/notificacoes')
  })

  test('"Editar perfil" é o único caminho para os dados: o cartão não repete "Editar dados" (D62)', async () => {
    await renderizarTela(<TelaPerfil />, { papel: 'membro' })
    await screen.findByRole('button', { name: /^Editar perfil/ })
    expect(screen.queryByRole('button', { name: 'Editar dados' })).toBeNull()
    expect(screen.queryByText('Editar dados')).toBeNull()
    // O avatar continua tocável, com rótulo.
    expect(screen.getByRole('button', { name: 'Trocar avatar' })).toBeOnTheScreen()
  })

  test('o chip âmbar "Desligado" da Segurança é só de quem administra', async () => {
    const semDoisFatores = (papel: 'membro' | 'organizador' | 'admin') => () => {
      const base = respostaEu(papel)
      return { status: 200, corpo: { ...base, conta: { ...base.conta, doisFatores: false } } }
    }
    const membro = await renderizarTela(<TelaPerfil />, {
      papel: 'membro',
      rotas: { 'GET /api/v1/eu': semDoisFatores('membro') },
    })
    expect(await screen.findByRole('button', { name: 'Segurança.' })).toBeOnTheScreen()
    expect(screen.queryByText('Desligado')).toBeNull()
    await membro.unmount()

    await renderizarTela(<TelaPerfil />, {
      papel: 'admin',
      rotas: { 'GET /api/v1/eu': semDoisFatores('admin') },
    })
    expect(await screen.findByText('Desligado')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Segurança. Código extra ao entrar desligado.' }),
    ).toBeOnTheScreen()
  })

  test('com o código extra ligado, todos veem "Ligado", com texto', async () => {
    await renderizarTela(<TelaPerfil />, {
      papel: 'membro',
      rotas: {
        'GET /api/v1/eu': () => {
          const base = respostaEu('membro')
          return { status: 200, corpo: { ...base, conta: { ...base.conta, doisFatores: true } } }
        },
      },
    })
    expect(await screen.findByText('Ligado')).toBeOnTheScreen()
  })
})
