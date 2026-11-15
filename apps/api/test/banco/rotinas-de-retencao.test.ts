import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ErroDoOperador,
  excluirContaPeloOperador,
  type MotivoDoOperador,
} from '../../src/cli/excluir-conta.ts'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import {
  criarComunidade,
  criarConta,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { emBase64, imagem } from '../apoio/imagens.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Rotinas que as páginas legais prometem (mapa-de-dados.md, seção 10):
 * exclusão de comunidade ao fim da carência (D37), expurgo de 2 anos da
 * auditoria e dos consentimentos revogados, vínculo desativado há 12 meses
 * virando remoção e o comando do operador para excluir a conta de outra
 * pessoa (D38). Tudo pela conexão do dono, como o job diário.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, url: string, p: Pessoa, corpo?: object) =>
  app.inject({ method: metodo, url, headers: p.auth, ...(corpo ? { payload: corpo } : {}) })

const retencao = async () =>
  (await b.dono.query<{ r: Record<string, number> }>('select uj.executar_retencao() as r')).rows[0]!
    .r

async function tabelasComComunidade(): Promise<string[]> {
  const { rows } = await b.su.query<{ tabela: string }>(
    `select c.table_name as tabela from information_schema.columns c
       join information_schema.tables t
         on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'uj' and c.column_name = 'comunidade_id'
        and t.table_type = 'BASE TABLE' and c.table_name <> 'auditoria'
      order by 1`,
  )
  return rows.map((r) => r.tabela)
}

