import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * F13: fila offline no servidor (revalida tudo, idempotente, conflito
 * explícito), log de mudanças com cursor e pacote offline com validade.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let admin: Pessoa
let org: Pessoa
let membro: Pessoa
let outro: Pessoa
const v: Record<string, string> = {}
let eventoId: string
let tarefaDoMembro: string
let tarefaDoOutro: string
let itemDoMembro: string
let codigoCheckin: string

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

interface Resultado {
  chave: string
  status: string
  motivo?: string
  estado?: Record<string, unknown>
  resultado?: Record<string, unknown>
}

async function enviar(p: Pessoa, operacoes: object[]): Promise<Resultado[]> {
  const r = await req('POST', '/sync/operacoes', p, { operacoes })
  expect(r.statusCode).toBe(200)
  return r.json().resultados as Resultado[]
}

const op = (p: Pessoa, tipo: string, dados: object, extra: object = {}) => ({
  chave: randomUUID(),
  vinculoId: v[p.id],
  criadaEm: new Date().toISOString(),
  tipo,
  dados,
  ...extra,
})

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  com = await criarComunidade(b, 'Jovens Offline')
  admin = await pessoaComSessao(b, app, config, 'Admin')
  org = await pessoaComSessao(b, app, config, 'Organizadora')
  membro = await pessoaComSessao(b, app, config, 'Membro')
  outro = await pessoaComSessao(b, app, config, 'Outro')
  v[admin.id] = await vincular(b, admin.id, com, 'admin')
  v[org.id] = await vincular(b, org.id, com, 'organizador')
  v[membro.id] = await vincular(b, membro.id, com, 'membro')
  v[outro.id] = await vincular(b, outro.id, com, 'membro')

  const um = async (sql: string, params: unknown[]) =>
    (await b.dono.query<{ id: string }>(sql, params)).rows[0]!.id
  eventoId = await um(
    `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por,
       status, capacidade)
     values ($1, 'Sábado offline', 'Outra', now() + interval '2 days', 120, 'America/Sao_Paulo', $2,
       'publicado', 3) returning id`,
    [com, admin.id],
  )
  for (const [i, t] of ['Louvor', 'Palavra'].entries()) {
    await b.dono.query(
      'insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min) values ($1, $2, $3, $4, 30)',
      [com, eventoId, i, t],
    )
  }
  tarefaDoMembro = await um(
    "insert into uj.tarefas (comunidade_id, evento_id, titulo, responsavel_vinculo_id) values ($1, $2, 'Levar o som', $3) returning id",
    [com, eventoId, v[membro.id]],
  )
  tarefaDoOutro = await um(
    "insert into uj.tarefas (comunidade_id, evento_id, titulo, responsavel_vinculo_id) values ($1, $2, 'Levar o lanche', $3) returning id",
    [com, eventoId, v[outro.id]],
  )
  itemDoMembro = await um(
    "insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto, responsavel_vinculo_id) values ($1, $2, 'preparacao', 'Testar microfone', $3) returning id",
    [com, eventoId, v[membro.id]],
  )
  codigoCheckin = (
    await b.dono.query<{ codigo_checkin: string }>(
      `insert into uj.inscricoes (comunidade_id, evento_id, origem, nome, telefone, estado, consentimento_em)
       values ($1, $2, 'publica', 'Visitante', '+5511988887777', 'confirmada', now()) returning codigo_checkin`,
      [com, eventoId],
    )
  ).rows[0]!.codigo_checkin
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('operações offline', () => {
  it('concluir a própria tarefa: aceita; repetir a mesma operação: ja_aplicada; mesma chave com outro conteúdo: rejeitada', async () => {
    const o = op(membro, 'tarefa.concluir', { tarefaId: tarefaDoMembro, concluida: true })
    expect((await enviar(membro, [o]))[0]).toMatchObject({ status: 'aceita' })
    expect((await enviar(membro, [o]))[0]).toMatchObject({ status: 'ja_aplicada' })
    const outra = { ...o, dados: { tarefaId: tarefaDoMembro, concluida: false } }
    expect((await enviar(membro, [outra]))[0]).toMatchObject({
      status: 'rejeitada',
      motivo: 'chave_com_conteudo_diferente',
    })
    const t = await b.su.query<{ concluida_por: string }>(
      'select concluida_por from uj.tarefas where id = $1',
      [tarefaDoMembro],
    )
    expect(t.rows[0]!.concluida_por).toBe(membro.id)
  })

  it('tarefa de outra pessoa: rejeitada sem permissão, nada muda', async () => {
    const [r] = await enviar(membro, [
      op(membro, 'tarefa.concluir', { tarefaId: tarefaDoOutro, concluida: true }),
    ])
    expect(r).toMatchObject({ status: 'rejeitada', motivo: 'sem_permissao' })
    const t = await b.su.query('select concluida_em from uj.tarefas where id = $1', [tarefaDoOutro])
    expect(t.rows).toEqual([{ concluida_em: null }])
  })

  it('reabrir o que alguém concluiu DEPOIS da alteração offline: conflito com o estado do servidor', async () => {
    const antes = new Date(Date.now() - 60_000).toISOString()
    await req('PATCH', `/eventos/${eventoId}/checklist/${itemDoMembro}`, org, { marcado: true })
    const [r] = await enviar(membro, [
      op(membro, 'checklist.marcar', { itemId: itemDoMembro, marcado: false }, { criadaEm: antes }),
    ])
    expect(r).toMatchObject({ status: 'conflito', motivo: 'concluido_depois' })
    expect(r!.estado!['marcado_em']).toBeTruthy()
    // Reabrir com a alteração feita depois da conclusão é aplicado.
    const [depois] = await enviar(membro, [
      op(membro, 'checklist.marcar', { itemId: itemDoMembro, marcado: false }),
    ])
    expect(depois).toMatchObject({ status: 'aceita' })
  })

  it('check-in offline: dois aparelhos marcando a mesma pessoa viram uma presença só', async () => {
    const a = op(org, 'presenca.registrar', { eventoId, codigo: codigoCheckin })
    const bb = op(admin, 'presenca.registrar', { eventoId, codigo: codigoCheckin })
    expect((await enviar(org, [a]))[0]!.status).toBe('aceita')
    expect((await enviar(admin, [bb]))[0]!.status).toBe('ja_aplicada')
    expect((await enviar(org, [a]))[0]!.status).toBe('ja_aplicada')
    const { rows } = await b.su.query<{ n: number; origem: string }>(
      'select count(*)::int as n, min(origem) as origem from uj.presencas where evento_id = $1',
      [eventoId],
    )
    expect(rows[0]).toEqual({ n: 1, origem: 'offline' })
  })

  it('membro não registra presença de ninguém', async () => {
    const [r] = await enviar(membro, [
      op(membro, 'presenca.registrar', { eventoId, nomeAvulso: 'Alguém' }),
    ])
    expect(r).toMatchObject({ status: 'rejeitada', motivo: 'sem_permissao' })
  })

  it('ao vivo: proposta sobre a versão atual é aceita; sobre versão velha, conflito com o servidor', async () => {
    const agora = Date.now()
    const proposta = op(org, 'ao_vivo.proposta', {
      eventoId,
      versaoBase: 0,
      comandos: [
        { comando: 'iniciar', ocorridoEm: new Date(agora - 120_000).toISOString() },
        { comando: 'avancar', ocorridoEm: new Date(agora - 60_000).toISOString() },
      ],
    })
    const [r] = await enviar(org, [proposta])
    expect(r).toMatchObject({ status: 'aceita' })
    expect(r!.resultado!['versao']).toBe(2)
    const comandos = await b.su.query<{ origem: string }>(
      'select origem from uj.andamento_comandos where evento_id = $1',
      [eventoId],
    )
    expect(comandos.rows.map((x) => x.origem)).toEqual(['offline', 'offline'])
    const velha = op(admin, 'ao_vivo.proposta', {
      eventoId,
      versaoBase: 0,
      comandos: [{ comando: 'iniciar', ocorridoEm: new Date().toISOString() }],
    })
    const [c] = await enviar(admin, [velha])
    expect(c!.status).toBe('conflito')
    expect(c!.estado!['versao']).toBe(2)
    // Membro não conduz.
    const [m] = await enviar(membro, [
      op(membro, 'ao_vivo.proposta', {
        eventoId,
        versaoBase: 2,
        comandos: [{ comando: 'pausar', ocorridoEm: new Date().toISOString() }],
      }),
    ])
    expect(m).toMatchObject({ status: 'rejeitada', motivo: 'sem_permissao' })
  })

  it('intenção de inscrição: confirmada enquanto há vaga; sem vaga, rejeitada com motivo', async () => {
    const [r] = await enviar(membro, [op(membro, 'inscricao.intencao', { eventoId })])
    expect(r).toMatchObject({ status: 'aceita', resultado: { estado: 'confirmada' } })
    await enviar(outro, [op(outro, 'inscricao.intencao', { eventoId })])
    const [lotado] = await enviar(org, [op(org, 'inscricao.intencao', { eventoId })])
    expect(lotado).toMatchObject({ status: 'rejeitada', motivo: 'lotado' })
  })

  it('operação vencida (mais velha que a validade offline) é rejeitada', async () => {
    const velha = new Date(Date.now() - 8 * 24 * 3600_000).toISOString()
    const [r] = await enviar(membro, [
      op(
        membro,
        'tarefa.concluir',
        { tarefaId: tarefaDoMembro, concluida: true },
        { criadaEm: velha },
      ),
    ])
    expect(r).toMatchObject({ status: 'rejeitada', motivo: 'operacao_vencida' })
  })

  it('operação com vínculo que não é o atual: rejeitada; dados inválidos não derrubam o lote', async () => {
    const resultados = await enviar(membro, [
      op(
        membro,
        'tarefa.concluir',
        { tarefaId: tarefaDoMembro, concluida: true },
        { vinculoId: v[outro.id] },
      ),
      { chave: randomUUID(), tipo: 'inventado' },
    ])
    expect(resultados.map((r) => [r.status, r.motivo])).toEqual([
      ['rejeitada', 'vinculo_revogado'],
      ['rejeitada', 'dados_invalidos'],
    ])
  })

  it('enviada depois da revogação do vínculo: recusada inteira, nada aplicado', async () => {
    const sai = await pessoaComSessao(b, app, config, 'Revogado')
    v[sai.id] = await vincular(b, sai.id, com, 'membro')
    const tarefa = (
      await b.dono.query<{ id: string }>(
        "insert into uj.tarefas (comunidade_id, evento_id, titulo, responsavel_vinculo_id) values ($1, $2, 'Antes de sair', $3) returning id",
        [com, eventoId, v[sai.id]],
      )
    ).rows[0]!.id
    const pendente = op(sai, 'tarefa.concluir', { tarefaId: tarefa, concluida: true })
    await req('PATCH', `/membros/${v[sai.id]}`, admin, { estado: 'desativado' })
    const r = await req('POST', '/sync/operacoes', sai, { operacoes: [pendente] })
    expect(r.statusCode).toBe(404)
    const t = await b.su.query('select concluida_em from uj.tarefas where id = $1', [tarefa])
    expect(t.rows).toEqual([{ concluida_em: null }])
  })
})

