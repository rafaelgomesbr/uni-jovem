import { onlineManager } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useKeepAwake } from 'expo-keep-awake'
import { router, useLocalSearchParams } from 'expo-router'

import { lerPreferenciaLocal } from '@/estado/preferenciaLocal'
import { criarDeposito } from '@/funcionalidades/offline/deposito'
import { ProvedorOffline } from '@/funcionalidades/offline/ProvedorOffline'
import { baixarRepertorio } from '@/funcionalidades/offline/repertorioOffline'
import { EVENTO_ID } from '@/testes/fixturas'
import { limparAparelho } from '@/testes/offline'
import {
  encontroDoMeuRepertorioDeTeste,
  LETRA_DA_PRIMEIRA,
  pacoteDoRepertorioDeTeste,
} from '@/testes/repertorio'
import { BASE, COMUNIDADE, renderizarTela } from '@/testes/telas'

import { ModoPalco } from '../ModoPalco'
import { proximoPontoDeRolagem } from '../rolagem'
import { TelaCifraDoRepertorio } from '../TelaCifraDoRepertorio'
import type { useAjustesDaCifra } from '../useAjustesDaCifra'

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

// A tela que não apaga é do sistema: o teste só confere que o palco a pediu.
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }))

const MEU = `${BASE}/meu-repertorio`

function parametros(extra: Record<string, string> = {}) {
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ eventoId: EVENTO_ID, itemId: 'item-1', ...extra } as never)
}

const rotas = () => ({
  [`GET ${MEU}`]: () => ({ status: 200, corpo: { encontros: [encontroDoMeuRepertorioDeTeste()] } }),
})

beforeEach(() => {
  jest.clearAllMocks()
  limparAparelho()
  onlineManager.setOnline(true)
})
afterAll(() => onlineManager.setOnline(true))

