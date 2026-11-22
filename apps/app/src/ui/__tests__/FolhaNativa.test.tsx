/**
 * Regressão da folha em branco (build 10, iOS 26, 22/11/2026): a folha nativa abriu com a alça e
 * o corpo inteiro vazio. Estes testes travam as duas coisas que a evitam: (1) as rotas de folha
 * nativa saem de `opcoesDaFolhaNativa` (altura do conteúdo, `fitToContents`); (2) o conteúdo de
 * uma folha nunca depende de altura do pai (`flex: 1`, `100%`) nem nasce com opacidade zero.
 */
import { render, screen } from '@testing-library/react-native'
import { StyleSheet, Text, View } from 'react-native'
import type { ReactTestRendererJSON } from 'react-test-renderer'

import { TelaTrocarComunidade } from '@/funcionalidades/comunidade/TelaTrocarComunidade'
import { renderizarTela, respostaEu } from '@/testes/telas'

import { Folha } from '../Folha'
import { FolhaNaTela, MenuDeAcoes } from '../FolhaNaTela'
import { alturaMaximaDaFolha, opcoesDaFolhaNativa } from '../opcoesDaFolha'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(() => jest.fn()),
}))

declare const __dirname: string

/** Texto de um arquivo do app (o teste confere o que os layouts escrevem). */
function ler(arquivo: string): string {
  const fs = require('node:fs') as { readFileSync: (c: string, e: string) => string }
  return fs.readFileSync(`${__dirname}/../../app/${arquivo}`, 'utf8')
}

type No = ReactTestRendererJSON
const ehNo = (x: unknown): x is No => typeof x === 'object' && x !== null && 'type' in x

/** Todos os nós da árvore, do mais externo ao mais interno. */
function nos(raiz: No | No[] | null): No[] {
  if (!raiz) return []
  const lista = Array.isArray(raiz) ? raiz : [raiz]
  return lista.flatMap((n) => [n, ...nos((n.children ?? []).filter(ehNo))])
}

const estilo = (n: No): { opacity?: number } =>
  (StyleSheet.flatten(n.props.style as object | undefined) ?? {}) as { opacity?: number }

/** O caminho de cima até o primeiro nó que casa com `procura` (inclusive ele). */
function caminhoAte(raiz: No[], procura: (n: No) => boolean): No[] | null {
  for (const n of raiz) {
    if (procura(n)) return [n]
    const filhos = (n.children ?? []).filter(ehNo)
    const abaixo = caminhoAte(filhos, procura)
    if (abaixo) return [n, ...abaixo]
  }
  return null
}

/**
 * Nenhum nó que CONTÉM algo nasce com opacidade zero (o véu do toque pressionado, vazio e
 * decorativo, fica de fora: é opacidade zero sem filhos).
 */
function semOpacidadeZero(arvore: No | No[] | null) {
  const escondem = nos(arvore)
    .filter((n) => estilo(n).opacity === 0 && (n.children?.length ?? 0) > 0)
    .map((n) => n.type)
  expect(escondem).toEqual([])
}

/** Nada entre a raiz e a rolagem pede altura do pai: é o que zera a folha de altura do conteúdo. */
function semAlturaDoPai(arvore: No | No[] | null) {
  const caminho = caminhoAte(
    Array.isArray(arvore) ? arvore : arvore ? [arvore] : [],
    (n) => n.type === 'RCTScrollView',
  )
  // A folha tem uma rolagem.
  expect(caminho).not.toBeNull()
  const pedemAlturaDoPai: string[] = []
  for (const n of caminho!) {
    const e = estilo(n) as { flex?: number; height?: unknown; maxHeight?: number }
    if (n.type === 'RCTScrollView') {
      // A rolagem tem teto, não altura do pai.
      expect(e.maxHeight).toBeGreaterThan(0)
      continue
    }
    if (e.flex !== undefined || e.height === '100%') pedemAlturaDoPai.push(n.type)
  }
  expect(pedemAlturaDoPai).toEqual([])
}

