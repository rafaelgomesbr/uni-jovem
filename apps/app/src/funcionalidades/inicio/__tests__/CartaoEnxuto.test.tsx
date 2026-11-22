/**
 * D79: o cartão do momento enxuto (etiqueta, título, data e hora numa linha, UMA linha do estado,
 * botão principal e UM secundário que parece botão), vários encontros no mesmo dia no Início e os
 * textos sem "sábado" fixo.
 */
import { screen, userEvent, within } from '@testing-library/react-native'
import { router } from 'expo-router'

import type { EncontroDoDia } from '@/servicos/contratoV3'
import type { Rota } from '@/testes/dubles'
import { INICIO } from '@/testes/fixturas'
import {
  RELOGIO,
  aHoras,
  eventoDoMomento,
  inicioComMomento,
  liderDoMomento,
  momentoDeTeste,
  parteDoMomento,
} from '@/testes/momento'
import { BASE, renderizarTela } from '@/testes/telas'
import { reiniciarAcordeoesDaSessao } from '@/ui/Acordeao'

import { reiniciarRespostas } from '../../escalas/respostasOtimistas'
import { reiniciarEncantosParaTestes } from '../encantos'
import { botaoComum } from '../PecasDoCartao'
import { TelaInicio } from '../TelaInicio'

declare const __dirname: string

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
jest.mock('@/ui/ToastComDesfazer', () => ({
  ...jest.requireActual('@/ui/ToastComDesfazer'),
  mostrarDesfazer: jest.fn(),
}))

