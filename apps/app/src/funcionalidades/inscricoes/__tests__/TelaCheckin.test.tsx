import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

import { EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, pedidosPara, PESSOAS, renderizarTela } from '@/testes/telas'
import { SITUACOES_DO_CHIP } from '@/ui/Chip'
import { mostrarToast } from '@/ui/Toast'

import { TelaCheckin } from '../TelaCheckin'

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

// As confirmações vão em toast: o teste confere o que foi pedido (e usa o "Desfazer").
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

beforeEach(() => jest.clearAllMocks())

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`
const INSCRICAO_DANI = '66666666-6666-4666-8666-000000000001'
const INSCRICAO_BRUNO = '66666666-6666-4666-8666-000000000002'
const [ANA, BRUNO, CARLA] = PESSOAS

const LISTA = {
  inscritos: [
    {
      inscricaoId: INSCRICAO_DANI,
      vinculoId: null,
      nome: 'Daniela Prado',
      telefone: '+55 11 9****-1234',
      codigo: 'ABCDEF1234',
      estado: 'confirmada',
      presente: false,
    },
    {
      inscricaoId: INSCRICAO_BRUNO,
      vinculoId: BRUNO!.vinculoId,
      nome: 'Bruno Lima',
      telefone: null,
      codigo: '0123456789',
      estado: 'confirmada',
      presente: true,
    },
  ],
  membros: PESSOAS.map((p) => ({
    vinculoId: p.vinculoId,
    nome: p.nome,
    presente: p.nome === 'Bruno Lima',
  })),
  geradoEm: '2026-11-21T18:00:00.000Z',
}

const PRESENCAS = {
  total: 1,
  presencas: [
    {
      id: 'pres-bruno',
      origem: 'manual',
      ocorridaEm: '2026-11-21T18:55:00.000Z',
      inscricaoId: INSCRICAO_BRUNO,
      vinculoId: BRUNO!.vinculoId,
      nome: 'Bruno Lima',
    },
  ],
}

/** Ana e Carla aceitaram a convocação do louvor; Bruno também (e já chegou). */
const EVENTO = eventoDeTeste({
  atribuicoes: [ANA!, BRUNO!, CARLA!].map((p, i) => ({
    id: `atr-${i}`,
    etapaId: null,
    vinculoId: p.vinculoId,
    funcao: 'Louvor',
    estado: 'confirmada' as const,
    nome: p.nome,
  })),
})

function montar(rotas = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID })
  return renderizarTela(<TelaCheckin />, {
    rotas: {
      [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: EVENTO }),
      [`GET ${CAMINHO}/checkin`]: () => ({ status: 200, corpo: LISTA }),
      [`GET ${CAMINHO}/presencas`]: () => ({ status: 200, corpo: PRESENCAS }),
      ...rotas,
    },
  })
}

const linha = (nome: string) => screen.getByRole('checkbox', { name: new RegExp(`^${nome}\\.`) })

describe('check-in: feito para quem está em pé', () => {
  test('contador grande "1 de 4 presentes", com a barra e o QR à mão', async () => {
    await montar()
    expect(await screen.findByLabelText('1 de 4 presentes')).toBeOnTheScreen()
    expect(
      screen.getByRole('progressbar', { name: 'Progresso do check-in: 1 de 4', hidden: true }),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ler QR' })).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Ler QR' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/ler-qr',
      params: { eventoId: EVENTO_ID },
    })
  })

  test('dois grupos: convocados e inscritos primeiro; só a exceção é escrita', async () => {
    await montar()
    expect(await screen.findByText('Convocados e inscritos (4)')).toBeOnTheScreen()
    // Todos aceitaram a convocação ou se inscreveram: ninguém sobra em "Outras pessoas".
    expect(screen.queryByText(/^Outras pessoas/)).toBeNull()
    // "Membro sem inscrição" não se repete; o que aparece é a exceção.
    expect(screen.queryByText('Membro sem inscrição')).toBeNull()
    expect(screen.getAllByText('Convocado').length).toBeGreaterThan(0)
    expect(screen.getByText('Inscrito · +55 11 9****-1234')).toBeOnTheScreen()
    // Quem já chegou mostra "Presente" em texto e ícone, nunca só cor.
    expect(screen.getByText('Presente')).toBeOnTheScreen()
    expect(screen.getAllByText('Chegou')).toHaveLength(3)
  })

  test('"Chegou" parece botão (contorno e 48 de altura) e "Presente" é outra coisa, com ícone e texto (D75)', async () => {
    await montar()
    await screen.findByText('Convocados e inscritos (4)')
    const chegou = screen.getAllByText('Chegou')[0]!.parent!
    const estilo = StyleSheet.flatten(chegou.props.style as StyleProp<ViewStyle>) as {
      minHeight: number
      borderWidth: number
      borderColor: string
    }
    expect(estilo.minHeight).toBeGreaterThanOrEqual(48)
    // O contorno é o que faz uma etiqueta virar botão (o teste do dono: "Chegou parece etiqueta").
    expect(estilo.borderWidth).toBeGreaterThanOrEqual(2)
    expect(estilo.borderColor).not.toBe('transparent')
    // Quem já chegou: palavra "Presente" (o chip também traz o ícone de check, ver `Chip`).
    expect(screen.getByText('Presente')).toBeOnTheScreen()
    expect(SITUACOES_DO_CHIP.aceitou.icone).toBe('check')
    // A tela se chama "Marcar quem chegou", a mesma palavra do botão que leva até ela.
    expect(screen.getAllByText('Marcar quem chegou').length).toBeGreaterThan(0)
  })

  test('membros sem convocação nem inscrição ficam em "Outras pessoas"', async () => {
    await montar({
      [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste({ atribuicoes: [] }) }),
    })
    expect(await screen.findByText('Convocados e inscritos (2)')).toBeOnTheScreen()
    expect(screen.getByText('Outras pessoas (2)')).toBeOnTheScreen()
  })

  test('a linha inteira é o alvo: um toque marca e a linha já mostra "Presente"', async () => {
    let responder!: () => void
    const { servidor } = await montar({
      [`POST ${CAMINHO}/presencas`]: () =>
        new Promise((resolver) => {
          responder = () =>
            resolver({ status: 200, corpo: { id: 'pres-dani', jaRegistrada: false } })
        }),
      [`DELETE ${CAMINHO}/presencas/pres-dani`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('checkbox', { name: /^Daniela Prado\./ }))

    // Otimista: o contador e a linha mudam antes de o servidor responder.
    expect(await screen.findByLabelText('2 de 4 presentes')).toBeOnTheScreen()
    expect(
      screen.getByRole('checkbox', { name: /^Daniela Prado\..*Presente/, checked: true }),
    ).toBeOnTheScreen()
    await act(async () => responder())

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)[0]?.corpo).toMatchObject({
        origem: 'manual',
        inscricaoId: INSCRICAO_DANI,
        chaveIdempotencia: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith(
        expect.objectContaining({ texto: 'Presença de Daniela Prado registrada.' }),
      ),
    )
    // O Desfazer do toast apaga a presença que acabou de ser criada.
    const pedido = jest.mocked(mostrarToast).mock.calls[0]?.[0]
    await act(async () => pedido?.acao?.aoPressionar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/presencas/pres-dani`)).toHaveLength(1),
    )
  })

  test('tocar de novo num presente desmarca, sem diálogo, e o toast oferece Desfazer', async () => {
    const { servidor } = await montar({
      [`DELETE ${CAMINHO}/presencas/pres-bruno`]: () => ({ status: 200, corpo: { ok: true } }),
      [`POST ${CAMINHO}/presencas`]: () => ({
        status: 200,
        corpo: { id: 'pres-bruno-2', jaRegistrada: false },
      }),
    })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('checkbox', { name: /^Bruno Lima\..*Presente/ }))

    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/presencas/pres-bruno`)).toHaveLength(1),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith(
        expect.objectContaining({ texto: 'Presença de Bruno Lima desfeita.' }),
      ),
    )
    // Desfazer o desmarcar marca de novo.
    const pedido = jest.mocked(mostrarToast).mock.calls[0]?.[0]
    await act(async () => pedido?.acao?.aoPressionar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)[0]?.corpo).toMatchObject({
        inscricaoId: INSCRICAO_BRUNO,
      }),
    )
  })

  test('erro ao marcar: a linha volta ao que era, com o motivo e "Tentar de novo"', async () => {
    await montar({
      [`POST ${CAMINHO}/presencas`]: () => ({
        status: 500,
        corpo: { erro: 'x', mensagem: 'Falhou.' },
      }),
    })
    await userEvent.setup().press(await screen.findByRole('checkbox', { name: /^Daniela Prado\./ }))

    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith(
        expect.objectContaining({
          texto: 'Não deu para marcar Daniela Prado. Toque para tentar de novo.',
          tipo: 'erro',
          acao: expect.objectContaining({ titulo: 'Tentar de novo' }),
        }),
      ),
    )
    expect(await screen.findByLabelText('1 de 4 presentes')).toBeOnTheScreen()
    expect(
      screen.getByRole('checkbox', { name: /^Daniela Prado\..*Ainda não chegou/, checked: false }),
    ).toBeOnTheScreen()
  })

  test('membro sem inscrição é marcado pelo vínculo e aparece uma vez só', async () => {
    const { servidor } = await montar({
      [`POST ${CAMINHO}/presencas`]: () => ({
        status: 200,
        corpo: { id: 'p', jaRegistrada: false },
      }),
    })
    // Bruno é membro e inscrito: não aparece duplicado.
    expect(await screen.findAllByText('Bruno Lima')).toHaveLength(1)
    await userEvent.setup().press(linha('Carla Dias'))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)[0]?.corpo).toMatchObject({
        vinculoId: CARLA!.vinculoId,
      }),
    )
  })

  test('busca pelo nome, sem acento nem caixa, e o teclado só abre ao tocar no campo', async () => {
    await montar()
    await fireEvent.changeText(await screen.findByLabelText('Buscar pelo nome'), 'DANI')
    expect(screen.getByText('Daniela Prado')).toBeOnTheScreen()
    expect(screen.queryByText('Carla Dias')).toBeNull()

    await fireEvent.changeText(screen.getByLabelText('Buscar pelo nome'), 'zzz')
    expect(screen.getByText('Ninguém com esse nome.')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Mostrar todos' }))
    expect(await screen.findByText('Carla Dias')).toBeOnTheScreen()
  })
})

describe('Marcar todos que aceitaram', () => {
  test('um toque marca quem aceitou e ainda não chegou, com Desfazer para o grupo todo', async () => {
    const criadas = ['pres-ana', 'pres-carla']
    let n = 0
    const { servidor } = await montar({
      [`POST ${CAMINHO}/presencas`]: () => ({
        status: 200,
        corpo: { id: criadas[n++], jaRegistrada: false },
      }),
      [`DELETE ${CAMINHO}/presencas/pres-ana`]: () => ({ status: 200, corpo: { ok: true } }),
      [`DELETE ${CAMINHO}/presencas/pres-carla`]: () => ({ status: 200, corpo: { ok: true } }),
    })

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Marcar todos que aceitaram' }))

    // Só Ana e Carla: Bruno já estava presente.
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`).map((p) => p.corpo)).toEqual([
        expect.objectContaining({ vinculoId: ANA!.vinculoId }),
        expect.objectContaining({ vinculoId: CARLA!.vinculoId }),
      ]),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith(
        expect.objectContaining({ texto: '2 presenças marcadas.' }),
      ),
    )
    const pedido = jest
      .mocked(mostrarToast)
      .mock.calls.find((c) => c[0].texto === '2 presenças marcadas.')?.[0]
    await act(async () => pedido?.acao?.aoPressionar())
    await waitFor(() =>
      expect(servidor.pedidos.filter((p) => p.metodo === 'DELETE')).toHaveLength(2),
    )
  })

  test('sem ninguém que falte: o botão fica desligado e diz por quê', async () => {
    await montar({
      [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste({ atribuicoes: [] }) }),
    })
    const botao = await screen.findByRole('button', { name: 'Marcar todos que aceitaram' })
    expect(botao).toBeDisabled()
    expect(screen.getByText('Ninguém aceitou a convocação ainda.')).toBeOnTheScreen()
  })
})

