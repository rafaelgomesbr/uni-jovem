import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { router } from 'expo-router'

import { COMUNIDADE, BASE, FUSO, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { HospedeiroDeToast } from '@/ui/Toast'

import { TelaConfigurarComunidade } from '../TelaConfigurarComunidade'
import { TelaExcluirComunidade } from '../TelaExcluirComunidade'
import { TelaTrocarComunidade } from '../TelaTrocarComunidade'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(() => jest.fn()),
}))

const APAGADA_EM = '2026-12-22T15:00:00.000Z'

const DETALHE = (papel: string) => ({
  id: COMUNIDADE,
  nome: 'Jovens Centro',
  cor: '#5B4BDB',
  fuso: FUSO,
  estado: 'ativa',
  validadeOfflineDias: 14,
  retencaoInscricoesDias: 90,
  versao: 1,
  meuPapel: papel,
  uso: { membrosAtivos: 12 },
})

const rotasDoAdmin = (extra: Record<string, () => { status: number; corpo?: unknown }> = {}) => ({
  [`GET ${BASE}`]: () => ({ status: 200, corpo: DETALHE('admin') }),
  [`POST ${BASE}/excluir`]: () => ({
    status: 200,
    corpo: { ok: true, estado: 'exclusao_agendada', apagadaEm: APAGADA_EM },
  }),
  ...extra,
})

async function abrir(extra?: Record<string, () => { status: number; corpo?: unknown }>) {
  const r = await renderizarTela(
    <>
      <TelaExcluirComunidade />
      <HospedeiroDeToast />
    </>,
    { papel: 'admin', rotas: rotasDoAdmin(extra) },
  )
  await screen.findByText('O que some')
  return r
}

describe('Excluir esta comunidade: o primeiro passo', () => {
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => onlineManager.setOnline(true))

  test('diz o que some, o que continua e quanto tempo leva, antes de qualquer botão vermelho', async () => {
    await abrir()
    expect(screen.getByText('Excluir esta comunidade?')).toBeOnTheScreen()
    // O que some: encontros, pessoas (com o número), avisos e orações, músicas e PDFs, arquivos.
    expect(
      screen.getByText('Todos os encontros, com convocações, repertório, inscrições e presenças.'),
    ).toBeOnTheScreen()
    expect(await screen.findByText('O vínculo de 12 pessoas com a comunidade.')).toBeOnTheScreen()
    expect(screen.getByText('Avisos, pedidos de oração e sugestões.')).toBeOnTheScreen()
    expect(screen.getByText('Músicas, cifras e PDFs da Biblioteca.')).toBeOnTheScreen()
    expect(screen.getByText('O logotipo e os arquivos da comunidade.')).toBeOnTheScreen()
    // O que continua: as contas.
    expect(
      screen.getByText(/As contas das pessoas não são apagadas: só o vínculo com esta comunidade/),
    ).toBeOnTheScreen()
    // A carência e o desfazer.
    expect(screen.getByText(/Por 30 dias a comunidade fica "em exclusão"/)).toBeOnTheScreen()
    expect(
      screen.getByText(/só a administração pode desfazer, em Perfil, Comunidades/),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Excluir para sempre' })).toBeNull()
  })

  test('Cancelar sai sem pedir nada à API', async () => {
    const { servidor } = await abrir()
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(router.back).toHaveBeenCalled()
    expect(pedidosPara(servidor, 'POST', `${BASE}/excluir`)).toHaveLength(0)
  })

  test.each(['organizador', 'membro'] as const)(
    '%s não exclui: a tela diz quem faz e não oferece o botão',
    async (papel) => {
      await renderizarTela(<TelaExcluirComunidade />, { papel })
      expect(await screen.findByText('Só a administração exclui a comunidade')).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
    },
  )
})

