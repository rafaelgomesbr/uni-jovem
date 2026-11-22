import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { BASE, COMUNIDADE, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { reiniciarAcordeoesDaSessao } from '@/ui/Acordeao'
import { mostrarToast } from '@/ui/Toast'

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
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
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

/** Os módulos da comunidade moram na aba Comunidade, nunca no Perfil (D57). */
const DA_COMUNIDADE = [
  'Avisos',
  'Oração',
  'Pedidos de oração',
  'Sugestões',
  'Biblioteca',
  'Relatórios',
  'Locais',
  'Modelos',
  'Denúncias',
]

beforeEach(() => {
  jest.clearAllMocks()
  reiniciarAcordeoesDaSessao()
})

describe('Perfil: o cartão da pessoa e cinco linhas (D70)', () => {
  test('o cartão mostra a pessoa, a função e a comunidade, e abre Editar perfil', async () => {
    await renderizarTela(<TelaPerfil />, { papel: 'admin' })
    const cartao = await screen.findByRole('button', {
      name: 'Editar perfil. Ana Souza, Administrador · Jovens Centro',
    })
    expect(screen.getByText('Administrador · Jovens Centro')).toBeOnTheScreen()
    expect(screen.getByText('ana@exemplo.com')).toBeOnTheScreen()
    await userEvent.setup().press(cartao)
    expect(router.push).toHaveBeenLastCalledWith('/editar-perfil')
    // Uma porta só para os dados: nada de "Editar dados", nada de avatar solto no cartão.
    expect(screen.queryByText('Editar dados')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Trocar avatar' })).toBeNull()
  })

  test('as cinco linhas, cada uma para o seu destino, e nenhum módulo da comunidade', async () => {
    await renderizarTela(<TelaPerfil />, { papel: 'admin' })
    const usuario = userEvent.setup()
    for (const [nome, destino] of [
      ['Ajustes de notificação', '/notificacoes'],
      ['Segurança', '/conta/seguranca'],
      ['Privacidade e dados', '/privacidade'],
      ['Comunidades', '/trocar-comunidade'],
      ['Ajuda', '/ajuda'],
    ] as const) {
      await usuario.press(await screen.findByRole('button', { name: new RegExp(`^${nome}`) }))
      expect(router.push).toHaveBeenLastCalledWith(destino)
    }
    for (const nome of DA_COMUNIDADE) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${nome}[.]`) })).toBeNull()
    }
    // A palavra "escala" saiu da interface, e "Pendências" já era "Uso sem internet".
    expect(screen.queryByRole('button', { name: /^Minhas escalas/ })).toBeNull()
    expect(screen.queryByText(/Ajuda e sobre/)).toBeNull()
    // Só o Criador vê a Plataforma.
    expect(screen.queryByRole('button', { name: /^Plataforma do Criador/ })).toBeNull()
  })

  test('"Comunidades" diz onde a pessoa está e abre a folha de trocar, entrar, criar e sair', async () => {
    await renderizarTela(<TelaPerfil />, { papel: 'membro' })
    expect(
      await screen.findByRole('button', {
        name: 'Comunidades. Agora em Jovens Centro. Trocar, entrar, criar ou sair',
      }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Jovens Centro · trocar, entrar, criar, sair')).toBeOnTheScreen()
  })

  test('sem duplicações: entrar, criar e sair de comunidade não aparecem aqui (moram na folha)', async () => {
    await renderizarTela(<TelaPerfil />, { papel: 'membro', rotas: { [`GET ${BASE}`]: DETALHE } })
    await userEvent.setup().press(await screen.findByRole('button', { name: /^Mais opções/ }))
    expect(screen.queryByRole('button', { name: /^Entrar em outra comunidade/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Criar comunidade/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Sair de Jovens/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Segurança/ })).toHaveLength(1)
  })
})

describe('"Mais opções" dobrado', () => {
  test('fechado esconde o resto; aberto leva a versículo, bloqueadas, uso sem internet e denunciar', async () => {
    await renderizarTela(<TelaPerfil />, { papel: 'membro', rotas: { [`GET ${BASE}`]: DETALHE } })
    const usuario = userEvent.setup()
    const mais = await screen.findByRole('button', {
      name: 'Mais opções. Recolhido, toque para ver.',
    })
    expect(screen.queryByRole('button', { name: /^Pessoas bloqueadas/ })).toBeNull()
    await usuario.press(mais)
    for (const [nome, destino] of [
      ['Versículo do dia', '/versiculo'],
      ['Pessoas bloqueadas', '/bloqueados'],
      ['Uso sem internet', '/pendencias'],
    ] as const) {
      await usuario.press(await screen.findByRole('button', { name: new RegExp(`^${nome}`) }))
      expect(router.push).toHaveBeenLastCalledWith(destino)
    }
    await usuario.press(await screen.findByRole('button', { name: /^Denunciar comunidade/ }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/denunciar-comunidade',
      params: { idPublico: 'publico-123', nome: 'Jovens Centro' },
    })
  })
})

describe('Plataforma, só do Criador', () => {
  test('o Criador vê a Plataforma do Criador, e criar comunidade vai pela folha', async () => {
    await renderizarTela(<TelaPerfil />, { rotas: { 'GET /api/v1/eu': euComoCriador() } })
    await fireEvent.press(await screen.findByRole('button', { name: /^Plataforma do Criador/ }))
    expect(router.push).toHaveBeenLastCalledWith('/plataforma')
    expect(screen.queryByRole('button', { name: 'Criar comunidade' })).toBeNull()
  })
})

describe('Segurança: o alerta "Desligado" é de quem administra', () => {
  const semDoisFatores = (papel: 'membro' | 'organizador' | 'admin') => () => {
    const base = respostaEu(papel)
    return { status: 200, corpo: { ...base, conta: { ...base.conta, doisFatores: false } } }
  }

  test('membro não vê o chip; administrador vê, com texto', async () => {
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

describe('Sair: um segundo toque no próprio botão, sem diálogo', () => {
  afterEach(() => jest.useRealTimers())

  test('o primeiro toque só arma ("Toque de novo para sair"); o segundo sai e avisa', async () => {
    const { servidor } = await renderizarTela(<TelaPerfil />, {
      papel: 'membro',
      rotas: { 'POST /api/auth/sair': () => ({ status: 200, corpo: { ok: true } }) },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Sair' }))
    const armado = await screen.findByRole('button', { name: 'Toque de novo para sair' })
    expect(pedidosPara(servidor, 'POST', '/api/auth/sair')).toHaveLength(0)

    await fireEvent.press(armado)
    await waitFor(() => expect(pedidosPara(servidor, 'POST', '/api/auth/sair')).toHaveLength(1))
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Você saiu. Seus dados neste aparelho foram apagados.',
      }),
    )
  })

  test('sem o segundo toque, volta a "Sair" depois de 4 segundos', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
    const { servidor } = await renderizarTela(<TelaPerfil />, { papel: 'membro' })
    await fireEvent.press(await screen.findByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('button', { name: 'Toque de novo para sair' })).toBeOnTheScreen()
    await act(async () => {
      jest.advanceTimersByTime(4100)
    })
    expect(await screen.findByRole('button', { name: 'Sair' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Toque de novo para sair' })).toBeNull()
    expect(pedidosPara(servidor, 'POST', '/api/auth/sair')).toHaveLength(0)
  })
})
