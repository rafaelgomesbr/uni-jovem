/**
 * D69: "Igual ao último sábado" e "Marcar o próximo sábado". A tela abre já na CONFERÊNCIA: o app
 * copia o último encontro (rascunho, sem avisar ninguém) e mostra o que foi copiado e quem não
 * está disponível; publicar é o botão do líder, com Desfazer de 10 s.
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { eventoDeTeste } from '@/testes/fixturas'
import { BASE, FUSO, PESSOAS, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast, mostrarToast } from '@/ui/Toast'
import { confirmarAgora, desfazerAgora } from '@/ui/ToastComDesfazer'

import { reiniciarConvocadosEmEspera } from '../convocadosOtimistas'
import { TelaIgualAoUltimo } from '../TelaIgualAoUltimo'

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
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const NOVO = '77777777-7777-4777-8777-000000000001'
const ORIGEM = '77777777-7777-4777-8777-000000000000'
const BRUNO = PESSOAS[1]!

/** Onze pessoas convocadas, uma delas o Bruno (que avisou que não pode neste dia). */
const ONZE = Array.from({ length: 11 }, (_, i) => ({
  id: `atr-${i}`,
  etapaId: null,
  vinculoId:
    i === 0 ? BRUNO.vinculoId : `99999999-9999-4999-8999-0000000000${String(i).padStart(2, '0')}`,
  funcao: i === 0 ? 'Violão' : 'Recepção',
  estado: 'pendente' as const,
  nome: i === 0 ? BRUNO.nome : `Pessoa ${i}`,
}))

const OPCAO = {
  eventoId: ORIGEM,
  titulo: 'Sábado Jovem',
  inicio: '2026-11-21T19:00:00.000Z',
  fuso: FUSO,
  duracaoMin: 60,
  etapas: 7,
  convocados: 11,
  musicas: 4,
  dataSugerida: '2026-11-28',
  horaSugerida: '16:00',
  inicioSugerido: '2026-11-28T19:00:00.000Z',
}

function respostaDaCopia(parcial: object = {}) {
  return {
    id: NOVO,
    versao: 1,
    status: 'rascunho',
    inicio: '2026-11-28T19:00:00.000Z',
    fuso: FUSO,
    resumo: {
      origem: { id: ORIGEM, titulo: 'Sábado Jovem', inicio: OPCAO.inicio },
      etapas: 7,
      duracaoTotalMin: 60,
      checklist: 2,
      tarefas: 1,
      materiais: 0,
      convocados: { pessoas: 11, itens: [] },
      naoCopiados: 0,
      indisponiveis: [{ vinculoId: BRUNO.vinculoId, nome: BRUNO.nome, funcao: 'Violão' }],
      musicas: { copiadas: 0, naOrigem: 4 },
      avisariaAoPublicar: 11,
    },
    ...parcial,
  }
}

function rotas(extras: object = {}) {
  return {
    [`GET ${BASE}/eventos/anteriores-para-copiar`]: () => ({
      status: 200,
      corpo: { opcoes: [OPCAO] },
    }),
    [`POST ${BASE}/eventos/${ORIGEM}/copiar`]: () => ({ status: 200, corpo: respostaDaCopia() }),
    [`GET ${BASE}/eventos/${NOVO}`]: () => ({
      status: 200,
      corpo: eventoDeTeste({
        id: NOVO,
        status: 'rascunho',
        inicio: '2026-11-28T19:00:00.000Z',
        atribuicoes: ONZE,
        local: {
          id: 'l1',
          nome: 'Salão da igreja',
          tipo: 'interno',
          endereco: null,
          latitude: null,
          longitude: null,
          referencia: null,
        },
      }),
    }),
    [`POST ${BASE}/eventos/${NOVO}/status`]: () => ({ status: 200, corpo: { ok: true } }),
    [`DELETE ${BASE}/eventos/${NOVO}`]: () => ({ status: 200, corpo: { ok: true } }),
    ...extras,
  }
}

