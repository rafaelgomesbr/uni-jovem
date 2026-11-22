import type { ClienteDaApi } from '@/servicos/api'
import type { PacoteDoRepertorio, PacoteInalterado } from '@/servicos/contratoV3'
import { ErroDaApi, SemConexao } from '@/servicos/erros'
import { criarDeposito } from '@/funcionalidades/offline/deposito'
import {
  atualizarRepertorios,
  baixarRepertorio,
  caminhoDoRepertorio,
  encontroEstaPerto,
  GUARDAR_APOS_O_INICIO_MS,
} from '@/funcionalidades/offline/repertorioOffline'
import { sincronizarParticao } from '@/funcionalidades/offline/sincronizador'
import { EVENTO_ID } from '@/testes/fixturas'
import { cofre, DIA_MS, limparAparelho, servidorDeSincronizacao, sqlite } from '@/testes/offline'
import { COMUNIDADE } from '@/testes/telas'
import { CIFRA_DE_TESTE, pacoteDoRepertorioDeTeste } from '@/testes/repertorio'

const CONTA = 'conta-eu'
const CAMINHO = caminhoDoRepertorio(COMUNIDADE, EVENTO_ID)

type Resposta = PacoteDoRepertorio | PacoteInalterado

/** Servidor do pacote do repertório: guarda a versão atual e responde "inalterado" se for a mesma. */
function servidorDoRepertorio(inicial: PacoteDoRepertorio) {
  const estado: { atual: PacoteDoRepertorio; erro: unknown } = { atual: inicial, erro: null }
  const pedidos: string[] = []
  const get = jest.fn(async (caminho: string): Promise<Resposta> => {
    pedidos.push(caminho)
    if (estado.erro) throw estado.erro
    const versao = new URL(`http://x${caminho}`).searchParams.get('versao')
    if (versao === estado.atual.versao) return { versao, inalterado: true }
    return estado.atual
  })
  return { cliente: { get } as unknown as Pick<ClienteDaApi, 'get'>, estado, pedidos, get }
}

async function particaoVazia(deposito = criarDeposito(), agora = new Date()) {
  return deposito.criar(
    { contaId: CONTA, comunidadeId: COMUNIDADE, vinculoId: null, validadeDias: 7 },
    agora,
  )
}

beforeEach(() => limparAparelho())

