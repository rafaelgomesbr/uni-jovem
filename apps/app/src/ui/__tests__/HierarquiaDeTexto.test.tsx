/**
 * D83: a hierarquia de texto vista na tela. O dono olhou o iPhone e disse "os textos estão muito
 * gigantes e não seguem uma hierarquia". Aqui os papéis (título, seção, corpo, apoio, rótulo) são
 * renderizados de verdade: tamanho, peso, cor, teto de escala, a coluna do horário, a linha de
 * lista em dois níveis, o contraste AA do apoio nos dois temas e os alvos de toque.
 */
import { render, screen } from '@testing-library/react-native'
import { ALTURA, contraste, MINIMO, TEMAS, TIPO } from '@uj/tokens'
import { StyleSheet, View } from 'react-native'

import { CabecalhoDeAcordeao } from '../../funcionalidades/comunidade/CabecalhoDeAcordeao'
import { Botao, BotaoIcone } from '../Botao'
import { FAMILIA } from '../fontes'
import { ColunaDeHora, LARGURA_DA_HORA, LinhaDeLista } from '../LinhaDeLista'
import { Secao } from '../Secao'
import { Texto } from '../Texto'
import { ProvedorDeTemaForcado } from '../tema'

function estilo(no: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(no.props.style as never) ?? {}) as Record<string, unknown>
}

/** O estilo do primeiro ancestral que define `chave` (o pai de um `Texto` é o componente, não a `View`). */
function ancestralComEstilo(no: { parent: unknown }, chave: string): Record<string, unknown> {
  let atual = no.parent as { parent: unknown; props: { style?: unknown } } | null
  while (atual) {
    const e = estilo(atual)
    if (e[chave] !== undefined) return e
    atual = atual.parent as typeof atual
  }
  throw new Error(`nenhum ancestral define ${chave}`)
}

const C = TEMAS.claro.base
const E = TEMAS.escuro.base

describe('papéis de texto: o que a tela recebe (D83)', () => {
  test('título de tela, seção, linha primária, corpo, apoio, rótulo e chip: tamanho, peso e cor', async () => {
    await render(
      <ProvedorDeTemaForcado nome="claro">
        <Texto variante="display">Boa noite, Rafael</Texto>
        <Texto variante="tituloTela">Igual ao último encontro</Texto>
        <Texto variante="secao">Hoje: 3 encontros</Texto>
        <Texto variante="tituloItem">Louvor</Texto>
        <Texto variante="corpo">Marque o próximo.</Texto>
        <Texto variante="apoio">15 min · Ninguém convocado</Texto>
        <Texto variante="sobrancelha">Seu resumo</Texto>
        <Texto variante="chip">Rascunho</Texto>
      </ProvedorDeTemaForcado>,
    )
    expect(screen.getByText('Boa noite, Rafael')).toHaveStyle({
      fontSize: 30,
      lineHeight: 34,
      fontFamily: FAMILIA.tituloForte,
      color: C.texto,
    })
    expect(screen.getByText('Igual ao último encontro')).toHaveStyle({
      fontSize: 28,
      lineHeight: 32,
      fontFamily: FAMILIA.tituloForte,
    })
    expect(screen.getByText('Hoje: 3 encontros')).toHaveStyle({
      fontSize: 20,
      lineHeight: 26,
      fontFamily: FAMILIA.textoForte,
      color: C.texto,
    })
    expect(screen.getByText('Louvor')).toHaveStyle({
      fontSize: 17,
      lineHeight: 22,
      fontFamily: FAMILIA.textoForte,
      color: C.texto,
    })
    expect(screen.getByText('Marque o próximo.')).toHaveStyle({
      fontSize: 16,
      lineHeight: 24,
      fontFamily: FAMILIA.texto,
    })
    // O apoio: 15 em 400 e, sem escolha de quem chama, a cor suave.
    expect(screen.getByText('15 min · Ninguém convocado')).toHaveStyle({
      fontSize: 15,
      lineHeight: 20,
      fontFamily: FAMILIA.texto,
      color: C.textoSuave,
    })
    // O rótulo: caixa-alta com espaço entre letras, coral por padrão.
    expect(screen.getByText('Seu resumo')).toHaveStyle({
      fontSize: 14,
      lineHeight: 18,
      fontFamily: FAMILIA.textoForte,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      color: C.destaque,
    })
    expect(screen.getByText('Rascunho')).toHaveStyle({ fontSize: 14, lineHeight: 18 })
  })

  test('os cinco níveis medem cada um menos que o de cima (a vista separa sem precisar de cor)', async () => {
    await render(
      <>
        <Texto variante="tituloTela">Título</Texto>
        <Texto variante="secao">Seção</Texto>
        <Texto variante="tituloItem">Item</Texto>
        <Texto variante="corpo">Corpo</Texto>
        <Texto variante="apoio">Apoio</Texto>
      </>,
    )
    const tamanhos = ['Título', 'Seção', 'Item', 'Corpo', 'Apoio'].map(
      (t) => estilo(screen.getByText(t)).fontSize as number,
    )
    expect(tamanhos).toEqual([28, 20, 17, 16, 15])
    for (let i = 1; i < tamanhos.length; i += 1) {
      expect(tamanhos[i - 1] as number).toBeGreaterThan(tamanhos[i] as number)
    }
  })

  test('teto da escala do sistema: título 1,5 (não quebra em três linhas), seção 1,6, apoio e rótulo 2', async () => {
    await render(
      <>
        <Texto variante="display">A</Texto>
        <Texto variante="tituloTela">B</Texto>
        <Texto variante="secao">C</Texto>
        <Texto variante="apoio">D</Texto>
        <Texto variante="sobrancelha">E</Texto>
        <Texto variante="corpo">F</Texto>
      </>,
    )
    expect(screen.getByText('A')).toHaveProp('maxFontSizeMultiplier', 1.5)
    expect(screen.getByText('B')).toHaveProp('maxFontSizeMultiplier', 1.5)
    expect(screen.getByText('C')).toHaveProp('maxFontSizeMultiplier', 1.6)
    expect(screen.getByText('D')).toHaveProp('maxFontSizeMultiplier', 2)
    expect(screen.getByText('E')).toHaveProp('maxFontSizeMultiplier', 2)
    // O corpo nunca ganha teto: quem aumentou a fonte do sistema lê o que precisa ler.
    expect(screen.getByText('F').props.maxFontSizeMultiplier).toBeUndefined()
    // E a escala nunca é desligada.
    expect(screen.getByText('A').props.allowFontScaling).not.toBe(false)
  })

  test('títulos e seções são anunciados como cabeçalho, com o nível do papel', async () => {
    await render(
      <>
        <Texto variante="display">Início</Texto>
        <Texto variante="secao">Avisos</Texto>
        <Texto variante="sobrancelha">Para você</Texto>
        <Texto variante="apoio">Sem papel de cabeçalho</Texto>
      </>,
    )
    expect(screen.getByRole('header', { name: 'Início' })).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'Avisos' })).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'Para você' })).toBeOnTheScreen()
    expect(screen.queryByRole('header', { name: 'Sem papel de cabeçalho' })).toBeNull()
  })
})

