import { criarDeposito } from '@/funcionalidades/offline/deposito'
import {
  enviarFila,
  refazerOperacao,
  registrarAcao,
  textoParaCopiar,
} from '@/funcionalidades/offline/fila'
import { SemConexao } from '@/servicos/erros'
import { EVENTO_ID, limparAparelho, MEU_VINCULO, servidorDeSincronizacao } from '@/testes/offline'

const CONTA = 'conta-eu'
const COMUNIDADE_A = '11111111-1111-4111-8111-111111111111'
const COMUNIDADE_B = '11111111-1111-4111-8111-222222222222'
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

async function particao(comunidadeId = COMUNIDADE_A, vinculoId: string | null = MEU_VINCULO) {
  const deposito = criarDeposito()
  const p = await deposito.criar({ contaId: CONTA, comunidadeId, vinculoId, validadeDias: 7 })
  return { deposito, p }
}

const concluir = (tarefaId: string, concluida = true) =>
  ({
    tipo: 'tarefa.concluir',
    dados: { tarefaId, concluida },
    eventoId: EVENTO_ID,
    descricao: `${concluida ? 'Concluir' : 'Reabrir'} a tarefa ${tarefaId}`,
  }) as const

const presenca = (inscricaoId: string) =>
  ({
    tipo: 'presenca.registrar',
    dados: { eventoId: EVENTO_ID, inscricaoId, ocorridaEm: new Date().toISOString() },
    eventoId: EVENTO_ID,
    descricao: 'Presença de Davi Rocha',
  }) as const

beforeEach(limparAparelho)

describe('fila de saída', () => {
  test('a operação nasce com UUID v7, a comunidade e o vínculo da partição', async () => {
    const { p } = await particao()
    await registrarAcao(p, concluir('tar-1'))
    const [op] = await p.operacoes()
    expect(op?.chave).toMatch(UUID_V7)
    expect(op?.comunidadeId).toBe(COMUNIDADE_A)
    expect(op?.vinculoId).toBe(MEU_VINCULO)
    expect(op?.estado).toBe('pendente')
  })

  test('sem vínculo conhecido (evento não preparado), nada entra na fila', async () => {
    const { p } = await particao(COMUNIDADE_A, null)
    await expect(registrarAcao(p, concluir('tar-1'))).rejects.toThrow(/prepare o evento/)
    expect(await p.operacoes()).toHaveLength(0)
  })

  test('a mesma operação reenviada não duplica (resposta perdida, mesma chave, ja_aplicada)', async () => {
    const { p } = await particao()
    const servidor = servidorDeSincronizacao()
    await registrarAcao(p, presenca('insc-1'))
    const [op] = await p.operacoes()

    // 1º envio: o servidor aplica, mas a resposta não chega ao aparelho.
    servidor.controle.perderAProximaResposta = true
    await expect(enviarFila(p, servidor.cliente)).rejects.toBeInstanceOf(SemConexao)
    expect(await p.operacoes()).toHaveLength(1)

    // 2º envio: a mesma chave e o mesmo conteúdo; o servidor reconhece e não aplica de novo.
    const resumo = await enviarFila(p, servidor.cliente)
    expect(resumo.aceitas).toBe(1)
    expect(servidor.lotes.map((l) => l.operacoes[0]?.chave)).toEqual([op?.chave, op?.chave])
    expect(servidor.efeitos).toHaveLength(1)
    expect(await p.operacoes()).toHaveLength(0)
  })

  test('gravar a mesma chave duas vezes deixa uma operação só', async () => {
    const { p } = await particao()
    await registrarAcao(p, concluir('tar-1'))
    const [op] = await p.operacoes()
    expect(await p.enfileirar(op!)).toBe('repetida')
    expect(await p.operacoes()).toHaveLength(1)
  })

  test('marcar a mesma pessoa duas vezes sem rede guarda uma presença só', async () => {
    const { p } = await particao()
    expect((await registrarAcao(p, presenca('insc-1'))).situacao).toBe('nova')
    expect((await registrarAcao(p, presenca('insc-1'))).situacao).toBe('repetida')
    expect(await p.operacoes()).toHaveLength(1)
  })

  test('concluir e reabrir antes de enviar se anulam', async () => {
    const { p } = await particao()
    await registrarAcao(p, concluir('tar-1', true))
    expect((await registrarAcao(p, concluir('tar-1', false))).situacao).toBe('desfeita')
    expect(await p.operacoes()).toHaveLength(0)
  })

  test('cada resposta é tratada: aceita e ja_aplicada saem, rejeitada e conflito ficam', async () => {
    const { p } = await particao()
    await registrarAcao(p, concluir('tar-aceita'))
    await registrarAcao(p, concluir('tar-ja'))
    await registrarAcao(p, concluir('tar-rejeitada'))
    await registrarAcao(p, concluir('tar-conflito', false))
    const servidor = servidorDeSincronizacao({
      responder: (op) => {
        const id = (op.dados as { tarefaId: string }).tarefaId
        if (id === 'tar-ja') return { status: 'ja_aplicada' }
        if (id === 'tar-rejeitada') {
          return {
            status: 'rejeitada',
            motivo: 'sem_permissao',
            mensagem: 'Este item não é seu para marcar.',
          }
        }
        if (id === 'tar-conflito') {
          return {
            status: 'conflito',
            motivo: 'concluido_depois',
            mensagem: 'Alguém concluiu este item depois da sua alteração.',
            estado: { concluida_em: '2026-11-14T18:00:00.000Z', versao: 4 },
          }
        }
        return { status: 'aceita' }
      },
    })

    const resumo = await enviarFila(p, servidor.cliente)
    expect(resumo).toEqual({ enviadas: 4, aceitas: 2, rejeitadas: 1, conflitos: 1 })
    expect(servidor.lotes).toHaveLength(1)

    const restantes = await p.operacoes()
    expect(restantes.map((o) => [o.estado, o.motivo])).toEqual([
      ['rejeitada', 'sem_permissao'],
      ['conflito', 'concluido_depois'],
    ])
    expect(restantes[0]?.mensagem).toBe('Este item não é seu para marcar.')
    expect(restantes[1]?.estadoDoServidor).toEqual({
      concluida_em: '2026-11-14T18:00:00.000Z',
      versao: 4,
    })

    // Rejeitada e conflito não voltam sozinhas no próximo envio.
    await enviarFila(p, servidor.cliente)
    expect(servidor.lotes).toHaveLength(1)
  })

  test('refazer usa chave nova; copiar dá um texto legível; descartar remove', async () => {
    const { p } = await particao()
    await registrarAcao(p, concluir('tar-1'))
    const servidor = servidorDeSincronizacao({
      responder: () => ({ status: 'rejeitada', motivo: 'lotado', mensagem: 'As vagas acabaram.' }),
    })
    await enviarFila(p, servidor.cliente)
    const [rejeitada] = await p.operacoes()
    expect(textoParaCopiar(rejeitada!)).toContain('Resposta do servidor: As vagas acabaram.')

    const nova = await refazerOperacao(p, rejeitada!.chave)
    const fila = await p.operacoes()
    expect(fila).toHaveLength(1)
    expect(fila[0]?.chave).toBe(nova)
    expect(nova).not.toBe(rejeitada!.chave)
    expect(fila[0]?.estado).toBe('pendente')

    await p.removerOperacao(nova!)
    expect(await p.operacoes()).toHaveLength(0)
  })

  test('conflito do ao vivo: refazer parte da versão atual do servidor', async () => {
    const { p } = await particao()
    await registrarAcao(p, {
      tipo: 'ao_vivo.proposta',
      dados: {
        eventoId: EVENTO_ID,
        versaoBase: 0,
        comandos: [{ comando: 'iniciar', ocorridoEm: new Date().toISOString() }],
      },
      eventoId: EVENTO_ID,
      descricao: 'Ao vivo: iniciar',
    })
    // Comando seguinte, ainda sem envio: entra na mesma proposta.
    await registrarAcao(p, {
      tipo: 'ao_vivo.proposta',
      dados: {
        eventoId: EVENTO_ID,
        versaoBase: 0,
        comandos: [{ comando: 'avancar', ocorridoEm: new Date().toISOString() }],
      },
      eventoId: EVENTO_ID,
      descricao: 'Ao vivo: avançar',
    })
    const [proposta] = await p.operacoes()
    expect(proposta?.tipo === 'ao_vivo.proposta' && proposta.dados.comandos).toHaveLength(2)

    const servidor = servidorDeSincronizacao({
      responder: () => ({
        status: 'conflito',
        motivo: 'andamento_mudou',
        mensagem: 'O andamento mudou no servidor.',
        estado: { versao: 5, situacao: 'em_andamento' },
      }),
    })
    await enviarFila(p, servidor.cliente)
    const [conflito] = await p.operacoes()
    await refazerOperacao(p, conflito!.chave)
    const [refeita] = await p.operacoes()
    expect(refeita?.tipo === 'ao_vivo.proposta' && refeita.dados.versaoBase).toBe(5)
  })
})

