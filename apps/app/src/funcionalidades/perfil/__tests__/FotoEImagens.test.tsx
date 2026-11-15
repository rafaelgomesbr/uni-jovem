import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { Alert } from 'react-native'

import { BASE, COMUNIDADE, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { Avatar, definirAcessoDasImagens } from '@/ui/Avatar'
import { PilulaDaComunidade } from '@/ui/PilulaDaComunidade'

import { EditorDoLogotipo } from '../../comunidade/Identidade'
import { fotoDaConta, fotoDoMembro, logoDaComunidade } from '../imagens'
import { TelaEditarPerfil } from '../TelaEditarPerfil'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}))

// Câmera e galeria do sistema: o teste decide o que a pessoa escolheu.
jest.mock('expo-image-picker', () => ({
  CameraType: { front: 'front', back: 'back' },
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
}))

// Recorte e redução: um contexto encadeável que devolve o JPEG em base64.
jest.mock('expo-image-manipulator', () => {
  const imagem = {
    saveAsync: jest.fn(async () => ({
      uri: 'file:///cache/foto.jpg',
      width: 512,
      height: 512,
      base64: 'SlBFR19SRUNPUlRBRE8=',
    })),
    release: jest.fn(),
  }
  // O nome começa com "mock": o jest só deixa a fábrica citar nomes assim.
  interface MockDoContexto {
    crop: jest.Mock
    resize: jest.Mock
    renderAsync: jest.Mock
    release: jest.Mock
  }
  const contexto: MockDoContexto = {
    crop: jest.fn((): MockDoContexto => contexto),
    resize: jest.fn((): MockDoContexto => contexto),
    renderAsync: jest.fn(async () => imagem),
    release: jest.fn(),
  }
  return {
    ImageManipulator: { manipulate: jest.fn(() => contexto) },
    SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
    __contexto: contexto,
    __imagem: imagem,
  }
})

// A imagem nativa vira um nó com as mesmas props: o teste confere endereço e cabeçalho.
jest.mock('expo-image', () => {
  const { createElement } = require('react')
  const { View } = require('react-native')
  const Image = (props: object) => createElement(View, props)
  Image.clearMemoryCache = jest.fn(async () => true)
  return { Image }
})

const seletor = jest.requireMock('expo-image-picker') as {
  launchImageLibraryAsync: jest.Mock
  launchCameraAsync: jest.Mock
  requestCameraPermissionsAsync: jest.Mock
}
const manipulador = jest.requireMock('expo-image-manipulator') as {
  ImageManipulator: { manipulate: jest.Mock }
  __contexto: { crop: jest.Mock; resize: jest.Mock }
  __imagem: { saveAsync: jest.Mock }
}

const ESCOLHIDA = {
  canceled: false,
  assets: [{ uri: 'file:///galeria/praia.heic', width: 1200, height: 900 }],
}

function euComFoto(fotoVersao: string | null) {
  const eu = respostaEu('admin')
  return {
    ...eu,
    conta: { ...eu.conta, temFoto: fotoVersao !== null, fotoVersao },
    comunidades: eu.comunidades.map((c) => ({ ...c, temLogo: true, logoVersao: 'logo-v1' })),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  definirAcessoDasImagens(null)
})