describe('as rotas de folha nativa', () => {
  const cores = { superficieElevada: '#26234f' }

  test('têm a altura do conteúdo, grabber, raio 28 e a superfície elevada', () => {
    expect(opcoesDaFolhaNativa(cores)).toEqual({
      presentation: 'formSheet',
      sheetAllowedDetents: 'fitToContents',
      sheetGrabberVisible: true,
      sheetCornerRadius: 28,
      contentStyle: { backgroundColor: '#26234f' },
    })
  })

  test('nenhum layout escreve formSheet ou alturas à mão: tudo sai do mesmo helper', () => {
    for (const arquivo of ['(autenticado)/_layout.tsx', '(publico)/_layout.tsx']) {
      const texto = ler(arquivo)
      expect(`${arquivo}: ${/presentation:\s*'formSheet'/.test(texto)}`).toBe(`${arquivo}: false`)
      expect(`${arquivo}: ${/sheetAllowedDetents/.test(texto)}`).toBe(`${arquivo}: false`)
      expect(texto).toContain('opcoesDaFolhaNativa')
    }
  })

  test('as três folhas (Comunidades, Como conseguir um convite e Tenho um convite) usam o helper', () => {
    const autenticado = ler('(autenticado)/_layout.tsx')
    expect(autenticado).toMatch(/name="trocar-comunidade"[^]*?\.\.\.folha/)
    expect(autenticado).toMatch(/name="como-conseguir-convite"[^]*?\.\.\.folha/)
    const publico = ler('(publico)/_layout.tsx')
    expect(publico).toMatch(/name="colar-convite"[^]*?opcoesDaFolhaNativa\(cores\)/)
  })

  test('a rolagem tem teto pela janela, com piso para janela baixa', () => {
    expect(alturaMaximaDaFolha(800, 47)).toBe(697)
    expect(alturaMaximaDaFolha(300, 47)).toBe(240)
  })
})

describe('o conteúdo da folha renderiza visível', () => {
  test('Folha: título, conteúdo e Fechar visíveis, sem opacidade zero e sem altura do pai', async () => {
    const { toJSON } = await render(
      <Folha titulo="Uma folha" aoFechar={() => undefined}>
        <Text>Conteúdo da folha</Text>
      </Folha>,
    )
    expect(screen.getByText('Uma folha')).toBeVisible()
    expect(screen.getByText('Conteúdo da folha')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeVisible()
    semOpacidadeZero(toJSON() as No)
    semAlturaDoPai(toJSON() as No)
  })

  test('Comunidades (a folha que abriu em branco): lista e ações visíveis, sem altura do pai', async () => {
    const { toJSON } = await renderizarTela(<TelaTrocarComunidade />, {
      rotas: { 'GET /api/v1/eu': () => ({ status: 200, corpo: respostaEu('membro') }) },
    })
    expect(await screen.findByRole('radio', { name: /^Jovens Centro/ })).toBeVisible()
    expect(screen.getByText('Trocar de comunidade')).toBeVisible()
    expect(screen.getByRole('button', { name: /^Entrar em outra comunidade/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Criar comunidade/ })).toBeVisible()
    semOpacidadeZero(toJSON() as unknown as No[])
    semAlturaDoPai(toJSON() as unknown as No[])
  })

  test('Comunidades sem nenhuma comunidade: o vazio com ação aparece (nunca um corpo vazio)', async () => {
    await renderizarTela(<TelaTrocarComunidade />, {
      rotas: {
        'GET /api/v1/eu': () => ({
          status: 200,
          corpo: { ...respostaEu('membro'), comunidades: [] },
        }),
      },
    })
    expect(await screen.findByText('Nenhuma comunidade ainda')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Verificar de novo' })).toBeVisible()
  })

  test('FolhaNaTela e o menu de ações: conteúdo visível, sem opacidade zero', async () => {
    const { toJSON, rerender } = await render(
      <FolhaNaTela aberta titulo="Outra folha" aoFechar={() => undefined}>
        <View>
          <Text>Dentro da folha</Text>
        </View>
      </FolhaNaTela>,
    )
    expect(screen.getByText('Dentro da folha')).toBeVisible()
    semOpacidadeZero(toJSON() as No | No[])
    await rerender(
      <MenuDeAcoes
        aberto
        titulo="Mais ações"
        aoFechar={() => undefined}
        acoes={[{ titulo: 'Editar', icone: 'editar', aoPressionar: () => undefined }]}
      />,
    )
    expect(screen.getByText('Editar')).toBeVisible()
    semOpacidadeZero(toJSON() as No | No[])
  })
})
