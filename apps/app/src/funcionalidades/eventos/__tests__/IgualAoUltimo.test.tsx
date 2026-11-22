/**
 * D69, D78: "Igual ao último encontro" e "Marcar o próximo encontro". A tela abre já na CONFERÊNCIA: o app
 * copia o último encontro (rascunho, sem avisar ninguém) e mostra o que foi copiado e quem não
 * está disponível; publicar é o botão do líder, com Desfazer. D74: o botão e o cabeçalho dizem
 * "Publicando em N s" durante a contagem, o fim diz "Publicado. 11 pessoas foram avisadas.", a data
 * ocupada é avisada antes e o rascunho que sobrou de uma abertura interrompida é apagado.
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { gravarPreferenciaLocal, lerPreferenciaLocal } from '@/estado/preferenciaLocal'
import { eventoDeTeste } from '@/testes/fixturas'
import { BASE, COMUNIDADE, FUSO, PESSOAS, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast, mostrarToast } from '@/ui/Toast'
import {
  aoMudarEstadoDoApp,
  confirmarAgora,
  desfazerAgora,
  reiniciarDesfazer,
} from '@/ui/ToastComDesfazer'
import { confirmar } from '@/utilidades/confirmar'

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
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))
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

/** A conferência carregou: o cartão do rascunho e o roteiro (as etapas vêm do encontro copiado). */
const aguardarConferencia = () => screen.findByText(/^Roteiro: \d+ etapas?, /)

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

