/**
 * D56: a barra de abas flutuante também nas telas empilhadas de navegação.
 * O roteador é o de verdade (expo-router), com a pilha `(autenticado)`, as
 * abas do app e a barra global montadas como no layout; as telas são
 * marcadores que mostram o espaço que a `Tela` reservaria no fim.
 */
import { Stack, router } from 'expo-router'
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { useContext } from 'react'
import { DeviceEventEmitter, Text } from 'react-native'

import { ContextoDaBarraDeAbas } from '@/ui/Tela'

import { AbasDoApp } from '../AbasDoApp'
import { BarraDaPilha, leiauteDaTelaNaPilha } from '../BarraDaPilha'
import { espacoDaBarra } from '../BarraDeAbas'
import {
  abaDosSegmentos,
  barraFlutuanteNaJanela,
  barraFlutuanteNaRota,
  nomeDaRota,
  ROTAS_SEM_BARRA_FLUTUANTE,
} from '../rotasDaBarra'

// O Jest dá o caminho deste arquivo; o tsconfig do app não traz os tipos do Node.
declare const __dirname: string

// A barra só precisa do nome e do avatar da conta; a sessão inteira fica de fora.
jest.mock('@/estado/sessao', () => ({ useSessao: () => ({ conta: null }) }))

/** Marcador de tela: o nome e o espaço da barra que ela recebeu da pilha. */
function marcador(nome: string) {
  return function Marcador() {
    const espaco = useContext(ContextoDaBarraDeAbas)
    return <Text>{`${nome} (fim ${espaco})`}</Text>
  }
}

const ESPACO = espacoDaBarra(0)

const ROTAS = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(autenticado)/_layout': () => (
    <>
      <Stack screenOptions={{ headerShown: false }} screenLayout={leiauteDaTelaNaPilha} />
      <BarraDaPilha />
    </>
  ),
  '(autenticado)/(abas)/_layout': AbasDoApp,
  '(autenticado)/(abas)/index': marcador('Início'),
  '(autenticado)/(abas)/agenda': marcador('Agenda'),
  '(autenticado)/(abas)/programacoes': marcador('Programas'),
  '(autenticado)/(abas)/comunidade': marcador('Equipe'),
  '(autenticado)/(abas)/perfil': marcador('Perfil'),
  '(autenticado)/avisos/index': marcador('Lista de avisos'),
  '(autenticado)/avisos/novo': marcador('Novo aviso'),
  '(autenticado)/evento/novo': marcador('Nova programação'),
  '(autenticado)/evento/[eventoId]/index': marcador('Detalhe do encontro'),
  '(autenticado)/evento/[eventoId]/ao-vivo': marcador('Ao vivo'),
}

/**
 * Barras de abas visíveis agora, contadas pelo item Início: a das abas fica
 * escondida do leitor de tela embaixo da pilha, e a barra escondida pelo
 * teclado (`display: none`) também não conta.
 */
const barrasVisiveis = () => screen.queryAllByRole('tab', { name: 'Início' })

