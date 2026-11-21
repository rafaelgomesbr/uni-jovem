/**
 * `convite.folha` (D63): "Tenho um convite ou código", com o Colar, o erro que
 * pede o link inteiro e o convite guardado só em memória.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'

import { lerConviteEmEspera } from '../../convite/conviteEmEspera'
import {
  esquecerConvitePendenteParaTeste,
  reconhecerConvite,
  removerConvitePendente,
} from '../convitePendente'
import { destinoInterno, tomarDestino } from '../destinoDepoisDeEntrar'
import { FolhaDeConvite, TEXTO_DE_CONVITE_NAO_RECONHECIDO } from '../FolhaDeConvite'

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

const TOKEN = 'c'.repeat(43)
const copiado = jest.fn()
// O dublê de jest.setup.ts só tem `setStringAsync`; a folha também lê a área de transferência.
;(Clipboard as unknown as { getStringAsync: jest.Mock }).getStringAsync = copiado

describe('reconhecerConvite', () => {
  test('link do convite, só o token, código da comunidade e link do código', () => {
    expect(reconhecerConvite(`https://unijovem.exemplo/convite#t=${TOKEN}`)).toEqual({
      tipo: 'convite',
      token: TOKEN,
    })
    expect(reconhecerConvite(TOKEN)).toEqual({ tipo: 'convite', token: TOKEN })
    expect(reconhecerConvite('abcd 2345')).toEqual({ tipo: 'codigo', codigo: 'ABCD2345' })
    expect(reconhecerConvite('https://unijovem.exemplo/entrar/ABCD-2345')).toEqual({
      tipo: 'codigo',
      codigo: 'ABCD2345',
    })
    expect(reconhecerConvite('olá, tudo bem?')).toBeNull()
    expect(reconhecerConvite('   ')).toBeNull()
  })
})

describe('FolhaDeConvite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    esquecerConvitePendenteParaTeste()
    tomarDestino()
  })

  test('Colar traz o que está na área de transferência para o campo', async () => {
    copiado.mockResolvedValue(`  https://unijovem.exemplo/convite#t=${TOKEN}  `)
    await render(<FolhaDeConvite />)
    await fireEvent.press(screen.getByRole('button', { name: 'Colar' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Link ou código').props.value).toBe(
        `https://unijovem.exemplo/convite#t=${TOKEN}`,
      ),
    )
  })

  test('o link do convite fica guardado só em memória e a folha volta para a entrada', async () => {
    await render(<FolhaDeConvite />)
    await fireEvent.changeText(
      screen.getByLabelText('Link ou código'),
      `https://unijovem.exemplo/convite#t=${TOKEN}`,
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(lerConviteEmEspera()).toBe(TOKEN)
    expect(router.back).toHaveBeenCalled()
  })

  test('o código da comunidade vira o destino depois de entrar (Tenho um código, já preenchido)', async () => {
    await render(<FolhaDeConvite />)
    await fireEvent.changeText(screen.getByLabelText('Link ou código'), 'ABCD 2345')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(lerConviteEmEspera()).toBeNull()
    expect(destinoInterno('/entrar/ABCD2345')).toBe('/entrar/ABCD2345')
    expect(tomarDestino()).toBe('/entrar/ABCD2345')
  })

  test('texto que não é convite: o erro pede o link inteiro e nada é guardado nem navegado', async () => {
    await render(<FolhaDeConvite />)
    await fireEvent.changeText(screen.getByLabelText('Link ou código'), 'oi, tudo bem?')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText(TEXTO_DE_CONVITE_NAO_RECONHECIDO)).toBeOnTheScreen()
    expect(lerConviteEmEspera()).toBeNull()
    expect(router.back).not.toHaveBeenCalled()
    // Digitar de novo tira o erro: nada prende a pessoa.
    await fireEvent.changeText(screen.getByLabelText('Link ou código'), 'ABCD2345')
    expect(screen.queryByText(TEXTO_DE_CONVITE_NAO_RECONHECIDO)).toBeNull()
  })

  test('remover o convite o esquece e devolve o "Desfazer"', async () => {
    await render(<FolhaDeConvite />)
    await fireEvent.changeText(screen.getByLabelText('Link ou código'), TOKEN)
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(lerConviteEmEspera()).toBe(TOKEN)
    const desfazer = removerConvitePendente()
    expect(lerConviteEmEspera()).toBeNull()
    desfazer()
    expect(lerConviteEmEspera()).toBe(TOKEN)
  })
})
