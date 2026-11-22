import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import type { Rota } from '@/testes/dubles'
import { INICIO } from '@/testes/fixturas'
import {
  RELOGIO,
  aDias,
  eventoDoMomento,
  inicioComMomento,
  liderDoMomento,
  momentoDeTeste,
  parteDoMomento,
} from '@/testes/momento'
import { BASE, COMUNIDADE, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { mostrarDesfazer } from '@/ui/ToastComDesfazer'
import { reiniciarAcordeoesDaSessao } from '@/ui/Acordeao'
import { abrirLink } from '@/utilidades/compartilhar'

import { reiniciarRespostas } from '../../escalas/respostasOtimistas'
import { reiniciarEncantosParaTestes } from '../encantos'
import { TelaInicio } from '../TelaInicio'

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
// O toast com Desfazer: o teste lê o que ele pede e decide quando os 10 s acabam.
jest.mock('@/ui/ToastComDesfazer', () => ({
  ...jest.requireActual('@/ui/ToastComDesfazer'),
  mostrarDesfazer: jest.fn(),
}))
jest.mock('@/ui/Toast', () => ({ ...jest.requireActual('@/ui/Toast'), mostrarToast: jest.fn() }))
jest.mock('@/utilidades/compartilhar', () => ({
  ...jest.requireActual('@/utilidades/compartilhar'),
  abrirLink: jest.fn(async () => true),
}))

const ok = (corpo: unknown) => () => ({ status: 200, corpo })

// O "Seu resumo" tem a própria rota; estes testes são do cartão e do resto do Início.
const VISAO = {
  [`GET ${BASE}/visao-geral?escopo=minha`]: ok({
    escopo: 'minha',
    convocacoesParaResponder: 1,
    convocacoesProximas: 0,
    tarefasAbertas: 0,
    inscricoes: 0,
    presenca30dias: { presentes: 0, encontros: 0 },
    oracoesAtivas: 0,
  }),
  [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok({
    escopo: 'comunidade',
    pessoasAtivas: 12,
    proximosEncontros: [],
    convocacoes: { semResposta: 0, recusadas: 0 },
    pedidosDeEntrada: 0,
    denunciasAbertas: 0,
    presencaMedia: { encontros: 0, media: 0 },
    tarefasAtrasadas: 0,
  }),
}

/** Renderiza o Início de um membro com o momento pedido. */
function comoMembro(momento = momentoDeTeste(), resto: Record<string, Rota> = {}) {
  return renderizarTela(<TelaInicio />, {
    papel: 'membro',
    rotas: { ...VISAO, [`GET ${BASE}/inicio`]: ok(inicioComMomento(momento)), ...resto },
  })
}
/** E o de quem organiza. */
function comoLider(momento = momentoDeTeste(), resto: Record<string, Rota> = {}) {
  return renderizarTela(<TelaInicio />, {
    papel: 'organizador',
    rotas: { ...VISAO, [`GET ${BASE}/inicio`]: ok(inicioComMomento(momento)), ...resto },
  })
}
const cofre = (jest.requireMock('expo-secure-store') as { __cofre: Map<string, string> }).__cofre

const pedidoDoDesfazer = (i = 0) => jest.mocked(mostrarDesfazer).mock.calls[i]![0]

beforeEach(() => {
  jest.clearAllMocks()
  cofre.clear()
  reiniciarEncantosParaTestes()
  reiniciarAcordeoesDaSessao()
  reiniciarRespostas()
})

describe('Início do membro: o cartão do momento (3.1 do UX)', () => {
  test('longe, convocação pendente: etiqueta, título, data, local e a pergunta "Aceitar ou não"', async () => {
    await comoMembro(momentoDeTeste({ suaParte: [parteDoMomento()] }))

    expect(await screen.findByText('EM 5 DIAS')).toBeOnTheScreen()
    expect(screen.getByText('Sábado Jovem')).toBeOnTheScreen()
    expect(screen.getByText(/^Sáb\., \d+ de [a-z]{3}\. · 16:00 às 17:00/)).toBeOnTheScreen()
    expect(screen.getByText(/Salão da igreja$/)).toBeOnTheScreen()
    expect(screen.getByText('Sua parte: Louvor · Vocal')).toBeOnTheScreen()
    expect(screen.getByText('Aguardando sua resposta')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Aceitar a convocação em Sábado Jovem, Louvor · Vocal' }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: /^Não posso ir: avisar a liderança/ }),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Como chegar a Sábado Jovem' })).toBeOnTheScreen()
  })

  test('a ordem fixa: versículo, cartão do momento, resumo, aviso', async () => {
    await comoMembro(momentoDeTeste({ suaParte: [parteDoMomento()] }), {
      [`GET ${BASE}/inicio`]: ok(
        inicioComMomento(momentoDeTeste({ suaParte: [parteDoMomento()] }), {
          avisos: [
            {
              id: 'av1',
              titulo: 'Ensaio às 15h',
              texto: 'No salão.',
              fixado: true,
              publicadoEm: '2026-11-20T12:00:00.000Z',
            },
          ],
        }),
      ),
    })
    await screen.findByText('Aviso fixado: Ensaio às 15h')
    const arvore = JSON.stringify(screen.toJSON())
    const posicao = (trecho: string) => arvore.indexOf(trecho)
    expect(posicao('Versículo do dia, ')).toBeGreaterThan(-1)
    expect(posicao('Versículo do dia, ')).toBeLessThan(posicao('Sábado Jovem'))
    expect(posicao('Sábado Jovem')).toBeLessThan(posicao('Seu resumo'))
    expect(posicao('Seu resumo')).toBeLessThan(posicao('Aviso fixado: Ensaio às 15h'))
  })

  test('confirmado e toca no louvor: o primário é "Abrir o repertório" (vai para Meu repertório)', async () => {
    await comoMembro(momentoDeTeste({ suaParte: [parteDoMomento({ estado: 'confirmada' })] }))

    expect(await screen.findByText('Sua parte: Louvor · Vocal')).toBeOnTheScreen()
    expect(screen.getByText('Confirmado')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Aceitar/ })).toBeNull()
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Abrir o repertório: Sábado Jovem' }))
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
    expect(screen.getByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
  })

  test('confirmado em outra parte: só "Ver o encontro", sem repertório', async () => {
    await comoMembro(
      momentoDeTeste({
        suaParte: [parteDoMomento({ estado: 'confirmada', funcao: 'Recepção', etapaTitulo: null })],
      }),
    )
    expect(await screen.findByText('Sua parte: Recepção')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /repertório/ })).toBeNull()
  })

  test('sem parte: a linha "Sua parte" some e fica só "Ver o encontro"', async () => {
    await comoMembro()
    expect(await screen.findByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
    expect(screen.queryByText(/^Sua parte/)).toBeNull()
  })

  test('encontro público com inscrição aberta: "Inscrições abertas" e "Inscrever-me"', async () => {
    await comoMembro(
      momentoDeTeste({
        evento: eventoDoMomento({ visibilidade: 'publica' }),
        inscricao: { situacao: 'aberta', inscritos: null, capacidade: 60 },
      }),
    )
    expect(await screen.findByText('Inscrições abertas')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Inscrever-me' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
  })

  test('véspera: "AMANHÃ · 16:00" e o primário "Como chegar", que abre o mapa do sistema', async () => {
    await comoMembro(momentoDeTeste({ ...RELOGIO.vespera }))
    expect(await screen.findByText('AMANHÃ · 16:00')).toBeOnTheScreen()
    // O mesmo texto não se repete como link: o primário já é "Como chegar".
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Como chegar a Sábado Jovem' }))
    expect(abrirLink).toHaveBeenCalledWith(expect.stringContaining('Rua%20das%20Flores%2C%2010'))
  })

  test('"Como chegar" de local sem endereço abre o encontro, na linha "Onde"', async () => {
    await comoMembro(
      momentoDeTeste({
        ...RELOGIO.vespera,
        evento: eventoDoMomento({
          local: {
            nome: 'Sala 2',
            tipo: 'interno',
            endereco: null,
            latitude: null,
            longitude: null,
            referencia: null,
          },
        }),
      }),
    )
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Como chegar a Sábado Jovem' }))
    expect(abrirLink).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e1' },
    })
  })

  test('no dia, sem responder: o aviso do dia e o primário continua "Aceitar"', async () => {
    await comoMembro(momentoDeTeste({ ...RELOGIO.dia, suaParte: [parteDoMomento()] }))
    expect(await screen.findByText('HOJE · EM 3 H')).toBeOnTheScreen()
    expect(
      screen.getByText('Você ainda não respondeu. Dá tempo de avisar a liderança.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Aceitar a convocação/ })).toBeOnTheScreen()
  })

  test('acontecendo: etiqueta "ACONTECENDO AGORA" e o primário "Acompanhar ao vivo"', async () => {
    await comoMembro(
      momentoDeTeste({
        ...RELOGIO.agora,
        suaParte: [parteDoMomento({ estado: 'confirmada', funcao: 'Recepção', etapaTitulo: null })],
      }),
    )
    expect(await screen.findByText('ACONTECENDO AGORA')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Acompanhar ao vivo' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/ao-vivo',
      params: { eventoId: 'e1' },
    })
  })

  test('depois do encontro: "Obrigado por servir ontem." e o próximo encontro com "Ver o próximo encontro"', async () => {
    await comoMembro(
      momentoDeTeste({
        recemTerminado: {
          id: 'e0',
          titulo: 'Sábado Jovem',
          inicio: '2026-11-21T19:00:00.000Z',
          fim: '2026-11-21T20:00:00.000Z',
          fuso: 'America/Sao_Paulo',
          presentes: null,
          euServi: true,
        },
      }),
    )
    expect(await screen.findByText('Obrigado por servir ontem.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver o próximo encontro' })).toBeOnTheScreen()
  })

  test('líder: a faixa do encontro de ontem diz qual terminou, sem contradizer o cartão do próximo (D73)', async () => {
    await comoLider(
      momentoDeTeste({
        lider: liderDoMomento(),
        recemTerminado: {
          id: 'e0',
          titulo: 'Sábado Jovem',
          inicio: aDias(-6),
          fim: aDias(-6),
          fuso: 'America/Sao_Paulo',
          presentes: 0,
          euServi: false,
        },
      }),
    )
    // O cartão é do PRÓXIMO encontro (em 5 dias) e a faixa é do de ontem: a faixa diz "de ontem" e
    // não afirma "0 presentes" (sem check-in o zero não é um fato).
    expect(await screen.findByText('EM 5 DIAS')).toBeOnTheScreen()
    expect(screen.getByText('Sábado Jovem de ontem terminou.')).toBeOnTheScreen()
    expect(screen.queryByText(/0 presentes/)).toBeNull()
    expect(screen.queryByText('Sábado Jovem terminou.')).toBeNull()
  })

  test('líder: com presença marcada a faixa leva o número', async () => {
    await comoLider(
      momentoDeTeste({
        lider: liderDoMomento(),
        recemTerminado: {
          id: 'e0',
          titulo: 'Sábado Jovem',
          inicio: aDias(-6),
          fim: aDias(-6),
          fuso: 'America/Sao_Paulo',
          presentes: 12,
          euServi: false,
        },
      }),
    )
    expect(
      await screen.findByText('Sábado Jovem de ontem terminou. 12 presentes.'),
    ).toBeOnTheScreen()
  })

  test('quem não serviu não ganha o "Obrigado"', async () => {
    await comoMembro(
      momentoDeTeste({
        recemTerminado: {
          id: 'e0',
          titulo: 'Sábado Jovem',
          inicio: '2026-11-21T19:00:00.000Z',
          fim: '2026-11-21T20:00:00.000Z',
          fuso: 'America/Sao_Paulo',
          presentes: null,
          euServi: false,
        },
      }),
    )
    await screen.findByText('EM 5 DIAS')
    expect(screen.queryByText('Obrigado por servir ontem.')).toBeNull()
  })
})