describe('barra flutuante nas telas empilhadas (D56)', () => {
  test('numa lista empilhada, a barra aparece com a última aba marcada e o espaço reservado', async () => {
    await renderRouter(ROTAS, { initialUrl: '/agenda' })
    expect(await screen.findByText(`Agenda (fim ${ESPACO})`)).toBeOnTheScreen()
    // Nas abas, só a barra do próprio `Tabs`.
    expect(barrasVisiveis()).toHaveLength(1)

    await act(async () => router.push('/avisos'))
    expect(await screen.findByText(`Lista de avisos (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(barrasVisiveis()).toHaveLength(1)
    expect(screen.getByRole('tab', { name: 'Agenda', selected: true })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: 'Início', selected: false })).toBeOnTheScreen()
  })

  test('no detalhe do encontro, também; tocar numa aba fecha a pilha e abre a raiz dela', async () => {
    const r = await renderRouter(ROTAS, { initialUrl: '/' })
    expect(await screen.findByText(`Início (fim ${ESPACO})`)).toBeOnTheScreen()
    await act(async () => router.push('/avisos'))
    await act(async () => router.push('/evento/e1'))
    expect(await screen.findByText(`Detalhe do encontro (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: 'Início', selected: true })).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('tab', { name: 'Programas' }))
    expect(await screen.findByText(`Programas (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(r.getSegments()).toEqual(['(autenticado)', '(abas)', 'programacoes'])
    // A pilha fechou: nem o detalhe nem a lista continuam montados por baixo.
    expect(screen.queryByText(/Detalhe do encontro/, { includeHiddenElements: true })).toBeNull()
    expect(screen.queryByText(/Lista de avisos/, { includeHiddenElements: true })).toBeNull()
    // De volta às abas, a barra é a delas, com Programas marcada.
    expect(barrasVisiveis()).toHaveLength(1)
    expect(screen.getByRole('tab', { name: 'Programas', selected: true })).toBeOnTheScreen()
  })

  test('aberta por link, sem abas embaixo, a aba troca a tela pelas abas', async () => {
    const r = await renderRouter(ROTAS, { initialUrl: '/avisos' })
    expect(await screen.findByText(`Lista de avisos (fim ${ESPACO})`)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('tab', { name: 'Equipe' }))
    expect(await screen.findByText(`Equipe (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(r.getSegments()).toEqual(['(autenticado)', '(abas)', 'comunidade'])
  })

  test('Nova programação, formulário de criação e Ao vivo ficam sem a barra e sem o espaço', async () => {
    await renderRouter(ROTAS, { initialUrl: '/avisos' })
    expect(await screen.findByText(`Lista de avisos (fim ${ESPACO})`)).toBeOnTheScreen()

    await act(async () => router.push('/evento/novo'))
    expect(await screen.findByText('Nova programação (fim 0)')).toBeOnTheScreen()
    expect(barrasVisiveis()).toHaveLength(0)

    await act(async () => router.back())
    expect(await screen.findByText(`Lista de avisos (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(barrasVisiveis()).toHaveLength(1)

    await act(async () => router.push('/avisos/novo'))
    expect(await screen.findByText('Novo aviso (fim 0)')).toBeOnTheScreen()
    expect(barrasVisiveis()).toHaveLength(0)

    await act(async () => router.push('/evento/e1/ao-vivo'))
    expect(await screen.findByText('Ao vivo (fim 0)')).toBeOnTheScreen()
    expect(barrasVisiveis()).toHaveLength(0)
  })

  test('com o teclado aberto, a barra da pilha some', async () => {
    await renderRouter(ROTAS, { initialUrl: '/avisos' })
    expect(await screen.findByText(`Lista de avisos (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(barrasVisiveis()).toHaveLength(1)
    await act(async () => DeviceEventEmitter.emit('keyboardWillShow', {}))
    expect(barrasVisiveis()).toHaveLength(0)
    await act(async () => DeviceEventEmitter.emit('keyboardWillHide', {}))
    expect(barrasVisiveis()).toHaveLength(1)
  })
})

describe('rotas com e sem a barra (D56)', () => {
  test('nome da rota: sem o grupo autenticado e sem o /index do fim', () => {
    expect(nomeDaRota(['(autenticado)', 'evento', '[eventoId]'])).toBe('evento/[eventoId]')
    expect(nomeDaRota('evento/[eventoId]/index')).toBe('evento/[eventoId]')
    expect(nomeDaRota('oracao/index')).toBe('oracao')
  })

  test('abas e exceções sem a barra global; o resto com ela', () => {
    expect(barraFlutuanteNaRota('(abas)')).toBe(false)
    expect(barraFlutuanteNaRota(['(autenticado)', '(abas)', 'agenda'])).toBe(false)
    expect(barraFlutuanteNaRota('evento/novo')).toBe(false)
    expect(barraFlutuanteNaRota('evento/[eventoId]/ao-vivo')).toBe(false)
    expect(barraFlutuanteNaRota('conteudos/[tipo]/novo')).toBe(false)
    expect(barraFlutuanteNaRota('evento/[eventoId]/index')).toBe(true)
    expect(barraFlutuanteNaRota(['(autenticado)', 'avisos'])).toBe(true)
    expect(barraFlutuanteNaRota('escalas/index')).toBe(true)
    expect(barraFlutuanteNaRota('plataforma/[comunidadeId]')).toBe(true)
  })

  test('a aba aberta sai dos segmentos (o Início é a rota vazia)', () => {
    expect(abaDosSegmentos(['(autenticado)', '(abas)'])).toBe('index')
    expect(abaDosSegmentos(['(autenticado)', '(abas)', 'perfil'])).toBe('perfil')
    expect(abaDosSegmentos(['(autenticado)', 'avisos'])).toBeNull()
  })

  test('na web larga a navegação é a lateral; no celular e na web estreita, a barra', () => {
    expect(barraFlutuanteNaJanela(false, 1200)).toBe(true)
    expect(barraFlutuanteNaJanela(true, 390)).toBe(true)
    expect(barraFlutuanteNaJanela(true, 1200)).toBe(false)
  })

  test('toda exceção é uma rota que existe (um erro de digitação faria a barra aparecer)', () => {
    const fs = require('node:fs') as { existsSync: (caminho: string) => boolean }
    const pasta = `${__dirname}/../../../app/(autenticado)`
    for (const rota of ROTAS_SEM_BARRA_FLUTUANTE) {
      const existe =
        fs.existsSync(`${pasta}/${rota}.tsx`) || fs.existsSync(`${pasta}/${rota}/index.tsx`)
      expect({ rota, existe }).toEqual({ rota, existe: true })
    }
  })
})