async function contagemPorTabela(comunidade: string): Promise<Record<string, number>> {
  const r: Record<string, number> = {}
  for (const t of await tabelasComComunidade()) {
    r[t] = (
      await b.su.query<{ n: number }>(
        `select count(*)::int as n from uj.${t} where comunidade_id = $1`,
        [comunidade],
      )
    ).rows[0]!.n
  }
  return r
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
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

// ================================================================ exclusão de comunidade

describe('exclusão de comunidade ao fim da carência', () => {
  it('apaga tudo da comunidade, mantém as contas e deixa a auditoria sem identificação', async () => {
    const x = await criarComunidade(b, 'Comunidade que Sai')
    const y = await criarComunidade(b, 'Comunidade que Fica')
    const admin = await pessoaComSessao(b, app, config, 'Admin Que Sai')
    const membro = await pessoaComSessao(b, app, config, 'Membro Que Fica')
    const vAdmin = await vincular(b, admin.id, x, 'admin')
    const vMembro = await vincular(b, membro.id, x, 'membro')
    await vincular(b, admin.id, y, 'admin')
    const um = async (sql: string, params: unknown[]) =>
      (await b.dono.query<{ id: string }>(sql, params)).rows[0]!.id

    // Pela API, como o app faria: logotipo da comunidade e foto da pessoa.
    expect(
      (
        await req('PUT', `/api/v1/c/${x}/logo`, admin, {
          imagem: emBase64(await imagem('png', 32, 32)),
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await req('PUT', '/api/v1/eu/foto', membro, {
          imagem: emBase64(await imagem('jpeg', 32, 32)),
        })
      ).statusCode,
    ).toBe(200)

    const convite = (
      await b.su.query<{ id: string }>(
        `insert into uj.convites (comunidade_id, papel, email_destino, token_hmac, expira_em, criado_por)
         values ($1, 'membro', 'convidada@exemplo.test', sha256('convite-x'::bytea), now() + interval '7 days', $2)
         returning id`,
        [x, admin.id],
      )
    ).rows[0]!.id
    await b.su.query(
      `insert into uj.verificacoes_email (email, codigo_hash, finalidade, convite_id, expira_em)
       values ('convidada@exemplo.test', sha256('codigo'::bytea), 'convite', $1, now() + interval '10 minutes')`,
      [convite],
    )
    await b.su.query(`insert into uj.cotas_diarias (chave, quantidade) values ($1, 1), ($2, 1)`, [
      `avisos:${x}:hora`,
      `email:convite:${convite}`,
    ])
    const local = await um(
      "insert into uj.locais (comunidade_id, nome, tipo) values ($1, 'Salão', 'interno') returning id",
      [x],
    )
    await um(
      "insert into uj.modelos (comunidade_id, nome, categoria, criado_por) values ($1, 'Modelo', 'Outra', $2) returning id",
      [x, admin.id],
    )
    await um(
      `insert into uj.series (comunidade_id, regra, hora_local, fuso, duracao_min, inicio_em, titulo, categoria, criado_por, local_id)
       values ($1, '{"frequencia":"semanal","intervaloSemanas":1,"diasDaSemana":[6]}', '16:00', 'America/Sao_Paulo', 60, current_date, 'Série', 'Outra', $2, $3) returning id`,
      [x, admin.id, local],
    )
    const evento = await um(
      `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status, local_id)
       values ($1, 'Evento', 'Outra', now() + interval '2 days', 60, 'America/Sao_Paulo', $2, 'publicado', $3) returning id`,
      [x, admin.id, local],
    )
    const etapa = await um(
      "insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min) values ($1, $2, 0, 'Louvor', 15) returning id",
      [x, evento],
    )
    const atribuicao = await um(
      'insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id) values ($1, $2, $3, $4) returning id',
      [x, evento, etapa, vMembro],
    )
    await um(
      'insert into uj.substituicoes (comunidade_id, atribuicao_id, pedida_por) values ($1, $2, $3) returning id',
      [x, atribuicao, vMembro],
    )
    await um(
      "insert into uj.tarefas (comunidade_id, evento_id, titulo, responsavel_vinculo_id) values ($1, $2, 'Tarefa', $3) returning id",
      [x, evento, vMembro],
    )
    await um(
      "insert into uj.materiais (comunidade_id, evento_id, nome) values ($1, $2, 'Material') returning id",
      [x, evento],
    )
    await um(
      "insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto) values ($1, $2, 'preparacao', 'Item') returning id",
      [x, evento],
    )
    await um(
      "insert into uj.notas_internas (comunidade_id, evento_id, texto, autor_conta_id) values ($1, $2, 'Nota', $3) returning id",
      [x, evento, admin.id],
    )
    await um(
      "insert into uj.anexos (comunidade_id, evento_id, titulo, url, criado_por) values ($1, $2, 'Link', 'https://exemplo.test/x', $3) returning id",
      [x, evento, admin.id],
    )
    await b.dono.query(
      'insert into uj.disponibilidades (comunidade_id, vinculo_id, data, disponivel) values ($1, $2, current_date + 3, true)',
      [x, vMembro],
    )
    await b.dono.query('insert into uj.andamentos (evento_id, comunidade_id) values ($1, $2)', [
      evento,
      x,
    ])
    await b.dono.query(
      `insert into uj.andamento_comandos (comunidade_id, evento_id, comando, vinculo_id, ocorrido_em, versao_resultante)
       values ($1, $2, 'assumir', $3, now(), 1)`,
      [x, evento, vAdmin],
    )
    const publica = await um(
      `insert into uj.inscricoes (comunidade_id, evento_id, origem, nome, telefone, estado, consentimento_em)
       values ($1, $2, 'publica', 'Visitante Pública', '+5511911112222', 'confirmada', now()) returning id`,
      [x, evento],
    )
    await um(
      `insert into uj.presencas (comunidade_id, evento_id, inscricao_id, origem, registrada_por, chave_idempotencia)
       values ($1, $2, $3, 'manual', $4, gen_random_uuid()) returning id`,
      [x, evento, publica, vAdmin],
    )
    const pedido = await um(
      `insert into uj.pedidos_oracao (comunidade_id, autor_conta_id, texto_cifrado, visibilidade)
       values ($1, $2, decode('01' || repeat('ab', 40), 'hex'), 'comunidade') returning id`,
      [x, membro.id],
    )
    await um(
      'insert into uj.intercessoes (comunidade_id, pedido_id, conta_id) values ($1, $2, $3) returning id',
      [x, pedido, admin.id],
    )
    await um(
      "insert into uj.sugestoes (comunidade_id, autor_conta_id, titulo, texto) values ($1, $2, 'Sugestão', 'Texto') returning id",
      [x, membro.id],
    )
    const aviso = await um(
      "insert into uj.avisos (comunidade_id, titulo, texto, estado, criado_por) values ($1, 'Aviso', 'Texto', 'publicado', $2) returning id",
      [x, admin.id],
    )
    const musica = await um(
      "insert into uj.musicas (comunidade_id, titulo, criado_por) values ($1, 'Música', $2) returning id",
      [x, admin.id],
    )
    const musico = await um(
      "insert into uj.musicos (comunidade_id, nome, criado_por, vinculo_id) values ($1, 'Músico', $2, $3) returning id",
      [x, admin.id, vMembro],
    )
    await um(
      'insert into uj.musica_musicos (comunidade_id, musica_id, musico_id) values ($1, $2, $3) returning id',
      [x, musica, musico],
    )
    await um(
      "insert into uj.palestrantes (comunidade_id, nome, criado_por) values ($1, 'Palestrante', $2) returning id",
      [x, admin.id],
    )
    await um(
      "insert into uj.dinamicas (comunidade_id, titulo, criado_por) values ($1, 'Dinâmica', $2) returning id",
      [x, admin.id],
    )
    await um(
      `insert into uj.exportacoes (comunidade_id, dono_conta_id, tipo, com_contatos, token_hash, nome_arquivo, conteudo, linhas)
       values ($1, $2, 'membros', true, sha256('exportacao-x'::bytea), 'membros.csv', 'Nome;E-mail', 0) returning id`,
      [x, admin.id],
    )
    await um(
      `insert into uj.denuncias (comunidade_id, recurso_tipo, recurso_id, denunciante_conta_id, motivo, detalhe)
       values ($1, 'aviso', $2, $3, 'spam', 'Detalhe escrito') returning id`,
      [x, aviso, membro.id],
    )
    await b.dono.query(
      "insert into uj.preferencias_notificacao (comunidade_id, conta_id, tipo, ativo) values ($1, $2, 'avisos', true)",
      [x, membro.id],
    )
    await b.dono.query(
      `insert into uj.notificacoes (comunidade_id, conta_id, tipo, recurso_tipo, recurso_id, titulo, corpo, chave_dedup)
       values ($1, $2, 'avisos', 'aviso', $3, 'Novo aviso', 'Abra o app', $4)`,
      [x, membro.id, aviso, `teste:${x}`],
    )
    await b.su.query(
      `insert into uj.consentimentos (conta_id, comunidade_id, vinculo_id, texto_id, versao, forma)
       values ($1, $2, $3, 'TC-03', 1, 'ios')`,
      [membro.id, x, vMembro],
    )
    // TC-04 da inscrição pública: ligado só pela inscrição, sem comunidade.
    await b.su.query(
      `insert into uj.consentimentos (inscricao_id, texto_id, versao, forma)
       values ($1, 'TC-04', 1, 'pagina_publica')`,
      [publica],
    )
    await b.su.query(
      `insert into uj.sync_operacoes (comunidade_id, conta_id, chave, tipo, conteudo_hash)
       values ($1, $2, gen_random_uuid(), 'tarefa.concluir', sha256('x'::bytea))`,
      [x, membro.id],
    )
    await b.su.query(
      'insert into uj.bloqueios (comunidade_id, conta_id, bloqueada_conta_id) values ($1, $2, $3)',
      [x, membro.id, admin.id],
    )
    // ADR 0007: pedido de entrada e denúncia de comunidade também saem.
    await b.su.query(
      `insert into uj.pedidos_de_entrada (comunidade_id, conta_id, origem, mensagem,
                                          consentimento_versao, consentimento_forma)
       values ($1, $2, 'codigo', 'Quero entrar', 3, 'ios')`,
      [x, admin.id],
    )
    await b.su.query(
      `insert into uj.denuncias_de_comunidade (comunidade_id, denunciante_conta_id, motivo)
       values ($1, $2, 'spam')`,
      [x, membro.id],
    )
    // Auditoria da comunidade com tudo que identifica: conta, IP e detalhe livre.
    await b.su.query(
      `insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes, ip_truncado)
       values ($1, $2, 'vinculo.alterado', 'vinculo', $3, '{"motivo": "texto livre com nome"}', '200.1.2.0'),
              ($1, $2, 'plataforma.estado_alterado', 'comunidade', $2, '{"de": "ativa"}', '200.1.2.0')`,
      [admin.id, x, vMembro],
    )
    // Controle: Y tem um evento e não pode perder nada.
    await um(
      `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
       values ($1, 'Evento de Y', 'Outra', now(), 60, 'America/Sao_Paulo', $2, 'publicado') returning id`,
      [y, admin.id],
    )

    const antes = await contagemPorTabela(x)
    // O teste só vale se a comunidade tinha de fato algo em cada tabela.
    for (const [tabela, n] of Object.entries(antes)) expect(n, tabela).toBeGreaterThan(0)
    const deY = await contagemPorTabela(y)

    // Agendada, mas com a carência ainda correndo: o job não toca. (O ciclo de
    // vida só muda pelo Criador ou pela conexão do dono, como esta.)
    await b.dono.query(
      "update uj.comunidades set estado = 'exclusao_agendada', exclusao_agendada_para = now() + interval '1 day' where id = $1",
      [x],
    )
    expect((await retencao())['comunidades_excluidas']).toBe(0)
    expect((await b.su.query('select 1 from uj.comunidades where id = $1', [x])).rows).toHaveLength(
      1,
    )
    await expect(b.dono.query('select uj.apagar_comunidade($1)', [x])).rejects.toMatchObject({
      code: '55000',
    })

    // Carência vencida: o job apaga.
    await b.dono.query(
      "update uj.comunidades set exclusao_agendada_para = now() - interval '1 minute' where id = $1",
      [x],
    )
    const relatorio = await retencao()
    expect(relatorio['comunidades_excluidas']).toBe(1)

    const depois = await contagemPorTabela(x)
    for (const [tabela, n] of Object.entries(depois)) expect(n, tabela).toBe(0)
    expect((await b.su.query('select 1 from uj.comunidades where id = $1', [x])).rows).toEqual([])
    expect(
      (await b.su.query('select 1 from uj.verificacoes_email where convite_id = $1', [convite]))
        .rows,
    ).toEqual([])
    expect(
      (
        await b.su.query(
          "select chave from uj.cotas_diarias where chave like '%' || $1 || '%' or chave like '%' || $2 || '%'",
          [x, convite],
        )
      ).rows,
    ).toEqual([])
    expect(
      (await b.su.query("select 1 from uj.consentimentos where texto_id = 'TC-04'")).rows,
    ).toEqual([])
    // Y intacta.
    expect(await contagemPorTabela(y)).toEqual(deY)

    // As contas continuam (são das pessoas), inclusive a foto de perfil.
    const contas = await b.su.query<{ nome: string }>(
      'select nome from uj.contas where id = any ($1) order by nome',
      [[admin.id, membro.id]],
    )
    expect(contas.rows.map((c) => c.nome)).toEqual(['Admin Que Sai', 'Membro Que Fica'])
    expect(
      (await b.su.query('select 1 from uj.fotos_contas where conta_id = $1', [membro.id])).rows,
    ).toHaveLength(1)
    expect((await req('GET', '/api/v1/eu', membro)).json().comunidades).toEqual([])

    // Auditoria: fica, só com ação, tipo, data e comunidade.
    const auditoria = await b.su.query<{
      conta_id: string | null
      ip_truncado: string | null
      detalhes: object
      recurso_id: string | null
      acao: string
    }>(
      'select conta_id, ip_truncado, detalhes, recurso_id, acao from uj.auditoria where comunidade_id = $1',
      [x],
    )
    expect(auditoria.rows.length).toBeGreaterThanOrEqual(3)
    for (const linha of auditoria.rows) {
      expect(linha.conta_id).toBeNull()
      expect(linha.ip_truncado).toBeNull()
      expect(linha.detalhes).toEqual({})
      expect([null, x]).toContain(linha.recurso_id)
    }
    expect(auditoria.rows.map((l) => l.acao)).toContain('comunidade.excluida')
    expect(JSON.stringify(auditoria.rows)).not.toContain('texto livre')
  }, 60_000)
})

// ================================================================ 2 anos

describe('expurgo de 2 anos da auditoria e dos consentimentos revogados', () => {
  it('apaga só o que passou de 2 anos; o dono continua sem apagar nem alterar a auditoria', async () => {
    const conta = await criarConta(b, 'Pessoa Antiga')
    await b.su.query(
      `insert into uj.auditoria (conta_id, acao, momento) values
         ($1, 'teste.vencido', now() - interval '2 years 1 day'),
         ($1, 'teste.recente', now() - interval '1 year 11 months')`,
      [conta],
    )
    await b.su.query(
      `insert into uj.consentimentos (conta_id, texto_id, versao, forma, concedido_em, revogado_em) values
         ($1, 'TC-02', 1, 'ios', now() - interval '4 years', now() - interval '2 years 1 day'),
         ($1, 'TC-02', 1, 'ios', now() - interval '4 years', now() - interval '1 year'),
         ($1, 'TC-01', 1, 'ios', now() - interval '4 years', null)`,
      [conta],
    )
    const r = await retencao()
    expect(r['auditoria_expurgada']).toBe(1)
    expect(r['consentimentos_expurgados']).toBe(1)
    const sobrou = await b.su.query<{ acao: string }>(
      "select acao from uj.auditoria where acao like 'teste.%'",
    )
    expect(sobrou.rows).toEqual([{ acao: 'teste.recente' }])
    expect(
      (
        await b.su.query('select count(*)::int as n from uj.consentimentos where conta_id = $1', [
          conta,
        ])
      ).rows[0],
    ).toEqual({ n: 2 })

    // Fora das rotinas, nada muda: nem o dono apaga ou altera.
    await expect(
      b.dono.query("delete from uj.auditoria where acao = 'teste.recente'"),
    ).rejects.toThrow(/só-inserção/)
    // Mesmo numa transação marcada, só vale apagar o que tem 2 anos e só tirar
    // identificação: mudar a ação ou apagar o recente continua recusado.
    const c = await b.dono.connect()
    try {
      for (const sql of [
        "update uj.auditoria set acao = 'x.y' where acao = 'teste.recente'",
        "delete from uj.auditoria where acao = 'teste.recente'",
        "update uj.auditoria set conta_id = gen_random_uuid() where acao = 'teste.recente'",
      ]) {
        await c.query('begin')
        await c.query('insert into uj.manutencoes_da_auditoria default values')
        await expect(c.query(sql)).rejects.toThrow(/só-inserção/)
        await c.query('rollback')
      }
    } finally {
      c.release()
    }
    // E os papéis do aplicativo não executam nenhuma das rotinas.
    for (const papel of [b.api, b.auth]) {
      for (const sql of [
        'select uj.expurgar_registros_de_2_anos()',
        'select uj.excluir_comunidades_vencidas()',
        'select uj.remover_desativacoes_vencidas()',
        "select uj.apagar_comunidade('00000000-0000-4000-8000-000000000000')",
      ]) {
        await expect(papel.query(sql), sql).rejects.toMatchObject({ code: '42501' })
      }
      await expect(
        papel.query('insert into uj.manutencoes_da_auditoria default values'),
      ).rejects.toMatchObject({ code: '42501' })
    }
  })
})

// ================================================================ 12 meses

describe('vínculo desativado há 12 meses', () => {
  it('vira remoção, fica na auditoria da comunidade e, 30 dias depois, tem o efeito da saída', async () => {
    const com = await criarComunidade(b, 'Comunidade das Pausas')
    const admin = await pessoaComSessao(b, app, config, 'Admin das Pausas')
    await vincular(b, admin.id, com, 'admin')
    const longe = await criarConta(b, 'Pessoa em Intercâmbio')
    const perto = await criarConta(b, 'Pessoa em Pausa Curta')
    const vLonge = await vincular(b, longe, com, 'organizador')
    const vPerto = await vincular(b, perto, com, 'membro')
    for (const v of [vLonge, vPerto]) {
      const r = await req('PATCH', `/api/v1/c/${com}/membros/${v}`, admin, {
        estado: 'desativado',
      })
      expect(r.statusCode).toBe(200)
    }
    const datas = await b.su.query<{ desativado: boolean }>(
      "select desativado_em > now() - interval '1 minute' as desativado from uj.vinculos where id = any ($1)",
      [[vLonge, vPerto]],
    )
    expect(datas.rows).toEqual([{ desativado: true }, { desativado: true }])
    await b.su.query(
      "update uj.vinculos set desativado_em = now() - interval '12 months 1 day' where id = $1",
      [vLonge],
    )
    await b.su.query(
      "update uj.vinculos set desativado_em = now() - interval '11 months' where id = $1",
      [vPerto],
    )

    expect((await retencao())['vinculos_desativados_vencidos']).toBe(1)
    const estados = await b.su.query<{ id: string; estado: string; removido: boolean }>(
      `select id, estado, removido_em is not null as removido from uj.vinculos
        where id = any ($1) order by estado`,
      [[vLonge, vPerto]],
    )
    expect(estados.rows).toEqual([
      { id: vPerto, estado: 'desativado', removido: false },
      { id: vLonge, estado: 'removido', removido: true },
    ])
    // A administração vê a mudança na auditoria da comunidade.
    const auditoria = (await req('GET', `/api/v1/c/${com}/auditoria`, admin)).json().registros as {
      acao: string
      recursoId: string
      detalhes: { motivo?: string; depois?: { estado: string } }
    }[]
    expect(auditoria).toContainEqual(
      expect.objectContaining({
        acao: 'vinculo.alterado',
        recursoId: vLonge,
        detalhes: expect.objectContaining({
          motivo: 'desativacao_vencida',
          depois: expect.objectContaining({ estado: 'removido' }),
        }),
      }),
    )

    // Passados os 30 dias da remoção, o job desliga o histórico (caso 3).
    await b.su.query(
      "update uj.vinculos set removido_em = now() - interval '31 days' where id = $1",
      [vLonge],
    )
    await retencao()
    const desligado = await b.su.query<{ anonimizado: boolean; conta_id: string }>(
      'select anonimizado_em is not null as anonimizado, conta_id from uj.vinculos where id = $1',
      [vLonge],
    )
    expect(desligado.rows[0]!.anonimizado).toBe(true)
    expect(desligado.rows[0]!.conta_id).not.toBe(longe)
  })
})

// ================================================================ comando do operador

describe('comando do operador: excluir a conta de outra pessoa', () => {
  it('sem --confirmar só descreve; com ele, exclui como o app e audita o motivo', async () => {
    const com = await criarComunidade(b, 'Comunidade do Operador')
    const admin = await criarConta(b, 'Admin do Operador')
    await vincular(b, admin, com, 'admin')
    const menor = await pessoaComSessao(b, app, config, 'Pessoa Menor de Idade')
    await vincular(b, menor.id, com, 'membro')

    const simulado = await excluirContaPeloOperador(b.dono, {
      email: menor.email.toUpperCase(),
      motivo: 'menor_de_16',
      confirmar: false,
    })
    expect(simulado).toEqual({
      contaId: menor.id,
      comunidades: [{ id: com, nome: 'Comunidade do Operador' }],
      excluida: false,
    })
    expect(
      (await b.su.query('select estado from uj.contas where id = $1', [menor.id])).rows,
    ).toEqual([{ estado: 'ativa' }])

    const feito = await excluirContaPeloOperador(b.dono, {
      contaId: menor.id,
      motivo: 'menor_de_16',
      confirmar: true,
    })
    expect(feito.excluida).toBe(true)
    const conta = await b.su.query('select nome, estado from uj.contas where id = $1', [menor.id])
    expect(conta.rows).toEqual([{ nome: 'Pessoa removida', estado: 'anonimizada' }])
    expect((await req('GET', '/api/v1/eu', menor)).statusCode).toBe(401)
    const auditoria = await b.su.query<{ acao: string; conta_id: string | null; detalhes: object }>(
      `select acao, conta_id, detalhes from uj.auditoria
        where recurso_id = $1 and acao in ('conta.excluida', 'plataforma.conta_excluida') order by id`,
      [menor.id],
    )
    expect(auditoria.rows).toEqual([
      { acao: 'conta.excluida', conta_id: menor.id, detalhes: {} },
      {
        acao: 'plataforma.conta_excluida',
        conta_id: null,
        detalhes: { motivo: 'menor_de_16', pelo: 'operador' },
      },
    ])
    // A prova de uso único foi consumida pela exclusão.
    expect(
      (
        await b.su.query('select 1 from uj.provas_de_reautenticacao where conta_id = $1', [
          menor.id,
        ])
      ).rows,
    ).toEqual([])
    // Já excluída: o comando recusa.
    await expect(
      excluirContaPeloOperador(b.dono, {
        contaId: menor.id,
        motivo: 'menor_de_16',
        confirmar: true,
      }),
    ).rejects.toThrow(ErroDoOperador)
  })

  it('recusa sem motivo da lista, sem conta, o Criador e a única admin com outras pessoas', async () => {
    const com = await criarComunidade(b, 'Comunidade da Única')
    const unica = await criarConta(b, 'Única Admin')
    const outro = await criarConta(b, 'Outro Membro')
    await vincular(b, unica, com, 'admin')
    await vincular(b, outro, com, 'membro')
    const criador = await criarConta(b, 'Criador do Teste', { proprietario: true })

    await expect(
      excluirContaPeloOperador(b.dono, {
        contaId: outro,
        motivo: 'porque_sim' as MotivoDoOperador,
        confirmar: true,
      }),
    ).rejects.toThrow(/Motivo obrigatório/)
    await expect(
      excluirContaPeloOperador(b.dono, { motivo: 'pedido_do_titular', confirmar: true }),
    ).rejects.toThrow(/--conta ou por --email/)
    await expect(
      excluirContaPeloOperador(b.dono, {
        email: 'ninguem@exemplo.test',
        motivo: 'pedido_do_titular',
        confirmar: true,
      }),
    ).rejects.toThrow(/não encontrada/)
    await expect(
      excluirContaPeloOperador(b.dono, {
        contaId: criador,
        motivo: 'determinacao_legal',
        confirmar: true,
      }),
    ).rejects.toThrow(/Criador/)
    await expect(
      excluirContaPeloOperador(b.dono, {
        contaId: unica,
        motivo: 'pedido_do_titular',
        confirmar: true,
      }),
    ).rejects.toThrow(/única administradora de: Comunidade da Única/)
    // Nada foi gravado nos casos recusados.
    const estados = await b.su.query<{ estado: string }>(
      'select estado from uj.contas where id = any ($1)',
      [[unica, outro, criador]],
    )
    expect(estados.rows.map((e) => e.estado)).toEqual(['ativa', 'ativa', 'ativa'])
  })
})