describe('Aceitar e Não posso ir: sem "tem certeza?", com Desfazer de 10 s (5.2)', () => {
  const comPendente = () => momentoDeTeste({ suaParte: [parteDoMomento()] })
  const rotaConfirmar = { [`POST ${BASE}/atribuicoes/a1/confirmar`]: ok({ estado: 'confirmada' }) }
  const rotaRecusar = { [`POST ${BASE}/atribuicoes/a1/recusar`]: ok({ estado: 'recusada' }) }

  test('Aceitar: o cartão já mostra "Confirmado"; nada sai até os 10 s; Desfazer volta a pendente', async () => {
    const { servidor } = await comoMembro(comPendente(), rotaConfirmar)
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: /^Aceitar a convocação/ }))

    expect(await screen.findByText('Confirmado')).toBeOnTheScreen()
    expect(screen.queryByText('Aguardando sua resposta')).toBeNull()
    expect(mostrarDesfazer).toHaveBeenCalledTimes(1)
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(0)

    await act(async () => pedidoDoDesfazer().aoDesfazer?.())
    expect(await screen.findByText('Aguardando sua resposta')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(0)
  })

  test('Aceitar: aos 10 s a resposta sai para a API (e só então a liderança é avisada)', async () => {
    const { servidor } = await comoMembro(comPendente(), rotaConfirmar)
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: /^Aceitar a convocação/ }))
    await act(async () => pedidoDoDesfazer().aoConfirmar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(1),
    )
  })

  test('Não posso ir: sem diálogo; o cartão diz que a liderança será avisada e oferece Desfazer', async () => {
    const { servidor } = await comoMembro(comPendente(), rotaRecusar)
    await userEvent.setup().press(await screen.findByRole('button', { name: /^Não posso ir/ }))

    expect(
      await screen.findByText('Você avisou que não pode. A liderança será avisada.'),
    ).toBeOnTheScreen()
    expect(mostrarDesfazer).toHaveBeenCalledTimes(1)
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(0)

    await act(async () => pedidoDoDesfazer().aoConfirmar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(1),
    )
  })
})

