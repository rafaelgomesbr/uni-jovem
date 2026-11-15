import { onlineManager } from '@tanstack/react-query'
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'

import { useSessao, type Sessao } from '@/estado/sessao'
import { DetalheDoEvento } from '@/funcionalidades/eventos/DetalheDoEvento'
import { TelaCheckin } from '@/funcionalidades/inscricoes/TelaCheckin'
import { CartaoOfflineDoEvento } from '@/funcionalidades/offline/CartaoOfflineDoEvento'
import { criarDeposito } from '@/funcionalidades/offline/deposito'
import { dispensarDescarte, lerDescarte } from '@/funcionalidades/offline/descartadas'
import { registrarAcao } from '@/funcionalidades/offline/fila'
import { diaEMesNoAparelho } from '@/funcionalidades/offline/formatos'
import { sinalDaSincronizacao } from '@/funcionalidades/offline/IndicadorDeSincronizacao'
import {
  ProvedorOffline,
  useOffline,
  type Offline,
} from '@/funcionalidades/offline/ProvedorOffline'
import { guardarPacote } from '@/funcionalidades/offline/sincronizador'
import { TelaPendencias } from '@/funcionalidades/offline/TelaPendencias'
import type { DepositoLocal } from '@/funcionalidades/offline/tipos'
import type { Rota } from '@/testes/dubles'
import { limparAparelho, pacoteDeTeste, sqlite } from '@/testes/offline'
import { EVENTO_ID } from '@/testes/fixturas'
import {
  BASE,
  COMUNIDADE,
  MEU_VINCULO,
  pedidosPara,
  renderizarTela,
  respostaEu,
} from '@/testes/telas'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const CONTA = 'conta-eu'
const COMUNIDADE_B = '11111111-1111-4111-8111-999999999999'
const BASE_B = `/api/v1/c/${COMUNIDADE_B}`
const EVENTO_B = '33333333-3333-4333-8333-0000000000bb'

interface OperacaoNoCorpo {
  chave: string
  tipo: string
  vinculoId: string
  dados: Record<string, unknown>
}

/** O servidor de sincronização da comunidade: aceita tudo e guarda o que chegou. */
function rotasDeSincronizacao(base: string, eventoId = EVENTO_ID, vinculoId = MEU_VINCULO) {
  const recebidas: OperacaoNoCorpo[] = []
  const rotas: Record<string, Rota> = {
    [`GET ${base}/sync/mudancas`]: () => ({
      status: 200,
      corpo: { recomecar: false, mudancas: [], cursor: '1000:0', temMais: false },
    }),
    [`POST ${base}/sync/operacoes`]: (p) => {
      const { operacoes } = p.corpo as { operacoes: OperacaoNoCorpo[] }
      recebidas.push(...operacoes)
      return {
        status: 200,
        corpo: {
          resultados: operacoes.map((o) => ({ chave: o.chave, status: 'aceita' })),
          servidorEm: new Date().toISOString(),
        },
      }
    },
    [`GET ${base}/eventos/${eventoId}/pacote-offline`]: () => ({
      status: 200,
      corpo: pacoteDeTeste({
        vinculoId,
        evento: { ...pacoteDeTeste().evento, id: eventoId },
      }),
    }),
  }
  return { rotas, recebidas }
}

async function particaoPreparada(deposito: DepositoLocal) {
  const p = await deposito.criar({
    contaId: CONTA,
    comunidadeId: COMUNIDADE,
    vinculoId: MEU_VINCULO,
    validadeDias: 7,
  })
  await guardarPacote(p, pacoteDeTeste())
  return p
}

let sonda: { offline: Offline; sessao: Sessao } | null = null
function Sonda() {
  const offline = useOffline()
  const sessao = useSessao()
  // Expõe o estado ao teste depois de cada render (fora da renderização).
  useEffect(() => {
    sonda = { offline, sessao }
  })
  return null
}

beforeEach(() => {
  limparAparelho()
  dispensarDescarte()
  sonda = null
  onlineManager.setOnline(true)
  jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID })
})

afterAll(() => onlineManager.setOnline(true))

