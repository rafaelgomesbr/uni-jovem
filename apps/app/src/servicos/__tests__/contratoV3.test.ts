import { api } from '../api'
import { chamadasV3, pacoteMudou, type PacoteDoRepertorio } from '../contratoV3'

jest.mock('../api', () => ({ api: { get: jest.fn(), post: jest.fn() } }))

const get = api.get as jest.Mock
const post = api.post as jest.Mock

const COM = '11111111-1111-4111-8111-111111111111'
const EV = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  get.mockReset().mockResolvedValue({})
  post.mockReset().mockResolvedValue({})
})

describe('chamadas das rotas novas do v3', () => {
  test('o cartão do momento vem do Início', async () => {
    await chamadasV3.inicio(COM)
    expect(get).toHaveBeenCalledWith(`/api/v1/c/${COM}/inicio`)
  })

  test('igual ao último sábado: lista de onde copiar e a cópia (rascunho)', async () => {
    await chamadasV3.anterioresParaCopiar(COM)
    expect(get).toHaveBeenCalledWith(`/api/v1/c/${COM}/eventos/anteriores-para-copiar`)
    await chamadasV3.copiarEncontro(COM, EV, { incluirMusicas: true, data: '2026-11-28' })
    expect(post).toHaveBeenCalledWith(`/api/v1/c/${COM}/eventos/${EV}/copiar`, {
      incluirMusicas: true,
      data: '2026-11-28',
    })
    await chamadasV3.copiarEncontro(COM, EV)
    expect(post).toHaveBeenLastCalledWith(`/api/v1/c/${COM}/eventos/${EV}/copiar`, {})
  })

  test('convocar em lote, sugestões (função codificada) e lembrar', async () => {
    await chamadasV3.convocarEmLote(COM, EV, { funcao: 'Bateria', vinculoIds: ['a', 'b'] })
    expect(post).toHaveBeenCalledWith(`/api/v1/c/${COM}/eventos/${EV}/atribuicoes/lote`, {
      funcao: 'Bateria',
      vinculoIds: ['a', 'b'],
    })
    await chamadasV3.sugestoesDeConvocacao(COM, EV, 'Projeção & som')
    expect(get).toHaveBeenCalledWith(
      `/api/v1/c/${COM}/eventos/${EV}/sugestoes-de-convocacao?funcao=Proje%C3%A7%C3%A3o%20%26%20som`,
    )
    await chamadasV3.lembrarPendentes(COM, EV)
    expect(post).toHaveBeenLastCalledWith(`/api/v1/c/${COM}/eventos/${EV}/lembrar-pendentes`)
  })

  test('mural, não lidas do sino e a prévia pública do código (sem sessão)', async () => {
    await chamadasV3.mural(COM)
    expect(get).toHaveBeenCalledWith(`/api/v1/c/${COM}/mural`)
    await chamadasV3.naoLidasDoSino()
    expect(get).toHaveBeenLastCalledWith('/api/v1/eu/notificacoes/caixa/nao-lidas')
    await chamadasV3.previaDoCodigo('ABCD2345')
    expect(post).toHaveBeenCalledWith(
      '/api/auth/codigo/previa',
      { codigo: 'ABCD2345' },
      { autenticado: false },
    )
  })

  test('pacote do repertório: com a versão conhecida pede só a conferência', async () => {
    await chamadasV3.pacoteDoRepertorio(COM, EV)
    expect(get).toHaveBeenCalledWith(`/api/v1/c/${COM}/eventos/${EV}/repertorio/pacote`)
    await chamadasV3.pacoteDoRepertorio(COM, EV, 'abc123')
    expect(get).toHaveBeenLastCalledWith(
      `/api/v1/c/${COM}/eventos/${EV}/repertorio/pacote?versao=abc123`,
    )
  })

  test('pacoteMudou separa o pacote novo do "inalterado"', () => {
    expect(pacoteMudou({ versao: 'x', inalterado: true })).toBe(false)
    expect(pacoteMudou({ versao: 'x', itens: [] } as unknown as PacoteDoRepertorio)).toBe(true)
  })
})