describe('Ações à vista (D75, sem "Mais"): código de entrada e quem chegou sem inscrição', () => {
  test('código com formato errado não vai à rede', async () => {
    const { servidor } = await montar()
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: /^Pelo código de entrada/ }))

    await fireEvent.changeText(await screen.findByLabelText('Código de entrada'), 'XYZ')
    await usuario.press(screen.getByRole('button', { name: 'Marcar presença pelo código' }))
    expect(await screen.findByText('O código tem 10 letras (A a F) e números.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)).toHaveLength(0)
  })

  test('código certo marca a presença do dono do código', async () => {
    const { servidor } = await montar({
      [`POST ${CAMINHO}/presencas`]: () => ({
        status: 200,
        corpo: { id: 'p-codigo', jaRegistrada: false },
      }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: /^Pelo código de entrada/ }))
    await fireEvent.changeText(await screen.findByLabelText('Código de entrada'), 'abcdef1234')
    await usuario.press(screen.getByRole('button', { name: 'Marcar presença pelo código' }))

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)[0]?.corpo).toMatchObject({
        codigo: 'ABCDEF1234',
      }),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith(
        expect.objectContaining({ texto: 'Presença de Daniela Prado registrada.' }),
      ),
    )
  })

  test('chegou sem inscrição: só o nome', async () => {
    const { servidor } = await montar({
      [`POST ${CAMINHO}/presencas`]: () => ({
        status: 200,
        corpo: { id: 'p-avulso', jaRegistrada: false },
      }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: /^Chegou sem inscrição/ }))

    await usuario.press(
      await screen.findByRole('button', { name: 'Registrar presença sem inscrição' }),
    )
    expect(await screen.findByText('Escreva o nome de quem chegou.')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Nome de quem chegou'), 'Visitante Souza')
    await usuario.press(screen.getByRole('button', { name: 'Registrar presença sem inscrição' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)[0]?.corpo).toMatchObject({
        nomeAvulso: 'Visitante Souza',
      }),
    )
  })

  test('"Ver as inscrições" leva à lista de inscrições do encontro', async () => {
    await montar()
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: /^Ver as inscrições/ }))
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]/inscricoes',
        params: { eventoId: EVENTO_ID },
      }),
    )
  })
})

