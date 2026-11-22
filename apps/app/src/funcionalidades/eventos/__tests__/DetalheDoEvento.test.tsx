/**
 * D69: o Encontro. Para o membro, UMA página ("Sua parte" no alto, quando e onde, roteiro enxuto,
 * quem serve, inscrição). Para a organização, três abas (Resumo, Roteiro, Convocados), o menu
 * "Mais" em grupos e o botão principal do momento na barra (publicar com Desfazer, lembrar, check-in,
 * ao vivo, marcar o próximo encontro). D78: o Roteiro é um acordeão por etapa, com edição ali mesmo.
 */
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Share } from 'react-native'

import { ETAPAS, EVENTO_ID, eventoDeTeste, minutos } from '@/testes/fixturas'
import { BASE, COMUNIDADE, MEU_VINCULO, PESSOAS, pedidosPara, renderizarTela } from '@/testes/telas'
import { confirmar } from '@/utilidades/confirmar'
import { HospedeiroDeToast, mostrarToast } from '@/ui/Toast'
import {
  aoMudarEstadoDoApp,
  confirmarAgora,
  desfazerAgora,
  reiniciarDesfazer,
} from '@/ui/ToastComDesfazer'

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

function montar(papel: 'organizador' | 'membro', rotasExtras = {}, evento = eventoDeTeste()) {
  return renderizarTela(
    <>
      <DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />
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

  test('roteiro vazio diz "O roteiro ainda não foi montado." e a organização pode adicionar', async () => {
    await montar('organizador', {}, eventoDeTeste({ etapas: [], atribuicoes: [] }))
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Roteiro' }))
    expect(await screen.findByText('O roteiro ainda não foi montado.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Adicionar etapa' })).toBeOnTheScreen()
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

    test('o primário diz quem será avisado; publicar mostra o Desfazer, e o botão e o cabeçalho dizem a verdade durante a contagem', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await montar(
        'organizador',
        { [`POST ${CAMINHO}/status`]: () => ({ status: 200, corpo: { ok: true } }) },
        RASCUNHO(),
      )
      await usuario.press(await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }))
      expect(await screen.findByText('Publicando e avisando 1 pessoa.')).toBeOnTheScreen()
      // Estado único e honesto: nada de "Publicado" enquanto não saiu. O botão é o Desfazer e conta o
      // mesmo tempo da faixa; o cabeçalho deixa de dizer "Rascunho" e diz "Publicando".
      expect(screen.queryByRole('button', { name: 'Publicado' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Publicando em 10 s · Desfazer' })).toBeEnabled()
      expect(screen.getByText('Publicando em 10 s')).toBeOnTheScreen()
      expect(screen.queryByText('Rascunho')).toBeNull()
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(0)
      // Sem "tem certeza?": nenhum diálogo.
      expect(confirmar).not.toHaveBeenCalled()
      await act(async () => confirmarAgora())
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)[0]?.corpo).toEqual({
          status: 'publicado',
        }),
      )
      // O fim diz o que houve, em frase inteira, e fica na tela (não só num aviso que some).
      await waitFor(() =>
        expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Publicado. 1 pessoa foi avisada.' }),
      )
      expect(await screen.findByText('Publicado. 1 pessoa foi avisada.')).toBeOnTheScreen()
    })

    test('tocar no botão durante a contagem é Desfazer: o encontro segue rascunho', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await montar('organizador', {}, RASCUNHO())
      await usuario.press(await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }))
      await usuario.press(
        await screen.findByRole('button', { name: 'Publicando em 10 s · Desfazer' }),
      )
      expect(
        await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }),
      ).toBeEnabled()
      expect(screen.getByText('Rascunho')).toBeOnTheScreen()
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(0)
    })

    test('o app vai para segundo plano durante a contagem: a publicação sai na hora', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await montar(
        'organizador',
        { [`POST ${CAMINHO}/status`]: () => ({ status: 200, corpo: { ok: true } }) },
        RASCUNHO(),
      )
      await usuario.press(await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }))
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(0)
      await act(async () => aoMudarEstadoDoApp('background'))
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(1),
      )
    })

    test('o servidor recusa: nada foi enviado, a faixa oferece "Tentar de novo" e o botão volta', async () => {
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
      await act(async () => confirmarAgora())
      expect(
        await screen.findByText(
          'Não deu para publicar. Nada foi enviado nem ninguém foi avisado. Toque em Tentar de novo.',
        ),
      ).toBeOnTheScreen()
      // (a faixa de falha é a do toast: outras partes da página também têm o seu "Tentar de novo")
      expect(
        within(screen.getByTestId('toast-com-desfazer')).getByRole('button', {
          name: 'Tentar de novo',
        }),
      ).toBeOnTheScreen()
      expect(
        await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }),
      ).toBeEnabled()
    })

    test('Desfazer: o encontro segue rascunho e nada é enviado', async () => {
      const usuario = userEvent.setup()
      const { servidor } = await montar('organizador', {}, RASCUNHO())
      await usuario.press(await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }))
      await usuario.press(await screen.findByRole('button', { name: 'Desfazer' }))
      expect(
        await screen.findByRole('button', { name: 'Publicar e avisar 1 pessoa' }),
      ).toBeEnabled()
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(0)
    })

    test('sem ninguém convocado o botão é só "Publicar"', async () => {
      await montar('organizador', {}, eventoDeTeste({ status: 'rascunho', atribuicoes: [] }))
      expect(await screen.findByRole('button', { name: 'Publicar' })).toBeOnTheScreen()
    })

    test('data no passado: é a única pergunta que resta, antes do Desfazer', async () => {
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
      await act(async () => confirmarAgora())
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
      expect(screen.getByRole('button', { name: 'Enviando em 10 s' })).toBeDisabled()
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

    test('terminou: "Marcar o próximo encontro" leva à conferência', async () => {
      const ontem = new Date(Date.now() - 86_400_000).toISOString()
      await montar('organizador', {}, eventoDeTeste({ inicio: ontem }))
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Marcar o próximo encontro' }))
      expect(router.push).toHaveBeenCalledWith('/evento/igual-ao-ultimo')
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