describe('leitura da cifra do Meu repertório', () => {
  test('abre no tom do dia, com letra, acordes e o painel escuro de alto contraste', async () => {
    parametros()
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotas() })

    expect(await screen.findByRole('header', { name: 'Firmes na rocha' })).toBeOnTheScreen()
    expect(screen.getByText('Música 1 de 2 · Sábado com a juventude')).toBeOnTheScreen()
    // De G para A: os acordes sobem dois tons.
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${LETRA_DA_PRIMEIRA}. Acordes: A, E`)).toBeOnTheScreen()
  })

  test('anterior e próxima por botão; no primeiro não há anterior', async () => {
    parametros()
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotas() })
    const usuario = userEvent.setup()

    expect(await screen.findByRole('button', { name: 'Música anterior' })).toBeDisabled()
    await usuario.press(screen.getByRole('button', { name: 'Próxima música' }))
    expect(router.replace).toHaveBeenLastCalledWith({
      pathname: '/meu-repertorio/[eventoId]/[itemId]',
      params: { eventoId: EVENTO_ID, itemId: 'item-2' },
    })
  })

  test('a música que saiu do repertório explica e leva de volta à lista', async () => {
    parametros({ itemId: 'item-que-saiu' })
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotas() })
    expect(await screen.findByText('Esta música saiu do seu repertório')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Ver meu repertório' }))
    expect(router.replace).toHaveBeenCalledWith('/meu-repertorio')
  })

  test('sem internet, com a cópia guardada: a cifra abre do aparelho', async () => {
    parametros()
    const deposito = criarDeposito()
    const p = await deposito.criar({
      contaId: 'conta-eu',
      comunidadeId: COMUNIDADE,
      vinculoId: null,
      validadeDias: 7,
    })
    await baixarRepertorio(p, { get: async () => pacoteDoRepertorioDeTeste() } as never, EVENTO_ID)
    onlineManager.setOnline(false)
    const { servidor } = await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <TelaCifraDoRepertorio />
      </ProvedorOffline>,
      { papel: 'membro', rotas: rotas() },
    )

    expect(await screen.findByLabelText(`${LETRA_DA_PRIMEIRA}. Acordes: A, E`)).toBeOnTheScreen()
    expect(screen.getByText('Baixado para usar sem internet')).toBeOnTheScreen()
    expect(servidor.pedidos.some((q) => q.url.includes('/meu-repertorio'))).toBe(false)
  })

  test('sem internet e sem cópia: pede para conectar em vez de mostrar tela vazia', async () => {
    parametros()
    onlineManager.setOnline(false)
    await renderizarTela(
      <ProvedorOffline deposito={criarDeposito()}>
        <TelaCifraDoRepertorio />
      </ProvedorOffline>,
      { papel: 'membro', rotas: rotas() },
    )
    expect(
      await screen.findByText('Este repertório ainda não está no seu aparelho'),
    ).toBeOnTheScreen()
  })
})

describe('Modo palco', () => {
  test('o botão Palco abre a tela cheia escura; Sair do palco volta à leitura', async () => {
    parametros()
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotas() })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('button', { name: 'Abrir o Modo palco' }))

    expect(await screen.findByRole('button', { name: 'Sair do palco' })).toBeOnTheScreen()
    expect(screen.getByText('1 de 2')).toBeOnTheScreen()
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    // Sem distração: nada da leitura (nem a barra de ação com Anterior pequeno) fica no caminho.
    expect(screen.queryByRole('button', { name: 'Abrir o Modo palco' })).toBeNull()
    // A tela não apaga enquanto o palco está aberto.
    expect(useKeepAwake).toHaveBeenCalledWith('uj-palco')

    await usuario.press(screen.getByRole('button', { name: 'Sair do palco' }))
    expect(await screen.findByRole('button', { name: 'Abrir o Modo palco' })).toBeOnTheScreen()
    expect(router.back).not.toHaveBeenCalled()
  })

  test('aberto direto pelo Meu repertório, Sair do palco volta à lista com um toque', async () => {
    parametros({ palco: '1' })
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotas() })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('button', { name: 'Sair do palco' }))
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  test('na troca de música o palco continua aberto (palco=1 vai junto)', async () => {
    parametros({ palco: '1' })
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotas() })
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Próxima música' }))
    expect(router.replace).toHaveBeenLastCalledWith({
      pathname: '/meu-repertorio/[eventoId]/[itemId]',
      params: { eventoId: EVENTO_ID, itemId: 'item-2', palco: '1' },
    })
  })

  test('A+ e A− mudam a letra e o tamanho fica lembrado para a próxima vez', async () => {
    parametros({ palco: '1' })
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotas() })
    const usuario = userEvent.setup()
    const tamanho = () => {
      const trecho = screen.getByText('rocha de manhã')
      const estilo = ([] as object[]).concat(trecho.props.style).flat(3)
      return Object.assign({}, ...estilo).fontSize as number
    }

    await screen.findByRole('button', { name: 'Aumentar a letra' })
    const inicial = tamanho()
    await usuario.press(screen.getByRole('button', { name: 'Aumentar a letra' }))
    expect(tamanho()).toBeGreaterThan(inicial)
    await waitFor(async () =>
      expect(await lerPreferenciaLocal<number>('uj.palco.tamanho')).toBe(42),
    )

    await usuario.press(screen.getByRole('button', { name: 'Diminuir a letra' }))
    await usuario.press(screen.getByRole('button', { name: 'Diminuir a letra' }))
    expect(tamanho()).toBeLessThan(inicial)
  })

  test('Tom − e Tom + mexem só neste aparelho: o tom do dia da música não muda', async () => {
    parametros({ palco: '1' })
    const { servidor } = await renderizarTela(<TelaCifraDoRepertorio />, {
      papel: 'membro',
      rotas: rotas(),
    })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('button', { name: 'Subir meio tom' }))
    expect(screen.getByText('Tom B♭')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Descer meio tom' }))
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(servidor.pedidos.filter((q) => q.metodo !== 'GET')).toHaveLength(0)
  })

  test('botões de rolar têm nome e alvo grande; o palco usa o fundo e o tom escuros', async () => {
    const ajustes = renderHookDosAjustes()
    await render(
      <ModoPalco
        titulo="Firmes na rocha"
        cifra={'{key: G}\n[G]Linha de teste'}
        tomOriginal="G"
        tomDoDia={null}
        posicao={1}
        total={1}
        ajustes={ajustes}
        aoSair={jest.fn()}
        aoAnterior={null}
        aoProxima={null}
      />,
    )
    const usuario = userEvent.setup()
    for (const nome of ['Rolar a cifra para cima', 'Rolar a cifra para baixo']) {
      const botao = screen.getByRole('button', { name: nome })
      const lado = Object.assign({}, ...([] as object[]).concat(botao.props.style).flat(3)) as {
        width?: number
        height?: number
      }
      expect(lado.width ?? 56).toBeGreaterThanOrEqual(44)
      await usuario.press(botao)
    }
    // Sem música antes nem depois, os dois botões ficam desligados, com o nome certo.
    expect(screen.getByRole('button', { name: 'Música anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima música' })).toBeDisabled()
  })
})

/** Os ajustes são um hook: este auxiliar monta um objeto de ajustes fixo para renderizar o palco. */
function renderHookDosAjustes() {
  const base = {
    ajuste: 0,
    capotraste: 0,
    descerMeioTom: jest.fn(),
    subirMeioTom: jest.fn(),
    voltarAoTomDoDia: jest.fn(),
    capoAbaixo: jest.fn(),
    capoAcima: jest.fn(),
    leitura: { tamanho: 20, menor: jest.fn(), maior: jest.fn(), noMinimo: false, noMaximo: false },
    palco: { tamanho: 36, menor: jest.fn(), maior: jest.fn(), noMinimo: false, noMaximo: false },
  }
  return base as unknown as ReturnType<typeof useAjustesDaCifra>
}

describe('rolagem por botão', () => {
  test('anda 80% da janela, sem passar do começo nem do fim', () => {
    const base = { janela: 500, conteudo: 2000 }
    expect(proximoPontoDeRolagem({ ...base, atual: 0, sentido: 'baixo' })).toBe(400)
    expect(proximoPontoDeRolagem({ ...base, atual: 400, sentido: 'baixo' })).toBe(800)
    expect(proximoPontoDeRolagem({ ...base, atual: 800, sentido: 'cima' })).toBe(400)
    expect(proximoPontoDeRolagem({ ...base, atual: 100, sentido: 'cima' })).toBe(0)
    expect(proximoPontoDeRolagem({ ...base, atual: 1400, sentido: 'baixo' })).toBe(1500)
    // Conteúdo menor que a janela: nada a rolar.
    expect(proximoPontoDeRolagem({ janela: 500, conteudo: 300, atual: 0, sentido: 'baixo' })).toBe(
      0,
    )
  })
})