describe('troca de comunidade', () => {
  test('cada operação vai só para a comunidade em que nasceu', async () => {
    const deposito = criarDeposito()
    const a = await deposito.criar({
      contaId: CONTA,
      comunidadeId: COMUNIDADE_A,
      vinculoId: MEU_VINCULO,
      validadeDias: 7,
    })
    await registrarAcao(a, concluir('tarefa-de-A'))
    // A pessoa troca para B e faz outra coisa lá.
    const b = await deposito.criar({
      contaId: CONTA,
      comunidadeId: COMUNIDADE_B,
      vinculoId: 'vinculo-em-B',
      validadeDias: 7,
    })
    await registrarAcao(b, concluir('tarefa-de-B'))

    const servidor = servidorDeSincronizacao()
    await enviarFila(b, servidor.cliente)
    await enviarFila(a, servidor.cliente)

    const para = (id: string) =>
      servidor.lotes
        .filter((l) => l.caminho === `/api/v1/c/${id}/sync/operacoes`)
        .flatMap((l) => l.operacoes.map((o) => (o.dados as { tarefaId: string }).tarefaId))
    expect(para(COMUNIDADE_A)).toEqual(['tarefa-de-A'])
    expect(para(COMUNIDADE_B)).toEqual(['tarefa-de-B'])
    expect(servidor.lotes.find((l) => l.caminho.includes(COMUNIDADE_B))?.operacoes[0]).toEqual(
      expect.objectContaining({ vinculoId: 'vinculo-em-B' }),
    )
  })

  test('a partição recusa guardar operação de outra comunidade', async () => {
    const { p: a } = await particao(COMUNIDADE_A)
    await registrarAcao(a, concluir('tarefa-de-A'))
    const [op] = await a.operacoes()
    const { p: b } = await particao(COMUNIDADE_B)
    await expect(b.enfileirar(op!)).rejects.toThrow(/outra comunidade/)
    expect(await b.operacoes()).toHaveLength(0)
  })
})