describe('indicadores', () => {
  const base = {
    online: true,
    fase: 'ocioso' as const,
    pendentes: 0,
    rejeitadas: 0,
    conflitos: 0,
    ultimaSincronizacao: null,
    temParticao: false,
  }

  test('dizem o estado em texto, por ordem de urgência', () => {
    expect(sinalDaSincronizacao(base)).toBeNull()
    const semConexao = sinalDaSincronizacao({ ...base, online: false, pendentes: 3 })
    expect(semConexao?.texto).toBe('Sem conexão')
    // O detalhe que não cabe nos 22 caracteres vai para o leitor de tela.
    expect(semConexao?.falado).toBe('Sem conexão. 3 alterações pendentes')
    expect(sinalDaSincronizacao({ ...base, fase: 'sincronizando' })?.texto).toBe('Sincronizando')
    expect(sinalDaSincronizacao({ ...base, conflitos: 1, fase: 'falha' })).toEqual(
      expect.objectContaining({ texto: '1 conflito', falado: '1 conflito a resolver' }),
    )
    const falha = sinalDaSincronizacao({ ...base, fase: 'falha' })
    expect(falha).toEqual(
      expect.objectContaining({ texto: 'Falha. Tentar de novo', tentarDeNovo: true }),
    )
    expect(sinalDaSincronizacao({ ...base, pendentes: 1 })?.texto).toBe('1 pendente')
    expect(sinalDaSincronizacao({ ...base, pendentes: 1 })?.falado).toBe('1 alteração pendente')
    expect(
      sinalDaSincronizacao({
        ...base,
        temParticao: true,
        fase: 'concluido',
        ultimaSincronizacao: '2026-11-14T17:32:00.000Z',
      })?.texto,
    ).toMatch(/^Sincronizado \d{2}:\d{2}$/)
  })
})

describe('preparar evento', () => {
  test('mostra "Pronto para usar sem internet · atualizado às HH:MM · válido até DD/MM"', async () => {
    const deposito = criarDeposito()
    const { rotas } = rotasDeSincronizacao(BASE)
    await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <CartaoOfflineDoEvento eventoId={EVENTO_ID} titulo="Sábado com a juventude" />
      </ProvedorOffline>,
      { rotas },
    )
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Preparar para usar sem internet' }))

    const validoAte = (await deposito.listar())[0]?.validoAte ?? ''
    expect(
      await screen.findByText(
        new RegExp(
          `^Pronto para usar sem internet · atualizado às \\d{2}:\\d{2} · válido até ${diaEMesNoAparelho(validoAte)}$`,
        ),
      ),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Atualizar agora' })).toBeOnTheScreen()
  })
})