function montar(papel: 'organizador' | 'membro' = 'organizador', extras: object = {}) {
  return renderizarTela(
    <>
      <TelaIgualAoUltimo />
      <HospedeiroDeToast />
    </>,
    { papel, rotas: rotas(extras) },
  )
}

describe('Igual ao último sábado (a conferência)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useLocalSearchParams).mockReturnValue({})
    reiniciarConvocadosEmEspera()
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
  })

  test('abre já copiado, sem toque: o rascunho nasce com a data sugerida e a conferência mostra o resumo', async () => {
    const { servidor } = await montar()
    expect(await screen.findByText('Roteiro: 7 etapas, 1 h')).toBeOnTheScreen()
    // Uma cópia só, sem corpo escolhido pela pessoa (vale a data sugerida pelo servidor).
    const copias = pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)
    expect(copias).toHaveLength(1)
    expect(copias[0]?.corpo).toEqual({ incluirMusicas: false })
    expect(screen.getByText('Sáb., 28 de nov. · 16:00 · Salão da igreja')).toBeOnTheScreen()
    expect(screen.getByText('Banda e equipe: 11 pessoas')).toBeOnTheScreen()
    // "Ninguém foi avisado": é rascunho.
    expect(screen.getByText('Rascunho · ninguém foi avisado')).toBeOnTheScreen()
    expect(screen.getByText('Bruno avisou que não pode neste dia.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Trocar Bruno Lima: Violão' })).toBeOnTheScreen()
  })

  test('"Publicar e avisar 11 pessoas": Desfazer de 10 s e só então publica e leva ao encontro', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar()
    await usuario.press(await screen.findByRole('button', { name: 'Publicar e avisar 11 pessoas' }))
    expect(await screen.findByText('Publicando e avisando 11 pessoas.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Publicado' })).toBeDisabled()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${NOVO}/status`)).toHaveLength(0)

    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${NOVO}/status`)[0]?.corpo).toEqual({
        status: 'publicado',
      }),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Publicado. 11 pessoas avisadas.' }),
    )
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]',
        params: { eventoId: NOVO },
      }),
    )
  })

  test('Desfazer: o botão volta e ninguém é avisado (nunca o app publica sozinho)', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar()
    await usuario.press(await screen.findByRole('button', { name: 'Publicar e avisar 11 pessoas' }))
    await usuario.press(await screen.findByRole('button', { name: 'Desfazer' }))
    expect(
      await screen.findByRole('button', { name: 'Publicar e avisar 11 pessoas' }),
    ).toBeEnabled()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${NOVO}/status`)).toHaveLength(0)
    expect(router.replace).not.toHaveBeenCalled()
  })

  test('"Salvar rascunho" guarda e abre o encontro, sem publicar', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar()
    await usuario.press(await screen.findByRole('button', { name: 'Salvar rascunho' }))
    expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Rascunho salvo. Ninguém foi avisado.' })
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: NOVO },
    })
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${NOVO}/status`)).toHaveLength(0)
  })

  test('"Levar as músicas também": refaz a cópia (apaga o rascunho anterior) com as músicas', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar()
    const caixa = await screen.findByRole('checkbox', { name: 'Levar as músicas também' })
    expect(caixa).not.toBeChecked()
    await usuario.press(caixa)
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)).toHaveLength(2),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)[1]?.corpo).toEqual({
      incluirMusicas: true,
    })
    // O rascunho da primeira cópia sai antes (nada fica solto na Agenda).
    expect(pedidosPara(servidor, 'DELETE', `${BASE}/eventos/${NOVO}`)).toHaveLength(1)
  })

  test('mudar a data: as opções mostram as datas e escolher refaz a cópia nela', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar()
    await screen.findByText('Roteiro: 7 etapas, 1 h')
    expect(screen.getByRole('radio', { name: 'Sáb., 28 de nov.' })).toBeChecked()
    await usuario.press(screen.getByRole('radio', { name: 'Sáb., 5 de dez.' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)).toHaveLength(2),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)[1]?.corpo).toEqual({
      data: '2026-12-05',
      incluirMusicas: false,
    })
    expect(screen.getByRole('radio', { name: 'Outra data' })).toBeOnTheScreen()
  })

  test('"Trocar": tira a pessoa que não pode do rascunho e abre o Convocar na função dela', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar('organizador', {
      [`DELETE ${BASE}/eventos/${NOVO}/atribuicoes/atr-0`]: () => ({
        status: 200,
        corpo: { ok: true },
      }),
    })
    // "Trocar" só habilita quando o encontro copiado já carregou (precisa saber quem tirar).
    const trocar = await screen.findByRole('button', { name: 'Trocar Bruno Lima: Violão' })
    await waitFor(() => expect(trocar).toBeEnabled())
    await usuario.press(trocar)
    await waitFor(() =>
      expect(
        pedidosPara(servidor, 'DELETE', `${BASE}/eventos/${NOVO}/atribuicoes/atr-0`),
      ).toHaveLength(1),
    )
    expect(await screen.findByText('Convocar para Violão')).toBeOnTheScreen()
  })

  test('"Copiar este encontro" (com `origem`) não lista os anteriores: copia direto daquele', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ origem: ORIGEM })
    const { servidor } = await montar()
    expect(await screen.findByText('Roteiro: 7 etapas, 1 h')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', `${BASE}/eventos/anteriores-para-copiar`)).toHaveLength(0)
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)).toHaveLength(1)
  })

  test('a lista de até 3 origens: escolher outra refaz a cópia a partir dela', async () => {
    const usuario = userEvent.setup()
    const OUTRA = '77777777-7777-4777-8777-000000000009'
    const { servidor } = await montar('organizador', {
      [`GET ${BASE}/eventos/anteriores-para-copiar`]: () => ({
        status: 200,
        corpo: { opcoes: [OPCAO, { ...OPCAO, eventoId: OUTRA, titulo: 'Noite de Louvor' }] },
      }),
      [`POST ${BASE}/eventos/${OUTRA}/copiar`]: () => ({ status: 200, corpo: respostaDaCopia() }),
    })
    expect(await screen.findByRole('radio', { name: /^Sábado Jovem/ })).toBeChecked()
    await usuario.press(screen.getByRole('radio', { name: /^Noite de Louvor/ }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${OUTRA}/copiar`)).toHaveLength(1),
    )
  })

  test('primeira vez, sem encontro realizado: oferece o Sábado padrão e o Em branco', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar('organizador', {
      [`GET ${BASE}/eventos/anteriores-para-copiar`]: () => ({
        status: 200,
        corpo: { opcoes: [] },
      }),
    })
    expect(await screen.findByText('Ainda não há um encontro para copiar.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)).toHaveLength(0)
    await usuario.press(screen.getByRole('button', { name: 'Usar o Sábado padrão' }))
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/evento/novo',
      params: { modelo: 'sabado_padrao' },
    })
  })

  test('erro ao copiar: texto humano e "Tentar de novo"', async () => {
    let tentativas = 0
    const usuario = userEvent.setup()
    await montar('organizador', {
      [`POST ${BASE}/eventos/${ORIGEM}/copiar`]: () => {
        tentativas += 1
        return tentativas === 1
          ? {
              status: 400,
              corpo: {
                erro: 'data_no_passado',
                mensagem: 'Escolha uma data que ainda não passou.',
              },
            }
          : { status: 200, corpo: respostaDaCopia() }
      },
    })
    expect(await screen.findByText('Não deu para copiar o encontro')).toBeOnTheScreen()
    expect(screen.getByText('Escolha uma data que ainda não passou.')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Roteiro: 7 etapas, 1 h')).toBeOnTheScreen()
  })

  test('o membro não marca encontros', async () => {
    const { servidor } = await montar('membro')
    expect(await screen.findByText('Só a organização marca encontros')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)).toHaveLength(0)
  })
})
