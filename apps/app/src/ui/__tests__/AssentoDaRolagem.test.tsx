/**
 * Assentar a rolagem perto da troca de cabeçalho (D58): nunca brigar com o
 * dedo e nunca repetir em laço quando a rolagem não consegue chegar ao ponto.
 */
import { RITMO } from '@uj/tokens'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ScrollView, Text } from 'react-native'

import { soltouSemInercia, Tela } from '../Tela'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(() => jest.fn()),
}))

describe('soltouSemInercia', () => {
  test('só com velocidade medida e quase zero', () => {
    expect(soltouSemInercia(0)).toBe(true)
    expect(soltouSemInercia(0.01)).toBe(true)
    expect(soltouSemInercia(-0.04)).toBe(true)
    expect(soltouSemInercia(0.5)).toBe(false)
    // Sem velocidade no evento (web, parte do Android): a inércia pode vir; não assenta agora.
    expect(soltouSemInercia(undefined)).toBe(false)
  })
})

const FIM_DO_TITULO = 200
/** Rolagem em que o título some por baixo do cabeçalho compacto (área segura 0 no teste). */
const LIMIAR = FIM_DO_TITULO + RITMO.topoDaTela - 52

async function telaMedida() {
  await render(
    <Tela pilha titulo="Agenda">
      <Text>Conteúdo</Text>
    </Tela>,
  )
  // A altura do título vem do onLayout do bloco do cabeçalho.
  let bloco = screen.getByText('Agenda').parent
  while (bloco && !bloco.props.onLayout) bloco = bloco.parent
  await fireEvent(bloco!, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 320, height: FIM_DO_TITULO } },
  })
  // O nó da rolagem é o primeiro ancestral do conteúdo que escuta o fim do momentum.
  let rolagem = screen.getByText('Conteúdo').parent
  while (rolagem && !rolagem.props.onMomentumScrollEnd) rolagem = rolagem.parent
  // O ScrollView de teste não rola de verdade: a chamada ao método é o que se observa.
  const scrollTo = (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype
    .scrollTo
  scrollTo.mockClear()
  return { rolagem: rolagem!, scrollTo }
}

const soltar = (velocidade: number | undefined, y: number) => ({
  nativeEvent: {
    contentOffset: { x: 0, y },
    ...(velocidade === undefined ? {} : { velocity: { x: 0, y: velocidade } }),
  },
})

describe('assentar a rolagem', () => {
  test('soltou parado no meio da troca: termina a troca uma vez só', async () => {
    const { rolagem, scrollTo } = await telaMedida()
    const meio = LIMIAR * 0.75
    await fireEvent(rolagem, 'scrollEndDrag', soltar(0, meio))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ y: LIMIAR + 1 }))
    // A rolagem não chegou lá (conteúdo curto) e avisa o fim do momentum no mesmo ponto: não repete.
    await fireEvent(rolagem, 'momentumScrollEnd', soltar(undefined, meio))
    await fireEvent(rolagem, 'momentumScrollEnd', soltar(undefined, meio))
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  test('tocar de novo libera um novo assentar', async () => {
    const { rolagem, scrollTo } = await telaMedida()
    const meio = LIMIAR * 0.75
    await fireEvent(rolagem, 'scrollEndDrag', soltar(0, meio))
    await fireEvent(rolagem, 'scrollBeginDrag', soltar(undefined, meio))
    await fireEvent(rolagem, 'scrollEndDrag', soltar(0, meio))
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })

  test('soltou com inércia ou sem velocidade no evento: espera o fim do momentum', async () => {
    const { rolagem, scrollTo } = await telaMedida()
    const meio = LIMIAR * 0.75
    await fireEvent(rolagem, 'scrollEndDrag', soltar(1.2, meio))
    await fireEvent(rolagem, 'scrollEndDrag', soltar(undefined, meio))
    expect(scrollTo).not.toHaveBeenCalled()
    await fireEvent(rolagem, 'momentumScrollEnd', soltar(undefined, meio))
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  test('já assentado (ponto alcançado): não pede nada e zera para a próxima vez', async () => {
    const { rolagem, scrollTo } = await telaMedida()
    await fireEvent(rolagem, 'momentumScrollEnd', soltar(undefined, LIMIAR + 1))
    await fireEvent(rolagem, 'momentumScrollEnd', soltar(undefined, 0))
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
