/**
 * D69 e D79: a Agenda v3. Lista por dia, a parte de cada um na linha, filtro "Só o que é meu",
 * resposta direto na linha com Desfazer de 5 s, "Pedem ajuda", Calendário em folha com "Dias em
 * que posso ajudar", "Novo encontro" para quem cria e os estados (vazio, erro, sem internet).
 */
import { onlineManager } from '@tanstack/react-query'
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert, Dimensions } from 'react-native'

import type { MinhaEscala, ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { EVENTO_ID } from '@/testes/fixturas'
import { BASE, FUSO, MEU_VINCULO, pedidosPara, renderizarTela } from '@/testes/telas'
import { confirmarAgora, desfazerAgora, haDesfazerPendente } from '@/ui/ToastComDesfazer'
import { hojeNoFuso, inicioDaSemana, instanteDeDataEHora, somarDias } from '@/utilidades/datas'

import { reiniciarRespostas } from '../../escalas/respostasOtimistas'
import {
  agruparPorDia,
  dataDaRota,
  descreverPeriodo,
  intervaloDoModo,
  passo,
  periodoTemHoje,
} from '../calendario'
import {
  dataCurtaDoEncontro,
  diaDoToast,
  horarioELocal,
  nomeDaParte,
  textoDaSuaParte,
} from '../semanas'
import { cabecalhoDoDia } from '../dias'
import { TelaAgenda } from '../TelaAgenda'

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

const HOJE = hojeNoFuso(FUSO)
/** O sábado da semana de hoje, a semana seguinte e a outra: um encontro em cada grupo. */
const SABADO_DESTA = somarDias(inicioDaSemana(HOJE), 6)
const SABADO_DA_PROXIMA = somarDias(SABADO_DESTA, 7)
const SABADO_ADIANTE = somarDias(SABADO_DESTA, 14)
const emSabado = (dia: string, hora = '16:00') => instanteDeDataEHora(dia, hora, FUSO)

function resumo(parcial: Partial<ResumoDoEvento>): ResumoDoEvento {
  return {
    id: EVENTO_ID,
    titulo: 'Sábado Jovem',
    categoria: 'Programação de sábado',
    inicio: emSabado(SABADO_DESTA),
    duracaoMin: 60,
    fuso: FUSO,
    status: 'publicado',
    visibilidade: 'interna',
    serieId: null,
    versao: 1,
    localNome: 'Salão da igreja',
    localTipo: 'interno',
    quantidadeDeEtapas: 7,
    ...parcial,
  }
}

const E1 = resumo({ id: 'e1' })
const E2 = resumo({ id: 'e2', inicio: emSabado(SABADO_DA_PROXIMA) })
const E3 = resumo({
  id: 'e3',
  titulo: 'Noite de Louvor',
  inicio: emSabado(SABADO_ADIANTE, '19:30'),
  localNome: 'Igreja',
})

function escala(parcial: Partial<MinhaEscala>): MinhaEscala {
  return {
    id: 'a1',
    funcao: 'Vocal',
    estado: 'pendente',
    eventoId: 'e1',
    eventoTitulo: 'Sábado Jovem',
    eventoInicio: E1.inicio,
    eventoStatus: 'publicado',
    etapaTitulo: 'Louvor',
    substituicaoAberta: null,
    ...parcial,
  }
}

function rotas(eventos: ResumoDoEvento[], escalas: MinhaEscala[] = [], extras = {}) {
  return {
    [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos } }),
    [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas } }),
    [`GET ${BASE}/inscricoes/eu`]: () => ({ status: 200, corpo: { inscricoes: [] } }),
    [`GET ${BASE}/substituicoes`]: () => ({ status: 200, corpo: { substituicoes: [] } }),
    [`GET ${BASE}/disponibilidade`]: () => ({ status: 200, corpo: { disponibilidade: [] } }),
    [`GET ${BASE}/eventos/anteriores-para-copiar`]: () => ({ status: 200, corpo: { opcoes: [] } }),
    ...extras,
  }
}

/** O preset do Jest simula fonte grande (2x); a grade do mês só aparece com a fonte normal. */
function usarFonte(fontScale: number) {
  const janela = { width: 390, height: 844, scale: 3, fontScale }
  Dimensions.set({ window: janela, screen: janela })
}

