/* eslint-disable no-script-url -- o caso inclui javascript: de propósito: nunca pode virar botão */
import { onlineManager } from '@tanstack/react-query'
import { screen, userEvent } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import { Linking } from 'react-native'

import { criarDeposito } from '@/funcionalidades/offline/deposito'
import { ProvedorOffline } from '@/funcionalidades/offline/ProvedorOffline'
import { baixarRepertorio } from '@/funcionalidades/offline/repertorioOffline'
import { EVENTO_ID } from '@/testes/fixturas'
import {
  encontroDoMeuRepertorioDeTeste,
  itensDeTeste,
  pacoteDoRepertorioDeTeste,
} from '@/testes/repertorio'
import { BASE, COMUNIDADE, renderizarTela } from '@/testes/telas'

import { TelaCifraDoRepertorio } from '../TelaCifraDoRepertorio'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}))
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }))

const MEU = `${BASE}/meu-repertorio`
const YT = 'https://youtu.be/abc123'
const DRIVE = 'https://drive.google.com/file/d/1AbC/view'

const itensComLinks = () =>
  itensDeTeste().map((item, i) =>
    i === 0
      ? {
          ...item,
          links: [
            { url: YT, rotulo: 'Versão original' },
            { url: DRIVE },
            { url: 'javascript:alert(1)' },
          ],
        }
      : item,
  )

function abrirLeitor() {
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ eventoId: EVENTO_ID, itemId: 'item-1' } as never)
  return {
    [`GET ${MEU}`]: () => ({
      status: 200,
      corpo: { encontros: [encontroDoMeuRepertorioDeTeste({ itens: itensComLinks() })] },
    }),
  }
}

describe('links da música no leitor do Meu repertório (D80)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    onlineManager.setOnline(true)
  })

  test('um botão por link válido, "Abrir no YouTube" e "Abrir no Drive", que abre no sistema', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: abrirLeitor() })
    const usuario = userEvent.setup()
    expect(await screen.findByText('Versão original')).toBeOnTheScreen()
    expect(screen.getAllByRole('button', { name: /^Abrir no / })).toHaveLength(2)
    expect(screen.getByText(/você sai do Uni Jovem/)).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Abrir no YouTube: Versão original' }))
    expect(abrir).toHaveBeenCalledWith(YT)
    await usuario.press(screen.getByRole('button', { name: 'Abrir no Drive: Firmes na rocha' }))
    expect(abrir).toHaveBeenLastCalledWith(DRIVE)
    expect(abrir).not.toHaveBeenCalledWith('javascript:alert(1)')
  })

  test('a música sem links não mostra a seção', async () => {
    const rotas = abrirLeitor()
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ eventoId: EVENTO_ID, itemId: 'item-2' } as never)
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas })
    expect(await screen.findByRole('header', { name: 'Canto de manhã' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Abrir no / })).toBeNull()
  })

  test('sem internet, com a cópia guardada: os links aparecem como texto e os botões esperam a internet', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar({
      contaId: 'conta-eu',
      comunidadeId: COMUNIDADE,
      vinculoId: null,
      validadeDias: 7,
    })
    await baixarRepertorio(
      p,
      { get: async () => pacoteDoRepertorioDeTeste({ itens: itensComLinks() }) } as never,
      EVENTO_ID,
    )
    // A cópia guardada leva os links só como texto.
    const guardado = await p.lerRepertorio(EVENTO_ID)
    expect(guardado?.pacote.itens[0]?.links).toEqual(itensComLinks()[0]!.links)

    onlineManager.setOnline(false)
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ eventoId: EVENTO_ID, itemId: 'item-1' } as never)
    await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <TelaCifraDoRepertorio />
      </ProvedorOffline>,
      { papel: 'membro', rotas: abrirLeitor() },
    )
    const botao = await screen.findByRole('button', { name: 'Abrir no YouTube: Versão original' })
    expect(botao).toBeDisabled()
    expect(screen.getAllByText('Abrir o link precisa de internet.').length).toBeGreaterThan(0)
  })
})
