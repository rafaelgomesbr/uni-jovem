/**
 * D69: o Encontro. Para o membro, UMA página ("Sua parte" no alto, quando e onde, roteiro enxuto,
 * quem serve, inscrição). Para a organização, três abas (Resumo, Roteiro, Convocados), o menu
 * "Mais" em grupos e o botão principal do momento na barra (publicar na hora, lembrar, check-in,
 * ao vivo, marcar o próximo encontro). D78: o Roteiro é um acordeão por etapa, com edição ali mesmo.
 */
import { act, fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { router } from 'expo-router'
import { AccessibilityInfo, Share } from 'react-native'

import { ETAPAS, EVENTO_ID, eventoDeTeste, minutos } from '@/testes/fixturas'
import { BASE, COMUNIDADE, MEU_VINCULO, PESSOAS, pedidosPara, renderizarTela } from '@/testes/telas'
import { confirmar } from '@/utilidades/confirmar'
import { HospedeiroDeToast, mostrarToast } from '@/ui/Toast'
import { confirmarAgora, desfazerAgora, reiniciarDesfazer } from '@/ui/ToastComDesfazer'

import { reiniciarRespostas } from '../../escalas/respostasOtimistas'
import { DetalheDoEvento } from '../DetalheDoEvento'

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
// O diálogo de confirmação: o teste lê o que ele pergunta e responde.
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`

function montar(
  papel: 'organizador' | 'membro',
  rotasExtras = {},
  evento = eventoDeTeste(),
  props: { editarInicial?: boolean } = {},
) {
  return renderizarTela(
    <>
      <DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} {...props} />
      <HospedeiroDeToast />
    </>,
    {
      papel,
      rotas: {
        [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: evento }),
        [`GET ${CAMINHO}/inscricoes`]: () => ({
          status: 200,
          corpo: { contagem: { confirmadas: 12, espera: 0, presentes: 0 }, inscricoes: [] },
        }),
        [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas: [] } }),
        ...rotasExtras,
      },
    },
  )
}

const MINHA_PARTE = {
  id: 'atr-eu',
  etapaId: ETAPAS[1],
  vinculoId: MEU_VINCULO,
  funcao: 'violão',
  estado: 'pendente' as const,
  nome: 'Ana Souza',
}

describe('Encontro: a organização', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    reiniciarRespostas()
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
    reiniciarDesfazer()
  })

  test('três abas no lugar de quatro: Resumo, Roteiro e Quem vai', async () => {
    await montar('organizador')
    expect(await screen.findByRole('radio', { name: 'Resumo' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Roteiro' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Quem vai' })).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'Convocados' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Visão geral' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Preparação' })).toBeNull()
  })

  test('Resumo: quando e onde, a linha do Quem vai, as inscrições e a Preparação dobrada', async () => {
    const usuario = userEvent.setup()
    await montar('organizador')
    expect(await screen.findByText('Quando e onde')).toBeOnTheScreen()
    expect(screen.getByText('Local a definir')).toBeOnTheScreen()
    // Bruno aceitou: "Todos responderam." uma vez só (sem "1 de 1 responderam" antes), e a linha leva ao Quem vai.
    expect(screen.getByText(/^Todos responderam\./)).toBeOnTheScreen()
    expect(screen.queryByText(/1 de 1 responderam/)).toBeNull()
    expect(await screen.findByText('Inscrições: 12 de 20')).toBeOnTheScreen()
    // A Preparação é uma linha fechada com o resumo; abrir mostra as tarefas.
    expect(screen.getByText('2 tarefas')).toBeOnTheScreen()
    expect(screen.queryByText('Testar o som')).toBeNull()
    await usuario.press(screen.getByRole('button', { name: /^Preparação/ }))
    expect(await screen.findByRole('checkbox', { name: 'Testar o som' })).toBeOnTheScreen()
  })

  test('Resumo: "Como chegar" não aparece sem endereço; tocar em Quem vai abre a aba', async () => {
    const usuario = userEvent.setup()
    await montar('organizador')
    await screen.findByText('Quando e onde')
    expect(screen.queryByRole('button', { name: /^Como chegar/ })).toBeNull()
    await usuario.press(screen.getByRole('button', { name: /^Quem vai\./ }))
    expect(await screen.findByRole('radio', { name: 'Quem vai' })).toBeChecked()
  })

  test('Roteiro: etapas com hora e quem cuida, lidas por inteiro pelo leitor de tela', async () => {
    await montar('organizador')
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Roteiro' }))
    expect(
      await screen.findByLabelText(
        'Etapa 2 de 3: Louvor. Das 16:05 a 16:20, 15 min. Com Bruno Lima (responsável). Recolhida, toque para ver.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByText('15 min · Com Bruno')).toBeOnTheScreen()
    expect(screen.getByText('Total 30 min de 30 min previstos')).toBeOnTheScreen()
  })

  test('Roteiro: cada etapa é um acordeão e nada leva a outra tela (D78)', async () => {
    const usuario = userEvent.setup()
    await montar('organizador')
    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    // Recolhida: sem campos nem botões da etapa.
    expect(screen.queryByRole('button', { name: 'Remover a etapa Louvor' })).toBeNull()
    await usuario.press(await screen.findByRole('button', { name: /^Etapa 2 de 3: Louvor/ }))
    expect(await screen.findByText('Quem cuida')).toBeOnTheScreen()
    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Remover a etapa Louvor' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Chamar alguém para Louvor' })).toBeOnTheScreen()
    // Aberta ou fechada, tocar numa etapa nunca navega.
    expect(router.push).not.toHaveBeenCalled()
  })

  test('Roteiro: muda o nome e a duração ali mesmo e "Salvar etapa" manda só isso', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar('organizador', {
      [`PATCH ${CAMINHO}/etapas/${ETAPAS[0]}`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    await usuario.press(await screen.findByRole('button', { name: /^Etapa 1 de 3: Boas-vindas/ }))
    const salvar = await screen.findByRole('button', { name: 'Salvar a etapa Boas-vindas' })
    // Nada mudou: o botão espera.
    expect(salvar).toBeDisabled()
    const nome = screen.getByLabelText('Nome da etapa')
    await usuario.clear(nome)
    await usuario.type(nome, 'Acolhida')
    const duracao = screen.getByLabelText('Duração')
    await usuario.clear(duracao)
    await usuario.type(duracao, '8')
    await usuario.press(screen.getByRole('button', { name: 'Salvar a etapa Boas-vindas' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PATCH', `${CAMINHO}/etapas/${ETAPAS[0]}`)[0]?.corpo).toEqual({
        versao: 1,
        titulo: 'Acolhida',
        duracaoMin: 8,
        descricao: null,
      }),
    )
  })

  test('Roteiro: "Remover etapa" é um botão com texto, pergunta e apaga', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar('organizador', {
      [`DELETE ${CAMINHO}/etapas/${ETAPAS[2]}`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    await usuario.press(await screen.findByRole('button', { name: /^Etapa 3 de 3: Encerramento/ }))
    await usuario.press(await screen.findByRole('button', { name: 'Remover a etapa Encerramento' }))
    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Remover a etapa Encerramento?',
        confirmar: 'Remover etapa',
        destrutivo: true,
      }),
    )
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/etapas/${ETAPAS[2]}`)).toHaveLength(1),
    )
  })

  test('Roteiro: "Chamar alguém" abre a folha de convocar na própria tela', async () => {
    const usuario = userEvent.setup()
    await montar('organizador')
    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    await usuario.press(await screen.findByRole('button', { name: /^Etapa 1 de 3: Boas-vindas/ }))
    await usuario.press(
      await screen.findByRole('button', { name: 'Chamar alguém para Boas-vindas' }),
    )
    expect(await screen.findByText(/^Convocar/)).toBeOnTheScreen()
    expect(router.push).not.toHaveBeenCalled()
  })

  test('o link do Início ("Convocar bateria") abre a folha JÁ na função e uma vez só', async () => {
    const usuario = userEvent.setup()
    await renderizarTela(
      <DetalheDoEvento
        comunidadeId={COMUNIDADE}
        eventoId={EVENTO_ID}
        abaInicial="convocados"
        convocarInicial={{ funcao: 'Bateria', bloco: 'louvor' }}
      />,
      {
        papel: 'organizador',
        rotas: {
          [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }),
          [`GET ${CAMINHO}/inscricoes`]: () => ({
            status: 200,
            corpo: { contagem: { confirmadas: 0, espera: 0, presentes: 0 }, inscricoes: [] },
          }),
          [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas: [] } }),
          [`GET ${CAMINHO}/sugestoes-de-convocacao`]: () => ({
            status: 200,
            corpo: {
              funcao: 'Bateria',
              data: '2026-11-28',
              sugeridas: [],
              indisponiveis: [],
              jaConvocadas: [],
            },
          }),
        },
      },
    )
    expect(await screen.findByText('Convocar para Bateria')).toBeOnTheScreen()
    // Fechar e trocar de aba e voltar não reabre a folha.
    await usuario.press(screen.getByRole('button', { name: 'Fechar' }))
    await usuario.press(screen.getByRole('radio', { name: 'Resumo' }))
    await usuario.press(await screen.findByRole('radio', { name: 'Quem vai' }))
    await waitFor(() => expect(screen.queryByText('Convocar para Bateria')).toBeNull())
  })

  test('Roteiro: reordena por botão ("Descer Boas-vindas" manda a ordem nova)', async () => {
    const { servidor } = await montar('organizador', {
      [`PUT ${CAMINHO}/etapas/ordem`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    // Recolhida, a ordem não se mexe por engano; abrir a etapa mostra Subir e Descer.
    expect(screen.queryByRole('button', { name: 'Descer Boas-vindas' })).toBeNull()
    await usuario.press(await screen.findByRole('button', { name: /^Etapa 1 de 3: Boas-vindas/ }))
    await usuario.press(await screen.findByRole('button', { name: 'Descer Boas-vindas' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PUT', `${CAMINHO}/etapas/ordem`)[0]?.corpo).toEqual({
        ids: [ETAPAS[1], ETAPAS[0], ETAPAS[2]],
      }),
    )
  })

  test('roteiro vazio (o encontro novo nasce sem etapas): duas portas, "Começar do zero" e "Usar um modelo" (D81)', async () => {
    const usuario = userEvent.setup()
    await montar('organizador', {}, eventoDeTeste({ etapas: [], atribuicoes: [] }))
    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    expect(await screen.findByText('Monte o roteiro do dia')).toBeOnTheScreen()
    // Nenhum formato é presumido: nada de etapas prontas na tela.
    expect(screen.queryByText('Boas-vindas')).toBeNull()
    expect(screen.getByRole('button', { name: 'Usar um modelo' })).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Começar do zero' }))
    expect(await screen.findByText('Adicionar etapa')).toBeOnTheScreen()
  })

  test('"Usar um modelo" lista os modelos e monta o roteiro só depois de a pessoa escolher', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar(
      'organizador',
      { [`POST ${CAMINHO}/etapas/modelo`]: () => ({ status: 200, corpo: { etapas: 3 } }) },
      eventoDeTeste({ etapas: [], atribuicoes: [] }),
    )
    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    await usuario.press(await screen.findByRole('button', { name: 'Usar um modelo' }))
    expect(await screen.findByRole('button', { name: /^Encontro completo/ })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Reunião curta/ })).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/etapas/modelo`)).toHaveLength(0)
    await usuario.press(screen.getByRole('button', { name: /^Só louvor/ }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/etapas/modelo`)[0]?.corpo).toEqual({
        modelo: 'so_louvor',
      }),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Roteiro montado: Só louvor. Ajuste as etapas como quiser.',
      }),
    )
  })

  test('roteiro vazio, para o membro: a frase diz o que houve, sem ação', async () => {
    await montar('membro', {}, eventoDeTeste({ etapas: [], atribuicoes: [] }))
    expect(await screen.findByText('O roteiro ainda não foi montado.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Usar um modelo' })).toBeNull()
  })

  test('publicado e longe, sem ninguém para lembrar: o primário é Editar e as "Outras coisas" estão à vista, sem "Mais"', async () => {
    const usuario = userEvent.setup()
    await montar('organizador')
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeOnTheScreen()
    // Nada escondido atrás de um "Mais" (D74): as ações são linhas do Resumo, cada uma com texto.
    expect(screen.queryByRole('button', { name: 'Mais ações' })).toBeNull()
    expect(screen.queryByText('Mais')).toBeNull()
    expect(screen.getByText('Outras coisas')).toBeOnTheScreen()
    expect(await screen.findByRole('button', { name: /^Copiar este encontro/ })).toBeOnTheScreen()
    expect(screen.getAllByRole('button', { name: /^Compartilhar/ }).length).toBeGreaterThan(0)
    expect(screen.getByText('Cuidado')).toBeOnTheScreen()
    // As inscrições têm um caminho só: a linha do Resumo.
    expect(screen.getAllByText(/^Inscrições/)).toHaveLength(1)
    // "Duplicar" e "Série" saíram do vocabulário.
    expect(screen.queryByRole('button', { name: /^Duplicar/ })).toBeNull()
    await usuario.press(screen.getByRole('button', { name: /^Cancelar ou adiar/ }))
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]/status',
        // Sem escolha de partida: a tela mostra "Adiar" e "Cancelar" lado a lado (D74).
        params: { eventoId: EVENTO_ID },
      }),
    )
  })

  describe('Dados do encontro (editar dentro do encontro)', () => {
    const ROTAS_DA_EDICAO = {
      [`GET ${BASE}/locais`]: () => ({ status: 200, corpo: { locais: [] } }),
      [`PATCH ${CAMINHO}`]: () => ({ status: 200, corpo: { id: EVENTO_ID, versao: 4 } }),
    }
    const CABECALHO = /^Dados do encontro: .+ · Local a definir\. Recolhido/

    test('é o primeiro bloco do Resumo: fechado, com o resumo de uma linha e o "Editar" escrito', async () => {
      await montar('organizador', ROTAS_DA_EDICAO)
      const cabecalho = await screen.findByRole('button', { name: CABECALHO })
      expect(within(cabecalho).getByText('Editar')).toBeOnTheScreen()
      expect(within(cabecalho).getByText(/· Local a definir$/)).toBeOnTheScreen()
      // Fechado: nenhum campo do formulário à vista.
      expect(screen.queryByLabelText('Título')).toBeNull()
    })

    test('tocar abre o formulário; tocar de novo recolhe', async () => {
      const usuario = userEvent.setup()
      await montar('organizador', ROTAS_DA_EDICAO)
      await usuario.press(await screen.findByRole('button', { name: CABECALHO }))
      expect(await screen.findByLabelText('Título')).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeOnTheScreen()
      await usuario.press(screen.getByRole('button', { name: /^Dados do encontro\. Aberto/ }))
      await waitFor(() => expect(screen.queryByLabelText('Título')).toBeNull())
    })

    test('com `editarInicial` (o "Editar" do Início) já vem aberto', async () => {
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste(), { editarInicial: true })
      expect(await screen.findByLabelText('Título')).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: /^Dados do encontro\. Aberto/ })).toBeOnTheScreen()
    })

    test('ao abrir, o foco do leitor de tela vai para o cabeçalho da seção', async () => {
      const focar = jest
        .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
        .mockImplementation(() => {})
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste(), { editarInicial: true })
      await screen.findByLabelText('Título')
      await waitFor(() => expect(focar).toHaveBeenCalledWith(expect.anything(), 'focus'))
      focar.mockRestore()
    })

    test('o "Editar" da barra abre a seção em vez de empilhar outra tela', async () => {
      const usuario = userEvent.setup()
      await montar('organizador', ROTAS_DA_EDICAO)
      await usuario.press(await screen.findByRole('button', { name: 'Editar' }))
      expect(await screen.findByLabelText('Título')).toBeOnTheScreen()
      expect(router.push).not.toHaveBeenCalled()
      // Aberta a seção, a barra não repete "Editar" (nem sobra um segundo em "Outras coisas").
      expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    })

    test('aberta, a seção não repete "Quando e onde" nem "O essencial": só os campos, e tem "Cancelar"', async () => {
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste(), { editarInicial: true })
      expect(await screen.findByLabelText('Título')).toBeOnTheScreen()
      expect(screen.queryByText('Quando e onde')).toBeNull()
      expect(screen.queryByText('O essencial')).toBeNull()
      expect(screen.queryByText('Onde')).toBeNull()
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeOnTheScreen()
      // O cabeçalho aberto diz só o nome da seção (o resumo de uma linha é do estado fechado).
      expect(screen.queryByText(/· Local a definir$/)).toBeNull()
    })

    test('"Cancelar" recolhe; com algo digitado pergunta antes, e dizer não mantém o texto', async () => {
      const usuario = userEvent.setup()
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste(), { editarInicial: true })
      await screen.findByLabelText('Título')
      // Limpo: recolhe direto, sem pergunta.
      await usuario.press(screen.getByRole('button', { name: 'Cancelar' }))
      await waitFor(() => expect(screen.queryByLabelText('Título')).toBeNull())
      expect(confirmar).not.toHaveBeenCalled()

      await usuario.press(await screen.findByRole('button', { name: CABECALHO }))
      await fireEvent.changeText(await screen.findByLabelText('Título'), 'Sábado especial')
      ;(confirmar as jest.Mock).mockResolvedValueOnce(false)
      await usuario.press(screen.getByRole('button', { name: 'Cancelar' }))
      expect(confirmar).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: 'Descartar o que você escreveu?' }),
      )
      expect(screen.getByDisplayValue('Sábado especial')).toBeOnTheScreen()
      // Confirmando, recolhe e o que foi digitado some: reabrir mostra o título de verdade.
      await usuario.press(screen.getByRole('button', { name: 'Cancelar' }))
      await waitFor(() => expect(screen.queryByLabelText('Título')).toBeNull())
      await usuario.press(await screen.findByRole('button', { name: CABECALHO }))
      expect(await screen.findByDisplayValue('Sábado com a juventude')).toBeOnTheScreen()
    })

    test('trocar de aba com algo digitado pergunta; recusando fica, confirmando o texto some', async () => {
      const usuario = userEvent.setup()
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste(), { editarInicial: true })
      await fireEvent.changeText(await screen.findByLabelText('Título'), 'Sábado especial')
      ;(confirmar as jest.Mock).mockResolvedValueOnce(false)
      await usuario.press(screen.getByRole('radio', { name: 'Roteiro' }))
      expect(confirmar).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: 'Descartar o que você escreveu?' }),
      )
      expect(screen.getByRole('radio', { name: 'Resumo' })).toBeChecked()
      expect(screen.getByDisplayValue('Sábado especial')).toBeOnTheScreen()

      await usuario.press(screen.getByRole('radio', { name: 'Roteiro' }))
      expect(await screen.findByRole('radio', { name: 'Roteiro' })).toBeChecked()
      await usuario.press(screen.getByRole('radio', { name: 'Resumo' }))
      // Voltou ao Resumo: a seção está recolhida e o que se digitou não existe mais.
      expect(await screen.findByRole('button', { name: CABECALHO })).toBeOnTheScreen()
      expect(screen.queryByDisplayValue('Sábado especial')).toBeNull()
      await usuario.press(screen.getByRole('button', { name: CABECALHO }))
      expect(await screen.findByDisplayValue('Sábado com a juventude')).toBeOnTheScreen()
    })

    test('recarga do encontro com a seção aberta e limpa: o formulário parte da versão nova e o primeiro salvar não dá conflito', async () => {
      const usuario = userEvent.setup()
      let versao = 3
      const { servidor, consultas } = await montar(
        'organizador',
        {
          ...ROTAS_DA_EDICAO,
          [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste({ versao }) }),
        },
        eventoDeTeste(),
        { editarInicial: true },
      )
      await screen.findByLabelText('Título')
      // Outra tela ou pessoa mexeu no encontro e o detalhe recarregou, sem nada digitado aqui.
      versao = 4
      await act(async () => {
        await consultas.invalidateQueries()
      })
      await waitFor(() => expect(pedidosPara(servidor, 'GET', CAMINHO).length).toBeGreaterThan(1))
      await act(async () => undefined)
      await fireEvent.changeText(screen.getByLabelText('Título'), 'Sábado especial')
      await usuario.press(screen.getByRole('button', { name: 'Salvar alterações' }))
      await waitFor(() => expect(pedidosPara(servidor, 'PATCH', CAMINHO)).toHaveLength(1))
      expect(pedidosPara(servidor, 'PATCH', CAMINHO)[0]?.corpo).toEqual({
        versao: 4,
        titulo: 'Sábado especial',
      })
      expect(screen.queryByText('Conflito de edição')).toBeNull()
    })

    test('com algo por salvar, "Publicar e avisar" fica desabilitado e diz por quê; limpo, funciona', async () => {
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste({ status: 'rascunho' }), {
        editarInicial: true,
      })
      const titulo = await screen.findByLabelText('Título')
      expect(screen.getByRole('button', { name: 'Publicar e avisar 1 pessoa' })).toBeEnabled()
      expect(screen.queryByText('Salve ou descarte as alterações primeiro.')).toBeNull()

      await fireEvent.changeText(titulo, 'Sábado especial')
      expect(screen.getByRole('button', { name: 'Publicar e avisar 1 pessoa' })).toBeDisabled()
      expect(screen.getByText('Salve ou descarte as alterações primeiro.')).toBeOnTheScreen()

      // Voltando ao texto original, nada mais está por salvar: publicar volta a valer.
      await fireEvent.changeText(titulo, 'Sábado com a juventude')
      expect(screen.getByRole('button', { name: 'Publicar e avisar 1 pessoa' })).toBeEnabled()
    })

    test('"Editar" em "Outras coisas" só existe com o encontro vivo (não em cancelado nem encerrado)', async () => {
      const amanha = new Date(Date.now() + 26 * 3_600_000).toISOString()
      const { unmount } = await montar(
        'organizador',
        ROTAS_DA_EDICAO,
        eventoDeTeste({ inicio: amanha }),
      )
      // Véspera: o primário da barra é "Ver quem vai", então "Editar" mora em "Outras coisas".
      await screen.findByText('Outras coisas')
      expect(screen.getByRole('button', { name: 'Editar' })).toBeOnTheScreen()
      await unmount()
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste({ status: 'cancelado' }))
      await screen.findByText('Outras coisas')
      expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
      await unmount()
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste({ status: 'encerrado' }))
      await screen.findByText('Outras coisas')
      expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    })

    test('salvar manda só o que mudou, mostra o toast e recolhe a seção', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste(), {
        editarInicial: true,
      })
      await fireEvent.changeText(await screen.findByLabelText('Título'), 'Sábado especial')
      await usuario.press(screen.getByRole('button', { name: 'Salvar alterações' }))
      await waitFor(() => expect(pedidosPara(servidor, 'PATCH', CAMINHO)).toHaveLength(1))
      expect(pedidosPara(servidor, 'PATCH', CAMINHO)[0]?.corpo).toEqual({
        versao: 3,
        titulo: 'Sábado especial',
      })
      await waitFor(() =>
        expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Alterações salvas.' }),
      )
      await waitFor(() => expect(screen.queryByLabelText('Título')).toBeNull())
      expect(screen.getByRole('button', { name: CABECALHO })).toBeOnTheScreen()
    })

    test('recolher com algo digitado pergunta antes; dizer não mantém o que foi escrito', async () => {
      const usuario = userEvent.setup()
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste(), { editarInicial: true })
      await fireEvent.changeText(await screen.findByLabelText('Título'), 'Sábado especial')
      ;(confirmar as jest.Mock).mockResolvedValueOnce(false)
      await usuario.press(screen.getByRole('button', { name: /^Dados do encontro\. Aberto/ }))
      expect(confirmar).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: 'Descartar o que você escreveu?' }),
      )
      expect(screen.getByDisplayValue('Sábado especial')).toBeOnTheScreen()
    })

    test('quem só participa, e o encontro cancelado, não têm a seção', async () => {
      const { unmount } = await montar('membro', ROTAS_DA_EDICAO)
      await screen.findByText('Quando e onde')
      expect(screen.queryByRole('button', { name: /^Dados do encontro/ })).toBeNull()
      await unmount()
      await montar('organizador', ROTAS_DA_EDICAO, eventoDeTeste({ status: 'cancelado' }))
      await screen.findByText('Quando e onde')
      expect(screen.queryByRole('button', { name: /^Dados do encontro/ })).toBeNull()
    })
  })

  test('"Copiar este encontro" leva à conferência do "Igual ao último sábado"', async () => {
    const usuario = userEvent.setup()
    await montar('organizador')
    await usuario.press(await screen.findByRole('button', { name: /^Copiar este encontro/ }))
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/igual-ao-ultimo',
        params: { origem: EVENTO_ID },
      }),
    )
  })

  describe('publicar', () => {
    const RASCUNHO = () => eventoDeTeste({ status: 'rascunho' })

    test('o primário diz quem será avisado; publicar vai na hora, sem Desfazer nem contagem (D81)', async () => {
      const usuario = userEvent.setup()
      // O servidor guarda o que foi feito: depois de publicar, o encontro volta publicado.
      let publicado = false
      const { servidor } = await montar(
        'organizador',
        {
          [`GET ${CAMINHO}`]: () => ({
            status: 200,
            corpo: eventoDeTeste({ status: publicado ? 'publicado' : 'rascunho' }),
          }),
          [`POST ${CAMINHO}/status`]: () => {
            publicado = true
            return { status: 200, corpo: { ok: true } }
          },
        },
        RASCUNHO(),
      )
      await usuario.press(await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }))
      // Sem "tem certeza?": nenhum diálogo; sem faixa nem botão de Desfazer.
      expect(confirmar).not.toHaveBeenCalled()
      expect(screen.queryByText('Publicando e avisando 1 pessoa.')).toBeNull()
      expect(screen.queryByRole('button', { name: /Desfazer/ })).toBeNull()
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)[0]?.corpo).toEqual({
          status: 'publicado',
        }),
      )
      // O fim diz o que houve e aponta a saída para quem errou: "Cancelar ou adiar".
      await waitFor(() =>
        expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Publicado. 1 pessoa foi avisada.' }),
      )
      expect(
        await screen.findByText(
          'Publicado. 1 pessoa foi avisada. Mudou de ideia? Use "Cancelar ou adiar".',
        ),
      ).toBeOnTheScreen()
    })

    test('enquanto a resposta viaja, o botão e o cabeçalho dizem "Publicando..."', async () => {
      const usuario = userEvent.setup()
      let liberar: () => void = () => undefined
      const espera = new Promise<void>((resolver) => {
        liberar = resolver
      })
      await montar(
        'organizador',
        {
          [`POST ${CAMINHO}/status`]: async () => {
            await espera
            return { status: 200, corpo: { ok: true } }
          },
        },
        RASCUNHO(),
      )
      await usuario.press(await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }))
      expect(await screen.findByRole('button', { name: 'Publicando...' })).toBeOnTheScreen()
      // O botão e o cabeçalho dizem a mesma coisa.
      expect(screen.getAllByText('Publicando...').length).toBeGreaterThanOrEqual(2)
      expect(screen.queryByText('Rascunho')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Publicado' })).toBeNull()
      await act(async () => liberar())
      await waitFor(() => expect(mostrarToast).toHaveBeenCalled())
    })

    test('o servidor recusa: nada foi enviado, a tela diz que não deu e o botão volta', async () => {
      const usuario = userEvent.setup()
      await montar(
        'organizador',
        {
          [`POST ${CAMINHO}/status`]: () => ({
            status: 409,
            corpo: { erro: 'transicao_invalida', mensagem: 'Não dá.' },
          }),
        },
        RASCUNHO(),
      )
      await usuario.press(await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }))
      expect(await screen.findByText('Não deu para publicar')).toBeOnTheScreen()
      expect(mostrarToast).not.toHaveBeenCalled()
      expect(
        await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }),
      ).toBeEnabled()
    })

    test('sem ninguém convocado o botão é só "Publicar"', async () => {
      await montar('organizador', {}, eventoDeTeste({ status: 'rascunho', atribuicoes: [] }))
      expect(await screen.findByRole('button', { name: 'Publicar' })).toBeOnTheScreen()
    })

    test('data no passado: é a única pergunta que resta, antes de publicar', async () => {
      const ontem = new Date(Date.now() - 86_400_000).toISOString()
      const { servidor } = await montar(
        'organizador',
        { [`POST ${CAMINHO}/status`]: () => ({ status: 200, corpo: { ok: true } }) },
        eventoDeTeste({ status: 'rascunho', inicio: ontem }),
      )
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }))
      await waitFor(() =>
        expect(confirmar).toHaveBeenCalledWith(
          expect.objectContaining({
            titulo: 'Esta data já passou',
            confirmar: 'Publicar mesmo assim',
          }),
        ),
      )
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)[0]?.corpo).toEqual({
          status: 'publicado',
        }),
      )
    })
  })

  describe('o botão principal muda com a hora', () => {
    test('quem não respondeu: "Lembrar o 1", com Desfazer, e depois "Lembrete enviado"', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await montar(
        'organizador',
        {
          [`POST ${CAMINHO}/lembrar-pendentes`]: () => ({
            status: 200,
            corpo: { pendentes: 1, lembradas: 1, jaLembradas: 0 },
          }),
        },
        eventoDeTeste({
          atribuicoes: [
            {
              id: 'atr-9',
              etapaId: ETAPAS[1],
              vinculoId: PESSOAS[2]!.vinculoId,
              funcao: 'bateria',
              estado: 'pendente',
              nome: 'Carla Dias',
            },
          ],
        }),
      )
      await usuario.press(await screen.findByRole('button', { name: 'Lembrar o 1' }))
      expect(
        await screen.findByText('Lembrando 1 pessoa que ainda não respondeu.'),
      ).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Enviando em 5 s' })).toBeDisabled()
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/lembrar-pendentes`)).toHaveLength(0)
      await act(async () => confirmarAgora())
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/lembrar-pendentes`)).toHaveLength(1),
      )
      expect(await screen.findByRole('button', { name: 'Lembrete enviado' })).toBeOnTheScreen()
    })

    test('a véspera: "Ver quem vai" abre a aba', async () => {
      const amanha = new Date(Date.now() + 26 * 3_600_000).toISOString()
      await montar('organizador', {}, eventoDeTeste({ inicio: amanha }))
      await userEvent.setup().press(await screen.findByRole('button', { name: 'Ver quem vai' }))
      expect(await screen.findByRole('radio', { name: 'Quem vai' })).toBeChecked()
    })

    test('até 2 h antes: "Marcar quem chegou" é o primário e "Abrir ao vivo" o secundário', async () => {
      const daqui1h = new Date(Date.now() + 3_600_000).toISOString()
      await montar('organizador', {}, eventoDeTeste({ inicio: daqui1h }))
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByRole('button', { name: 'Marcar quem chegou' }))
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]/checkin',
        params: { eventoId: EVENTO_ID },
      })
      expect(screen.getByRole('button', { name: 'Abrir ao vivo' })).toBeOnTheScreen()
      // Dentro do período do check-in, a linha também está no Resumo.
      expect(
        screen.getAllByRole('button', { name: /^Marcar quem chegou/ }).length,
      ).toBeGreaterThanOrEqual(2)
    })

    test('acontecendo: "Conduzir ao vivo" é o primário e o check-in fica ao lado', async () => {
      const agora = new Date(Date.now() - 60_000).toISOString()
      await montar('organizador', {}, eventoDeTeste({ inicio: agora }))
      await userEvent.setup().press(await screen.findByRole('button', { name: 'Conduzir ao vivo' }))
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]/ao-vivo',
        params: { eventoId: EVENTO_ID },
      })
      expect(screen.getByRole('button', { name: 'Marcar quem chegou' })).toBeOnTheScreen()
    })

    test('terminou: "Marcar o próximo encontro" abre o encontro do zero', async () => {
      const ontem = new Date(Date.now() - 86_400_000).toISOString()
      await montar('organizador', {}, eventoDeTeste({ inicio: ontem }))
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Marcar o próximo encontro' }))
      expect(router.push).toHaveBeenCalledWith('/evento/novo')
    })
  })
})