describe('contraste AA do apoio nos temas claro e escuro (D83)', () => {
  for (const [nome, paleta] of [
    ['claro', C],
    ['escuro', E],
  ] as const) {
    test(`tema ${nome}: o apoio renderizado usa textoSuave e passa de 7:1 sobre o fundo e a superfície`, async () => {
      await render(
        <ProvedorDeTemaForcado nome={nome}>
          <Texto variante="apoio">Sáb., 28 nov. · 16:00</Texto>
        </ProvedorDeTemaForcado>,
      )
      const cor = estilo(screen.getByText('Sáb., 28 nov. · 16:00')).color as string
      expect(cor).toBe(paleta.textoSuave)
      expect(contraste(cor, paleta.fundo)).toBeGreaterThanOrEqual(MINIMO.texto)
      expect(contraste(cor, paleta.fundo)).toBeGreaterThanOrEqual(7)
      expect(contraste(cor, paleta.superficie)).toBeGreaterThanOrEqual(7)
      // E é mais suave que o texto principal: o apoio fica atrás na hierarquia.
      expect(contraste(paleta.texto, paleta.fundo)).toBeGreaterThan(contraste(cor, paleta.fundo))
    })
  }
})

describe('coluna do horário e linha de lista em dois níveis (D83)', () => {
  test('ColunaDeHora: começo e fim à esquerda, tabulares, numa coluna fixa de 48', async () => {
    await render(<ColunaDeHora inicio="19:05" fim="19:20" />)
    expect(LARGURA_DA_HORA).toBe(48)
    const inicio = screen.getByText('19:05')
    const fim = screen.getByText('19:20')
    expect(inicio).toHaveStyle({ fontSize: 15 })
    expect(estilo(inicio).fontVariant).toEqual(['tabular-nums'])
    expect(fim).toHaveStyle({ fontSize: 15, color: C.textoSuave })
    expect(estilo(fim).fontVariant).toEqual(['tabular-nums'])
    // O começo tem a caixa de linha da linha primária (22): fica na mesma base do título ao lado.
    expect(estilo(inicio).lineHeight).toBe(TIPO.tituloItem.altura)
    // A coluna não encolhe: o título de toda linha começa no mesmo x.
    const coluna = ancestralComEstilo(inicio as never, 'minWidth')
    expect(coluna.minWidth).toBe(48)
    expect(coluna.alignItems).toBe('flex-start')
  })

  test('linha de lista: primária 17/600, secundária 15/400 suave e horário em 15 tabular', async () => {
    await render(
      <ProvedorDeTemaForcado nome="claro">
        <LinhaDeLista
          hora="19:05"
          titulo="Louvor"
          descricao="15 min · Ninguém convocado"
          aoPressionar={() => {}}
        />
      </ProvedorDeTemaForcado>,
    )
    const titulo = screen.getByText('Louvor')
    const descricao = screen.getByText('15 min · Ninguém convocado')
    const hora = screen.getByText('19:05')
    expect(titulo).toHaveStyle({ fontSize: 17, fontFamily: FAMILIA.textoForte, color: C.texto })
    expect(descricao).toHaveStyle({ fontSize: 15, fontFamily: FAMILIA.texto, color: C.textoSuave })
    expect(hora).toHaveStyle({ fontSize: 15, color: C.texto })
    expect(estilo(hora).fontVariant).toEqual(['tabular-nums'])
    // A primária pesa mais e mede mais; o horário não compete com ela.
    expect(estilo(titulo).fontSize as number).toBeGreaterThan(estilo(hora).fontSize as number)
  })

  test('o espaço entre a linha primária e a secundária é de 4 (escala de 4)', async () => {
    await render(<LinhaDeLista titulo="Louvor" descricao="15 min" aoPressionar={() => {}} />)
    const coluna = ancestralComEstilo(screen.getByText('Louvor') as never, 'gap')
    expect(coluna.gap).toBe(4)
  })
})

