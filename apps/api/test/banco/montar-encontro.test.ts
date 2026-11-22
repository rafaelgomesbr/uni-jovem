import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Montar o sábado em poucos toques (D66, migração 0028): "Igual ao último
 * sábado" (rascunho com a equipe aguardando, sem avisar ninguém), convocar em
 * lote, sugestões por função e "Lembrar os N" (genérico, um por pessoa a cada
 * 24 h). Permissões por papel, isolamento A e B (id de B dá 404), RLS e fila de
 * notificações.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let orgA: Pessoa
let orgB: Pessoa
let membroA: Pessoa
let ana: Pessoa
let bruno: Pessoa
let camila: Pessoa
let davi: Pessoa
const v: Record<string, string> = {}

type Metodo = 'GET' | 'POST' | 'PATCH'
const req = (metodo: Metodo, com: string, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

const DIA = 86_400_000
const FUSO = 'America/Sao_Paulo'

/** Um sábado passado, 16:00 em Brasília (19:00 UTC), de N semanas atrás. */
function sabadoPassado(semanasAtras: number): Date {
  const hoje = new Date()
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 19))
  while (d.getUTCDay() !== 6 || d.getTime() > hoje.getTime() - DIA) d.setTime(d.getTime() - DIA)
  d.setTime(d.getTime() - (semanasAtras - 1) * 7 * DIA)
  return d
}

/** Encontro realizado (publicado e já passado), com roteiro, escrito direto pelo dono do banco. */
async function encontroRealizado(
  com: string,
  titulo: string,
  inicio: Date,
  autor: Pessoa,
): Promise<{ eventoId: string; louvorId: string }> {
  const { rows } = await b.dono.query<{ id: string }>(
    `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, status,
                             criado_por, descricao, capacidade)
     values ($1, $2, 'Programação de sábado', $3, 90, $4, 'publicado', $5, 'Descrição do sábado', 40)
     returning id`,
    [com, titulo, inicio, FUSO, autor.id],
  )
  const eventoId = rows[0]!.id
  const louvor = await b.dono.query<{ id: string }>(
    `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min)
     values ($1, $2, 0, 'Louvor', 20) returning id`,
    [com, eventoId],
  )
  await b.dono.query(
    `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min)
     values ($1, $2, 1, 'Palavra', 40), ($1, $2, 2, 'Oração', 15)`,
    [com, eventoId],
  )
  await b.dono.query(
    `insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto, ordem, marcado_em)
     values ($1, $2, 'preparacao', 'Ligar o som', 0, now())`,
    [com, eventoId],
  )
  await b.dono.query(
    `insert into uj.tarefas (comunidade_id, evento_id, titulo, concluida_em, prazo)
     values ($1, $2, 'Comprar água', now(), now())`,
    [com, eventoId],
  )
  return { eventoId, louvorId: louvor.rows[0]!.id }
}

async function convocarNoBanco(
  com: string,
  eventoId: string,
  vinculoId: string,
  funcao: string,
  etapaId: string | null,
  estado = 'confirmada',
) {
  await b.dono.query(
    `insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id, funcao, estado)
     values ($1, $2, $3, $4, $5, $6)`,
    [com, eventoId, etapaId, vinculoId, funcao, estado],
  )
}

async function novaMusica(com: string, titulo: string, arquivada = false): Promise<string> {
  const { rows } = await b.dono.query<{ id: string }>(
    `insert into uj.musicas (comunidade_id, titulo, criado_por, arquivada)
     values ($1, $2, $3, $4) returning id`,
    [com, titulo, orgA.id, arquivada],
  )
  return rows[0]!.id
}

