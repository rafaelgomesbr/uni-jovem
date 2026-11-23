/**
 * D69, D73 e D74: o "Quem vai" (uma lista só, com a banda como seção), a folha "Convocar" (o título
 * muda com o papel, cada pessoa aparece uma vez, a marcação não vaza entre papéis, a função cheia
 * explica), "Tirar" com texto na linha e Desfazer, e o resumo com "Lembrar os N". Tudo o que avisa
 * gente espera a contagem do Desfazer: a API só é chamada depois (ou antes, se a pessoa sair).
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import type { Atribuicao } from '@/servicos/contratoDosEventos'
import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, COMUNIDADE, PESSOAS, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast } from '@/ui/Toast'
import {
  aoMudarEstadoDoApp,
  confirmarAgora,
  desfazerAgora,
  reiniciarDesfazer,
} from '@/ui/ToastComDesfazer'

import { reiniciarRespostas } from '../../escalas/respostasOtimistas'
import { reiniciarConvocadosEmEspera } from '../convocadosOtimistas'
import { ondeJaEsta, pessoasDistintas, quantasPessoas, rotuloDaFuncao } from '../Convocacao'
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
  etapaId: string | null = ETAPAS[1],
): Atribuicao {
  return {
    id: `atr-${n}`,
    etapaId,
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

const ROTA_DO_LOTE = {
  [`POST ${CAMINHO}/atribuicoes/lote`]: () => ({
    status: 200,
    corpo: { criadas: [], jaConvocadas: [] },
  }),
}

function montar(
  atribuicoes: Atribuicao[],
  rotas: object = {},
  papel: 'organizador' | 'membro' = 'organizador',
  evento: Parameters<typeof eventoDeTeste>[0] = {},
) {
  return renderizarTela(
    <>
      <DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} abaInicial="convocados" />
      <HospedeiroDeToast />
    </>,
    {
      papel,
      rotas: {
        [`GET ${CAMINHO}`]: () => ({
          status: 200,
          corpo: eventoDeTeste({ atribuicoes, ...evento }),
        }),
        [`GET ${CAMINHO}/repertorio`]: () => ({ status: 200, corpo: { itens: [] } }),
        [`GET ${BASE}/meu-repertorio`]: () => ({ status: 200, corpo: { encontros: [] } }),
        [`GET ${CAMINHO}/sugestoes-de-convocacao`]: () => ({ status: 200, corpo: SUGESTOES }),
        ...rotas,
      },
    },
  )
}

function limpar() {
  jest.clearAllMocks()
  reiniciarDesfazer()
  reiniciarRespostas()
  reiniciarConvocadosEmEspera()
}

describe('as contas do Quem vai (puras)', () => {
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
})

describe('resumo do Quem vai e "Lembrar os N"', () => {
  beforeEach(limpar)
  afterEach(async () => {
    await act(async () => desfazerAgora())
    reiniciarDesfazer()
  })

  const DOIS_PENDENTES = [
    convocacao(1, ANA, 'Violão', 'confirmada'),
    convocacao(2, BRUNO, 'Vocal', 'pendente'),
    convocacao(3, CARLA, 'Teclado', 'pendente'),
  ]

  test('"0 de 3 responderam", quem falta e a aba se chama "Quem vai"', async () => {
    await montar([...DOIS_PENDENTES, convocacao(4, ANA, 'Bateria', 'pendente')])
    // Ana aceitou o violão mas ainda não respondeu a bateria: não respondeu a tudo, conta uma vez.
    expect(await screen.findByText('0 de 3 responderam')).toBeOnTheScreen()
    expect(screen.getByText('Faltam: Bruno Lima, Carla Dias e Ana Souza')).toBeOnTheScreen()
    expect(screen.getByRole('progressbar', { name: '0 de 3 responderam' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Quem vai' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'Convocados' })).toBeNull()
  })

  test('"Lembrar os 2": vira "Enviando em 5 s" com Desfazer e só então chama a API', async () => {
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
    // O número do botão é o que a faixa conta: nenhum "10" escrito à mão.
    expect(screen.getByRole('button', { name: 'Enviando em 5 s' })).toBeDisabled()
    expect(screen.getByText('5 s')).toBeOnTheScreen()
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

  test('o servidor recusa: o botão volta, a faixa diz que ninguém foi lembrado e oferece "Tentar de novo"', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar(DOIS_PENDENTES, {
      [`POST ${CAMINHO}/lembrar-pendentes`]: () => ({
        status: 409,
        corpo: { erro: 'encontro_fora_do_ar', mensagem: 'O encontro não está no ar.' },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: /^Lembrar os 2/ }))
    await act(async () => confirmarAgora())
    expect(
      await screen.findByText(
        'Não deu para lembrar agora. Ninguém foi lembrado. Toque em Tentar de novo.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
    expect(await screen.findByRole('button', { name: /^Lembrar os 2/ })).toBeEnabled()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/lembrar-pendentes`)).toHaveLength(1)
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

describe('Quem vai: uma lista, a mesma pessoa com vários papéis, "Tirar" na linha', () => {
  beforeEach(limpar)
  afterEach(async () => {
    await act(async () => desfazerAgora())
    reiniciarDesfazer()
  })

  const DUAS_NA_BANDA = [
    convocacao(1, ANA, 'Violão', 'confirmada'),
    convocacao(2, ANA, 'Vocal', 'confirmada'),
    convocacao(3, BRUNO, 'Bateria', 'pendente'),
    convocacao(4, CARLA, 'responsável', 'confirmada', null),
  ]

  test('a banda é uma seção da mesma lista; a pessoa com dois papéis aparece UMA vez', async () => {
    await montar(DUAS_NA_BANDA)
    expect(await screen.findByText('Banda')).toBeOnTheScreen()
    expect(screen.getByText('Equipe')).toBeOnTheScreen()
    // Ana: uma linha só, com os dois papéis.
    expect(screen.getAllByText('Ana Souza')).toHaveLength(1)
    expect(screen.getByText('Violão, Vocal')).toBeOnTheScreen()
    // Bruno na bateria (aguardando); Carla conduz o encontro inteiro, na equipe.
    expect(screen.getByText('Bateria')).toBeOnTheScreen()
    expect(screen.getByText('Quem conduz')).toBeOnTheScreen()
    expect(screen.getByText('Aguardando')).toBeOnTheScreen()
  })

  test('cada linha tem o botão "Tirar", com texto, e tirar um papel só não pede diálogo: some e dá Desfazer', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar(DUAS_NA_BANDA, {
      [`DELETE ${CAMINHO}/atribuicoes/atr-3`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    await usuario.press(
      await screen.findByRole('button', { name: 'Tirar Bruno Lima da convocação' }),
    )
    expect(await screen.findByText('Bruno saiu da convocação: Bateria.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeOnTheScreen()
    // Some da lista na hora; o servidor só é chamado ao fim da contagem.
    expect(screen.queryByRole('button', { name: 'Tirar Bruno Lima da convocação' })).toBeNull()
    expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/atribuicoes/atr-3`)).toHaveLength(0)
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/atribuicoes/atr-3`)).toHaveLength(1),
    )
  })

  test('Desfazer devolve a pessoa à lista e nada é enviado', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar(DUAS_NA_BANDA)
    await usuario.press(
      await screen.findByRole('button', { name: 'Tirar Bruno Lima da convocação' }),
    )
    await usuario.press(await screen.findByRole('button', { name: 'Desfazer' }))
    expect(
      await screen.findByRole('button', { name: 'Tirar Bruno Lima da convocação' }),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/atribuicoes/atr-3`)).toHaveLength(0)
  })

  test('quem tem dois papéis: "Tirar" pergunta de qual (ou de tudo) e tira só o escolhido', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar(DUAS_NA_BANDA, {
      [`DELETE ${CAMINHO}/atribuicoes/atr-2`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    await usuario.press(
      await screen.findByRole('button', { name: 'Tirar Ana Souza da convocação' }),
    )
    expect(await screen.findByText('Tirar Ana de quê?')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Tirar de Violão/ })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Tirar de tudo \(2 papéis\)/ })).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: /^Tirar de Vocal/ }))
    expect(await screen.findByText('Ana saiu da convocação: Vocal.')).toBeOnTheScreen()
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/atribuicoes/atr-2`)).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/atribuicoes/atr-1`)).toHaveLength(0)
  })

  test('vazio: "Ninguém vai ainda." com a ação "Convocar pessoas"', async () => {
    await montar([])
    expect(await screen.findByText('Ninguém vai ainda.')).toBeOnTheScreen()
    expect(screen.getByText('Convoque quem vai servir neste encontro.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Convocar pessoas' })).toBeOnTheScreen()
  })
})

describe('a folha "Convocar" em lote', () => {
  beforeEach(limpar)
  afterEach(async () => {
    await act(async () => desfazerAgora())
    reiniciarDesfazer()
  })

  /** Louvor com Bruno (violão) já convocado: as outras funções estão sem ninguém. */
  const NO_LOUVOR = [convocacao(1, BRUNO, 'Violão', 'confirmada')]

  async function abrirParaBateria(rotas: object = {}, evento = {}) {
    const usuario = userEvent.setup()
    const montagem = await montar(NO_LOUVOR, { ...ROTA_DO_LOTE, ...rotas }, 'organizador', evento)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar para Bateria' }))
    await screen.findByText('Convocar para Bateria')
    return { usuario, ...montagem }
  }

  test('o papel vem do toque; "Sugeridas" primeiro, com o motivo de cada uma, e cada pessoa UMA vez', async () => {
    await abrirParaBateria()
    expect(screen.getByRole('radio', { name: 'Bateria' })).toBeChecked()
    expect(await screen.findByText('Sugeridas')).toBeOnTheScreen()
    expect(screen.getByText('serviu em bateria 3 vezes')).toBeOnTheScreen()
    expect(screen.getByText('disponível neste dia')).toBeOnTheScreen()
    // As sugeridas não se repetem na lista de baixo: Carla e Ana aparecem uma vez cada.
    await waitFor(() => expect(screen.getByText('Outras pessoas (1)')).toBeOnTheScreen())
    expect(screen.getAllByRole('checkbox', { name: /^Carla Dias/ })).toHaveLength(1)
    expect(screen.getAllByRole('checkbox', { name: /^Ana Souza/ })).toHaveLength(1)
  })

  test('o título muda com o papel escolhido: "Convocar para Violão"', async () => {
    const { usuario } = await abrirParaBateria()
    await usuario.press(screen.getByRole('radio', { name: 'Violão' }))
    expect(await screen.findByText('Convocar para Violão')).toBeOnTheScreen()
    expect(screen.queryByText('Convocar para Bateria')).toBeNull()
    await usuario.press(screen.getByRole('radio', { name: 'Quem ajuda' }))
    expect(await screen.findByText('Convocar para ajudar')).toBeOnTheScreen()
  })

  test('a marcação não vaza entre papéis: trocar de função limpa quem estava marcado', async () => {
    const { usuario } = await abrirParaBateria()
    await usuario.press(await screen.findByRole('checkbox', { name: /^Carla Dias/ }))
    expect(
      await screen.findByRole('button', { name: 'Convocar 1 pessoa para o Louvor' }),
    ).toBeOnTheScreen()
    await usuario.press(screen.getByRole('radio', { name: 'Violão' }))
    expect(await screen.findByRole('button', { name: 'Marque quem convocar' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /^Carla Dias/ })).not.toBeChecked()
  })

  test('função que já tem gente explica em vez de esconder o caminho: "Violão: já tem Bruno."', async () => {
    const { usuario } = await abrirParaBateria()
    await usuario.press(screen.getByRole('radio', { name: 'Violão' }))
    expect(await screen.findByTestId('ja-tem-na-funcao')).toHaveTextContent('Violão: já tem Bruno.')
    const bruno = await screen.findByLabelText(/^Bruno Lima\. Já está como Violão/)
    expect(bruno).toBeDisabled()
    // O resto da lista continua à vista: dá para convocar mais gente para o violão.
    expect(screen.getByRole('checkbox', { name: /^Carla Dias/ })).toBeOnTheScreen()
    expect(screen.queryByText(/^Já convocado/)).toBeNull()
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

  test('marcar várias: o botão diz o que acontece e a quem; a folha fecha, a lista mostra "A enviar" e só depois a API é chamada', async () => {
    const { usuario, servidor } = await abrirParaBateria()
    await usuario.press(await screen.findByRole('checkbox', { name: /^Carla Dias/ }))
    await usuario.press(screen.getByRole('checkbox', { name: /^Ana Souza/ }))
    // O texto diz o que acontece e a quem, com o número de segundos que a faixa vai contar.
    expect(
      await screen.findByText(
        'Elas serão avisadas depois da contagem. Você tem 5 segundos para desfazer.',
      ),
    ).toBeOnTheScreen()
    await usuario.press(
      await screen.findByRole('button', { name: 'Convocar 2 pessoas para o Louvor' }),
    )

    // A folha fechou e a faixa diz o que está acontecendo, com Desfazer.
    expect(await screen.findByText('Convocando 2 pessoas para Bateria.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeOnTheScreen()
    // As duas já estão na lista, mas marcadas "A enviar": o servidor ainda não sabe e ninguém foi avisado.
    expect(await screen.findAllByText('A enviar')).toHaveLength(2)
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)).toHaveLength(0)

    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)[0]?.corpo).toEqual({
        funcao: 'Bateria',
        etapaId: ETAPAS[1],
        vinculoIds: [CARLA.vinculoId, ANA.vinculoId],
      }),
    )
    // E a mensagem final diz o que houve, com quem e para quê.
    expect(
      await screen.findByText(
        'Pronto. 2 pessoas foram convocadas para Bateria e receberam o aviso.',
      ),
    ).toBeOnTheScreen()
  })

  test('em rascunho a folha avisa que ninguém recebe antes de publicar, e a mensagem final também', async () => {
    const { usuario, servidor } = await abrirParaBateria({}, { status: 'rascunho' })
    expect(
      screen.getAllByText('Rascunho: ninguém recebe a convocação até você publicar.').length,
    ).toBeGreaterThan(0)
    await usuario.press(await screen.findByRole('checkbox', { name: /^Carla Dias/ }))
    await usuario.press(
      await screen.findByRole('button', { name: 'Convocar 1 pessoa para o Louvor' }),
    )
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)).toHaveLength(1),
    )
    expect(
      await screen.findByText(
        'Salvo. Ninguém foi avisado ainda: Carla recebe a convocação quando você publicar.',
      ),
    ).toBeOnTheScreen()
  })

  test('Desfazer tira as pessoas da lista e nada é enviado', async () => {
    const { usuario, servidor } = await abrirParaBateria()
    await usuario.press(await screen.findByRole('checkbox', { name: /^Carla Dias/ }))
    await usuario.press(
      await screen.findByRole('button', { name: 'Convocar 1 pessoa para o Louvor' }),
    )
    expect(await screen.findByText('Convocando 1 pessoa para Bateria.')).toBeOnTheScreen()
    expect(await screen.findAllByText('A enviar')).toHaveLength(1)
    await usuario.press(screen.getByRole('button', { name: 'Desfazer' }))
    await waitFor(() => expect(screen.queryByText('A enviar')).toBeNull())
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)).toHaveLength(0)
  })

  test('o app vai para segundo plano antes da contagem: a convocação sai na hora (a ação não se perde)', async () => {
    const { usuario, servidor } = await abrirParaBateria()
    await usuario.press(await screen.findByRole('checkbox', { name: /^Carla Dias/ }))
    await usuario.press(
      await screen.findByRole('button', { name: 'Convocar 1 pessoa para o Louvor' }),
    )
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)).toHaveLength(0)
    // O app vai para segundo plano: a vigia do Desfazer envia.
    await act(async () => aoMudarEstadoDoApp('background'))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)).toHaveLength(1),
    )
  })

  test('a busca pelo nome filtra as listas', async () => {
    const { usuario } = await abrirParaBateria()
    await screen.findByText('Sugeridas')
    await usuario.type(screen.getByLabelText('Buscar pelo nome'), 'carl')
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: /^Ana Souza/ })).toBeNull())
    expect(screen.getByRole('checkbox', { name: /^Carla Dias/ })).toBeOnTheScreen()
    await usuario.clear(screen.getByLabelText('Buscar pelo nome'))
    await usuario.type(screen.getByLabelText('Buscar pelo nome'), 'zzz')
    expect(await screen.findByText('Ninguém com esse nome.')).toBeOnTheScreen()
  })

  test('falha ao enviar: ninguém foi avisado, a pessoa sai da lista e a faixa oferece "Tentar de novo"', async () => {
    const usuario = userEvent.setup()
    let tentativas = 0
    const { servidor } = await montar(NO_LOUVOR, {
      [`POST ${CAMINHO}/atribuicoes/lote`]: () => {
        tentativas++
        return tentativas === 1
          ? { status: 409, corpo: { erro: 'encontro_fora_do_ar', mensagem: 'Fora do ar.' } }
          : { status: 200, corpo: { criadas: [], jaConvocadas: [] } }
      },
    })
    await usuario.press(await screen.findByRole('button', { name: 'Convocar para Bateria' }))
    await usuario.press(await screen.findByRole('checkbox', { name: /^Carla Dias/ }))
    await usuario.press(
      await screen.findByRole('button', { name: 'Convocar 1 pessoa para o Louvor' }),
    )
    await act(async () => confirmarAgora())
    expect(
      await screen.findByText(
        'Não deu para convocar para Bateria. Ninguém foi avisado. Toque em Tentar de novo.',
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByText('A enviar')).toBeNull()
    await usuario.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)).toHaveLength(2),
    )
  })

  test('o toque geral abre em "Quem ajuda" e mostra a equipe e a banda; "Outra função" pede o nome', async () => {
    const usuario = userEvent.setup()
    await montar(NO_LOUVOR)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    expect(await screen.findByRole('radio', { name: 'Quem ajuda' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Quem conduz' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Outra função' })).toBeOnTheScreen()
    // Não há mais "Onde": o app descobre pelo papel (a banda vai para o Louvor).
    expect(screen.queryByRole('radio', { name: 'Encontro inteiro' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Violão' })).not.toBeChecked()
    await usuario.press(screen.getByRole('radio', { name: 'Outra função' }))
    expect(screen.getByLabelText(/^Nome da função/)).toBeOnTheScreen()
  })

  test('"Convocar para a banda" abre sem papel escolhido e pede para escolher', async () => {
    const usuario = userEvent.setup()
    await montar(NO_LOUVOR)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar para a banda' }))
    expect(
      await screen.findByRole('button', { name: 'Escolha o que a pessoa vai fazer' }),
    ).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Quem ajuda' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Violão' })).not.toBeChecked()
  })
})

