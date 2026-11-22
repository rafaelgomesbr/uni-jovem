import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { TelaNovaSugestao, TEXTO_DO_ANONIMATO } from '../TelaNovaSugestao'
import { TelaSugestao } from '../TelaSugestao'
import { TelaSugestoes } from '../TelaSugestoes'

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

const SUGESTAO = {
  id: '77777777-7777-4777-8777-000000000001',
  anonima: true,
  titulo: 'Lanche coletivo',
  texto: 'Cada um traz algo no último sábado do mês.',
  status: 'recebida',
  resposta: null,
  respondidaEm: null,
  respondidaPorNome: null,
  autorNome: null,
  minha: false,
  criadoEm: '2026-11-10T12:00:00.000Z',
  atualizadoEm: '2026-11-10T12:00:00.000Z',
  versao: 1,
}

describe('sugestões', () => {
  test('a lista traz o botão "Sugerir uma ideia" com a frase à vista, não só um "+" (D70)', async () => {
    await renderizarTela(<TelaSugestoes />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/sugestoes`]: () => ({ status: 200, corpo: { sugestoes: [] } }) },
    })
    expect(
      (await screen.findAllByRole('button', { name: 'Sugerir uma ideia' })).length,
    ).toBeGreaterThan(0)
    // Vazio com o sol, o que fazer e a ação; a palavra "Nova" sozinha saiu.
    expect(screen.getByText('Nenhuma sugestão por aqui.')).toBeOnTheScreen()
    expect(screen.queryByText('Nova')).toBeNull()
  })

  test('erro ao carregar: texto humano e "Tentar de novo"', async () => {
    await renderizarTela(<TelaSugestoes />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/sugestoes`]: () => ({
          status: 500,
          corpo: { codigo: 'erro_interno', mensagem: 'falha' },
        }),
      },
    })
    expect(await screen.findByText('Não deu para carregar as sugestões')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('anônima explica que ninguém vê, nem a liderança, e envia anonima: true', async () => {
    const { servidor } = await renderizarTela(<TelaNovaSugestao />, {
      papel: 'membro',
      rotas: { [`POST ${BASE}/sugestoes`]: () => ({ status: 200, corpo: { id: 's1' } }) },
    })
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Lanche coletivo')
    await fireEvent.changeText(screen.getByLabelText('Sua sugestão'), 'Cada um traz algo.')
    // Interruptor (3.7.2): liga e desliga, com o estado também escrito.
    const caixa = screen.getByRole('switch', { name: 'Enviar como anônima' })
    expect(caixa).not.toBeChecked()
    expect(screen.getByText(TEXTO_DO_ANONIMATO)).toBeOnTheScreen()
    await fireEvent.press(caixa)
    expect(screen.getByText(/inclusive para a liderança/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar sugestão' }))

    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/sugestoes`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/sugestoes`)[0]!.corpo).toEqual({
      titulo: 'Lanche coletivo',
      texto: 'Cada um traz algo.',
      anonima: true,
    })
  })

  test('organizador muda o status e responde, com a versão vista', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ sugestaoId: SUGESTAO.id })
    const { servidor } = await renderizarTela(<TelaSugestao />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/sugestoes/${SUGESTAO.id}`]: () => ({ status: 200, corpo: SUGESTAO }),
        [`PATCH ${BASE}/sugestoes/${SUGESTAO.id}`]: () => ({
          status: 200,
          corpo: { id: SUGESTAO.id, status: 'aceita', versao: 2 },
        }),
      },
    })
    expect(await screen.findByText('Enviada sem nome em 10/11/2026')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: 'Aceita' }))
    await fireEvent.changeText(
      screen.getByLabelText('Resposta (quem sugeriu lê)'),
      'Começamos em dezembro.',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar status e resposta' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PATCH', `${BASE}/sugestoes/${SUGESTAO.id}`)).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'PATCH', `${BASE}/sugestoes/${SUGESTAO.id}`)[0]!.corpo).toEqual({
      status: 'aceita',
      resposta: 'Começamos em dezembro.',
      versao: 1,
    })
  })

  test('membro não vê a moderação e pode denunciar a sugestão de outra pessoa', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ sugestaoId: SUGESTAO.id })
    await renderizarTela(<TelaSugestao />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/sugestoes/${SUGESTAO.id}`]: () => ({ status: 200, corpo: SUGESTAO }) },
    })
    expect(await screen.findByText('Lanche coletivo')).toBeOnTheScreen()
    expect(screen.queryByText('Moderar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Denunciar' })).toBeOnTheScreen()
  })
})