describe('Igual ao último encontro (a conferência)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useLocalSearchParams).mockReturnValue({})
    jest.mocked(confirmar).mockResolvedValue(true)
    reiniciarDesfazer()
    reiniciarConvocadosEmEspera()
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
    reiniciarDesfazer()
  })

  test('abre já copiado, sem toque: o rascunho nasce com a data sugerida e a conferência mostra o resumo', async () => {
    const { servidor } = await montar()
    expect(await aguardarConferencia()).toBeOnTheScreen()
    // Uma cópia só, sem corpo escolhido pela pessoa (vale a data sugerida pelo servidor).
    const copias = pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)
    expect(copias).toHaveLength(1)
    expect(copias[0]?.corpo).toEqual({ incluirMusicas: false })
    expect(screen.getByText('Sáb., 28 de nov. · 16:00 · Salão da igreja')).toBeOnTheScreen()
    expect(screen.getByText('Banda e equipe: 11 pessoas')).toBeOnTheScreen()
    // É rascunho: a etiqueta é curta (uma palavra, não quebra) e a frase diz que ninguém foi avisado.
    expect(screen.getByText('Rascunho')).toBeOnTheScreen()
    expect(
      screen.getByText('Ninguém foi avisado ainda. Ao publicar, 11 pessoas recebem o aviso.'),
    ).toBeOnTheScreen()
    // Quem não pode fica à vista mesmo com a Banda e equipe recolhida.
    expect(screen.getByText('1 não pode')).toBeOnTheScreen()
  })

  test('Roteiro e Banda e equipe são acordeões: abrem e fecham na mesma tela, sem navegar', async () => {
    const usuario = userEvent.setup()
    await montar()
    await aguardarConferencia()
    // Recolhidos: nada das etapas nem das pessoas na tela.
    expect(screen.queryByText('Boas-vindas')).toBeNull()
    expect(screen.queryByText('Avisou que não pode neste dia. Violão')).toBeNull()

    await usuario.press(
      screen.getByRole('button', { name: /^Roteiro: 3 etapas, 30 min\. Recolhido/ }),
    )
    expect(await screen.findByText('Boas-vindas')).toBeOnTheScreen()
    expect(screen.getByText('Encerramento')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: /^Roteiro\. Aberto/ }))
    await waitFor(() => expect(screen.queryByText('Boas-vindas')).toBeNull())

    await usuario.press(screen.getByRole('button', { name: /^Banda e equipe: 11 pessoas/ }))
    expect(await screen.findByText('Avisou que não pode neste dia. Violão')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Trocar Bruno Lima: Violão' })).toBeOnTheScreen()
    // Nenhum toque levou a outra tela.
    expect(router.push).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  test('o título acompanha o dia: "Sábado" copiado para um domingo é "Domingo"', async () => {
    await montar('organizador', {
      [`POST ${BASE}/eventos/${ORIGEM}/copiar`]: () => ({
        status: 200,
        corpo: respostaDaCopia({
          inicio: '2026-11-29T19:00:00.000Z',
          resumo: {
            ...respostaDaCopia().resumo,
            origem: { id: ORIGEM, titulo: 'Sábado', inicio: OPCAO.inicio },
          },
        }),
      }),
      [`GET ${BASE}/eventos/${NOVO}`]: () => ({
        status: 200,
        corpo: eventoDeTeste({
          id: NOVO,
          status: 'rascunho',
          titulo: 'Domingo',
          inicio: '2026-11-29T19:00:00.000Z',
          atribuicoes: ONZE,
        }),
      }),
    })
    expect(await screen.findByText('Domingo')).toBeOnTheScreen()
    expect(screen.queryByText('Sábado')).toBeNull()
    expect(screen.getByText(/^Dom\., 29 de nov\. · 16:00/)).toBeOnTheScreen()
  })

  test('"Publicar": o botão e o cabeçalho dizem "Publicando em 10 s" e só então publica e leva ao encontro', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar()
    await usuario.press(await screen.findByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText('Publicando e avisando 11 pessoas.')).toBeOnTheScreen()
    // Estado único e honesto: o topo NUNCA diz "Rascunho" enquanto o botão diz "Publicado".
    expect(screen.queryByRole('button', { name: 'Publicado' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Publicando em 10 s · Desfazer' })).toBeEnabled()
    expect(screen.getByText('Publicando em 10 s')).toBeOnTheScreen()
    expect(screen.queryByText('Rascunho')).toBeNull()
    // Na contagem o Desfazer toma a barra toda: "Salvar rascunho" sai do caminho.
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${NOVO}/status`)).toHaveLength(0)

    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${NOVO}/status`)[0]?.corpo).toEqual({
        status: 'publicado',
      }),
    )
    // O fim diz o que houve, e o encontro abre com a mesma frase na tela.
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Publicado. 11 pessoas foram avisadas.' }),
    )
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]',
        params: { eventoId: NOVO, publicado: '11' },
      }),
    )
  })

  test('o app vai para segundo plano durante a contagem: a publicação sai na hora, sem perder', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar()
    await usuario.press(await screen.findByRole('button', { name: 'Publicar' }))
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${NOVO}/status`)).toHaveLength(0)
    await act(async () => aoMudarEstadoDoApp('background'))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${NOVO}/status`)).toHaveLength(1),
    )
  })

  test('o servidor recusa: nada foi publicado, o rascunho continua e o botão volta', async () => {
    const usuario = userEvent.setup()
    await montar('organizador', {
      [`POST ${BASE}/eventos/${NOVO}/status`]: () => ({
        status: 409,
        corpo: { erro: 'transicao_invalida', mensagem: 'Não dá.' },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: 'Publicar' }))
    await act(async () => confirmarAgora())
    expect(
      await screen.findByText(
        'Não deu para publicar. Nada foi enviado nem ninguém foi avisado. O rascunho continua salvo. Toque em Tentar de novo.',
      ),
    ).toBeOnTheScreen()
    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeEnabled()
    expect(screen.getByText('Rascunho')).toBeOnTheScreen()
    expect(router.replace).not.toHaveBeenCalled()
  })

  test('Desfazer: o botão volta e ninguém é avisado (nunca o app publica sozinho)', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar()
    await usuario.press(await screen.findByRole('button', { name: 'Publicar' }))
    await usuario.press(await screen.findByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeEnabled()
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

  test('sair sem salvar nem publicar apaga o rascunho que a abertura criou (nada solto na Agenda)', async () => {
    const { servidor, unmount } = await montar()
    await aguardarConferencia()
    await unmount()
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${BASE}/eventos/${NOVO}`)).toHaveLength(1),
    )
  })

  test('"Salvar rascunho" e sair da tela não apaga o que foi guardado', async () => {
    const usuario = userEvent.setup()
    const { servidor, unmount } = await montar()
    await usuario.press(await screen.findByRole('button', { name: 'Salvar rascunho' }))
    await unmount()
    expect(pedidosPara(servidor, 'DELETE', `${BASE}/eventos/${NOVO}`)).toHaveLength(0)
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
    await aguardarConferencia()
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

  test('já existe encontro nesse dia: a tela avisa antes, e publicar pergunta "Criar outro mesmo assim?"', async () => {
    const usuario = userEvent.setup()
    jest.mocked(confirmar).mockResolvedValue(false)
    const { servidor } = await montar('organizador', {
      [`GET ${BASE}/eventos`]: () => ({
        status: 200,
        corpo: {
          eventos: [
            {
              id: '88888888-8888-4888-8888-000000000001',
              titulo: 'Sábado Jovem',
              categoria: 'Encontro',
              inicio: '2026-11-28T19:00:00.000Z',
              duracaoMin: 60,
              fuso: FUSO,
              status: 'publicado',
              visibilidade: 'publica',
              serieId: null,
              versao: 1,
              localNome: null,
              localTipo: null,
              quantidadeDeEtapas: 3,
            },
            // O próprio rascunho desta tela e um encontro cancelado não contam.
            {
              id: NOVO,
              titulo: 'Sábado Jovem',
              categoria: 'Encontro',
              inicio: '2026-11-28T19:00:00.000Z',
              duracaoMin: 60,
              fuso: FUSO,
              status: 'rascunho',
              visibilidade: 'publica',
              serieId: null,
              versao: 1,
              localNome: null,
              localTipo: null,
              quantidadeDeEtapas: 7,
            },
            {
              id: '88888888-8888-4888-8888-000000000002',
              titulo: 'Noite de jogos',
              categoria: 'Encontro',
              inicio: '2026-11-28T22:30:00.000Z',
              duracaoMin: 60,
              fuso: FUSO,
              status: 'cancelado',
              visibilidade: 'publica',
              serieId: null,
              versao: 1,
              localNome: null,
              localTipo: null,
              quantidadeDeEtapas: 0,
            },
          ],
        },
      }),
    })
    expect(
      await screen.findByText(
        'Já existe um encontro neste dia: Sábado Jovem, 16:00. Se publicar este também, a Agenda terá os dois.',
      ),
    ).toBeOnTheScreen()

    await usuario.press(await screen.findByRole('button', { name: 'Publicar' }))
    await waitFor(() =>
      expect(confirmar).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Já existe um encontro neste dia',
          mensagem:
            'Já existe um encontro neste dia: Sábado Jovem, 16:00. Criar outro mesmo assim?',
          confirmar: 'Criar outro mesmo assim',
        }),
      ),
    )
    // A pessoa disse que não: a contagem nem começa e nada é enviado.
    expect(screen.queryByText('Publicando e avisando 11 pessoas.')).toBeNull()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${NOVO}/status`)).toHaveLength(0)

    // Disse que sim: segue para a contagem.
    jest.mocked(confirmar).mockResolvedValue(true)
    await usuario.press(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText('Publicando e avisando 11 pessoas.')).toBeOnTheScreen()
  })

  test('dia livre: sem aviso e sem pergunta', async () => {
    const usuario = userEvent.setup()
    await montar()
    await aguardarConferencia()
    expect(screen.queryByText(/Já existe um encontro neste dia/)).toBeNull()
    await usuario.press(await screen.findByRole('button', { name: 'Publicar' }))
    expect(confirmar).not.toHaveBeenCalled()
  })

  test('"Outra data" está sempre à vista, ao lado das duas datas, e a data padrão é a do servidor (nunca longe)', async () => {
    await montar()
    await aguardarConferencia()
    expect(screen.getByRole('radio', { name: 'Sáb., 28 de nov.' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Sáb., 5 de dez.' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Outra data' })).toBeOnTheScreen()
  })

  test('o rascunho é anotado como provisório e deixa de ser quando se salva', async () => {
    const usuario = userEvent.setup()
    await montar()
    await aguardarConferencia()
    await waitFor(async () =>
      expect(await lerPreferenciaLocal('uj.rascunhos-provisorios')).toEqual([
        { comunidadeId: COMUNIDADE, eventoId: NOVO },
      ]),
    )
    await usuario.press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(async () =>
      expect(await lerPreferenciaLocal('uj.rascunhos-provisorios')).toEqual([]),
    )
  })

  test('um rascunho que sobrou de uma abertura interrompida (app fechado no meio) é apagado ao abrir de novo', async () => {
    const SOBRA = '77777777-7777-4777-8777-0000000000aa'
    await gravarPreferenciaLocal('uj.rascunhos-provisorios', [
      { comunidadeId: COMUNIDADE, eventoId: SOBRA },
      { comunidadeId: 'outra-comunidade', eventoId: 'de-outra' },
    ])
    const { servidor } = await montar('organizador', {
      [`DELETE ${BASE}/eventos/${SOBRA}`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    await aguardarConferencia()
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${BASE}/eventos/${SOBRA}`)).toHaveLength(1),
    )
    // O de outra comunidade não é tocado, e o desta sessão (NOVO) segue anotado.
    expect(pedidosPara(servidor, 'DELETE', `${BASE}/eventos/de-outra`)).toHaveLength(0)
    await waitFor(async () =>
      expect(await lerPreferenciaLocal('uj.rascunhos-provisorios')).toEqual([
        { comunidadeId: 'outra-comunidade', eventoId: 'de-outra' },
        { comunidadeId: COMUNIDADE, eventoId: NOVO },
      ]),
    )
  })

  test('"Trocar": tira a pessoa que não pode do rascunho e abre o Convocar na função dela', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar('organizador', {
      [`DELETE ${BASE}/eventos/${NOVO}/atribuicoes/atr-0`]: () => ({
        status: 200,
        corpo: { ok: true },
      }),
    })
    // "Trocar" mora na Banda e equipe: abre o acordeão e só habilita quando o encontro carregou.
    await usuario.press(await screen.findByRole('button', { name: /^Banda e equipe: 11 pessoas/ }))
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
    expect(await aguardarConferencia()).toBeOnTheScreen()
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

  test('primeira vez, sem encontro realizado: oferece o Encontro padrão e o Em branco', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar('organizador', {
      [`GET ${BASE}/eventos/anteriores-para-copiar`]: () => ({
        status: 200,
        corpo: { opcoes: [] },
      }),
    })
    expect(await screen.findByText('Ainda não há um encontro para copiar.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)).toHaveLength(0)
    await usuario.press(screen.getByRole('button', { name: 'Usar o Encontro padrão' }))
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
    expect(await aguardarConferencia()).toBeOnTheScreen()
  })

  test('o membro não marca encontros', async () => {
    const { servidor } = await montar('membro')
    expect(await screen.findByText('Só a organização marca encontros')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${ORIGEM}/copiar`)).toHaveLength(0)
  })
})