describe('convocar quem já serve o encontro: o bloqueio é só da mesma combinação (D73)', () => {
  beforeEach(limpar)
  afterEach(async () => {
    await act(async () => desfazerAgora())
    reiniciarDesfazer()
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

  /** Sem sugeridas: cada pessoa aparece uma vez só. */
  const ROTAS = {
    ...ROTA_DO_LOTE,
    [`GET ${CAMINHO}/sugestoes-de-convocacao`]: () => ({
      status: 200,
      corpo: { ...SUGESTOES, sugeridas: [], indisponiveis: [] },
    }),
  }

  test('no encontro inteiro como "quem ajuda": ela aparece travada, com o motivo', async () => {
    const usuario = userEvent.setup()
    await montar([ANA_NO_ENCONTRO], ROTAS)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    const ana = await screen.findByLabelText(/^Ana Souza\. Já está como Quem ajuda/)
    expect(ana).toBeDisabled()
  })

  test('para o Louvor, violão: ela aparece marcável ("Já está em: Encontro inteiro") e o lote sai certo', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar([ANA_NO_ENCONTRO], ROTAS)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    // O papel da banda está à vista, sem "Onde": o app leva a convocação para o Louvor sozinho.
    await usuario.press(await screen.findByRole('radio', { name: 'Violão' }))
    expect(await screen.findByText('Convocar para Violão')).toBeOnTheScreen()

    const ana = await screen.findByLabelText(
      /^Ana Souza\. Já está em: Encontro inteiro \(quem ajuda\)/,
    )
    expect(ana).not.toBeDisabled()
    await usuario.press(ana)
    await usuario.press(
      await screen.findByRole('button', { name: 'Convocar 1 pessoa para o Louvor' }),
    )
    // A lista já mostra a líder na banda, "A enviar", na espera do Desfazer.
    expect(await screen.findByText('Convocando 1 pessoa para Violão.')).toBeOnTheScreen()
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)[0]?.corpo).toEqual({
        funcao: 'Violão',
        etapaId: ETAPAS[1],
        vinculoIds: [ANA.vinculoId],
      }),
    )
    // A pergunta das sugestões leva o bloco: estar no encontro inteiro não conta como "já" no Louvor.
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
    const { servidor } = await montar([ANA_NO_ENCONTRO, violao], ROTAS)
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    await usuario.press(await screen.findByRole('radio', { name: 'Vocal' }))
    const ana = await screen.findByLabelText(/^Ana Souza\. Já está em: /)
    expect(ana).not.toBeDisabled()
    await usuario.press(ana)
    await usuario.press(
      await screen.findByRole('button', { name: 'Convocar 1 pessoa para o Louvor' }),
    )
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)[0]?.corpo).toEqual({
        funcao: 'Vocal',
        etapaId: ETAPAS[1],
        vinculoIds: [ANA.vinculoId],
      }),
    )
  })

  test('encontro sem etapa de Louvor: a banda vai para o encontro inteiro (etapaId nulo)', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar([ANA_NO_ENCONTRO], ROTAS, 'organizador', {
      etapas: eventoDeTeste().etapas.filter((e) => e.titulo !== 'Louvor'),
    })
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    await usuario.press(await screen.findByRole('radio', { name: 'Bateria' }))
    await usuario.press(await screen.findByRole('checkbox', { name: /^Carla Dias/ }))
    await usuario.press(
      await screen.findByRole('button', { name: 'Convocar 1 pessoa para o Louvor' }),
    )
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes/lote`)[0]?.corpo).toEqual({
        funcao: 'Bateria',
        etapaId: null,
        vinculoIds: [CARLA.vinculoId],
      }),
    )
  })

  test('o servidor também diz quem já está na função: "Já está nesta função" trava', async () => {
    const usuario = userEvent.setup()
    await montar([ANA_NO_ENCONTRO], {
      [`GET ${CAMINHO}/sugestoes-de-convocacao`]: () => ({
        status: 200,
        corpo: { ...SUGESTOES, sugeridas: [], indisponiveis: [], jaConvocadas: [CARLA.vinculoId] },
      }),
    })
    await usuario.press(await screen.findByRole('button', { name: 'Convocar pessoas' }))
    const carla = await screen.findByLabelText(/^Carla Dias\. Já está nesta função/)
    expect(carla).toBeDisabled()
  })
})
