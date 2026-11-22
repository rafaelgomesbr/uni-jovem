import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import type { ResumoDosProximosEncontros } from '@/servicos/contratoDaExclusao'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast } from '@/ui/Toast'

import {
  consequenciaDaLimpeza,
  detalheDosEncontros,
  encontrosAfetados,
  quantosEncontros,
} from '../limparProximos'
import { TelaLimparProximos } from '../TelaLimparProximos'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(() => jest.fn()),
}))

const CAMINHO = `${BASE}/eventos/limpar-proximos`

const RESUMO: ResumoDosProximosEncontros = {
  total: 6,
  rascunhos: 2,
  publicados: 3,
  adiados: 0,
  cancelados: 1,
  encerrados: 0,
  pessoasAAvisar: 9,
  repeticoesAtivas: 0,
}

const rotaDoResumo = (resumo: ResumoDosProximosEncontros = RESUMO) => ({
  [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: resumo }),
})

async function abrir(
  rotas: Record<string, () => { status: number; corpo?: unknown }> = {},
  resumo?: ResumoDosProximosEncontros,
) {
  const r = await renderizarTela(
    <>
      <TelaLimparProximos />
      <HospedeiroDeToast />
    </>,
    { papel: 'organizador', rotas: { ...rotaDoResumo(resumo), ...rotas } },
  )
  await screen.findByText('6 encontros na agenda')
  return r
}

describe('as palavras da limpeza (funções puras)', () => {
  test('o detalhe diz só o que existe, no singular e no plural', () => {
    expect(detalheDosEncontros(RESUMO)).toBe('2 rascunhos, 3 publicados e 1 cancelado')
    expect(detalheDosEncontros({ ...RESUMO, rascunhos: 1, publicados: 0, cancelados: 0 })).toBe(
      '1 rascunho',
    )
    expect(detalheDosEncontros({ ...RESUMO, rascunhos: 0, publicados: 2, cancelados: 0 })).toBe(
      '2 publicados',
    )
    expect(quantosEncontros(1)).toBe('1 encontro')
    expect(quantosEncontros(0)).toBe('0 encontros')
  })

  test('"Apagar" mexe em tudo; "Cancelar e avisar" deixa os já cancelados como estão', () => {
    expect(encontrosAfetados(RESUMO, 'apagar')).toBe(6)
    expect(encontrosAfetados(RESUMO, 'cancelar_e_avisar')).toBe(5)
  })

  test('a consequência diz que não se desfaz, quantos somem e quantas pessoas seriam avisadas', () => {
    expect(consequenciaDaLimpeza(RESUMO, 'apagar')).toMatch(
      /^6 encontros somem de vez.*Ninguém é avisado\. Isto não se desfaz\.$/,
    )
    expect(consequenciaDaLimpeza(RESUMO, 'cancelar_e_avisar')).toBe(
      'Vai avisar até 9 pessoas. Os rascunhos são apagados; os publicados e adiados ficam na agenda como cancelados. Isto não se desfaz.',
    )
    expect(
      consequenciaDaLimpeza({ ...RESUMO, publicados: 0, pessoasAAvisar: 0 }, 'cancelar_e_avisar'),
    ).toBe('Não há ninguém para avisar. Os rascunhos são apagados. Isto não se desfaz.')
  })
})