async function notificacoesDe(contaId: string, titulo: string) {
  return (
    await b.su.query<{ titulo: string; corpo: string; recurso_id: string }>(
      'select titulo, corpo, recurso_id from uj.notificacoes where conta_id = $1 and titulo = $2',
      [contaId, titulo],
    )
  ).rows
}

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  comA = await criarComunidade(b, 'Jovens do Vale')
  comB = await criarComunidade(b, 'Jovens da Serra')
  orgA = await pessoaComSessao(b, app, config, 'Olga')
  orgB = await pessoaComSessao(b, app, config, 'Otávio')
  membroA = await pessoaComSessao(b, app, config, 'Mara')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  bruno = await pessoaComSessao(b, app, config, 'Bruno')
  camila = await pessoaComSessao(b, app, config, 'Camila')
  davi = await pessoaComSessao(b, app, config, 'Davi')
  v['org'] = await vincular(b, orgA.id, comA, 'organizador')
  await vincular(b, orgB.id, comB, 'organizador')
  await vincular(b, membroA.id, comA, 'membro')
  v['ana'] = await vincular(b, ana.id, comA, 'membro')
  v['bruno'] = await vincular(b, bruno.id, comA, 'membro')
  v['camila'] = await vincular(b, camila.id, comA, 'membro')
  v['davi'] = await vincular(b, davi.id, comA, 'membro')
  v['mara'] = (
    await b.su.query<{ id: string }>('select id from uj.vinculos where conta_id = $1', [membroA.id])
  ).rows[0]!.id
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('de onde copiar', () => {
  it('lista o último encontro de cada título, o mais recente primeiro, com a data sugerida', async () => {
    const jovem = await encontroRealizado(comA, 'Sábado Jovem', sabadoPassado(2), orgA)
    const ultimoJovem = await encontroRealizado(comA, 'Sábado Jovem', sabadoPassado(1), orgA)
    await encontroRealizado(comA, 'Noite de Louvor', sabadoPassado(4), orgA)
    await convocarNoBanco(comA, ultimoJovem.eventoId, v['ana']!, 'Violão', ultimoJovem.louvorId)
    await convocarNoBanco(comA, ultimoJovem.eventoId, v['bruno']!, 'Recepção', null, 'pendente')
    await convocarNoBanco(comA, jovem.eventoId, v['camila']!, 'Vocal', jovem.louvorId)
    v['ultimoJovem'] = ultimoJovem.eventoId
    v['louvorUltimo'] = ultimoJovem.louvorId
    const m = await novaMusica(comA, 'Sobre a rocha')
    await b.dono.query(
      `insert into uj.repertorio_itens (comunidade_id, evento_id, etapa_id, musica_id, ordem, tom_do_dia)
       values ($1, $2, $3, $4, 0, 'G')`,
      [comA, ultimoJovem.eventoId, ultimoJovem.louvorId, m],
    )

    const r = await req('GET', comA, '/eventos/anteriores-para-copiar', orgA)
    expect(r.statusCode).toBe(200)
    const { opcoes } = r.json() as {
      opcoes: {
        eventoId: string
        titulo: string
        etapas: number
        convocados: number
        musicas: number
        dataSugerida: string
        horaSugerida: string
        inicioSugerido: string
      }[]
    }
    expect(opcoes.map((o) => o.titulo)).toEqual(['Sábado Jovem', 'Noite de Louvor'])
    expect(opcoes[0]).toMatchObject({
      eventoId: ultimoJovem.eventoId,
      etapas: 3,
      convocados: 2,
      musicas: 1,
      horaSugerida: '16:00',
    })
    // O próximo sábado depois de hoje, sempre no futuro e no mesmo dia da semana (sábado).
    expect(new Date(opcoes[0]!.inicioSugerido).getTime()).toBeGreaterThan(Date.now())
    expect(new Date(`${opcoes[0]!.dataSugerida}T12:00:00Z`).getUTCDay()).toBe(6)
  })

  it('só a organização lê; membro 403; encontro de B nunca aparece', async () => {
    expect((await req('GET', comA, '/eventos/anteriores-para-copiar', membroA)).statusCode).toBe(
      403,
    )
    const deB = await req('GET', comB, '/eventos/anteriores-para-copiar', orgB)
    expect(deB.statusCode).toBe(200)
    expect(deB.json().opcoes).toEqual([])
    expect((await req('GET', comB, '/eventos/anteriores-para-copiar', orgA)).statusCode).toBe(404)
  })
})

