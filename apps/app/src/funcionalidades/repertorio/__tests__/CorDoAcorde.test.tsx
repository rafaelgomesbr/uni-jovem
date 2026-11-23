import { prepararCifra } from '@uj/dominio'
import { contraste, MINIMO, TEMAS } from '@uj/tokens'
import { render, screen, userEvent } from '@testing-library/react-native'

import { ProvedorDeTemaForcado } from '@/ui/tema'

import { CifraNaTela } from '../CifraNaTela'
import { ModoPalco } from '../ModoPalco'
import { useAjustesDaCifra } from '../useAjustesDaCifra'

jest.mock('@/ui/acessibilidade', () => ({
  ...jest.requireActual('@/ui/acessibilidade'),
  usePreferenciasDeAcessibilidade: jest.fn(),
}))
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }))

const { usePreferenciasDeAcessibilidade } = jest.requireMock('@/ui/acessibilidade') as {
  usePreferenciasDeAcessibilidade: jest.Mock
}

function preferencias(aumentarContraste: boolean) {
  usePreferenciasDeAcessibilidade.mockReturnValue({
    reduzirMovimento: false,
    reduzirTransparencia: false,
    aumentarContraste,
  })
}

const linhas = prepararCifra('{key: G}\n[G]Firme [D]em ti', { tomOriginal: 'G' }).linhas

/** A cor de um texto desenhado, achatando os estilos aninhados. */
function corDe(texto: string): string {
  const no = screen.getByText(texto)
  const estilo = Object.assign({}, ...([] as object[]).concat(no.props.style).flat(3)) as {
    color: string
  }
  return estilo.color
}

const ESCURO = TEMAS.escuro.base

/** Como a tela desenha: a cifra sempre dentro do painel escuro forçado. */
function Painel() {
  return (
    <ProvedorDeTemaForcado nome="escuro">
      <CifraNaTela linhas={linhas} />
    </ProvedorDeTemaForcado>
  )
}

describe('cor do acorde (D82)', () => {
  test('é o token acorde, diferente da letra e do coral dos rótulos', async () => {
    preferencias(false)
    await render(<Painel />)
    expect(corDe('G ')).toBe(ESCURO.acorde)
    expect(ESCURO.acorde).not.toBe(ESCURO.destaque)
    expect(ESCURO.acorde).not.toBe(ESCURO.texto)
  })

  test('com Aumentar contraste, usa o acorde de alto contraste', async () => {
    preferencias(true)
    await render(<Painel />)
    expect(corDe('G ')).toBe(ESCURO.acordeContraste)
  })

  test('contraste AA medido: acorde sobre o painel e o palco, e nos dois temas', () => {
    for (const cor of [ESCURO.acorde, ESCURO.acordeContraste]) {
      expect(contraste(cor, ESCURO.fundo)).toBeGreaterThanOrEqual(MINIMO.texto)
      expect(contraste(cor, ESCURO.palco)).toBeGreaterThanOrEqual(MINIMO.texto)
    }
    const claro = TEMAS.claro.base
    for (const cor of [claro.acorde, claro.acordeContraste]) {
      expect(contraste(cor, claro.fundo)).toBeGreaterThanOrEqual(MINIMO.texto)
      expect(contraste(cor, claro.superficie)).toBeGreaterThanOrEqual(MINIMO.texto)
    }
    expect(ESCURO.acordeContraste).not.toBe(ESCURO.acorde)
  })

  test('o acorde fica em linha própria, acima da sílaba (a cor não é o único sinal)', async () => {
    preferencias(false)
    await render(<Painel />)
    expect(screen.getByLabelText('Firme em ti. Acordes: G, D')).toBeOnTheScreen()
    // Cada coluna tem o acorde e, logo abaixo, a sílaba: o acorde vem antes na ordem de leitura.
    const coluna = screen.getByText('G ').parent
    expect(coluna?.children[0]).toBe(screen.getByText('G '))
    expect(coluna?.children[1]).toBe(screen.getByText('Firme '))
  })
})

function PalcoComAjustes({ tomDoDia }: { tomDoDia: string | null }) {
  const ajustes = useAjustesDaCifra({ lembrar: false })
  return (
    <ModoPalco
      titulo="Brilhar por ti"
      cifra={'{key: G}\n[G]Firme [D]em ti'}
      tomOriginal="G"
      tomDoDia={tomDoDia}
      posicao={1}
      total={1}
      ajustes={ajustes}
      aoSair={jest.fn()}
      aoAnterior={null}
      aoProxima={null}
    />
  )
}

describe('Modo palco: controles claros e acorde colorido (D82)', () => {
  test('Subir tom muda o tom escrito e os acordes; Voltar ao tom do dia desfaz', async () => {
    preferencias(false)
    await render(<PalcoComAjustes tomDoDia="A" />)
    const usuario = userEvent.setup()
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Subir tom' }))
    expect(screen.getByText('Tom B♭')).toBeOnTheScreen()
    expect(screen.getByLabelText('Firme em ti. Acordes: B♭, F')).toBeOnTheScreen()
    expect(corDe('B♭ ')).toBe(ESCURO.acorde)
    await usuario.press(screen.getByRole('button', { name: 'Voltar ao tom do dia (A)' }))
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Letra maior' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'A+' })).toBeNull()
  })
})
