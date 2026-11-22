import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { DIAS_DE_CARENCIA_DA_EXCLUSAO_DA_COMUNIDADE } from '@uj/dominio'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * D77: limpar os próximos encontros e excluir a comunidade (carência de 30 dias), no
 * Postgres de verdade: rotas, matriz, RLS, gatilhos, auditoria e a rotina que apaga.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>

type Metodo = 'GET' | 'POST' | 'DELETE'
const pedir = (metodo: Metodo, url: string, quem: Pessoa, corpo?: object) =>
  app.inject({ method: metodo, url, headers: quem.auth, ...(corpo ? { payload: corpo } : {}) })

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await b.encerrar()
})

/** Evento inserido pelo dono do banco (o mesmo que os outros testes fazem para fixar o estado). */
async function evento(
  comunidade: string,
  criador: string,
  titulo: string,
  status: 'rascunho' | 'publicado' | 'adiado' | 'cancelado',
  quando: 'futuro' | 'passado',
): Promise<string> {
  const { rows } = await b.dono.query<{ id: string }>(
    `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
     values ($1, $2, 'Outra', now() ${quando === 'futuro' ? '+' : '-'} interval '10 days', 60,
             'America/Sao_Paulo', $3, $4) returning id`,
    [comunidade, titulo, criador, status],
  )
  return rows[0]!.id
}

async function eventosDe(comunidade: string): Promise<{ titulo: string; status: string }[]> {
  return (
    await b.su.query<{ titulo: string; status: string }>(
      'select titulo, status from uj.eventos where comunidade_id = $1 order by titulo',
      [comunidade],
    )
  ).rows
}

async function avisos(conta: string, tipo = 'alteracoes_importantes') {
  return (
    await b.su.query<{ titulo: string; corpo: string; comunidade_id: string }>(
      'select titulo, corpo, comunidade_id from uj.notificacoes where conta_id = $1 and tipo = $2 order by criado_em',
      [conta, tipo],
    )
  ).rows
}

