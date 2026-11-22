import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router'
import { Alert } from 'react-native'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'
import { reiniciarAcordeoesDaSessao } from '@/ui/Acordeao'
import { mostrarToast } from '@/ui/Toast'
import {
  confirmarAgora,
  desfazerAgora,
  haDesfazerPendente,
  mostrarDesfazer,
} from '@/ui/ToastComDesfazer'

import { descricaoDoAviso, TelaAvisos } from '../TelaAvisos'
import { TelaAviso } from '../TelaAviso'
import { TelaNovoAviso } from '../TelaNovoAviso'

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
// O Desfazer é de verdade (10 s, `confirmarAgora`, `desfazerAgora`); o espião só lê o pedido.
jest.mock('@/ui/ToastComDesfazer', () => {
  const real = jest.requireActual('@/ui/ToastComDesfazer')
  return { ...real, mostrarDesfazer: jest.fn(real.mostrarDesfazer) }
})

const DOIS_DIAS = 2 * 24 * 60 * 60 * 1000

const AVISO = {
  id: '88888888-8888-4888-8888-000000000001',
  titulo: 'Ensaio na sexta',
  texto: 'Quem toca, chegue às 19:00.',
  estado: 'publicado',
  fixado: false,
  publicadoEm: new Date(Date.now() - DOIS_DIAS).toISOString(),
  visivelAte: null,
  criadoEm: '2026-11-12T12:00:00.000Z',
  atualizadoEm: '2026-11-12T12:00:00.000Z',
  versao: 4,
  autorNome: 'Ana Souza',
}

const RASCUNHO = {
  ...AVISO,
  id: '88888888-8888-4888-8888-000000000002',
  titulo: 'Retiro de março',
  estado: 'rascunho',
  publicadoEm: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  reiniciarAcordeoesDaSessao()
  onlineManager.setOnline(true)
  jest.mocked(useLocalSearchParams).mockReturnValue({})
})

afterEach(() => {
  // Nenhuma espera de Desfazer vaza de um teste para o outro.
  if (haDesfazerPendente()) desfazerAgora()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('lista de avisos', () => {
  test('os fixados primeiro e a data em palavras ("há 2 dias"); membro não vê "Novo aviso"', async () => {
    await renderizarTela(<TelaAvisos />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/avisos`]: () => ({
          status: 200,
          corpo: { avisos: [{ ...AVISO, id: 'a1', titulo: 'Retiro', fixado: true }, AVISO] },
        }),
      },
    })
    expect(await screen.findByText('Retiro')).toBeOnTheScreen()
    expect(screen.getByText('Fixados')).toBeOnTheScreen()
    expect(screen.getByText('Recentes')).toBeOnTheScreen()
    expect(screen.getAllByText('Publicado há 2 dias')).toHaveLength(2)
    // Fixado é dito por extenso para o leitor de tela, não só pelo alfinete.
    expect(
      screen.getByRole('button', { name: 'Retiro. Fixado, Publicado há 2 dias' }),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Novo aviso' })).toBeNull()
  })

  test('a organização vê o rascunho com o chip escrito e "Vai avisar 2 pessoas ao publicar"', async () => {
    await renderizarTela(<TelaAvisos />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/avisos`]: () => ({ status: 200, corpo: { avisos: [RASCUNHO, AVISO] } }),
      },
    })
    expect(await screen.findByText('Retiro de março')).toBeOnTheScreen()
    expect(screen.getByText('Rascunho')).toBeOnTheScreen()
    expect(await screen.findByText('Vai avisar 2 pessoas ao publicar')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Novo aviso' })).toBeOnTheScreen()
  })

  test('vazio: o membro lê o que vai acontecer; a organização tem o botão', async () => {
    const vazio = () => ({ status: 200, corpo: { avisos: [] } })
    const membro = await renderizarTela(<TelaAvisos />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/avisos`]: vazio },
    })
    expect(await screen.findByText('Nenhum aviso por enquanto.')).toBeOnTheScreen()
    expect(screen.getByText('Os avisos da liderança aparecem aqui.')).toBeOnTheScreen()
    await membro.unmount()

    await renderizarTela(<TelaAvisos />, {
      papel: 'organizador',
      rotas: { [`GET ${BASE}/avisos`]: vazio },
    })
    expect(await screen.findByText('Escreva o primeiro aviso.')).toBeOnTheScreen()
    // Cabeçalho e vazio oferecem "Novo aviso": os dois levam ao mesmo lugar.
    await userEvent.setup().press(screen.getAllByRole('button', { name: 'Novo aviso' })[0]!)
    expect(router.push).toHaveBeenLastCalledWith('/avisos/novo')
  })

  test('erro: texto humano e "Tentar de novo"', async () => {
    await renderizarTela(<TelaAvisos />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/avisos`]: () => ({
          status: 500,
          corpo: { codigo: 'erro_interno', mensagem: 'falha' },
        }),
      },
    })
    expect(await screen.findByText('Não deu para carregar os avisos')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('a descrição da linha por situação', () => {
    const agora = new Date()
    const base = { ...AVISO, publicadoEm: new Date(agora.getTime() - DOIS_DIAS).toISOString() }
    expect(descricaoDoAviso(base as never, 14, agora)).toBe('Publicado há 2 dias')
    expect(descricaoDoAviso(RASCUNHO as never, 14, agora)).toBe('Vai avisar 14 pessoas ao publicar')
    expect(descricaoDoAviso(RASCUNHO as never, 1, agora)).toBe('Vai avisar 1 pessoa ao publicar')
    expect(descricaoDoAviso(RASCUNHO as never, null, agora)).toBe('Ainda não publicado')
    expect(descricaoDoAviso({ ...base, estado: 'despublicado' } as never, 14, agora)).toBe(
      'Fora do ar para os membros',
    )
  })
})

