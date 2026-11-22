import { fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { Share } from 'react-native'

import { renderizarTela, respostaEu } from '@/testes/telas'

import { TelaComoConseguirConvite } from '../../convite/TelaComoConseguirConvite'
import { TelaPessoasBloqueadas } from '../../denuncias/TelaPessoasBloqueadas'
import { Celebracao } from '../../onboarding/TelaMapaDaMissao'
import { TelaPlataforma } from '../../plataforma/TelaPlataforma'
import { TelaPrivacidade } from '../../privacidade/TelaPrivacidade'
import { TelaSeguranca } from '../../seguranca/TelaSeguranca'
import { PreviaDaComunidade, pessoasDaPrevia } from '../PreviaDaComunidade'
import { VazioComSol } from '../VazioComSol'

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

const COMUNIDADE = {
  nome: 'Jovens Esperança',
  cor: '#5B4BDB',
  temLogo: false,
  pessoas: 15,
  modoEntrada: 'codigo_direto' as const,
  proximoEncontro: {
    titulo: 'Sábado Jovem',
    inicio: '2026-11-28T19:00:00.000Z',
    fuso: 'America/Sao_Paulo',
  },
}

beforeEach(() => jest.clearAllMocks())

describe('PreviaDaComunidade: "Você foi convidado para ..."', () => {
  test('nome, pessoas e próximo encontro público, com o sol e sem dado pessoal', async () => {
    await render(<PreviaDaComunidade comunidade={COMUNIDADE} />)
    expect(screen.getByText('Você foi convidado para Jovens Esperança')).toBeOnTheScreen()
    expect(screen.getByText('15 pessoas')).toBeOnTheScreen()
    expect(screen.getByText('Próximo encontro')).toBeOnTheScreen()
    expect(screen.getByText('Sábado Jovem')).toBeOnTheScreen()
    expect(screen.getByText(/28\/11\/2026 às 16:00/)).toBeOnTheScreen()
    // O destaque da tela: o cartão do momento com o sol nascendo.
    expect(screen.getByTestId('cartao-do-momento')).toBeOnTheScreen()
    expect(screen.queryByText('A liderança aprova a entrada')).toBeNull()
  })

  test('sem encontro público: não há bloco de encontro; com aprovação: o chip diz em texto', async () => {
    await render(
      <PreviaDaComunidade
        comunidade={{
          ...COMUNIDADE,
          pessoas: 1,
          proximoEncontro: null,
          modoEntrada: 'codigo_com_aprovacao',
        }}
      />,
    )
    expect(screen.getByText('1 pessoa')).toBeOnTheScreen()
    expect(screen.queryByText('Próximo encontro')).toBeNull()
    expect(screen.getByText('A liderança aprova a entrada')).toBeOnTheScreen()
    expect(pessoasDaPrevia(2)).toBe('2 pessoas')
  })
})

describe('VazioComSol', () => {
  test('o sol, o título, o porquê e a ação; o sol não fala para o leitor de tela', async () => {
    const aoPressionar = jest.fn()
    await render(
      <VazioComSol
        titulo="Nenhum aviso por enquanto."
        descricao="Os avisos da liderança aparecem aqui."
        acao={{ titulo: 'Novo aviso', aoPressionar }}
        rodape={<></>}
      />,
    )
    expect(screen.getByText('Nenhum aviso por enquanto.')).toBeOnTheScreen()
    expect(screen.getByText('Os avisos da liderança aparecem aqui.')).toBeOnTheScreen()
    expect(screen.getByTestId('sol-corpo', { includeHiddenElements: true })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Novo aviso' }))
    expect(aoPressionar).toHaveBeenCalledTimes(1)
  })
})

describe('Como conseguir um convite', () => {
  test('mostra a mensagem pronta, pede por mensagem e leva a "Tenho um código"', async () => {
    const compartilhar = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined })
    await render(<TelaComoConseguirConvite />)
    expect(screen.getByText('Pode me mandar o link de convite?')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Pedir por mensagem' }))
    expect(compartilhar).toHaveBeenCalledWith({ message: 'Pode me mandar o link de convite?' })
    await fireEvent.press(screen.getByRole('button', { name: 'Já tenho o link ou o código' }))
    expect(router.replace).toHaveBeenCalledWith('/tenho-um-codigo')
    compartilhar.mockRestore()
  })
})

describe('Segurança e privacidade', () => {
  test('sem o código extra ligado: cartão do momento "Recomendado" com o botão Ligar', async () => {
    await renderizarTela(<TelaSeguranca />, { papel: 'membro' })
    expect(await screen.findByText('Ligue o código extra ao entrar')).toBeOnTheScreen()
    expect(screen.getByTestId('cartao-do-momento')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Ligar o código extra ao entrar' }))
    expect(router.push).toHaveBeenCalledWith('/ativar-2fa')
  })

  test('privacidade reúne as pessoas bloqueadas (UX v3), os documentos e excluir a conta', async () => {
    await renderizarTela(<TelaPrivacidade />, { papel: 'membro' })
    await fireEvent.press(await screen.findByRole('button', { name: /Pessoas bloqueadas/ }))
    expect(router.push).toHaveBeenCalledWith('/bloqueados')
    expect(screen.getByText('Política de Privacidade')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir minha conta' }))
    expect(router.push).toHaveBeenCalledWith('/excluir-conta')
  })

  test('bloqueados sem ninguém: vazio com o sol e uma ação', async () => {
    await renderizarTela(<TelaPessoasBloqueadas />, {
      papel: 'membro',
      rotas: {
        'GET /api/v1/c/11111111-1111-4111-8111-111111111111/bloqueios': () => ({
          status: 200,
          corpo: { bloqueios: [] },
        }),
      },
    })
    expect(await screen.findByText('Ninguém bloqueado')).toBeOnTheScreen()
    expect(screen.getByTestId('sol-corpo', { includeHiddenElements: true })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Ver pedidos de oração' }))
    expect(router.push).toHaveBeenCalledWith('/oracao')
  })
})

describe('Plataforma do Criador: estados vazios com o sol', () => {
  function euCriador() {
    const base = respostaEu('membro')
    return () => ({
      status: 200,
      corpo: { conta: { ...base.conta, criador: true, doisFatores: true }, comunidades: [] },
    })
  }

  test('nenhuma comunidade esperando verificação: tudo em dia, com a ação de criar', async () => {
    await renderizarTela(<TelaPlataforma />, {
      rotas: {
        'GET /api/v1/eu': euCriador(),
        'GET /api/v1/plataforma/comunidades': () => ({
          status: 200,
          corpo: { comunidades: [], proximoCursor: null },
        }),
      },
    })
    expect(await screen.findByText('Nenhuma comunidade esperando verificação')).toBeOnTheScreen()
    expect(screen.getByTestId('sol-corpo', { includeHiddenElements: true })).toBeOnTheScreen()
    // Dois "Criar comunidade": o "+" do cabeçalho e a ação do vazio.
    const criar = screen.getAllByRole('button', { name: 'Criar comunidade' })
    expect(criar.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Primeiros passos concluídos', () => {
  test('celebração discreta: o sol radiante e a frase, sem pontos nem confete', async () => {
    await render(<Celebracao />)
    expect(screen.getByText('Primeiros passos concluídos')).toBeOnTheScreen()
    expect(screen.getByText('Tudo pronto')).toBeOnTheScreen()
    expect(screen.getByTestId('cartao-do-momento')).toBeOnTheScreen()
    expect(screen.queryByText(/pontos|ranking|confete/i)).toBeNull()
  })
})
