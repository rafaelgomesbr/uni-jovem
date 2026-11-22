/**
 * D69: convocar em lote (a folha "Convocar"), as sugestões por função, "Já convocado" travado, a
 * busca pelo nome e o resumo dos Convocados com "Lembrar os N". Tudo o que avisa gente espera os
 * 10 s do Desfazer: a API só é chamada depois.
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import type { Atribuicao } from '@/servicos/contratoDosEventos'
import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, COMUNIDADE, PESSOAS, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast } from '@/ui/Toast'
import { confirmarAgora, desfazerAgora } from '@/ui/ToastComDesfazer'

import { reiniciarRespostas } from '../../escalas/respostasOtimistas'
import { reiniciarConvocadosEmEspera } from '../convocadosOtimistas'
import {
  ondeJaEsta,
  pessoasDistintas,
  quantasPessoas,
  quemJaEstaNoBloco,
  rotuloDaFuncao,
} from '../Convocacao'
import { DetalheDoEvento } from '../DetalheDoEvento'
import { contarRespostas, juntarNomes } from '../respostas'

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

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`
const [ANA, BRUNO, CARLA] = PESSOAS as [
  (typeof PESSOAS)[0],
  (typeof PESSOAS)[0],
  (typeof PESSOAS)[0],
]

function convocacao(
  n: number,
  pessoa: (typeof PESSOAS)[0],
  funcao: string,
  estado: Atribuicao['estado'],
): Atribuicao {
  return {
    id: `atr-${n}`,
    etapaId: ETAPAS[1],
    vinculoId: pessoa.vinculoId,
    funcao,
    estado,
    nome: pessoa.nome,
  }
}

const SUGESTOES = {
  funcao: 'Bateria',
  data: '2026-11-28',
  sugeridas: [
    {
      vinculoId: CARLA.vinculoId,
      nome: CARLA.nome,
      vezes: 3,
      ultimaVez: '2026-11-14',
      disponivelNoDia: null,
    },
    { vinculoId: ANA.vinculoId, nome: ANA.nome, vezes: 0, ultimaVez: null, disponivelNoDia: true },
  ],
  indisponiveis: [{ vinculoId: BRUNO.vinculoId, nome: BRUNO.nome }],
  jaConvocadas: [],
}

function montar(
  atribuicoes: Atribuicao[],
  rotas: object = {},
  papel: 'organizador' | 'membro' = 'organizador',
) {
  return renderizarTela(
    <>
      <DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} abaInicial="convocados" />
      <HospedeiroDeToast />
    </>,
    {
      papel,
      rotas: {
        [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste({ atribuicoes }) }),
        [`GET ${CAMINHO}/repertorio`]: () => ({ status: 200, corpo: { itens: [] } }),
        [`GET ${BASE}/meu-repertorio`]: () => ({ status: 200, corpo: { encontros: [] } }),
        [`GET ${CAMINHO}/sugestoes-de-convocacao`]: () => ({ status: 200, corpo: SUGESTOES }),
        ...rotas,
      },
    },
  )
}

describe('as contas dos Convocados (puras)', () => {
  test('"9 de 11 responderam": quem tem duas partes conta uma vez; quem recusou já respondeu', () => {
    const r = contarRespostas([
      { vinculoId: 'a', estado: 'confirmada', nome: 'Ana' },
      { vinculoId: 'a', estado: 'pendente', nome: 'Ana' },
      { vinculoId: 'b', estado: 'recusada', nome: 'Bruno' },
      { vinculoId: 'c', estado: 'confirmada', nome: 'Carla' },
    ])
    expect(r).toMatchObject({
      convocados: 3,
      pendentes: 1,
      responderam: 2,
      nomesPendentes: ['Ana'],
    })
    expect(
      pessoasDistintas([
        { vinculoId: 'a', estado: 'confirmada' },
        { vinculoId: 'a', estado: 'pendente' },
        { vinculoId: 'b', estado: 'recusada' },
      ]),
    ).toBe(1)
  })

  test('nomes e plural', () => {
    expect(juntarNomes(['Bruno'])).toBe('Bruno')
    expect(juntarNomes(['Bruno', 'Camila'])).toBe('Bruno e Camila')
    expect(juntarNomes(['Bruno', 'Camila', 'Davi'])).toBe('Bruno, Camila e Davi')
    expect(quantasPessoas(1)).toBe('1 pessoa')
    expect(quantasPessoas(2)).toBe('2 pessoas')
  })

  test('onde a pessoa já está: o bloco e a função, em palavras (D73)', () => {
    const etapas = [{ id: ETAPAS[1], titulo: 'Louvor' }]
    expect(rotuloDaFuncao('integrante')).toBe('quem ajuda')
    expect(rotuloDaFuncao('responsável')).toBe('quem conduz')
    expect(rotuloDaFuncao('Violão')).toBe('violão')
    expect(ondeJaEsta({ etapaId: null, funcao: 'integrante' }, etapas)).toBe(
      'Encontro inteiro (quem ajuda)',
    )
    expect(ondeJaEsta({ etapaId: ETAPAS[1], funcao: 'Violão' }, etapas)).toBe('Louvor (violão)')
  })

  test('quem já está no bloco: a banda com as funções, os outros blocos só com nomes; recusa não conta', () => {
    const etapas = [
      { id: ETAPAS[0], titulo: 'Boas-vindas' },
      { id: ETAPAS[1], titulo: 'Louvor' },
    ]
    const a = (
      etapaId: string | null,
      p: (typeof PESSOAS)[0],
      funcao: string,
      estado: Atribuicao['estado'] = 'confirmada',
    ) => ({ etapaId, vinculoId: p.vinculoId, nome: p.nome, funcao, estado })
    const todas = [
      a(ETAPAS[1], ANA, 'Violão'),
      a(ETAPAS[1], ANA, 'Vocal'),
      a(ETAPAS[1], BRUNO, 'Bateria', 'pendente'),
      a(ETAPAS[1], CARLA, 'Teclado', 'recusada'),
      a(null, CARLA, 'integrante'),
    ]
    expect(quemJaEstaNoBloco(todas, ETAPAS[1], etapas)).toBe(
      'Na banda: Ana (violão, vocal), Bruno (bateria).',
    )
    expect(quemJaEstaNoBloco(todas, null, etapas)).toBe('No encontro inteiro: Carla.')
    expect(quemJaEstaNoBloco(todas, ETAPAS[0], etapas)).toBe('Ninguém em Boas-vindas ainda.')
    expect(quemJaEstaNoBloco([], ETAPAS[1], etapas)).toBe('Ninguém na banda ainda.')
  })
})

describe('resumo dos Convocados e "Lembrar os N"', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    reiniciarRespostas()
    reiniciarConvocadosEmEspera()
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
  })

  const DOIS_PENDENTES = [
    convocacao(1, ANA, 'Violão', 'confirmada'),
    convocacao(2, BRUNO, 'Vocal', 'pendente'),
    convocacao(3, CARLA, 'Teclado', 'pendente'),
  ]

  test('"0 de 3 responderam", quem falta e "Falta: bateria"', async () => {
    await montar([...DOIS_PENDENTES, convocacao(4, ANA, 'Bateria', 'pendente')])
    // Ana aceitou o violão mas ainda não respondeu a bateria: não respondeu a tudo, conta uma vez.
    expect(await screen.findByText('0 de 3 responderam')).toBeOnTheScreen()
    expect(screen.getByText('Faltam: Bruno Lima, Carla Dias e Ana Souza')).toBeOnTheScreen()
    expect(screen.getByRole('progressbar', { name: '0 de 3 responderam' })).toBeOnTheScreen()
  })

  test('"Lembrar os 2": vira "Enviando em 10 s" com Desfazer e só então chama a API', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar(DOIS_PENDENTES, {
      [`POST ${CAMINHO}/lembrar-pendentes`]: () => ({
        status: 200,
        corpo: { pendentes: 2, lembradas: 2, jaLembradas: 0 },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: /^Lembrar os 2/ }))
    expect(
      await screen.findByText('Lembrando 2 pessoas que ainda não responderam.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Enviando em 10 s' })).toBeDisabled()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/lembrar-pendentes`)).toHaveLength(0)
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/lembrar-pendentes`)).toHaveLength(1),
    )
    // Depois: o botão é o texto "Lembrete enviado" e a linha diz quantas pessoas e a hora.
    expect((await screen.findAllByText('Lembrete enviado')).length).toBeGreaterThan(0)
    expect(screen.getByText(/^Você lembrou 2 pessoas, hoje às \d\d:\d\d\.$/)).toBeOnTheScreen()
  })

  test('Desfazer cancela o lembrete: o botão volta e nada é enviado', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar(DOIS_PENDENTES)
    await usuario.press(await screen.findByRole('button', { name: /^Lembrar os 2/ }))
    await usuario.press(await screen.findByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByRole('button', { name: /^Lembrar os 2/ })).toBeEnabled()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/lembrar-pendentes`)).toHaveLength(0)
  })

  test('quem já foi lembrado nas últimas 24 h: a resposta diz que ninguém foi lembrado agora', async () => {
    const usuario = userEvent.setup()
    await montar(DOIS_PENDENTES, {
      [`POST ${CAMINHO}/lembrar-pendentes`]: () => ({
        status: 200,
        corpo: { pendentes: 2, lembradas: 0, jaLembradas: 2 },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: /^Lembrar os 2/ }))
    await act(async () => confirmarAgora())
    expect(
      await screen.findByText(/^Ninguém para lembrar agora: quem falta já foi lembrado/),
    ).toBeOnTheScreen()
  })

  test('sem internet na API: o botão volta e o erro é humano', async () => {
    const usuario = userEvent.setup()
    await montar(DOIS_PENDENTES, {
      [`POST ${CAMINHO}/lembrar-pendentes`]: () => ({
        status: 409,
        corpo: { erro: 'encontro_fora_do_ar', mensagem: 'O encontro não está no ar.' },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: /^Lembrar os 2/ }))
    await act(async () => confirmarAgora())
    expect(await screen.findByRole('button', { name: /^Lembrar os 2/ })).toBeEnabled()
  })

  test('em rascunho não há lembrete (ninguém recebeu a convocação)', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({})
    await renderizarTela(
      <DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} abaInicial="convocados" />,
      {
        rotas: {
          [`GET ${CAMINHO}`]: () => ({
            status: 200,
            corpo: eventoDeTeste({ status: 'rascunho', atribuicoes: DOIS_PENDENTES }),
          }),
          [`GET ${CAMINHO}/repertorio`]: () => ({ status: 200, corpo: { itens: [] } }),
        },
      },
    )
    expect(await screen.findByText('1 de 3 responderam')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Lembrar/ })).toBeNull()
    expect(
      screen.getByText('Rascunho: ninguém recebe a convocação até você publicar.'),
    ).toBeOnTheScreen()
  })

  test('com ninguém para lembrar e função faltando: "Convocar bateria" no lugar', async () => {
    const usuario = userEvent.setup()
    await montar([
      convocacao(1, ANA, 'Violão', 'confirmada'),
      convocacao(2, BRUNO, 'Bateria', 'recusada'),
    ])
    expect(await screen.findByText('Falta: bateria')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Convocar bateria' }))
    expect(await screen.findByText('Convocar para Bateria')).toBeOnTheScreen()
  })

  test('para o membro, a aba nem existe: só quem convoca vê o botão de lembrar', async () => {
    await montar(DOIS_PENDENTES, {}, 'membro')
    await screen.findByText('Quando e onde')
    expect(screen.queryByRole('button', { name: /^Lembrar/ })).toBeNull()
  })
})

describe('a folha "Convocar" em lote', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    reiniciarRespostas()
    reiniciarConvocadosEmEspera()
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
  })

  /** Louvor com Bruno (violão) já convocado: as outras funções estão sem ninguém. */
  const NO_LOUVOR = [convocacao(1, BRUNO, 'Violão', 'confirmada')]

  async function abrirParaBateria() {
    const usuario = userEvent.setup()
    const montagem = await montar(NO_LOUVOR, {
      [`POST ${CAMINHO}/atribuicoes/lote`]: () => ({
        status: 200,
        corpo: { criadas: [], jaConvocadas: [] },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: 'Convocar para Bateria' }))
    await screen.findByText('Convocar para Bateria')
    return { usuario, ...montagem }
  }

  test('a função vem preenchida do bloco; "Sugeridas" primeiro, com o motivo de cada uma', async () => {
    await abrirParaBateria()
    expect(screen.getByRole('radio', { name: 'Bateria' })).toBeChecked()
    expect(await screen.findByText('Sugeridas')).toBeOnTheScreen()
    expect(screen.getByText('serviu em bateria 3 vezes')).toBeOnTheScreen()
    expect(screen.getByText('disponível neste dia')).toBeOnTheScreen()
    // A API de sugestões recebe a função do bloco.
    await waitFor(() => expect(screen.getByText('Todas as pessoas (3)')).toBeOnTheScreen())
  })

  test('quem já está em OUTRA função do mesmo bloco continua marcável, e diz onde já está (D73)', async () => {
    const usuario = userEvent.setup()
    await montar(NO_LOUVOR, {
      [`GET ${CAMINHO}/sugestoes-de-convocacao`]: () => ({
        status: 200,
        corpo: { ...SUGESTOES, sugeridas: [], indisponiveis: [] },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: 'Convocar para Bateria' }))
    // Bruno já toca violão no Louvor: para a bateria ele pode ser convocado também.
    const bruno = await screen.findByLabelText(/^Bruno Lima\. Já está em: Louvor \(violão\)/)
    expect(bruno).not.toBeDisabled()
    expect(screen.queryByText(/^Já convocado/)).toBeNull()
  })

  test('a MESMA combinação (bloco e função) fica travada, com o motivo escrito', async () => {
    const usuario = userEvent.setup()
    await montar(NO_LOUVOR)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar para Bateria' }))
    await screen.findByText('Convocar para Bateria')
    // Trocar a função para Violão (a de Bruno) trava Bruno.
    await usuario.press(screen.getByRole('radio', { name: 'Violão' }))
    const bruno = await screen.findByLabelText(/^Bruno Lima\. Já convocado: Louvor \(violão\)/)
    expect(bruno).toBeDisabled()
    expect(screen.getByText('Já convocado: Louvor (violão)')).toBeOnTheScreen()
  })

  test('quem avisou que não pode neste dia fica travado, com o motivo escrito', async () => {
    const usuario = userEvent.setup()
    await montar(NO_LOUVOR, {
      [`GET ${CAMINHO}/sugestoes-de-convocacao`]: () => ({
        status: 200,
        corpo: {
          ...SUGESTOES,
          sugeridas: [],
          indisponiveis: [{ vinculoId: CARLA.vinculoId, nome: CARLA.nome }],
        },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: 'Convocar para Bateria' }))
    const carla = await screen.findByLabelText(/^Carla Dias\. Avisou que não pode neste dia/)
    expect(carla).toBeDisabled()
    // Sem sugeridas, a seção "Sugeridas" nem aparece.
    expect(screen.queryByText('Sugeridas')).toBeNull()
  })

  test('sem ninguém marcado o botão diz "Marque quem convocar" e fica desabilitado', async () => {
    await abrirParaBateria()
    expect(await screen.findByRole('button', { name: 'Marque quem convocar' })).toBeDisabled()
  })

  test('marcar várias: o botão conta, a folha fecha, o bloco mostra "aguardando" e só aos 10 s a API é chamada', async () => {
    const { usuario, servidor } = await abrirParaBateria()
    await usuario.press((await screen.findAllByRole('checkbox', { name: /^Carla Dias/ }))[0]!)
    await usuario.press(screen.getAllByRole('checkbox', { name: /^Ana Souza/ })[0]!)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar 2 pessoas' }))

    // A folha fechou e o toast diz o que aconteceu, com Desfazer.
    expect(await screen.findByText('2 pessoas convocadas.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeOnTheScreen()
    // As duas já aparecem no bloco, aguardando resposta.
    expect(await screen.findByText('Bateria · 2')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)).toHaveLength(0)

    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)[0]?.corpo).toEqual({
        funcao: 'Bateria',
        etapaId: ETAPAS[1],
        vinculoIds: [CARLA.vinculoId, ANA.vinculoId],
      }),
    )
  })

  test('Desfazer tira as pessoas do bloco e nada é enviado', async () => {
    const { usuario, servidor } = await abrirParaBateria()
    await usuario.press((await screen.findAllByRole('checkbox', { name: /^Carla Dias/ }))[0]!)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar 1 pessoa' }))
    expect(await screen.findByText('1 pessoa convocada.')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Desfazer' }))
    await waitFor(() => expect(screen.queryByText('Bateria · 1')).toBeNull())
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)).toHaveLength(0)
  })

  test('a busca pelo nome filtra as duas listas', async () => {
    const { usuario } = await abrirParaBateria()
    await screen.findByText('Sugeridas')
    await usuario.type(screen.getByLabelText('Buscar pelo nome'), 'carl')
    await waitFor(() => expect(screen.getByText('Todas as pessoas (1)')).toBeOnTheScreen())
    expect(screen.queryByRole('checkbox', { name: /^Ana Souza/ })).toBeNull()
    await usuario.clear(screen.getByLabelText('Buscar pelo nome'))
    await usuario.type(screen.getByLabelText('Buscar pelo nome'), 'zzz')
    expect(await screen.findByText('Ninguém com esse nome.')).toBeOnTheScreen()
  })

  test('falha ao enviar: ninguém foi avisado e o toast oferece "Tentar de novo"', async () => {
    const usuario = userEvent.setup()
    await montar(NO_LOUVOR, {
      [`POST ${CAMINHO}/atribuicoes/lote`]: () => ({
        status: 500,
        corpo: { erro: 'erro_interno', mensagem: 'Falhou.' },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: 'Convocar para Bateria' }))
    await usuario.press((await screen.findAllByRole('checkbox', { name: /^Carla Dias/ }))[0]!)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar 1 pessoa' }))
    await act(async () => confirmarAgora())
    expect(await screen.findByText('Não deu para convocar. Ninguém foi avisado.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('o toque geral: "Onde", "Quem conduz / Quem ajuda / Outra função" e "Para o encontro inteiro"', async () => {
    const usuario = userEvent.setup()
    await montar(NO_LOUVOR)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    expect(await screen.findByRole('radio', { name: 'Encontro inteiro' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Quem ajuda' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Quem conduz' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Outra função' })).toBeOnTheScreen()
    await usuario.press(screen.getByRole('radio', { name: 'Outra função' }))
    expect(screen.getByLabelText(/^Nome da função/)).toBeOnTheScreen()
  })

  test('vazio: "Ninguém convocado ainda." com a ação "Convocar pessoas"', async () => {
    await montar([])
    expect(await screen.findByText('Ninguém convocado ainda.')).toBeOnTheScreen()
    expect(screen.getByText('Convoque quem vai servir neste encontro.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Convocar pessoas' })).toBeOnTheScreen()
  })

  test('tocar na pessoa convocada oferece "Tirar da convocação"', async () => {
    const usuario = userEvent.setup()
    await montar(NO_LOUVOR)
    await usuario.press(
      await screen.findByRole('button', { name: 'Bruno Lima, Violão. Convocação: Aceitou' }),
    )
    expect(await screen.findByRole('button', { name: /^Tirar da convocação/ })).toBeOnTheScreen()
  })
})

describe('convocar quem já serve o encontro: o bloqueio é só da mesma combinação (D73)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    reiniciarRespostas()
    reiniciarConvocadosEmEspera()
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
  })

  /** Ana (quem convoca) já serve o encontro inteiro, como "quem ajuda". */
  const ANA_NO_ENCONTRO: Atribuicao = {
    id: 'atr-ana',
    etapaId: null,
    vinculoId: ANA.vinculoId,
    funcao: 'integrante',
    estado: 'confirmada',
    nome: ANA.nome,
  }

  /** Sem sugeridas: cada pessoa aparece uma vez só (em "Todas as pessoas"). */
  const ROTA_DO_LOTE = {
    [`POST ${CAMINHO}/atribuicoes/lote`]: () => ({
      status: 200,
      corpo: { criadas: [], jaConvocadas: [] },
    }),
    [`GET ${CAMINHO}/sugestoes-de-convocacao`]: () => ({
      status: 200,
      corpo: { ...SUGESTOES, sugeridas: [], indisponiveis: [] },
    }),
  }

  test('no encontro inteiro como "quem ajuda": ela aparece travada, com o motivo', async () => {
    const usuario = userEvent.setup()
    await montar([ANA_NO_ENCONTRO], ROTA_DO_LOTE)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    const ana = await screen.findByLabelText(
      /^Ana Souza\. Já convocado: Encontro inteiro \(quem ajuda\)/,
    )
    expect(ana).toBeDisabled()
  })

  test('para o Louvor, violão: ela aparece marcável ("Já está em: Encontro inteiro") e o lote sai certo', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar([ANA_NO_ENCONTRO], ROTA_DO_LOTE)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    // O bloco "Louvor" está à vista (as pílulas quebram de linha, não rolam para fora da tela).
    await usuario.press(await screen.findByRole('radio', { name: 'Louvor' }))
    expect(screen.getByText('Ninguém na banda ainda.')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('radio', { name: 'Violão' }))

    const ana = await screen.findByLabelText(
      /^Ana Souza\. Já está em: Encontro inteiro \(quem ajuda\)/,
    )
    expect(ana).not.toBeDisabled()
    expect(screen.getByText('Já está em: Encontro inteiro (quem ajuda)')).toBeOnTheScreen()
    await usuario.press(ana)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar 1 pessoa' }))
    // A banda já mostra a líder, aguardando, na espera do Desfazer.
    expect(await screen.findByText('1 pessoa convocada.')).toBeOnTheScreen()
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)[0]?.corpo).toEqual({
        funcao: 'Violão',
        etapaId: ETAPAS[1],
        vinculoIds: [ANA.vinculoId],
      }),
    )
    // A pergunta das sugestões leva o bloco: estar no encontro inteiro não conta como "já convocado" no Louvor.
    expect(
      servidor.pedidos.some(
        (p) => p.url.includes('sugestoes-de-convocacao') && p.url.includes(`etapaId=${ETAPAS[1]}`),
      ),
    ).toBe(true)
  })

  test('a mesma pessoa pode ter duas funções na banda: violão e vocal', async () => {
    const usuario = userEvent.setup()
    const violao: Atribuicao = {
      id: 'atr-violao',
      etapaId: ETAPAS[1],
      vinculoId: ANA.vinculoId,
      funcao: 'Violão',
      estado: 'confirmada',
      nome: ANA.nome,
    }
    const { servidor } = await montar([ANA_NO_ENCONTRO, violao], ROTA_DO_LOTE)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    await usuario.press(await screen.findByRole('radio', { name: 'Louvor' }))
    expect(screen.getByText('Na banda: Ana (violão).')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('radio', { name: 'Vocal' }))
    const ana = await screen.findByLabelText(/^Ana Souza\. Já está em: /)
    expect(ana).not.toBeDisabled()
    await usuario.press(ana)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar 1 pessoa' }))
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)[0]?.corpo).toEqual({
        funcao: 'Vocal',
        etapaId: ETAPAS[1],
        vinculoIds: [ANA.vinculoId],
      }),
    )
  })

  test('o servidor também diz quem já está na função: "Já convocado nesta função" trava', async () => {
    const usuario = userEvent.setup()
    await montar([ANA_NO_ENCONTRO], {
      [`GET ${CAMINHO}/sugestoes-de-convocacao`]: () => ({
        status: 200,
        corpo: { ...SUGESTOES, sugeridas: [], indisponiveis: [], jaConvocadas: [CARLA.vinculoId] },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    const carla = await screen.findByLabelText(/^Carla Dias\. Já convocado nesta função/)
    expect(carla).toBeDisabled()
  })
})
