/**
 * D69 (seção 5.10): o encontro baixa sozinho quando faz sentido (publicado, a menos de 7 dias, de
 * quem organiza, conduz ou serve, e ainda sem cópia neste aparelho). Uma tentativa; o botão manual
 * continua no "Mais".
 */
import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react-native'

import { criarDeposito } from '@/funcionalidades/offline/deposito'
import { ProvedorOffline } from '@/funcionalidades/offline/ProvedorOffline'
import type { Rota } from '@/testes/dubles'
import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { limparAparelho, pacoteDeTeste } from '@/testes/offline'
import { BASE, COMUNIDADE, MEU_VINCULO, pedidosPara, renderizarTela } from '@/testes/telas'

import { DetalheDoEvento } from '../DetalheDoEvento'

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

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`
const EM_3_DIAS = new Date(Date.now() + 3 * 86_400_000).toISOString()
const EM_30_DIAS = new Date(Date.now() + 30 * 86_400_000).toISOString()

function rotas(evento: ReturnType<typeof eventoDeTeste>): Record<string, Rota> {
  return {
    [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: evento }),
    [`GET ${CAMINHO}/pacote-offline`]: () => ({
      status: 200,
      corpo: pacoteDeTeste({ evento: { ...pacoteDeTeste().evento, id: EVENTO_ID } }),
    }),
    [`GET ${CAMINHO}/inscricoes`]: () => ({
      status: 200,
      corpo: { contagem: { confirmadas: 0, espera: 0, presentes: 0 }, inscricoes: [] },
    }),
    [`GET ${BASE}/sync/mudancas`]: () => ({
      status: 200,
      corpo: { recomecar: false, mudancas: [], cursor: '1000:0', temMais: false },
    }),
    [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas: [] } }),
  }
}

async function abrir(papel: 'organizador' | 'membro', evento: ReturnType<typeof eventoDeTeste>) {
  const montagem = await renderizarTela(
    <ProvedorOffline deposito={criarDeposito()}>
      <DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />
    </ProvedorOffline>,
    { papel, rotas: rotas(evento) },
  )
  await screen.findByText('Quando e onde')
  return montagem
}

describe('baixar o encontro sozinho', () => {
  beforeEach(() => {
    limparAparelho()
    onlineManager.setOnline(true)
  })

  test('a organização abre um encontro publicado dos próximos dias: o pacote é baixado sem pedir', async () => {
    const { servidor } = await abrir('organizador', eventoDeTeste({ inicio: EM_3_DIAS }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'GET', `${CAMINHO}/pacote-offline`)).toHaveLength(1),
    )
  })

  test('quem serve no encontro também baixa; é a parte dela que vale, não o papel', async () => {
    const minhaParte = {
      id: 'atr-eu',
      etapaId: ETAPAS[1],
      vinculoId: MEU_VINCULO,
      funcao: 'violão',
      estado: 'confirmada' as const,
      nome: 'Ana Souza',
    }
    const { servidor } = await abrir(
      'membro',
      eventoDeTeste({ inicio: EM_3_DIAS, atribuicoes: [minhaParte] }),
    )
    await waitFor(() =>
      expect(pedidosPara(servidor, 'GET', `${CAMINHO}/pacote-offline`)).toHaveLength(1),
    )
  })

  test('o membro sem parte não baixa nada', async () => {
    const { servidor } = await abrir(
      'membro',
      eventoDeTeste({ inicio: EM_3_DIAS, atribuicoes: [] }),
    )
    // Dá tempo de o efeito (que não existe para ele) rodar: nenhuma chamada.
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(pedidosPara(servidor, 'GET', `${CAMINHO}/pacote-offline`)).toHaveLength(0)
  })

  test('encontro a mais de 7 dias: não baixa (nem espera o pedido)', async () => {
    const longe = await abrir('organizador', eventoDeTeste({ inicio: EM_30_DIAS }))
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(pedidosPara(longe.servidor, 'GET', `${CAMINHO}/pacote-offline`)).toHaveLength(0)
  })
})
