/* eslint-disable no-script-url -- os casos incluem javascript: de propósito: a regra tem de recusá-lo */
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Linking } from 'react-native'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { escreverLinhas, lerLinhas, linhasDosLinks, validarLinhas } from '../links'
import { TelaConteudo } from '../TelaConteudo'
import { TelaConteudos } from '../TelaConteudos'
import { montarCorpo, TIPOS_DE_CONTEUDO, textoParaMostrar } from '../tipos'

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

const YT = 'https://www.youtube.com/watch?v=abc123'
const DRIVE = 'https://drive.google.com/file/d/1AbC/view'

const MUSICA = {
  id: '99999999-9999-4999-8999-000000000001',
  titulo: 'Grande é o Senhor',
  artista: 'Ministério Exemplo',
  tom: 'G',
  link: null,
  links: [{ url: YT, rotulo: 'Versão original' }, { url: DRIVE }],
  cifra: null,
  observacoes: null,
  arquivada: false,
  musicos: [],
  versao: 3,
  criadoEm: '2026-11-01T12:00:00.000Z',
  atualizadoEm: '2026-11-01T12:00:00.000Z',
}

describe('links no formulário (funções puras)', () => {
  test('as linhas viajam como texto e voltam iguais, com a mesma identidade', () => {
    const linhas = linhasDosLinks([{ url: YT, rotulo: 'Ao vivo' }, { url: DRIVE }])
    expect(linhas.map((l) => ({ url: l.url, rotulo: l.rotulo }))).toEqual([
      { url: YT, rotulo: 'Ao vivo' },
      { url: DRIVE, rotulo: '' },
    ])
    expect(lerLinhas(escreverLinhas(linhas))).toEqual(linhas)
    expect(escreverLinhas([])).toBe('')
    expect(lerLinhas('')).toEqual([])
    expect(lerLinhas('isto não é json')).toEqual([])
    expect(lerLinhas('{"a":1}')).toEqual([])
  })

  test('linha em branco é ignorada; o endereço vai sem espaços e o nome só quando há', () => {
    const r = validarLinhas([
      { id: 'a', url: `  ${YT}  `, rotulo: '  Ao vivo ' },
      { id: 'b', url: '', rotulo: '' },
      { id: 'c', url: DRIVE, rotulo: '' },
    ])
    expect(r.erros).toEqual({})
    expect(r.links).toEqual([{ url: YT, rotulo: 'Ao vivo' }, { url: DRIVE }])
  })

  test.each([
    ['https://exemplo.test/x', /Google Drive ou do YouTube/],
    ['http://youtu.be/x', /começar com https/],
    ['javascript:alert(1)', /começar com https/],
    ['data:text/html,x', /começar com https/],
    ['https://a:b@youtu.be/x', /usuário e senha/],
    ['https://youtu.be/a b', /espaços/],
  ])('recusa %s com uma frase que diz o que fazer', (url, frase) => {
    const r = validarLinhas([{ id: 'x', url, rotulo: '' }])
    expect(r.erros['links:x']).toMatch(frase)
  })

  test('nome sem endereço pede o endereço; nome grande demais e mais de 3 links são recusados', () => {
    expect(validarLinhas([{ id: 'x', url: '', rotulo: 'Cifra' }]).erros['links:x']).toMatch(
      /Cole o link/,
    )
    expect(
      validarLinhas([{ id: 'x', url: YT, rotulo: 'x'.repeat(41) }]).erros['links:x:rotulo'],
    ).toMatch(/até 40 letras/)
    const quatro = ['a', 'b', 'c', 'd'].map((id) => ({ id, url: YT, rotulo: '' }))
    expect(validarLinhas(quatro).erros['links']).toMatch(/até 3 links/)
  })

  test('o corpo da música leva `links` (vazio apaga na edição) e o link antigo não vai mais', () => {
    const def = TIPOS_DE_CONTEUDO.musicas
    expect(def.campos.some((c) => c.campo === 'link')).toBe(false)
    const com = montarCorpo(def, {
      titulo: 'X',
      links: escreverLinhas([{ id: 'a', url: YT, rotulo: '' }]),
    })
    expect('corpo' in com && com.corpo['links']).toEqual([{ url: YT }])
    const sem = montarCorpo(def, { titulo: 'X' })
    expect('corpo' in sem && sem.corpo['links']).toEqual([])
    const ruim = montarCorpo(def, {
      titulo: 'X',
      links: escreverLinhas([{ id: 'a', url: 'https://exemplo.test', rotulo: '' }]),
    })
    expect('erros' in ruim && ruim.erros['links:a']).toBeTruthy()
  })

  test('o texto do campo vem vazio sem links', () => {
    const campo = TIPOS_DE_CONTEUDO.musicas.campos.find((c) => c.campo === 'links')!
    expect(textoParaMostrar(campo, [])).toBe('')
    expect(textoParaMostrar(campo, undefined)).toBe('')
    expect(textoParaMostrar(campo, [{ url: YT }])).not.toBe('')
  })
})