describe('as contas da Agenda (puras)', () => {
  test('a linha "Você:" junta etapa e função; recusada vira "Você avisou que não pode."', () => {
    expect(nomeDaParte({ funcao: 'vocal', etapaTitulo: 'Louvor' })).toBe('Louvor · Vocal')
    expect(nomeDaParte({ funcao: 'recepção', etapaTitulo: null })).toBe('Recepção')
    expect(
      textoDaSuaParte([
        { funcao: 'Vocal', etapaTitulo: 'Louvor', estado: 'confirmada' },
        { funcao: 'Recepção', etapaTitulo: null, estado: 'pendente' },
      ]),
    ).toBe('Você: Louvor · Vocal, Recepção')
    expect(textoDaSuaParte([{ funcao: 'Vocal', etapaTitulo: null, estado: 'recusada' }])).toBe(
      'Você avisou que não pode.',
    )
    expect(textoDaSuaParte([])).toBeNull()
  })

  test('data curta, horário com local e o dia do toast', () => {
    const inicio = '2026-11-28T19:00:00.000Z'
    expect(dataCurtaDoEncontro(inicio, FUSO)).toBe('Sáb., 28 de nov.')
    expect(diaDoToast(inicio, FUSO)).toBe('sábado 28')
    expect(
      horarioELocal({ inicio, fuso: FUSO, duracaoMin: 60, localNome: 'Salão da igreja' }),
    ).toBe('SÁB 16:00 às 17:00 · Salão da igreja')
  })
})

describe('calendário (regras puras)', () => {
  test('data da rota: real e de 1900 a 2100; o resto é inválido', () => {
    expect(dataDaRota('2026-11-21')).toBe('2026-11-21')
    expect(dataDaRota('9999-12-31')).toBe('invalida')
    expect(dataDaRota('2026-02-30')).toBe('invalida')
    expect(dataDaRota(null)).toBeNull()
  })

  test('intervalos e passos do mês; título do período', () => {
    expect(intervaloDoModo('mes', '2026-11-15')).toEqual({
      inicio: '2026-11-01',
      fim: '2026-12-13',
    })
    expect(passo('mes', '2026-11-15', -1)).toBe('2026-10-01')
    expect(descreverPeriodo('mes', '2026-11-18')).toBe('Novembro de 2026')
    expect(periodoTemHoje('mes', '2026-11-01', '2026-11-18')).toBe(true)
  })

  test('agrupa pela data local do encontro, não pela data UTC', () => {
    // 01:00 UTC do dia 22 ainda é 21/11 às 22:00 em São Paulo.
    const mapa = agruparPorDia([resumo({ inicio: '2026-11-22T01:00:00.000Z' })])
    expect([...mapa.keys()]).toEqual(['2026-11-21'])
  })
})