describe('limpar os próximos encontros', () => {
  let com: string
  let outra: string
  let admin: Pessoa
  let org: Pessoa
  let membro: Pessoa
  let sozinha: Pessoa
  let eventoDoMembro: string

  async function montarAgenda() {
    await b.dono.query('delete from uj.eventos where comunidade_id in ($1, $2)', [com, outra])
    await b.dono.query('delete from uj.notificacoes')
    await evento(com, org.id, 'A rascunho', 'rascunho', 'futuro')
    eventoDoMembro = await evento(com, org.id, 'B publicado', 'publicado', 'futuro')
    await evento(com, org.id, 'C adiado', 'adiado', 'futuro')
    await evento(com, org.id, 'D cancelado', 'cancelado', 'futuro')
    await evento(com, org.id, 'E passado', 'publicado', 'passado')
    await evento(outra, sozinha.id, 'Z da outra', 'publicado', 'futuro')
    // O membro está escalado no publicado: é quem o cancelamento avisaria.
    const { rows } = await b.su.query<{ id: string }>(
      'select id from uj.vinculos where conta_id = $1 and comunidade_id = $2',
      [membro.id, com],
    )
    await b.dono.query(
      'insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id) values ($1, $2, $3)',
      [com, eventoDoMembro, rows[0]!.id],
    )
    await b.dono.query('delete from uj.notificacoes')
  }

  const url = (c: string) => `/api/v1/c/${c}/eventos/limpar-proximos`

  beforeAll(async () => {
    com = await criarComunidade(b, 'Jovens do Centro')
    outra = await criarComunidade(b, 'Outra comunidade')
    admin = await pessoaComSessao(b, app, config, 'Admin da limpeza')
    org = await pessoaComSessao(b, app, config, 'Organizadora da limpeza')
    membro = await pessoaComSessao(b, app, config, 'Membro da limpeza')
    sozinha = await pessoaComSessao(b, app, config, 'Admin da outra')
    await vincular(b, admin.id, com, 'admin')
    await vincular(b, org.id, com, 'organizador')
    await vincular(b, membro.id, com, 'membro')
    await vincular(b, sozinha.id, outra, 'admin')
  })

  it('a contagem separa os encontros por situação e conta só quem seria avisado', async () => {
    await montarAgenda()
    const r = await pedir('GET', url(com), org)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({
      total: 4,
      rascunhos: 1,
      publicados: 1,
      adiados: 1,
      cancelados: 1,
      encerrados: 0,
      // Só o membro escalado: quem organiza não conta e o encontro passado fica de fora.
      pessoasAAvisar: 1,
      repeticoesAtivas: 0,
    })
    // Quem limpa não conta como "avisada": o membro escalado é a única pessoa.
    const adminDoAdmin = await pedir('GET', url(com), admin)
    expect(adminDoAdmin.json().pessoasAAvisar).toBe(1)
  })

  it('só organização e administração limpam; membro, 403 (e sem nada alterado)', async () => {
    await montarAgenda()
    const corpo = { modo: 'apagar', confirmo: true, totalEsperado: 4 }
    expect((await pedir('GET', url(com), membro)).statusCode).toBe(403)
    expect((await pedir('POST', url(com), membro, corpo)).statusCode).toBe(403)
    expect(await eventosDe(com)).toHaveLength(5)
    for (const quem of [org, admin]) {
      await montarAgenda()
      expect((await pedir('POST', url(com), quem, corpo)).statusCode).toBe(200)
    }
  })

  it('apagar sem avisar: some tudo que é futuro, o passado e a outra comunidade ficam, e ninguém é avisado', async () => {
    await montarAgenda()
    const r = await pedir('POST', url(com), org, {
      modo: 'apagar',
      confirmo: true,
      totalEsperado: 4,
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({
      ok: true,
      modo: 'apagar',
      apagados: 4,
      cancelados: 0,
      pessoasAvisadas: 0,
    })
    expect((await eventosDe(com)).map((e) => e.titulo)).toEqual(['E passado'])
    expect((await eventosDe(outra)).map((e) => e.titulo)).toEqual(['Z da outra'])
    // Nada foi enfileirado para ninguém (apagar não muda status, que é o que avisa).
    expect(await avisos(membro.id)).toEqual([])
    // A escala do membro no encontro apagado sumiu junto (cascata), sem rastro.
    const { rows } = await b.su.query('select 1 from uj.atribuicoes where evento_id = $1', [
      eventoDoMembro,
    ])
    expect(rows).toEqual([])
    // Auditoria: modo e contagens, nunca título.
    const aud = await b.su.query<{ detalhes: Record<string, unknown> }>(
      "select detalhes from uj.auditoria where comunidade_id = $1 and acao = 'evento.proximos_limpos' order by momento desc limit 1",
      [com],
    )
    expect(aud.rows[0]!.detalhes).toEqual({
      modo: 'apagar',
      apagados: 4,
      cancelados: 0,
      pessoasAvisadas: 0,
    })
    expect(JSON.stringify(aud.rows[0])).not.toMatch(/A rascunho|B publicado|C adiado|D cancelado/)
  })

  it('cancelar e avisar: rascunho some, publicado e adiado viram cancelados e o membro escalado é avisado', async () => {
    await montarAgenda()
    const r = await pedir('POST', url(com), admin, {
      modo: 'cancelar_e_avisar',
      confirmo: true,
      totalEsperado: 4,
      motivo: 'Limpeza dos testes',
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({
      ok: true,
      modo: 'cancelar_e_avisar',
      apagados: 1,
      cancelados: 2,
      pessoasAvisadas: 1,
    })
    expect(await eventosDe(com)).toEqual([
      { titulo: 'B publicado', status: 'cancelado' },
      { titulo: 'C adiado', status: 'cancelado' },
      { titulo: 'D cancelado', status: 'cancelado' },
      { titulo: 'E passado', status: 'publicado' },
    ])
    const deMembro = await avisos(membro.id)
    expect(deMembro).toHaveLength(1)
    expect(deMembro[0]!.titulo).toBe('Encontro cancelado')
    // Quem limpa nunca avisa a si mesma.
    expect(await avisos(admin.id)).toEqual([])
    // O motivo vai para o encontro cancelado.
    const { rows } = await b.su.query<{ motivo_status: string }>(
      "select motivo_status from uj.eventos where titulo = 'B publicado'",
    )
    expect(rows[0]!.motivo_status).toBe('Limpeza dos testes')
  })

  it('é idempotente: repetir depois de limpar responde 200 com zeros', async () => {
    await montarAgenda()
    const corpo = { modo: 'apagar', confirmo: true, totalEsperado: 4 }
    expect((await pedir('POST', url(com), org, corpo)).statusCode).toBe(200)
    const de_novo = await pedir('POST', url(com), org, corpo)
    expect(de_novo.statusCode).toBe(200)
    expect(de_novo.json()).toEqual({
      ok: true,
      modo: 'apagar',
      apagados: 0,
      cancelados: 0,
      pessoasAvisadas: 0,
    })
  })

  it('se a agenda mudou depois da contagem, 409 e nada é apagado', async () => {
    await montarAgenda()
    const r = await pedir('POST', url(com), org, {
      modo: 'apagar',
      confirmo: true,
      totalEsperado: 3,
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toBe('agenda_mudou')
    expect(await eventosDe(com)).toHaveLength(5)
  })

  it('sem a confirmação ou sem o modo, 400', async () => {
    await montarAgenda()
    for (const corpo of [
      { modo: 'apagar', totalEsperado: 4 },
      { modo: 'apagar', confirmo: false, totalEsperado: 4 },
      { confirmo: true, totalEsperado: 4 },
      { modo: 'tudo', confirmo: true, totalEsperado: 4 },
    ]) {
      expect((await pedir('POST', url(com), org, corpo)).statusCode).toBe(400)
    }
    expect(await eventosDe(com)).toHaveLength(5)
  })

  it('a administração de outra comunidade recebe 404 e nada é apagado', async () => {
    await montarAgenda()
    const corpo = { modo: 'apagar', confirmo: true, totalEsperado: 4 }
    expect((await pedir('GET', url(com), sozinha)).statusCode).toBe(404)
    expect((await pedir('POST', url(com), sozinha, corpo)).statusCode).toBe(404)
    expect(await eventosDe(com)).toHaveLength(5)
    expect(await eventosDe(outra)).toHaveLength(1)
  })
})

describe('excluir a comunidade', () => {
  let com: string
  let outra: string
  let admin: Pessoa
  let outroAdmin: Pessoa
  let org: Pessoa
  let membro: Pessoa
  let deOutra: Pessoa
  let vinculoDoMembro: string

  const excluir = (quem: Pessoa, corpo: object = { nome: 'Jovens Excluíveis', confirmo: true }) =>
    pedir('POST', `/api/v1/c/${com}/excluir`, quem, corpo)
  const desfazer = (quem: Pessoa, c = com) =>
    pedir('POST', `/api/v1/c/${c}/exclusao/desfazer`, quem)
  const estado = async () =>
    (
      await b.su.query<{ estado: string; dias: number | null }>(
        `select estado, round(extract(epoch from exclusao_agendada_para - now()) / 86400)::int as dias
           from uj.comunidades where id = $1`,
        [com],
      )
    ).rows[0]

  beforeAll(async () => {
    com = await criarComunidade(b, 'Jovens Excluíveis')
    outra = await criarComunidade(b, 'Comunidade que fica')
    admin = await pessoaComSessao(b, app, config, 'Admin que exclui')
    outroAdmin = await pessoaComSessao(b, app, config, 'Segundo admin')
    org = await pessoaComSessao(b, app, config, 'Organizador da exclusao')
    membro = await pessoaComSessao(b, app, config, 'Membro da exclusao')
    deOutra = await pessoaComSessao(b, app, config, 'Admin de outra comunidade')
    await vincular(b, admin.id, com, 'admin')
    await vincular(b, outroAdmin.id, com, 'admin')
    await vincular(b, org.id, com, 'organizador')
    vinculoDoMembro = await vincular(b, membro.id, com, 'membro')
    // O membro também participa da outra comunidade: ela precisa continuar nas listas dele.
    await vincular(b, membro.id, outra, 'membro')
    await vincular(b, deOutra.id, outra, 'admin')
    // Dados nas duas comunidades.
    await evento(com, admin.id, 'Encontro que some', 'publicado', 'futuro')
    await evento(outra, deOutra.id, 'Encontro que fica', 'publicado', 'futuro')
    await b.dono.query(
      "insert into uj.avisos (comunidade_id, titulo, texto, estado, criado_por) values ($1, 'Aviso que some', 'Texto', 'publicado', $2)",
      [com, admin.id],
    )
    await b.dono.query('delete from uj.notificacoes')
  })

  it('organizador e membro recebem 403; a outra comunidade, 404; nada muda', async () => {
    expect((await excluir(org)).statusCode).toBe(403)
    expect((await excluir(membro)).statusCode).toBe(403)
    expect((await excluir(deOutra)).statusCode).toBe(404)
    expect((await estado())!.estado).toBe('ativa')
  })

  it('o administrador com o nome errado ou sem confirmar não exclui', async () => {
    const errado = await excluir(admin, { nome: 'Jovens', confirmo: true })
    expect(errado.statusCode).toBe(422)
    expect(errado.json().erro).toBe('confirmacao_necessaria')
    expect((await excluir(admin, { nome: 'Jovens Excluíveis' })).statusCode).toBe(400)
    expect((await excluir(admin, { nome: 'Jovens Excluíveis', confirmo: false })).statusCode).toBe(
      400,
    )
    expect((await estado())!.estado).toBe('ativa')
  })

  it('o aplicativo não muda o estado por UPDATE direto: só pelas funções (gatilho)', async () => {
    await expect(
      b.comoApi(
        { contaId: admin.id, comunidadeId: com },
        "update uj.comunidades set estado = 'exclusao_agendada', exclusao_agendada_para = now() + interval '30 days' where id = $1",
        [com],
      ),
    ).rejects.toThrow(/exclusivo do proprietario/)
    // Nem fingindo a marca da transação: a tabela de autorizações não é do aplicativo.
    await expect(
      b.comoApi(
        { contaId: admin.id, comunidadeId: com },
        'insert into uj.ciclos_de_vida_autorizados (comunidade_alvo) values ($1)',
        [com],
      ),
    ).rejects.toThrow()
    expect((await estado())!.estado).toBe('ativa')
  })

  it('o administrador agenda: 30 dias, some das listas, fecha o acesso e avisa os demais sem o nome', async () => {
    const r = await excluir(admin)
    expect(r.statusCode).toBe(200)
    expect(r.json().estado).toBe('exclusao_agendada')
    expect(await estado()).toEqual({
      estado: 'exclusao_agendada',
      dias: DIAS_DE_CARENCIA_DA_EXCLUSAO_DA_COMUNIDADE,
    })

    // Acesso: ninguém entra mais (404, não 403), nem a administração.
    for (const quem of [admin, outroAdmin, org, membro]) {
      for (const caminho of ['', '/eventos', '/membros']) {
        const a = await pedir('GET', `/api/v1/c/${com}${caminho}`, quem)
        expect(a.statusCode, caminho).toBe(404)
      }
    }
    // Listas: some para todos, e a outra comunidade do membro continua.
    const doAdmin = await pedir('GET', '/api/v1/eu', admin)
    expect(doAdmin.json().comunidades).toEqual([])
    const doMembro = await pedir('GET', '/api/v1/eu', membro)
    expect(doMembro.json().comunidades.map((c: { nome: string }) => c.nome)).toEqual([
      'Comunidade que fica',
    ])
    // Só a administração vê a carência (e só ela pode desfazer).
    for (const quem of [admin, outroAdmin]) {
      const lista = await pedir('GET', '/api/v1/eu/comunidades-em-exclusao', quem)
      expect(lista.statusCode).toBe(200)
      expect(lista.json().comunidades).toHaveLength(1)
      expect(lista.json().comunidades[0].id).toBe(com)
      expect(lista.json().comunidades[0].nome).toBe('Jovens Excluíveis')
    }
    for (const quem of [org, membro, deOutra]) {
      const lista = await pedir('GET', '/api/v1/eu/comunidades-em-exclusao', quem)
      expect(lista.json().comunidades).toEqual([])
    }
    // Aviso genérico para os demais (nunca para quem pediu), sem o nome da comunidade.
    const doMembroAviso = await avisos(membro.id)
    expect(doMembroAviso).toHaveLength(1)
    expect(doMembroAviso[0]!.titulo).toBe('Uma comunidade foi marcada para exclusão')
    expect(JSON.stringify(doMembroAviso)).not.toContain('Jovens Excluíveis')
    expect(await avisos(admin.id)).toEqual([])
    expect(await avisos(org.id)).toHaveLength(1)
    // Auditoria só com ids.
    const aud = await b.su.query<{ detalhes: unknown; conta_id: string }>(
      "select detalhes, conta_id from uj.auditoria where comunidade_id = $1 and acao = 'comunidade.exclusao_agendada'",
      [com],
    )
    expect(aud.rows).toHaveLength(1)
    expect(aud.rows[0]!.conta_id).toBe(admin.id)
    expect(aud.rows[0]!.detalhes).toEqual({})
  })

  it('já em exclusão, repetir o pedido é 404 e a carência não é renovada', async () => {
    const antes = await b.su.query<{ f: Date }>(
      'select exclusao_agendada_para as f from uj.comunidades where id = $1',
      [com],
    )
    expect((await excluir(admin)).statusCode).toBe(404)
    const depois = await b.su.query<{ f: Date }>(
      'select exclusao_agendada_para as f from uj.comunidades where id = $1',
      [com],
    )
    expect(depois.rows[0]!.f).toEqual(antes.rows[0]!.f)
  })

  it('desfazer: só a administração desta comunidade (404 para os demais) e tudo volta', async () => {
    for (const quem of [org, membro, deOutra]) {
      expect((await desfazer(quem)).statusCode).toBe(404)
    }
    expect((await estado())!.estado).toBe('exclusao_agendada')
    // Um id que não existe, ou que não é de comunidade em exclusão: 404, igual.
    expect((await desfazer(admin, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(404)
    expect((await desfazer(deOutra, outra)).statusCode).toBe(404)

    await b.dono.query('delete from uj.notificacoes')
    const r = await desfazer(outroAdmin)
    expect(r.statusCode).toBe(200)
    expect(await estado()).toEqual({ estado: 'ativa', dias: null })
    // O acesso e as listas voltam, com os dados como estavam.
    expect((await pedir('GET', `/api/v1/c/${com}/eventos`, membro)).json().eventos).toHaveLength(1)
    const doMembro = await pedir('GET', '/api/v1/eu', membro)
    expect(doMembro.json().comunidades).toHaveLength(2)
    expect((await pedir('GET', '/api/v1/eu/comunidades-em-exclusao', admin)).json()).toEqual({
      comunidades: [],
    })
    // Avisa de novo (a exclusão foi desfeita) e o registro do pedido some.
    expect((await avisos(membro.id)).map((a) => a.titulo)).toEqual(['A exclusão foi desfeita'])
    const reg = await b.su.query(
      'select 1 from uj.exclusoes_de_comunidade where comunidade_id = $1',
      [com],
    )
    expect(reg.rows).toEqual([])
    // Desfazer uma comunidade que está ativa: 404.
    expect((await desfazer(admin)).statusCode).toBe(404)
  })

  it('o pedido do Criador (ou de comunidade órfã) não é desfeito pelo administrador', async () => {
    await b.dono.query(
      "update uj.comunidades set estado = 'exclusao_agendada', exclusao_agendada_para = now() + interval '30 days' where id = $1",
      [com],
    )
    expect((await desfazer(admin)).statusCode).toBe(404)
    expect((await estado())!.estado).toBe('exclusao_agendada')
    expect(
      (await pedir('GET', '/api/v1/eu/comunidades-em-exclusao', admin)).json().comunidades,
    ).toEqual([])
    // Volta pelo caminho do Criador (o dono do banco faz o mesmo que a Plataforma).
    await b.dono.query(
      "update uj.comunidades set estado = 'ativa', exclusao_agendada_para = null where id = $1",
      [com],
    )
  })

  it('comunidade suspensa não é excluída pelo administrador (409)', async () => {
    await b.dono.query("update uj.comunidades set estado = 'suspensa' where id = $1", [com])
    expect((await excluir(admin)).statusCode).toBe(409)
    await b.dono.query("update uj.comunidades set estado = 'ativa' where id = $1", [com])
  })

  it('vencida a carência, a rotina apaga a comunidade; as contas e a outra comunidade ficam', async () => {
    expect((await excluir(admin)).statusCode).toBe(200)
    // Dentro da carência a rotina não toca e o administrador ainda pode desfazer.
    const dentro = await b.dono.query<{ n: number }>(
      'select uj.excluir_comunidades_vencidas() as n',
    )
    expect(dentro.rows[0]!.n).toBe(0)
    expect(
      (await b.su.query('select 1 from uj.comunidades where id = $1', [com])).rows,
    ).toHaveLength(1)

    const deOutraAntes = (
      await b.su.query(
        `select (select count(*) from uj.eventos where comunidade_id = $1) as e,
                (select count(*) from uj.vinculos where comunidade_id = $1) as v`,
        [outra],
      )
    ).rows[0]

    await b.dono.query(
      "update uj.comunidades set exclusao_agendada_para = now() - interval '1 minute' where id = $1",
      [com],
    )
    // Vencida: nem o administrador desfaz mais.
    expect((await desfazer(admin)).statusCode).toBe(404)
    const fora = await b.dono.query<{ n: number }>('select uj.excluir_comunidades_vencidas() as n')
    expect(fora.rows[0]!.n).toBe(1)

    const resto = await b.su.query(
      `select (select count(*) from uj.comunidades where id = $1) as com,
              (select count(*) from uj.eventos where comunidade_id = $1) as ev,
              (select count(*) from uj.avisos where comunidade_id = $1) as av,
              (select count(*) from uj.vinculos where comunidade_id = $1) as vi,
              (select count(*) from uj.exclusoes_de_comunidade where comunidade_id = $1) as ex,
              (select count(*) from uj.notificacoes where comunidade_id = $1) as nt`,
      [com],
    )
    expect(Object.values(resto.rows[0]!).map(Number)).toEqual([0, 0, 0, 0, 0, 0])
    // As contas continuam: só o vínculo saiu.
    const contas = await b.su.query(
      'select count(*)::int as n from uj.contas where id = any ($1)',
      [[admin.id, outroAdmin.id, org.id, membro.id]],
    )
    expect(contas.rows[0]!.n).toBe(4)
    // A outra comunidade não perdeu nada, e o membro ainda a vê.
    const deOutraDepois = (
      await b.su.query(
        `select (select count(*) from uj.eventos where comunidade_id = $1) as e,
                (select count(*) from uj.vinculos where comunidade_id = $1) as v`,
        [outra],
      )
    ).rows[0]
    expect(deOutraDepois).toEqual(deOutraAntes)
    const doMembro = await pedir('GET', '/api/v1/eu', membro)
    expect(doMembro.json().comunidades.map((c: { nome: string }) => c.nome)).toEqual([
      'Comunidade que fica',
    ])
    // A auditoria que sobra não identifica ninguém.
    const aud = await b.su.query<{ acao: string; conta_id: string | null }>(
      'select acao, conta_id from uj.auditoria where comunidade_id = $1',
      [com],
    )
    expect(aud.rows.length).toBeGreaterThan(0)
    expect(aud.rows.every((a) => a.conta_id === null)).toBe(true)
    expect(aud.rows.map((a) => a.acao)).toContain('comunidade.excluida')
    expect(vinculoDoMembro).toBeTruthy()
  })
})