describe('links na Biblioteca (D80)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('quem lê a música vê um botão por link e, ao tocar, o link abre no sistema, com o aviso de que sai do app', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: MUSICA.id })
    await renderizarTela(<TelaConteudo />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({ status: 200, corpo: MUSICA }),
      },
    })
    expect(await screen.findByText('Versão original')).toBeOnTheScreen()
    expect(screen.getByText(/você sai do Uni Jovem/)).toBeOnTheScreen()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Abrir no YouTube: Versão original' }))
    expect(abrir).toHaveBeenCalledWith(YT)
    await usuario.press(screen.getByRole('button', { name: 'Abrir no Drive: Grande é o Senhor' }))
    expect(abrir).toHaveBeenLastCalledWith(DRIVE)
  })

  test('o link nunca é obrigatório: sem links não há seção nem botão', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: MUSICA.id })
    await renderizarTela(<TelaConteudo />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({
          status: 200,
          corpo: { ...MUSICA, links: [], cifra: 'G D' },
        }),
      },
    })
    expect(await screen.findByText('G D')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Abrir no / })).toBeNull()
  })

  test('endereço de fora da regra, mesmo vindo do servidor, nunca vira botão', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: MUSICA.id })
    await renderizarTela(<TelaConteudo />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({
          status: 200,
          corpo: { ...MUSICA, links: [{ url: 'javascript:alert(1)' }], cifra: 'G D' },
        }),
      },
    })
    expect(await screen.findByText('G D')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Abrir no / })).toBeNull()
  })

  test('a lista diz em texto quais links a música tem', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    await renderizarTela(<TelaConteudos />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { itens: [MUSICA] } }),
      },
    })
    expect(await screen.findByText(/Links: YouTube e Drive/)).toBeOnTheScreen()
  })

  test('música nova: "Adicionar link" com a ajuda, validação humana e o corpo com `links`', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    const { servidor } = await renderizarTela(<TelaConteudo novo />, {
      papel: 'organizador',
      rotas: {
        [`POST ${BASE}/conteudos/musicas`]: () => ({
          status: 200,
          corpo: { id: 'nova', versao: 1 },
        }),
      },
    })
    expect(await screen.findByText(/Cole o link do Drive ou do YouTube/)).toBeOnTheScreen()
    await fireEvent.changeText(await screen.findByLabelText(/^Título/), 'Oceanos')
    await fireEvent.press(screen.getByRole('button', { name: /^Adicionar link/ }))
    await fireEvent.changeText(await screen.findByLabelText('Link 1'), 'https://exemplo.test/x')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText(/Google Drive ou do YouTube/)).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)).toHaveLength(0)

    await fireEvent.changeText(screen.getByLabelText('Link 1'), YT)
    await fireEvent.changeText(screen.getByLabelText(/Nome do link 1/), 'Ao vivo')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)[0]?.corpo).toEqual({
        titulo: 'Oceanos',
        links: [{ url: YT, rotulo: 'Ao vivo' }],
      }),
    )
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/conteudos/[tipo]/[itemId]',
        params: { tipo: 'musicas', itemId: 'nova' },
      }),
    )
  })

  test('música nova sem link: nenhum campo de link aparece e o corpo não leva `links`', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    const { servidor } = await renderizarTela(<TelaConteudo novo />, {
      papel: 'organizador',
      rotas: {
        [`POST ${BASE}/conteudos/musicas`]: () => ({
          status: 200,
          corpo: { id: 'nova', versao: 1 },
        }),
      },
    })
    expect(screen.queryByLabelText('Link 1')).toBeNull()
    await fireEvent.changeText(await screen.findByLabelText(/^Título/), 'Oceanos')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)[0]?.corpo).toEqual({
        titulo: 'Oceanos',
      }),
    )
  })

  test('no máximo 3 links: o botão some e o texto explica', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    await renderizarTela(<TelaConteudo novo />, { papel: 'organizador' })
    const usuario = userEvent.setup()
    for (let i = 0; i < 3; i++) {
      await usuario.press(await screen.findByRole('button', { name: /^Adicionar (outro )?link/ }))
    }
    expect(screen.queryByRole('button', { name: /^Adicionar (outro )?link/ })).toBeNull()
    expect(screen.getByText(/Você já adicionou os 3 links/)).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Remover o link 2' }))
    expect(screen.getByRole('button', { name: /^Adicionar outro link/ })).toBeOnTheScreen()
  })

  test('edição: mostra os links salvos, troca a lista inteira e o corpo leva `links`', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: MUSICA.id })
    const { servidor } = await renderizarTela(<TelaConteudo />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({ status: 200, corpo: MUSICA }),
        [`GET ${BASE}/conteudos/musicos`]: () => ({ status: 200, corpo: { itens: [] } }),
        [`PATCH ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({
          status: 200,
          corpo: { id: MUSICA.id, versao: 4 },
        }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Editar a música' }))
    expect(await screen.findByDisplayValue(YT)).toBeOnTheScreen()
    expect(screen.getByDisplayValue('Versão original')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Remover o link 2' }))
    await usuario.press(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() =>
      expect(
        pedidosPara(servidor, 'PATCH', `${BASE}/conteudos/musicas/${MUSICA.id}`)[0]?.corpo,
      ).toMatchObject({ links: [{ url: YT, rotulo: 'Versão original' }], versao: 3 }),
    )
  })

  test('link antigo (qualquer https): aparece só para ler, abre, e a organização o remove', async () => {
    const antigo = { ...MUSICA, links: [], link: 'https://exemplo.com/cifra' }
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: MUSICA.id })
    const { servidor } = await renderizarTela(<TelaConteudo />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({ status: 200, corpo: antigo }),
        [`GET ${BASE}/conteudos/musicos`]: () => ({ status: 200, corpo: { itens: [] } }),
        [`PATCH ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({
          status: 200,
          corpo: { id: MUSICA.id, versao: 4 },
        }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(
      await screen.findByRole('link', { name: 'Abrir o link antigo: https://exemplo.com/cifra' }),
    )
    expect(abrir).toHaveBeenCalledWith('https://exemplo.com/cifra')
    await usuario.press(screen.getByRole('button', { name: 'Editar a música' }))
    await usuario.press(await screen.findByRole('button', { name: 'Remover o link antigo' }))
    await waitFor(() =>
      expect(
        pedidosPara(servidor, 'PATCH', `${BASE}/conteudos/musicas/${MUSICA.id}`)[0]?.corpo,
      ).toEqual({ link: null, versao: 3 }),
    )
  })
})