describe('novo aviso (fluxo g): publicar espera 10 s com Desfazer', () => {
  async function preencher() {
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Ensaio extra')
    await fireEvent.changeText(screen.getByLabelText('Texto do aviso'), 'Sexta, às 19h.')
  }

  test('"Mais opções" fica fechado: só título e texto à vista; o botão diz quem será avisado', async () => {
    await renderizarTela(<TelaNovoAviso />)
    expect(await screen.findByLabelText('Título')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Mostrar até')).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Fixar no topo' })).toBeNull()
    // Ana está no teste com Bruno e Carla: ela não se avisa, são 2 pessoas.
    expect(
      await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' }),
    ).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: /^Mais opções/ }))
    expect(await screen.findByRole('switch', { name: 'Fixar no topo' })).toBeOnTheScreen()
    expect(screen.getByText('Mostrar até', { exact: false })).toBeOnTheScreen()
  })

  test('publicar mostra o resultado na hora, mas a chamada só sai quando a espera acaba', async () => {
    const { servidor } = await renderizarTela(<TelaNovoAviso />, {
      rotas: { [`POST ${BASE}/avisos`]: () => ({ status: 200, corpo: { id: 'novo' } }) },
    })
    await preencher()
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' }),
    )

    expect(mostrarDesfazer).toHaveBeenCalledWith(
      expect.objectContaining({ texto: 'Publicando e avisando 2 pessoas.' }),
    )
    // Na espera: o botão diz o que está acontecendo, o texto continua na tela e nada saiu.
    expect(await screen.findByRole('button', { name: 'Publicando…' })).toBeDisabled()
    expect(screen.getByLabelText('Título')).toHaveDisplayValue('Ensaio extra')
    expect(pedidosPara(servidor, 'POST', `${BASE}/avisos`)).toHaveLength(0)

    await act(async () => confirmarAgora())
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/avisos`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/avisos`)[0]!.corpo).toEqual({
      titulo: 'Ensaio extra',
      texto: 'Sexta, às 19h.',
      fixado: false,
      visivelAte: null,
      publicar: true,
    })
    await waitFor(() => expect(router.back).toHaveBeenCalled())
    expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Publicado. 2 pessoas avisadas.' })
  })

  test('Desfazer: nada é enviado, o botão volta e o texto continua para editar', async () => {
    const { servidor } = await renderizarTela(<TelaNovoAviso />, {
      rotas: { [`POST ${BASE}/avisos`]: () => ({ status: 200, corpo: { id: 'novo' } }) },
    })
    await preencher()
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' }),
    )
    await screen.findByRole('button', { name: 'Publicando…' })

    await act(async () => desfazerAgora())
    expect(await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' })).toBeEnabled()
    expect(screen.getByLabelText('Texto do aviso')).toHaveDisplayValue('Sexta, às 19h.')
    expect(pedidosPara(servidor, 'POST', `${BASE}/avisos`)).toHaveLength(0)
    expect(router.back).not.toHaveBeenCalled()
  })

  test('aos 10 segundos, sozinho, o envio sai (e antes disso, não)', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
    const { servidor } = await renderizarTela(<TelaNovoAviso />, {
      rotas: { [`POST ${BASE}/avisos`]: () => ({ status: 200, corpo: { id: 'novo' } }) },
    })
    await preencher()
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' }),
    )
    await act(async () => {
      jest.advanceTimersByTime(9000)
    })
    expect(pedidosPara(servidor, 'POST', `${BASE}/avisos`)).toHaveLength(0)
    await act(async () => {
      jest.advanceTimersByTime(1100)
    })
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/avisos`)).toHaveLength(1))
  })

  test('o segundo toque durante a espera não cria outro aviso', async () => {
    const { servidor } = await renderizarTela(<TelaNovoAviso />, {
      rotas: { [`POST ${BASE}/avisos`]: () => ({ status: 200, corpo: { id: 'novo' } }) },
    })
    await preencher()
    const publicar = await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' })
    await fireEvent.press(publicar)
    await fireEvent.press(publicar)
    expect(mostrarDesfazer).toHaveBeenCalledTimes(1)
    await act(async () => confirmarAgora())
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/avisos`)).toHaveLength(1))
  })

  test('"Guardar rascunho" não avisa ninguém: sai direto, sem espera', async () => {
    const { servidor } = await renderizarTela(<TelaNovoAviso />, {
      rotas: { [`POST ${BASE}/avisos`]: () => ({ status: 200, corpo: { id: 'novo' } }) },
    })
    await preencher()
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar rascunho' }))
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/avisos`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/avisos`)[0]!.corpo).toMatchObject({
      publicar: false,
    })
    expect(mostrarDesfazer).not.toHaveBeenCalled()
    await waitFor(() => expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Rascunho guardado' }))
  })

  test('campos vazios: os erros aparecem e nada é enviado', async () => {
    await renderizarTela(<TelaNovoAviso />)
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' }),
    )
    expect(await screen.findByText('Dê um título ao aviso.')).toBeOnTheScreen()
    expect(screen.getByText('Escreva o aviso.')).toBeOnTheScreen()
    expect(mostrarDesfazer).not.toHaveBeenCalled()
  })

  test('falha ao publicar: o texto continua, o botão volta e a mensagem não promete o que não é verdade', async () => {
    await renderizarTela(<TelaNovoAviso />, {
      rotas: {
        [`POST ${BASE}/avisos`]: () => ({
          status: 500,
          corpo: { codigo: 'erro_interno', mensagem: 'falha' },
        }),
      },
    })
    await preencher()
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' }),
    )
    await act(async () => confirmarAgora())
    expect(await screen.findByText('Não deu para publicar')).toBeOnTheScreen()
    expect(screen.getByText(/Seu texto continua aqui\. Tente de novo\.$/)).toBeOnTheScreen()
    expect(screen.getByLabelText('Título')).toHaveDisplayValue('Ensaio extra')
    expect(await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' })).toBeEnabled()
    expect(router.back).not.toHaveBeenCalled()
  })

  test('sem internet: publicar desabilitado com o motivo escrito', async () => {
    await renderizarTela(<TelaNovoAviso />)
    await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' })
    await act(async () => onlineManager.setOnline(false))
    expect(await screen.findByText('Precisa de internet para avisar as pessoas.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Publicar e avisar 2 pessoas' })).toBeDisabled()
  })

  test('descartar: vazio não pergunta; com texto, pergunta; durante a espera, não (quem saiu quis publicar)', async () => {
    ;(router.canGoBack as jest.Mock).mockReturnValue(false)
    await renderizarTela(<TelaNovoAviso />)
    const prevenir = usePreventRemove as jest.Mock
    await screen.findByLabelText('Título')
    expect(prevenir).toHaveBeenLastCalledWith(false, expect.any(Function))
    await preencher()
    expect(prevenir).toHaveBeenLastCalledWith(true, expect.any(Function))
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' }),
    )
    await waitFor(() => expect(prevenir).toHaveBeenLastCalledWith(false, expect.any(Function)))
  })
})

