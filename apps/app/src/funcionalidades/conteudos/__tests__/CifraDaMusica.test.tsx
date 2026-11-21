import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { TelaConteudo } from '../TelaConteudo'
import { AVISO_DE_DIREITOS, TEXTO_DA_CONFIRMACAO_DE_DIREITOS } from '../tipos'

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

const COLADA = 'G       D\nSobre a rocha\nEm       C\nQuando o vento'
const CHORDPRO = '[G]Sobre a [D]rocha\n[Em]Quando o [C]vento'

const MUSICA = {
  id: '99999999-9999-4999-8999-000000000001',
  titulo: 'Grande é o Senhor',
  artista: null,
  tom: 'G',
  link: null,
  cifra: CHORDPRO,
  andamentoBpm: 72,
  duracaoSeg: 245,
  temCifra: true,
  observacoes: null,
  arquivada: false,
  musicos: [],
  versao: 3,
  criadoEm: '2026-11-01T12:00:00.000Z',
  atualizadoEm: '2026-11-01T12:00:00.000Z',
}

async function abrirNova() {
  jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
  return renderizarTela(<TelaConteudo novo />, {
    papel: 'organizador',
    rotas: {
      [`POST ${BASE}/conteudos/musicas`]: () => ({
        status: 200,
        corpo: { id: MUSICA.id, versao: 1 },
      }),
    },
  })
}

async function abrirEdicao(musica = MUSICA) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: musica.id })
  const r = await renderizarTela(<TelaConteudo />, {
    papel: 'organizador',
    rotas: {
      [`GET ${BASE}/conteudos/musicas/${musica.id}`]: () => ({ status: 200, corpo: musica }),
      [`GET ${BASE}/conteudos/musicos`]: () => ({ status: 200, corpo: { itens: [] } }),
      [`PATCH ${BASE}/conteudos/musicas/${musica.id}`]: () => ({
        status: 200,
        corpo: { id: musica.id, versao: 4 },
      }),
    },
  })
  await userEvent.setup().press(await screen.findByRole('button', { name: 'Editar a música' }))
  return r
}

