import { aoEncerrarSessao } from '@/estado/aoEncerrarSessao'
import { ligarLimpezaAoSair } from '@/funcionalidades/offline/aoEncerrar'
import { criarDeposito } from '@/funcionalidades/offline/deposito'
import { dispensarDescarte, lerDescarte } from '@/funcionalidades/offline/descartadas'
import { registrarAcao } from '@/funcionalidades/offline/fila'
import { semOracao } from '@/funcionalidades/offline/semOracao'
import {
  AcessoRevogado,
  guardarPacote,
  sincronizarParticao,
} from '@/funcionalidades/offline/sincronizador'
import type { NovaOperacao } from '@/funcionalidades/offline/tipos'
import {
  cofre,
  DIA_MS,
  EVENTO_ID,
  limparAparelho,
  MEU_VINCULO,
  pacoteDeTeste,
  servidorDeSincronizacao,
  sqlite,
} from '@/testes/offline'

const CONTA = 'conta-eu'
const COMUNIDADE = '11111111-1111-4111-8111-111111111111'
const OUTRA = '11111111-1111-4111-8111-222222222222'

const dadosDaParticao = (comunidadeId = COMUNIDADE, contaId = CONTA) => ({
  contaId,
  comunidadeId,
  vinculoId: MEU_VINCULO,
  validadeDias: 7,
})

const concluir = {
  tipo: 'tarefa.concluir',
  dados: { tarefaId: 'tar-1', concluida: true },
  eventoId: EVENTO_ID,
  descricao: 'Concluir a tarefa "Testar o som"',
} as const

beforeEach(() => {
  limparAparelho()
  dispensarDescarte()
})

describe('partições cifradas', () => {
  test('cada partição tem a sua chave no cofre e o banco fica preso a ela', async () => {
    const deposito = criarDeposito()
    await deposito.criar(dadosDaParticao(COMUNIDADE))
    await deposito.criar(dadosDaParticao(OUTRA))

    const chaves = [...cofre.entries()].filter(([nome]) => nome.startsWith('uj.offline.chave.'))
    expect(chaves).toHaveLength(2)
    expect(chaves[0]![1]).toMatch(/^[0-9a-f]{64}$/)
    expect(chaves[0]![1]).not.toBe(chaves[1]![1])
    for (const arquivo of sqlite.__arquivos.values()) expect(arquivo.chave).toMatch(/^"x'/)

    // Chave trocada no cofre: o banco não abre, e a partição ilegível é descartada.
    cofre.set(chaves[0]![0], 'f'.repeat(64))
    const outroAparelho = criarDeposito()
    const id = chaves[0]![0].endsWith(COMUNIDADE) ? COMUNIDADE : OUTRA
    expect(await outroAparelho.abrir(CONTA, id)).toBeNull()
    expect((await outroAparelho.listar()).map((r) => r.comunidadeId)).not.toContain(id)
  })

  test('sem SQLCipher no binário, nada é gravado e o modo offline desliga', async () => {
    sqlite.__opcoes.semCifragem = true
    const deposito = criarDeposito()
    await expect(deposito.criar(dadosDaParticao())).rejects.toThrow(/cifragem/)
    expect(deposito.disponivel).toBe(false)
    expect(sqlite.__arquivos.size).toBe(0)
    expect(await deposito.listar()).toEqual([])
  })

  test('partição vencida fica bloqueada e é apagada ao abrir', async () => {
    const deposito = criarDeposito()
    const t0 = new Date('2026-11-14T12:00:00.000Z')
    const p = await deposito.criar(dadosDaParticao(), t0)
    await registrarAcao(p, concluir, t0)

    const oitoDiasDepois = new Date(t0.getTime() + 8 * DIA_MS)
    const vencidas = await deposito.apagarVencidas(oitoDiasDepois)
    expect(vencidas).toHaveLength(1)
    expect(vencidas[0]?.operacoes.map((o) => o.descricao)).toEqual([concluir.descricao])

    expect(await deposito.abrir(CONTA, COMUNIDADE, oitoDiasDepois)).toBeNull()
    expect(await deposito.listar()).toEqual([])
    expect(sqlite.__arquivos.size).toBe(0)
    expect([...cofre.keys()].some((k) => k.startsWith('uj.offline.chave.'))).toBe(false)
  })

  test('abrir uma partição vencida também a apaga (nunca é lida)', async () => {
    const deposito = criarDeposito()
    const t0 = new Date('2026-11-14T12:00:00.000Z')
    await deposito.criar(dadosDaParticao(), t0)
    expect(await deposito.abrir(CONTA, COMUNIDADE, new Date(t0.getTime() + 6 * DIA_MS))).not.toBe(
      null,
    )
    expect(await deposito.abrir(CONTA, COMUNIDADE, new Date(t0.getTime() + 7 * DIA_MS))).toBeNull()
    expect(sqlite.__arquivos.size).toBe(0)
  })

  test('sair da conta apaga todas as partições e mostra o que não foi enviado', async () => {
    const deposito = criarDeposito()
    const desligar = ligarLimpezaAoSair(deposito)
    const p = await deposito.criar(dadosDaParticao(COMUNIDADE))
    await deposito.criar(dadosDaParticao(OUTRA))
    await registrarAcao(p, concluir)

    await aoEncerrarSessao(CONTA)
    desligar()

    expect(await deposito.listar()).toEqual([])
    expect(sqlite.__arquivos.size).toBe(0)
    expect([...cofre.keys()].some((k) => k.startsWith('uj.offline.'))).toBe(true) // só o índice vazio
    expect(JSON.parse(cofre.get('uj.offline.particoes') ?? '[]')).toEqual([])
    expect(lerDescarte()?.itens.map((i) => i.descricao)).toEqual([concluir.descricao])
  })

  test('trocar de conta apaga as partições da conta anterior', async () => {
    const deposito = criarDeposito()
    await deposito.criar(dadosDaParticao(COMUNIDADE, 'conta-anterior'))
    await deposito.criar(dadosDaParticao(COMUNIDADE, CONTA))
    await deposito.apagarOutrasContas(CONTA)
    expect((await deposito.listar()).map((r) => r.contaId)).toEqual([CONTA])
    expect(sqlite.__arquivos.size).toBe(1)
  })
})

describe('pedidos de oração nunca vão para o banco local', () => {
  const SEGREDO = 'Pedido de oração muito pessoal'

  test('pacote com campo de oração é gravado sem ele', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar(dadosDaParticao())
    const pacote = {
      ...pacoteDeTeste(),
      pedidosDeOracao: [{ texto: SEGREDO }],
      evento: { ...pacoteDeTeste().evento, oracao: { texto: SEGREDO } },
    }
    await guardarPacote(p, pacote)

    const lido = await p.lerPacote(EVENTO_ID)
    expect(lido?.pacote).not.toHaveProperty('pedidosDeOracao')
    expect(lido?.pacote.evento).not.toHaveProperty('oracao')
    expect(sqlite.__despejar()).not.toContain(SEGREDO)
  })

  test('operação de oração não entra na fila', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar(dadosDaParticao())
    const op = {
      chave: '01890000-0000-7000-8000-000000000001',
      tipo: 'oracao.criar',
      comunidadeId: COMUNIDADE,
      vinculoId: MEU_VINCULO,
      criadaEm: new Date().toISOString(),
      dados: { texto: SEGREDO },
      eventoId: null,
      descricao: 'Pedido de oração',
      contexto: {},
    } as unknown as NovaOperacao
    await expect(p.enfileirar(op)).rejects.toThrow(/exige conexão/)
    expect(await p.operacoes()).toHaveLength(0)
    expect(sqlite.__despejar()).not.toContain(SEGREDO)
  })

  test('nem campos de oração dentro de dados ou do contexto local', () => {
    expect(
      semOracao({
        a: 1,
        oracoes: [1],
        pedidos_oracao: [2],
        lista: [{ textoDaOração: 'x', b: 2 }],
        decoracao: 'fica: não é oração',
      }),
    ).toEqual({ a: 1, lista: [{ b: 2 }], decoracao: 'fica: não é oração' })
  })

  test('o log de mudanças não é guardado: só o cursor', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar(dadosDaParticao())
    await guardarPacote(p, pacoteDeTeste())
    const idDoPedido = '99999999-9999-4999-8999-999999999999'
    const servidor = servidorDeSincronizacao({
      mudancas: () => ({
        recomecar: false,
        mudancas: [{ tabela: 'pedidos_oracao', id: idDoPedido, operacao: 'insert', momento: '' }],
        cursor: '2000:0',
        temMais: false,
      }),
    })
    await sincronizarParticao(p, servidor.cliente)
    expect(sqlite.__despejar()).not.toContain(idDoPedido)
    expect((await p.meta()).cursor).toBe('2000:0')
  })
})