describe('sem conexão', () => {
  test('o detalhe usa a cópia local; concluir tarefa entra na fila e vai ao voltar a rede', async () => {
    const deposito = criarDeposito()
    await particaoPreparada(deposito)
    const { rotas, recebidas } = rotasDeSincronizacao(BASE)
    onlineManager.setOnline(false)
    await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />
      </ProvedorOffline>,
      { rotas },
    )
    expect(await screen.findByText('Sem conexão: cópia deste aparelho')).toBeOnTheScreen()
    // O que exige conexão fica desabilitado, com a explicação.
    expect(screen.getByRole('button', { name: 'Editar a programação' })).toBeDisabled()

    await userEvent.setup().press(screen.getByRole('checkbox', { name: 'Testar o som' }))
    await waitFor(async () => {
      const p = await deposito.abrir(CONTA, COMUNIDADE)
      expect((await p!.operacoes()).map((o) => o.tipo)).toEqual(['tarefa.concluir'])
    })
    expect(
      await screen.findByRole('checkbox', { name: 'Testar o som', checked: true }),
    ).toBeTruthy()

    await act(async () => onlineManager.setOnline(true))
    await waitFor(() => expect(recebidas.map((o) => o.dados['tarefaId'])).toEqual(['tar-1']))
    await waitFor(async () => {
      const p = await deposito.abrir(CONTA, COMUNIDADE)
      expect(await p!.operacoes()).toHaveLength(0)
    })
  })

  test('check-in: a lista vem do aparelho e a presença entra na fila uma vez só', async () => {
    const deposito = criarDeposito()
    await particaoPreparada(deposito)
    const { rotas, recebidas } = rotasDeSincronizacao(BASE)
    onlineManager.setOnline(false)
    const { servidor } = await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <TelaCheckin />
      </ProvedorOffline>,
      { rotas },
    )
    expect(await screen.findByText('Sem conexão: lista deste aparelho')).toBeOnTheScreen()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Marcar presença: Davi Rocha' }))
    expect(await screen.findByText(/Presença de Davi Rocha anotada neste aparelho/)).toBeTruthy()

    const p = await deposito.abrir(CONTA, COMUNIDADE)
    const fila = await p!.operacoes()
    expect(fila).toHaveLength(1)
    expect(fila[0]).toEqual(
      expect.objectContaining({
        tipo: 'presenca.registrar',
        comunidadeId: COMUNIDADE,
        vinculoId: MEU_VINCULO,
        dados: expect.objectContaining({ eventoId: EVENTO_ID, inscricaoId: 'insc-1' }),
      }),
    )
    // Nada foi para a rede enquanto estava sem conexão.
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/${EVENTO_ID}/presencas`)).toHaveLength(0)

    await act(async () => onlineManager.setOnline(true))
    await waitFor(() => expect(recebidas).toHaveLength(1))
    expect(recebidas[0]?.chave).toBe(fila[0]?.chave)
  })
})

describe('Pendências', () => {
  test('recusada: descartar, copiar e refazer; conflito: as duas versões e a escolha', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar({
      contaId: CONTA,
      comunidadeId: COMUNIDADE,
      vinculoId: MEU_VINCULO,
      validadeDias: 7,
    })
    await registrarAcao(p, {
      tipo: 'inscricao.intencao',
      dados: { eventoId: EVENTO_ID },
      eventoId: EVENTO_ID,
      descricao: 'Inscrição em "Sábado com a juventude"',
    })
    await registrarAcao(p, {
      tipo: 'tarefa.concluir',
      dados: { tarefaId: 'tar-1', concluida: false },
      eventoId: EVENTO_ID,
      descricao: 'Reabrir a tarefa "Testar o som"',
    })
    const [recusada, conflito] = await p.operacoes()
    await p.atualizarOperacao(recusada!.chave, {
      estado: 'rejeitada',
      motivo: 'lotado',
      mensagem: 'As vagas acabaram antes de a sua inscrição chegar.',
      tentativas: 1,
    })
    await p.atualizarOperacao(conflito!.chave, {
      estado: 'conflito',
      motivo: 'concluido_depois',
      mensagem: 'Alguém concluiu este item depois da sua alteração.',
      estadoDoServidor: { concluida_em: '2026-11-14T18:00:00.000Z', versao: 4 },
      tentativas: 1,
    })
    const { rotas, recebidas } = rotasDeSincronizacao(BASE)
    await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <TelaPendencias />
      </ProvedorOffline>,
      { rotas },
    )

    expect(await screen.findByText('Recusadas pelo servidor (1)')).toBeOnTheScreen()
    expect(
      screen.getByText('Motivo: As vagas acabaram antes de a sua inscrição chegar.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Conflitos a resolver (1)')).toBeOnTheScreen()
    expect(screen.getByText('Sua versão (neste aparelho)')).toBeOnTheScreen()
    expect(screen.getByText('Versão atual do servidor')).toBeOnTheScreen()
    expect(screen.getByText('Reabrir a tarefa')).toBeOnTheScreen()
    expect(screen.getByText(/^Concluído em .* por outra pessoa$/)).toBeOnTheScreen()

    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: `Copiar: ${recusada!.descricao}` }))
    expect(await screen.findByText('Copiado.')).toBeOnTheScreen()

    // Conflito: fica com a do servidor (a alteração local sai da fila).
    await usuario.press(
      screen.getByRole('button', {
        name: `Ficar com a do servidor: ${conflito!.descricao}`,
      }),
    )
    await waitFor(() => expect(screen.queryByText('Conflitos a resolver (1)')).toBeNull())

    // Recusada: refazer manda de novo com chave NOVA.
    await usuario.press(screen.getByRole('button', { name: `Refazer: ${recusada!.descricao}` }))
    await waitFor(() => expect(recebidas).toHaveLength(1))
    expect(recebidas[0]?.tipo).toBe('inscricao.intencao')
    expect(recebidas[0]?.chave).not.toBe(recusada!.chave)
    await waitFor(async () => expect(await p.operacoes()).toHaveLength(0))
  })
})

describe('troca de comunidade e saída', () => {
  const euComDuas = () => {
    const eu = respostaEu('organizador')
    return {
      ...eu,
      comunidades: [
        ...eu.comunidades,
        { ...eu.comunidades[0]!, id: COMUNIDADE_B, nome: 'Jovens Bairro' },
      ],
    }
  }

  test('a operação feita em A vai só para A, mesmo depois de trocar para B', async () => {
    const deposito = criarDeposito()
    const a = rotasDeSincronizacao(BASE)
    const b = rotasDeSincronizacao(BASE_B, EVENTO_B, 'vinculo-em-B')
    await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <Sonda />
      </ProvedorOffline>,
      {
        rotas: {
          ...a.rotas,
          ...b.rotas,
          'GET /api/v1/eu': () => ({ status: 200, corpo: euComDuas() }),
          [`GET ${BASE_B}`]: () => ({
            status: 200,
            corpo: { id: COMUNIDADE_B, validadeOfflineDias: 7, fuso: 'America/Sao_Paulo' },
          }),
        },
      },
    )
    await waitFor(() => expect(sonda?.sessao.estado).toBe('autenticado'))

    await act(() => sonda!.sessao.trocarComunidade(COMUNIDADE))
    await act(() => sonda!.offline.prepararEvento(EVENTO_ID))
    await act(async () => onlineManager.setOnline(false))
    await act(async () => {
      await sonda!.offline.registrar({
        tipo: 'tarefa.concluir',
        dados: { tarefaId: 'tarefa-de-A', concluida: true },
        eventoId: EVENTO_ID,
        descricao: 'Concluir a tarefa de A',
      })
    })
    await waitFor(() => expect(sonda!.offline.pendentes).toBe(1))

    // Troca para B (ainda sem rede): a fila de A não aparece nem vai para B.
    await act(async () => onlineManager.setOnline(true))
    await act(() => sonda!.sessao.trocarComunidade(COMUNIDADE_B))
    await waitFor(() => expect(sonda!.offline.temParticao).toBe(false))
    expect(sonda!.offline.pendentes).toBe(0)
    await act(() => sonda!.offline.prepararEvento(EVENTO_B))
    await act(async () => {
      await sonda!.offline.registrar({
        tipo: 'tarefa.concluir',
        dados: { tarefaId: 'tarefa-de-B', concluida: true },
        eventoId: EVENTO_B,
        descricao: 'Concluir a tarefa de B',
      })
    })
    await act(() => sonda!.offline.sincronizarAgora())

    await waitFor(() => expect(a.recebidas).toHaveLength(1))
    await waitFor(() => expect(b.recebidas).toHaveLength(1))
    expect(a.recebidas.map((o) => o.dados['tarefaId'])).toEqual(['tarefa-de-A'])
    expect(a.recebidas[0]?.vinculoId).toBe(MEU_VINCULO)
    expect(b.recebidas.map((o) => o.dados['tarefaId'])).toEqual(['tarefa-de-B'])
    expect(b.recebidas[0]?.vinculoId).toBe('vinculo-em-B')
  })

  test('sair da conta apaga a partição; o que não foi enviado aparece para copiar', async () => {
    // A limpeza ao sair é a do próprio app (registrada ao carregar o ProvedorOffline);
    // ela usa o depósito padrão, que enxerga o mesmo "disco" deste aqui.
    const deposito = criarDeposito()
    const p = await particaoPreparada(deposito)
    await registrarAcao(p, {
      tipo: 'checklist.marcar',
      dados: { itemId: 'chk-1', marcado: true },
      eventoId: EVENTO_ID,
      descricao: 'Marcar "Ligar o projetor" no checklist',
    })
    const { rotas } = rotasDeSincronizacao(BASE)
    onlineManager.setOnline(false)
    await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <Sonda />
      </ProvedorOffline>,
      { rotas },
    )
    await waitFor(() => expect(sonda?.offline.pendentes).toBe(1))
    expect((await sonda!.offline.naoEnviadas()).map((o) => o.descricao)).toEqual([
      'Marcar "Ligar o projetor" no checklist',
    ])

    await act(() => sonda!.sessao.sair())

    expect(await deposito.listar()).toEqual([])
    expect(sqlite.__arquivos.size).toBe(0)
    expect(lerDescarte()?.itens.map((i) => i.descricao)).toEqual([
      'Marcar "Ligar o projetor" no checklist',
    ])
  })
})