describe('Para responder: as convocações de outros encontros', () => {
  const outro = {
    id: 'a2',
    funcao: 'Recepção',
    estado: 'pendente' as const,
    eventoId: 'e2',
    eventoTitulo: 'Sábado Jovem',
    eventoInicio: INICIO,
    etapaTitulo: null,
  }
  const comOutro = () =>
    inicioComMomento(momentoDeTeste({ suaParte: [parteDoMomento({ estado: 'confirmada' })] }), {
      minhasEscalas: [
        {
          id: 'a1',
          funcao: 'Vocal',
          estado: 'confirmada',
          eventoId: 'e1',
          eventoTitulo: 'Sábado Jovem',
          eventoInicio: INICIO,
          etapaTitulo: 'Louvor',
        },
        outro,
      ],
    })

  test('"Para responder (1)" com os dois botões sempre visíveis; a pendência do cartão não repete aqui', async () => {
    await comoMembro(undefined, { [`GET ${BASE}/inicio`]: ok(comOutro()) })
    expect(await screen.findByText('Para responder (1)')).toBeOnTheScreen()
    // O título é o encontro (nunca só a função), e a descrição diz o dia, a hora e a parte da pessoa.
    expect(screen.getAllByText('Sábado Jovem').length).toBeGreaterThan(0)
    expect(screen.getByText(/ · \d{2}:\d{2} · Você: Recepção$/)).toBeOnTheScreen()
    expect(screen.queryByText('Recepção')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Aceitar' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Não posso ir' }).length).toBeGreaterThan(0)
  })

  test('Aceitar na linha: Desfazer de 10 s; a resposta só sai ao confirmar', async () => {
    const { servidor } = await comoMembro(undefined, {
      [`GET ${BASE}/inicio`]: ok(comOutro()),
      [`POST ${BASE}/atribuicoes/a2/confirmar`]: ok({ estado: 'confirmada' }),
    })
    await screen.findByText('Para responder (1)')
    const [aceitar] = screen.getAllByRole('button', { name: 'Aceitar' })
    await userEvent.setup().press(aceitar!)

    await waitFor(() => expect(mostrarDesfazer).toHaveBeenCalledTimes(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a2/confirmar`)).toHaveLength(0)
    await act(async () => pedidoDoDesfazer().aoConfirmar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a2/confirmar`)).toHaveLength(1),
    )
  })

  test('Não posso ir na linha: também com Desfazer, sem diálogo', async () => {
    const { servidor } = await comoMembro(undefined, {
      [`GET ${BASE}/inicio`]: ok(comOutro()),
      [`POST ${BASE}/atribuicoes/a2/recusar`]: ok({ estado: 'recusada' }),
    })
    await screen.findByText('Para responder (1)')
    const [recusar] = screen.getAllByRole('button', { name: 'Não posso ir' })
    await userEvent.setup().press(recusar!)
    await waitFor(() => expect(mostrarDesfazer).toHaveBeenCalledTimes(1))
    await act(async () => pedidoDoDesfazer().aoConfirmar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a2/recusar`)).toHaveLength(1),
    )
  })

  test('sem a linha: o bloco não existe', async () => {
    await comoMembro(momentoDeTeste({ suaParte: [parteDoMomento({ estado: 'confirmada' })] }))
    await screen.findByText('Sua parte: Louvor · Vocal')
    expect(screen.queryByText(/^Para responder/)).toBeNull()
  })
})

describe('"Seu resumo": acordeão fechado', () => {
  test('nasce fechado, com o que espera a pessoa; "Tudo em dia" não abre', async () => {
    await comoMembro()
    const resumo = await screen.findByRole('button', {
      name: /^Seu resumo: 1 coisa esperando você\. Recolhido/,
    })
    expect(resumo).toBeOnTheScreen()
    expect(screen.queryByText('Responder 1 convocação')).toBeNull()
    await userEvent.setup().press(resumo)
    expect(await screen.findByText('Responder 1 convocação')).toBeOnTheScreen()
  })

  test('tudo em dia: o recado com o sol, sem seta', async () => {
    await comoMembro(undefined, {
      [`GET ${BASE}/visao-geral?escopo=minha`]: ok({
        escopo: 'minha',
        convocacoesParaResponder: 0,
        convocacoesProximas: 0,
        tarefasAbertas: 0,
        inscricoes: 0,
        presenca30dias: { presentes: 0, encontros: 0 },
        oracoesAtivas: 0,
      }),
    })
    expect(await screen.findByLabelText('Seu resumo: Tudo em dia')).toBeOnTheScreen()
  })
})

describe('Início do líder: o cartão do momento (3.2 do UX)', () => {
  const lider = (parcial = {}) => liderDoMomento(parcial)

  test('publicado, falta resposta: UMA ação ("Lembrar os 2"), no máximo 2 frases e o resto recolhido', async () => {
    await comoLider(momentoDeTeste({ lider: lider() }))

    // As duas frases: quem falta e a função. Não aparece uma terceira ("O repertório está vazio.").
    expect(await screen.findByText('Faltam: Bruno e Camila')).toBeOnTheScreen()
    expect(screen.getByText('Falta: bateria')).toBeOnTheScreen()
    expect(screen.queryByText('O repertório está vazio.')).toBeNull()
    // UMA ação em destaque: "Lembrar os 2". O outro caminho é um link de texto.
    expect(screen.getByRole('button', { name: /^Lembrar Bruno e Camila/ })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver quem vai' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Ver o encontro' })).toBeNull()
    // O resto está recolhido: nada de barra de progresso nem do "9 de 11" até abrir os detalhes.
    expect(screen.queryByText('9 de 11 responderam')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('button', { name: /^Ver detalhes/ })).toBeCollapsed()
    await userEvent.setup().press(screen.getByRole('button', { name: /^Ver detalhes/ }))
    expect(await screen.findByText('9 de 11 responderam')).toBeOnTheScreen()
    expect(screen.getByRole('progressbar', { name: '9 de 11 responderam' })).toBeOnTheScreen()
    expect(screen.getByText('Louvor: 0 músicas')).toBeOnTheScreen()
  })

  test('uma ação só: não há segundo botão cheio no cartão do líder', async () => {
    await comoLider(momentoDeTeste({ lider: lider() }))
    await screen.findByText('Faltam: Bruno e Camila')
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ver o resumo' })).toBeNull()
  })

  test('"Lembrar os 2": espera 10 s com Desfazer, chama a API e vira "Lembrete enviado"', async () => {
    const { servidor } = await comoLider(momentoDeTeste({ lider: lider() }), {
      [`POST ${BASE}/eventos/e1/lembrar-pendentes`]: ok({
        pendentes: 2,
        lembradas: 2,
        jaLembradas: 0,
      }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByText('Lembrar os 2'))

    expect(mostrarDesfazer).toHaveBeenCalledTimes(1)
    expect(pedidoDoDesfazer().texto).toBe('Lembrando Bruno e Camila.')
    expect(screen.getByText(/^Enviando em \d+ s$/)).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/e1/lembrar-pendentes`)).toHaveLength(0)

    await act(async () => pedidoDoDesfazer().aoConfirmar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/e1/lembrar-pendentes`)).toHaveLength(1),
    )
    expect(await screen.findByText('Lembrete enviado')).toBeOnTheScreen()
    expect(
      screen.getByText(/^Você lembrou Bruno e Camila, hoje às \d{2}:\d{2}\.$/),
    ).toBeOnTheScreen()
  })

  test('Desfazer cancela o lembrete: o botão volta e nada vai para a API', async () => {
    const { servidor } = await comoLider(momentoDeTeste({ lider: lider() }))
    await userEvent.setup().press(await screen.findByText('Lembrar os 2'))
    await act(async () => pedidoDoDesfazer().aoDesfazer?.())
    expect(await screen.findByText('Lembrar os 2')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/e1/lembrar-pendentes`)).toHaveLength(0)
  })

  test('ninguém a lembrar, mas falta uma função: "Convocar bateria" leva ao encontro', async () => {
    await comoLider(momentoDeTeste({ lider: lider({ lembraveis: 0 }) }))
    await userEvent.setup().press(await screen.findByText('Convocar bateria'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e1', aba: 'convocados' },
    })
  })

  test('tudo respondido e a banda completa: a ação é "Montar o repertório" (vazio); "Todos responderam ✓" aparece uma vez só', async () => {
    await comoLider(
      momentoDeTeste({
        lider: lider({
          pendentes: 0,
          responderam: 11,
          faltamResponder: [],
          faltamResponderTotal: 0,
          faltaFuncao: [],
          lembraveis: 0,
        }),
      }),
    )
    expect(await screen.findByText('Todos responderam ✓')).toBeOnTheScreen()
    // Uma vez só: nada de "11 de 11 responderam" nem de outro "Todos responderam" ao lado.
    expect(screen.queryByText('11 de 11 responderam')).toBeNull()
    expect(screen.queryByText('Todos responderam')).toBeNull()
    expect(screen.getAllByText(/Todos responderam/)).toHaveLength(1)
    // Respostas e banda em dia: o próximo passo é o repertório vazio (o líder não toca: "Montar").
    expect(screen.getByText('O repertório está vazio.')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Montar o repertório: Sábado Jovem' }),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Lembrar/ })).toBeNull()
    // Abrindo os detalhes o "Todos responderam" também não se repete.
    await userEvent.setup().press(screen.getByRole('button', { name: /^Ver detalhes/ }))
    expect(screen.getAllByText(/Todos responderam/)).toHaveLength(1)
  })

  test('rascunho: "Ainda não publicado", "Publicar e avisar 11 pessoas" com Desfazer, e Editar', async () => {
    const { servidor } = await comoLider(
      momentoDeTeste({ evento: eventoDoMomento({ status: 'rascunho' }), lider: lider() }),
      { [`POST ${BASE}/eventos/e1/status`]: ok({ status: 'publicado' }) },
    )
    expect(await screen.findByText('RASCUNHO · EM 5 DIAS')).toBeOnTheScreen()
    expect(screen.getByText('Ainda não publicado. Ninguém foi avisado.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen()

    await userEvent.setup().press(screen.getByText('Publicar e avisar 11 pessoas'))
    expect(pedidoDoDesfazer().texto).toBe('Publicando e avisando 11 pessoas.')
    expect(await screen.findByText('Publicado')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/e1/status`)).toHaveLength(0)

    await act(async () => pedidoDoDesfazer().aoConfirmar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/e1/status`)).toHaveLength(1),
    )
    expect(servidor.pedidos.find((p) => p.url.endsWith('/eventos/e1/status'))!.corpo).toEqual({
      status: 'publicado',
    })
  })

  test('véspera: "AMANHÃ · 16:00", a pendência manda: "Lembrar os 2", com "Ver quem vai" como link', async () => {
    await comoLider(momentoDeTeste({ ...RELOGIO.vespera, lider: lider() }))
    expect(await screen.findByText('AMANHÃ · 16:00')).toBeOnTheScreen()
    expect(screen.getByText('Faltam: Bruno e Camila')).toBeOnTheScreen()
    expect(screen.getByText('Falta: bateria')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Lembrar Bruno e Camila/ })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver quem vai' })).toBeOnTheScreen()
  })

  test('véspera, tudo certo: "Ver quem vai" é a ação e "Ver o encontro" o caminho', async () => {
    await comoLider(
      momentoDeTeste({
        ...RELOGIO.vespera,
        evento: eventoDoMomento({ musicas: 3 }),
        lider: lider({
          pendentes: 0,
          responderam: 11,
          faltamResponder: [],
          faltamResponderTotal: 0,
          faltaFuncao: [],
          lembraveis: 0,
          musicas: 3,
        }),
      }),
    )
    expect(await screen.findByText('Todos responderam ✓')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver quem vai' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
  })

  test('no dia, de 2 h antes: "Marcar quem chegou" é o botão (vence lembrar e banda) e leva ao check-in', async () => {
    await comoLider(momentoDeTeste({ ...RELOGIO.diaCheckin, lider: lider() }))
    expect(await screen.findByText('9 confirmados. 12 inscritos.')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Marcar quem chegou' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/checkin',
      params: { eventoId: 'e1' },
    })
    expect(screen.getByRole('button', { name: 'Abrir ao vivo' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Lembrar/ })).toBeNull()
  })

  test('no dia, antes das 2 h: o check-in ainda não é o botão (a pendência vem primeiro)', async () => {
    await comoLider(momentoDeTeste({ ...RELOGIO.dia, lider: lider() }))
    expect(await screen.findByRole('button', { name: /^Lembrar Bruno e Camila/ })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Marcar quem chegou' })).toBeNull()
  })

  test('acontecendo: "Agora: Louvor, até 16:20. Depois: ..." e "Conduzir ao vivo"', async () => {
    await comoLider(momentoDeTeste({ ...RELOGIO.agora, lider: lider() }), {
      [`GET ${BASE}/eventos/e1/ao-vivo`]: ok({
        agora: INICIO,
        etapas: [
          {
            id: 'et1',
            titulo: 'Louvor',
            duracaoMin: 15,
            inicioPrevisto: INICIO,
            fimPrevisto: new Date(Date.parse(INICIO) + 20 * 60_000).toISOString(),
            inicioReal: INICIO,
            situacao: 'atual',
          },
          {
            id: 'et2',
            titulo: 'Oração intercessora',
            duracaoMin: 10,
            inicioPrevisto: INICIO,
            fimPrevisto: INICIO,
            inicioReal: null,
            situacao: 'proxima',
          },
        ],
      }),
    })
    expect(await screen.findByText('ACONTECENDO AGORA')).toBeOnTheScreen()
    expect(
      await screen.findByText('Agora: Louvor, até 16:20. Depois: Oração intercessora.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Conduzir ao vivo' })).toBeOnTheScreen()
    // Durante o encontro o check-in é um botão ao lado, nunca atrás de "Mais".
    expect(screen.getByRole('button', { name: 'Marcar quem chegou' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Mais/ })).toBeNull()
  })

  test('terminou: "Sábado Jovem terminou. 12 presentes." e "Marcar o próximo encontro"', async () => {
    await comoLider(
      momentoDeTeste({
        evento: null,
        estado: null,
        minutosParaInicio: null,
        proximoAMarcar: true,
        recemTerminado: {
          id: 'e0',
          titulo: 'Sábado Jovem',
          inicio: '2026-11-21T19:00:00.000Z',
          fim: '2026-11-21T20:00:00.000Z',
          fuso: 'America/Sao_Paulo',
          presentes: 12,
          euServi: true,
        },
      }),
    )
    expect(await screen.findByText('TERMINOU')).toBeOnTheScreen()
    expect(screen.getByText('Sábado Jovem terminou. 12 presentes.')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Marcar o próximo encontro' }))
    // A conferência "Igual ao último encontro" (ela mesma oferece o modelo padrão quando não há anterior).
    expect(router.push).toHaveBeenCalledWith('/evento/igual-ao-ultimo')
    expect(screen.getByRole('button', { name: 'Ver o resumo' })).toBeOnTheScreen()
  })

  test('nada marcado: "NADA MARCADO" e "Marcar o próximo encontro"', async () => {
    await comoLider(momentoDeTeste({ evento: null, estado: null, minutosParaInicio: null }))
    expect(await screen.findByText('NADA MARCADO')).toBeOnTheScreen()
    expect(screen.getByText('Nenhum encontro marcado.')).toBeOnTheScreen()
    expect(
      screen.getByText('Marque o próximo para a comunidade ver e responder.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Marcar o próximo encontro' })).toBeOnTheScreen()
  })

  test('sem seletor "Minha visão | Da comunidade": o mesmo Início, com os dois grupos no resumo', async () => {
    await comoLider(momentoDeTeste({ lider: lider() }))
    await screen.findByText('Faltam: Bruno e Camila')
    expect(screen.queryByText('Minha visão')).toBeNull()
    expect(screen.queryByText('Da comunidade')).toBeNull()
  })

  test('"Primeiros passos" é do líder e só depois do primeiro encontro', async () => {
    await comoLider(momentoDeTeste({ lider: lider() }))
    expect(await screen.findByText('Primeiros passos')).toBeOnTheScreen()
  })

  test('membro nunca vê "Primeiros passos" nem os botões do líder', async () => {
    await comoMembro(momentoDeTeste({ suaParte: [parteDoMomento({ estado: 'confirmada' })] }))
    await screen.findByText('Sua parte: Louvor · Vocal')
    expect(screen.queryByText('Primeiros passos')).toBeNull()
    expect(screen.queryByText(/^Lembrar/)).toBeNull()
  })
})