const ok = (corpo: unknown) => () => ({ status: 200, corpo })
const VISAO = {
  [`GET ${BASE}/visao-geral?escopo=minha`]: ok({
    escopo: 'minha',
    convocacoesParaResponder: 0,
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

function como(papel: 'membro' | 'organizador', momento = momentoDeTeste()) {
  const rotas: Record<string, Rota> = {
    ...VISAO,
    [`GET ${BASE}/inicio`]: ok(inicioComMomento(momento)),
  }
  return renderizarTela(<TelaInicio />, { papel, rotas })
}

const cofre = (jest.requireMock('expo-secure-store') as { __cofre: Map<string, string> }).__cofre

beforeEach(() => {
  jest.clearAllMocks()
  cofre.clear()
  reiniciarEncantosParaTestes()
  reiniciarAcordeoesDaSessao()
  reiniciarRespostas()
})

const SEM_NINGUEM = liderDoMomento({
  convocados: 0,
  confirmados: 0,
  pendentes: 0,
  responderam: 0,
  faltamResponder: [],
  faltamResponderTotal: 0,
  faltaFuncao: [],
  lembraveis: 0,
})

describe('o cartão enxuto (D79): o que o dono viu no build 11', () => {
  test('"Ninguém foi convocado" e o repertório vazio: uma linha de estado, o botão principal e UM secundário; sem a frase do alerta', async () => {
    await como('organizador', momentoDeTeste({ lider: SEM_NINGUEM }))
    expect(await screen.findByText('Ninguém foi convocado ainda.')).toBeOnTheScreen()
    // O alerta não é mais uma frase: o botão já diz "Montar o repertório".
    expect(screen.queryByText('O repertório está vazio.')).toBeNull()
    // Data e hora numa linha só, sem a duração e sem o local.
    expect(screen.getByText(/^Sáb\., \d+ [a-z]{3}\. · 16:00$/)).toBeOnTheScreen()
    expect(screen.queryByText(/às 17:00/)).toBeNull()
    // Nada recolhido: o cartão não tem mais "Ver detalhes".
    expect(screen.queryByRole('button', { name: /^Ver detalhes/ })).toBeNull()
    // Exatamente dois botões no cartão: o principal e um secundário.
    const cartao = screen.getByTestId('cartao-do-momento')
    const botoes = within(cartao).getAllByRole('button')
    // O primeiro "botão" é o topo tocável do cartão; depois vêm os dois botões de ação.
    expect(botoes.map((b) => b.props.accessibilityLabel)).toEqual(
      expect.arrayContaining(['Chamar quem vai']),
    )
    expect(botoes).toHaveLength(3)
  })

  test('"Ver quem vai" é um botão de verdade: secundário, com o ícone de pessoas, na largura do cartão', () => {
    const elemento = botaoComum('verConvocados', false, { titulo: 'Sábado' }, {
      verConvocados: jest.fn(),
      rotuloDoRepertorio: 'Ver o repertório',
    } as never)
    expect((elemento as { props: object }).props).toMatchObject({
      titulo: 'Ver quem vai',
      variante: 'secundario',
      icone: 'pessoas',
    })
    // O caminho secundário nunca é terciário (texto solto, que o dono não via como botão).
    expect((elemento as { props: { variante: string } }).props.variante).not.toBe('terciario')
  })

  test('o botão secundário tem fundo próprio (não é texto sobre o cartão) e 48 pt', async () => {
    await como(
      'organizador',
      momentoDeTeste({
        ...RELOGIO.vespera,
        lider: liderDoMomento({ pendentes: 0, lembraveis: 0, faltaFuncao: [] }),
        evento: eventoDoMomento({ musicas: 2 }),
      }),
    )
    const botao = await screen.findByRole('button', { name: 'Ver quem vai' })
    expect(botao).toBeOnTheScreen()
    const estilo = JSON.stringify(botao.props.style)
    expect(estilo).not.toContain('"backgroundColor":"transparent"')
    expect(estilo).toMatch(/"minHeight":48/)
  })

  test('membro: a pendência vira o chip "Aguardando sua resposta" ao lado de "Sua parte"; sem frase longa', async () => {
    await como('membro', momentoDeTeste({ ...RELOGIO.dia, suaParte: [parteDoMomento()] }))
    expect(await screen.findByText('Sua parte: Louvor · Vocal')).toBeOnTheScreen()
    expect(screen.getByText('Aguardando sua resposta')).toBeOnTheScreen()
    expect(screen.queryByText(/Dá tempo de avisar/)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Como chegar/ })).toBeNull()
  })

  test('membro, sem pendência: o botão de apoio é um botão (Ver o encontro), nunca um link', async () => {
    await como('membro')
    const ver = await screen.findByRole('button', { name: 'Ver o encontro' })
    expect(JSON.stringify(ver.props.style)).not.toContain('"backgroundColor":"transparent"')
  })
})

function encontroDoDia(parcial: Partial<EncontroDoDia> & { id: string }): EncontroDoDia {
  return {
    titulo: 'Culto',
    inicio: INICIO,
    fim: aHoras(1),
    duracaoMin: 60,
    fuso: 'America/Sao_Paulo',
    status: 'publicado',
    situacao: 'adiante',
    localNome: null,
    suaParte: [],
    ...parcial,
  }
}

describe('vários encontros no mesmo dia (D79)', () => {
  const tres = [
    encontroDoDia({
      id: 'e0',
      titulo: 'Café da manhã',
      inicio: aHoras(-7),
      fim: aHoras(-6),
      situacao: 'terminou',
    }),
    encontroDoDia({
      id: 'e1',
      titulo: 'Sábado Jovem',
      suaParte: [{ funcao: 'Vocal', etapaTitulo: 'Louvor', estado: 'confirmada' }],
    }),
    encontroDoDia({
      id: 'e2',
      titulo: 'Noite de jogos',
      inicio: aHoras(0.5),
      fim: aHoras(2),
      duracaoMin: 90,
      suaParte: [{ funcao: 'Recepção', etapaTitulo: null, estado: 'pendente' }],
    }),
  ]

  test('o cartão é o próximo e diz "1 de 3"; o bloco "Hoje: 3 encontros" lista por hora, com situação e o seu papel', async () => {
    await como(
      'membro',
      momentoDeTeste({ ...RELOGIO.dia, doDia: tres, suaParte: [parteDoMomento()] }),
    )
    expect(await screen.findByText('Hoje: 3 encontros')).toBeOnTheScreen()
    // O cartão do momento mostra a posição do encontro entre os do dia.
    const cartao = screen.getByTestId('cartao-do-momento')
    expect(within(cartao).getByText('2 de 3')).toBeOnTheScreen()
    // Uma linha por encontro, na ordem de horário.
    const linhas = ['e0', 'e1', 'e2'].map((id) => screen.getByTestId(`encontro-do-dia-${id}`))
    expect(linhas).toHaveLength(3)
    expect(within(linhas[0]!).getByText('Café da manhã')).toBeOnTheScreen()
    expect(within(linhas[0]!).getByText('Terminou')).toBeOnTheScreen()
    expect(within(linhas[1]!).getByText('Próximo · Você: Louvor · Vocal')).toBeOnTheScreen()
    expect(within(linhas[2]!).getByText('Você: Recepção')).toBeOnTheScreen()
    expect(within(linhas[2]!).getByText('Aguardando sua resposta')).toBeOnTheScreen()
  })

  test('encontros que se sobrepõem dizem "Ao mesmo tempo que ..." com a hora do outro', async () => {
    await como('membro', momentoDeTeste({ ...RELOGIO.dia, doDia: tres.slice(1), suaParte: [] }))
    const linha = await screen.findByTestId('encontro-do-dia-e2')
    expect(
      within(linha).getByText(/^Ao mesmo tempo que Sábado Jovem \(\d{2}:\d{2}\)$/),
    ).toBeOnTheScreen()
  })

  test('tocar em qualquer linha abre o encontro; o rótulo falado traz hora, título, situação e papel', async () => {
    await como('membro', momentoDeTeste({ ...RELOGIO.dia, doDia: tres }))
    const linha = await screen.findByTestId('encontro-do-dia-e2')
    expect(linha.props.accessibilityLabel).toMatch(/Noite de jogos/)
    await userEvent.setup().press(linha)
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e2' },
    })
  })

  test('com um encontro só (ou sem a lista), o bloco e o "1 de 3" não existem', async () => {
    await como('membro', momentoDeTeste({ ...RELOGIO.dia, doDia: [tres[1]!] }))
    await screen.findByText('Sábado Jovem')
    expect(screen.queryByText(/encontros$/)).toBeNull()
    expect(screen.queryByTestId('encontro-do-dia-e1')).toBeNull()
  })

  test('o líder vê o mesmo bloco, com o cartão do líder', async () => {
    await como(
      'organizador',
      momentoDeTeste({ ...RELOGIO.vespera, doDia: tres, lider: liderDoMomento() }),
    )
    expect(await screen.findByText('Amanhã: 3 encontros')).toBeOnTheScreen()
    expect(screen.getByText('2 de 3')).toBeOnTheScreen()
  })
})

/** Tira os comentários, que explicam o porquê e podem citar o sábado do exemplo. */
function semComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('textos sem "sábado" fixo no Início e na Agenda (D79)', () => {
  const fs = require('node:fs') as {
    readdirSync: (c: string) => string[]
    readFileSync: (c: string, e: string) => string
  }
  const raiz = `${__dirname}/../..`
  const arquivos = ['inicio', 'agenda'].flatMap((pasta) =>
    fs
      .readdirSync(`${raiz}/${pasta}`)
      .filter((f: string) => /\.tsx?$/.test(f))
      .map((f: string) => `${raiz}/${pasta}/${f}`),
  )

  test('nenhum texto de tela cita o dia da semana: o app não existe só no sábado', () => {
    expect(arquivos.length).toBeGreaterThan(10)
    for (const arquivo of arquivos) {
      const codigo = semComentarios(fs.readFileSync(arquivo, 'utf8'))
      expect({ arquivo, acha: /s[áa]bado/i.test(codigo) }).toEqual({ arquivo, acha: false })
    }
  })
})