describe('log de mudanças', () => {
  it('cursor (xact, id) pagina sem perder nem repetir, e nunca mostra oração "somente eu" de outra pessoa', async () => {
    const minha = await req('POST', '/oracao', membro, {
      texto: 'Minha',
      visibilidade: 'somente_eu',
    })
    const alheia = await req('POST', '/oracao', outro, {
      texto: 'Dele',
      visibilidade: 'somente_eu',
    })
    const publica = await req('POST', '/oracao', outro, {
      texto: 'De todos',
      visibilidade: 'comunidade',
    })
    const minhaChave = `pedidos_oracao:${minha.json().id}`
    const publicaChave = `pedidos_oracao:${publica.json().id}`
    // A marca d'água é do cluster inteiro: transações de outros testes em
    // paralelo podem atrasá-la (D13: atraso, nunca perda). Retoma do cursor
    // até as duas aparecerem, por até 10 s.
    const vistos: string[] = []
    let cursor = '0:0'
    for (let i = 0; i < 200; i++) {
      const r = await req('GET', `/sync/mudancas?cursor=${cursor}&limite=7`, membro)
      expect(r.statusCode).toBe(200)
      const corpo = r.json()
      vistos.push(
        ...(corpo.mudancas as { id: string; tabela: string }[]).map((m) => `${m.tabela}:${m.id}`),
      )
      cursor = corpo.cursor
      if (corpo.temMais) continue
      if (vistos.includes(minhaChave) && vistos.includes(publicaChave)) break
      await new Promise((r) => setTimeout(r, 100))
    }
    expect(vistos).toContain(`pedidos_oracao:${minha.json().id}`)
    expect(vistos).toContain(`pedidos_oracao:${publica.json().id}`)
    expect(vistos).not.toContain(`pedidos_oracao:${alheia.json().id}`)
    // Inscrições e presenças (nome e telefone) são de nível de organizador.
    expect(vistos.some((x) => x.startsWith('inscricoes:') || x.startsWith('presencas:'))).toBe(
      false,
    )
    // Páginas pequenas trazem o mesmo que uma página grande (que pode ter
    // linhas mais novas no fim, se a marca d'água andou entre as consultas).
    const tudo = await req('GET', '/sync/mudancas?limite=1000', membro)
    const grande = (tudo.json().mudancas as { id: string; tabela: string }[]).map(
      (m) => `${m.tabela}:${m.id}`,
    )
    expect(grande.slice(0, vistos.length)).toEqual(vistos)
    // Retomar do último cursor nunca repete o que já veio.
    const segunda = await req('GET', `/sync/mudancas?cursor=${cursor}`, membro)
    const repetidas = (segunda.json().mudancas as { id: string; tabela: string }[]).filter((m) =>
      vistos.includes(`${m.tabela}:${m.id}`),
    )
    expect(repetidas.filter((m) => m.tabela === 'pedidos_oracao')).toEqual([])
  })

  it('cursor anterior à poda pede para recomeçar', async () => {
    const primeira = await req('GET', '/sync/mudancas?limite=1', membro)
    const cursorAntigo = primeira.json().cursor as string
    await b.dono.query(
      "update uj.mudancas set momento = now() - interval '100 days' where comunidade_id = $1",
      [com],
    )
    // Só abaixo da marca d'água (que outros testes em paralelo podem segurar): até 10 s.
    let recomecar = false
    for (let i = 0; i < 100 && !recomecar; i++) {
      await b.dono.query('select uj.podar_mudancas(90)')
      const r = await req('GET', `/sync/mudancas?cursor=${cursorAntigo}`, membro)
      recomecar = r.json().recomecar === true
      if (!recomecar) await new Promise((x) => setTimeout(x, 100))
    }
    expect(recomecar).toBe(true)
  })

  it('cursor malformado: 400', async () => {
    expect((await req('GET', '/sync/mudancas?cursor=abc', membro)).statusCode).toBe(400)
  })
})

