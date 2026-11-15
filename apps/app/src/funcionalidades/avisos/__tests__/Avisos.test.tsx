import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import { Alert } from 'react-native'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { AvisosDoInicio } from '../../inicio/AvisosDoInicio'
import { TelaAviso } from '../TelaAviso'
import { TelaAvisos } from '../TelaAvisos'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const AVISO = {
  id: '88888888-8888-4888-8888-000000000001',
  titulo: 'Ensaio na sexta',
  texto: 'Quem toca, chegue às 19:00.',
  estado: 'publicado',
  fixado: false,
  publicadoEm: '2026-11-12T12:00:00.000Z',
  visivelAte: null,
  criadoEm: '2026-11-12T12:00:00.000Z',
  atualizadoEm: '2026-11-12T12:00:00.000Z',
  versao: 4,
  autorNome: 'Ana Souza',
}

describe('avisos', () => {
  afterEach(() => jest.restoreAllMocks())

  test('no Início, o fixado aparece com a marca escrita, não só a cor', async () => {
    await renderizarTela(
      <AvisosDoInicio
        podePublicar={false}
        avisos={[
          { ...AVISO, id: 'a1', titulo: 'Retiro', fixado: true },
          { ...AVISO, id: 'a2' },
        ]}
      />,
    )
    const botoes = await screen.findAllByRole('button', { name: /publicado em 12\/11\/2026/ })
    expect(botoes[0]).toHaveAccessibleName('Retiro. Fixado, publicado em 12/11/2026')
    expect(screen.getByText('Fixado')).toBeOnTheScreen()
  })

  test('membro não vê o botão de novo aviso', async () => {
    await renderizarTela(<TelaAvisos />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/avisos`]: () => ({ status: 200, corpo: { avisos: [AVISO] } }) },
    })
    expect(await screen.findByText('Ensaio na sexta')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Novo aviso' })).toBeNull()
  })

  test('organizador fixa com a versão e despublica com confirmação', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, b) => b?.at(-1)?.onPress?.())
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ avisoId: AVISO.id })
    const { servidor } = await renderizarTela(<TelaAviso />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/avisos/${AVISO.id}`]: () => ({ status: 200, corpo: AVISO }),
        [`PATCH ${BASE}/avisos/${AVISO.id}`]: () => ({ status: 200, corpo: { id: AVISO.id } }),
        [`POST ${BASE}/avisos/${AVISO.id}/despublicar`]: () => ({
          status: 200,
          corpo: { id: AVISO.id },
        }),
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Fixar no topo' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PATCH', `${BASE}/avisos/${AVISO.id}`)[0]?.corpo).toEqual({
        versao: 4,
        fixado: true,
      }),
    )
    // Despublicar fica na folha "Mais ações" (3.7.4), com confirmação.
    await fireEvent.press(screen.getByRole('button', { name: 'Mais ações' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Despublicar' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/avisos/${AVISO.id}/despublicar`)).toHaveLength(
        1,
      ),
    )
  })
})