describe('sincronização', () => {
  test('renova a validade com a da comunidade e marca a última sincronização', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar(dadosDaParticao())
    const agora = new Date('2026-11-20T10:00:00.000Z')
    const servidor = servidorDeSincronizacao({ validadeOfflineDias: 10 })
    await sincronizarParticao(p, servidor.cliente, () => agora)
    const meta = await p.meta()
    expect(meta.validadeDias).toBe(10)
    expect(meta.validoAte).toBe(new Date(agora.getTime() + 10 * DIA_MS).toISOString())
    expect(meta.ultimaSincronizacao).toBe(agora.toISOString())
    expect((await deposito.listar())[0]?.validoAte).toBe(meta.validoAte)
  })

  test('cursor podado (recomecar): baixa de novo os eventos preparados', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar(dadosDaParticao())
    await guardarPacote(p, pacoteDeTeste())
    const servidor = servidorDeSincronizacao({
      mudancas: () => ({ recomecar: true, mudancas: [], cursor: '5000:0', temMais: false }),
      pacote: () => pacoteDeTeste({ evento: { ...pacoteDeTeste().evento, titulo: 'Novo título' } }),
    })
    const resumo = await sincronizarParticao(p, servidor.cliente)
    expect(resumo.recomecou).toBe(true)
    expect(resumo.pacotesAtualizados).toBe(1)
    expect((await p.lerPacote(EVENTO_ID))?.pacote.evento.titulo).toBe('Novo título')
    expect((await p.meta()).cursor).toBe('5000:0')
  })

  test('vínculo revogado (404) vira AcessoRevogado', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar(dadosDaParticao())
    const servidor = servidorDeSincronizacao({ revogadas: [COMUNIDADE] })
    await expect(sincronizarParticao(p, servidor.cliente)).rejects.toBeInstanceOf(AcessoRevogado)
  })
})