describe('pacote offline do evento', () => {
  it('validade igual à da comunidade (7 dias por padrão, D23); membro sem lista de check-in', async () => {
    const r = await req('GET', `/eventos/${eventoId}/pacote-offline`, membro)
    expect(r.statusCode).toBe(200)
    const p = r.json()
    expect(p.validadeDias).toBe(7)
    const dias = (new Date(p.validoAte).getTime() - new Date(p.geradoEm).getTime()) / 86_400_000
    expect(Math.round(dias)).toBe(7)
    expect(p.vinculoId).toBe(v[membro.id])
    expect(p.checkin).toBeNull()
    expect(p.etapas).toHaveLength(2)
    expect(r.body).not.toContain('988887777')
  })

  it('organizador recebe a lista de check-in com telefone mascarado; validade segue a comunidade', async () => {
    await b.su.query('update uj.comunidades set validade_offline_dias = 3 where id = $1', [com])
    const r = await req('GET', `/eventos/${eventoId}/pacote-offline`, org)
    const p = r.json()
    expect(p.validadeDias).toBe(3)
    const visitante = (p.checkin.inscritos as { nome: string; telefone: string }[]).find(
      (i) => i.nome === 'Visitante',
    )
    expect(visitante!.telefone).toBe('•••• 7777')
    expect(r.body).not.toContain('988887777')
    await b.su.query('update uj.comunidades set validade_offline_dias = 7 where id = $1', [com])
  })
})
