/**
 * D1: o que o leitor de tela recebe da casca. A barra é uma lista de abas
 * com o item ativo selecionado; o voltar do cabeçalho de pilha se chama
 * "Voltar"; a raiz anuncia o título como cabeçalho de nível 1.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text, View } from 'react-native'

import { CabecalhoDeTela } from '../CabecalhoDeTela'
import { ItemDaBarraDeAbas } from '../ItemDaBarraDeAbas'
import { PilulaDaComunidade } from '../PilulaDaComunidade'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}))

describe('casca', () => {
  test('barra de abas: papel tab e "selecionado" só no item ativo', async () => {
    await render(
      <View accessibilityRole="tablist">
        <ItemDaBarraDeAbas rotulo="Início" icone="abaInicio" ativo />
        <ItemDaBarraDeAbas rotulo="Agenda" icone="abaAgenda" ativo={false} />
        <ItemDaBarraDeAbas
          rotulo="Perfil"
          icone={null}
          avatar={{ nome: 'Ana Lima' }}
          nomeAcessivel="Perfil de Ana Lima"
          ativo={false}
        />
      </View>,
    )
    expect(screen.getByRole('tab', { name: 'Início', selected: true })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: 'Agenda', selected: false })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: 'Perfil de Ana Lima' })).toBeOnTheScreen()
  })

  test('cabeçalho de pilha: voltar circular chamado "Voltar" e título de nível 1', async () => {
    await render(<CabecalhoDeTela tipo="pilha" titulo="Sábado Jovem" subtitulo="Sábado · 16:00" />)
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'Sábado Jovem' })).toBeOnTheScreen()
  })

  test('cabeçalho de modal: "Fechar" no lugar de "Voltar", que fecha o modal', async () => {
    const fechar = jest.fn()
    await render(<CabecalhoDeTela tipo="pilha" modal titulo="Nova programação" aoVoltar={fechar} />)
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }))
    expect(fechar).toHaveBeenCalledTimes(1)
  })

  test('bloco abaixo do título: 8 abaixo dele, sem margem negativa', async () => {
    await render(
      <CabecalhoDeTela
        tipo="pilha"
        titulo="Sábado Jovem"
        abaixoDoTitulo={<Text>Sábado, 28 de nov. · 16:00 · 60 min</Text>}
      />,
    )
    const meta = screen.getByText('Sábado, 28 de nov. · 16:00 · 60 min')
    expect(meta.parent).toHaveStyle({ marginTop: 8 })
  })

  test('cabeçalho com passos: "Passo 2 de 3" escrito e anunciado', async () => {
    await render(
      <CabecalhoDeTela
        tipo="pilha"
        semVoltar
        titulo="Seus dados"
        passos={{ atual: 2, total: 3 }}
      />,
    )
    expect(screen.getByLabelText('Passo 2 de 3')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull()
  })

  test('pílula da comunidade: diz a comunidade, o papel e a ação de trocar', async () => {
    const trocar = jest.fn()
    await render(
      <PilulaDaComunidade
        nome="Jovens Central"
        vazia={false}
        podeTrocar
        rotulo="Comunidade Jovens Central, Administrador. Trocar de comunidade"
        aoPressionar={trocar}
      />,
    )
    expect(
      screen.getByRole('button', {
        name: 'Comunidade Jovens Central, Administrador. Trocar de comunidade',
      }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Jovens Central')).toBeOnTheScreen()
  })
})