describe('foto de perfil (D33)', () => {
  test('escolher da galeria recorta em 1:1, reduz para 512 e envia o JPEG em base64', async () => {
    seletor.launchImageLibraryAsync.mockResolvedValue(ESCOLHIDA)
    const { servidor } = await renderizarTela(<TelaEditarPerfil />, {
      rotas: {
        'GET /api/v1/eu': () => ({ status: 200, corpo: euComFoto(null) }),
        'PUT /api/v1/eu/foto': () => ({
          status: 200,
          corpo: { temFoto: true, fotoVersao: 'nova', tipo: 'image/webp' },
        }),
      },
    })

    await fireEvent.press(await screen.findByRole('button', { name: 'Escolher da galeria' }))

    await waitFor(() => expect(pedidosPara(servidor, 'PUT', '/api/v1/eu/foto')).toHaveLength(1))
    expect(pedidosPara(servidor, 'PUT', '/api/v1/eu/foto')[0]!.corpo).toEqual({
      imagem: 'SlBFR19SRUNPUlRBRE8=',
    })
    expect(seletor.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'] }),
    )
    // Quadrado central de 900 e redução para 512, em JPEG.
    expect(manipulador.__contexto.crop).toHaveBeenCalledWith({
      originX: 150,
      originY: 0,
      width: 900,
      height: 900,
    })
    expect(manipulador.__contexto.resize).toHaveBeenCalledWith({ width: 512, height: 512 })
    expect(manipulador.__imagem.saveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'jpeg', base64: true }),
    )
  })

  test('depois de trocar, Dados pessoais mostra a foto na hora e /eu é buscado de novo', async () => {
    seletor.launchImageLibraryAsync.mockResolvedValue(ESCOLHIDA)
    let enviou = false
    const { servidor } = await renderizarTela(<TelaEditarPerfil />, {
      rotas: {
        // Antes do envio, sem foto; depois, a busca de novo falha (rede ruim, por exemplo).
        'GET /api/v1/eu': () =>
          enviou
            ? { status: 503, corpo: { erro: 'indisponivel', mensagem: 'Fora do ar.' } }
            : { status: 200, corpo: euComFoto(null) },
        'PUT /api/v1/eu/foto': () => {
          enviou = true
          return { status: 200, corpo: { temFoto: true, fotoVersao: 'nova', tipo: 'image/webp' } }
        },
      },
    })
    expect(await screen.findByText(/Ainda sem imagem\./)).toBeOnTheScreen()
    const buscasAntes = pedidosPara(servidor, 'GET', '/api/v1/eu').length

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }))

    // A resposta do envio já basta: a foto nova vale mesmo sem a volta de /eu.
    expect(await screen.findByRole('button', { name: 'Remover foto' })).toBeOnTheScreen()
    expect(screen.queryByText(/Ainda sem imagem\./)).toBeNull()
    await waitFor(() =>
      expect(pedidosPara(servidor, 'GET', '/api/v1/eu').length).toBeGreaterThan(buscasAntes),
    )
  })

  test('desistir na galeria não envia nada', async () => {
    seletor.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null })
    const { servidor } = await renderizarTela(<TelaEditarPerfil />, {
      rotas: { 'GET /api/v1/eu': () => ({ status: 200, corpo: euComFoto(null) }) },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Escolher da galeria' }))
    await waitFor(() => expect(seletor.launchImageLibraryAsync).toHaveBeenCalled())
    expect(pedidosPara(servidor, 'PUT', '/api/v1/eu/foto')).toHaveLength(0)
  })

  test('câmera sem permissão: mensagem humana e nada enviado', async () => {
    seletor.requestCameraPermissionsAsync.mockResolvedValue({ granted: false })
    const { servidor } = await renderizarTela(<TelaEditarPerfil />, {
      rotas: { 'GET /api/v1/eu': () => ({ status: 200, corpo: euComFoto(null) }) },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Tirar foto' }))
    expect(await screen.findByText(/não tem acesso à câmera/)).toBeOnTheScreen()
    expect(seletor.launchCameraAsync).not.toHaveBeenCalled()
    expect(pedidosPara(servidor, 'PUT', '/api/v1/eu/foto')).toHaveLength(0)
  })

  test('erro do servidor (cota de envios) aparece em linguagem humana', async () => {
    seletor.launchImageLibraryAsync.mockResolvedValue(ESCOLHIDA)
    await renderizarTela(<TelaEditarPerfil />, {
      rotas: {
        'GET /api/v1/eu': () => ({ status: 200, corpo: euComFoto(null) }),
        'PUT /api/v1/eu/foto': () => ({
          status: 429,
          corpo: {
            erro: 'muitas_escritas',
            mensagem: 'Muitas alterações seguidas. Espere alguns minutos e tente de novo.',
          },
        }),
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Escolher da galeria' }))
    expect(await screen.findByText(/Espere alguns minutos/)).toBeOnTheScreen()
  })

  test('remover a foto confirma e chama o DELETE', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, b) => b?.at(-1)?.onPress?.())
    const { servidor } = await renderizarTela(<TelaEditarPerfil />, {
      rotas: {
        'GET /api/v1/eu': () => ({ status: 200, corpo: euComFoto('v1') }),
        'DELETE /api/v1/eu/foto': () => ({
          status: 200,
          corpo: { temFoto: false, fotoVersao: null },
        }),
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Remover foto' }))
    await waitFor(() => expect(pedidosPara(servidor, 'DELETE', '/api/v1/eu/foto')).toHaveLength(1))
  })
})

describe('avatar com e sem foto', () => {
  test('com foto: expo-image com o cabeçalho de acesso e a versão no endereço', async () => {
    definirAcessoDasImagens(async (caminho) => ({
      url: `https://api.teste${caminho}`,
      cabecalhos: { authorization: 'Bearer acesso-de-teste' },
    }))
    await render(
      <Avatar nome="Ana Souza" foto={{ caminho: '/api/v1/eu/foto', versao: 'v 1' }} proprio />,
    )
    const foto = await screen.findByTestId('foto-do-avatar', { includeHiddenElements: true })
    expect(foto.props.source).toEqual({
      uri: 'https://api.teste/api/v1/eu/foto?v=v%201',
      headers: { authorization: 'Bearer acesso-de-teste' },
    })
    // Nada da foto alheia no disco do aparelho.
    expect(foto.props.cachePolicy).toBe('memory')
    expect(screen.getByLabelText('Avatar de Ana Souza')).toBeOnTheScreen()
  })

  test('sem foto, ou sem como baixar: o avatar de sempre, sem imagem', async () => {
    await render(<Avatar nome="Ana Souza" proprio />)
    expect(screen.getByLabelText('Avatar de Ana Souza')).toBeOnTheScreen()
    expect(screen.queryByTestId('foto-do-avatar', { includeHiddenElements: true })).toBeNull()

    // Com foto, mas sem acesso registrado (sem sessão): continua o avatar de ícone e cor.
    await render(<Avatar nome="Ana Souza" foto={{ caminho: '/api/v1/eu/foto', versao: 'v1' }} />)
    await waitFor(() =>
      expect(screen.queryByTestId('foto-do-avatar', { includeHiddenElements: true })).toBeNull(),
    )
  })

  test('a foto que falha duas vezes some e fica o avatar de ícone e cor', async () => {
    const acesso = jest.fn(async (caminho: string) => ({
      url: `https://api.teste${caminho}`,
      cabecalhos: { authorization: 'Bearer acesso-vencido' },
    }))
    definirAcessoDasImagens(acesso)
    await render(<Avatar nome="Bruno Lima" foto={{ caminho: '/api/v1/eu/foto', versao: 'v1' }} />)
    let foto = await screen.findByTestId('foto-do-avatar', { includeHiddenElements: true })
    await fireEvent(foto, 'error')
    // Pede o endereço de novo (o acesso pode ter sido renovado) e tenta mais uma vez.
    await waitFor(() => expect(acesso).toHaveBeenCalledTimes(2))
    foto = await screen.findByTestId('foto-do-avatar', { includeHiddenElements: true })
    await fireEvent(foto, 'error')
    await waitFor(() =>
      expect(screen.queryByTestId('foto-do-avatar', { includeHiddenElements: true })).toBeNull(),
    )
  })

  test('fotos e logotipo a partir das respostas da API', () => {
    const conta = euComFoto('abc').conta
    expect(fotoDaConta(conta)).toEqual({ caminho: '/api/v1/eu/foto', versao: 'abc' })
    expect(fotoDaConta({ ...conta, temFoto: false })).toBeNull()
    expect(
      fotoDoMembro(COMUNIDADE, {
        vinculoId: 'v-1',
        contaId: 'c-1',
        nome: 'Bruno',
        papel: 'membro',
        estado: 'ativo',
        designacoes: [],
        email: null,
        whatsapp: null,
        criador: false,
        desde: '2026-01-01T00:00:00.000Z',
        temFoto: true,
        fotoVersao: 'f1',
      }),
    ).toEqual({ caminho: `${BASE}/pessoas/v-1/foto`, versao: 'f1' })
    expect(logoDaComunidade({ id: COMUNIDADE, temLogo: true, logoVersao: 'l1' })).toEqual({
      caminho: `${BASE}/logo`,
      versao: 'l1',
    })
    expect(logoDaComunidade({ id: COMUNIDADE })).toBeNull()
  })

  test('a pílula da comunidade mostra o logotipo no lugar das iniciais', async () => {
    definirAcessoDasImagens(async (caminho) => ({ url: caminho, cabecalhos: {} }))
    await render(
      <PilulaDaComunidade
        nome="Jovens Centro"
        vazia={false}
        podeTrocar
        rotulo="Comunidade Jovens Centro, Administrador. Trocar de comunidade"
        aoPressionar={jest.fn()}
        logo={{ caminho: `${BASE}/logo`, versao: 'l1' }}
      />,
    )
    const foto = await screen.findByTestId('foto-do-avatar', { includeHiddenElements: true })
    expect(foto.props.source.uri).toBe(`${BASE}/logo?v=l1`)
    expect(StyleSheet.flatten(foto.props.style)).toMatchObject({ position: 'absolute' })
  })
})

describe('logotipo da comunidade (D33)', () => {
  test('admin troca o logotipo com o mesmo fluxo e o PUT vai para a comunidade', async () => {
    seletor.launchImageLibraryAsync.mockResolvedValue(ESCOLHIDA)
    const { servidor } = await renderizarTela(
      <EditorDoLogotipo comunidade={{ id: COMUNIDADE, nome: 'Jovens Centro', cor: '#5B4BDB' }} />,
      {
        papel: 'admin',
        rotas: {
          [`PUT ${BASE}/logo`]: () => ({
            status: 200,
            corpo: { temLogo: true, logoVersao: 'novo' },
          }),
        },
      },
    )
    await fireEvent.press(await screen.findByRole('button', { name: 'Escolher da galeria' }))
    await waitFor(() => expect(pedidosPara(servidor, 'PUT', `${BASE}/logo`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'PUT', `${BASE}/logo`)[0]!.corpo).toEqual({
      imagem: 'SlBFR19SRUNPUlRBRE8=',
    })
  })

  test('remover o logotipo confirma e chama o DELETE', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, b) => b?.at(-1)?.onPress?.())
    const { servidor } = await renderizarTela(
      <EditorDoLogotipo
        comunidade={{
          id: COMUNIDADE,
          nome: 'Jovens Centro',
          cor: '#5B4BDB',
          temLogo: true,
          logoVersao: 'l1',
        }}
      />,
      {
        papel: 'admin',
        rotas: {
          [`DELETE ${BASE}/logo`]: () => ({ status: 200, corpo: { temLogo: false } }),
        },
      },
    )
    await fireEvent.press(await screen.findByRole('button', { name: 'Remover logotipo' }))
    await waitFor(() => expect(pedidosPara(servidor, 'DELETE', `${BASE}/logo`)).toHaveLength(1))
  })

  test('organizador não vê o editor do logotipo', async () => {
    await renderizarTela(
      <EditorDoLogotipo comunidade={{ id: COMUNIDADE, nome: 'Jovens Centro', cor: '#5B4BDB' }} />,
      { papel: 'organizador' },
    )
    await waitFor(() => expect(screen.queryByText('Logotipo')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Escolher da galeria' })).toBeNull()
  })
})