describe('Agenda', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useLocalSearchParams).mockReturnValue({})
    reiniciarRespostas()
    onlineManager.setOnline(true)
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
    await act(async () => usarFonte(2))
  })

  test('lista por dia: um cabeçalho por dia, com o horário à esquerda e o local (D79)', async () => {
    await renderizarTela(<TelaAgenda />, { papel: 'membro', rotas: rotas([E1, E2, E3]) })
    expect(
      await screen.findByRole('header', { name: cabecalhoDoDia(SABADO_DESTA, HOJE, 1) }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('header', { name: cabecalhoDoDia(SABADO_DA_PROXIMA, HOJE, 1) }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('header', { name: cabecalhoDoDia(SABADO_ADIANTE, HOJE, 1) }),
    ).toBeOnTheScreen()
    // O horário (começo e fim) vem na coluna da esquerda e o local abaixo do título; sem a data repetida.
    expect(screen.getAllByText('16:00')).toHaveLength(2)
    expect(screen.getByText('19:30')).toBeOnTheScreen()
    expect(screen.getAllByText('Salão da igreja')).toHaveLength(2)
    expect(screen.getByText('Noite de Louvor')).toBeOnTheScreen()
    // Nada de "Semana", busca nem linha do tempo: a Agenda é uma lista e um calendário em folha.
    expect(screen.queryByRole('radio', { name: 'Lista' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Calendário' })).toBeOnTheScreen()
  })

  test('a linha mostra a parte da pessoa: "Você: Louvor · Vocal" com o chip Confirmado', async () => {
    await renderizarTela(<TelaAgenda />, {
      papel: 'membro',
      rotas: rotas([E1, E2], [escala({ estado: 'confirmada' })]),
    })
    expect(await screen.findByText('Você: Louvor · Vocal')).toBeOnTheScreen()
    expect(screen.getByText('Confirmado')).toBeOnTheScreen()
    // Confirmada: nada de botões de resposta na linha.
    expect(screen.queryByRole('button', { name: 'Aceitar' })).toBeNull()
  })

  test('"Só o que é meu" mostra só os encontros com parte; o vazio oferece "Dias em que posso ajudar"', async () => {
    const usuario = userEvent.setup()
    await renderizarTela(<TelaAgenda />, {
      papel: 'membro',
      rotas: rotas([E1, E2, E3], [escala({ estado: 'confirmada' })]),
    })
    await screen.findByText('Noite de Louvor')
    await usuario.press(screen.getByRole('radio', { name: 'Só o que é meu' }))
    expect(screen.queryByText('Noite de Louvor')).toBeNull()
    expect(screen.getByText('Você: Louvor · Vocal')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('radio', { name: 'Todos' }))
    expect(await screen.findByText('Noite de Louvor')).toBeOnTheScreen()
  })

  test('o link `?filtro=meu` (a antiga aba Escalas) abre direto em "Só o que é meu"', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ filtro: 'meu' })
    await renderizarTela(<TelaAgenda />, { papel: 'membro', rotas: rotas([E1, E2], []) })
    expect(await screen.findByRole('radio', { name: 'Só o que é meu' })).toBeChecked()
    expect(
      await screen.findByText('Você não tem nenhuma parte nos próximos encontros.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Se quiser ajudar, diga em quais dias você pode.')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Dias em que posso ajudar' }))
    // A folha do calendário abre já no modo de marcar os dias.
    expect(await screen.findByRole('switch', { name: /Dias em que posso ajudar/ })).toBeChecked()
  })

  describe('responder direto na linha (D69, sem "tem certeza?")', () => {
    const PENDENTE = escala({ estado: 'pendente' })

    test('pendente: "Aceitar" e "Não posso ir" na linha; aceitar aparece feito e só envia aos 5 s', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await renderizarTela(<TelaAgenda />, {
        papel: 'membro',
        rotas: rotas([E1], [PENDENTE], {
          [`POST ${BASE}/atribuicoes/a1/confirmar`]: () => ({
            status: 200,
            corpo: { estado: 'confirmada' },
          }),
        }),
      })
      expect(await screen.findByText('Aguardando sua resposta')).toBeOnTheScreen()
      expect(screen.getByText('Você: Louvor · Vocal')).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Não posso ir' })).toBeOnTheScreen()

      await usuario.press(screen.getByRole('button', { name: 'Aceitar' }))
      // Na hora: a linha já é "Confirmado" e os botões somem. A API ainda não foi chamada.
      expect(await screen.findByText('Confirmado')).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Aceitar' })).toBeNull()
      expect(haDesfazerPendente()).toBe(true)
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(0)

      // Ao fim dos 5 s (aqui, adiantado), a resposta sai.
      await act(async () => confirmarAgora())
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(1),
      )
    })

    test('Desfazer devolve "Aguardando sua resposta" e nada é enviado', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await renderizarTela(<TelaAgenda />, {
        papel: 'membro',
        rotas: rotas([E1], [PENDENTE]),
      })
      await usuario.press(await screen.findByRole('button', { name: 'Aceitar' }))
      expect(await screen.findByText('Confirmado')).toBeOnTheScreen()
      await act(async () => desfazerAgora())
      expect(await screen.findByText('Aguardando sua resposta')).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Aceitar' })).toBeOnTheScreen()
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(0)
    })

    test('"Não posso ir" não abre diálogo: mostra "Você avisou que não pode." e só envia ao fim', async () => {
      const alerta = jest.spyOn(Alert, 'alert')
      const usuario = userEvent.setup()
      const { servidor } = await renderizarTela(<TelaAgenda />, {
        papel: 'membro',
        rotas: rotas([E1], [PENDENTE], {
          [`POST ${BASE}/atribuicoes/a1/recusar`]: () => ({
            status: 200,
            corpo: { estado: 'recusada' },
          }),
        }),
      })
      await usuario.press(await screen.findByRole('button', { name: 'Não posso ir' }))
      expect(await screen.findByText('Você avisou que não pode.')).toBeOnTheScreen()
      expect(alerta).not.toHaveBeenCalled()
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(0)
      await act(async () => confirmarAgora())
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(1),
      )
      alerta.mockRestore()
    })

    test('o deslizar nunca é o único caminho: o título da linha expõe as ações Aceitar e Não posso ir', async () => {
      await renderizarTela(<TelaAgenda />, { papel: 'membro', rotas: rotas([E1], [PENDENTE]) })
      const linha = await screen.findByTestId('linha-de-resposta')
      const alvo = within(linha).getByRole('button', { name: /Sábado Jovem/ })
      expect(alvo.props.accessibilityActions).toEqual([
        { name: 'aceitar', label: 'Aceitar' },
        { name: 'recusar', label: 'Não posso ir' },
      ])
    })

    test('sem internet, os botões ficam desabilitados com o motivo escrito', async () => {
      await renderizarTela(<TelaAgenda />, { papel: 'membro', rotas: rotas([E1], [PENDENTE]) })
      await screen.findByRole('button', { name: 'Aceitar' })
      await act(async () => onlineManager.setOnline(false))
      expect(await screen.findByRole('button', { name: 'Aceitar' })).toBeDisabled()
      expect(screen.getByText('Precisa de internet para responder.')).toBeOnTheScreen()
      expect(screen.getByText(/^Sem internet\. Você vê a última versão/)).toBeOnTheScreen()
    })

    test('em rascunho a convocação ainda não saiu: a linha não pede resposta', async () => {
      await renderizarTela(<TelaAgenda />, {
        papel: 'organizador',
        rotas: rotas([resumo({ id: 'e1', status: 'rascunho' })], [PENDENTE]),
      })
      expect(await screen.findByText('Você: Louvor · Vocal')).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Aceitar' })).toBeNull()
      // O filtro "Rascunhos" (pílula que se marca, não um falso botão) só existe para a organização e só quando há um.
      expect(screen.getByRole('checkbox', { name: /Rascunhos/ })).toBeOnTheScreen()
    })
  })

  describe('"Pedem ajuda"', () => {
    const PEDIDO = {
      id: 's1',
      pedidaPor: 'Bruno Lima',
      minha: false,
      possoAssumir: true,
      dirigida: false,
      motivo: 'Viagem',
      funcao: 'Projeção',
      evento: { id: 'e2', titulo: 'Sábado Jovem', inicio: E2.inicio },
      etapa: null,
    }

    test('aparece no alto; "Assumir" é um toque, com Desfazer, e só avisa ao fim', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await renderizarTela(<TelaAgenda />, {
        papel: 'membro',
        rotas: rotas([E1, E2], [], {
          [`GET ${BASE}/substituicoes`]: () => ({
            status: 200,
            corpo: { substituicoes: [PEDIDO] },
          }),
          [`POST ${BASE}/substituicoes/s1/assumir`]: () => ({ status: 200, corpo: {} }),
        }),
      })
      expect(await screen.findByRole('header', { name: 'Pedem ajuda (1)' })).toBeOnTheScreen()
      expect(screen.getByText('Motivo: Viagem')).toBeOnTheScreen()
      await usuario.press(screen.getByRole('button', { name: /^Assumir Projeção/ }))
      // A linha some na hora; a API só é chamada aos 5 s.
      await waitFor(() => expect(screen.queryByRole('header', { name: /Pedem ajuda/ })).toBeNull())
      expect(pedidosPara(servidor, 'POST', `${BASE}/substituicoes/s1/assumir`)).toHaveLength(0)
      await act(async () => confirmarAgora())
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${BASE}/substituicoes/s1/assumir`)).toHaveLength(1),
      )
    })

    test('Desfazer traz o pedido de volta e nada é enviado', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await renderizarTela(<TelaAgenda />, {
        papel: 'membro',
        rotas: rotas([E1], [], {
          [`GET ${BASE}/substituicoes`]: () => ({
            status: 200,
            corpo: { substituicoes: [PEDIDO] },
          }),
        }),
      })
      await usuario.press(await screen.findByRole('button', { name: /^Assumir Projeção/ }))
      await act(async () => desfazerAgora())
      expect(await screen.findByRole('header', { name: 'Pedem ajuda (1)' })).toBeOnTheScreen()
      expect(pedidosPara(servidor, 'POST', `${BASE}/substituicoes/s1/assumir`)).toHaveLength(0)
    })
  })

  describe('Calendário em folha', () => {
    beforeEach(async () => {
      await act(async () => usarFonte(1))
    })

    test('"Calendário" abre a folha do mês; tocar num dia leva a lista a ele', async () => {
      const usuario = userEvent.setup()
      await renderizarTela(<TelaAgenda />, { papel: 'membro', rotas: rotas([E1, E2]) })
      await usuario.press(await screen.findByRole('button', { name: 'Calendário' }))
      const dia = await screen.findByRole('button', {
        name: new RegExp(`^${primeiroDiaPorExtenso(SABADO_DESTA)}.*1 encontro`),
      })
      await usuario.press(dia)
      // A folha fecha e a lista fica só com o dia escolhido.
      expect(await screen.findByText(/^Só o dia /)).toBeOnTheScreen()
      await usuario.press(screen.getByRole('button', { name: 'Ver todos' }))
      expect(
        await screen.findByRole('header', {
          name: cabecalhoDoDia(SABADO_DA_PROXIMA, HOJE, 1),
        }),
      ).toBeOnTheScreen()
    })

    test('"Dias em que posso ajudar": tocar num dia marca com check e texto, e grava na hora', async () => {
      const usuario = userEvent.setup()
      // O servidor guarda o que a pessoa marcou: depois de gravar, a lista volta com o dia.
      const gravados: {
        vinculo_id: string
        data: string
        disponivel: boolean
        observacao: null
        nome: string
      }[] = []
      const { servidor } = await renderizarTela(<TelaAgenda />, {
        papel: 'membro',
        rotas: rotas([E1], [], {
          [`GET ${BASE}/disponibilidade`]: () => ({
            status: 200,
            corpo: { disponibilidade: gravados },
          }),
          [`PUT ${BASE}/disponibilidade/${SABADO_DESTA}`]: () => {
            gravados.push({
              vinculo_id: MEU_VINCULO,
              data: SABADO_DESTA,
              disponivel: true,
              observacao: null,
              nome: 'Ana Souza',
            })
            return { status: 200, corpo: {} }
          },
        }),
      })
      await usuario.press(await screen.findByRole('button', { name: 'Calendário' }))
      await usuario.press(await screen.findByRole('switch', { name: /Dias em que posso ajudar/ }))
      const dia = await screen.findByRole('checkbox', {
        name: new RegExp(`^${primeiroDiaPorExtenso(SABADO_DESTA)}`),
      })
      await usuario.press(dia)
      // O texto diz o que foi marcado (a cor nunca é o único sinal).
      expect(await screen.findByText(/^Posso ajudar: /)).toBeOnTheScreen()
      await waitFor(() =>
        expect(
          pedidosPara(servidor, 'PUT', `${BASE}/disponibilidade/${SABADO_DESTA}`)[0]?.corpo,
        ).toEqual({
          disponivel: true,
        }),
      )
    })
  })

  describe('"Novo encontro"', () => {
    test('só para quem cria: a folha oferece "Igual ao último encontro" (recomendado) e as outras saídas', async () => {
      const usuario = userEvent.setup()
      await renderizarTela(<TelaAgenda />, {
        papel: 'organizador',
        rotas: rotas([E1], [], {
          [`GET ${BASE}/eventos/anteriores-para-copiar`]: () => ({
            status: 200,
            corpo: {
              opcoes: [
                {
                  eventoId: 'e0',
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
                },
              ],
            },
          }),
        }),
      })
      await usuario.press(await screen.findByRole('button', { name: 'Novo encontro' }))
      const igual = await screen.findByRole('button', { name: /^Igual ao último encontro/ })
      expect(igual).toBeEnabled()
      expect(screen.getByText('Recomendado')).toBeOnTheScreen()
      // Nenhum roteiro é imposto (D81): não há mais "Encontro padrão" na folha.
      expect(screen.queryByRole('button', { name: /^Encontro padrão/ })).toBeNull()
      expect(screen.getByRole('button', { name: /^Em branco/ })).toBeOnTheScreen()
      await usuario.press(igual)
      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/evento/igual-ao-ultimo'))
    })

    test('sem encontro realizado para copiar, a opção fica desabilitada com o motivo escrito', async () => {
      const usuario = userEvent.setup()
      await renderizarTela(<TelaAgenda />, { papel: 'organizador', rotas: rotas([E1]) })
      await usuario.press(await screen.findByRole('button', { name: 'Novo encontro' }))
      expect(
        await screen.findByText('Ainda não há um encontro realizado para copiar.'),
      ).toBeOnTheScreen()
    })

    test('o membro não vê "Novo encontro"', async () => {
      await renderizarTela(<TelaAgenda />, { papel: 'membro', rotas: rotas([E1]) })
      await screen.findByText('Sábado Jovem')
      expect(screen.queryByRole('button', { name: 'Novo encontro' })).toBeNull()
    })
  })

  describe('abrir e menu da linha', () => {
    test('tocar na linha abre o encontro; segurar abre o menu com o que o "Mais" do encontro tem', async () => {
      const usuario = userEvent.setup()
      await renderizarTela(<TelaAgenda />, { papel: 'organizador', rotas: rotas([E1]) })
      const linha = await screen.findByRole('button', { name: /^Sábado Jovem/ })
      await usuario.press(linha)
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]',
        params: { eventoId: 'e1' },
      })
      await usuario.longPress(linha)
      expect(await screen.findByRole('button', { name: /^Compartilhar/ })).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: /^Copiar este encontro/ })).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: /^Cancelar ou adiar/ })).toBeOnTheScreen()
    })
  })

  describe('estados', () => {
    test('vazio para o membro: texto sem botão', async () => {
      await renderizarTela(<TelaAgenda />, { papel: 'membro', rotas: rotas([]) })
      expect(await screen.findByText('Nenhum encontro marcado.')).toBeOnTheScreen()
      expect(
        screen.getByText('Quando a liderança marcar o próximo, ele aparece aqui.'),
      ).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Novo encontro' })).toBeNull()
    })

    test('vazio para a organização: a ação é o MESMO "Novo encontro" do topo (um caminho só, D75)', async () => {
      await renderizarTela(<TelaAgenda />, { papel: 'organizador', rotas: rotas([]) })
      expect(
        await screen.findByText('Marque o próximo para a comunidade ver e responder.'),
      ).toBeOnTheScreen()
      // Dois botões com o mesmo nome e o mesmo destino: o do topo e o do estado vazio.
      const botoes = screen.getAllByRole('button', { name: 'Novo encontro' })
      expect(botoes).toHaveLength(2)
      const antes = screen.getAllByText('Novo encontro').length
      await userEvent.setup().press(botoes[1]!)
      // Abre a folha "Novo encontro" (a mesma do botão do topo): o título dela passa a existir.
      await waitFor(() =>
        expect(screen.getAllByText('Novo encontro').length).toBeGreaterThan(antes),
      )
    })

    test('erro: texto humano e "Tentar de novo" que recarrega', async () => {
      let tentativas = 0
      await renderizarTela(<TelaAgenda />, {
        papel: 'membro',
        rotas: rotas([E1], [], {
          [`GET ${BASE}/eventos`]: () => {
            tentativas += 1
            return tentativas === 1
              ? {
                  status: 500,
                  corpo: { erro: 'erro_interno', mensagem: 'Tente de novo em instantes.' },
                }
              : { status: 200, corpo: { eventos: [E1] } }
          },
        }),
      })
      expect(await screen.findByText('Não deu para carregar a agenda')).toBeOnTheScreen()
      await userEvent.setup().press(screen.getByRole('button', { name: 'Tentar de novo' }))
      expect(
        await screen.findByRole('header', { name: cabecalhoDoDia(SABADO_DESTA, HOJE, 1) }),
      ).toBeOnTheScreen()
    })

    test('encontro cancelado e adiado aparecem com a palavra, não só a cor', async () => {
      await renderizarTela(<TelaAgenda />, {
        papel: 'membro',
        rotas: rotas([
          resumo({ id: 'e1', status: 'cancelado' }),
          resumo({ id: 'e2', status: 'adiado', inicio: E2.inicio }),
        ]),
      })
      expect(await screen.findByText('Cancelado')).toBeOnTheScreen()
      expect(screen.getByText('Adiado')).toBeOnTheScreen()
    })

    test('"Ver encontros passados" carrega e mostra os últimos meses', async () => {
      const usuario = userEvent.setup()
      await renderizarTela(<TelaAgenda />, {
        papel: 'membro',
        rotas: rotas([E1], [], {}),
      })
      await usuario.press(await screen.findByRole('button', { name: 'Ver encontros passados' }))
      expect(await screen.findByRole('header', { name: 'Encontros passados' })).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Esconder encontros passados' })).toBeOnTheScreen()
    })
  })
})

/** "sábado, 28 de novembro de 2026": o começo do rótulo de acessibilidade de cada dia. */
function primeiroDiaPorExtenso(dia: string): string {
  const nomes = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
  ]
  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number]
  const semana = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return `${nomes[semana]}, ${d} de ${meses[m - 1]} de ${a}`
}