describe('Encontro: o membro', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    reiniciarRespostas()
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
  })

  test('uma página só, sem abas, barra de ação nem controles de organização', async () => {
    await montar('membro')
    expect(await screen.findByText('Quando e onde')).toBeOnTheScreen()
    expect(screen.getByText('Roteiro')).toBeOnTheScreen()
    expect(screen.getByText('Boas-vindas')).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'Resumo' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Convocados' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mais ações' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Inscrições/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Check-in/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Adicionar etapa' })).toBeNull()
    // Sem parte, "Sua parte" nem existe.
    expect(screen.queryByText('Sua parte')).toBeNull()
  })

  test('a Preparação aparece na página, com a tarefa própria habilitada e a alheia com o motivo', async () => {
    await montar('membro')
    expect(await screen.findByRole('checkbox', { name: 'Testar o som' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Comprar o lanche' })).toBeDisabled()
    expect(screen.queryByText('Notas internas')).toBeNull()
  })

  test('roteiro enxuto: três linhas e "Ver tudo, 7 etapas"', async () => {
    const sete = Array.from({ length: 7 }, (_, i) => ({
      id: `44444444-4444-4444-8444-0000000001${i}0`,
      ordem: i,
      titulo: `Etapa ${i + 1}`,
      descricao: null,
      duracaoMin: 5,
      versao: 1,
      inicioPrevisto: minutos(i * 5),
      fimPrevisto: minutos(i * 5 + 5),
    }))
    const usuario = userEvent.setup()
    await montar('membro', {}, eventoDeTeste({ etapas: sete, atribuicoes: [] }))
    expect(await screen.findByText('Etapa 3')).toBeOnTheScreen()
    expect(screen.queryByText('Etapa 4')).toBeNull()
    await usuario.press(screen.getByRole('button', { name: 'Ver tudo, 7 etapas' }))
    expect(await screen.findByText('Etapa 7')).toBeOnTheScreen()
  })

  test('sem roteiro: "O roteiro ainda não foi montado."', async () => {
    await montar('membro', {}, eventoDeTeste({ etapas: [], atribuicoes: [] }))
    expect(await screen.findByText('O roteiro ainda não foi montado.')).toBeOnTheScreen()
  })

  test('"Sua parte" pendente: Aceitar e Não posso ir ali mesmo; aceitar tem Desfazer e só envia ao fim', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar(
      'membro',
      { [`POST ${BASE}/atribuicoes/atr-eu/confirmar`]: () => ({ status: 200, corpo: {} }) },
      eventoDeTeste({ atribuicoes: [MINHA_PARTE] }),
    )
    expect(await screen.findByText('Sua parte')).toBeOnTheScreen()
    expect(screen.getByText('Louvor · Violão')).toBeOnTheScreen()
    expect(screen.getByText('Aguardando sua resposta')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Não posso ir: Louvor · Violão' })).toBeOnTheScreen()
    // "Preciso de alguém no meu lugar" só existe depois de aceitar.
    expect(screen.queryByRole('button', { name: /^Preciso de alguém/ })).toBeNull()

    await usuario.press(screen.getByRole('button', { name: 'Aceitar: Louvor · Violão' }))
    expect(await screen.findByText(/^Você está no Louvor, /)).toBeOnTheScreen()
    // Feito na tela: "Confirmado", e agora sim "Preciso de alguém no meu lugar".
    expect(screen.getByText('Confirmado')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Preciso de alguém no meu lugar' })).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/atr-eu/confirmar`)).toHaveLength(0)
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/atr-eu/confirmar`)).toHaveLength(1),
    )
  })

  test('"Não posso ir" sem diálogo e com Desfazer', async () => {
    const usuario = userEvent.setup()
    const { servidor } = await montar('membro', {}, eventoDeTeste({ atribuicoes: [MINHA_PARTE] }))
    await usuario.press(
      await screen.findByRole('button', { name: 'Não posso ir: Louvor · Violão' }),
    )
    expect(await screen.findByText('Você avisou que não pode ir.')).toBeOnTheScreen()
    expect(confirmar).not.toHaveBeenCalled()
    await usuario.press(screen.getByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByText('Aguardando sua resposta')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/atr-eu/recusar`)).toHaveLength(0)
  })

  test('aceita e do louvor: "Abrir o repertório" e "Preciso de alguém no meu lugar" abrem o que dizem', async () => {
    const usuario = userEvent.setup()
    await montar(
      'membro',
      {},
      eventoDeTeste({ atribuicoes: [{ ...MINHA_PARTE, estado: 'confirmada' }] }),
    )
    await usuario.press(await screen.findByRole('button', { name: 'Abrir o repertório' }))
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
    await usuario.press(screen.getByRole('button', { name: 'Preciso de alguém no meu lugar' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/escalas/substituicao/[atribuicaoId]',
      params: { atribuicaoId: 'atr-eu' },
    })
  })

  test('quem serve: os avatares e "Ver todos" com a função de cada um', async () => {
    const usuario = userEvent.setup()
    await montar('membro')
    expect(await screen.findByText('Quem serve (1)')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Ver todos' }))
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.getByText('responsável')).toBeOnTheScreen()
  })

  test('se inscreve e vê o código de entrada', async () => {
    const { servidor } = await montar('membro', {
      [`POST ${CAMINHO}/inscricoes/eu`]: () => ({
        status: 200,
        corpo: { inscricaoId: 'insc-1', estado: 'confirmada', codigoCheckin: 'A1B2C3D4E5' },
      }),
    })
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Inscrever-me' }))
    expect(await screen.findByText('A1B2C 3D4E5')).toBeOnTheScreen()
    expect(screen.getByText('Sua inscrição: Confirmada')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/inscricoes/eu`)).toHaveLength(1)
  })

  test('"Compartilhar" no topo manda o dia, a hora e o link público', async () => {
    const compartilhar = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined })
    await montar('membro')
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Compartilhar' }))
    await waitFor(() => expect(compartilhar).toHaveBeenCalled())
    const mensagem = compartilhar.mock.calls[0]![0].message as string
    expect(mensagem).toMatch(/^Sábado com a juventude, /)
    expect(mensagem).toMatch(/16:00/)
    compartilhar.mockRestore()
  })

  test('encontro cancelado: o motivo aparece com a palavra', async () => {
    await montar('membro', {}, eventoDeTeste({ status: 'cancelado', motivoStatus: 'Chuva forte' }))
    expect(await screen.findByText('Encontro cancelado')).toBeOnTheScreen()
    expect(screen.getByText('Motivo: Chuva forte')).toBeOnTheScreen()
  })
})

describe('Encontro: estados', () => {
  beforeEach(() => jest.clearAllMocks())

  test('404 (de outra comunidade ou removido): a mesma frase, com "Tentar de novo" e "Voltar para a Agenda"', async () => {
    await renderizarTela(<DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />, {
      rotas: {
        [`GET ${CAMINHO}`]: () => ({
          status: 404,
          corpo: { erro: 'nao_encontrado', mensagem: 'Não encontrado.' },
        }),
      },
    })
    expect(await screen.findByText('Não deu para abrir este encontro.')).toBeOnTheScreen()
    expect(screen.getByText('Pode ter sido removido ou você está sem internet.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Voltar para a Agenda' })).toBeOnTheScreen()
  })
})