describe('detalhe do aviso', () => {
  test('membro lê: título, quem publicou, o texto; sem botões de organização', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ avisoId: AVISO.id })
    await renderizarTela(<TelaAviso />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/avisos/${AVISO.id}`]: () => ({ status: 200, corpo: AVISO }) },
    })
    expect(await screen.findByText('Quem toca, chegue às 19:00.')).toBeOnTheScreen()
    expect(screen.getByText(/^Por Ana Souza/)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Fixar no topo' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Publicar/ })).toBeNull()
  })

  test('o rascunho publica com o número de pessoas e espera o Desfazer', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ avisoId: RASCUNHO.id })
    const { servidor } = await renderizarTela(<TelaAviso />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/avisos/${RASCUNHO.id}`]: () => ({ status: 200, corpo: RASCUNHO }),
        [`POST ${BASE}/avisos/${RASCUNHO.id}/publicar`]: () => ({
          status: 200,
          corpo: { id: RASCUNHO.id },
        }),
      },
    })
    expect(await screen.findByText(/Ninguém foi avisado ainda/)).toBeOnTheScreen()
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' }),
    )
    expect(mostrarDesfazer).toHaveBeenCalledWith(
      expect.objectContaining({ texto: 'Publicando e avisando 2 pessoas.' }),
    )
    expect(await screen.findByRole('button', { name: 'Publicando…' })).toBeDisabled()
    expect(pedidosPara(servidor, 'POST', `${BASE}/avisos/${RASCUNHO.id}/publicar`)).toHaveLength(0)

    await act(async () => desfazerAgora())
    expect(await screen.findByRole('button', { name: 'Publicar e avisar 2 pessoas' })).toBeEnabled()
    expect(pedidosPara(servidor, 'POST', `${BASE}/avisos/${RASCUNHO.id}/publicar`)).toHaveLength(0)

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar e avisar 2 pessoas' }))
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/avisos/${RASCUNHO.id}/publicar`)).toHaveLength(
        1,
      ),
    )
  })

  test('organizador fixa com a versão e despublica com confirmação', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, b) => b?.at(-1)?.onPress?.())
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ avisoId: AVISO.id })
    const { servidor } = await renderizarTela(<TelaAviso />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/avisos/${AVISO.id}`]: () => ({ status: 200, corpo: AVISO }),
        [`PATCH ${BASE}/avisos/${AVISO.id}`]: () => ({ status: 200, corpo: { id: AVISO.id } }),
        [`POST ${BASE}/avisos/${AVISO.id}/despublicar`]: () => ({
          status: 200,
          corpo: { id: AVISO.id },
        }),
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Fixar no topo' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PATCH', `${BASE}/avisos/${AVISO.id}`)[0]?.corpo).toEqual({
        versao: 4,
        fixado: true,
      }),
    )
    // Despublicar fica na folha "Mais ações", com confirmação.
    await fireEvent.press(screen.getByRole('button', { name: 'Mais ações' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Despublicar' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/avisos/${AVISO.id}/despublicar`)).toHaveLength(
        1,
      ),
    )
  })

  test('aviso que sumiu: erro humano com "Tentar de novo"', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ avisoId: 'inexistente' })
    await renderizarTela(<TelaAviso />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/avisos/inexistente`]: () => ({
          status: 404,
          corpo: { codigo: 'nao_encontrado', mensagem: 'não' },
        }),
      },
    })
    expect(await screen.findByText('Não deu para abrir o aviso')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })
})
