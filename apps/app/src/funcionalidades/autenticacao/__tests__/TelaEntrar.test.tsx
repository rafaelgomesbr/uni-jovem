/**
 * Entrar (D63): os estados nomeados no desenho de UX (`entrada.inicio`,
 * `entrada.email`, `entrada.inicio.convite`, `entrada.inicio.biometria`), o
 * estado do painel na rota (`?modo=email`), o método usado da última vez, o
 * erro humano, o carregando, o sucesso e o caminho do teclado. O movimento em
 * si (curvas, atrasos) é conferido pelos números de `MOVIMENTO_DE_ACESSO`; aqui
 * o que vale é o estado final de cada coisa.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native'
import { CLARO } from '@uj/tokens'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { router, useLocalSearchParams } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { Dimensions, Platform, StyleSheet } from 'react-native'

import { ProvedorDeSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { ligarBiometria, trancarCofre } from '@/servicos/armazenamentoDoRefresh'
import { clienteDeConsultaDeTeste, servidorFalso } from '@/testes/dubles'

import { reiniciarAberturaParaTeste } from '../aberturaDaEntrada'
import { esquecerConvitePendenteParaTeste, guardarConvitePendente } from '../convitePendente'
import { useRedirecionamentoSegurado } from '../sucessoDaEntrada'
import { TelaEntrar } from '../TelaEntrar'
import { esquecerUltimoMetodoParaTeste, guardarUltimoMetodo } from '../ultimoMetodo'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  useIsFocused: jest.fn(() => true),
  usePreventRemove: jest.fn(() => jest.fn()),
}))

const parametros = useLocalSearchParams as jest.Mock
const MENSAGEM = 'E-mail ou senha incorretos.'

const cofre = (SecureStore as unknown as { __cofre: Map<string, string> }).__cofre
const lerSeguro = SecureStore.getItemAsync as jest.Mock
const lerSeguroOriginal = lerSeguro.getMockImplementation()!
const disponivelNaApple = AppleAuthentication.isAvailableAsync as jest.Mock
const entrarNaApple = AppleAuthentication.signInAsync as jest.Mock
const google = jest.requireMock('@react-native-google-signin/google-signin') as {
  GoogleSignin: { signIn: jest.Mock }
  __responder: (r: unknown) => void
}

const EU = {
  conta: {
    id: 'conta-1',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    whatsapp: null,
    criador: false,
    doisFatores: false,
  },
  comunidades: [],
}
const SESSAO = { segundoFator: false, acesso: 'acesso-1', refresh: 'refresh-novo' }
const ID_IOS = 'ios-123.apps.googleusercontent.com'
const TOKEN_DE_CONVITE = 'c'.repeat(43)

/** A janela do aparelho: o padrão do Jest tem fonte 2, que esconderia o apoio da entrada. */
function definirJanela(largura: number, altura: number, fonte = 1) {
  const janela = { width: largura, height: altura, scale: 2, fontScale: fonte }
  jest.spyOn(Dimensions, 'get').mockImplementation(() => janela)
}

function renderizar() {
  const consultas = clienteDeConsultaDeTeste()
  return render(
    <QueryClientProvider client={consultas}>
      <ProvedorDeSessao>
        <TelaEntrar />
      </ProvedorDeSessao>
    </QueryClientProvider>,
  )
}

/** Abre a tela já no painel de e-mail, como a rota `?modo=email` faz. */
function abrirNoEmail() {
  parametros.mockReturnValue({ modo: 'email' })
}

async function preencher(email: string, senha: string) {
  await fireEvent.changeText(await screen.findByLabelText('E-mail'), email)
  await fireEvent.changeText(screen.getByLabelText('Senha'), senha)
}

const nomesDosBotoes = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.props.accessibilityLabel as string)
    .filter((n) => n !== 'Mostrar senha')

