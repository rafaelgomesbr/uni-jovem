import { render, screen, userEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { LeitorDeCifra } from '../LeitorDeCifra'

const CIFRA = '{key: G}\n[G]Sobre a rocha eu [D]firmo os meus pés\n[Em]Quando o vento [C]vem'
const PRIMEIRA = 'Sobre a rocha eu firmo os meus pés'
const SEGUNDA = 'Quando o vento vem'

describe('leitor de cifra (D61)', () => {
  test('no tom do dia: de G para A os acordes sobem dois tons', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tomDoDia="A" />)
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: A, E`)).toBeOnTheScreen()
    expect(screen.getByLabelText(`${SEGUNDA}. Acordes: F♯m, D`)).toBeOnTheScreen()
  })

  test('transpor na tela: meio tom para cima e para baixo, e voltar ao tom do dia', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tomDoDia="A" />)
    const usuario = userEvent.setup()
    expect(screen.queryByRole('button', { name: 'Voltar ao tom do dia' })).toBeNull()

    await usuario.press(screen.getByRole('button', { name: 'Subir meio tom' }))
    expect(screen.getByText('Tom B♭')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: B♭, F`)).toBeOnTheScreen()
    expect(screen.getByLabelText(`${SEGUNDA}. Acordes: Gm, E♭`)).toBeOnTheScreen()

    await usuario.press(screen.getByRole('button', { name: 'Descer meio tom' }))
    await usuario.press(screen.getByRole('button', { name: 'Descer meio tom' }))
    expect(screen.getByText('Tom A♭')).toBeOnTheScreen()

    await usuario.press(screen.getByRole('button', { name: 'Voltar ao tom do dia' }))
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: A, E`)).toBeOnTheScreen()
  })

  test('sem tom do dia, vale o tom original da música', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" />)
    expect(screen.getByText('Tom G')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: G, D`)).toBeOnTheScreen()
  })

  test('capotraste: soa em A, capotraste na 2ª casa, toca-se em G', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tomDoDia="A" />)
    const usuario = userEvent.setup()
    expect(screen.getByRole('button', { name: 'Capotraste uma casa abaixo' })).toBeDisabled()
    await usuario.press(screen.getByRole('button', { name: 'Capotraste uma casa acima' }))
    await usuario.press(screen.getByRole('button', { name: 'Capotraste uma casa acima' }))
    // No alto: o tom que soa e o capotraste; embaixo, o tom que se toca (soa em A, toque em G).
    expect(screen.getByText('Tom A  ·  Capotraste 2')).toBeOnTheScreen()
    expect(
      screen.getByLabelText('Soa em A. Toque em G com o capotraste na 2ª casa.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Toca-se em G (capotraste na 2ª casa)')).toBeOnTheScreen()
    expect(screen.getByLabelText(`${PRIMEIRA}. Acordes: G, D`)).toBeOnTheScreen()
    expect(screen.getByText('Capotraste: casa 2')).toBeOnTheScreen()
  })

  test('tamanho da letra com A− e A+, dentro dos limites', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tamanhoInicial={14} />)
    const usuario = userEvent.setup()
    expect(screen.getByText('Letra: 14')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Diminuir a letra' })).toBeDisabled()
    await usuario.press(screen.getByRole('button', { name: 'Aumentar a letra' }))
    expect(screen.getByText('Letra: 16')).toBeOnTheScreen()
  })

  test('todo botão tem nome acessível e nenhum alvo é menor que 44 pt', async () => {
    await render(<LeitorDeCifra cifra={CIFRA} tomOriginal="G" tomDoDia="A" />)
    await userEvent.setup().press(screen.getByRole('button', { name: 'Subir meio tom' }))
    for (const botao of screen.getAllByRole('button')) {
      expect(botao.props.accessibilityLabel).toBeTruthy()
      const e = StyleSheet.flatten(botao.props.style as never) as { minHeight?: number }
      expect(e?.minHeight ?? 44).toBeGreaterThanOrEqual(44)
    }
  })

  test('cifra em texto livre: avisa que não transpõe e desliga tom e capotraste', async () => {
    await render(
      <LeitorDeCifra cifra={'Só a letra da música\nsem nenhum acorde'} tomOriginal="G" />,
    )
    expect(screen.getByText('Sem transposição')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Subir meio tom' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Capotraste uma casa acima' })).toBeDisabled()
    expect(screen.getByText(/Só a letra da música/)).toBeOnTheScreen()
  })

  test('sem cifra: explica em vez de mostrar uma tela vazia', async () => {
    await render(<LeitorDeCifra cifra={null} tomOriginal="G" />)
    expect(screen.getByText('Esta música ainda não tem cifra')).toBeOnTheScreen()
  })

  test('acordes em negrito e rótulo de seção em texto (a cor não é o único sinal)', async () => {
    await render(<LeitorDeCifra cifra={'{comment: Refrão}\n[G]Firme [D]em ti'} tomOriginal="G" />)
    expect(screen.getByText('Refrão')).toBeOnTheScreen()
    const acorde = screen.getByText('G ')
    expect(JSON.stringify(acorde.props.style)).toMatch(
      /"fontFamily":"[^"]*(Bold|SemiBold|600|700)/i,
    )
  })
})
