import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { Papel } from '@uj/dominio'
import { router } from 'expo-router'

import { BASE, renderizarTela } from '@/testes/telas'

import { ETAPAS_POR_PAPEL } from '../missao'
import { TelaMapaDaMissao } from '../TelaMapaDaMissao'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const INICIO = {
  proximosEventos: [],
  minhasEscalas: [],
  minhasTarefas: [],
  substituicoesAbertas: 0,
  avisos: [],
}

/** Toca em todos os botões e caixas de exemplo que estiverem na tela. */
async function usarAsDemonstracoes() {
  for (const nome of [/exemplo/i, /^Subir /, /^Descer /]) {
    for (const b of screen.queryAllByRole('button', { name: nome })) {
      if (!b.props['aria-disabled']) await fireEvent.press(b)
    }
  }
  for (const r of screen.queryAllByRole('radio')) await fireEvent.press(r)
  for (const c of screen.queryAllByRole('checkbox')) await fireEvent.press(c)
}

describe('mapa da missão', () => {
  beforeEach(() => jest.clearAllMocks())

  test.each<Papel>(['membro', 'organizador', 'admin'])(
    '%s percorre o mapa inteiro sem nenhuma escrita na API',
    async (papel) => {
      const { servidor } = await renderizarTela(<TelaMapaDaMissao />, {
        papel,
        rotas: { [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO }) },
      })
      const etapas = ETAPAS_POR_PAPEL[papel]
      for (let i = 0; i < etapas.length; i++) {
        expect(
          await screen.findByText(`Etapa ${i + 1} de ${etapas.length}`, { exact: false }),
        ).toBeOnTheScreen()
        await usarAsDemonstracoes()
        await fireEvent.press(
          screen.getByRole('button', {
            name: i + 1 < etapas.length ? 'Próxima etapa' : 'Concluir o mapa',
          }),
        )
      }
      expect(await screen.findByText('Mapa concluído')).toBeOnTheScreen()
      // Celebração sem pontos nem ranking.
      expect(screen.queryByText(/pontos|ranking|posição/i)).toBeNull()
      await waitFor(() => expect(screen.getByText('Completar o perfil')).toBeOnTheScreen())

      const escritas = servidor.pedidos.filter((p) => p.metodo !== 'GET')
      expect(escritas).toEqual([])
    },
  )

  test('pausar e pular guardam só no aparelho e voltam', async () => {
    const { servidor } = await renderizarTela(<TelaMapaDaMissao />, { papel: 'membro' })
    await fireEvent.press(await screen.findByRole('button', { name: 'Próxima etapa' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Pausar e continuar depois' }))
    expect(router.back).toHaveBeenCalled()
    const { setItemAsync } = jest.requireMock('expo-secure-store') as { setItemAsync: jest.Mock }
    await waitFor(() =>
      expect(setItemAsync).toHaveBeenCalledWith(
        'uj.missao.conta-eu',
        JSON.stringify({ estado: 'pausado', etapa: 1, feitas: [] }),
      ),
    )
    expect(servidor.pedidos.filter((p) => p.metodo !== 'GET')).toEqual([])
  })
})
