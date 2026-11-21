/**
 * D60: os acessos rápidos (Apple e Google) são botões grandes, com nome
 * acessível igual ao texto visível, alvo de pelo menos 44, cores fixas da marca
 * (a Apple troca entre o claro e o escuro) e estados carregando e inativo.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { MARCA_DA_APPLE, MARCA_DO_GOOGLE } from '@uj/tokens'
import { StyleSheet } from 'react-native'

import { BotaoDeAcessoRapido } from '../BotaoDeAcessoRapido'
import { SeparadorComTexto } from '../SeparadorComTexto'
import { ProvedorDeTemaForcado } from '../tema'

function estilo(no: { props: { style?: unknown } }) {
  return StyleSheet.flatten(no.props.style as never) as Record<string, unknown>
}

describe('BotaoDeAcessoRapido', () => {
  test('o nome acessível é o texto visível, e o alvo passa de 44', async () => {
    await render(
      <BotaoDeAcessoRapido marca="apple" titulo="Continuar com a Apple" aoPressionar={() => {}} />,
    )
    const botao = screen.getByRole('button', { name: 'Continuar com a Apple' })
    expect(screen.getByText('Continuar com a Apple')).toBeOnTheScreen()
    expect(estilo(botao).minHeight).toBeGreaterThanOrEqual(44)
    expect(botao).toBeEnabled()
    expect(botao).not.toBeBusy()
  })

  test('Apple: preto com texto branco no claro, branco com texto preto no escuro', async () => {
    const { rerender } = await render(
      <ProvedorDeTemaForcado nome="claro">
        <BotaoDeAcessoRapido marca="apple" titulo="Continuar com a Apple" aoPressionar={() => {}} />
      </ProvedorDeTemaForcado>,
    )
    expect(estilo(screen.getByRole('button')).backgroundColor).toBe(MARCA_DA_APPLE.claro.fundo)
    expect(screen.getByText('Continuar com a Apple')).toHaveStyle({
      color: MARCA_DA_APPLE.claro.texto,
    })
    await rerender(
      <ProvedorDeTemaForcado nome="escuro">
        <BotaoDeAcessoRapido marca="apple" titulo="Continuar com a Apple" aoPressionar={() => {}} />
      </ProvedorDeTemaForcado>,
    )
    expect(estilo(screen.getByRole('button')).backgroundColor).toBe(MARCA_DA_APPLE.escuro.fundo)
    expect(screen.getByText('Continuar com a Apple')).toHaveStyle({
      color: MARCA_DA_APPLE.escuro.texto,
    })
  })

  test('Google: fundo branco e borda da marca, nos dois temas', async () => {
    await render(
      <ProvedorDeTemaForcado nome="escuro">
        <BotaoDeAcessoRapido
          marca="google"
          titulo="Continuar com o Google"
          aoPressionar={() => {}}
        />
      </ProvedorDeTemaForcado>,
    )
    expect(estilo(screen.getByRole('button'))).toMatchObject({
      backgroundColor: MARCA_DO_GOOGLE.fundo,
      borderColor: MARCA_DO_GOOGLE.borda,
    })
  })

  test('tocar chama a ação', async () => {
    const aoPressionar = jest.fn()
    await render(
      <BotaoDeAcessoRapido
        marca="google"
        titulo="Continuar com o Google"
        aoPressionar={aoPressionar}
      />,
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar com o Google' }))
    expect(aoPressionar).toHaveBeenCalledTimes(1)
  })

  test('carregando: ocupado, sem aceitar outro toque, e o nome continua o mesmo', async () => {
    const aoPressionar = jest.fn()
    await render(
      <BotaoDeAcessoRapido
        marca="apple"
        titulo="Continuar com a Apple"
        carregando
        aoPressionar={aoPressionar}
      />,
    )
    const botao = screen.getByRole('button', { name: 'Continuar com a Apple' })
    expect(botao).toBeBusy()
    expect(botao).toBeDisabled()
    await fireEvent.press(botao)
    expect(aoPressionar).not.toHaveBeenCalled()
  })

  test('inativo com motivo: o motivo aparece e vai para o leitor de tela', async () => {
    await render(
      <BotaoDeAcessoRapido
        marca="google"
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
})

describe('SeparadorComTexto', () => {
  test('o texto do meio é lido; as linhas são só desenho', async () => {
    await render(<SeparadorComTexto texto="ou com e-mail" />)
    expect(screen.getByText('ou com e-mail')).toBeOnTheScreen()
  })
})
