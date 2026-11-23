import { render, screen, userEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { LeitorDeCifra } from '../LeitorDeCifra'

const CIFRA = '{key: G}\n[G]Sobre a rocha eu [D]firmo os meus pés\n[Em]Quando o vento [C]vem'
const PRIMEIRA = 'Sobre a rocha eu firmo os meus pés'
const SEGUNDA = 'Quando o vento vem'

describe('leitor de cifra (D61, D82)', () => {
  test('no tom do dia: de G para A os acordes sobem dois tons', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tomDoDia="A" />)
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: A, E`)).toBeOnTheScreen()
    expect(screen.getByLabelText(`${SEGUNDA}. Acordes: F♯m, D`)).toBeOnTheScreen()
  })

  test('Subir tom e Descer tom: o tom escrito e os acordes mudam juntos, na hora', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tomDoDia="A" />)
    const usuario = userEvent.setup()
    expect(screen.queryByRole('button', { name: /^Voltar ao tom/ })).toBeNull()

    await usuario.press(screen.getByRole('button', { name: 'Subir tom' }))
    expect(screen.getByText('Tom B♭')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: B♭, F`)).toBeOnTheScreen()
    expect(screen.getByLabelText(`${SEGUNDA}. Acordes: Gm, E♭`)).toBeOnTheScreen()
    // O texto antigo não fica na tela ao lado do novo.
    expect(screen.queryByText('Tom A')).toBeNull()

    await usuario.press(screen.getByRole('button', { name: 'Descer tom' }))
    await usuario.press(screen.getByRole('button', { name: 'Descer tom' }))
    expect(screen.getByText('Tom A♭')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: A♭, E♭`)).toBeOnTheScreen()
  })

  test('mexeu no tom: diz que é só para a pessoa e "Voltar ao tom do dia (A)" desfaz', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tomDoDia="A" />)
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Subir tom' }))
    expect(screen.getByText('Só para você: o tom do dia continua A.')).toBeOnTheScreen()

    await usuario.press(screen.getByRole('button', { name: 'Voltar ao tom do dia (A)' }))
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: A, E`)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Voltar ao tom/ })).toBeNull()
  })

  test('sem tom do dia, vale o tom original e o botão diz "tom original"', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" />)
    expect(screen.getByText('Tom G')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: G, D`)).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Subir tom' }))
    expect(screen.getByRole('button', { name: 'Voltar ao tom original (G)' })).toBeOnTheScreen()
  })

  test('capotraste: soa em A, na casa 2, toca-se em G; Subir tom mantém a casa e muda as formas', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tomDoDia="A" />)
    const usuario = userEvent.setup()
    expect(screen.getByText('Capotraste: sem')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Descer casa' })).toBeDisabled()

    await usuario.press(screen.getByRole('button', { name: 'Subir casa' }))
    await usuario.press(screen.getByRole('button', { name: 'Subir casa' }))
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(screen.getByText('Capotraste na casa 2')).toBeOnTheScreen()
    expect(screen.getByText('Toque como se fosse em G. O som sai em A.')).toBeOnTheScreen()
    // As formas que a mão faz: G e D, o som é A.
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: G, D`)).toBeOnTheScreen()

    await usuario.press(screen.getByRole('button', { name: 'Subir tom' }))
    expect(screen.getByText('Tom B♭')).toBeOnTheScreen()
    expect(screen.getByText('Capotraste na casa 2')).toBeOnTheScreen()
    expect(screen.getByText('Toque como se fosse em A♭. O som sai em B♭.')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: A♭, E♭`)).toBeOnTheScreen()

    await usuario.press(screen.getByRole('button', { name: 'Descer casa' }))
    await usuario.press(screen.getByRole('button', { name: 'Descer casa' }))
    expect(screen.getByText('Capotraste: sem')).toBeOnTheScreen()
    expect(screen.queryByText(/Toque como se fosse/)).toBeNull()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: B♭, F`)).toBeOnTheScreen()
  })

  test('tamanho da letra com Letra menor e Letra maior, dentro dos limites', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tamanhoInicial={14} />)
    const usuario = userEvent.setup()
    const tamanhoDaLetra = () => {
      const trecho = screen.getByText('Sobre ')
      const estilo = Object.assign({}, ...([] as object[]).concat(trecho.props.style).flat(3))
      return (estilo as { fontSize: number }).fontSize
    }
    expect(screen.getByRole('button', { name: 'Letra menor' })).toBeDisabled()
    expect(tamanhoDaLetra()).toBe(14)
    await usuario.press(screen.getByRole('button', { name: 'Letra maior' }))
    expect(tamanhoDaLetra()).toBe(16)
  })

  test('os controles: nomes acessíveis iguais ao texto visível, alvo de 44 pt ou mais', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tomDoDia="A" />)
    await userEvent.setup().press(screen.getByRole('button', { name: 'Subir tom' }))
    const nomes = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string)
    expect(nomes).toEqual(
      expect.arrayContaining([
        'Descer tom',
        'Subir tom',
        'Descer casa',
        'Subir casa',
        'Letra menor',
        'Letra maior',
      ]),
    )
    for (const botao of screen.getAllByRole('button')) {
      expect(botao.props.accessibilityLabel).toBeTruthy()
      const e = StyleSheet.flatten(botao.props.style as never) as { minHeight?: number }
      expect(e?.minHeight ?? 44).toBeGreaterThanOrEqual(44)
    }
    // Os textos que ficaram para trás não existem mais.
    for (const antigo of ['Tom −', 'Tom +', 'A−', 'A+', 'Capo −', 'Capo +', 'Tom do dia']) {
      expect(screen.queryByText(antigo)).toBeNull()
    }
  })

  test('cifra em texto livre: avisa que não transpõe e desliga tom e capotraste', async () => {
    await render(
      <LeitorDeCifra cifra={'Só a letra da música\nsem nenhum acorde'} tomOriginal="G" />,
    )
    expect(screen.getByText('Sem transposição')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Subir tom' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Subir casa' })).toBeDisabled()
    expect(screen.getByText(/Só a letra da música/)).toBeOnTheScreen()
  })

  test('sem cifra: explica em vez de mostrar uma tela vazia', async () => {
    await render(<LeitorDeCifra cifra={null} tomOriginal="G" />)
    expect(screen.getByText('Esta música ainda não tem cifra')).toBeOnTheScreen()
  })

  test('acorde: negrito, em cor diferente da letra, e rótulo de seção em texto', async () => {
    await render(<LeitorDeCifra cifra={'{comment: Refrão}\n[G]Firme [D]em ti'} tomOriginal="G" />)
    expect(screen.getByText('Refrão')).toBeOnTheScreen()
    const estiloDe = (no: { props: Record<string, unknown> }) =>
      Object.assign({}, ...([] as object[]).concat(no.props.style as object[]).flat(3)) as {
        color: string
        fontFamily: string
      }
    const acorde = estiloDe(screen.getByText('G '))
    const letra = estiloDe(screen.getByText('Firme '))
    expect(acorde.fontFamily).toMatch(/(Bold|SemiBold|600|700)/i)
    expect(letra.fontFamily).not.toMatch(/(Bold|SemiBold|600|700)/i)
    // A cor do acorde é o token próprio (âmbar), não a da letra nem a do rótulo coral.
    expect(acorde.color).toBe('#FFD166')
    expect(acorde.color).not.toBe(letra.color)
  })
})