describe('cifra da música: formulário e aviso de direitos autorais (D61)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('o aviso de direitos só aparece quando há cifra, e diz que ela não é pública', async () => {
    await abrirNova()
    await screen.findByLabelText(/^Título/)
    expect(screen.queryByText(AVISO_DE_DIREITOS)).toBeNull()
    await fireEvent.changeText(screen.getByLabelText(/^Cifra ou letra/), CHORDPRO)
    expect(await screen.findByText(AVISO_DE_DIREITOS)).toBeOnTheScreen()
    expect(AVISO_DE_DIREITOS).toMatch(/só dentro da comunidade/)
    expect(AVISO_DE_DIREITOS).toMatch(/não são públicas/)
    expect(AVISO_DE_DIREITOS).toMatch(/Cadastre só o que a sua comunidade pode usar/)
    expect(
      screen.getByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }),
    ).toBeOnTheScreen()
  })

  test('cifra nova só salva com a confirmação; sem ela, nenhum pedido sai', async () => {
    const { servidor } = await abrirNova()
    await fireEvent.changeText(await screen.findByLabelText(/^Título/), 'Grande é o Senhor')
    await fireEvent.changeText(screen.getByLabelText(/^Cifra ou letra/), CHORDPRO)
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(
      await screen.findByText('Confirme os direitos de uso para salvar a letra e a cifra.'),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)).toHaveLength(0)

    await usuario.press(screen.getByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }))
    await usuario.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)[0]!.corpo).toMatchObject({
      titulo: 'Grande é o Senhor',
      cifra: CHORDPRO,
      direitosConfirmados: true,
    })
  })

  test('música sem cifra salva sem pedir confirmação', async () => {
    const { servidor } = await abrirNova()
    await fireEvent.changeText(await screen.findByLabelText(/^Título/), 'Só o título')
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)[0]!.corpo).not.toHaveProperty(
      'direitosConfirmados',
    )
  })

  test('cifra com acordes sobre a letra: "Converter cifra colada" mostra o resultado antes de salvar', async () => {
    await abrirNova()
    await fireEvent.changeText(await screen.findByLabelText(/^Cifra ou letra/), COLADA)
    expect(
      await screen.findByText('Parece uma cifra com os acordes sobre a letra'),
    ).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Converter cifra colada' }))
    // O campo passa a ter ChordPro e a pré-visualização abre sozinha.
    expect(
      await screen.findByDisplayValue('[G]Sobre a [D]rocha\n[Em]Quando o [C]vento'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Convertida')).toBeOnTheScreen()
    expect(screen.getByLabelText('Pré-visualização da cifra')).toBeOnTheScreen()
    expect(screen.getByLabelText('Sobre a rocha. Acordes: G, D')).toBeOnTheScreen()
    expect(screen.getByText('ChordPro: o tom e o capotraste funcionam')).toBeOnTheScreen()
  })

  test('pré-visualização sob demanda e texto sem acordes avisa que não transpõe', async () => {
    await abrirNova()
    await fireEvent.changeText(
      await screen.findByLabelText(/^Cifra ou letra/),
      'Só uma letra\nsem nenhum acorde',
    )
    expect(await screen.findByText('Sem acordes reconhecidos')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Pré-visualização da cifra')).toBeNull()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Ver como vai aparecer' }))
    expect(await screen.findByLabelText('Pré-visualização da cifra')).toBeOnTheScreen()
  })

  test('tom, andamento e duração são conferidos antes de ir ao servidor', async () => {
    const { servidor } = await abrirNova()
    await fireEvent.changeText(await screen.findByLabelText(/^Título/), 'Música')
    await fireEvent.changeText(screen.getByLabelText(/^Tom/), 'xyz')
    await fireEvent.changeText(screen.getByLabelText(/^Andamento/), '10')
    await fireEvent.changeText(screen.getByLabelText(/^Duração/), '3:75')
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Use um tom como G, Am, F#m ou Bb.')).toBeOnTheScreen()
    expect(screen.getByText('Use um número de 30 a 300.')).toBeOnTheScreen()
    expect(screen.getByText('Use minutos e segundos, como 3:45.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)).toHaveLength(0)

    await fireEvent.changeText(screen.getByLabelText(/^Tom/), 'f#m')
    await fireEvent.changeText(screen.getByLabelText(/^Andamento/), '72')
    await fireEvent.changeText(screen.getByLabelText(/^Duração/), '3:45')
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)[0]!.corpo).toMatchObject({
      tom: 'F#m',
      andamentoBpm: 72,
      duracaoSeg: 225,
    })
  })

  test('edição: cifra igual à salva não pede confirmação; cifra mudada pede', async () => {
    const { servidor } = await abrirEdicao()
    const usuario = userEvent.setup()
    // A cifra salva e o aviso aparecem, mas sem a caixa de confirmação.
    expect(await screen.findByText(AVISO_DE_DIREITOS)).toBeOnTheScreen()
    expect(screen.queryByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS })).toBeNull()
    // A duração volta em minutos e segundos.
    expect(screen.getByDisplayValue('4:05')).toBeOnTheScreen()

    await fireEvent.changeText(screen.getByLabelText(/^Cifra ou letra/), '[A]Outra cifra')
    expect(
      await screen.findByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }),
    ).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(
      await screen.findByText('Confirme os direitos de uso para salvar a letra e a cifra.'),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'PATCH', `${BASE}/conteudos/musicas/${MUSICA.id}`)).toHaveLength(0)

    await usuario.press(screen.getByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }))
    await usuario.press(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PATCH', `${BASE}/conteudos/musicas/${MUSICA.id}`)).toHaveLength(
        1,
      ),
    )
    expect(
      pedidosPara(servidor, 'PATCH', `${BASE}/conteudos/musicas/${MUSICA.id}`)[0]!.corpo,
    ).toMatchObject({ cifra: '[A]Outra cifra', direitosConfirmados: true, versao: 3 })
  })

  test('leitura: cifra em ChordPro abre o leitor com tom e a lista mostra "Sem cifra"', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: MUSICA.id })
    await renderizarTela(<TelaConteudo />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({ status: 200, corpo: MUSICA }),
      },
    })
    expect(await screen.findByLabelText('Sobre a rocha. Acordes: G, D')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Subir meio tom' })).toBeOnTheScreen()
    expect(screen.getByText('72 bpm')).toBeOnTheScreen()
    expect(screen.getByText('4:05')).toBeOnTheScreen()
  })
})
