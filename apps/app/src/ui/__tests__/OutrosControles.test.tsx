/**
 * D64: os vizinhos de botões e campos na mesma gramática: interruptor com trilho
 * próprio, botão de ícone circular, botão de linha, par de botões, pílula de
 * filtro tonal, rádio e caixa de marcar de 24, e o motivo na barra de ação.
 */
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { TEMAS } from '@uj/tokens'
import { useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'

import { BarraDeAcao } from '../BarraDeAcao'
import { Botao, BotaoIcone, ParDeBotoes } from '../Botao'
import { BotaoDeLinha } from '../BotaoDeLinha'
import { CaixaDeMarcar } from '../CaixaDeMarcar'
import { Interruptor } from '../Interruptor'
import { ListaDeOpcoes } from '../ListaDeOpcoes'
import { PilulasDeFiltro } from '../PilulasDeFiltro'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const C = TEMAS.claro.base
const COM_ESCONDIDOS = { includeHiddenElements: true }

function estilo(no: { props: { style?: unknown } }) {
  return StyleSheet.flatten(no.props.style as never) as Record<string, unknown>
}

describe('Interruptor com trilho próprio (o Switch nativo desligado sumia a 1,28:1)', () => {
  function Exemplo({ inicial = false }: { inicial?: boolean }) {
    const [ligado, setLigado] = useState(inicial)
    return <Interruptor rotulo="Avisos" ligado={ligado} aoMudar={setLigado} />
  }

  test('o trilho tem 52 por 32 e raio de cápsula; desligado, é vazado com borda de 2 em `campoBorda`', async () => {
    await render(<Exemplo />)
    expect(estilo(screen.getByTestId('interruptor-trilho', COM_ESCONDIDOS))).toMatchObject({
      width: 52,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: C.campoBorda,
    })
    // Sem preenchimento (opacidade 0): o desligado se vê pela borda, nunca some no cartão.
    expect(estilo(screen.getByTestId('interruptor-preenchimento', COM_ESCONDIDOS)).opacity).toBe(0)
  })

  test('ligado: o trilho enche com `primaria` e o polegar anda 20 e cresce ao disco de 24', async () => {
    await render(<Exemplo inicial />)
    const preenchimento = estilo(screen.getByTestId('interruptor-preenchimento', COM_ESCONDIDOS))
    expect(preenchimento).toMatchObject({ backgroundColor: C.primaria, opacity: 1 })
    const polegar = estilo(screen.getByTestId('interruptor-polegar', COM_ESCONDIDOS))
    expect(polegar.transform).toEqual([{ translateX: 20 }, { scale: 1 }])
  })

  test('desligado, o polegar é um ponto de 14 (24 a 58%) no começo do trilho', async () => {
    await render(<Exemplo />)
    const polegar = estilo(screen.getByTestId('interruptor-polegar', COM_ESCONDIDOS))
    const transform = polegar.transform as [{ translateX: number }, { scale: number }]
    expect(transform[0].translateX).toBe(0)
    expect(24 * transform[1].scale).toBeCloseTo(14, 5)
  })

  test('a linha é o controle: papel switch, tocar liga, e o estado também é escrito', async () => {
    await render(<Exemplo />)
    const linha = screen.getByRole('switch', { name: 'Avisos' })
    expect(linha).not.toBeChecked()
    expect(screen.getByText('Desligado')).toBeOnTheScreen()
    await userEvent.setup().press(linha)
    expect(screen.getByRole('switch', { name: 'Avisos' })).toBeChecked()
    expect(screen.getByText('Ligado')).toBeOnTheScreen()
  })

  test('desabilitado não responde ao toque', async () => {
    const aoMudar = jest.fn()
    await render(<Interruptor rotulo="Avisos" ligado={false} aoMudar={aoMudar} desabilitado />)
    await userEvent.setup().press(screen.getByRole('switch', { name: 'Avisos' }))
    expect(aoMudar).not.toHaveBeenCalled()
  })
})

describe('Botão de ícone e botão de linha', () => {
  test('o botão de ícone é circular, tonal e sem borda; 44 de lado (alvo de 44)', async () => {
    await render(<BotaoIcone icone="voltar" rotulo="Voltar" aoPressionar={() => {}} />)
    expect(estilo(screen.getByRole('button', { name: 'Voltar' }))).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: C.botaoTonal,
      borderWidth: 0,
    })
  })

  test('o botão de linha é a cápsula tonal compacta de 40, sem contorno', async () => {
    await render(<BotaoDeLinha texto="Chegou" />)
    const caixa = screen.getByText('Chegou').parent as never
    expect(estilo(caixa)).toMatchObject({
      minHeight: 40,
      borderRadius: 999,
      backgroundColor: C.botaoTonal,
      borderWidth: 0,
    })
  })
})

describe('Par de botões (intervalo de 12; empilhado, o primário em cima)', () => {
  const janelaOriginal = Dimensions.get('window')
  afterEach(() => Dimensions.set({ window: janelaOriginal, screen: janelaOriginal }))

  function Par() {
    return (
      <ParDeBotoes>
        <Botao titulo="Salvar rascunho" variante="secundario" aoPressionar={() => {}} />
        <Botao titulo="Publicar" aoPressionar={() => {}} />
      </ParDeBotoes>
    )
  }

  test('lado a lado: secundário à esquerda, primário à direita', async () => {
    const janela = { width: 390, height: 844, scale: 3, fontScale: 1 }
    Dimensions.set({ window: janela, screen: janela })
    await render(<Par />)
    const rotulos = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)
    expect(rotulos).toEqual(['Salvar rascunho', 'Publicar'])
  })

  test('com fonte grande, empilha com o primário em cima', async () => {
    const janela = { width: 390, height: 844, scale: 3, fontScale: 1.64 }
    Dimensions.set({ window: janela, screen: janela })
    await render(<Par />)
    const rotulos = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)
    expect(rotulos).toEqual(['Publicar', 'Salvar rascunho'])
  })
})

