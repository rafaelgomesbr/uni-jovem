import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { BASE, PESSOAS, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { TelaComunidade } from '../TelaComunidade'
import { TelaConvidar } from '../TelaConvidar'
import { TelaMembro } from '../TelaMembro'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}))

jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))

// As confirmações vão em toast: o teste confere o que foi pedido.
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const TOKEN = 'a'.repeat(43)
const LINK = `https://app.exemplo/convite#t=${TOKEN}`

function euComoCriador(comComunidade: boolean) {
  const base = respostaEu('membro')
  return () => ({
    status: 200,
    corpo: {
      conta: { ...base.conta, criador: true, doisFatores: true },
      comunidades: comComunidade ? base.comunidades : [],
    },
  })
}

beforeEach(() => {
  jest.mocked(mostrarToast).mockClear()
  jest.mocked(confirmar).mockReset()
  jest.mocked(useLocalSearchParams).mockReturnValue({})
})

describe('aba Comunidade (D57)', () => {
  test('membro: atalhos da comunidade no topo, sem os da organização nem os da conta', async () => {
    await renderizarTela(<TelaComunidade />, { papel: 'membro' })
    expect(await screen.findByText('Você é Membro · 3 pessoas')).toBeOnTheScreen()
    const usuario = userEvent.setup()
    for (const [nome, rota] of [
      ['Avisos', '/avisos'],
      ['Pedidos de oração', '/oracao'],
      ['Sugestões', '/sugestoes'],
      ['Conteúdos', '/conteudos'],
    ] as const) {
      await usuario.press(screen.getByRole('button', { name: new RegExp(`^${nome}[.]`) }))
      expect(router.push).toHaveBeenLastCalledWith(rota)
    }
    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen()
    // "Louvor" é só de quem toca ou organiza (D62): este membro não foi convocado ao louvor.
    expect(screen.queryByRole('button', { name: /^Louvor[.]/ })).toBeNull()
    // Organização é só para quem organiza.
    expect(screen.queryByRole('button', { name: /^Relatórios\./ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Locais\./ })).toBeNull()
    // Criar, entrar em outra e denunciar moram no Perfil, em "Mais opções".
    expect(screen.queryByRole('button', { name: 'Criar comunidade' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Entrar em outra comunidade/ })).toBeNull()
    // Membro não convida nem vê a lista de convites.
    expect(screen.queryByRole('button', { name: /^Criar convite/ })).toBeNull()
    expect(screen.queryByRole('radio', { name: /^Convites/ })).toBeNull()
  })

  test('"Louvor" aparece para o membro convocado ao louvor, com a descrição nova (D62)', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/minhas-escalas`]: () => ({
          status: 200,
          corpo: {
            escalas: [
              {
                id: 'a1',
                funcao: 'Violão',
                estado: 'confirmada',
                eventoId: 'e1',
                eventoTitulo: 'Sábado',
                eventoInicio: '2026-11-28T19:00:00.000Z',
                eventoStatus: 'publicado',
                etapaTitulo: 'Louvor',
                substituicaoAberta: null,
              },
            ],
          },
        }),
      },
    })
    const louvor = await screen.findByRole('button', { name: /^Louvor[.]/ })
    expect(louvor).toBeOnTheScreen()
    expect(screen.getByText('Repertório e cifras do encontro.')).toBeOnTheScreen()
    // "Conteúdos" é a biblioteca; o vocabulário musical não vaza para cá.
    expect(screen.getByText('Biblioteca da comunidade.')).toBeOnTheScreen()
    await userEvent.setup().press(louvor)
    expect(router.push).toHaveBeenLastCalledWith('/louvor')
  })

  test('"Louvor" não aparece para quem só foi convocado a outra função', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/minhas-escalas`]: () => ({
          status: 200,
          corpo: {
            escalas: [
              {
                id: 'a1',
                funcao: 'Recepção',
                estado: 'confirmada',
                eventoId: 'e1',
                eventoTitulo: 'Sábado',
                eventoInicio: '2026-11-28T19:00:00.000Z',
                eventoStatus: 'publicado',
                etapaTitulo: 'Boas-vindas',
                substituicaoAberta: null,
              },
            ],
          },
        }),
      },
    })
    await screen.findByRole('button', { name: /^Avisos[.]/ })
    expect(screen.queryByRole('button', { name: /^Louvor[.]/ })).toBeNull()
  })

  test('"Louvor" aparece para quem organiza, sem precisar de convocação', async () => {
    await renderizarTela(<TelaComunidade />, { papel: 'organizador' })
    expect(await screen.findByRole('button', { name: /^Louvor[.]/ })).toBeOnTheScreen()
  })

  test('admin: atalhos da organização, Configurações uma vez só e sem a Plataforma', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'admin',
      rotas: {
        // Admin e Criador ao mesmo tempo: mesmo assim, a Plataforma não aparece aqui.
        'GET /api/v1/eu': () => {
          const base = respostaEu('admin')
          return { status: 200, corpo: { ...base, conta: { ...base.conta, criador: true } } }
        },
        [`GET ${BASE}/convites`]: () => ({ status: 200, corpo: { convites: [] } }),
      },
    })
    expect(await screen.findByRole('button', { name: /^Relatórios\./ })).toBeOnTheScreen()
    for (const nome of ['Locais', 'Modelos', 'Denúncias']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${nome}[.]`) })).toBeOnTheScreen()
    }
    expect(screen.getAllByRole('button', { name: /^Configurações da comunidade/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /^Código da comunidade/ })).toBeOnTheScreen()
    // A Plataforma do Criador fica só no Perfil.
    expect(screen.queryByRole('button', { name: /^Plataforma/ })).toBeNull()
  })

  test('o Criador sem comunidade vê como criar a primeira e entrar com convite', async () => {
    await renderizarTela(<TelaComunidade />, {
      rotas: { 'GET /api/v1/eu': euComoCriador(false) },
    })
    expect(await screen.findByRole('button', { name: 'Criar comunidade' })).toBeOnTheScreen()
    // Entrar com um convite: a pílula vazia do topo leva até lá (quadro 10).
    expect(
      screen.getByRole('button', { name: 'Sem comunidade. Entrar numa comunidade' }),
    ).toBeOnTheScreen()
  })

  test('admin vê membros com papel e o cartão de convidar', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'admin',
      rotas: { [`GET ${BASE}/convites`]: () => ({ status: 200, corpo: { convites: [] } }) },
    })
    expect(
      await screen.findByRole('button', { name: 'Criar convite para Jovens Centro' }),
    ).toBeOnTheScreen()
    // Papel em chip: Administrador, Organizador e Membro, em texto.
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.getAllByText('Membro').length).toBeGreaterThan(0)
    await userEvent.setup().press(screen.getByRole('radio', { name: /^Convites/ }))
    expect(await screen.findByText('Ainda não há convites')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Convidar a primeira pessoa' })).toBeOnTheScreen()
  })
})

describe('papéis que cada um concede', () => {
  test('organizador não cria convite (nem de administrador)', async () => {
    await renderizarTela(<TelaConvidar />, { papel: 'organizador' })
    expect(await screen.findByText('Convites são criados pela administração')).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'Administrador' })).toBeNull()
  })

  test('organizador não vê opção de conceder administrador a uma pessoa', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ vinculoId: PESSOAS[1]!.vinculoId })
    await renderizarTela(<TelaMembro />, { papel: 'organizador' })
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'Administrador' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar papel' })).toBeNull()
  })

  test('admin concede até administrador', async () => {
    await renderizarTela(<TelaConvidar />, { papel: 'admin' })
    expect(await screen.findByRole('radio', { name: 'Administrador' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Organizador' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Membro' })).toBeOnTheScreen()
  })
})

describe('convites', () => {
  test('criar convite mostra o link com Copiar, Compartilhar e o QR', async () => {
    const { servidor } = await renderizarTela(<TelaConvidar />, {
      papel: 'admin',
      rotas: {
        [`POST ${BASE}/convites`]: () => ({
          status: 200,
          corpo: { id: 'c1', link: LINK, expiraEm: '2026-11-21T12:00:00.000Z' },
        }),
      },
    })
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Criar convite de membro para Jovens Centro' }),
    )

    expect(await screen.findByRole('button', { name: 'Copiar link' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toBeOnTheScreen()
    expect(screen.getByText(LINK)).toBeOnTheScreen()
    expect(screen.getByText(/Vale até/)).toBeOnTheScreen()
    // O QR aparece sob pedido, para quem está ao lado.
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar o QR' }))
    expect(screen.getByLabelText('QR com o link do convite')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/convites`)[0]?.corpo).toEqual({
      papel: 'membro',
      validadeDias: 7,
    })
  })

  test('cancelar o convite pede confirmação antes de chamar a API', async () => {
    const { servidor } = await renderizarTela(<TelaComunidade />, {
      papel: 'admin',
      rotas: {
        [`GET ${BASE}/convites`]: () => ({
          status: 200,
          corpo: {
            convites: [
              {
                id: 'c1',
                papel: 'organizador',
                emailDestino: 'lia@exemplo.com',
                criadoEm: '2026-11-14T12:00:00.000Z',
                expiraEm: '2026-11-21T12:00:00.000Z',
                situacao: 'valido',
              },
            ],
          },
        }),
        [`POST ${BASE}/convites/c1/revogar`]: () => ({ status: 200, corpo: { ok: true } }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Convites (1)' }))
    const convite = await screen.findByRole('button', {
      name: /^Convite de Organizador\. Válido\. Para lia@exemplo\.com/,
    })
    expect(screen.getByText('Válido')).toBeOnTheScreen()

    // Tocar no convite abre a folha; "Cancelar convite" pede a confirmação nativa.
    jest.mocked(confirmar).mockResolvedValueOnce(false)
    await usuario.press(convite)
    await usuario.press(await screen.findByRole('button', { name: /^Cancelar convite/ }))
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1))
    expect(jest.mocked(confirmar).mock.calls[0]?.[0]).toMatchObject({
      titulo: 'Cancelar este convite?',
      destrutivo: true,
    })
    expect(pedidosPara(servidor, 'POST', `${BASE}/convites/c1/revogar`)).toHaveLength(0)

    jest.mocked(confirmar).mockResolvedValueOnce(true)
    await usuario.press(convite)
    await usuario.press(await screen.findByRole('button', { name: /^Cancelar convite/ }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/convites/c1/revogar`)).toHaveLength(1),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Convite cancelado. O link deixou de funcionar.',
      }),
    )
  })
})
