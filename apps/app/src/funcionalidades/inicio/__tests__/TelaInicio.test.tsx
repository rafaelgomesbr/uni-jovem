import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { DIA_DO_INICIO, INICIO } from '@/testes/fixturas'
import { BASE, COMUNIDADE, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { formatarDataPorExtenso } from '@/utilidades/datas'

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
// O diálogo de confirmação: o teste lê o que ele pergunta e responde.
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

// Um sábado à frente, 19:00 UTC = 16:00 em São Paulo.
const SABADO = INICIO

const INICIO_CHEIO = {
  proximosEventos: [
    {
      id: 'e1',
      titulo: 'Sábado com a juventude',
      categoria: 'Programação de sábado',
      inicio: SABADO,
      duracaoMin: 60,
      status: 'publicado',
      localNome: 'Salão',
      localTipo: 'interno',
    },
  ],
  minhasEscalas: [
    {
      id: 'a1',
      funcao: 'responsável',
      estado: 'pendente',
      eventoId: 'e1',
      eventoTitulo: 'Sábado com a juventude',
      eventoInicio: SABADO,
      etapaTitulo: 'Louvor',
    },
  ],
  minhasTarefas: [
    { id: 't1', titulo: 'Comprar o brinde', prazo: null, eventoId: 'e1', eventoTitulo: 'Sábado' },
  ],
  substituicoesAbertas: 2,
}

const INICIO_VAZIO = {
  proximosEventos: [],
  minhasEscalas: [],
  minhasTarefas: [],
  substituicoesAbertas: 0,
}

// O "Seu resumo" tem a própria rota; estes testes são do resto do Início.
const VISAO_PADRAO = {
  [`GET ${BASE}/visao-geral?escopo=minha`]: () => ({
    status: 200,
    corpo: {
      escopo: 'minha',
      convocacoesParaResponder: 1,
      convocacoesProximas: 0,
      tarefasAbertas: 1,
      inscricoes: 0,
      presenca30dias: { presentes: 0, encontros: 0 },
      oracoesAtivas: 0,
    },
  }),
}

/** A convocação pendente é de OUTRO encontro (e2), não do que está no cartão de cima. */
const INICIO_COM_PENDENTE_DE_OUTRO = {
  ...INICIO_CHEIO,
  minhasEscalas: [
    {
      id: 'a2',
      funcao: 'recepção',
      estado: 'pendente',
      eventoId: 'e2',
      eventoTitulo: 'Luau',
      eventoInicio: SABADO,
      etapaTitulo: null,
    },
  ],
}

const ok = (corpo: unknown) => () => ({ status: 200, corpo })

describe('tela Início', () => {
  beforeEach(() => jest.clearAllMocks())

  test('o próximo encontro mostra proximidade, data completa, horário, local e a linha "Você:"', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: { ...VISAO_PADRAO, [`GET ${BASE}/inicio`]: ok(INICIO_CHEIO) },
    })

    const cartao = await screen.findByRole('button', {
      name: new RegExp(
        `^Em \\d+ dias\\. Sábado com a juventude, Publicado, ${formatarDataPorExtenso(DIA_DO_INICIO)}, às 16:00, duração de 1 h, local: Salão\\. Você: Louvor · responsável\\. Aguardando sua resposta`,
      ),
    })
    expect(cartao).toBeOnTheScreen()
    expect(screen.getByText(/^Em \d+ dias$/)).toBeOnTheScreen()
    expect(screen.getByText(/^Sábado, \d+ de [a-z]{3}\. · 16:00 às 17:00$/)).toBeOnTheScreen()
    expect(screen.getByText('Salão')).toBeOnTheScreen()
    expect(screen.getByText('Você: Louvor · responsável')).toBeOnTheScreen()
    // Sem a lista de etapas e sem o cartão "Meu repertório": o roteiro está a um toque.
    expect(screen.queryByText('Meu repertório')).toBeNull()
    // A tarefa não é mais uma caixa de marcar no Início: é uma linha do resumo.
    expect(screen.queryByRole('checkbox', { name: 'Comprar o brinde' })).toBeNull()
    expect(screen.queryByText('Alguém precisa de substituição')).toBeNull()
  })

  test('a ordem: saudação, versículo, próximo encontro, resumo', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: { ...VISAO_PADRAO, [`GET ${BASE}/inicio`]: ok(INICIO_CHEIO) },
    })
    await screen.findByText('Seu resumo')
    const arvore = JSON.stringify(screen.toJSON())
    const posicao = (trecho: string) => arvore.indexOf(trecho)
    expect(posicao('Versículo do dia, ')).toBeGreaterThan(-1)
    expect(posicao('Versículo do dia, ')).toBeLessThan(posicao('Sábado com a juventude'))
    expect(posicao('Sábado com a juventude')).toBeLessThan(posicao('Seu resumo'))
  })

  test('convocação pendente do mesmo encontro: Aceitar e Não posso ir moram dentro do cartão dele', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: { ...VISAO_PADRAO, [`GET ${BASE}/inicio`]: ok(INICIO_CHEIO) },
    })
    expect(
      await screen.findByRole('button', {
        name: 'Aceitar a convocação em Sábado com a juventude, Louvor · responsável',
      }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: /^Não posso ir: avisar a organização/ }),
    ).toBeOnTheScreen()
    // Nenhum cartão "Você foi convocado" separado.
    expect(screen.queryByText('Você foi convocado')).toBeNull()
  })

  test('convocação pendente de outro encontro: ganha o cartão "Você foi convocado", depois do encontro', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: { ...VISAO_PADRAO, [`GET ${BASE}/inicio`]: ok(INICIO_COM_PENDENTE_DE_OUTRO) },
    })
    expect(await screen.findByText('Você foi convocado')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Aceitar a convocação em Luau, recepção' }),
    ).toBeOnTheScreen()
    // O cartão do encontro de cima não tem botões de convocação (não é dele): só "Ver o encontro".
    expect(screen.getByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
    const arvore = JSON.stringify(screen.toJSON())
    expect(arvore.indexOf('Sábado com a juventude')).toBeLessThan(
      arvore.indexOf('Você foi convocado'),
    )
  })

  test('depois de aceitar, a convocação vira a linha "Você:" e não sobra cartão', async () => {
    const aceita = {
      ...INICIO_CHEIO,
      minhasEscalas: [{ ...INICIO_CHEIO.minhasEscalas[0]!, estado: 'confirmada', funcao: 'Vocal' }],
    }
    await renderizarTela(<TelaInicio />, {
      rotas: { ...VISAO_PADRAO, [`GET ${BASE}/inicio`]: ok(aceita) },
    })
    expect(await screen.findByText('Você: Louvor · Vocal')).toBeOnTheScreen()
    expect(screen.getByText('Confirmado')).toBeOnTheScreen()
    expect(screen.queryByText('Você foi convocado')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Aceitar/ })).toBeNull()
    // Quem toca no louvor ganha "Abrir o repertório" no próprio cartão, e nenhum cartão à parte.
    expect(
      screen.getByRole('button', { name: 'Abrir o meu repertório de Sábado com a juventude' }),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Meu repertório')).toBeNull()
  })

  test('"Você foi convocado": aceitar chama a API da própria atribuição e avisa', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: {
        ...VISAO_PADRAO,
        [`GET ${BASE}/inicio`]: ok(INICIO_CHEIO),
        [`POST ${BASE}/atribuicoes/a1/confirmar`]: ok({ estado: 'confirmada' }),
      },
    })

    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: 'Aceitar a convocação em Sábado com a juventude, Louvor · responsável',
      }),
    )

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(1),
    )
    expect(mostrarToast).toHaveBeenCalledWith({
      texto: 'Você aceitou. A organização já vê sua resposta.',
    })
  })

  test('"Não posso ir" pergunta antes, recusa a própria convocação e avisa', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: {
        ...VISAO_PADRAO,
        [`GET ${BASE}/inicio`]: ok(INICIO_CHEIO),
        [`POST ${BASE}/atribuicoes/a1/recusar`]: ok({ estado: 'recusada' }),
      },
    })

    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: 'Não posso ir: avisar a organização sobre Sábado com a juventude, Louvor · responsável',
      }),
    )

    expect(jest.mocked(confirmar).mock.calls[0]![0]).toEqual({
      titulo: 'Avisar que você não pode ir?',
      mensagem: 'A organização recebe o aviso para chamar outra pessoa.',
      confirmar: 'Avisar que não posso',
      cancelar: 'Voltar',
      destrutivo: true,
    })
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(1),
    )
    expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Pronto. A organização foi avisada.' })
  })

  test('"Voltar" no diálogo não recusa nada', async () => {
    jest.mocked(confirmar).mockResolvedValueOnce(false)
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: { ...VISAO_PADRAO, [`GET ${BASE}/inicio`]: ok(INICIO_CHEIO) },
    })

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: /^Não posso ir: avisar a organização/ }))

    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(0)
  })

  test('vazio, para organizador: oferece o encontro do sábado, sem a segunda ação', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: { ...VISAO_PADRAO, [`GET ${BASE}/inicio`]: ok(INICIO_VAZIO) },
    })

    expect(await screen.findByText('Nenhum encontro marcado')).toBeOnTheScreen()
    expect(
      screen.getByText('Monte o próximo: o Sábado padrão já vem com o roteiro de sempre.'),
    ).toBeOnTheScreen()
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Criar o encontro do sábado' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/novo',
      params: { modelo: 'sabado_padrao' },
    })
    expect(screen.queryByRole('button', { name: 'Informar minha disponibilidade' })).toBeNull()
  })

  test('vazio, para membro: diz que o aviso chega, sem criar e sem dois botões', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: { ...VISAO_PADRAO, [`GET ${BASE}/inicio`]: ok(INICIO_VAZIO) },
    })

    expect(await screen.findByText('Nenhum encontro marcado')).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Ainda não há encontro marcado. Quando a liderança marcar o próximo, ele aparece aqui e você recebe um aviso.',
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Criar o encontro do sábado' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ver a agenda' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Informar minha disponibilidade' })).toBeNull()
  })

  test('erro da API vira mensagem humana com "Tentar de novo"', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: {
        ...VISAO_PADRAO,
        [`GET ${BASE}/inicio`]: () => ({
          status: 500,
          corpo: { erro: 'interno', mensagem: 'Algo deu errado do nosso lado. Tente de novo.' },
        }),
      },
    })

    expect(
      await screen.findByText('Algo deu errado do nosso lado. Tente de novo.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('com inscrição em outro encontro, mostra "Minhas inscrições" e abre o evento', async () => {
    const semConvocacao = { ...INICIO_CHEIO, minhasEscalas: [] }
    await renderizarTela(<TelaInicio />, {
      rotas: {
        ...VISAO_PADRAO,
        [`GET ${BASE}/inicio`]: ok(semConvocacao),
        [`GET ${BASE}/inscricoes/eu`]: ok({
          inscricoes: [
            {
              inscricaoId: 'i1',
              estado: 'confirmada',
              codigoCheckin: 'A1B2C3D4E5',
              criadaEm: '2026-11-10T12:00:00.000Z',
              presente: false,
              evento: {
                id: 'e9',
                titulo: 'Retiro de verão',
                inicio: SABADO,
                duracaoMin: 120,
                fuso: 'America/Sao_Paulo',
                status: 'publicado',
                localNome: 'Sítio',
              },
            },
          ],
        }),
      },
    })

    const linha = await screen.findByRole('button', {
      name: /^Retiro de verão, .*Inscrição confirmada/,
    })
    expect(screen.getByText('Inscrito')).toBeOnTheScreen()
    await userEvent.setup().press(linha)
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e9' },
    })
  })

  test('inscrita no próximo encontro: vira a linha "Você: inscrito", sem cartão à parte', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: {
        ...VISAO_PADRAO,
        [`GET ${BASE}/inicio`]: ok({ ...INICIO_CHEIO, minhasEscalas: [] }),
        [`GET ${BASE}/inscricoes/eu`]: ok({
          inscricoes: [
            {
              inscricaoId: 'i1',
              estado: 'confirmada',
              codigoCheckin: 'A1B2C3D4E5',
              criadaEm: '2026-11-10T12:00:00.000Z',
              presente: false,
              evento: {
                id: 'e1',
                titulo: 'Sábado com a juventude',
                inicio: SABADO,
                duracaoMin: 60,
                fuso: 'America/Sao_Paulo',
                status: 'publicado',
                localNome: 'Salão',
              },
            },
          ],
        }),
      },
    })
    expect(await screen.findByText('Você: inscrito')).toBeOnTheScreen()
    expect(screen.queryByText('Minhas inscrições')).toBeNull()
  })
})