describe('estados do Início: carregando, vazio, erro e sem internet', () => {
  test('carregando: o versículo já está lá e o esqueleto tem rótulo para o leitor de tela', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: { ...VISAO, [`GET ${BASE}/inicio`]: () => new Promise(() => undefined) },
    })
    expect(await screen.findByLabelText('Carregando Jovens Centro')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Versículo do dia, / })).toBeOnTheScreen()
  })

  test('vazio, membro: diz que o aviso chega e oferece "Ligar os avisos" (que estão desligados)', async () => {
    await comoMembro(momentoDeTeste({ evento: null, estado: null, minutosParaInicio: null }))
    expect(await screen.findByText('Ainda não há encontro marcado.')).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Quando a liderança marcar o próximo, ele aparece aqui e você recebe um aviso.',
      ),
    ).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Ligar os avisos' }))
    expect(router.push).toHaveBeenCalledWith('/notificacoes')
    expect(screen.queryByRole('button', { name: 'Marcar o próximo sábado' })).toBeNull()
  })

  test('erro: texto humano no lugar do cartão, "Tentar de novo" e o resto do Início segue', async () => {
    let chamadas = 0
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: {
        ...VISAO,
        [`GET ${BASE}/inicio`]: () => {
          chamadas += 1
          return chamadas === 1
            ? { status: 500, corpo: { erro: 'interno', mensagem: 'Algo deu errado.' } }
            : { status: 200, corpo: inicioComMomento(momentoDeTeste()) }
        },
      },
    })
    expect(await screen.findByText('Não deu para carregar o próximo encontro.')).toBeOnTheScreen()
    expect(screen.getByText('Confira a internet e tente de novo.')).toBeOnTheScreen()
    // O versículo e o resumo não dependem do cartão.
    expect(screen.getByRole('button', { name: /^Versículo do dia, / })).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('EM 5 DIAS')).toBeOnTheScreen()
  })

  test('erro, líder: "Não deu para carregar o encontro."', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...VISAO,
        [`GET ${BASE}/inicio`]: () => ({ status: 500, corpo: { erro: 'interno', mensagem: 'x' } }),
      },
    })
    expect(await screen.findByText('Não deu para carregar o encontro.')).toBeOnTheScreen()
  })

  test('sem internet com a cópia: faixa, "Última versão" e os botões que precisam de rede desabilitados com o motivo', async () => {
    const NetInfo = jest.requireMock('@react-native-community/netinfo') as {
      useNetInfo: jest.Mock
    }
    NetInfo.useNetInfo.mockReturnValue({ isConnected: false, isInternetReachable: false })
    try {
      await comoMembro(momentoDeTeste({ suaParte: [parteDoMomento()] }))
      expect(
        await screen.findByText(/^Sem internet\. Você vê a última versão, salva às \d{2}:\d{2}\.$/),
      ).toBeOnTheScreen()
      expect(screen.getByText(/^Última versão: hoje, \d{2}:\d{2}$/)).toBeOnTheScreen()
      expect(screen.getByText('Precisa de internet para responder.')).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: /^Aceitar a convocação/ })).toBeDisabled()
      // O que só leva a uma tela continua.
      expect(screen.getByRole('button', { name: 'Como chegar a Sábado Jovem' })).toBeEnabled()
    } finally {
      NetInfo.useNetInfo.mockReset()
      NetInfo.useNetInfo.mockReturnValue({ isConnected: true, isInternetReachable: true })
    }
  })

  test('sem internet, líder: "Lembrar" desabilitado com o motivo de avisar pessoas', async () => {
    const NetInfo = jest.requireMock('@react-native-community/netinfo') as {
      useNetInfo: jest.Mock
    }
    NetInfo.useNetInfo.mockReturnValue({ isConnected: false, isInternetReachable: false })
    try {
      await comoLider(momentoDeTeste({ lider: liderDoMomento() }))
      expect(
        await screen.findByText('Precisa de internet para avisar as pessoas.'),
      ).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: /^Lembrar/ })).toBeDisabled()
    } finally {
      NetInfo.useNetInfo.mockReset()
      NetInfo.useNetInfo.mockReturnValue({ isConnected: true, isInternetReachable: true })
    }
  })
})