describe('baixar o repertório para tocar sem internet', () => {
  test('primeira vez: guarda no banco cifrado, com a cifra, e a partição nasce sem vínculo', async () => {
    const deposito = criarDeposito()
    const p = await particaoVazia(deposito)
    const servidor = servidorDoRepertorio(pacoteDoRepertorioDeTeste())

    expect(await baixarRepertorio(p, servidor.cliente, EVENTO_ID)).toBe('baixado')

    expect(servidor.pedidos).toEqual([CAMINHO])
    const guardado = await p.lerRepertorio(EVENTO_ID)
    expect(guardado?.pacote.versao).toBe('versao-1')
    expect(guardado?.pacote.itens[0]?.cifra).toBe(CIFRA_DE_TESTE)
    expect((await p.meta()).vinculoId).toBeNull()
    // Cada partição tem a sua chave no cofre: o conteúdo só abre com ela.
    for (const arquivo of sqlite.__arquivos.values()) expect(arquivo.chave).toMatch(/^"x'/)
    expect([...cofre.keys()].some((k) => k.startsWith('uj.offline.chave.'))).toBe(true)
    // Nada da cifra vai parar no cofre de chaves (só a chave da partição e o índice).
    expect(JSON.stringify([...cofre.values()])).not.toContain('rocha')
  })

  test('só baixa a cifra de novo se mudou: manda a versão que tem e recebe "inalterado"', async () => {
    const p = await particaoVazia()
    const servidor = servidorDoRepertorio(pacoteDoRepertorioDeTeste())
    await baixarRepertorio(p, servidor.cliente, EVENTO_ID)

    const depois = new Date(Date.now() + 2 * DIA_MS)
    expect(await baixarRepertorio(p, servidor.cliente, EVENTO_ID, () => depois)).toBe('em_dia')

    // A segunda chamada leva a versão conhecida (`?versao=`), e o texto da cifra não trafega de novo.
    expect(servidor.pedidos[1]).toBe(`${CAMINHO}?versao=versao-1`)
    const guardado = await p.lerRepertorio(EVENTO_ID)
    expect(guardado?.pacote.itens).toHaveLength(2)
    // Cada contato com o servidor renova a validade (D23): 7 dias a partir de agora.
    expect(Date.parse(guardado!.validoAte)).toBe(depois.getTime() + 7 * DIA_MS)
    expect(Date.parse((await p.meta()).validoAte)).toBeGreaterThanOrEqual(
      depois.getTime() + 7 * DIA_MS,
    )
  })

  test('mudou o tom do dia ou a cifra: a versão nova substitui a cópia', async () => {
    const p = await particaoVazia()
    const servidor = servidorDoRepertorio(pacoteDoRepertorioDeTeste())
    await baixarRepertorio(p, servidor.cliente, EVENTO_ID)

    const itens = pacoteDoRepertorioDeTeste().itens.map((i, n) =>
      n === 0 ? { ...i, tomDoDia: 'B' } : i,
    )
    servidor.estado.atual = pacoteDoRepertorioDeTeste({ versao: 'versao-2', itens })

    expect(await baixarRepertorio(p, servidor.cliente, EVENTO_ID)).toBe('atualizado')
    const guardado = await p.lerRepertorio(EVENTO_ID)
    expect(guardado?.pacote.versao).toBe('versao-2')
    expect(guardado?.pacote.itens[0]?.tomDoDia).toBe('B')
  })

  test('403 (fora do louvor) sobe para quem chamou e nada fica guardado', async () => {
    const p = await particaoVazia()
    const servidor = servidorDoRepertorio(pacoteDoRepertorioDeTeste())
    servidor.estado.erro = new ErroDaApi(403, 'fora_do_louvor', 'Você não toca neste encontro.')

    await expect(baixarRepertorio(p, servidor.cliente, EVENTO_ID)).rejects.toMatchObject({
      status: 403,
    })
    expect(await p.lerRepertorio(EVENTO_ID)).toBeNull()
  })

  test('resumo sem a cifra: o que a tela precisa para dizer "pronto" sem carregar o texto', async () => {
    const p = await particaoVazia()
    await baixarRepertorio(p, servidorDoRepertorio(pacoteDoRepertorioDeTeste()).cliente, EVENTO_ID)
    const resumo = await p.resumoDosRepertorios()
    expect(resumo).toEqual([
      expect.objectContaining({ eventoId: EVENTO_ID, versao: 'versao-1', musicas: 2 }),
    ])
    expect(JSON.stringify(resumo)).not.toContain('rocha')
  })

  test('letra e cifra nunca vão para log em nenhuma etapa', async () => {
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    )
    try {
      const p = await particaoVazia()
      const servidor = servidorDoRepertorio(pacoteDoRepertorioDeTeste())
      await baixarRepertorio(p, servidor.cliente, EVENTO_ID)
      await baixarRepertorio(p, servidor.cliente, EVENTO_ID)
      servidor.estado.erro = new SemConexao()
      await atualizarRepertorios(p, servidor.cliente)
      const tudo = espioes
        .flatMap((e) => e.mock.calls)
        .flat()
        .map(String)
        .join('\n')
      expect(tudo).not.toContain('rocha')
      expect(tudo).not.toContain('{key: G}')
    } finally {
      espioes.forEach((e) => e.mockRestore())
    }
  })

  test('sair da comunidade ou da conta apaga a partição e a cópia vai junto', async () => {
    const deposito = criarDeposito()
    const p = await particaoVazia(deposito)
    await baixarRepertorio(p, servidorDoRepertorio(pacoteDoRepertorioDeTeste()).cliente, EVENTO_ID)
    expect(sqlite.__despejar()).toContain('rocha')

    await deposito.apagar(CONTA, COMUNIDADE)

    expect(sqlite.__despejar()).not.toContain('rocha')
    expect(await deposito.abrir(CONTA, COMUNIDADE)).toBeNull()
  })

  test('a cópia vence com a partição: depois da validade, nunca é lida', async () => {
    const deposito = criarDeposito()
    const t0 = new Date('2026-11-14T12:00:00.000Z')
    const p = await particaoVazia(deposito, t0)
    const validoAte = new Date(t0.getTime() + 7 * DIA_MS).toISOString()
    await baixarRepertorio(
      p,
      servidorDoRepertorio(pacoteDoRepertorioDeTeste({ validoAte })).cliente,
      EVENTO_ID,
      () => t0,
    )
    expect(await deposito.abrir(CONTA, COMUNIDADE, new Date(t0.getTime() + 8 * DIA_MS))).toBeNull()
  })
})

