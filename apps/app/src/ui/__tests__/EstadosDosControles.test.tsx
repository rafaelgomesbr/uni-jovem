/**
 * D64: Botão e Campo nos estados dos controles v2 (normal, pressionado, foco,
 * desabilitado, carregando, erro e sucesso), com o estado acessível em `aria-*`
 * e o desenho em cor (nenhum estado usa `opacity`, fora a camada animada).
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { TEMAS } from '@uj/tokens'
import { StyleSheet } from 'react-native'

import { aparenciaDoBotao } from '../aparenciaDoBotao'
import { Botao } from '../Botao'
import { Campo } from '../Campo'
import { comOpacidade } from '../cor'

// O indicador é decorativo: some do leitor de tela, mas existe na tela.
const COM_ESCONDIDOS = { includeHiddenElements: true }
const C = TEMAS.claro.base
const E = TEMAS.escuro.base

function estilo(no: { props: { style?: unknown } }) {
  return StyleSheet.flatten(no.props.style as never) as Record<string, unknown>
}

describe('Botão: estados desenhados (3.1 do desenho dos controles)', () => {
  test('normal: primário em cápsula com degradê, realce e brilho; rótulo 16/20 600; sem opacidade', async () => {
    await render(<Botao titulo="Publicar" aoPressionar={() => {}} tamanho="grande" />)
    const botao = screen.getByRole('button', { name: 'Publicar' })
    expect(botao).toBeEnabled()
    expect(botao).not.toBeBusy()
    const e = estilo(botao)
    expect(e).toMatchObject({
      // O sólido fica por baixo do degradê: onde `backgroundImage` não desenha, vale ele.
      backgroundColor: C.primaria,
      backgroundImage: `linear-gradient(180deg, ${C.primariaTopo}, ${C.primariaBase})`,
      borderRadius: 999,
      minHeight: 56,
    })
    expect(String(e.boxShadow)).toContain('inset 0px 1px 0px rgba(255,255,255,0.22)')
    expect(String(e.boxShadow)).toContain('0px 6px 14px rgba(194,73,31,0.30)')
    expect(e.opacity).toBeUndefined()
    expect(screen.getByText('Publicar')).toHaveStyle({ fontSize: 16, lineHeight: 20 })
  })

  test('alturas: grande 56, médio 48 (padrão), compacto 48 (D75, sem depender de folga), alto 56', async () => {
    await render(
      <>
        <Botao titulo="Grande" tamanho="grande" aoPressionar={() => {}} />
        <Botao titulo="Médio" aoPressionar={() => {}} />
        <Botao titulo="Compacto" tamanho="compacto" aoPressionar={() => {}} />
        <Botao titulo="Alto" tamanho="alto" icone="proximaEtapa" aoPressionar={() => {}} />
      </>,
    )
    expect(estilo(screen.getByRole('button', { name: 'Grande' })).minHeight).toBe(56)
    expect(estilo(screen.getByRole('button', { name: 'Médio' })).minHeight).toBe(48)
    expect(estilo(screen.getByRole('button', { name: 'Compacto' })).minHeight).toBe(48)
    // O alvo do compacto já tem 48 visíveis (D75); a folga de 4 é só reserva para o dedo.
    expect(screen.getByRole('button', { name: 'Compacto' })).toHaveProp('hitSlop', 4)
    expect(estilo(screen.getByRole('button', { name: 'Alto' })).minHeight).toBe(56)
  })

  test('pressionado: a camada `primariaPressionada` cobre o degradê (sem sombra) e o botão afunda 0,98', async () => {
    await render(<Botao titulo="Publicar" aoPressionar={() => {}} estadoDeVitrine="pressionado" />)
    const botao = screen.getByRole('button', { name: 'Publicar' })
    const camada = within(botao).getByTestId('botao-camada-de-toque')
    expect(estilo(camada)).toMatchObject({ backgroundColor: C.primariaPressionada, opacity: 1 })
    expect(estilo(botao).boxShadow).toBeUndefined()
    // O afundar é a escala do invólucro animado, em volta do botão.
    expect(estilo(botao.parent as never)).toMatchObject({ transform: [{ scale: 0.98 }] })
  })

  test('foco: anel de 2 na cor de foco coral, afastado 2 (teclado)', async () => {
    await render(<Botao titulo="Duplicar" variante="secundario" aoPressionar={() => {}} />)
    const botao = screen.getByRole('button', { name: 'Duplicar' })
    await fireEvent(botao, 'focus')
    expect(estilo(botao)).toMatchObject({
      outlineWidth: 2,
      outlineOffset: 2,
      outlineColor: C.foco,
    })
    expect(C.foco).toBe(C.primaria)
    expect(E.foco).toBe(E.primaria)
    await fireEvent(botao, 'blur')
    expect(estilo(botao).outlineWidth).toBeUndefined()
  })

  test('secundário: tonal sem borda, texto `texto`; terciário: só texto `destaque`', async () => {
    await render(
      <>
        <Botao titulo="Salvar rascunho" variante="secundario" aoPressionar={() => {}} />
        <Botao titulo="Ver todas" variante="terciario" aoPressionar={() => {}} />
      </>,
    )
    expect(estilo(screen.getByRole('button', { name: 'Salvar rascunho' }))).toMatchObject({
      backgroundColor: C.botaoTonal,
      borderWidth: 0,
    })
    expect(screen.getByText('Salvar rascunho')).toHaveStyle({ color: C.texto })
    expect(estilo(screen.getByRole('button', { name: 'Ver todas' }))).toMatchObject({
      backgroundColor: 'transparent',
      borderWidth: 0,
    })
    expect(screen.getByText('Ver todas')).toHaveStyle({ color: C.destaque })
  })

  test('desabilitado: aria-disabled, coral apagado (não cinza), texto a 70% e o motivo com cadeado', async () => {
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
    expect(e.backgroundColor).toBe(C.quenteFundo)
    // Sem degradê, realce nem brilho: desabilitado não parece uma ação viva.
    expect(e.backgroundImage).toBeUndefined()
    expect(e.boxShadow).toBeUndefined()
    expect(e.opacity).toBeUndefined()
    expect(screen.getByText('Enviar código')).toHaveStyle({ color: comOpacidade(C.destaque, 0.7) })
    expect(screen.getByText('Aceite os termos para continuar.')).toBeOnTheScreen()
    await fireEvent.press(botao)
    expect(aoPressionar).not.toHaveBeenCalled()
  })

  test('desabilitado nas outras variantes: secundário em `tonal` e terciário a 50%', async () => {
    await render(
      <>
        <Botao titulo="Secundário" variante="secundario" desabilitado aoPressionar={() => {}} />
        <Botao titulo="Terciário" variante="terciario" desabilitado aoPressionar={() => {}} />
      </>,
    )
    expect(estilo(screen.getByRole('button', { name: 'Secundário' })).backgroundColor).toBe(C.tonal)
    expect(screen.getByText('Secundário')).toHaveStyle({
      color: comOpacidade(C.textoSuave, 0.7),
    })
    expect(screen.getByText('Terciário')).toHaveStyle({ color: comOpacidade(C.destaque, 0.5) })
  })

  test('carregando: aria-busy, ignora toques, mantém o rótulo e troca por `tituloCarregando`', async () => {
    const aoPressionar = jest.fn()
    await render(<Botao titulo="Entrar" aoPressionar={aoPressionar} carregando />)
    const botao = screen.getByRole('button', { name: 'Entrar' })
    expect(botao).toBeBusy()
    expect(botao).toBeDisabled()
    expect(screen.getByText('Entrar')).toBeOnTheScreen()
    await fireEvent.press(botao)
    expect(aoPressionar).not.toHaveBeenCalled()
  })

  test('carregando com `tituloCarregando`: o texto muda, o nome acessível continua o título', async () => {
    await render(
      <Botao titulo="Entrar" tituloCarregando="Entrando..." aoPressionar={() => {}} carregando />,
    )
    expect(screen.getByText('Entrando...')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeBusy()
  })

  describe('carregando: o indicador só aparece depois de 250 ms', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    test('resposta rápida não pisca; a lenta ganha o indicador no lugar do ícone', async () => {
      await render(<Botao titulo="Salvar" icone="check" carregando aoPressionar={() => {}} />)
      expect(screen.queryByTestId('botao-indicador', COM_ESCONDIDOS)).toBeNull()
      await act(async () => {
        jest.advanceTimersByTime(249)
      })
      expect(screen.queryByTestId('botao-indicador', COM_ESCONDIDOS)).toBeNull()
      await act(async () => {
        jest.advanceTimersByTime(1)
      })
      expect(screen.getByTestId('botao-indicador', COM_ESCONDIDOS)).toBeOnTheScreen()
    })
  })

  test('destrutivo é tonal vermelho (sem contorno): fundo `erroFundo`, texto `erro`', async () => {
    await render(<Botao titulo="Excluir" variante="destrutivo" aoPressionar={() => {}} />)
    const e = estilo(screen.getByRole('button', { name: 'Excluir' }))
    expect(e).toMatchObject({ backgroundColor: C.erroFundo, borderWidth: 0 })
    expect(screen.getByText('Excluir')).toHaveStyle({ color: C.erro })
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })

  test('alto (Ao vivo): 56 de altura', async () => {
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

describe('aparenciaDoBotao: a tabela única das variantes', () => {
  const tema = (cores: typeof C, escuro: boolean) => ({
    cores,
    escuro,
    solido: (cor: string) => cor,
    semFundo: 'transparent',
  })

  test('Aumentar contraste: sem degradê nem sombra e com borda de 2 em `texto` (menos no terciário)', () => {
    const a = aparenciaDoBotao('primario', false, tema(E, true), false, { aumentarContraste: true })
    expect(a).toMatchObject({ degrade: null, sombra: null, borda: E.texto, larguraDaBorda: 2 })
    const t = aparenciaDoBotao('terciario', false, tema(E, true), false, {
      aumentarContraste: true,
    })
    expect(t.borda).toBeNull()
  })

  test('Reduzir transparência: o secundário usa `botaoTonalOpaco`', () => {
    const a = aparenciaDoBotao('secundario', false, tema(E, true), false, {
      reduzirTransparencia: true,
    })
    expect(a.fundo).toBe(E.botaoTonalOpaco)
  })

  test('o brilho do primário segue as cores em vigor (escuro coral, claro terracota)', () => {
    expect(aparenciaDoBotao('primario', false, tema(E, true)).sombra).toContain('rgba(255,138,101')
    expect(aparenciaDoBotao('primario', false, tema(C, false)).sombra).toContain('rgba(194,73,31')
  })
})

describe('Campo: estados desenhados (3.2 do desenho dos controles)', () => {
  function caixa() {
    return screen.getByTestId('campo-caixa')
  }

  test('normal: 56, raio 16, fundo `campoFundo`, borda de 1 `campoBorda`; rótulo 16/22 600 em `texto`', async () => {
    await render(<Campo rotulo="Nome" testID="campo" value="" onChangeText={() => {}} />)
    expect(caixa()).toHaveStyle({
      minHeight: 56,
      borderRadius: 16,
      borderWidth: 1,
      backgroundColor: C.campoFundo,
      borderColor: C.campoBorda,
    })
    expect(screen.getByText('Nome')).toHaveStyle({
      fontSize: 16,
      lineHeight: 22,
      color: C.texto,
    })
  })

  test('o exemplo é mais apagado que o valor digitado (`campoExemplo`) e o texto é 16/22', async () => {
    await render(
      <Campo rotulo="E-mail" exemplo="nome@exemplo.com" value="" onChangeText={() => {}} />,
    )
    const campo = screen.getByLabelText('E-mail')
    expect(campo).toHaveProp('placeholderTextColor', C.campoExemplo)
    expect(C.campoExemplo).not.toBe(C.textoSuave)
    expect(campo).toHaveStyle({ fontSize: 16, color: C.texto })
  })

  test('foco: o anel de 2 pt coral entra em camada (a borda não muda de espessura, o texto não se desloca)', async () => {
    await render(<Campo rotulo="E-mail" testID="campo" value="" onChangeText={() => {}} />)
    const antes = estilo(caixa())
    expect(estilo(screen.getByTestId('campo-anel')).opacity).toBe(0)
    await fireEvent(screen.getByLabelText('E-mail'), 'focus')
    const depois = estilo(caixa())
    const anel = estilo(screen.getByTestId('campo-anel'))
    expect(anel).toMatchObject({
      opacity: 1,
      borderWidth: 2,
      borderColor: C.foco,
      boxShadow: `0px 0px 0px 4px ${C.focoHalo}`,
    })
    expect(depois.borderColor).toBe(C.foco)
    expect(depois.borderWidth).toBe(antes.borderWidth)
    await fireEvent(screen.getByLabelText('E-mail'), 'blur')
    expect(estilo(screen.getByTestId('campo-anel')).opacity).toBe(0)
  })

  test('erro: anel de erro permanente, frase que diz como corrigir e ligação ao campo', async () => {
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
    expect(estilo(screen.getByTestId('campo-anel-de-erro'))).toMatchObject({
      borderWidth: 2,
      borderColor: C.erro,
    })
    expect(screen.getByLabelText('Hora de início')).toHaveProp(
      'accessibilityHint',
      'Erro: Use o formato 16:00',
    )
    // Uma linha de apoio só: o erro substitui a ajuda. A frase vai em `texto` (o ícone leva o `erro`).
    expect(screen.getByText('Use o formato 16:00')).toHaveStyle({ color: C.texto })
    expect(screen.queryByText('No horário da comunidade.')).toBeNull()
  })

  test('erro com foco: vale o anel de erro e o halo vira `erroFundo`', async () => {
    await render(
      <Campo rotulo="Nome" testID="campo" value="" onChangeText={() => {}} erro="Falta." />,
    )
    await fireEvent(screen.getByLabelText('Nome'), 'focus')
    expect(estilo(screen.getByTestId('campo-anel'))).toMatchObject({
      borderColor: C.erro,
      boxShadow: `0px 0px 0px 4px ${C.erroFundo}`,
    })
  })

  test('inválido sem mensagem própria: anel de erro e aviso ao leitor de tela, sem frase', async () => {
    await render(<Campo rotulo="Senha" testID="campo" value="x" onChangeText={() => {}} invalido />)
    expect(screen.getByTestId('campo-anel-de-erro')).toBeOnTheScreen()
    expect(caixa()).toHaveStyle({ borderColor: C.erro })
    expect(screen.getByLabelText('Senha')).toHaveProp('accessibilityHint', 'Valor inválido')
  })

  test('sucesso: borda `sucesso` e a frase ("Nome disponível") no lugar da ajuda', async () => {
    await render(
      <Campo
        rotulo="Apelido"
        testID="campo"
        value="ana"
        onChangeText={() => {}}
        ajuda="Só letras."
        sucesso="Nome disponível"
      />,
    )
    expect(caixa()).toHaveStyle({ borderColor: C.sucesso })
    expect(screen.getByText('Nome disponível')).toBeOnTheScreen()
    expect(screen.queryByText('Só letras.')).toBeNull()
  })

  test('desabilitado: aria-disabled, não editável, fundo `campoDesabilitado` e sem borda (sem tracejado)', async () => {
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
    const e = estilo(caixa())
    expect(e).toMatchObject({ backgroundColor: C.campoDesabilitado, borderColor: 'transparent' })
    expect(e.borderStyle).toBeUndefined()
    expect(screen.queryByTestId('campo-anel')).toBeNull()
  })

  test('somente leitura: transparente, borda `tonalBorda`, texto cheio e cadeado; validando: indicador', async () => {
    await render(
      <>
        <Campo rotulo="Código" testID="campo" value="A1B2" onChangeText={() => {}} somenteLeitura />
        <Campo rotulo="Duração" value="60" onChangeText={() => {}} validando sufixo="min" />
      </>,
    )
    expect(screen.getByLabelText('Código')).toHaveProp('editable', false)
    expect(caixa()).toHaveStyle({ backgroundColor: 'transparent', borderColor: C.tonalBorda })
    expect(screen.getByLabelText('Código')).toHaveStyle({ color: C.texto })
    expect(screen.getByText('min')).toBeOnTheScreen()
  })

  test('nenhum estado usa opacidade na caixa', async () => {
    await render(
      <Campo rotulo="Nome" testID="campo" value="" onChangeText={() => {}} desabilitado />,
    )
    expect(estilo(caixa()).opacity).toBeUndefined()
  })
})