describe('os momentos de encanto do sol: uma vez por conta, um por sessão', () => {
  const comPendente = () => momentoDeTeste({ suaParte: [parteDoMomento()] })

  test('o primeiro Aceitar da conta: "Que bom ter você no Louvor." (e o halo atrás do cartão)', async () => {
    await comoMembro(comPendente())
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: /^Aceitar a convocação/ }))
    expect(await screen.findByText('Que bom ter você no Louvor.')).toBeOnTheScreen()
    expect(screen.getByTestId('faixa-do-encanto')).toBeOnTheScreen()
    expect(screen.getByTestId('halo-do-encanto', { includeHiddenElements: true })).toBeOnTheScreen()
  })

  test('o segundo Aceitar da mesma conta não repete, nem em outra sessão', async () => {
    // A conta já viu o encanto 1 (guardado no aparelho).
    cofre.set('uj.encantos.conta-eu', JSON.stringify({ aceitar: true }))
    await comoMembro(comPendente())
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: /^Aceitar a convocação/ }))
    await screen.findByText('Confirmado')
    expect(screen.queryByText('Que bom ter você no Louvor.')).toBeNull()
    expect(screen.queryByTestId('halo-do-encanto', { includeHiddenElements: true })).toBeNull()
  })

  test('"Tudo em dia" pela primeira vez: a faixa "Tudo em dia." e o sol sobe; depois, nunca mais', async () => {
    const semPendencia = {
      [`GET ${BASE}/visao-geral?escopo=minha`]: ok({
        escopo: 'minha',
        convocacoesParaResponder: 0,
        convocacoesProximas: 0,
        tarefasAbertas: 0,
        inscricoes: 0,
        presenca30dias: { presentes: 0, encontros: 0 },
        oracoesAtivas: 0,
      }),
    }
    await comoMembro(momentoDeTeste(), semPendencia)
    expect(await screen.findByText('Tudo em dia.')).toBeOnTheScreen()
    expect(JSON.parse(cofre.get('uj.encantos.conta-eu')!)).toEqual({ tudoEmDia: true })
  })

  test('um encanto por sessão: o segundo fica para a próxima abertura (e não é gravado)', async () => {
    const semPendencia = {
      [`GET ${BASE}/visao-geral?escopo=minha`]: ok({
        escopo: 'minha',
        convocacoesParaResponder: 0,
        convocacoesProximas: 0,
        tarefasAbertas: 0,
        inscricoes: 0,
        presenca30dias: { presentes: 0, encontros: 0 },
        oracoesAtivas: 0,
      }),
    }
    await comoMembro(momentoDeTeste({ suaParte: [parteDoMomento()] }), semPendencia)
    await screen.findByText('Tudo em dia.')
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: /^Aceitar a convocação/ }))
    await screen.findByText('Confirmado')
    expect(screen.queryByText('Que bom ter você no Louvor.')).toBeNull()
    expect(JSON.parse(cofre.get('uj.encantos.conta-eu')!)).toEqual({ tudoEmDia: true })
  })

  test('banda completa: o líder vê o selo e o encanto "Banda completa: 2 de 2."', async () => {
    const detalhe = {
      id: 'e1',
      titulo: 'Sábado Jovem',
      etapas: [{ id: 'et1', titulo: 'Louvor', ordem: 1, duracaoMin: 15 }],
      atribuicoes: [
        {
          id: 'x1',
          etapaId: 'et1',
          vinculoId: 'v1',
          funcao: 'Vocal',
          estado: 'confirmada',
          nome: 'Carla',
        },
        {
          id: 'x2',
          etapaId: 'et1',
          vinculoId: 'v2',
          funcao: 'Violão',
          estado: 'confirmada',
          nome: 'Bruno',
        },
      ],
    }
    await comoLider(
      momentoDeTeste({
        lider: liderDoMomento({
          pendentes: 0,
          responderam: 11,
          faltamResponder: [],
          faltamResponderTotal: 0,
          faltaFuncao: [],
          lembraveis: 0,
        }),
      }),
      { [`GET ${BASE}/eventos/e1`]: ok(detalhe) },
    )
    expect(await screen.findAllByText('Banda completa: 2 de 2.')).not.toHaveLength(0)
    await waitFor(() =>
      expect(JSON.parse(cofre.get('uj.encantos.conta-eu') ?? '{}')).toEqual({ banda: true }),
    )
  })
})