describe('as ações do dia estão à vista, nenhuma atrás de "Mais" (D75)', () => {
  test('chegou sem inscrição, pelo código, as inscrições, o QR e "marcar todos" aparecem juntos', async () => {
    await montar()
    for (const nome of [
      'Chegou sem inscrição',
      'Pelo código de entrada',
      'Ver as inscrições',
      'Ler QR',
      'Marcar todos que aceitaram',
    ]) {
      expect(await screen.findByRole('button', { name: nome })).toBeOnTheScreen()
    }
    expect(screen.queryByRole('button', { name: /^Mais/ })).toBeNull()
  })
})

describe('os três estados do check-in', () => {
  test('carregando: contador "-- de --" e as linhas de esqueleto', async () => {
    await montar({ [`GET ${CAMINHO}/checkin`]: () => new Promise<never>(() => {}) })
    expect(await screen.findByLabelText('Carregando a lista de entrada')).toBeOnTheScreen()
    expect(screen.getByLabelText('Carregando')).toBeOnTheScreen()
  })

  test('erro: texto humano e "Tentar de novo" que recarrega', async () => {
    let tentativas = 0
    await montar({
      [`GET ${CAMINHO}/checkin`]: () =>
        ++tentativas === 1
          ? { status: 500, corpo: { erro: 'x', mensagem: 'Falhou.' } }
          : { status: 200, corpo: LISTA },
    })
    expect(await screen.findByText('Não deu para carregar quem foi convocado.')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByLabelText('1 de 4 presentes')).toBeOnTheScreen()
  })

  test('vazio: explica e oferece ler o QR', async () => {
    await montar({
      [`GET ${CAMINHO}/checkin`]: () => ({
        status: 200,
        corpo: { inscritos: [], membros: [], geradoEm: LISTA.geradoEm },
      }),
      [`GET ${CAMINHO}/presencas`]: () => ({ status: 200, corpo: { total: 0, presencas: [] } }),
    })
    expect(await screen.findByText('Ninguém convocado ou inscrito.')).toBeOnTheScreen()
    expect(screen.getByText('Procure pelo nome ou leia o QR de quem chegou.')).toBeOnTheScreen()
    // Sem pessoas, não há "Marcar todos" para oferecer.
    expect(screen.queryByRole('button', { name: 'Marcar todos que aceitaram' })).toBeNull()
  })
})
