/**
 * O movimento da tela de acesso (D63) e o Reduzir movimento: com a preferência
 * ligada nada desliza, nada escala, nada balança e a aurora não deriva; só
 * dissolve de até 120 ms. O dublê do Reanimated (jest.setup.ts) vai direto ao
 * valor final, então o teste confere o que foi PEDIDO (duração, atraso,
 * sequência) e o estado final.
 */
import { act, render, renderHook, screen } from '@testing-library/react-native'
import { AURORA, CASCATA_DE_ABERTURA, MOVIMENTO_DE_ACESSO } from '@uj/tokens'
import { Text, View } from 'react-native'
import {
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { Abalar } from '../Abalar'
import { FundoAurora } from '../FundoAurora'
import { ProvedorDeRevelacao, Revelar } from '../Revelar'
import { TrocaDePainel } from '../TrocaDePainel'
import { useToqueComMola } from '../useToqueComMola'

jest.mock('../acessibilidade', () => ({
  usePreferenciasDeAcessibilidade: jest.fn(),
}))
const preferencias = jest.requireMock('../acessibilidade') as {
  usePreferenciasDeAcessibilidade: jest.Mock
}

function definirPreferencias(reduzirMovimento: boolean) {
  preferencias.usePreferenciasDeAcessibilidade.mockReturnValue({
    reduzirMovimento,
    reduzirTransparencia: false,
    aumentarContraste: false,
  })
}

const duracoesPedidas = () =>
  (withTiming as jest.Mock).mock.calls.map((c) => (c[1] as { duration: number }).duration)

describe('Revelar (a cascata de abertura)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    definirPreferencias(false)
  })

  test('abertura completa: cada elemento usa o atraso e a duração da cascata', async () => {
    await render(
      <ProvedorDeRevelacao value="completa">
        <Revelar
          atraso={CASCATA_DE_ABERTURA.botao2.atraso}
          duracao={CASCATA_DE_ABERTURA.botao2.duracao}
        >
          <Text>Botão 2</Text>
        </Revelar>
      </ProvedorDeRevelacao>,
    )
    expect(withDelay).toHaveBeenCalledWith(350, expect.anything())
    expect(duracoesPedidas()).toContain(320)
    expect(screen.getByText('Botão 2')).toBeOnTheScreen()
  })

  test('entrada curta: 260 ms, e cada item entra 30 ms depois do anterior', async () => {
    await render(
      <ProvedorDeRevelacao value="curta">
        <Revelar ordem={3}>
          <Text>Item</Text>
        </Revelar>
      </ProvedorDeRevelacao>,
    )
    expect(withDelay).toHaveBeenCalledWith(90, expect.anything())
    expect(duracoesPedidas()).toContain(260)
  })

  test('Reduzir movimento: um dissolve só, de 120 ms e sem atraso, em qualquer modo', async () => {
    definirPreferencias(true)
    await render(
      <ProvedorDeRevelacao value="completa">
        <Revelar atraso={500} duracao={280} dy={16}>
          <Text>Rodapé</Text>
        </Revelar>
      </ProvedorDeRevelacao>,
    )
    expect(withDelay).toHaveBeenCalledWith(0, expect.anything())
    expect(duracoesPedidas()).toEqual([MOVIMENTO_DE_ACESSO.dissolver])
    expect(screen.getByText('Rodapé')).toBeOnTheScreen()
  })

  test('sem movimento (painel já aberto): nada é pedido e o conteúdo está lá', async () => {
    await render(
      <ProvedorDeRevelacao value="imediata">
        <Revelar atraso={300}>
          <Text>Parado</Text>
        </Revelar>
      </ProvedorDeRevelacao>,
    )
    expect(withTiming).not.toHaveBeenCalled()
    expect(screen.getByText('Parado')).toBeOnTheScreen()
  })
})

describe('Abalar (o balanço do erro)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    definirPreferencias(false)
  })

  test('cada disparo novo balança 5 pt em 260 ms (4 etapas); o mesmo número não repete', async () => {
    const { rerender } = await render(
      <Abalar disparo={0}>
        <Text>Campo</Text>
      </Abalar>,
    )
    expect(withSequence).not.toHaveBeenCalled()
    await rerender(
      <Abalar disparo={1}>
        <Text>Campo</Text>
      </Abalar>,
    )
    expect(withSequence).toHaveBeenCalledTimes(1)
    expect(duracoesPedidas().reduce((a, b) => a + b, 0)).toBe(260)
    await rerender(
      <Abalar disparo={1}>
        <Text>Campo</Text>
      </Abalar>,
    )
    expect(withSequence).toHaveBeenCalledTimes(1)
  })

  test('Reduzir movimento: nunca balança', async () => {
    definirPreferencias(true)
    const { rerender } = await render(
      <Abalar disparo={0}>
        <Text>Campo</Text>
      </Abalar>,
    )
    await rerender(
      <Abalar disparo={3}>
        <Text>Campo</Text>
      </Abalar>,
    )
    expect(withSequence).not.toHaveBeenCalled()
  })
})