describe('Secao: rótulo pequeno ou título de seção (D83)', () => {
  test('o padrão é o rótulo em caixa-alta de 14; `titulo` é a seção de 20 em 600', async () => {
    await render(
      <>
        <Secao titulo="Pessoas">
          <View />
        </Secao>
        <Secao titulo="Hoje: 3 encontros" estilo="titulo">
          <View />
        </Secao>
      </>,
    )
    expect(screen.getByText('Pessoas')).toHaveStyle({
      fontSize: 14,
      textTransform: 'uppercase',
      color: C.textoSuave,
    })
    expect(screen.getByText('Hoje: 3 encontros')).toHaveStyle({
      fontSize: 20,
      fontFamily: FAMILIA.textoForte,
    })
    expect(screen.getByRole('header', { name: 'Hoje: 3 encontros' })).toBeOnTheScreen()
  })
})

describe('cabeçalho de acordeão: o nome pesa mais que a contagem (D83)', () => {
  test('"Banda e equipe: 9 pessoas": nome em 17/600 e contagem em 15/400, o texto inteiro intacto', async () => {
    await render(<CabecalhoDeAcordeao icone="escalas" titulo="Banda e equipe: 9 pessoas" />)
    // O texto lido e achado é o mesmo de antes da mudança.
    const inteiro = screen.getByText('Banda e equipe: 9 pessoas')
    expect(inteiro).toHaveStyle({ fontSize: 17, fontFamily: FAMILIA.textoForte })
    const contagem = screen.getByText('9 pessoas')
    expect(contagem).toHaveStyle({ fontSize: 15, fontFamily: FAMILIA.texto })
  })

  test('sem dois-pontos, o título é uma peça só', async () => {
    await render(<CabecalhoDeAcordeao icone="ajustes" titulo="Organização" />)
    expect(screen.getByText('Organização')).toHaveStyle({ fontSize: 17 })
  })
})

describe('alvos de toque (D83 mantém a D75: 48, nunca menos que 44)', () => {
  test('botão em qualquer tamanho e botão de ícone com palavra têm 44 ou mais (na verdade 48)', async () => {
    await render(
      <>
        <Botao titulo="Grande" tamanho="grande" aoPressionar={() => {}} />
        <Botao titulo="Médio" aoPressionar={() => {}} />
        <Botao titulo="Compacto" tamanho="compacto" aoPressionar={() => {}} />
        <BotaoIcone icone="voltar" texto="Voltar" rotulo="Voltar" aoPressionar={() => {}} />
      </>,
    )
    for (const nome of ['Grande', 'Médio', 'Compacto', 'Voltar']) {
      const minimo = estilo(screen.getByRole('button', { name: nome })).minHeight as number
      expect(minimo).toBeGreaterThanOrEqual(44)
      expect(minimo).toBeGreaterThanOrEqual(ALTURA.botao.medio)
    }
  })

  test('a linha de lista que se toca tem 56, bem acima de 44', async () => {
    await render(<LinhaDeLista titulo="Mais" aoPressionar={() => {}} />)
    const linha = screen.getByRole('button', { name: 'Mais' })
    expect(estilo(linha).minHeight as number).toBeGreaterThanOrEqual(44)
    expect(estilo(linha).minHeight).toBe(ALTURA.linha)
  })
})
