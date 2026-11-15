import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { materializarTodas } from '../../src/rotas/series.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let org: Pessoa
let vinculoDoOrg: string

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, caminho: string, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: org.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

async function porStatus(serieId: string): Promise<Record<string, number>> {
  const { rows } = await b.su.query<{ status: string; n: number }>(
    'select status, count(*)::int as n from uj.eventos where serie_id = $1 group by status',
    [serieId],
  )
  return Object.fromEntries(rows.map((r) => [r.status, r.n]))
}

/** Próximo sábado (data local de São Paulo) a partir de hoje, com folga de uma semana. */
function sabadoFuturo(semanas = 1): string {
  const hoje = new Date()
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7) + 7 * semanas)
  return d.toISOString().slice(0, 10)
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
  com = await criarComunidade(b, 'Jovens Central')
  org = await pessoaComSessao(b, app, config, 'Organizadora')
  vinculoDoOrg = await vincular(b, org.id, com, 'organizador')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

async function criarSerie(
  o: { publicar?: boolean; fimEm?: string } = {},
): Promise<{ id: string; ocorrencias: number }> {
  const r = await req('POST', '/series', {
    regra: { frequencia: 'semanal', intervaloSemanas: 1, diasDaSemana: [6] },
    horaLocal: '16:00',
    inicioEm: sabadoFuturo(),
    titulo: 'Programação de sábado',
    categoria: 'Programação de sábado',
    modelo: 'sabado_padrao',
    publicar: o.publicar ?? true,
    ...(o.fimEm ? { fimEm: o.fimEm } : {}),
  })
  expect(r.statusCode).toBe(200)
  return r.json()
}

async function ocorrencias(serieId: string) {
  return (
    await b.su.query<{
      id: string
      inicio: Date
      titulo: string
      editado: boolean
      serie_id: string
    }>(
      `select id, inicio, titulo, editado_individualmente as editado, serie_id
         from uj.eventos where serie_id = $1 or id in (select id from uj.eventos where serie_id = $1)
        order by inicio`,
      [serieId],
    )
  ).rows
}