describe('Barra de ação com botões grandes', () => {
  test('o motivo do botão desabilitado ocupa uma linha só, na largura toda', async () => {
    await render(
      <BarraDeAcao>
        <Botao titulo="Voltar" variante="secundario" tamanho="grande" aoPressionar={() => {}} />
        <Botao
          titulo="Publicar"
          tamanho="grande"
          desabilitado
          motivo="Falta escolher a data."
          aoPressionar={() => {}}
        />
      </BarraDeAcao>,
    )
    expect(screen.getAllByText('Falta escolher a data.')).toHaveLength(1)
    expect(estilo(screen.getByRole('button', { name: 'Publicar' })).minHeight).toBe(56)
  })
})

describe('Pílula de filtro tonal (D64)', () => {
  function Filtro() {
    const [v, setV] = useState<string[]>(['a'])
    return (
      <PilulasDeFiltro
        rotulo="Filtrar"
        pilulas={[
          { valor: 'a', rotulo: 'Todas' },
          { valor: 'b', rotulo: 'Minhas' },
        ]}
        selecionadas={v}
        aoMudar={setV}
        sangrar={false}
      />
    )
  }

  test('40 de altura em cápsula, tonal sem contorno; a ativa tem fundo quente, `destaque` e check', async () => {
    await render(<Filtro />)
    expect(estilo(screen.getByRole('radio', { name: 'Minhas' }))).toMatchObject({
      minHeight: 40,
      borderRadius: 999,
      backgroundColor: C.botaoTonal,
      borderWidth: 0,
    })
    expect(estilo(screen.getByRole('radio', { name: 'Todas' }))).toMatchObject({
      backgroundColor: C.quenteFundo,
    })
    expect(screen.getByText('Todas')).toHaveStyle({ color: C.destaque })
    expect(screen.getByRole('radio', { name: 'Minhas' })).toHaveProp('hitSlop', {
      top: 4,
      bottom: 4,
    })
  })
})

describe('PilulasDeFiltro com `quebrar` (D73): a escolha não rola para fora da tela', () => {
  function Quebra({ quebrar }: { quebrar: boolean }) {
    const [v, setV] = useState<string[]>(['a'])
    return (
      <PilulasDeFiltro
        rotulo="Onde"
        pilulas={[
          { valor: 'a', rotulo: 'Encontro inteiro' },
          { valor: 'b', rotulo: 'Boas-vindas' },
          { valor: 'c', rotulo: 'Louvor' },
        ]}
        selecionadas={v}
        aoMudar={setV}
        sangrar={false}
        quebrar={quebrar}
      />
    )
  }

  test('com `quebrar` as pílulas quebram de linha (sem rolagem) e seguem sendo um grupo de rádio', async () => {
    await render(<Quebra quebrar />)
    const grupo = screen.getByLabelText('Onde')
    expect(grupo).toHaveProp('accessibilityRole', 'radiogroup')
    expect(estilo(grupo as never)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' })
    // Nenhuma rolagem horizontal: a última pílula ("Louvor") não fica escondida à direita.
    expect(grupo).not.toHaveProp('horizontal')
    expect(screen.getByRole('radio', { name: 'Louvor' })).toBeOnTheScreen()
  })

  test('sem `quebrar` continua rolando de lado, como antes', async () => {
    await render(<Quebra quebrar={false} />)
    expect(screen.getByLabelText('Onde')).toHaveProp('horizontal', true)
  })
})

describe('Rádio e caixa de marcar de 24', () => {
  test('a linha marcada da lista de opções ganha a faixa quente de cantos redondos; as outras, não', async () => {
    await render(
      <View>
        <ListaDeOpcoes
          rotulo="Frequência"
          valor="a"
          aoMudar={() => {}}
          opcoes={[
            { valor: 'a', rotulo: 'Toda semana' },
            { valor: 'b', rotulo: 'Todo mês' },
          ]}
        />
      </View>,
    )
    const faixas = screen.getAllByTestId('faixa-da-opcao-marcada')
    expect(faixas).toHaveLength(1)
    expect(estilo(faixas[0] as never)).toMatchObject({ borderRadius: 14, left: 8, right: 8 })
    expect(
      within(screen.getByRole('radio', { name: 'Toda semana' })).getByTestId(
        'faixa-da-opcao-marcada',
      ),
    ).toBeOnTheScreen()
    expect(
      within(screen.getByRole('radio', { name: 'Todo mês' })).queryByTestId(
        'faixa-da-opcao-marcada',
      ),
    ).toBeNull()
  })

  test('a caixa de marcar tem 24, raio 8 e borda de 2; marcada, vira `primaria`', async () => {
    const { rerender } = await render(
      <CaixaDeMarcar rotulo="Li e aceito" marcada={false} aoMudar={() => {}} />,
    )
    const caixa = () =>
      estilo(screen.getByRole('checkbox', { name: 'Li e aceito' }).children[0] as never)
    expect(caixa()).toMatchObject({ width: 24, height: 24, borderRadius: 8, borderWidth: 2 })
    await rerender(<CaixaDeMarcar rotulo="Li e aceito" marcada aoMudar={() => {}} />)
    expect(caixa()).toMatchObject({ backgroundColor: C.primaria })
  })
})