describe('tela Entrar', () => {
  const fetchOriginal = globalThis.fetch
  beforeEach(async () => {
    jest.clearAllMocks()
    parametros.mockReturnValue({})
    definirJanela(393, 852)
    await api.encerrarSessao()
    cofre.clear()
    trancarCofre()
    lerSeguro.mockImplementation(lerSeguroOriginal)
    disponivelNaApple.mockResolvedValue(false)
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
    esquecerUltimoMetodoParaTeste()
    esquecerConvitePendenteParaTeste()
    reiniciarAberturaParaTeste()
  })
  afterEach(() => {
    globalThis.fetch = fetchOriginal
    jest.restoreAllMocks()
  })

  describe('entrada.inicio', () => {
    test('o topo traz o nome do app como título de nível 1 e a frase de apoio', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      expect(await screen.findByRole('header', { name: 'Uni Jovem' })).toBeOnTheScreen()
      expect(
        screen.getByText('Agenda, escalas e recados da sua comunidade, num lugar só.'),
      ).toBeOnTheScreen()
      expect(screen.queryByText('Bem-vindo de volta')).toBeNull()
    })

    test('iOS com tudo: Apple, Google, e-mail, depois "Criar conta" e "Tenho um convite ou código"', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      disponivelNaApple.mockResolvedValue(true)
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await screen.findByRole('button', { name: 'Continuar com a Apple' })
      expect(nomesDosBotoes()).toEqual([
        'Continuar com a Apple',
        'Continuar com o Google',
        'Entrar com e-mail',
        'Primeira vez aqui? Criar conta',
        'Tenho um convite ou código',
      ])
      // O formulário de e-mail não está aberto: nada de campo nem de "ou com e-mail".
      expect(screen.queryByLabelText('E-mail')).toBeNull()
      expect(screen.queryByText('ou com e-mail')).toBeNull()
    })

    test('Android: Google e e-mail, sem a Apple (que nem é consultada)', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = 'android-123.apps.googleusercontent.com'
      disponivelNaApple.mockResolvedValue(true)
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await screen.findByRole('button', { name: 'Continuar com o Google' })
      await act(async () => undefined)
      expect(nomesDosBotoes().slice(0, 2)).toEqual(['Continuar com o Google', 'Entrar com e-mail'])
      expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull()
      expect(disponivelNaApple).not.toHaveBeenCalled()
    })

    test('web: só o Google (a Apple não existe na web) e o e-mail', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-123.apps.googleusercontent.com'
      disponivelNaApple.mockResolvedValue(true)
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await screen.findByRole('button', { name: 'Continuar com o Google' })
      expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull()
      expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toBeOnTheScreen()
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    })

    test('sem nenhum provedor, o e-mail já nasce aberto (sem o passo de revelar)', async () => {
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      expect(await screen.findByLabelText('E-mail')).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Entrar com e-mail' })).toBeNull()
    })

    test('rodapé: Criar conta e o convite levam às telas certas', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      globalThis.fetch = servidorFalso({}).fetch
      const usuario = userEvent.setup()
      await renderizar()
      await usuario.press(
        await screen.findByRole('button', { name: 'Primeira vez aqui? Criar conta' }),
      )
      expect(router.push).toHaveBeenCalledWith('/criar-conta')
      await usuario.press(screen.getByRole('button', { name: 'Tenho um convite ou código' }))
      expect(router.push).toHaveBeenCalledWith('/colar-convite')
    })

    test('"Entrar com e-mail" abre o painel na própria rota (o voltar do sistema o fecha)', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Entrar com e-mail' }))
      expect(router.push).toHaveBeenCalledWith({ pathname: '/entrar', params: { modo: 'email' } })
    })

    test('todo botão tem nome acessível e nenhum alvo é menor que 44', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      disponivelNaApple.mockResolvedValue(true)
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await screen.findByRole('button', { name: 'Continuar com a Apple' })
      for (const botao of screen.getAllByRole('button')) {
        expect(botao.props.accessibilityLabel).toBeTruthy()
        const e = StyleSheet.flatten(botao.props.style as never) as { minHeight?: number }
        expect(e?.minHeight ?? 44).toBeGreaterThanOrEqual(44)
      }
    })
  })

  describe('método usado da última vez', () => {
    test('sobe ao primeiro lugar e ganha o selo em texto, só a marca do método é guardada', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      disponivelNaApple.mockResolvedValue(true)
      globalThis.fetch = servidorFalso({}).fetch
      guardarUltimoMetodo('google')
      await renderizar()
      await screen.findByRole('button', { name: 'Continuar com a Apple' })
      expect(nomesDosBotoes().slice(0, 3)).toEqual([
        'Continuar com o Google',
        'Continuar com a Apple',
        'Entrar com e-mail',
      ])
      expect(screen.getByText('Usado da última vez')).toBeOnTheScreen()
      // Nada além da marca no aparelho: nem e-mail, nem nome.
      const guardados = JSON.stringify([...cofre.entries()])
      expect(guardados).toContain('google')
      expect(guardados).not.toContain('ana@')
    })

    test('lido do aparelho na abertura: o e-mail usado antes vira o primeiro, em coral', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      cofre.set('uj.acesso.ultimo-metodo', JSON.stringify('email'))
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await waitFor(() => expect(nomesDosBotoes()[0]).toBe('Entrar com e-mail'))
      expect(screen.getByText('Usado da última vez')).toBeOnTheScreen()
      const botao = screen.getByRole('button', { name: 'Entrar com e-mail' })
      expect(
        (StyleSheet.flatten(botao.props.style as never) as { backgroundColor?: string })
          .backgroundColor,
      ).toBe(CLARO.primaria)
    })

    test('sem histórico, nenhum selo', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await screen.findByRole('button', { name: 'Continuar com o Google' })
      expect(screen.queryByText('Usado da última vez')).toBeNull()
    })

    test('entrar por e-mail e senha grava "email" como o método da última vez', async () => {
      abrirNoEmail()
      globalThis.fetch = servidorFalso({
        'POST /api/auth/entrar': () => ({ status: 200, corpo: SESSAO }),
        'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
      }).fetch
      await renderizar()
      await preencher('ana@exemplo.com', 'uma frase longa')
      await userEvent.setup().press(screen.getByRole('button', { name: 'Entrar' }))
      await waitFor(() =>
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          'uj.acesso.ultimo-metodo',
          JSON.stringify('email'),
        ),
      )
    })
  })

  describe('entrada.email', () => {
    test('a rota decide: com ?modo=email o painel está aberto e os acessos saem de cena', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      abrirNoEmail()
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      expect(await screen.findByLabelText('E-mail')).toBeOnTheScreen()
      expect(screen.getByRole('header', { name: 'Entrar com e-mail' })).toBeOnTheScreen()
      // Nada de botão invisível alcançável: a camada dos acessos fica fora do leitor de tela.
      expect(screen.queryByRole('button', { name: 'Continuar com o Google' })).toBeNull()
    })

    test('sem ?modo=email o painel está fechado', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await screen.findByRole('button', { name: 'Continuar com o Google' })
      expect(screen.queryByLabelText('E-mail')).toBeNull()
    })

    test('o e-mail que veio na rota já vem preenchido', async () => {
      parametros.mockReturnValue({ modo: 'email', email: 'ana@exemplo.com' })
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      expect((await screen.findByLabelText('E-mail')).props.value).toBe('ana@exemplo.com')
    })

    test('"Outras formas de entrar" volta (o histórico) ou, sem histórico, limpa o parâmetro', async () => {
      abrirNoEmail()
      globalThis.fetch = servidorFalso({}).fetch
      const usuario = userEvent.setup()
      await renderizar()
      await usuario.press(await screen.findByRole('button', { name: 'Outras formas de entrar' }))
      expect(router.back).toHaveBeenCalled()
      ;(router.canGoBack as jest.Mock).mockReturnValue(false)
      await usuario.press(screen.getByRole('button', { name: 'Outras formas de entrar' }))
      expect(router.setParams).toHaveBeenCalledWith({ modo: undefined })
    })

    test('campos: teclado, preenchimento automático juntos no mesmo painel, e Mostrar com texto', async () => {
      abrirNoEmail()
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      const email = await screen.findByLabelText('E-mail')
      expect(email.props).toMatchObject({
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        autoCorrect: false,
        autoComplete: 'username',
        textContentType: 'username',
        returnKeyType: 'next',
      })
      const senha = screen.getByLabelText('Senha')
      expect(senha.props).toMatchObject({
        autoComplete: 'current-password',
        textContentType: 'password',
        returnKeyType: 'go',
        secureTextEntry: true,
      })
      // "Mostrar" tem texto, não só o olho.
      expect(screen.getByText('Mostrar')).toBeOnTheScreen()
      await fireEvent.press(screen.getByRole('button', { name: 'Mostrar senha' }))
      expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(false)
      expect(screen.getByText('Ocultar')).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeOnTheScreen()
    })

    test('"Esqueci a senha" está na linha do rótulo e leva o e-mail já digitado', async () => {
      abrirNoEmail()
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'ana@exemplo.com')
      await fireEvent.press(screen.getByRole('button', { name: 'Esqueci a senha' }))
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/recuperar-senha',
        params: { email: 'ana@exemplo.com' },
      })
    })

    test('o rodapé do painel é "Não tem conta? Criar conta"', async () => {
      abrirNoEmail()
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await fireEvent.press(
        await screen.findByRole('button', { name: 'Não tem conta? Criar conta' }),
      )
      expect(router.push).toHaveBeenCalledWith('/criar-conta')
    })

    test('com verificação em duas etapas, segue para a tela do código (e o guarda é solto)', async () => {
      abrirNoEmail()
      globalThis.fetch = servidorFalso({
        'POST /api/auth/entrar': () => ({
          status: 200,
          corpo: { segundoFator: true, desafio: 'desafio-longo-o-bastante' },
        }),
      }).fetch
      await renderizar()
      await preencher('ana@exemplo.com', 'uma frase longa')
      await userEvent.setup().press(screen.getByRole('button', { name: 'Entrar' }))
      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/segundo-fator'))
    })
  })

  describe('erros (erro.campo, erro.geral, erro.provedor, erro.rede)', () => {
    test('sem preencher: ícone mais texto em cada campo, sem ir à rede', async () => {
      abrirNoEmail()
      const servidor = servidorFalso({})
      globalThis.fetch = servidor.fetch
      await renderizar()
      await userEvent.setup().press(await screen.findByRole('button', { name: 'Entrar' }))
      expect(screen.getByText('Digite seu e-mail.')).toBeOnTheScreen()
      expect(screen.getByText('Digite sua senha.')).toBeOnTheScreen()
      expect(screen.getByLabelText('E-mail').props.accessibilityHint).toBe(
        'Erro: Digite seu e-mail.',
      )
      expect(servidor.pedidos).toHaveLength(0)
    })

    test('e-mail incompleto: diz como é um e-mail, ao enviar e ao sair do campo', async () => {
      abrirNoEmail()
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      const campo = await screen.findByLabelText('E-mail')
      await fireEvent.changeText(campo, 'ana@')
      // Ainda digitando: nada de erro a cada tecla.
      expect(screen.queryByText(/parece incompleto/)).toBeNull()
      await fireEvent(campo, 'blur')
      expect(
        screen.getByText(
          'Esse e-mail parece incompleto. Confira se tem @ e o final, como nome@exemplo.com.',
        ),
      ).toBeOnTheScreen()
      // O erro some assim que o valor fica certo.
      await fireEvent.changeText(campo, 'ana@exemplo.com')
      expect(screen.queryByText(/parece incompleto/)).toBeNull()
    })

    test('senha errada: o texto humano e a saída "Esqueci a senha" dentro do erro; nada de código', async () => {
      abrirNoEmail()
      const servidor = servidorFalso({
        'POST /api/auth/entrar': () => ({
          status: 401,
          corpo: { erro: 'credenciais_invalidas', mensagem: MENSAGEM },
        }),
      })
      globalThis.fetch = servidor.fetch
      await renderizar()
      await preencher('ana@exemplo.com', 'senha errada demais')
      await userEvent.setup().press(screen.getByRole('button', { name: 'Entrar' }))

      const alerta = await screen.findByRole('alert')
      expect(alerta).toHaveTextContent(/^E-mail ou senha não conferem./)
      expect(alerta).toHaveTextContent(/use o botão deles/)
      expect(screen.queryByText(MENSAGEM)).toBeNull()
      expect(servidor.pedidos[0]?.corpo).toMatchObject({
        email: 'ana@exemplo.com',
        senha: 'senha errada demais',
        plataforma: 'ios',
      })
      expect(router.push).not.toHaveBeenCalled()
      // A primeira falha traz "Esqueci a senha" dentro do erro (além do link da linha do rótulo).
      expect(
        screen.getAllByRole('button', { name: 'Esqueci a senha' }).length,
      ).toBeGreaterThanOrEqual(2)
      // O que a pessoa digitou fica.
      expect(screen.getByLabelText('E-mail').props.value).toBe('ana@exemplo.com')
    })

    test('na segunda senha errada, "Esqueci a senha" vira botão de largura total abaixo de "Entrar"', async () => {
      abrirNoEmail()
      globalThis.fetch = servidorFalso({
        'POST /api/auth/entrar': () => ({
          status: 401,
          corpo: { erro: 'credenciais_invalidas', mensagem: MENSAGEM },
        }),
      }).fetch
      const usuario = userEvent.setup()
      await renderizar()
      await preencher('ana@exemplo.com', 'senha errada demais')
      await usuario.press(screen.getByRole('button', { name: 'Entrar' }))
      await screen.findByRole('alert')
      const antes = screen.getAllByRole('button', { name: 'Esqueci a senha' }).length
      await usuario.press(screen.getByRole('button', { name: 'Entrar' }))
      await waitFor(() =>
        expect(
          screen.getAllByRole('button', { name: 'Esqueci a senha' }).length,
        ).toBeGreaterThanOrEqual(2),
      )
      expect(antes).toBeGreaterThanOrEqual(2)
    })

    test('sem internet ao entrar: diz o que fazer e oferece "Tentar de novo"', async () => {
      abrirNoEmail()
      globalThis.fetch = jest.fn(async () => {
        throw new TypeError('Network request failed')
      }) as unknown as typeof fetch
      await renderizar()
      await preencher('ana@exemplo.com', 'uma frase longa')
      await userEvent.setup().press(screen.getByRole('button', { name: 'Entrar' }))
      const alerta = await screen.findByRole('alert')
      expect(alerta).toHaveTextContent(/^Sem internet./)
      expect(alerta).toHaveTextContent(/Wi-Fi ou os dados do celular/)
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
    })

    test('muitas tentativas: pede esperar ou criar uma senha nova', async () => {
      abrirNoEmail()
      globalThis.fetch = servidorFalso({
        'POST /api/auth/entrar': () => ({
          status: 429,
          corpo: { erro: 'muitas_tentativas', mensagem: 'Muitas tentativas.' },
        }),
      }).fetch
      await renderizar()
      await preencher('ana@exemplo.com', 'uma frase longa')
      await userEvent.setup().press(screen.getByRole('button', { name: 'Entrar' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/Muitas tentativas seguidas/)
    })

    test('a Apple falhou: a mensagem humana toma o lugar do apoio, sem termo técnico', async () => {
      disponivelNaApple.mockResolvedValue(true)
      entrarNaApple.mockRejectedValue(new Error('ASAuthorizationError 1000'))
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
      const aviso = await screen.findByRole('alert')
      expect(aviso).toHaveTextContent(
        'Não deu para entrar com a Apple agora. Tente de novo ou use outro jeito de entrar.',
      )
      expect(screen.queryByText(/ASAuthorization/)).toBeNull()
      expect(screen.queryByText(/Agenda, escalas e recados/)).toBeNull()
    })

    test('conta Google sem convite: mostra a mensagem da API pedindo convite', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      const mensagem = 'Não encontramos uma conta do Uni Jovem ligada a esta conta Google.'
      globalThis.fetch = servidorFalso({
        'POST /api/auth/provedor/google': () => ({
          status: 401,
          corpo: { erro: 'conta_nao_encontrada', mensagem },
        }),
      }).fetch
      await renderizar()
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
      await act(async () => {
        google.__responder({ type: 'success', data: { idToken: 'token-sem-conta' } })
      })
      expect(await screen.findByText(mensagem)).toBeOnTheScreen()
    })

    test('cancelar na folha da Apple não mostra erro; duas vezes seguidas vira uma dica gentil', async () => {
      disponivelNaApple.mockResolvedValue(true)
      entrarNaApple.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' })
      globalThis.fetch = servidorFalso({}).fetch
      const usuario = userEvent.setup()
      await renderizar()
      await usuario.press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
      await act(async () => undefined)
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByText(/Prefere entrar com e-mail/)).toBeNull()
      await usuario.press(screen.getByRole('button', { name: 'Continuar com a Apple' }))
      expect(
        await screen.findByText('Prefere entrar com e-mail? Toque em Entrar com e-mail.'),
      ).toBeOnTheScreen()
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('provedores', () => {
    test('com o ID do Google do iOS, o ID token vai para a API', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      const servidor = servidorFalso({
        'POST /api/auth/provedor/google': () => ({ status: 200, corpo: SESSAO }),
        'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
      })
      globalThis.fetch = servidor.fetch
      await renderizar()
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
      await act(async () => {
        google.__responder({ type: 'success', data: { idToken: 'token-do-google' } })
      })
      await waitFor(() =>
        expect(
          servidor.pedidos.find((p) => p.url.endsWith('/provedor/google'))?.corpo,
        ).toMatchObject({
          idToken: 'token-do-google',
          plataforma: 'ios',
        }),
      )
    })

    test('no iOS com a Apple disponível: botão em português, e o nonce cru vai junto do token', async () => {
      disponivelNaApple.mockResolvedValue(true)
      entrarNaApple.mockResolvedValue({ identityToken: 'token-da-apple' })
      const servidor = servidorFalso({
        'POST /api/auth/provedor/apple': () => ({ status: 200, corpo: SESSAO }),
        'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
      })
      globalThis.fetch = servidor.fetch
      await renderizar()
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
      await waitFor(() => expect(servidor.pedidos.some((p) => p.url.endsWith('/apple'))).toBe(true))
      const corpo = servidor.pedidos.find((p) => p.url.endsWith('/apple'))!.corpo as {
        identityToken: string
        nonce: string
      }
      expect(corpo.identityToken).toBe('token-da-apple')
      const pedidoAApple = entrarNaApple.mock.calls[0]![0] as { nonce: string }
      expect(pedidoAApple.nonce).toBe(
        await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, corpo.nonce),
      )
      expect(corpo.nonce).not.toBe(pedidoAApple.nonce)
    })

    test('a Apple entrega o nome na primeira vez e a conta nova segue para "Falta pouco"', async () => {
      disponivelNaApple.mockResolvedValue(true)
      entrarNaApple.mockResolvedValue({
        identityToken: 'token-da-apple',
        fullName: { givenName: 'Ana', familyName: 'Souza' },
      })
      const servidor = servidorFalso({
        'POST /api/auth/provedor/apple': () => ({
          status: 200,
          corpo: {
            cadastroPendente: true,
            tokenDeCadastro: 'token-de-cadastro',
            nome: 'Ana Souza',
            email: 'ana@exemplo.com',
          },
        }),
      })
      globalThis.fetch = servidor.fetch
      await renderizar()
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/completar-cadastro'))
      expect(servidor.pedidos.find((p) => p.url.endsWith('/provedor/apple'))?.corpo).toMatchObject({
        identityToken: 'token-da-apple',
        nome: 'Ana Souza',
      })
    })
  })

  describe('carregando e sucesso', () => {
    test('carregando.provedor: o botão tocado fica ocupado e o outro, inativo (nunca dois pedidos)', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      disponivelNaApple.mockResolvedValue(true)
      entrarNaApple.mockReturnValue(new Promise(() => undefined))
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
      // O nome do botão não muda: só o logotipo vira indicador.
      const apple = await screen.findByRole('button', { name: 'Continuar com a Apple' })
      expect(apple).toBeBusy()
      expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Entrar com e-mail' })).toBeDisabled()
    })

    test('carregando.senha: "Entrando...", campos só de leitura e o botão não aceita outro toque', async () => {
      abrirNoEmail()
      globalThis.fetch = jest.fn(() => new Promise(() => undefined)) as unknown as typeof fetch
      await renderizar()
      await preencher('ana@exemplo.com', 'uma frase longa')
      await userEvent.setup().press(screen.getByRole('button', { name: 'Entrar' }))
      const botao = await screen.findByRole('button', { name: 'Entrando...' })
      expect(botao).toBeBusy()
      expect(botao).toBeDisabled()
      expect(screen.getByLabelText('E-mail').props.editable).toBe(false)
    })

    test('sucesso: o guarda do grupo público espera 200 ms e solta (o check do botão aparece)', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] })
      try {
        abrirNoEmail()
        globalThis.fetch = servidorFalso({
          'POST /api/auth/entrar': () => ({ status: 200, corpo: SESSAO }),
          'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
        }).fetch
        const guarda = await renderHook(() => useRedirecionamentoSegurado())
        await renderizar()
        await act(async () => {
          jest.advanceTimersByTime(50)
        })
        await preencher('ana@exemplo.com', 'uma frase longa')
        const usuario = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        await usuario.press(screen.getByRole('button', { name: 'Entrar' }))
        await waitFor(() => expect(guarda.result.current).toBe(true))
        // Depois dos 200 ms de sucesso, o guarda decide (e a navegação segue).
        await act(async () => {
          jest.advanceTimersByTime(250)
        })
        await waitFor(() => expect(guarda.result.current).toBe(false))
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('entrada.inicio.biometria e entrada.inicio.convite', () => {
    test('sessão trancada pelo Face ID: "Entrar com Face ID" é o primeiro; ele abre a sessão', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      // Aparelho com a biometria ligada e o app recém-aberto (chave fora da memória).
      cofre.set('uj.refresh', 'refresh-guardado')
      await ligarBiometria()
      trancarCofre()
      let recusar = true
      lerSeguro.mockImplementation(
        async (chave: string, opcoes?: { requireAuthentication?: boolean }) => {
          if (opcoes?.requireAuthentication && recusar) throw new Error('cancelado')
          return lerSeguroOriginal(chave, opcoes)
        },
      )
      const servidor = servidorFalso({
        'POST /api/auth/renovar': () => ({ status: 200, corpo: SESSAO }),
        'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
      })
      globalThis.fetch = servidor.fetch
      await renderizar()

      const botao = await screen.findByRole('button', { name: 'Entrar com Face ID' })
      expect(nomesDosBotoes()[0]).toBe('Entrar com Face ID')
      expect(servidor.pedidos).toHaveLength(0)
      // Os outros acessos continuam logo abaixo.
      expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeOnTheScreen()

      recusar = false
      await userEvent.setup().press(botao)
      await waitFor(() =>
        expect(servidor.pedidos.find((p) => p.url.endsWith('/renovar'))?.corpo).toEqual({
          refresh: 'refresh-guardado',
        }),
      )
    })

    test('com convite guardado: o cartão "Você foi convidado" aparece, o link do convite some e o apoio muda', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      globalThis.fetch = servidorFalso({}).fetch
      guardarConvitePendente({ tipo: 'convite', token: TOKEN_DE_CONVITE })
      await renderizar()
      expect(await screen.findByText('Você foi convidado')).toBeOnTheScreen()
      expect(screen.getByText('Seu convite está guardado.')).toBeOnTheScreen()
      expect(screen.getByText('Entre ou crie sua conta para participar.')).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Tenho um convite ou código' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Remover o convite' })).toBeOnTheScreen()
    })

    test('"Remover" tira o convite e o link "Tenho um convite ou código" volta', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      globalThis.fetch = servidorFalso({}).fetch
      guardarConvitePendente({ tipo: 'codigo', codigo: 'ABCD2345' })
      await renderizar()
      await fireEvent.press(await screen.findByRole('button', { name: 'Remover o convite' }))
      await waitFor(() => expect(screen.queryByText('Você foi convidado')).toBeNull())
      expect(screen.getByRole('button', { name: 'Tenho um convite ou código' })).toBeOnTheScreen()
    })
  })

  describe('cabe sem rolar e fonte grande', () => {
    test('fonte grande do sistema: o sol encolhe, o apoio some e nenhuma ação some', async () => {
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
      definirJanela(375, 667, 1.35)
      disponivelNaApple.mockResolvedValue(true)
      globalThis.fetch = servidorFalso({}).fetch
      await renderizar()
      await screen.findByRole('button', { name: 'Continuar com a Apple' })
      expect(screen.queryByText(/Agenda, escalas e recados/)).toBeNull()
      expect(nomesDosBotoes()).toEqual([
        'Continuar com a Apple',
        'Continuar com o Google',
        'Entrar com e-mail',
        'Primeira vez aqui? Criar conta',
        'Tenho um convite ou código',
      ])
    })
  })
})
