import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { renderizarTela } from '@/testes/telas'
import { abrirAjustes } from '@/servicos/notificacoesDoSistema'
import { HospedeiroDeToast } from '@/ui/Toast'

import { pedirPermissaoEmContexto, usePermissaoDoSistema } from '../../notificacoes/permissao'
import {
  AVISOS_LIGADOS,
  BoasVindas,
  FALHA_AO_LIGAR_OS_AVISOS,
  TelaBoasVindas,
} from '../TelaBoasVindas'

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

jest.mock('../../notificacoes/permissao', () => ({
  usePermissaoDoSistema: jest.fn(),
  pedirPermissaoEmContexto: jest.fn(),
}))

jest.mock('@/servicos/notificacoesDoSistema', () => ({
  abrirAjustes: jest.fn(),
  NOTIFICACOES_DISPONIVEIS: true,
}))

function permissao(estado: 'concedida' | 'negada' | 'nao_perguntada' | 'indisponivel' | null) {
  jest.mocked(usePermissaoDoSistema).mockReturnValue(estado)
}

async function abrir(ui = <BoasVindas comunidade="Jovens Esperança" />) {
  return renderizarTela(
    <>
      {ui}
      <HospedeiroDeToast />
    </>,
    { papel: 'membro' },
  )
}

describe('boas-vindas depois de entrar numa comunidade (UX v3, fluxo a)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useLocalSearchParams).mockReturnValue({})
    permissao('nao_perguntada')
  })

  test('os textos do documento de UX, com o nome de quem entrou e da comunidade', async () => {
    await abrir()
    expect(await screen.findByText('Tudo pronto, Ana.')).toBeOnTheScreen()
    expect(screen.getByText('Você entrou em Jovens Esperança.')).toBeOnTheScreen()
    expect(
      screen.getByText(
        /Quando a liderança marcar um encontro ou chamar você para servir, a gente avisa pelo celular\./,
      ),
    ).toBeOnTheScreen()
    // UMA ação principal e a saída sem culpa.
    expect(screen.getByRole('button', { name: 'Ligar os avisos' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeOnTheScreen()
  })

  test('"Ligar os avisos" pede a permissão do sistema (só aqui, depois de explicar) e segue ao Início', async () => {
    jest.mocked(pedirPermissaoEmContexto).mockResolvedValue('concedida')
    await abrir()
    await fireEvent.press(await screen.findByRole('button', { name: 'Ligar os avisos' }))
    await waitFor(() => expect(pedirPermissaoEmContexto).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(AVISOS_LIGADOS)).toBeOnTheScreen()
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
  })

  test('negar no sistema não trava: avisa onde ligar depois e leva ao Início do mesmo jeito', async () => {
    jest.mocked(pedirPermissaoEmContexto).mockResolvedValue('negada')
    await abrir()
    await fireEvent.press(await screen.findByRole('button', { name: 'Ligar os avisos' }))
    expect(await screen.findByText(FALHA_AO_LIGAR_OS_AVISOS)).toBeOnTheScreen()
    expect(FALHA_AO_LIGAR_OS_AVISOS).toBe(
      'Não deu para ligar os avisos. Você pode ligar depois em Perfil, Notificações.',
    )
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
  })

  test('"Agora não" vai ao Início sem pedir nada ao sistema', async () => {
    await abrir()
    await fireEvent.press(await screen.findByRole('button', { name: 'Agora não' }))
    expect(router.replace).toHaveBeenCalledWith('/')
    expect(pedirPermissaoEmContexto).not.toHaveBeenCalled()
  })

  test('quem já ligou os avisos: o botão vira "Ver o próximo encontro", sem "Agora não"', async () => {
    permissao('concedida')
    await abrir()
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver o próximo encontro' }))
    expect(router.replace).toHaveBeenCalledWith('/')
    expect(screen.queryByRole('button', { name: 'Agora não' })).toBeNull()
    expect(pedirPermissaoEmContexto).not.toHaveBeenCalled()
  })

  test('sistema que já bloqueou: o caminho é "Abrir os ajustes" (o sistema não pergunta de novo)', async () => {
    permissao('negada')
    await abrir()
    await fireEvent.press(await screen.findByRole('button', { name: 'Abrir os ajustes' }))
    expect(abrirAjustes).toHaveBeenCalledTimes(1)
    expect(pedirPermissaoEmContexto).not.toHaveBeenCalled()
  })

  test('na web, sem notificação: "Ir para o Início" e nenhuma promessa de aviso no botão', async () => {
    permissao('indisponivel')
    await abrir()
    await fireEvent.press(await screen.findByRole('button', { name: 'Ir para o Início' }))
    expect(router.replace).toHaveBeenCalledWith('/')
    expect(screen.queryByRole('button', { name: 'Ligar os avisos' })).toBeNull()
  })

  test('quem criou a comunidade: a única ação é montar o primeiro encontro', async () => {
    await abrir(<BoasVindas comunidade="Jovens Esperança" lider />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Criar o encontro do sábado' }))
    expect(router.replace).toHaveBeenCalledWith('/evento/novo')
    expect(screen.queryByRole('button', { name: 'Ligar os avisos' })).toBeNull()
  })

  test('a rota lê o nome da comunidade do parâmetro; sem ele, usa a comunidade ativa', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ comunidade: 'Jovens da Vila' })
    const { unmount } = await abrir(<TelaBoasVindas />)
    expect(await screen.findByText('Você entrou em Jovens da Vila.')).toBeOnTheScreen()
    await unmount()
    jest.mocked(useLocalSearchParams).mockReturnValue({})
    await abrir(<TelaBoasVindas />)
    expect(await screen.findByText('Você entrou em Jovens Centro.')).toBeOnTheScreen()
  })
})
