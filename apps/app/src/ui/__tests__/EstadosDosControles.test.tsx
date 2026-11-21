/**
 * D0: Botão e Campo nos estados da seção 2.12 (normal, pressionado, foco,
 * desabilitado, carregando e erro), com o estado acessível em `aria-*` e o
 * desenho em cor (nenhum estado usa `opacity`).
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { TEMAS } from '@uj/tokens'
import { StyleSheet } from 'react-native'

import { Botao } from '../Botao'
import { Campo } from '../Campo'
import { ALFA_DESABILITADO, comOpacidade } from '../cor'

const C = TEMAS.claro.base

function estilo(no: { props: { style?: unknown } }) {
  return StyleSheet.flatten(no.props.style as never) as Record<string, unknown>
}

describe('Botão: estados desenhados (2.12.1)', () => {
  test('normal: primário com fundo primário, rótulo 15/20 600, raio 14, sem opacidade', async () => {
    await render(<Botao titulo="Publicar" aoPressionar={() => {}} tamanho="grande" />)
    const botao = screen.getByRole('button', { name: 'Publicar' })
    expect(botao).toBeEnabled()
    expect(botao).not.toBeBusy()
    const e = estilo(botao)
    expect(e).toMatchObject({ backgroundColor: C.primaria, borderRadius: 14, minHeight: 48 })
    expect(e.opacity).toBeUndefined()
    expect(screen.getByText('Publicar')).toHaveStyle({ fontSize: 15, lineHeight: 20 })
  })

  test('pressionado: troca a cor (primariaPressionada), não a opacidade', async () => {
    await render(<Botao titulo="Publicar" aoPressionar={() => {}} estadoDeVitrine="pressionado" />)
    const e = estilo(screen.getByRole('button', { name: 'Publicar' }))
    expect(e.backgroundColor).toBe(C.primariaPressionada)
    expect(e.opacity).toBeUndefined()
  })

  test('foco: anel de 2 na cor de foco, afastado 2 (teclado)', async () => {
    await render(<Botao titulo="Duplicar" variante="secundario" aoPressionar={() => {}} />)
    const botao = screen.getByRole('button', { name: 'Duplicar' })
    await fireEvent(botao, 'focus')
    expect(estilo(botao)).toMatchObject({
      outlineWidth: 2,
      outlineOffset: 2,
      outlineColor: C.foco,
    })
    await fireEvent(botao, 'blur')
    expect(estilo(botao).outlineWidth).toBeUndefined()
  })

  test('desabilitado: aria-disabled, fundo tonal e texto a 40% (cor, não opacidade), com o motivo', async () => {
    const aoPressionar = jest.fn()
    await render(
      <Botao
        titulo="Enviar código"
        aoPressionar={aoPressionar}
        desabilitado
        motivo="Aceite os termos para continuar."
      />,
    )
    const botao = screen.getByRole('button', { name: 'Enviar código' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveProp('accessibilityHint', 'Aceite os termos para continuar.')
    const e = estilo(botao)
    expect(e.backgroundColor).toBe(C.tonal)
    expect(e.opacity).toBeUndefined()
    expect(screen.getByText('Enviar código')).toHaveStyle({
      color: comOpacidade(C.texto, ALFA_DESABILITADO),
    })
    expect(screen.getByText('Aceite os termos para continuar.')).toBeOnTheScreen()
    await fireEvent.press(botao)
    expect(aoPressionar).not.toHaveBeenCalled()
  })

  test('carregando: aria-busy, ignora toques e mantém o rótulo', async () => {
    const aoPressionar = jest.fn()
    await render(<Botao titulo="Entrar" aoPressionar={aoPressionar} carregando />)
    const botao = screen.getByRole('button', { name: 'Entrar' })
    expect(botao).toBeBusy()
    expect(botao).toBeDisabled()
    expect(screen.getByText('Entrar')).toBeOnTheScreen()
    await fireEvent.press(botao)
    expect(aoPressionar).not.toHaveBeenCalled()
  })

  test('erro: o botão não tem estado de erro (o aviso fica acima dele); destrutivo é contorno de erro', async () => {
    await render(<Botao titulo="Excluir" variante="destrutivo" aoPressionar={() => {}} />)
    const e = estilo(screen.getByRole('button', { name: 'Excluir' }))
    expect(e).toMatchObject({ borderWidth: 1, borderColor: C.erro })
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })

  test('alto (Ao vivo): 56 de altura e ícone de 24', async () => {
    await render(
      <Botao titulo="Avançar etapa" tamanho="alto" icone="proximaEtapa" aoPressionar={() => {}} />,
    )
    expect(estilo(screen.getByRole('button', { name: 'Avançar etapa' })).minHeight).toBe(56)
  })

  test('marcado (alternável): fundo quente, borda e texto em destaque', async () => {
    await render(
      <Botao titulo="Orando" variante="secundario" icone="check" marcado aoPressionar={() => {}} />,
    )
    const botao = screen.getByRole('button', { name: 'Orando' })
    expect(estilo(botao)).toMatchObject({
      borderColor: C.destaque,
      backgroundColor: C.quenteFundo,
    })
    expect(screen.getByText('Orando')).toHaveStyle({ color: C.destaque })
  })

  test('largura automática por padrão (só formulário e barra usam a largura total)', async () => {
    await render(<Botao titulo="Ver todos" variante="terciario" aoPressionar={() => {}} />)
    // A raiz do botão é a caixa que o posiciona (o Pressable fica dentro dela).
    const raiz = screen.toJSON() as { props: { style?: unknown } }
    expect(estilo(raiz).alignSelf).toBe('flex-start')
  })
})

describe('Campo: estados desenhados (2.12.2)', () => {
  function caixa() {
    return screen.getByTestId('campo-caixa')
  }

  test('normal: 48, raio 14, fundo campoFundo, borda de 1 campoBorda; rótulo 15/20 600 suave', async () => {
    await render(<Campo rotulo="Nome" testID="campo" value="" onChangeText={() => {}} />)
    expect(caixa()).toHaveStyle({
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      backgroundColor: C.campoFundo,
      borderColor: C.campoBorda,
    })
    expect(screen.getByText('Nome')).toHaveStyle({
      fontSize: 15,
      lineHeight: 20,
      color: C.textoSuave,
    })
  })

  test('foco: borda de foco mais anel interno, sem mudar a espessura (o texto não se desloca)', async () => {
    await render(<Campo rotulo="E-mail" testID="campo" value="" onChangeText={() => {}} />)
    const antes = estilo(caixa())
    await fireEvent(screen.getByLabelText('E-mail'), 'focus')
    const depois = estilo(caixa())
    expect(depois.borderColor).toBe(C.foco)
    expect(depois.boxShadow).toBe(`inset 0px 0px 0px 1px ${C.foco}`)
    expect(depois.borderWidth).toBe(antes.borderWidth)
  })

  test('erro: borda e anel de erro, texto que diz como corrigir, ligado ao campo', async () => {
    await render(
      <Campo
        rotulo="Hora de início"
        testID="campo"
        value="16h"
        onChangeText={() => {}}
        ajuda="No horário da comunidade."
        erro="Use o formato 16:00"
      />,
    )
    expect(caixa()).toHaveStyle({ borderColor: C.erro, borderWidth: 1 })
    expect(screen.getByLabelText('Hora de início')).toHaveProp(
      'accessibilityHint',
      'Erro: Use o formato 16:00',
    )
    // Uma linha de apoio só: o erro substitui a ajuda.
    expect(screen.getByText('Use o formato 16:00')).toBeOnTheScreen()
    expect(screen.queryByText('No horário da comunidade.')).toBeNull()
  })

  test('desabilitado: aria-disabled, não editável, borda tracejada', async () => {
    await render(
      <Campo
        rotulo="Comunidade"
        testID="campo"
        value="Jovens"
        onChangeText={() => {}}
        desabilitado
      />,
    )
    const campo = screen.getByLabelText('Comunidade')
    expect(campo).toHaveProp('editable', false)
    expect(campo).toHaveProp('aria-disabled', true)
    expect(caixa()).toHaveStyle({ borderStyle: 'dashed', borderColor: C.tonalBorda })
  })

  test('somente leitura e validando: fundo tonal; indicador à direita', async () => {
    await render(
      <>
        <Campo rotulo="Código" testID="campo" value="A1B2" onChangeText={() => {}} somenteLeitura />
        <Campo rotulo="Duração" value="60" onChangeText={() => {}} validando sufixo="min" />
      </>,
    )
    expect(screen.getByLabelText('Código')).toHaveProp('editable', false)
    expect(caixa()).toHaveStyle({ backgroundColor: C.tonal })
    expect(screen.getByText('min')).toBeOnTheScreen()
  })

  test('nenhum estado usa opacidade', async () => {
    await render(
      <Campo rotulo="Nome" testID="campo" value="" onChangeText={() => {}} desabilitado />,
    )
    expect(estilo(caixa()).opacity).toBeUndefined()
  })
})