describe('rodada de sincronização', () => {
  test('a rodada confere a versão de cada cópia e baixa só o que mudou', async () => {
    const p = await particaoVazia()
    const servidor = servidorDoRepertorio(pacoteDoRepertorioDeTeste())
    await baixarRepertorio(p, servidor.cliente, EVENTO_ID)

    expect(await atualizarRepertorios(p, servidor.cliente)).toBe(0)
    servidor.estado.atual = pacoteDoRepertorioDeTeste({ versao: 'versao-2' })
    expect(await atualizarRepertorios(p, servidor.cliente)).toBe(1)
    expect((await p.lerRepertorio(EVENTO_ID))?.pacote.versao).toBe('versao-2')
  })

  test('perdeu o acesso (403 ou 404): a cópia sai do aparelho', async () => {
    for (const status of [403, 404]) {
      limparAparelho()
      const p = await particaoVazia()
      const servidor = servidorDoRepertorio(pacoteDoRepertorioDeTeste())
      await baixarRepertorio(p, servidor.cliente, EVENTO_ID)
      servidor.estado.erro = new ErroDaApi(status, 'x', 'sem acesso')
      await atualizarRepertorios(p, servidor.cliente)
      expect(await p.lerRepertorio(EVENTO_ID)).toBeNull()
    }
  })

  test('sem conexão a cópia antiga fica e continua abrindo', async () => {
    const p = await particaoVazia()
    const servidor = servidorDoRepertorio(pacoteDoRepertorioDeTeste())
    await baixarRepertorio(p, servidor.cliente, EVENTO_ID)
    servidor.estado.erro = new SemConexao()
    await atualizarRepertorios(p, servidor.cliente)
    expect(await p.lerRepertorio(EVENTO_ID)).not.toBeNull()
  })

  test('encontro que já passou há mais de 36 h sai do aparelho', async () => {
    const p = await particaoVazia()
    const servidor = servidorDoRepertorio(pacoteDoRepertorioDeTeste())
    await baixarRepertorio(p, servidor.cliente, EVENTO_ID)
    const inicio = Date.parse((await p.lerRepertorio(EVENTO_ID))!.pacote.evento.inicio)

    await atualizarRepertorios(p, servidor.cliente, () => new Date(inicio + 30 * 3600_000))
    expect(await p.lerRepertorio(EVENTO_ID)).not.toBeNull()

    await atualizarRepertorios(
      p,
      servidor.cliente,
      () => new Date(inicio + GUARDAR_APOS_O_INICIO_MS + 60_000),
    )
    expect(await p.lerRepertorio(EVENTO_ID)).toBeNull()
  })

  test('a sincronização da partição inclui o repertório e informa quantos mudaram', async () => {
    const p = await particaoVazia()
    const repertorio = servidorDoRepertorio(pacoteDoRepertorioDeTeste())
    await baixarRepertorio(p, repertorio.cliente, EVENTO_ID)
    repertorio.estado.atual = pacoteDoRepertorioDeTeste({ versao: 'versao-2' })

    const comunidade = servidorDeSincronizacao()
    const cliente = {
      post: comunidade.cliente.post,
      get: (caminho: string) =>
        caminho.includes('/repertorio/pacote')
          ? repertorio.cliente.get(caminho)
          : comunidade.cliente.get(caminho),
    } as unknown as Pick<ClienteDaApi, 'get' | 'post'>

    const resumo = await sincronizarParticao(p, cliente)
    expect(resumo.repertoriosAtualizados).toBe(1)
    expect((await p.lerRepertorio(EVENTO_ID))?.pacote.versao).toBe('versao-2')
  })
})

describe('encontro perto', () => {
  const agora = new Date('2026-11-22T12:00:00.000Z')
  test('de 6 h depois do início até 3 dias antes', () => {
    expect(encontroEstaPerto('2026-11-24T12:00:00.000Z', agora)).toBe(true)
    expect(encontroEstaPerto('2026-11-25T12:00:00.000Z', agora)).toBe(true)
    expect(encontroEstaPerto('2026-11-26T12:00:00.000Z', agora)).toBe(false)
    expect(encontroEstaPerto('2026-11-22T08:00:00.000Z', agora)).toBe(true)
    expect(encontroEstaPerto('2026-11-22T05:00:00.000Z', agora)).toBe(false)
  })
})