describe('o tom mostrado e os acordes mostrados andam juntos (D82)', () => {
  // Relato do dono: "isso é pra enfeitar? não funciona de fato". Cifra colada como "acordes sobre
  // a letra", com a linha "Tom: A" no texto, música com tom C na biblioteca e tom do dia A♭.
  // Antes: o rótulo dizia "Tom A♭", a cifra seguia em A e os botões ficavam desligados.
  const CIFRA_COLADA = [
    'Tom: A',
    '',
    'A         E',
    'Luz que desce do alto',
    'F#m       D',
    'Chega em cada coração',
  ].join('\n')

  test('cifra colada (acordes sobre a letra): o tom do dia muda os acordes da tela', async () => {
    await render(<LeitorDeCifra cifra={CIFRA_COLADA} tomOriginal="C" tomDoDia="Ab" />)
    expect(screen.getByText('Tom A♭')).toBeOnTheScreen()
    expect(screen.getByLabelText('Luz que desce do alto. Acordes: A♭, E♭')).toBeOnTheScreen()
    expect(screen.getByLabelText('Chega em cada coração. Acordes: Fm, D♭')).toBeOnTheScreen()
    // A linha "Tom: A" é dado da cifra, não letra: não fica na tela contradizendo o rótulo.
    expect(screen.queryByText(/Tom: A/)).toBeNull()
    expect(screen.queryByText('Sem transposição')).toBeNull()
  })

  test('Subir tom troca rótulo e acordes na mesma hora, e o botão está ligado', async () => {
    await render(<LeitorDeCifra cifra={CIFRA_COLADA} tomOriginal="C" tomDoDia="Ab" />)
    const subir = screen.getByRole('button', { name: 'Subir tom' })
    expect(subir).toBeEnabled()
    await userEvent.setup().press(subir)
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(screen.getByLabelText('Luz que desce do alto. Acordes: A, E')).toBeOnTheScreen()
  })

  test('o cadastro diz C e a cifra está em A: a tela explica e segue a cifra', async () => {
    await render(<LeitorDeCifra cifra={CIFRA_COLADA} tomOriginal="C" />)
    expect(screen.getByText('A cifra está escrita em A')).toBeOnTheScreen()
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
  })

  test('sem tom em lugar nenhum: o primeiro acorde dá o tom, dito como provável', async () => {
    await render(<LeitorDeCifra cifra={'[C]Linha [G]curta'} tomOriginal={null} />)
    expect(screen.getByText('Tom provável C')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Subir tom' }))
    expect(screen.getByText('Tom provável D♭')).toBeOnTheScreen()
    expect(screen.getByLabelText('Linha curta. Acordes: D♭, A♭')).toBeOnTheScreen()
  })
})