describe('retorno ao toque (useToqueComMola)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    definirPreferencias(false)
  })

  test('ao tocar: escala 0,98 e camada em 90 ms; ao soltar, a mola devolve a escala', async () => {
    const { result } = await renderHook(() => useToqueComMola())
    await act(async () => result.current.aoPressionarDentro())
    expect(duracoesPedidas()).toEqual([90, 90])
    const escalaPedida = (withTiming as jest.Mock).mock.calls.map((c) => c[0] as number)
    expect(escalaPedida).toContain(MOVIMENTO_DE_ACESSO.escalaDoToque)
    await act(async () => result.current.aoPressionarFora())
    expect(withSpring).toHaveBeenCalledTimes(1)
  })

  test('Reduzir movimento: sem escala e sem mola; só a camada, em 80 ms', async () => {
    definirPreferencias(true)
    const { result } = await renderHook(() => useToqueComMola())
    await act(async () => result.current.aoPressionarDentro())
    await act(async () => result.current.aoPressionarFora())
    expect(duracoesPedidas()).toEqual([80, 80])
    expect(withSpring).not.toHaveBeenCalled()
  })

  test('link do rodapé (escala desligada): só a camada, mesmo sem Reduzir movimento', async () => {
    const { result } = await renderHook(() => useToqueComMola({ escala: false }))
    await act(async () => result.current.aoPressionarDentro())
    expect(withTiming).toHaveBeenCalledTimes(1)
    await act(async () => result.current.aoPressionarFora())
    expect(withSpring).not.toHaveBeenCalled()
  })
})

describe('TrocaDePainel (revelar o e-mail)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    definirPreferencias(false)
  })

  function troca(painel: 'inicio' | 'email', aoAssentar?: (p: 'inicio' | 'email') => void) {
    return (
      <TrocaDePainel
        painel={painel}
        {...(aoAssentar ? { aoAssentar } : {})}
        inicio={
          <View>
            <Text>Acessos</Text>
          </View>
        }
        email={
          <View>
            <Text>Painel de e-mail</Text>
          </View>
        }
      />
    )
  }

  test('a camada que saiu fica fora do leitor de tela e sem toque (nada de botão invisível focável)', async () => {
    const { rerender } = await render(troca('inicio'))
    expect(screen.getByText('Acessos')).toBeOnTheScreen()
    expect(screen.queryByText('Painel de e-mail')).toBeNull()
    await rerender(troca('email'))
    expect(screen.getByText('Painel de e-mail')).toBeOnTheScreen()
    expect(screen.queryByText('Acessos')).toBeNull()
    expect(screen.getByText('Acessos', { includeHiddenElements: true })).toBeOnTheScreen()
  })

  test('ida em 280 ms e volta em 240 ms, e o fim da troca avisa (é quando o foco vai ao campo)', async () => {
    const aoAssentar = jest.fn()
    const { rerender } = await render(troca('inicio', aoAssentar))
    await rerender(troca('email', aoAssentar))
    expect(duracoesPedidas()).toContain(280)
    await act(async () => undefined)
    expect(aoAssentar).toHaveBeenCalledWith('email')
    await rerender(troca('inicio', aoAssentar))
    expect(duracoesPedidas()).toContain(240)
    await act(async () => undefined)
    expect(aoAssentar).toHaveBeenLastCalledWith('inicio')
  })

  test('Reduzir movimento: a troca é um dissolve de 120 ms', async () => {
    definirPreferencias(true)
    const { rerender } = await render(troca('inicio'))
    await rerender(troca('email'))
    expect(duracoesPedidas()).toContain(MOVIMENTO_DE_ACESSO.dissolver)
    expect(duracoesPedidas()).not.toContain(280)
  })
})

describe('FundoAurora (a deriva lenta, só na tela de acesso)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    definirPreferencias(false)
  })

  test('estático (o resto do app): nada se move', async () => {
    await render(<FundoAurora intensidade={1} />)
    expect(withRepeat).not.toHaveBeenCalled()
    expect(withTiming).not.toHaveBeenCalled()
  })

  test('ambiente: o coral deriva 14 s por meia volta e o violeta 18 s, seis meias-voltas cada', async () => {
    await render(<FundoAurora intensidade={1} movimento="ambiente" />)
    const chamadas = (withRepeat as jest.Mock).mock.calls
    expect(chamadas).toHaveLength(2)
    expect(chamadas.map((c) => [c[1], c[2]])).toEqual([
      [AURORA.deriva.coral.meiasVoltas, true],
      [AURORA.deriva.violeta.meiasVoltas, true],
    ])
    expect(duracoesPedidas()).toEqual(
      expect.arrayContaining([AURORA.deriva.coral.meioCiclo, AURORA.deriva.violeta.meioCiclo]),
    )
  })

  test('pausada (painel de e-mail com teclado, tela fora de foco): não deriva, volta ao repouso', async () => {
    await render(<FundoAurora intensidade={1} movimento="ambiente" pausada />)
    expect(withRepeat).not.toHaveBeenCalled()
  })

  test('Reduzir movimento: sem deriva e sem abertura, a aurora fica parada no repouso', async () => {
    definirPreferencias(true)
    await render(<FundoAurora intensidade={1} movimento="ambiente" amanhecer />)
    expect(withRepeat).not.toHaveBeenCalled()
    // Nenhuma abertura de 800 ms.
    expect(duracoesPedidas()).not.toContain(AURORA.deriva.abertura.duracao)
  })

  test('amanhecer: o coral esquenta em 800 ms (só o coral)', async () => {
    await render(<FundoAurora intensidade={1} movimento="ambiente" amanhecer />)
    expect(duracoesPedidas().filter((d) => d === AURORA.deriva.abertura.duracao)).toHaveLength(1)
  })

  test('um toque durante tudo isso nunca é bloqueado: a aurora é decorativa e não recebe toque', async () => {
    const { toJSON } = await render(<FundoAurora intensidade={1} movimento="ambiente" />)
    expect(JSON.stringify(toJSON())).toContain('"pointerEvents":"none"')
  })
})
