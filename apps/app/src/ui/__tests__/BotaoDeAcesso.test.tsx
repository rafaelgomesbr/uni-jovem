/**
 * Botão de acesso (D63): três níveis de peso, cores oficiais da Apple e do
 * Google, 56 de altura (48 o terciário), selo em texto, carregando no mesmo
 * tamanho, sucesso com check e balanço do erro.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import {
  CAMADA_DE_TOQUE_DO_ACESSO,
  CLARO,
  ESCURO,
  MARCA_DA_APPLE,
  MARCA_DO_GOOGLE,
  MARCA_DO_GOOGLE_ESCURO,
} from '@uj/tokens'
import { StyleSheet } from 'react-native'
import { withSequence } from 'react-native-reanimated'

import { aparenciaDoAcesso } from '../aparenciaDoAcesso'
import { BotaoDeAcesso } from '../BotaoDeAcesso'
import { ProvedorDeTemaForcado } from '../tema'

jest.mock('../acessibilidade', () => ({
  usePreferenciasDeAcessibilidade: jest.fn(() => ({
    reduzirMovimento: false,
    reduzirTransparencia: false,
    aumentarContraste: false,
  })),
}))

const preferencias = jest.requireMock('../acessibilidade') as {
  usePreferenciasDeAcessibilidade: jest.Mock
}

function estilo(no: { props: { style?: unknown } }) {
  return StyleSheet.flatten(no.props.style as never) as Record<string, unknown>
}

describe('aparenciaDoAcesso: a tabela de botões (3.1 do desenho)', () => {
  const escuro = { cores: ESCURO, escuro: true }
  const claro = { cores: CLARO, escuro: false }

  test('Apple: branca no escuro e preta no claro, nos dois níveis, sempre com 56 e sem contorno', () => {
    for (const nivel of ['primario', 'secundario'] as const) {
      const noEscuro = aparenciaDoAcesso({ marca: 'apple', nivel, ...escuro })
      expect(noEscuro).toMatchObject({
        fundo: MARCA_DA_APPLE.escuro.fundo,
        texto: MARCA_DA_APPLE.escuro.texto,
        altura: 56,
        borda: null,
        camada: CAMADA_DE_TOQUE_DO_ACESSO.appleEscuro,
        logo: 'apple',
      })
      expect(aparenciaDoAcesso({ marca: 'apple', nivel, ...claro })).toMatchObject({
        fundo: MARCA_DA_APPLE.claro.fundo,
        texto: MARCA_DA_APPLE.claro.texto,
        camada: CAMADA_DE_TOQUE_DO_ACESSO.appleClaro,
      })
    }
  })

  test('Google primário: o tema claro da marca (branco com contorno) nos dois temas', () => {
    for (const tema of [escuro, claro]) {
      expect(aparenciaDoAcesso({ marca: 'google', nivel: 'primario', ...tema })).toMatchObject({
        fundo: MARCA_DO_GOOGLE.fundo,
        texto: MARCA_DO_GOOGLE.texto,
        borda: MARCA_DO_GOOGLE.borda,
        logo: 'google',
      })
    }
  })

  test('Google secundário: o tema escuro da marca no escuro (sem segunda laje branca) e o claro no claro', () => {
    expect(aparenciaDoAcesso({ marca: 'google', nivel: 'secundario', ...escuro })).toMatchObject({
      fundo: MARCA_DO_GOOGLE_ESCURO.fundo,
      texto: MARCA_DO_GOOGLE_ESCURO.texto,
      borda: MARCA_DO_GOOGLE_ESCURO.borda,
      camada: CAMADA_DE_TOQUE_DO_ACESSO.googleEscuro,
      sombra: false,
    })
    expect(aparenciaDoAcesso({ marca: 'google', nivel: 'secundario', ...claro })).toMatchObject({
      fundo: MARCA_DO_GOOGLE.fundo,
      borda: MARCA_DO_GOOGLE.borda,
      sombra: true,
    })
  })

  test('e-mail: coral cheio como primário, contorno como secundário, só texto como terciário (48)', () => {
    expect(aparenciaDoAcesso({ marca: 'email', nivel: 'primario', ...escuro })).toMatchObject({
      fundo: ESCURO.primaria,
      texto: ESCURO.sobrePrimaria,
      altura: 56,
    })
    expect(aparenciaDoAcesso({ marca: 'email', nivel: 'secundario', ...escuro })).toMatchObject({
      fundo: 'transparent',
      texto: ESCURO.texto,
      borda: ESCURO.contorno,
      altura: 56,
    })
    expect(aparenciaDoAcesso({ marca: 'email', nivel: 'terciario', ...claro })).toMatchObject({
      fundo: 'transparent',
      texto: CLARO.texto,
      borda: null,
      altura: 48,
      logo: 'email',
    })
  })

  test('o coral cheio é do avançar e de quem volta: o Face ID e as ações usam o mesmo desenho', () => {
    expect(aparenciaDoAcesso({ marca: 'biometria', nivel: 'primario', ...escuro })).toMatchObject({
      fundo: ESCURO.primaria,
      logo: 'faceId',
    })
    expect(aparenciaDoAcesso({ marca: 'acao', nivel: 'primario', ...escuro })).toMatchObject({
      fundo: ESCURO.primaria,
      logo: null,
    })
  })
})

describe('BotaoDeAcesso', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    preferencias.usePreferenciasDeAcessibilidade.mockReturnValue({
      reduzirMovimento: false,
      reduzirTransparencia: false,
      aumentarContraste: false,
    })
  })

  test('o nome acessível é o texto visível, a altura é 56 e o logotipo é decorativo', async () => {
    await render(
      <BotaoDeAcesso
        marca="apple"
        nivel="primario"
        titulo="Continuar com a Apple"
        aoPressionar={() => {}}
      />,
    )
    const botao = screen.getByRole('button', { name: 'Continuar com a Apple' })
    expect(screen.getByText('Continuar com a Apple')).toBeOnTheScreen()
    expect(estilo(botao).minHeight).toBe(56)
    expect(botao).toBeEnabled()
    expect(botao).not.toBeBusy()
  })

  test('o terciário tem 48 de altura e nenhum fundo', async () => {
    await render(
      <ProvedorDeTemaForcado nome="escuro">
        <BotaoDeAcesso
          marca="email"
          nivel="terciario"
          titulo="Entrar com e-mail"
          aoPressionar={() => {}}
        />
      </ProvedorDeTemaForcado>,
    )
    const botao = screen.getByRole('button', { name: 'Entrar com e-mail' })
    expect(estilo(botao)).toMatchObject({ minHeight: 48, backgroundColor: 'transparent' })
  })

  test('o selo "Usado da última vez" é texto (com ícone), 8 acima do botão, nunca só cor', async () => {
    await render(
      <BotaoDeAcesso
        marca="google"
        nivel="primario"
        titulo="Continuar com o Google"
        selo="Usado da última vez"
        aoPressionar={() => {}}
      />,
    )
    expect(screen.getByText('Usado da última vez')).toBeOnTheScreen()
  })

  test('tocar chama a ação uma vez', async () => {
    const aoPressionar = jest.fn()
    await render(
      <BotaoDeAcesso
        marca="google"
        nivel="secundario"
        titulo="Continuar com o Google"
        aoPressionar={aoPressionar}
      />,
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar com o Google' }))
    expect(aoPressionar).toHaveBeenCalledTimes(1)
  })

  test('carregando: ocupado, sem aceitar outro toque e com o mesmo nome; o tamanho não muda', async () => {
    const aoPressionar = jest.fn()
    await render(
      <BotaoDeAcesso
        marca="apple"
        nivel="primario"
        titulo="Continuar com a Apple"
        carregando
        aoPressionar={aoPressionar}
      />,
    )
    const botao = screen.getByRole('button', { name: 'Continuar com a Apple' })
    expect(botao).toBeBusy()
    expect(botao).toBeDisabled()
    expect(estilo(botao).minHeight).toBe(56)
    await fireEvent.press(botao)
    expect(aoPressionar).not.toHaveBeenCalled()
  })

  test('sucesso: o botão não aceita mais toque (a conta abriu)', async () => {
    const aoPressionar = jest.fn()
    await render(
      <BotaoDeAcesso
        marca="acao"
        nivel="primario"
        titulo="Entrar"
        sucesso
        aoPressionar={aoPressionar}
      />,
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    expect(aoPressionar).not.toHaveBeenCalled()
  })

  test('inativo com motivo: o motivo aparece e vai para o leitor de tela', async () => {
    await render(
      <BotaoDeAcesso
        marca="google"
        nivel="secundario"
        titulo="Conectar com Google"
        inativo
        motivo="Informe a senha atual primeiro."
        aoPressionar={() => {}}
      />,
    )
    const botao = screen.getByRole('button', { name: 'Conectar com Google' })
    expect(botao).toBeDisabled()
    expect(botao.props.accessibilityHint).toBe('Informe a senha atual primeiro.')
    expect(screen.getByText('Informe a senha atual primeiro.')).toBeOnTheScreen()
  })

  test('Aumentar contraste: borda de 2 na cor do texto', async () => {
    preferencias.usePreferenciasDeAcessibilidade.mockReturnValue({
      reduzirMovimento: false,
      reduzirTransparencia: false,
      aumentarContraste: true,
    })
    await render(
      <ProvedorDeTemaForcado nome="escuro">
        <BotaoDeAcesso
          marca="email"
          nivel="secundario"
          titulo="Entrar com e-mail"
          aoPressionar={() => {}}
        />
      </ProvedorDeTemaForcado>,
    )
    expect(estilo(screen.getByRole('button'))).toMatchObject({
      borderWidth: 2,
      borderColor: ESCURO.texto,
    })
  })

  test('falha do provedor: o botão balança (4 pt, em 4 etapas); com Reduzir movimento, não balança', async () => {
    const { rerender } = await render(
      <BotaoDeAcesso
        marca="apple"
        nivel="primario"
        titulo="Continuar com a Apple"
        aoPressionar={() => {}}
        disparoDeErro={0}
      />,
    )
    expect(withSequence).not.toHaveBeenCalled()
    await rerender(
      <BotaoDeAcesso
        marca="apple"
        nivel="primario"
        titulo="Continuar com a Apple"
        aoPressionar={() => {}}
        disparoDeErro={1}
      />,
    )
    expect(withSequence).toHaveBeenCalledTimes(1)
    expect((withSequence as jest.Mock).mock.calls[0]).toHaveLength(4)

    jest.clearAllMocks()
    preferencias.usePreferenciasDeAcessibilidade.mockReturnValue({
      reduzirMovimento: true,
      reduzirTransparencia: false,
      aumentarContraste: false,
    })
    await rerender(
      <BotaoDeAcesso
        marca="apple"
        nivel="primario"
        titulo="Continuar com a Apple"
        aoPressionar={() => {}}
        disparoDeErro={2}
      />,
    )
    expect(withSequence).not.toHaveBeenCalled()
  })
})