describe('Limpar próximos encontros: os estados da tela', () => {
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => onlineManager.setOnline(true))

  test('carregando: esqueleto com nome, sem botão que apague', async () => {
    let liberar: () => void = () => undefined
    const espera = new Promise<void>((r) => {
      liberar = r
    })
    await renderizarTela(<TelaLimparProximos />, {
      papel: 'organizador',
      rotas: {
        [`GET ${CAMINHO}`]: async () => {
          await espera
          return { status: 200, corpo: RESUMO }
        },
      },
    })
    expect(
      await screen.findByLabelText('Contando os encontros que ainda não começaram'),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
    await act(async () => liberar())
    expect(await screen.findByText('6 encontros na agenda')).toBeOnTheScreen()
  })

  test('erro: mensagem em palavras e "Tentar de novo", que pede de novo', async () => {
    let chamadas = 0
    await renderizarTela(<TelaLimparProximos />, {
      papel: 'organizador',
      rotas: {
        [`GET ${CAMINHO}`]: () => {
          chamadas += 1
          return chamadas === 1
            ? { status: 500, corpo: { erro: 'erro_interno', mensagem: 'Algo deu errado aqui.' } }
            : { status: 200, corpo: RESUMO }
        },
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: /Tentar de novo/ }))
    expect(await screen.findByText('6 encontros na agenda')).toBeOnTheScreen()
  })

  test('vazio: explica e dá a saída, sem oferecer limpar nada', async () => {
    await renderizarTela(<TelaLimparProximos />, {
      papel: 'organizador',
      rotas: rotaDoResumo({ ...RESUMO, total: 0, rascunhos: 0, publicados: 0, cancelados: 0 }),
    })
    expect(await screen.findByText('Não há encontros para limpar')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para a Comunidade' }))
    expect(router.back).toHaveBeenCalled()
  })

  test('quem é membro não vê a limpeza: a tela diz quem faz e nem pede a contagem', async () => {
    const { servidor } = await renderizarTela(<TelaLimparProximos />, {
      papel: 'membro',
      rotas: rotaDoResumo(),
    })
    expect(await screen.findByText('Só a organização limpa a agenda')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', CAMINHO)).toHaveLength(0)
  })
})

describe('Limpar próximos encontros: o fluxo em dois passos', () => {
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => onlineManager.setOnline(true))

  test('o primeiro passo mostra quantos encontros e quantas pessoas, com "Apagar sem avisar" já escolhido', async () => {
    await abrir()
    expect(screen.getByText('2 rascunhos, 3 publicados e 1 cancelado.')).toBeOnTheScreen()
    expect(
      screen.getByText('Se você cancelar e avisar, até 9 pessoas recebem o aviso.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: /Apagar sem avisar ninguém/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Cancelar e avisar as pessoas/ })).not.toBeChecked()
    // Diz que não se desfaz antes de qualquer toque que apague.
    expect(screen.getByText('Isto não se desfaz')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /para sempre/ })).toBeNull()
  })

  test('apagar sem avisar: Continuar, o botão vermelho diz o que apaga e só ele envia', async () => {
    const { servidor } = await abrir({
      [`POST ${CAMINHO}`]: () => ({
        status: 200,
        corpo: { ok: true, modo: 'apagar', apagados: 6, cancelados: 0, pessoasAvisadas: 0 },
      }),
    })
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    // Segundo passo: nada foi enviado ainda.
    expect(await screen.findByText('Confirme a limpeza')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', CAMINHO)).toHaveLength(0)
    expect(screen.getByText('Apagar 6 encontros, sem avisar ninguém')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar 6 encontros para sempre' }))
    expect(await screen.findByText('6 encontros apagados')).toBeOnTheScreen()
    expect(screen.getByText('Ninguém foi avisado.')).toBeOnTheScreen()
    const pedidos = pedidosPara(servidor, 'POST', CAMINHO)
    expect(pedidos).toHaveLength(1)
    // Corpo: o modo, o número que a pessoa viu e a confirmação; sem motivo, ninguém é avisado.
    expect(pedidos[0]!.corpo).toEqual({ modo: 'apagar', totalEsperado: 6, confirmo: true })
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para a Comunidade' }))
    expect(router.back).toHaveBeenCalled()
  })

  test('Voltar do segundo passo não apaga nada e mantém a escolha', async () => {
    const { servidor } = await abrir()
    await fireEvent.press(screen.getByRole('radio', { name: /Cancelar e avisar as pessoas/ }))
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByText('Confirme a limpeza')
    await fireEvent.press(screen.getByRole('button', { name: 'Mudar a escolha' }))
    expect(await screen.findByRole('radio', { name: /Cancelar e avisar as pessoas/ })).toBeChecked()
    expect(pedidosPara(servidor, 'POST', CAMINHO)).toHaveLength(0)
  })

  test('cancelar e avisar: pede o motivo, mostra quantas pessoas e envia o motivo', async () => {
    const { servidor } = await abrir({
      [`POST ${CAMINHO}`]: () => ({
        status: 200,
        corpo: {
          ok: true,
          modo: 'cancelar_e_avisar',
          apagados: 2,
          cancelados: 3,
          pessoasAvisadas: 9,
        },
      }),
    })
    await fireEvent.press(screen.getByRole('radio', { name: /Cancelar e avisar as pessoas/ }))
    // O motivo é obrigatório porque vai para quem recebe o aviso.
    await fireEvent.changeText(screen.getByLabelText('Motivo do aviso'), '  ')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(
      await screen.findByText('Escreva o motivo: ele vai para quem recebe o aviso.'),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Confirme a limpeza')).toBeNull()
    await fireEvent.changeText(screen.getByLabelText('Motivo do aviso'), 'Mudamos o espaço')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByText('Confirme a limpeza')
    expect(screen.getByText('Motivo do aviso: Mudamos o espaço')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar e avisar até 9 pessoas' }))
    expect(await screen.findByText('Agenda limpa')).toBeOnTheScreen()
    expect(
      screen.getByText(
        '2 encontros apagados (rascunhos) e 3 encontros cancelados. 9 pessoas foram avisadas.',
      ),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', CAMINHO)[0]!.corpo).toEqual({
      modo: 'cancelar_e_avisar',
      totalEsperado: 6,
      motivo: 'Mudamos o espaço',
      confirmo: true,
    })
  })

  test('se a agenda mudou no meio do caminho (409), volta ao primeiro passo com os números novos', async () => {
    let resumo = RESUMO
    await abrir({
      [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: resumo }),
      [`POST ${CAMINHO}`]: () => {
        resumo = { ...RESUMO, total: 7, publicados: 4 }
        return {
          status: 409,
          corpo: { erro: 'agenda_mudou', mensagem: 'A agenda mudou enquanto você decidia.' },
        }
      },
    })
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Apagar 6 encontros para sempre' }),
    )
    expect(await screen.findByText('A agenda mudou enquanto você decidia')).toBeOnTheScreen()
    expect(await screen.findByText('7 encontros na agenda')).toBeOnTheScreen()
    // Nada foi apagado: o botão de apagar só volta no segundo passo.
    expect(screen.queryByRole('button', { name: /para sempre/ })).toBeNull()
  })

  test('erro do servidor: em palavras, a pessoa fica no segundo passo e pode tentar de novo', async () => {
    let tentativas = 0
    await abrir({
      [`POST ${CAMINHO}`]: () => {
        tentativas += 1
        return tentativas === 1
          ? { status: 500, corpo: { erro: 'erro_interno', mensagem: 'Algo deu errado aqui.' } }
          : {
              status: 200,
              corpo: { ok: true, modo: 'apagar', apagados: 6, cancelados: 0, pessoasAvisadas: 0 },
            }
      },
    })
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Apagar 6 encontros para sempre' }),
    )
    expect(await screen.findByText('A agenda não foi limpa')).toBeOnTheScreen()
    expect(screen.getByText('Confirme a limpeza')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar 6 encontros para sempre' }))
    expect(await screen.findByText('6 encontros apagados')).toBeOnTheScreen()
  })

  test('sem internet o botão que apaga fica desabilitado e diz por quê', async () => {
    await abrir()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByText('Confirme a limpeza')
    await act(async () => onlineManager.setOnline(false))
    const botao = await screen.findByRole('button', { name: 'Apagar 6 encontros para sempre' })
    expect(botao).toBeDisabled()
    expect(screen.getByText('Precisa de internet para limpar a agenda.')).toBeOnTheScreen()
  })

  test('avisa quando há encontros que se repetem (eles voltam a ser criados depois)', async () => {
    await abrir({}, { ...RESUMO, repeticoesAtivas: 2 })
    expect(screen.getByText('Há encontros que se repetem')).toBeOnTheScreen()
    await waitFor(() => expect(screen.getByText(/2 repetições continuam ativas/)).toBeOnTheScreen())
  })
})
