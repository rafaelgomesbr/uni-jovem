/**
 * D69: rotas que deixaram de ser tela continuam abrindo (notificações e favoritos antigos): a
 * linha do tempo do dia leva à Agenda já naquele dia, e "Duplicar" leva à conferência do
 * "Igual ao último sábado" com o encontro de origem.
 */
import { render } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import { TelaDuplicar } from '../../eventos/TelaDuplicar'
import { RedirecionarParaODia } from '../RedirecionarParaODia'

const mockRedireciona = jest.fn()
jest.mock('expo-router', () => ({
  Redirect: (props: { href: unknown }) => {
    mockRedireciona(props.href)
    return null
  },
  useLocalSearchParams: jest.fn(() => ({})),
}))

describe('rotas que viraram mockRedirecionamento', () => {
  beforeEach(() => jest.clearAllMocks())

  test('/agenda/[data] abre a Agenda nesse dia', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ data: '2026-11-28' })
    await render(<RedirecionarParaODia />)
    expect(mockRedireciona).toHaveBeenCalledWith({
      pathname: '/agenda',
      params: { dia: '2026-11-28' },
    })
  })

  test('data impossível no link (9999-12-31): abre a Agenda inteira, sem cair', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ data: '9999-12-31' })
    await render(<RedirecionarParaODia />)
    expect(mockRedireciona).toHaveBeenCalledWith({ pathname: '/agenda', params: {} })
  })

  test('/evento/[id]/duplicar leva à conferência, com o encontro de origem', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: 'e1' })
    await render(<TelaDuplicar />)
    expect(mockRedireciona).toHaveBeenCalledWith({
      pathname: '/evento/igual-ao-ultimo',
      params: { origem: 'e1' },
    })
  })
})
