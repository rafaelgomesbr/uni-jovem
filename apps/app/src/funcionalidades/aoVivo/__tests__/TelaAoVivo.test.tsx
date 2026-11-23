import { onlineManager } from '@tanstack/react-query'
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { criarDeposito } from '@/funcionalidades/offline/deposito'
import { ProvedorOffline } from '@/funcionalidades/offline/ProvedorOffline'
import { guardarPacote } from '@/funcionalidades/offline/sincronizador'
import { ETAPAS, EVENTO_ID, minutos, retratoDeTeste } from '@/testes/fixturas'
import { limparAparelho, pacoteDeTeste } from '@/testes/offline'
import { BASE, COMUNIDADE, MEU_VINCULO, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast } from '@/ui/Toast'
import { confirmarAgora, desfazerAgora } from '@/ui/ToastComDesfazer'

import { AoVivo } from '../TelaAoVivo'

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

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}/ao-vivo`
/** O long polling fica "pendurado", como a API faz até a versão mudar. */
const pendurado = () => new Promise<never>(() => {})

function rotas(retrato = retratoDeTeste(), extra = {}) {
  return {
    [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: retrato }),
    [`GET ${CAMINHO}?depoisDaVersao=${retrato.versao}`]: pendurado,
    ...extra,
  }
}

function montar(papel: 'organizador' | 'membro', rotasDaTela: Record<string, never> | object) {
  return renderizarTela(
    <>
      <AoVivo comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />
      <HospedeiroDeToast />
    </>,
    { papel, rotas: rotasDaTela as never },
  )
}

/** A etapa seguinte à de agora (Louvor) é "Encerramento", que é a última. */
const retratoNaPrimeira = () =>
  retratoDeTeste({
    versao: 2,
    etapaAtualId: ETAPAS[0],
    atrasoMin: 0,
    etapas: retratoDeTeste().etapas.map((e, i) => ({
      ...e,
      situacao: i === 0 ? 'atual' : 'proxima',
      inicioReal: i === 0 ? minutos(2) : null,
    })),
  })

beforeEach(() => {
  jest.clearAllMocks()
  onlineManager.setOnline(true)
  desfazerAgora()
})
afterEach(() => desfazerAgora())
afterAll(() => onlineManager.setOnline(true))

describe('ao vivo no visual A (D71)', () => {
  describe('quem acompanha', () => {
    test('vê a etapa de agora, o que vem depois, o atraso e a conexão, sem botões de condução', async () => {
      const { servidor } = await montar('membro', rotas())

      // A etapa de agora é o título do cartão do momento; a seguinte aparece em "A seguir".
      expect(await screen.findByRole('header', { name: 'Louvor' })).toBeOnTheScreen()
      // "Agora" na etiqueta do cartão e no chip da linha do roteiro.
      expect(screen.getAllByText('Agora')).toHaveLength(2)
      expect(screen.getByText('A seguir')).toBeOnTheScreen()
      expect(screen.getAllByText('Encerramento').length).toBeGreaterThan(0)
      // A conexão em chip, com texto e ícone (não só a cor).
      expect(screen.getByText('Conectado')).toBeOnTheScreen()
      expect(screen.getByText(/Atraso acumulado: \d+ min de atraso/)).toBeOnTheScreen()
      expect(screen.getByText('1 de 3 etapas concluídas')).toBeOnTheScreen()
      // Até quando vai a etapa de agora.
      expect(screen.getByText(/^Etapa 2 de 3 · até \d{2}:\d{2}$/)).toBeOnTheScreen()
      expect(
        screen.getByText('Você está acompanhando. Quem conduz o andamento é a organização.'),
      ).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: /Próxima etapa/ })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Voltar uma etapa' })).toBeNull()
      await waitFor(() =>
        expect(servidor.pedidos.some((p) => p.url.endsWith('?depoisDaVersao=3'))).toBe(true),
      )
    })

    test('o tempo que resta é o número grande, com o decorrido e o chip em texto', async () => {
      await montar('membro', rotas())
      expect(await screen.findByText(/^Restam 1[0-2] min$/)).toBeOnTheScreen()
      expect(screen.getByText(/^\d{2}:\d{2} de 15 min$/)).toBeOnTheScreen()
      expect(screen.getByLabelText(/^Faltam .*Tempo decorrido/)).toBeOnTheScreen()
    })

    test('passou do previsto: "+", chip "Passou N min" e a fala diz que atrasou', async () => {
      await montar('membro', rotas(retratoDeTeste({ agora: minutos(30) })))
      expect(await screen.findByText(/^Passou \d+ min$/)).toBeOnTheScreen()
      expect(screen.getByText(/^\+\d{2}:\d{2}$/)).toBeOnTheScreen()
      expect(screen.getByLabelText(/^Atrasado\. Passou/)).toBeOnTheScreen()
    })
  })

  describe('quem conduz', () => {
    test('o primário NOMEIA a próxima etapa e avança com a versão que a tela conhece', async () => {
      const depois = retratoDeTeste({ versao: 4, etapaAtualId: ETAPAS[2] })
      const { servidor } = await montar(
        'organizador',
        rotas(retratoNaPrimeira(), {
          [`GET ${CAMINHO}?depoisDaVersao=4`]: pendurado,
          [`POST ${CAMINHO}`]: () => ({ status: 200, corpo: depois }),
        }),
      )

      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Próxima etapa: Louvor' }))

      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', CAMINHO)[0]?.corpo).toEqual({
          comando: 'avancar',
          versao: 2,
        }),
      )
      // Os controles dizem o que fazem em texto, não só em ícone.
      expect(screen.getByRole('button', { name: 'Voltar uma etapa' })).toHaveTextContent('Voltar')
      expect(screen.getByRole('button', { name: 'Pausar' })).toHaveTextContent('Pausar')
    })

    test('na penúltima etapa o primário diz o nome da última; na última, "Encerrar o ao vivo"', async () => {
      await montar('organizador', rotas())
      // Louvor é a etapa 2 de 3: o primário nomeia "Encerramento".
      expect(
        await screen.findByRole('button', { name: 'Próxima etapa: Encerramento' }),
      ).toBeOnTheScreen()
    })

    test('"Encerrar o ao vivo" mostra o resultado na hora e só envia depois dos 5 s', async () => {
      const ultima = retratoDeTeste({
        versao: 5,
        etapaAtualId: ETAPAS[2],
        etapas: retratoDeTeste().etapas.map((e, i) => ({
          ...e,
          situacao: i < 2 ? 'concluida' : 'atual',
        })),
      })
      const encerrado = retratoDeTeste({ versao: 6, situacao: 'encerrado' })
      const { servidor } = await montar(
        'organizador',
        rotas(ultima, {
          [`GET ${CAMINHO}?depoisDaVersao=6`]: pendurado,
          [`POST ${CAMINHO}`]: () => ({ status: 200, corpo: encerrado }),
        }),
      )
      const usuario = userEvent.setup()

      await usuario.press(await screen.findByRole('button', { name: 'Encerrar o ao vivo' }))

      // Já aparece encerrado, com o aviso e o Desfazer; nada foi enviado ainda.
      expect(await screen.findByText('Encontro encerrado.')).toBeOnTheScreen()
      expect(screen.getByText('Encerrando o ao vivo para quem acompanha.')).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Encerrar o ao vivo' })).toBeNull()
      expect(pedidosPara(servidor, 'POST', CAMINHO)).toHaveLength(0)

      // Aos 5 s (ou ao sair da tela), o comando sai.
      await act(async () => confirmarAgora())
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', CAMINHO)[0]?.corpo).toEqual({
          comando: 'encerrar',
          versao: 5,
        }),
      )
    })

    test('Desfazer volta o ao vivo ao que era e nada é enviado', async () => {
      const { servidor } = await montar('organizador', rotas())
      const usuario = userEvent.setup()

      await usuario.press(await screen.findByRole('button', { name: 'Mais ações' }))
      await usuario.press(await screen.findByRole('button', { name: /^Encerrar o ao vivo/ }))
      await waitFor(() => expect(screen.getByText('Encontro encerrado.')).toBeOnTheScreen())

      await usuario.press(await screen.findByRole('button', { name: 'Desfazer' }))
      expect(await screen.findByRole('header', { name: 'Louvor' })).toBeOnTheScreen()
      expect(screen.queryByText('Encontro encerrado.')).toBeNull()
      expect(pedidosPara(servidor, 'POST', CAMINHO)).toHaveLength(0)
    })

    test('antes de começar: "Iniciar o encontro" e o horário previsto', async () => {
      const naoIniciado = retratoDeTeste({
        situacao: 'nao_iniciado',
        etapaAtualId: null,
        etapaIniciadaEm: null,
        iniciadoEm: null,
        atrasoMin: null,
        condutor: null,
        souCondutor: false,
        etapas: retratoDeTeste().etapas.map((e) => ({
          ...e,
          inicioReal: null,
          situacao: 'proxima' as const,
        })),
      })
      await montar('organizador', rotas(naoIniciado))
      expect(await screen.findByText('Ainda não começou')).toBeOnTheScreen()
      expect(screen.getByText(/^Previsto: \d{2}:\d{2}$/)).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Iniciar o encontro' })).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Pausar' })).toBeNull()
    })

    test('409: a tela troca para o estado atual, avisa e só oferece "Assumir a condução"', async () => {
      const atual = retratoDeTeste({
        versao: 5,
        etapaAtualId: ETAPAS[2],
        condutor: { vinculoId: 'outro', nome: 'Bruno Lima', ate: '2026-11-21T20:00:00.000Z' },
        souCondutor: false,
        etapas: retratoDeTeste().etapas.map((e, i) => ({
          ...e,
          situacao: i < 2 ? 'concluida' : 'atual',
        })),
      })
      await montar(
        'organizador',
        rotas(retratoDeTeste(), {
          [`GET ${CAMINHO}?depoisDaVersao=5`]: pendurado,
          [`POST ${CAMINHO}`]: () => ({
            status: 409,
            corpo: {
              erro: 'conduzido_por_outra_pessoa',
              mensagem: 'Outra pessoa está conduzindo agora.',
              atual,
            },
          }),
        }),
      )

      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Próxima etapa: Encerramento' }))

      expect(
        await screen.findByText('O andamento mudou. Outra pessoa está conduzindo agora.'),
      ).toBeOnTheScreen()
      expect(
        screen.getByText('Bruno Lima está conduzindo. Você está acompanhando.'),
      ).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: /^Próxima etapa/ })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Encerrar o ao vivo' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Assumir a condução' })).toBeOnTheScreen()
    })

    test('encerrado: quem organiza pode marcar o próximo sábado', async () => {
      await montar(
        'organizador',
        rotas(
          retratoDeTeste({
            situacao: 'encerrado',
            versao: 9,
            encerradoEm: minutos(40),
            etapas: retratoDeTeste().etapas.map((e) => ({ ...e, situacao: 'concluida' as const })),
          }),
        ),
      )
      expect(await screen.findByText('Encontro encerrado.')).toBeOnTheScreen()
      await userEvent
        .setup()
        .press(screen.getByRole('button', { name: 'Marcar o próximo encontro' }))
      // Do zero: o roteiro é a pessoa que monta; copiar o último é um atalho da tela de novo encontro.
      expect(router.push).toHaveBeenCalledWith('/evento/novo')
    })
  })

  describe('os três estados', () => {
    test('carregando: esqueleto com a forma do cartão', async () => {
      await montar('membro', { [`GET ${CAMINHO}`]: pendurado })
      expect(await screen.findByLabelText('Carregando o andamento')).toBeOnTheScreen()
    })

    test('erro: texto humano e "Tentar de novo"', async () => {
      let n = 0
      await montar('membro', {
        [`GET ${CAMINHO}`]: () =>
          ++n === 1
            ? { status: 500, corpo: { erro: 'x', mensagem: 'Falhou.' } }
            : { status: 200, corpo: retratoDeTeste() },
        [`GET ${CAMINHO}?depoisDaVersao=3`]: pendurado,
      })
      expect(await screen.findByText('Não deu para conectar.')).toBeOnTheScreen()
      await userEvent.setup().press(screen.getByRole('button', { name: 'Tentar de novo' }))
      expect(await screen.findByRole('header', { name: 'Louvor' })).toBeOnTheScreen()
    })

    test('vazio: encontro sem roteiro leva a montar o roteiro', async () => {
      await montar('organizador', rotas(retratoDeTeste({ etapas: [], etapaAtualId: null })))
      expect(await screen.findByText('Este encontro não tem roteiro.')).toBeOnTheScreen()
      await userEvent.setup().press(screen.getByRole('button', { name: 'Montar o roteiro' }))
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]',
        params: { eventoId: EVENTO_ID },
      })
    })
  })

  describe('sem internet', () => {
    test('sem o encontro baixado: explica e oferece baixar (com Wi-Fi)', async () => {
      limparAparelho()
      onlineManager.setOnline(false)
      await montar('organizador', rotas())
      expect(await screen.findByText(/Sem internet e sem o encontro no aparelho/)).toBeOnTheScreen()
      expect(
        screen.getByText(
          'Para conduzir sem internet, baixe o encontro antes. Faça isso com Wi-Fi.',
        ),
      ).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Baixar o encontro' })).toBeOnTheScreen()
      expect(screen.getByText('Sem conexão')).toBeOnTheScreen()
    })

    test('com o encontro baixado: continua conduzindo e a proposta entra na fila', async () => {
      limparAparelho()
      const deposito = criarDeposito()
      const p = await deposito.criar({
        contaId: 'conta-eu',
        comunidadeId: COMUNIDADE,
        vinculoId: MEU_VINCULO,
        validadeDias: 7,
      })
      await guardarPacote(p, pacoteDeTeste())
      onlineManager.setOnline(false)
      await renderizarTela(
        <ProvedorOffline deposito={deposito}>
          <AoVivo comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />
        </ProvedorOffline>,
        { papel: 'organizador', rotas: rotas() },
      )

      expect(
        await screen.findByText('Você pode continuar. As mudanças vão quando a internet voltar.'),
      ).toBeOnTheScreen()
      expect(screen.getByText('Sem conexão')).toBeOnTheScreen()
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Iniciar o encontro' }))

      await waitFor(async () => {
        const particao = await deposito.abrir('conta-eu', COMUNIDADE)
        expect((await particao!.operacoes()).map((o) => o.tipo)).toEqual(['ao_vivo.proposta'])
      })
    })
  })
})