describe('"Primeiros passos" no Início (D62)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('para quem organiza, depois de existir o primeiro encontro', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...VISAO_PADRAO,
        [`GET ${BASE}/inicio`]: ok({ ...INICIO_CHEIO, minhasEscalas: [] }),
      },
    })
    expect(await screen.findByText('Primeiros passos')).toBeOnTheScreen()
  })

  test('organizador sem nenhum encontro criado ainda: sem o cartão', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: { ...VISAO_PADRAO, [`GET ${BASE}/inicio`]: ok(INICIO_VAZIO) },
    })
    await screen.findByText('Nenhum encontro marcado')
    expect(screen.queryByText('Primeiros passos')).toBeNull()
  })

  test('membro nunca vê o cartão', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: {
        ...VISAO_PADRAO,
        [`GET ${BASE}/inicio`]: ok({ ...INICIO_CHEIO, minhasEscalas: [] }),
      },
    })
    await screen.findByText('Seu resumo')
    expect(screen.queryByText('Primeiros passos')).toBeNull()
  })
})

describe('Início sem comunidade', () => {
  beforeEach(() => jest.clearAllMocks())

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
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Criar comunidade' }))
    expect(router.push).toHaveBeenCalledWith('/plataforma/nova')
    // D57: a Plataforma não se repete no Início; mora só no Perfil.
    expect(screen.queryByRole('button', { name: /^Plataforma/ })).toBeNull()
    // O versículo continua (agora em uma linha); não há status de sincronização sem comunidade.
    expect(screen.getByRole('button', { name: /^Versículo do dia, / })).toBeOnTheScreen()
  })

  test('conta sem comunidade: "Comece por aqui" com os três caminhos (ADR 0007)', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: {
        'GET /api/v1/eu': eu(false),
        'GET /api/v1/eu/pedidos': () => ({ status: 200, corpo: { pedidos: [] } }),
      },
    })

    expect(await screen.findByText('Comece por aqui')).toBeOnTheScreen()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Usar código ou convite' }))
    expect(router.push).toHaveBeenCalledWith('/tenho-um-codigo')
    await usuario.press(screen.getByRole('button', { name: 'Criar comunidade' }))
    expect(router.push).toHaveBeenCalledWith('/criar-comunidade')
    // Sem pedidos, a seção "Meus pedidos" não aparece.
    expect(screen.queryByText('Meus pedidos')).toBeNull()
    expect(screen.getByRole('button', { name: /^Versículo do dia, / })).toBeOnTheScreen()
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
    const cofre = (jest.requireMock('expo-secure-store') as { __cofre: Map<string, string> })
      .__cofre
    afterEach(() => cofre.delete('uj.comunidadeAtiva.conta-eu'))

    test('nenhuma escolhida: entra direto na primeira, sem a lista de escolha', async () => {
      await renderizarTela(<TelaInicio />, {
        rotas: {
          'GET /api/v1/eu': eu(false, comunidades),
          [`GET ${BASE}/inicio`]: ok(INICIO_VAZIO),
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
          [`GET /api/v1/c/${outra}/inicio`]: ok(INICIO_VAZIO),
        },
      })
      expect(
        await screen.findByRole('button', { name: /^Comunidade Jovens Vila Nova, Administrador/ }),
      ).toBeOnTheScreen()
    })
  })
})