describe('"Igual ao último sábado": copiar', () => {
  it('cria RASCUNHO com roteiro e equipe aguardando, sem músicas e sem avisar ninguém', async () => {
    // Quem avisou que não pode no sábado sugerido.
    const opcao = (await req('GET', comA, '/eventos/anteriores-para-copiar', orgA)).json()
      .opcoes[0] as { dataSugerida: string }
    await b.dono.query(
      `insert into uj.disponibilidades (comunidade_id, vinculo_id, data, disponivel)
       values ($1, $2, $3, false)`,
      [comA, v['bruno'], opcao.dataSugerida],
    )

    const r = await req('POST', comA, `/eventos/${v['ultimoJovem']}/copiar`, orgA, {})
    expect(r.statusCode).toBe(200)
    const novo = r.json()
    v['copia'] = novo.id
    expect(novo).toMatchObject({ status: 'rascunho', versao: 1, fuso: FUSO })
    expect(new Date(novo.inicio).getTime()).toBeGreaterThan(Date.now())
    expect(novo.resumo).toMatchObject({
      etapas: 3,
      duracaoTotalMin: 75,
      checklist: 1,
      tarefas: 1,
      naoCopiados: 0,
      musicas: { copiadas: 0, naOrigem: 1 },
      avisariaAoPublicar: 2,
    })
    expect(novo.resumo.convocados.pessoas).toBe(2)
    expect(novo.resumo.indisponiveis).toEqual([
      expect.objectContaining({ vinculoId: v['bruno'], nome: 'Bruno', funcao: 'Recepção' }),
    ])

    // O banco: rascunho, mesmas etapas na mesma ordem, equipe pendente, checklist e tarefa zerados.
    const evento = (
      await b.su.query(
        'select titulo, status, descricao, capacidade, duracao_min from uj.eventos where id = $1',
        [novo.id],
      )
    ).rows[0]
    expect(evento).toMatchObject({
      titulo: 'Sábado Jovem',
      status: 'rascunho',
      descricao: 'Descrição do sábado',
      capacidade: 40,
      duracao_min: 90,
    })
    const etapas = (
      await b.su.query(
        'select ordem, titulo, duracao_min from uj.etapas where evento_id = $1 order by ordem',
        [novo.id],
      )
    ).rows
    expect(etapas).toEqual([
      { ordem: 0, titulo: 'Louvor', duracao_min: 20 },
      { ordem: 1, titulo: 'Palavra', duracao_min: 40 },
      { ordem: 2, titulo: 'Oração', duracao_min: 15 },
    ])
    const equipe = (
      await b.su.query(
        `select a.funcao, a.estado, t.titulo as etapa from uj.atribuicoes a
           left join uj.etapas t on t.id = a.etapa_id
          where a.evento_id = $1 order by a.funcao`,
        [novo.id],
      )
    ).rows
    expect(equipe).toEqual([
      { funcao: 'Recepção', estado: 'pendente', etapa: null },
      { funcao: 'Violão', estado: 'pendente', etapa: 'Louvor' },
    ])
    expect(
      (
        await b.su.query('select marcado_em from uj.checklist_itens where evento_id = $1', [
          novo.id,
        ])
      ).rows[0].marcado_em,
    ).toBeNull()
    const tarefa = (
      await b.su.query('select concluida_em, prazo from uj.tarefas where evento_id = $1', [novo.id])
    ).rows[0]
    expect(tarefa).toEqual({ concluida_em: null, prazo: null })
    expect(
      (
        await b.su.query(
          'select count(*)::int as n from uj.repertorio_itens where evento_id = $1',
          [novo.id],
        )
      ).rows[0].n,
    ).toBe(0)

    // NINGUÉM foi avisado: nem convocação, nem nada, enquanto é rascunho.
    for (const p of [ana, bruno]) {
      expect(
        (await b.su.query('select 1 from uj.notificacoes where conta_id = $1', [p.id])).rowCount,
      ).toBe(0)
    }
  })

  it('só ao publicar a equipe é avisada (uma convocação para cada)', async () => {
    const r = await req('POST', comA, `/eventos/${v['copia']}/status`, orgA, {
      status: 'publicado',
    })
    expect(r.statusCode).toBe(200)
    expect(await notificacoesDe(ana.id, 'Nova convocação')).toHaveLength(1)
    expect(await notificacoesDe(bruno.id, 'Nova convocação')).toHaveLength(1)
    expect(await notificacoesDe(camila.id, 'Nova convocação')).toHaveLength(0)
  })

  it('a data sugerida é sempre a mais próxima, mesmo com encontro nela (o app avisa); "incluirMusicas" leva o repertório', async () => {
    // Já existe a cópia anterior no sábado sugerido: a sugestão NÃO pula para a semana seguinte (D74).
    const antes = (
      await b.su.query<{ inicio: Date }>('select inicio from uj.eventos where id = $1', [
        v['copia'],
      ])
    ).rows[0]!.inicio
    const r = await req('POST', comA, `/eventos/${v['ultimoJovem']}/copiar`, orgA, {
      incluirMusicas: true,
    })
    expect(r.statusCode).toBe(200)
    expect(new Date(r.json().inicio).getTime() - antes.getTime()).toBe(0)
    // A lista de onde copiar também não empurra a sugestão para longe por causa dos rascunhos.
    const lista = (await req('GET', comA, '/eventos/anteriores-para-copiar', orgA)).json() as {
      opcoes: { eventoId: string; inicioSugerido: string }[]
    }
    const daOrigem = lista.opcoes.find((o) => o.eventoId === v['ultimoJovem'])!
    expect(new Date(daOrigem.inicioSugerido).getTime()).toBe(antes.getTime())
    expect(r.json().resumo.musicas).toEqual({ copiadas: 1, naOrigem: 1 })
    const item = (
      await b.su.query(
        `select r.ordem, r.tom_do_dia, t.titulo as etapa from uj.repertorio_itens r
           left join uj.etapas t on t.id = r.etapa_id where r.evento_id = $1`,
        [r.json().id],
      )
    ).rows
    expect(item).toEqual([{ ordem: 0, tom_do_dia: 'G', etapa: 'Louvor' }])
  })

  it('data e hora pedidas valem; no passado, 400; música arquivada não vai', async () => {
    const arquivada = await novaMusica(comA, 'Música arquivada', true)
    await b.dono.query(
      `insert into uj.repertorio_itens (comunidade_id, evento_id, musica_id, ordem)
       values ($1, $2, $3, 1)`,
      [comA, v['ultimoJovem'], arquivada],
    )
    const futuro = new Date(Date.now() + 40 * DIA)
    const data = futuro.toISOString().slice(0, 10)
    const r = await req('POST', comA, `/eventos/${v['ultimoJovem']}/copiar`, orgA, {
      data,
      hora: '19:30',
      incluirMusicas: true,
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().resumo.musicas).toEqual({ copiadas: 1, naOrigem: 2 })
    const inicio = (
      await b.su.query<{ local: string }>(
        `select to_char(inicio at time zone fuso, 'YYYY-MM-DD HH24:MI') as local
           from uj.eventos where id = $1`,
        [r.json().id],
      )
    ).rows[0]!.local
    expect(inicio).toBe(`${data} 19:30`)

    const passado = await req('POST', comA, `/eventos/${v['ultimoJovem']}/copiar`, orgA, {
      data: '2020-01-04',
    })
    expect(passado.statusCode).toBe(400)
    expect(passado.json().erro).toBe('data_no_passado')
    const ruim = await req('POST', comA, `/eventos/${v['ultimoJovem']}/copiar`, orgA, {
      data: '28/11/2026',
    })
    expect(ruim.statusCode).toBe(400)
  })

  it('quem saiu da comunidade não é copiado e entra em naoCopiados', async () => {
    const saiu = await pessoaComSessao(b, app, config, 'Saiu')
    const vSaiu = await vincular(b, saiu.id, comA, 'membro')
    const e = await encontroRealizado(comA, 'Encontro com quem saiu', sabadoPassado(1), orgA)
    await convocarNoBanco(comA, e.eventoId, vSaiu, 'Som', null)
    await convocarNoBanco(comA, e.eventoId, v['ana']!, 'Recepção', null)
    await b.su.query("update uj.vinculos set estado = 'desativado' where id = $1", [vSaiu])
    const r = await req('POST', comA, `/eventos/${e.eventoId}/copiar`, orgA, {})
    expect(r.statusCode).toBe(200)
    expect(r.json().resumo.convocados.pessoas).toBe(1)
    expect(r.json().resumo.naoCopiados).toBe(1)
  })

  it('auditoria só com ids e contagens: nada de título, nome ou função', async () => {
    const { rows } = await b.su.query<{ detalhes: Record<string, unknown> }>(
      `select detalhes from uj.auditoria where acao = 'evento.copiado' and comunidade_id = $1
        order by momento limit 1`,
      [comA],
    )
    expect(Object.keys(rows[0]!.detalhes).sort()).toEqual(['convocacoes', 'musicas', 'origem'])
    expect(JSON.stringify(rows[0]!.detalhes)).not.toMatch(/Jovem|Ana|Bruno|Violão/)
  })

  it('permissão: membro 403; B não copia evento de A (404) e A não copia o de B (404)', async () => {
    const corpo = {}
    expect(
      (await req('POST', comA, `/eventos/${v['ultimoJovem']}/copiar`, membroA, corpo)).statusCode,
    ).toBe(403)
    expect(
      (await req('POST', comA, `/eventos/${v['ultimoJovem']}/copiar`, orgB, corpo)).statusCode,
    ).toBe(404)
    const deB = await encontroRealizado(comB, 'Encontro de B', sabadoPassado(1), orgB)
    const antes = (await b.su.query('select count(*)::int as n from uj.eventos')).rows[0].n
    expect(
      (await req('POST', comA, `/eventos/${deB.eventoId}/copiar`, orgA, corpo)).statusCode,
    ).toBe(404)
    expect(
      (await req('POST', comB, `/eventos/${v['ultimoJovem']}/copiar`, orgB, corpo)).statusCode,
    ).toBe(404)
    expect((await b.su.query('select count(*)::int as n from uj.eventos')).rows[0].n).toBe(antes)
  })
})

describe('convocar várias pessoas de uma vez', () => {
  let rascunho: string
  let louvor: string

  beforeAll(async () => {
    const r = await req('POST', comA, '/eventos', orgA, {
      titulo: 'Sábado do lote',
      categoria: 'Programação de sábado',
      inicio: new Date(Date.now() + 20 * DIA).toISOString(),
      duracaoMin: 90,
    })
    rascunho = r.json().id
    const e = await req('POST', comA, `/eventos/${rascunho}/etapas`, orgA, {
      titulo: 'Louvor',
      duracaoMin: 20,
    })
    louvor = e.json().id
  })

  it('cria todas, aguardando resposta, e repetir não duplica (jaConvocadas)', async () => {
    const r = await req('POST', comA, `/eventos/${rascunho}/atribuicoes/lote`, orgA, {
      funcao: 'Bateria',
      etapaId: louvor,
      vinculoIds: [v['ana'], v['bruno'], v['ana']],
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().criadas).toHaveLength(2)
    expect(r.json().criadas.every((a: { estado: string }) => a.estado === 'pendente')).toBe(true)
    expect(r.json().jaConvocadas).toEqual([])

    const de_novo = await req('POST', comA, `/eventos/${rascunho}/atribuicoes/lote`, orgA, {
      funcao: 'Bateria',
      etapaId: louvor,
      vinculoIds: [v['ana'], v['camila']],
    })
    expect(de_novo.statusCode).toBe(200)
    expect(de_novo.json().criadas).toEqual([
      expect.objectContaining({ vinculoId: v['camila'], estado: 'pendente' }),
    ])
    expect(de_novo.json().jaConvocadas).toEqual([v['ana']])
    expect(
      (
        await b.su.query('select count(*)::int as n from uj.atribuicoes where evento_id = $1', [
          rascunho,
        ])
      ).rows[0].n,
    ).toBe(3)
    // Rascunho: ninguém é avisado ainda.
    const avisadas = await b.su.query(
      `select 1 from uj.notificacoes n join uj.atribuicoes a on a.id = n.recurso_id
        where a.evento_id = $1`,
      [rascunho],
    )
    expect(avisadas.rowCount).toBe(0)
  })

  it('a mesma pessoa em OUTRO bloco ou com OUTRA função é permitida; a mesma combinação não (sem acento nem caixa)', async () => {
    const r = await req('POST', comA, '/eventos', orgA, {
      titulo: 'Sábado dos blocos',
      categoria: 'Programação de sábado',
      inicio: new Date(Date.now() + 21 * DIA).toISOString(),
      duracaoMin: 90,
    })
    const ev = r.json().id as string
    const etapa = (
      await req('POST', comA, `/eventos/${ev}/etapas`, orgA, { titulo: 'Louvor', duracaoMin: 20 })
    ).json().id as string
    const lote = (funcao: string, etapaId: string | null, ids: string[]) =>
      req('POST', comA, `/eventos/${ev}/atribuicoes/lote`, orgA, {
        funcao,
        etapaId,
        vinculoIds: ids,
      })

    // Já serve o encontro inteiro como integrante: convocar para a banda funciona.
    expect((await lote('integrante', null, [v['ana']!])).json().criadas).toHaveLength(1)
    const banda = (await lote('Violão', etapa, [v['ana']!])).json()
    expect(banda.criadas).toEqual([expect.objectContaining({ vinculoId: v['ana'] })])
    expect(banda.jaConvocadas).toEqual([])
    // Duas funções na banda para a mesma pessoa: permitido.
    const vocal = (await lote('Vocal', etapa, [v['ana']!])).json()
    expect(vocal.criadas).toHaveLength(1)
    expect(vocal.jaConvocadas).toEqual([])

    // A mesma combinação, escrita de outro jeito: não duplica e diz quem já estava.
    for (const igual of ['violao', 'VIOLÃO']) {
      const de_novo = (await lote(igual, etapa, [v['ana']!, v['bruno']!])).json()
      expect(de_novo.criadas).toEqual([expect.objectContaining({ vinculoId: v['bruno'] })])
      expect(de_novo.jaConvocadas).toEqual([v['ana']])
      await b.dono.query(
        'delete from uj.atribuicoes where evento_id = $1 and vinculo_id = $2 and funcao = $3',
        [ev, v['bruno'], igual],
      )
    }
    // "voz" e "Vocal" são a mesma função da banda.
    expect((await lote('voz', etapa, [v['ana']!])).json().jaConvocadas).toEqual([v['ana']])
    expect(
      (
        await b.su.query(
          'select count(*)::int as n from uj.atribuicoes where evento_id = $1 and vinculo_id = $2',
          [ev, v['ana']],
        )
      ).rows[0].n,
    ).toBe(3)
  })

  it('em encontro publicado, cada pessoa recebe a convocação', async () => {
    const r = await req('POST', comA, `/eventos/${v['copia']}/atribuicoes/lote`, orgA, {
      funcao: 'Som',
      vinculoIds: [v['camila'], v['davi']],
    })
    expect(r.statusCode).toBe(200)
    expect(await notificacoesDe(camila.id, 'Nova convocação')).toHaveLength(1)
    expect(await notificacoesDe(davi.id, 'Nova convocação')).toHaveLength(1)
  })

  it('uma pessoa de outra comunidade derruba o lote inteiro (404), sem gravar nada', async () => {
    const deB = await pessoaComSessao(b, app, config, 'Pessoa de B')
    const vB = await vincular(b, deB.id, comB, 'membro')
    const antes = (
      await b.su.query('select count(*)::int as n from uj.atribuicoes where evento_id = $1', [
        rascunho,
      ])
    ).rows[0].n
    const r = await req('POST', comA, `/eventos/${rascunho}/atribuicoes/lote`, orgA, {
      funcao: 'Violão',
      vinculoIds: [v['davi'], vB],
    })
    expect(r.statusCode).toBe(404)
    expect(
      (
        await b.su.query('select count(*)::int as n from uj.atribuicoes where evento_id = $1', [
          rascunho,
        ])
      ).rows[0].n,
    ).toBe(antes)
  })

  it('etapa de outro encontro é 404; quem saiu é 404; validações de corpo são 400', async () => {
    const outro = await encontroRealizado(comA, 'Outro encontro', sabadoPassado(1), orgA)
    const r = await req('POST', comA, `/eventos/${rascunho}/atribuicoes/lote`, orgA, {
      funcao: 'Violão',
      etapaId: outro.louvorId,
      vinculoIds: [v['davi']],
    })
    expect(r.statusCode).toBe(404)
    await b.su.query("update uj.vinculos set estado = 'desativado' where id = $1", [v['mara']])
    const saiu = await req('POST', comA, `/eventos/${rascunho}/atribuicoes/lote`, orgA, {
      funcao: 'Violão',
      vinculoIds: [v['mara']],
    })
    expect(saiu.statusCode).toBe(404)
    await b.su.query("update uj.vinculos set estado = 'ativo' where id = $1", [v['mara']])
    for (const corpo of [
      { funcao: 'Violão', vinculoIds: [] },
      { funcao: 'V', vinculoIds: [v['davi']] },
      { funcao: 'Violão', vinculoIds: ['nao-e-uuid'] },
      { funcao: 'Violão', vinculoIds: Array.from({ length: 31 }, () => v['davi']) },
    ]) {
      const ruim = await req('POST', comA, `/eventos/${rascunho}/atribuicoes/lote`, orgA, corpo)
      expect(ruim.statusCode, JSON.stringify(corpo).slice(0, 60)).toBe(400)
    }
  })

  it('permissão e isolamento: membro 403; organizador de B 404', async () => {
    const corpo = { funcao: 'Violão', vinculoIds: [v['davi']] }
    expect(
      (await req('POST', comA, `/eventos/${rascunho}/atribuicoes/lote`, membroA, corpo)).statusCode,
    ).toBe(403)
    expect(
      (await req('POST', comA, `/eventos/${rascunho}/atribuicoes/lote`, orgB, corpo)).statusCode,
    ).toBe(404)
    expect(
      (await req('POST', comB, `/eventos/${rascunho}/atribuicoes/lote`, orgB, corpo)).statusCode,
    ).toBe(404)
  })
})

describe('sugestões por função', () => {
  let alvo: string

  beforeAll(async () => {
    // Histórico: Marcos tocou bateria 3 vezes, Léo 1; Ana tocou violão.
    const marcos = await pessoaComSessao(b, app, config, 'Marcos')
    const leo = await pessoaComSessao(b, app, config, 'Léo')
    v['marcos'] = await vincular(b, marcos.id, comA, 'membro')
    v['leo'] = await vincular(b, leo.id, comA, 'membro')
    for (const semanas of [3, 4, 5]) {
      const e = await encontroRealizado(comA, `Histórico ${semanas}`, sabadoPassado(semanas), orgA)
      await convocarNoBanco(comA, e.eventoId, v['marcos']!, 'Bateria', null)
      if (semanas === 3) await convocarNoBanco(comA, e.eventoId, v['leo']!, 'bateria', null)
      if (semanas === 4) await convocarNoBanco(comA, e.eventoId, v['ana']!, 'Violão', null)
      if (semanas === 5)
        await convocarNoBanco(comA, e.eventoId, v['davi']!, 'Bateria', null, 'recusada')
    }
    const r = await req('POST', comA, '/eventos', orgA, {
      titulo: 'Sábado das sugestões',
      categoria: 'Programação de sábado',
      inicio: new Date(Date.now() + 25 * DIA).toISOString(),
      duracaoMin: 60,
    })
    alvo = r.json().id
  })

  it('quem serviu na função, mais vezes primeiro (sem acento nem caixa); recusa não conta', async () => {
    const r = await req(
      'GET',
      comA,
      `/eventos/${alvo}/sugestoes-de-convocacao?funcao=BATERIA`,
      orgA,
    )
    expect(r.statusCode).toBe(200)
    const j = r.json()
    expect(j.sugeridas.map((s: { nome: string }) => s.nome)).toEqual(['Marcos', 'Léo'])
    expect(j.sugeridas[0]).toMatchObject({ vezes: 3, disponivelNoDia: null })
    expect(j.indisponiveis).toEqual([])
    expect(j.jaConvocadas).toEqual([])
    expect(j.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('disponibilidade do dia: quem pode sobe, quem não pode sai e vem em indisponiveis', async () => {
    const { data } = (
      await req('GET', comA, `/eventos/${alvo}/sugestoes-de-convocacao?funcao=Bateria`, orgA)
    ).json() as { data: string }
    await b.dono.query(
      `insert into uj.disponibilidades (comunidade_id, vinculo_id, data, disponivel)
       values ($1, $2, $4, true), ($1, $3, $4, false), ($1, $5, $4, true)`,
      [comA, v['leo'], v['marcos'], data, v['camila']],
    )
    const r = await req(
      'GET',
      comA,
      `/eventos/${alvo}/sugestoes-de-convocacao?funcao=Bateria`,
      orgA,
    )
    const j = r.json()
    // Léo serviu e pode (primeiro); Marcos pediu folga (sai); Camila nunca tocou, mas pode (depois).
    expect(j.sugeridas.map((s: { nome: string }) => s.nome)).toEqual(['Léo', 'Camila'])
    expect(j.sugeridas[0]).toMatchObject({ disponivelNoDia: true, vezes: 1 })
    expect(j.sugeridas[1]).toMatchObject({ disponivelNoDia: true, vezes: 0 })
    expect(j.indisponiveis).toEqual([
      expect.objectContaining({ nome: 'Marcos', vinculoId: v['marcos'] }),
    ])
  })

  it('quem já está convocado na função não é sugerido de novo', async () => {
    await req('POST', comA, `/eventos/${alvo}/atribuicoes/lote`, orgA, {
      funcao: 'Bateria',
      vinculoIds: [v['leo']],
    })
    const j = (
      await req('GET', comA, `/eventos/${alvo}/sugestoes-de-convocacao?funcao=bateria`, orgA)
    ).json()
    expect(j.sugeridas.map((s: { nome: string }) => s.nome)).toEqual(['Camila'])
    expect(j.jaConvocadas).toEqual([v['leo']])
  })

  it('com etapaId, só conta quem já está NESSE bloco; estar em outro não exclui', async () => {
    const etapa = (
      await req('POST', comA, `/eventos/${alvo}/etapas`, orgA, { titulo: 'Louvor', duracaoMin: 20 })
    ).json().id as string
    // Léo já está convocado na bateria do encontro inteiro (sem etapa), do teste anterior.
    const geral = (
      await req(
        'GET',
        comA,
        `/eventos/${alvo}/sugestoes-de-convocacao?funcao=bateria&etapaId=geral`,
        orgA,
      )
    ).json()
    expect(geral.jaConvocadas).toEqual([v['leo']])
    const noLouvor = (
      await req(
        'GET',
        comA,
        `/eventos/${alvo}/sugestoes-de-convocacao?funcao=bateria&etapaId=${etapa}`,
        orgA,
      )
    ).json()
    expect(noLouvor.jaConvocadas).toEqual([])
    expect(noLouvor.sugeridas.map((s: { nome: string }) => s.nome)).toContain('Léo')
    // Bloco que não é uuid nem 'geral': 400.
    expect(
      (
        await req(
          'GET',
          comA,
          `/eventos/${alvo}/sugestoes-de-convocacao?funcao=bateria&etapaId=x`,
          orgA,
        )
      ).statusCode,
    ).toBe(400)
  })

  it('função obrigatória (400), membro 403 e encontro de outra comunidade 404 mesmo sem função', async () => {
    expect(
      (await req('GET', comA, `/eventos/${alvo}/sugestoes-de-convocacao`, orgA)).statusCode,
    ).toBe(400)
    expect(
      (await req('GET', comA, `/eventos/${alvo}/sugestoes-de-convocacao?funcao=Bateria`, membroA))
        .statusCode,
    ).toBe(403)
    expect(
      (await req('GET', comA, `/eventos/${alvo}/sugestoes-de-convocacao?funcao=Bateria`, orgB))
        .statusCode,
    ).toBe(404)
    expect(
      (await req('GET', comB, `/eventos/${alvo}/sugestoes-de-convocacao?funcao=Bateria`, orgB))
        .statusCode,
    ).toBe(404)
    expect(
      (await req('GET', comA, `/eventos/${v['ultimoJovem']}/sugestoes-de-convocacao`, orgB))
        .statusCode,
    ).toBe(404)
  })

  it('a disponibilidade de outra comunidade nunca entra', async () => {
    const deB = await pessoaComSessao(b, app, config, 'Dona da folga em B')
    const vB = await vincular(b, deB.id, comB, 'membro')
    const { data } = (
      await req('GET', comA, `/eventos/${alvo}/sugestoes-de-convocacao?funcao=Bateria`, orgA)
    ).json() as { data: string }
    await b.dono.query(
      `insert into uj.disponibilidades (comunidade_id, vinculo_id, data, disponivel)
       values ($1, $2, $3, true)`,
      [comB, vB, data],
    )
    const j = (
      await req('GET', comA, `/eventos/${alvo}/sugestoes-de-convocacao?funcao=Bateria`, orgA)
    ).json()
    expect(JSON.stringify(j)).not.toContain('Dona da folga')
  })
})

describe('"Lembrar os N": quem não respondeu', () => {
  let evento: string

  async function novoPublicado(titulo: string): Promise<string> {
    const r = await req('POST', comA, '/eventos', orgA, {
      titulo,
      categoria: 'Programação de sábado',
      inicio: new Date(Date.now() + 9 * DIA).toISOString(),
      duracaoMin: 90,
    })
    const id = r.json().id as string
    await req('POST', comA, `/eventos/${id}/status`, orgA, { status: 'publicado' })
    return id
  }

  beforeAll(async () => {
    evento = await novoPublicado('Sábado do lembrete (título secreto)')
    for (const [vinculo, estado] of [
      [v['ana'], 'pendente'],
      [v['bruno'], 'pendente'],
      [v['camila'], 'confirmada'],
      [v['davi'], 'recusada'],
    ] as const) {
      await convocarNoBanco(comA, evento, vinculo!, 'Recepção', null, estado)
    }
    // Quem pede o lembrete também está pendente: não conta nem é avisada.
    await convocarNoBanco(comA, evento, v['org']!, 'Coordenação', null, 'pendente')
  })

  it('avisa só quem está pendente, com texto genérico (sem nome, título, função ou data)', async () => {
    const r = await req('POST', comA, `/eventos/${evento}/lembrar-pendentes`, orgA)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ pendentes: 2, lembradas: 2, jaLembradas: 0 })
    for (const p of [ana, bruno]) {
      const n = await notificacoesDe(p.id, 'Falta responder')
      expect(n).toHaveLength(1)
      expect(n[0]!.recurso_id).toBe(evento)
      expect(n[0]!.corpo).toBe(
        'Você ainda não respondeu a uma convocação. Abra o app para responder.',
      )
      expect(JSON.stringify(n)).not.toMatch(/secreto|Recepção|Ana|Bruno|sábado/i)
    }
    for (const p of [camila, davi, orgA, membroA]) {
      expect(await notificacoesDe(p.id, 'Falta responder')).toHaveLength(0)
    }
    const { rows } = await b.su.query<{ detalhes: Record<string, unknown> }>(
      `select detalhes from uj.auditoria where acao = 'convocacao.lembrete_enviado' and recurso_id = $1`,
      [evento],
    )
    expect(rows[0]!.detalhes).toEqual({ pendentes: 2, lembradas: 2 })
  })

  it('no máximo uma por pessoa e por encontro a cada 24 h', async () => {
    const r = await req('POST', comA, `/eventos/${evento}/lembrar-pendentes`, orgA)
    expect(r.json()).toEqual({ pendentes: 2, lembradas: 0, jaLembradas: 2 })
    expect(await notificacoesDe(ana.id, 'Falta responder')).toHaveLength(1)

    // Passadas 24 h, pode lembrar de novo.
    await b.su.query(
      `update uj.notificacoes set criado_em = now() - interval '25 hours',
              chave_dedup = chave_dedup || ':antiga' where titulo = 'Falta responder'`,
    )
    const depois = await req('POST', comA, `/eventos/${evento}/lembrar-pendentes`, orgA)
    expect(depois.json()).toEqual({ pendentes: 2, lembradas: 2, jaLembradas: 0 })
    expect(await notificacoesDe(ana.id, 'Falta responder')).toHaveLength(2)
  })

  it('respeita a preferência de aviso de convocações da pessoa', async () => {
    const e2 = await novoPublicado('Sábado das preferências')
    await convocarNoBanco(comA, e2, v['ana']!, 'Som', null, 'pendente')
    await convocarNoBanco(comA, e2, v['bruno']!, 'Som', null, 'pendente')
    await b.dono.query(
      `insert into uj.preferencias_notificacao (comunidade_id, conta_id, tipo, ativo)
       values ($1, $2, 'escalas', false)`,
      [comA, bruno.id],
    )
    const r = await req('POST', comA, `/eventos/${e2}/lembrar-pendentes`, orgA)
    expect(r.json()).toEqual({ pendentes: 2, lembradas: 1, jaLembradas: 0 })
    const para = (
      await b.su.query<{ conta_id: string }>(
        `select conta_id from uj.notificacoes where recurso_id = $1 and titulo = 'Falta responder'`,
        [e2],
      )
    ).rows.map((x) => x.conta_id)
    expect(para).toEqual([ana.id])
  })

  it('o lembrete vai à fila de envio dos aparelhos da pessoa (um envio por aparelho)', async () => {
    const e3 = await novoPublicado('Sábado do aparelho')
    await convocarNoBanco(comA, e3, v['camila']!, 'Som', null, 'pendente')
    const familia = (
      await b.su.query<{ familia: string }>(
        'select familia from uj.sessoes where conta_id = $1 limit 1',
        [camila.id],
      )
    ).rows[0]!.familia
    await b.su.query(
      `insert into uj.aparelhos_push (conta_id, familia, plataforma, token)
       values ($1, $2, 'android', 'token-de-teste-camila-0001')`,
      [camila.id, familia],
    )
    const r = await req('POST', comA, `/eventos/${e3}/lembrar-pendentes`, orgA)
    expect(r.json().lembradas).toBe(1)
    const envios = await b.su.query(
      `select e.estado from uj.envios_push e join uj.notificacoes n on n.id = e.notificacao_id
        where n.recurso_id = $1 and n.titulo = 'Falta responder'`,
      [e3],
    )
    expect(envios.rows).toEqual([{ estado: 'pendente' }])
  })

  it('rascunho ou encontro que já terminou: 409; sem pendentes: zeros', async () => {
    const r = await req('POST', comA, '/eventos', orgA, {
      titulo: 'Rascunho do lembrete',
      categoria: 'Outra',
      inicio: new Date(Date.now() + 5 * DIA).toISOString(),
      duracaoMin: 60,
    })
    const rascunho = await req('POST', comA, `/eventos/${r.json().id}/lembrar-pendentes`, orgA)
    expect(rascunho.statusCode).toBe(409)
    expect(rascunho.json().erro).toBe('encontro_fora_do_ar')
    const passado = await req('POST', comA, `/eventos/${v['ultimoJovem']}/lembrar-pendentes`, orgA)
    expect(passado.statusCode).toBe(409)

    const vazio = await novoPublicado('Sem pendentes')
    const nada = await req('POST', comA, `/eventos/${vazio}/lembrar-pendentes`, orgA)
    expect(nada.json()).toEqual({ pendentes: 0, lembradas: 0, jaLembradas: 0 })
  })

  it('permissão e isolamento: membro 403; B 404; id de B nunca vaza', async () => {
    expect(
      (await req('POST', comA, `/eventos/${evento}/lembrar-pendentes`, membroA)).statusCode,
    ).toBe(403)
    expect((await req('POST', comA, `/eventos/${evento}/lembrar-pendentes`, orgB)).statusCode).toBe(
      404,
    )
    expect((await req('POST', comB, `/eventos/${evento}/lembrar-pendentes`, orgB)).statusCode).toBe(
      404,
    )
    const deB = await encontroRealizado(comB, 'Encontro de B', new Date(Date.now() + 3 * DIA), orgB)
    expect(
      (await req('POST', comA, `/eventos/${deB.eventoId}/lembrar-pendentes`, orgA)).statusCode,
    ).toBe(404)
  })

  it('banco: a função recusa quem não é organização e encontro de outra comunidade (RLS)', async () => {
    await expect(
      b.comoApi(
        { contaId: membroA.id, comunidadeId: comA },
        'select * from uj.lembrar_pendentes($1, false)',
        [evento],
      ),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      b.comoApi(
        { contaId: orgB.id, comunidadeId: comB },
        'select * from uj.lembrar_pendentes($1, false)',
        [evento],
      ),
    ).rejects.toMatchObject({ code: 'UJ101' })
    // Simular não enfileira nada.
    const antes = (await b.su.query('select count(*)::int as n from uj.notificacoes')).rows[0].n
    const sim = await b.comoApi<{ pendentes: number; lembraveis: number }>(
      { contaId: orgA.id, comunidadeId: comA },
      'select * from uj.lembrar_pendentes($1, true)',
      [evento],
    )
    expect(sim[0]).toMatchObject({ pendentes: 2 })
    expect((await b.su.query('select count(*)::int as n from uj.notificacoes')).rows[0].n).toBe(
      antes,
    )
  })
})

/** A próxima data (AAAA-MM-DD) que cai no dia da semana pedido (0 = domingo), de 8 a 14 dias à frente. */
function proximaDataDoDia(diaDaSemana: number): string {
  const d = new Date(Date.now() + 8 * DIA)
  while (d.getUTCDay() !== diaDaSemana) d.setTime(d.getTime() + DIA)
  return d.toISOString().slice(0, 10)
}

describe('"Igual ao último encontro": o título combina com o dia (D78)', () => {
  it('"Sábado" copiado para um domingo ou uma quarta vira "Domingo" e "Quarta"', async () => {
    const { eventoId } = await encontroRealizado(comA, 'Sábado', sabadoPassado(3), orgA)
    const domingo = await req('POST', comA, `/eventos/${eventoId}/copiar`, orgA, {
      data: proximaDataDoDia(0),
    })
    expect(domingo.statusCode).toBe(200)
    expect(domingo.json().titulo).toBe('Domingo')
    const quarta = await req('POST', comA, `/eventos/${eventoId}/copiar`, orgA, {
      data: proximaDataDoDia(3),
    })
    expect(quarta.json().titulo).toBe('Quarta')
    const gravados = (
      await b.su.query<{ titulo: string }>('select titulo from uj.eventos where id = any ($1)', [
        [domingo.json().id, quarta.json().id],
      ])
    ).rows.map((e) => e.titulo)
    expect(gravados.sort()).toEqual(['Domingo', 'Quarta'])
  })

  it('o mesmo dia da semana mantém o título, e o título que a pessoa escreveu nunca muda', async () => {
    const dia = await encontroRealizado(comA, 'Sábado', sabadoPassado(5), orgA)
    const igual = await req('POST', comA, `/eventos/${dia.eventoId}/copiar`, orgA, {
      data: proximaDataDoDia(6),
    })
    expect(igual.json().titulo).toBe('Sábado')

    const escrito = await encontroRealizado(comA, 'Sábado Jovem do Vale', sabadoPassado(6), orgA)
    const emDomingo = await req('POST', comA, `/eventos/${escrito.eventoId}/copiar`, orgA, {
      data: proximaDataDoDia(0),
    })
    expect(emDomingo.json().titulo).toBe('Sábado Jovem do Vale')
    expect(
      (
        await b.su.query<{ titulo: string }>('select titulo from uj.eventos where id = $1', [
          emDomingo.json().id,
        ])
      ).rows[0]!.titulo,
    ).toBe('Sábado Jovem do Vale')
  })

  it('sem data pedida, a data sugerida decide o título (o dia da semana da origem)', async () => {
    const { eventoId } = await encontroRealizado(comA, 'Sábado', sabadoPassado(7), orgA)
    const r = await req('POST', comA, `/eventos/${eventoId}/copiar`, orgA, {})
    expect(r.json().titulo).toBe('Sábado')
  })
})