describe('Início sem comunidade', () => {
  function eu(criador: boolean, comunidades: unknown[] = []) {
    const base = respostaEu('membro')
    return () => ({
      status: 200,
      corpo: { ...base, conta: { ...base.conta, criador }, comunidades },
    })
  }

  test('Criador: o destaque "Para começar" cria a primeira comunidade (a Plataforma fica no Perfil)', async () => {
    await renderizarTela(<TelaInicio />, { rotas: { 'GET /api/v1/eu': eu(true) } })

    expect(await screen.findByText('Crie sua primeira comunidade')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Criar comunidade' }))
    expect(router.push).toHaveBeenCalledWith('/plataforma/nova')
    expect(screen.getByRole('button', { name: /^Versículo do dia, / })).toBeOnTheScreen()
  })

  test('conta sem comunidade: "Comece por aqui" (os caminhos são da Entrada)', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: {
        'GET /api/v1/eu': eu(false),
        'GET /api/v1/eu/pedidos': () => ({ status: 200, corpo: { pedidos: [] } }),
      },
    })
    expect(await screen.findByText('Comece por aqui')).toBeOnTheScreen()
  })

  describe('várias comunidades (D57: nunca abre com as abas vazias)', () => {
    const outra = '33333333-3333-4333-8333-333333333333'
    const comunidades = [
      {
        id: COMUNIDADE,
        nome: 'Jovens Centro',
        cor: '#5B4BDB',
        estado: 'ativa',
        papel: 'membro',
        designacoes: [],
      },
      {
        id: outra,
        nome: 'Jovens Vila Nova',
        cor: '#15803D',
        estado: 'ativa',
        papel: 'admin',
        designacoes: [],
      },
    ]
    afterEach(() => cofre.delete('uj.comunidadeAtiva.conta-eu'))

    test('nenhuma escolhida: entra direto na primeira, sem a lista de escolha', async () => {
      await renderizarTela(<TelaInicio />, {
        rotas: {
          'GET /api/v1/eu': eu(false, comunidades),
          [`GET ${BASE}/inicio`]: ok(inicioComMomento(momentoDeTeste())),
        },
      })
      expect(
        await screen.findByRole('button', { name: /^Comunidade Jovens Centro, Membro/ }),
      ).toBeOnTheScreen()
      expect(screen.queryByText('Suas comunidades')).toBeNull()
    })

    test('com a última usada guardada, abre nela', async () => {
      cofre.set('uj.comunidadeAtiva.conta-eu', outra)
      await renderizarTela(<TelaInicio />, {
        rotas: {
          'GET /api/v1/eu': eu(false, comunidades),
          [`GET /api/v1/c/${outra}/inicio`]: ok(inicioComMomento(momentoDeTeste())),
        },
      })
      expect(
        await screen.findByRole('button', { name: /^Comunidade Jovens Vila Nova, Administrador/ }),
      ).toBeOnTheScreen()
    })
  })
})