describe('Excluir esta comunidade: confirmar e o resultado', () => {
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => onlineManager.setOnline(true))

  test('segundo passo: o nome escrito na tela, nada enviado até "Excluir para sempre"', async () => {
    const { servidor } = await abrir()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Confirme a exclusão')).toBeOnTheScreen()
    // O nome aparece no cabeçalho e, grande, no cartão: a pessoa lê o que está excluindo.
    expect(screen.getAllByText('Jovens Centro')).toHaveLength(2)
    expect(screen.getByText('Você vai excluir esta comunidade')).toBeOnTheScreen()
    expect(
      screen.getByText(/12 pessoas participam dela\. Todas recebem um aviso/),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/excluir`)).toHaveLength(0)
    // "Não excluir" sai sem enviar.
    await fireEvent.press(screen.getByRole('button', { name: 'Não excluir' }))
    expect(router.back).toHaveBeenCalled()
    expect(pedidosPara(servidor, 'POST', `${BASE}/excluir`)).toHaveLength(0)
  })

  test('confirmar envia o nome lido na tela; o resultado diz quando será apagada e oferece desfazer', async () => {
    const { servidor } = await abrir({
      [`POST ${BASE}/exclusao/desfazer`]: () => ({
        status: 200,
        corpo: { ok: true, estado: 'ativa' },
      }),
    })
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir para sempre' }))
    expect(await screen.findByText(/^Será apagada em \d{2}\/\d{2}\/2026$/)).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/excluir`)[0]!.corpo).toEqual({
      nome: 'Jovens Centro',
      confirmo: true,
    })
    expect(
      screen.getByText(/já não aparece para ninguém\. Até \d{2}\/\d{2}\/2026 você pode desfazer/),
    ).toBeOnTheScreen()
    // Desfazer ali mesmo.
    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer a exclusão' }))
    expect(await screen.findByText('Jovens Centro voltou ao normal.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/exclusao/desfazer`)).toHaveLength(1)
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  test('depois de excluir, a sessão perde a comunidade e o resultado continua na tela', async () => {
    let excluida = false
    await abrir({
      'GET /api/v1/eu': () => ({
        status: 200,
        corpo: excluida ? { ...respostaEu('admin'), comunidades: [] } : respostaEu('admin'),
      }),
      [`POST ${BASE}/excluir`]: () => {
        excluida = true
        return {
          status: 200,
          corpo: { ok: true, estado: 'exclusao_agendada', apagadaEm: APAGADA_EM },
        }
      },
    })
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir para sempre' }))
    expect(await screen.findByText(/^Será apagada em/)).toBeOnTheScreen()
    // Mesmo sem comunidade ativa, a pessoa vê o que aconteceu e como sair.
    await act(async () => undefined)
    expect(screen.getByText(/^Será apagada em/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Ir para o Início' }))
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  test('erro em palavras e o segundo passo continua (nada apagado)', async () => {
    await abrir({
      [`POST ${BASE}/excluir`]: () => ({
        status: 422,
        corpo: {
          erro: 'confirmacao_necessaria',
          mensagem: 'O nome não confere com o da comunidade. Volte e confira antes de excluir.',
        },
      }),
    })
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir para sempre' }))
    expect(await screen.findByText('A comunidade não foi excluída')).toBeOnTheScreen()
    expect(screen.getByText(/O nome não confere com o da comunidade/)).toBeOnTheScreen()
    expect(screen.getByText('Confirme a exclusão')).toBeOnTheScreen()
  })

  test('sem internet o botão fica desabilitado e diz por quê', async () => {
    await abrir()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByText('Confirme a exclusão')
    await act(async () => onlineManager.setOnline(false))
    expect(await screen.findByRole('button', { name: 'Excluir para sempre' })).toBeDisabled()
    expect(screen.getByText('Precisa de internet para excluir a comunidade.')).toBeOnTheScreen()
  })
})

describe('Excluir a comunidade: por onde se chega e como se desfaz', () => {
  beforeEach(() => jest.clearAllMocks())

  test('Configurações (administração): "Limpar próximos encontros" e "Excluir esta comunidade" no fim, com aviso', async () => {
    await renderizarTela(<TelaConfigurarComunidade />, {
      papel: 'admin',
      rotas: { [`GET ${BASE}`]: () => ({ status: 200, corpo: DETALHE('admin') }) },
    })
    expect(await screen.findByText('Cuidado: apaga dados')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: /^Limpar próximos encontros/ }))
    expect(router.push).toHaveBeenLastCalledWith('/limpar-proximos-encontros')
    await fireEvent.press(screen.getByRole('button', { name: /^Excluir esta comunidade/ }))
    expect(router.push).toHaveBeenLastCalledWith('/excluir-comunidade')
  })

  test('a folha Comunidades mostra a que está em exclusão, com a data, e desfaz', async () => {
    let emExclusao = [
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        nome: 'Jovens Sul',
        apagadaEm: APAGADA_EM,
        pedidaEm: '2026-11-22T15:00:00.000Z',
      },
    ]
    const { servidor } = await renderizarTela(
      <>
        <TelaTrocarComunidade />
        <HospedeiroDeToast />
      </>,
      {
        papel: 'admin',
        rotas: {
          'GET /api/v1/eu/comunidades-em-exclusao': () => ({
            status: 200,
            corpo: { comunidades: emExclusao },
          }),
          'POST /api/v1/c/cccccccc-cccc-4ccc-8ccc-cccccccccccc/exclusao/desfazer': () => {
            emExclusao = []
            return { status: 200, corpo: { ok: true, estado: 'ativa' } }
          },
        },
      },
    )
    expect(await screen.findByText('Em exclusão')).toBeOnTheScreen()
    expect(screen.getByText('Jovens Sul')).toBeOnTheScreen()
    expect(
      screen.getByText(
        /^Será apagada de vez em \d{2}\/\d{2}\/2026\. Até lá, ninguém consegue usá-la\.$/,
      ),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer a exclusão de Jovens Sul' }))
    expect(await screen.findByText('Jovens Sul voltou ao normal.')).toBeOnTheScreen()
    expect(
      pedidosPara(
        servidor,
        'POST',
        '/api/v1/c/cccccccc-cccc-4ccc-8ccc-cccccccccccc/exclusao/desfazer',
      ),
    ).toHaveLength(1)
    // Sem nenhuma em exclusão, a seção some.
    await act(async () => undefined)
    expect(screen.queryByText('Em exclusão')).toBeNull()
  })

  test('sem nenhuma comunidade em exclusão a folha não mostra a seção', async () => {
    await renderizarTela(<TelaTrocarComunidade />, {
      papel: 'admin',
      rotas: {
        'GET /api/v1/eu/comunidades-em-exclusao': () => ({
          status: 200,
          corpo: { comunidades: [] },
        }),
      },
    })
    await screen.findByRole('radio', { name: /^Jovens Centro/ })
    expect(screen.queryByText('Em exclusão')).toBeNull()
  })
})