describe('séries recorrentes', () => {
  it('cria ~6 meses de sábados às 16h locais (19h UTC), com etapas do modelo, sem duplicar', async () => {
    const s = await criarSerie()
    expect(s.ocorrencias).toBeGreaterThanOrEqual(25)
    expect(s.ocorrencias).toBeLessThanOrEqual(27)
    const occ = await ocorrencias(s.id)
    expect(occ.every((o) => o.inicio.getUTCHours() === 19 && o.inicio.getUTCDay() === 6)).toBe(true)
    const etapas = await b.su.query(
      'select count(*)::int as n from uj.etapas where evento_id = $1',
      [occ[0]!.id],
    )
    expect(etapas.rows).toEqual([{ n: 7 }])
    // Rodar o job de novo não cria nada (índice único por data original).
    expect(await materializarTodas(b.dono)).toBe(0)
  })

  it('"esta ocorrência": editar uma não altera as outras, e a série não a sobrescreve', async () => {
    const s = await criarSerie()
    const occ = await ocorrencias(s.id)
    const alvo = occ[1]!
    const versao = (await req('GET', `/eventos/${alvo.id}`)).json().versao
    expect(
      (await req('PATCH', `/eventos/${alvo.id}`, { versao, titulo: 'Sábado especial' })).statusCode,
    ).toBe(200)
    const depois = await ocorrencias(s.id)
    expect(depois.filter((o) => o.titulo === 'Sábado especial').map((o) => o.id)).toEqual([alvo.id])
    // Mudança em toda a série: as outras mudam, a editada não.
    const vs = (await req('GET', `/series/${s.id}`)).json().versao
    const r = await req('PATCH', `/series/${s.id}`, {
      versao: vs,
      escopo: 'serie',
      mudancas: { titulo: 'Sábado jovem' },
    })
    expect(r.statusCode).toBe(200)
    const final = await ocorrencias(s.id)
    expect(final.find((o) => o.id === alvo.id)!.titulo).toBe('Sábado especial')
    expect(final.filter((o) => o.id !== alvo.id).every((o) => o.titulo === 'Sábado jovem')).toBe(
      true,
    )
  })

  it('mexer nas etapas de uma ocorrência também a separa da série', async () => {
    const s = await criarSerie()
    const alvo = (await ocorrencias(s.id))[0]!
    await req('POST', `/eventos/${alvo.id}/etapas`, { titulo: 'Testemunho', duracaoMin: 5 })
    const { rows } = await b.su.query(
      'select editado_individualmente from uj.eventos where id = $1',
      [alvo.id],
    )
    expect(rows).toEqual([{ editado_individualmente: true }])
  })

  it('"esta e as futuras": divide a série na data escolhida', async () => {
    const s = await criarSerie()
    const occ = await ocorrencias(s.id)
    const corte = occ[3]!
    const vs = (await req('GET', `/series/${s.id}`)).json().versao
    const r = await req('PATCH', `/series/${s.id}`, {
      versao: vs,
      escopo: 'a_partir_de',
      aPartirDoEvento: corte.id,
      mudancas: { titulo: 'Novo formato' },
    })
    expect(r.statusCode).toBe(200)
    const novaSerie = r.json().serieId as string
    expect(novaSerie).not.toBe(s.id)
    const antigas = (
      await b.su.query('select titulo from uj.eventos where serie_id = $1 order by inicio', [s.id])
    ).rows
    expect(antigas).toHaveLength(3)
    expect(antigas.every((o: { titulo: string }) => o.titulo === 'Programação de sábado')).toBe(
      true,
    )
    const novas = (
      await b.su.query('select titulo from uj.eventos where serie_id = $1', [novaSerie])
    ).rows
    expect(novas.length).toBeGreaterThan(10)
    expect(novas.every((o: { titulo: string }) => o.titulo === 'Novo formato')).toBe(true)
  })

  it('mudar o horário recria as futuras; com escala, pede confirmação antes', async () => {
    const s = await criarSerie()
    const occ = await ocorrencias(s.id)
    await req('POST', `/eventos/${occ[2]!.id}/atribuicoes`, {
      vinculoId: vinculoDoOrg,
      funcao: 'louvor',
    })
    const vs = (await req('GET', `/series/${s.id}`)).json().versao
    const semConfirmar = await req('PATCH', `/series/${s.id}`, {
      versao: vs,
      escopo: 'serie',
      mudancas: { horaLocal: '17:00' },
    })
    expect(semConfirmar.statusCode).toBe(409)
    expect(semConfirmar.json().erro).toBe('confirmar_recriacao')
    const ok = await req('PATCH', `/series/${s.id}`, {
      versao: vs,
      escopo: 'serie',
      mudancas: { horaLocal: '17:00' },
      confirmarRecriacao: true,
    })
    expect(ok.statusCode).toBe(200)
    const depois = await ocorrencias(s.id)
    expect(depois.length).toBeGreaterThan(20)
    expect(depois.every((o) => o.inicio.getUTCHours() === 20)).toBe(true)
  })

  it('versão antiga da série recebe 409', async () => {
    const s = await criarSerie()
    const r = await req('PATCH', `/series/${s.id}`, {
      versao: 99,
      escopo: 'serie',
      mudancas: { titulo: 'X x' },
    })
    expect(r.statusCode).toBe(409)
  })

  it('encerrar a partir de uma data cancela as publicadas com motivo', async () => {
    const s = await criarSerie()
    const r = await req('POST', `/series/${s.id}/encerrar`, {
      aPartirDe: sabadoFuturo(5),
      motivo: 'Férias de fim de ano',
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().cancelados).toBeGreaterThan(10)
    const ativos = await b.su.query(
      "select count(*)::int as n from uj.eventos where serie_id = $1 and status = 'publicado'",
      [s.id],
    )
    expect(ativos.rows[0].n).toBeLessThanOrEqual(5)
  })

  it('encerrar a partir do primeiro dia: a série fica encerrada e não ganha ocorrência nova (A2)', async () => {
    const s = await criarSerie()
    const r = await req('POST', `/series/${s.id}/encerrar`, {
      aPartirDe: sabadoFuturo(),
      motivo: 'Fim do projeto',
    })
    // Antes: 400, porque fim_em = véspera do início violava o CHECK da série.
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ apagados: 0, cancelados: s.ocorrencias, estado: 'encerrada' })
    expect(await porStatus(s.id)).toEqual({ cancelado: s.ocorrencias })
    const motivos = await b.su.query(
      'select distinct motivo_status from uj.eventos where serie_id = $1',
      [s.id],
    )
    expect(motivos.rows).toEqual([{ motivo_status: 'Fim do projeto' }])
    const lida = (await req('GET', `/series/${s.id}`)).json()
    expect(lida.estado).toBe('encerrada')
    expect(lida.encerrada_em).toBeTruthy()

    // O job não recria nada; editar e encerrar de novo recebem explicação.
    await materializarTodas(b.dono)
    expect(await porStatus(s.id)).toEqual({ cancelado: s.ocorrencias })
    const editar = await req('PATCH', `/series/${s.id}`, {
      versao: lida.versao,
      escopo: 'serie',
      mudancas: { titulo: 'Volta' },
    })
    expect(editar.statusCode).toBe(409)
    expect(editar.json().erro).toBe('serie_encerrada')
    const deNovo = await req('POST', `/series/${s.id}/encerrar`, {
      aPartirDe: sabadoFuturo(),
      motivo: 'De novo',
    })
    expect(deNovo.json().erro).toBe('serie_encerrada')
    // O banco também segura: nem o dono pendura ocorrência numa série encerrada,
    // e a série não volta a ficar ativa.
    await expect(
      b.dono.query(
        `insert into uj.eventos (comunidade_id, serie_id, titulo, categoria, inicio, duracao_min, fuso, criado_por)
         values ($1, $2, 'Fura', 'Outra', now() + interval '30 days', 60, 'America/Sao_Paulo', $3)`,
        [com, s.id, org.id],
      ),
    ).rejects.toMatchObject({ code: 'UJ070' })
    await expect(
      b.dono.query("update uj.series set estado = 'ativa', encerrada_em = null where id = $1", [
        s.id,
      ]),
    ).rejects.toMatchObject({ code: 'UJ070' })
  })

  it('encerrar ANTES do primeiro dia também encerra a série inteira, e rascunhos somem', async () => {
    const s = await criarSerie({ publicar: false })
    const r = await req('POST', `/series/${s.id}/encerrar`, {
      aPartirDe: somarDias(sabadoFuturo(), -10),
      motivo: 'Mudou o plano',
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ apagados: s.ocorrencias, cancelados: 0, estado: 'encerrada' })
    expect(await porStatus(s.id)).toEqual({})
  })

  it('encerrar no meio só encurta, e nunca estende o fim já marcado', async () => {
    // Do sábado da semana 1 ao da semana 3: três ocorrências.
    const curta = await criarSerie({ fimEm: sabadoFuturo(3) })
    expect(curta.ocorrencias).toBe(3)
    const depois = await req('POST', `/series/${curta.id}/encerrar`, {
      aPartirDe: sabadoFuturo(10),
      motivo: 'Depois do fim',
    })
    expect(depois.statusCode).toBe(200)
    expect(depois.json()).toEqual({ apagados: 0, cancelados: 0, estado: 'ativa' })
    const fim = async () =>
      (
        await b.su.query<{ f: string }>(
          "select to_char(fim_em, 'YYYY-MM-DD') as f from uj.series where id = $1",
          [curta.id],
        )
      ).rows[0]!.f
    expect(await fim()).toBe(sabadoFuturo(3))
    const meio = await req('POST', `/series/${curta.id}/encerrar`, {
      aPartirDe: sabadoFuturo(2),
      motivo: 'Encurtar',
    })
    expect(meio.json()).toEqual({ apagados: 0, cancelados: 2, estado: 'ativa' })
    expect(await fim()).toBe(somarDias(sabadoFuturo(2), -1))
    expect(await porStatus(curta.id)).toEqual({ publicado: 1, cancelado: 2 })
  })

  it('excluir série: só sem ocorrência publicada; com publicada, 409 e nada some (A2)', async () => {
    const rascunho = await criarSerie({ publicar: false })
    const ok = await req('DELETE', `/series/${rascunho.id}`)
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual({ ok: true, apagados: rascunho.ocorrencias })
    expect((await b.su.query('select 1 from uj.series where id = $1', [rascunho.id])).rows).toEqual(
      [],
    )
    expect(await porStatus(rascunho.id)).toEqual({})
    expect((await req('DELETE', `/series/${rascunho.id}`)).statusCode).toBe(404)
    const auditoria = await b.su.query(
      "select detalhes from uj.auditoria where acao = 'serie.excluida' and recurso_id = $1",
      [rascunho.id],
    )
    expect(auditoria.rows).toEqual([{ detalhes: { ocorrencias: rascunho.ocorrencias } }])

    // Uma ocorrência publicada basta para recusar; os rascunhos ficam onde estavam.
    const mista = await criarSerie({ publicar: false })
    const alvo = (await ocorrencias(mista.id))[0]!
    expect(
      (await req('POST', `/eventos/${alvo.id}/status`, { status: 'publicado' })).statusCode,
    ).toBe(200)
    const recusa = await req('DELETE', `/series/${mista.id}`)
    expect(recusa.statusCode).toBe(409)
    expect(recusa.json().erro).toBe('serie_com_publicadas')
    expect(await porStatus(mista.id)).toEqual({
      publicado: 1,
      rascunho: mista.ocorrencias - 1,
    })
  })
})
