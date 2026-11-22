/**
 * D56: a barra de abas flutuante também nas telas empilhadas de navegação.
 * O roteador é o de verdade (expo-router), com a pilha `(autenticado)`, as
 * abas do app e a barra global montadas como no layout; as telas são
 * marcadores que mostram o espaço que a `Tela` reservaria no fim.
 */
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { useContext } from 'react'
import { DeviceEventEmitter, Text } from 'react-native'

import { ContextoDaBarraDeAbas } from '@/ui/Tela'

import { ABAS } from '../abas'
import { AbasDoApp } from '../AbasDoApp'
import { BarraDaPilha, leiauteDaTelaNaPilha } from '../BarraDaPilha'
import { espacoDaBarra } from '../BarraDeAbas'
import { RedirecionarParaAAgenda, RedirecionarParaMinhaParte } from '../Redirecionamentos'
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

/** A Agenda mostra o modo e o filtro pedidos no link (os redirecionamentos da D68). */
function MarcadorDaAgenda() {
  const espaco = useContext(ContextoDaBarraDeAbas)
  const { vista, filtro } = useLocalSearchParams<{ vista?: string; filtro?: string }>()
  const pedidos = [vista, filtro].filter(Boolean).join(', ')
  return <Text>{`Agenda${pedidos ? ` (${pedidos})` : ''} (fim ${espaco})`}</Text>
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
  '(autenticado)/(abas)/agenda': MarcadorDaAgenda,
  '(autenticado)/(abas)/comunidade': marcador('Comunidade'),
  '(autenticado)/(abas)/perfil': marcador('Perfil'),
  '(autenticado)/avisos/index': marcador('Lista de avisos'),
  '(autenticado)/avisos/novo': marcador('Novo aviso'),
  '(autenticado)/programacoes': RedirecionarParaAAgenda,
  '(autenticado)/escalas/index': RedirecionarParaMinhaParte,
  '(autenticado)/escalas/substituicao/[atribuicaoId]': marcador('Pedir substituição'),
  '(autenticado)/evento/novo': marcador('Novo encontro'),
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

    await fireEvent.press(screen.getByRole('tab', { name: 'Comunidade' }))
    expect(await screen.findByText(`Comunidade (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(r.getSegments()).toEqual(['(autenticado)', '(abas)', 'comunidade'])
    // A pilha fechou: nem o detalhe nem a lista continuam montados por baixo.
    expect(screen.queryByText(/Detalhe do encontro/, { includeHiddenElements: true })).toBeNull()
    expect(screen.queryByText(/Lista de avisos/, { includeHiddenElements: true })).toBeNull()
    // De volta às abas, a barra é a delas, com Comunidade marcada.
    expect(barrasVisiveis()).toHaveLength(1)
    expect(screen.getByRole('tab', { name: 'Comunidade', selected: true })).toBeOnTheScreen()
  })

  test('aberta por link, sem abas embaixo, a aba troca a tela pelas abas', async () => {
    const r = await renderRouter(ROTAS, { initialUrl: '/avisos' })
    expect(await screen.findByText(`Lista de avisos (fim ${ESPACO})`)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('tab', { name: 'Comunidade' }))
    expect(await screen.findByText(`Comunidade (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(r.getSegments()).toEqual(['(autenticado)', '(abas)', 'comunidade'])
  })

  test('Novo encontro, formulário de criação e Ao vivo ficam sem a barra e sem o espaço', async () => {
    await renderRouter(ROTAS, { initialUrl: '/avisos' })
    expect(await screen.findByText(`Lista de avisos (fim ${ESPACO})`)).toBeOnTheScreen()

    await act(async () => router.push('/evento/novo'))
    expect(await screen.findByText('Novo encontro (fim 0)')).toBeOnTheScreen()
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

describe('as quatro abas e as rotas antigas (D57, D68)', () => {
  test('a barra tem Início, Agenda, Comunidade e Perfil, nesta ordem, e o Início é o sol', async () => {
    expect(ABAS.map((a) => a.rotulo)).toEqual(['Início', 'Agenda', 'Comunidade', 'Perfil'])
    expect(ABAS.map((a) => a.rota)).toEqual(['index', 'agenda', 'comunidade', 'perfil'])
    expect(ABAS[0]!.icone).toBe('sol')
    await renderRouter(ROTAS, { initialUrl: '/' })
    expect(await screen.findByText(`Início (fim ${ESPACO})`)).toBeOnTheScreen()
    // A ordem que o leitor de tela percorre é a da tela.
    const nomes = screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)
    expect(nomes).toEqual(['Início', 'Agenda', 'Comunidade', 'Perfil'])
    // Sem bolinha nem número em nenhuma aba: o sino é o único lugar de "tem novidade".
    expect(nomes.some((n) => /\d/.test(n))).toBe(false)
    expect(screen.queryByRole('tab', { name: /Escalas/ })).toBeNull()
  })

  test('/programacoes (a antiga aba Programas) redireciona para a Agenda no modo Lista', async () => {
    const r = await renderRouter(ROTAS, { initialUrl: '/programacoes' })
    expect(await screen.findByText(`Agenda (lista) (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(r.getSegments()).toEqual(['(autenticado)', '(abas)', 'agenda'])
    expect(screen.getByRole('tab', { name: 'Agenda', selected: true })).toBeOnTheScreen()
  })

  test('/escalas (a antiga aba Escalas) redireciona para a Agenda, em Lista, com "Só o que é meu"', async () => {
    const r = await renderRouter(ROTAS, { initialUrl: '/escalas' })
    expect(await screen.findByText(`Agenda (lista, meu) (fim ${ESPACO})`)).toBeOnTheScreen()
    expect(r.getSegments()).toEqual(['(autenticado)', '(abas)', 'agenda'])
    expect(screen.getByRole('tab', { name: 'Agenda', selected: true })).toBeOnTheScreen()
  })

  test('o pedido "Preciso de alguém no meu lugar" segue empilhado por cima, sem a barra (é um modal)', async () => {
    await renderRouter(ROTAS, { initialUrl: '/agenda' })
    await screen.findByText(`Agenda (fim ${ESPACO})`)
    await act(async () => router.push('/escalas/substituicao/a1'))
    expect(await screen.findByText('Pedir substituição (fim 0)')).toBeOnTheScreen()
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
    expect(barraFlutuanteNaRota('escalas/substituicao/[atribuicaoId]')).toBe(false)
    expect(barraFlutuanteNaRota('plataforma/[comunidadeId]')).toBe(true)
  })

  test('a aba aberta sai dos segmentos (o Início é a rota vazia)', () => {
    expect(abaDosSegmentos(['(autenticado)', '(abas)'])).toBe('index')
    expect(abaDosSegmentos(['(autenticado)', '(abas)', 'perfil'])).toBe('perfil')
    // A antiga aba Escalas virou redirecionamento: também fora do mapa.
    expect(abaDosSegmentos(['(autenticado)', '(abas)', 'escalas'])).toBeNull()
    // A antiga aba Programas não é mais aba: fica fora do mapa da última aba.
    expect(abaDosSegmentos(['(autenticado)', '(abas)', 'programacoes'])).toBeNull()
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
