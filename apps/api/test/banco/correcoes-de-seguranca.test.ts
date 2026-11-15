import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { appIdsIos, pacotesAndroid } from '../../src/publico/documentos.ts'
import { ESCRITAS_POR_HORA } from '../../src/rotas/contexto.ts'
import { criarServidor } from '../../src/servidor.ts'
import {
  criarComunidade,
  criarConta,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Correções da revisão de segurança independente sobre 15060d4..bba28a5
 * (0015_correcoes_de_seguranca.sql). Cada bloco cita o achado. O caso M1 está
 * na suíte de isolamento; B4 e o conversor de Markdown, nos testes de unidade.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let admin: Pessoa

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, url: string, p: Pessoa, corpo?: object) =>
  app.inject({ method: metodo, url, headers: p.auth, ...(corpo ? { payload: corpo } : {}) })

const CIFRADO = "decode('01' || repeat('ab', 40), 'hex')"

async function avisoPublicado(comunidade: string, autor: string): Promise<string> {
  return (
    await b.dono.query<{ id: string }>(
      `insert into uj.avisos (comunidade_id, titulo, texto, estado, criado_por)
       values ($1, 'Aviso', 'Texto', 'publicado', $2) returning id`,
      [comunidade, autor],
    )
  ).rows[0]!.id
}

async function provaDeReautenticacao(conta: string, prova: string): Promise<void> {
  await b.su.query(
    `insert into uj.provas_de_reautenticacao (prova_hash, conta_id, finalidade, expira_em)
     values (sha256(convert_to($2, 'UTF8')), $1, 'excluir_conta', now() + interval '2 minutes')`,
    [conta, prova],
  )
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
  comA = await criarComunidade(b, 'Comunidade A')
  comB = await criarComunidade(b, 'Comunidade B')
  admin = await pessoaComSessao(b, app, config, 'Admin A')
  await vincular(b, admin.id, comA, 'admin')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

// ================================================================ A1

describe('A1: a troca de autoria ao sair não deixa rastro', () => {
  async function cenario(nome: string) {
    const autora = await pessoaComSessao(b, app, config, nome)
    const vinculo = await vincular(b, autora.id, comA, 'membro')
    const sug = await req('POST', `/api/v1/c/${comA}/sugestoes`, autora, {
      titulo: `Ideia de ${nome}`,
      texto: 'Texto',
      anonima: true,
    })
    expect(sug.statusCode).toBe(200)
    const den = await req('POST', `/api/v1/c/${comA}/denuncias`, autora, {
      recursoTipo: 'aviso',
      recursoId: await avisoPublicado(comA, admin.id),
      motivo: 'spam',
    })
    expect(den.statusCode).toBe(200)
    const sugestaoId = sug.json().id as string
    const denunciaId = den.json().id as string
    const retrato = async () =>
      (
        await b.su.query(
          `select s.versao, s.atualizado_em, s.autor_conta_id = $3 as minha,
                  (select d.denunciante_conta_id = $3 from uj.denuncias d where d.id = $2) as denunciei
             from uj.sugestoes s where s.id = $1`,
          [sugestaoId, denunciaId, autora.id],
        )
      ).rows[0] as { versao: number; atualizado_em: Date; minha: boolean; denunciei: boolean }
    const antes = await retrato()
    expect(antes).toMatchObject({ minha: true, denunciei: true })
    const marca = (
      await b.su.query<{ m: string }>('select coalesce(max(id), 0) as m from uj.mudancas')
    ).rows[0]!.m
    return { autora, vinculo, sugestaoId, retrato, antes, marca }
  }

  async function semRastro(c: Awaited<ReturnType<typeof cenario>>) {
    const depois = await c.retrato()
    // A troca aconteceu (a autoria saiu da conta)...
    expect(depois).toMatchObject({ minha: false, denunciei: false })
    // ...mas versão e data da sugestão anônima são as mesmas.
    expect(depois.versao).toBe(c.antes.versao)
    expect(depois.atualizado_em).toEqual(c.antes.atualizado_em)
    const mudancas = await b.su.query(
      `select tabela from uj.mudancas where id > $1 and tabela in ('sugestoes', 'denuncias')`,
      [c.marca],
    )
    expect(mudancas.rows).toEqual([])
    // E o que o organizador lê também não mudou.
    const lida = await req('GET', `/api/v1/c/${comA}/sugestoes/${c.sugestaoId}`, admin)
    expect(lida.json()).toMatchObject({ versao: c.antes.versao, autorNome: null })
  }

  it('sair da comunidade: sugestão anônima e denúncia sem versão, data nem mudança', async () => {
    const c = await cenario('Autora Que Sai')
    expect((await req('POST', `/api/v1/c/${comA}/sair`, c.autora)).statusCode).toBe(200)
    await semRastro(c)
  })

  it('remoção pelo admin aplicada pelo job dos 30 dias: também sem rastro', async () => {
    const c = await cenario('Autora Removida')
    const r = await req('PATCH', `/api/v1/c/${comA}/membros/${c.vinculo}`, admin, {
      estado: 'removido',
    })
    expect(r.statusCode).toBe(200)
    await b.dono.query(
      "update uj.vinculos set removido_em = now() - interval '31 days' where id = $1",
      [c.vinculo],
    )
    const marca = (
      await b.su.query<{ m: string }>('select coalesce(max(id), 0) as m from uj.mudancas')
    ).rows[0]!.m
    await b.dono.query('select uj.executar_retencao()')
    await semRastro({ ...c, marca })
  })

  it('moderar a sugestão continua subindo a versão e avisando quem acompanha', async () => {
    const autora = await pessoaComSessao(b, app, config, 'Autora Moderada')
    await vincular(b, autora.id, comA, 'membro')
    const sug = await req('POST', `/api/v1/c/${comA}/sugestoes`, autora, {
      titulo: 'Ideia moderada',
      texto: 'Texto',
      anonima: true,
    })
    const mod = await req('PATCH', `/api/v1/c/${comA}/sugestoes/${sug.json().id}`, admin, {
      status: 'aceita',
    })
    expect(mod.json().versao).toBe(sug.json().versao + 1)
  })
})

// ================================================================ M2

describe('M2: inscrição pública repetida não entrega o código', () => {
  const inscrever = (idPublico: string, telefone: string) =>
    app.inject({
      method: 'POST',
      url: `/e/${idPublico}/inscricao`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        nome: 'Visitante',
        telefone,
        consentimento: 'sim',
        idade: 'sim',
      }).toString(),
    })
  const codigoDe = (corpo: string) => corpo.match(/Código: <strong>([0-9A-F]{10})<\/strong>/)![1]!

  // D45 (0021): a repetição agora é WhatsApp mais nome, e a página diz que a
  // pessoa já está inscrita (409). Continua sem código, QR, estado e link.
  it('a repetição não tem código nem estado e é igual para qualquer pessoa; o código volta só com o token', async () => {
    const idPublico = (
      await b.dono.query<{ id_publico: string }>(
        `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por,
                                 status, visibilidade, capacidade, lista_de_espera)
         values ($1, 'Encontro aberto', 'Outra', now() + interval '3 days', 60, 'America/Sao_Paulo', $2,
                 'publicado', 'publica', 1, true) returning id_publico`,
        [comA, admin.id],
      )
    ).rows[0]!.id_publico
    const confirmada = await inscrever(idPublico, '11981110001')
    const espera = await inscrever(idPublico, '11981110002')
    expect(confirmada.body).toContain('Inscrição confirmada')
    expect(espera.body).toContain('lista de espera')
    const codigos = [codigoDe(confirmada.body), codigoDe(espera.body)]
    const token = confirmada.body.match(/cancelar#t=([\w-]+)/)![1]!

    const repConfirmada = await inscrever(idPublico, '11981110001')
    const repEspera = await inscrever(idPublico, '(11) 98111-0002')
    for (const r of [repConfirmada, repEspera]) {
      expect(r.statusCode).toBe(409)
      expect(r.body).toContain('já está inscrita')
      for (const codigo of codigos) expect(r.body).not.toContain(codigo)
      expect(r.body).not.toContain('<svg')
      expect(r.body).not.toMatch(/confirmada|lista de espera|cancelar#t=/i)
    }
    // Nada na resposta diz em que estado a inscrição está (confirmada ou espera).
    expect(repConfirmada.body.replace(/value="[^"]*"/g, '')).toBe(
      repEspera.body.replace(/value="[^"]*"/g, ''),
    )

    // No banco, a repetição também não devolve código nem estado.
    const direto = await b.api.query(
      `select * from uj.inscrever_publico($1, ' visitante ', '+5511981110001', null,
                                          sha256('x'::bytea), 'TC-04', 1, true)`,
      [idPublico],
    )
    expect(direto.rows).toEqual([
      { inscricao_id: null, estado: null, codigo_checkin: null, ja_existia: true },
    ])

    // Com o token do link de cancelamento, o código volta; sem ele, não.
    const pedirCodigo = (t: string) =>
      app.inject({
        method: 'POST',
        url: `/e/${idPublico}/cancelar`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams({ token: t, acao: 'codigo' }).toString(),
      })
    const comToken = await pedirCodigo(token)
    expect(comToken.statusCode).toBe(200)
    expect(comToken.body).toContain(codigos[0]!)
    const semToken = await pedirCodigo('token-inventado-com-formato-valido-123')
    expect(semToken.statusCode).toBe(404)
    expect(semToken.body).not.toContain(codigos[0]!)
  })
})

// ================================================================ B1

describe('B1: exclusão de conta sem corrida com a escrita de oração', () => {
  it('pedido de oração gravado durante a exclusão espera e é recusado', async () => {
    const conta = await criarConta(b, 'Pessoa Em Corrida')
    await vincular(b, conta, comA, 'membro')
    await provaDeReautenticacao(conta, 'prova-da-corrida')
    const exclusao = await b.auth.connect()
    const escrita = await b.api.connect()
    try {
      await exclusao.query('begin')
      await exclusao.query('select uj.excluir_conta($1, $2)', [conta, 'prova-da-corrida'])
      await escrita.query('begin')
      await escrita.query(
        `select set_config('app.conta_id', $1, true), set_config('app.comunidade_id', $2, true)`,
        [conta, comA],
      )
      const pid = (await escrita.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0]!
        .pid
      const gravacao = escrita
        .query(
          `insert into uj.pedidos_oracao (comunidade_id, texto_cifrado) values ($1, ${CIFRADO})`,
          [comA],
        )
        .then(
          () => 'gravou',
          (e: Error) => e.message,
        )
      // Espera a escrita ficar presa numa trava da exclusão (não só "ainda não começou").
      for (let i = 0; i < 100; i++) {
        const { rows } = await b.su.query<{ w: string | null }>(
          'select wait_event_type as w from pg_stat_activity where pid = $1',
          [pid],
        )
        if (rows[0]?.w === 'Lock') break
        await new Promise((r) => setTimeout(r, 20))
      }
      await exclusao.query('commit')
      const resultado = await gravacao
      await escrita.query(resultado === 'gravou' ? 'commit' : 'rollback')
      expect(resultado).toMatch(/row-level security/)
    } finally {
      exclusao.release()
      escrita.release()
    }
    expect(
      (await b.su.query('select 1 from uj.pedidos_oracao where autor_conta_id = $1', [conta])).rows,
    ).toEqual([])
  })

  it('a retenção diária apaga pedido de autora anonimizada que tenha escapado', async () => {
    const fica = await pessoaComSessao(b, app, config, 'Autora Que Fica')
    await vincular(b, fica.id, comA, 'membro')
    const escapou = await criarConta(b, 'Autora Que Escapou')
    await vincular(b, escapou, comA, 'membro')
    for (const autora of [fica.id, escapou]) {
      await b.comoApi(
        { contaId: autora, comunidadeId: comA },
        `insert into uj.pedidos_oracao (comunidade_id, texto_cifrado) values ($1, ${CIFRADO})`,
        [comA],
      )
    }
    // Simula a sobra de uma corrida antiga: conta anonimizada com o pedido ainda lá.
    await b.su.query(
      "update uj.contas set estado = 'anonimizada', anonimizada_em = now() where id = $1",
      [escapou],
    )
    const r = (
      await b.dono.query<{ r: Record<string, number> }>('select uj.executar_retencao() as r')
    ).rows[0]!.r
    expect(r['pedidos_orfaos_apagados']).toBeGreaterThanOrEqual(1)
    const restantes = await b.su.query<{ a: string }>(
      'select autor_conta_id as a from uj.pedidos_oracao where autor_conta_id = any ($1)',
      [[fica.id, escapou]],
    )
    expect(restantes.rows).toEqual([{ a: fica.id }])
  })
})

// ================================================================ B2

describe('B2: cotas por finalidade', () => {
  it('o aplicativo não executa a cota genérica', async () => {
    for (const pool of [b.api, b.auth]) {
      await expect(
        pool.query("select uj.consumir_cota('push:alguem', 1000)"),
      ).rejects.toMatchObject({ code: '42501' })
    }
  })

  it('a cota diária de push é por comunidade, e os tipos críticos têm cota própria', async () => {
    const ambos = await criarConta(b, 'Pessoa Em A e B')
    await vincular(b, ambos, comA, 'membro')
    await vincular(b, ambos, comB, 'membro')
    const enfileirar = (com: string, tipo: string) =>
      b.dono.query(
        `select uj.enfileirar_notificacao($1, $2, $3, 'aviso', gen_random_uuid(), 'Novo aviso', 'Texto')`,
        [com, ambos, tipo],
      )
    const quantas = async (com: string) =>
      Number(
        (
          await b.su.query<{ n: string }>(
            'select count(*) as n from uj.notificacoes where conta_id = $1 and comunidade_id = $2',
            [ambos, com],
          )
        ).rows[0]!.n,
      )
    // O organizador de A esgota a cota de avisos da pessoa em A.
    for (let i = 0; i < 31; i++) await enfileirar(comA, 'avisos')
    expect(await quantas(comA)).toBe(30)
    // B continua chegando.
    await enfileirar(comB, 'avisos')
    expect(await quantas(comB)).toBe(1)
    // Em A, o cancelamento de evento ainda chega.
    await enfileirar(comA, 'alteracoes_importantes')
    expect(await quantas(comA)).toBe(31)
  })

  it('publicação de avisos por hora: passou do limite, 429 com mensagem clara', async () => {
    const com = await criarComunidade(b, 'Comunidade dos Avisos')
    const org = await pessoaComSessao(b, app, config, 'Organizadora dos Avisos')
    await vincular(b, org.id, com, 'organizador')
    const primeiro = await req('POST', `/api/v1/c/${com}/avisos`, org, {
      titulo: 'Primeiro aviso',
      texto: 'Texto',
      publicar: true,
    })
    expect(primeiro.statusCode).toBe(200)
    // Gasta o resto da hora direto na cota (publicar 20 avisos aqui só deixaria o teste lento).
    await b.su.query(
      `update uj.cotas_diarias set quantidade = uj.limite_de_avisos_por_hora()
        where dia = (now() at time zone 'America/Sao_Paulo')::date
          and chave like 'avisos:' || $1 || ':%'`,
      [com],
    )
    const passou = await req('POST', `/api/v1/c/${com}/avisos`, org, {
      titulo: 'Aviso a mais',
      texto: 'Texto',
      publicar: true,
    })
    expect(passou.statusCode).toBe(429)
    expect(passou.json().erro).toBe('limite_de_avisos')
    // Rascunho continua livre.
    const rascunho = await req('POST', `/api/v1/c/${com}/avisos`, org, {
      titulo: 'Rascunho',
      texto: 'Texto',
    })
    expect(rascunho.statusCode).toBe(200)
  })
})

// ================================================================ B3

describe('B3: fila de push com reserva própria e revalidação', () => {
  let pessoa: Pessoa
  let com: string

  beforeAll(async () => {
    com = await criarComunidade(b, 'Comunidade do Push')
    pessoa = await pessoaComSessao(b, app, config, 'Pessoa do Push')
    await vincular(b, pessoa.id, com, 'membro')
    const r = await req('PUT', '/api/v1/eu/notificacoes/aparelho', pessoa, {
      plataforma: 'android',
      token: 'fcm-token-da-pessoa-do-push-0001',
    })
    expect(r.statusCode).toBe(200)
  })

  async function novoEnvio(): Promise<string> {
    await b.dono.query(
      `select uj.enfileirar_notificacao($1, $2, 'avisos', 'aviso', gen_random_uuid(), 'Novo aviso', 'Texto')`,
      [com, pessoa.id],
    )
    return (
      await b.su.query<{ id: string }>(
        `select e.id from uj.envios_push e join uj.notificacoes n on n.id = e.notificacao_id
          where n.conta_id = $1 and e.estado = 'pendente' order by e.id desc limit 1`,
        [pessoa.id],
      )
    ).rows[0]!.id
  }
  const reservar = async () =>
    (
      await b.auth.query<{ envio_id: string; reserva_id: string }>(
        'select envio_id, reserva_id from uj.push_reservar(50, 60)',
      )
    ).rows
  const estado = async (envio: string) =>
    (
      await b.su.query<{ estado: string }>('select estado from uj.envios_push where id = $1', [
        envio,
      ])
    ).rows[0]!.estado

  it('concluir exige a reserva certa: outra reserva não conclui nem apaga o aparelho', async () => {
    const envio = await novoEnvio()
    const reservado = (await reservar()).find((r) => r.envio_id === envio)!
    expect(reservado.reserva_id).toMatch(/^[0-9a-f-]{36}$/)
    const alheia = await b.auth.query<{ ok: boolean }>(
      "select uj.push_concluir($1, $2, 'token_invalido', null) as ok",
      [envio, randomUUID()],
    )
    expect(alheia.rows[0]!.ok).toBe(false)
    expect(await estado(envio)).toBe('enviando')
    expect(
      (await b.su.query('select 1 from uj.aparelhos_push where conta_id = $1', [pessoa.id])).rows,
    ).toHaveLength(1)
    const certa = await b.auth.query<{ ok: boolean }>(
      "select uj.push_concluir($1, $2, 'enviado', null) as ok",
      [envio, reservado.reserva_id],
    )
    expect(certa.rows[0]!.ok).toBe(true)
    expect(await estado(envio)).toBe('enviado')
    // Concluir de novo com a mesma reserva não faz nada.
    const deNovo = await b.auth.query<{ ok: boolean }>(
      "select uj.push_concluir($1, $2, 'falhou', 'x') as ok",
      [envio, reservado.reserva_id],
    )
    expect(deNovo.rows[0]!.ok).toBe(false)
    expect(await estado(envio)).toBe('enviado')
  })

  it('reserva vencida volta revalidada: preferência desligada no meio descarta o envio', async () => {
    const envio = await novoEnvio()
    expect((await reservar()).map((r) => r.envio_id)).toContain(envio)
    await b.su.query(
      `insert into uj.preferencias_notificacao (comunidade_id, conta_id, tipo, ativo)
       values ($1, $2, 'avisos', false)`,
      [com, pessoa.id],
    )
    await b.su.query(
      "update uj.envios_push set reservado_ate = now() - interval '1 second' where id = $1",
      [envio],
    )
    expect((await reservar()).map((r) => r.envio_id)).not.toContain(envio)
    expect(await estado(envio)).toBe('descartado')
    await b.su.query('delete from uj.preferencias_notificacao where conta_id = $1', [pessoa.id])
  })

  it('reserva vencida que já gastou as tentativas falha de vez', async () => {
    const envio = await novoEnvio()
    expect((await reservar()).map((r) => r.envio_id)).toContain(envio)
    await b.su.query(
      "update uj.envios_push set tentativas = 5, reservado_ate = now() - interval '1 second' where id = $1",
      [envio],
    )
    expect((await reservar()).map((r) => r.envio_id)).not.toContain(envio)
    expect(await estado(envio)).toBe('falhou')
  })
})

// ================================================================ B5

describe('B5: funções SECURITY DEFINER não confiam só no parâmetro', () => {
  it('excluir_conta exige a prova de reautenticação gravada pelo serviço', async () => {
    const conta = await criarConta(b, 'Conta Protegida')
    await vincular(b, conta, comB, 'membro')
    await expect(
      b.auth.query('select uj.excluir_conta($1, $2)', [conta, 'prova-inventada']),
    ).rejects.toMatchObject({ code: 'UJ042' })
    // A versão antiga, só com o id, não existe mais.
    await expect(b.auth.query('select uj.excluir_conta($1)', [conta])).rejects.toMatchObject({
      code: '42883',
    })
    // Prova de outra conta também não serve.
    const outra = await criarConta(b, 'Outra Conta')
    await provaDeReautenticacao(outra, 'prova-da-outra')
    await expect(
      b.auth.query('select uj.excluir_conta($1, $2)', [conta, 'prova-da-outra']),
    ).rejects.toMatchObject({ code: 'UJ042' })
    expect((await b.su.query('select estado from uj.contas where id = $1', [conta])).rows).toEqual([
      { estado: 'ativa' },
    ])
    // Com a prova certa, exclui, e a prova é de uso único.
    await provaDeReautenticacao(conta, 'prova-certa')
    await b.auth.query('select uj.excluir_conta($1, $2)', [conta, 'prova-certa'])
    expect((await b.su.query('select estado from uj.contas where id = $1', [conta])).rows).toEqual([
      { estado: 'anonimizada' },
    ])
    expect(
      (await b.su.query('select 1 from uj.provas_de_reautenticacao where conta_id = $1', [conta]))
        .rows,
    ).toEqual([])
  })

  it('registrar_consentimento recusa comunidade sem vínculo da conta', async () => {
    const conta = await criarConta(b, 'Conta Sem Vinculo')
    await expect(
      b.auth.query(
        "select uj.registrar_consentimento($1, $2, null, 'TC-03', 1, 'web', null, null)",
        [conta, comB],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    await expect(
      b.auth.query(
        "select uj.registrar_consentimento($1, $2, null, 'TC-02', 1, 'web', null, null)",
        [conta, comB],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    expect(
      (await b.su.query('select 1 from uj.consentimentos where conta_id = $1', [conta])).rows,
    ).toEqual([])
    // Sem comunidade (termos da conta), continua valendo.
    await b.auth.query(
      "select uj.registrar_consentimento($1, null, null, 'TC-02', 1, 'web', null, null)",
      [conta],
    )
  })

  it('conta_ativa_no_contexto só responde a quem é da comunidade do contexto', async () => {
    const deB = await criarConta(b, 'Pessoa de B')
    await vincular(b, deB, comB, 'membro')
    const pergunta = (quem: string) =>
      b.comoApi<{ ativa: boolean }>(
        { contaId: quem, comunidadeId: comB },
        'select uj.conta_ativa_no_contexto($1) as ativa',
        [deB],
      )
    // A admin de A, com a comunidade B no contexto, não descobre quem está em B.
    expect(await pergunta(admin.id)).toEqual([{ ativa: false }])
    const outraDeB = await criarConta(b, 'Outra de B')
    await vincular(b, outraDeB, comB, 'membro')
    expect(await pergunta(outraDeB)).toEqual([{ ativa: true }])
  })
})

// ================================================================ B6

describe('B6: limites nas escritas novas', () => {
  it('exportações: 20 por conta por dia e bytes por comunidade', async () => {
    const com = await criarComunidade(b, 'Comunidade das Exportações')
    const org = await pessoaComSessao(b, app, config, 'Organizador Exporta')
    await vincular(b, org.id, com, 'organizador')
    const exportar = () => req('POST', `/api/v1/c/${com}/exportacoes`, org, { tipo: 'membros' })
    expect((await exportar()).statusCode).toBe(200)
    const hoje = "(now() at time zone 'America/Sao_Paulo')::date"
    await b.su.query(
      `update uj.cotas_diarias set quantidade = 20 where dia = ${hoje} and chave = $1`,
      [`exportacao:conta:${org.id}`],
    )
    const porConta = await exportar()
    expect(porConta.statusCode).toBe(429)
    expect(porConta.json().erro).toBe('cota_de_exportacao')
    await b.su.query(
      `update uj.cotas_diarias set quantidade = 0 where dia = ${hoje} and chave = $1`,
      [`exportacao:conta:${org.id}`],
    )
    await b.su.query(
      `update uj.cotas_diarias set quantidade = 50000000 where dia = ${hoje} and chave = $1`,
      [`exportacao:bytes:${com}`],
    )
    expect((await exportar()).statusCode).toBe(429)
  })

  it('sugestões e fila offline: passou do limite por conta, 429 com Retry-After', async () => {
    const com = await criarComunidade(b, 'Comunidade Insistente')
    const p = await pessoaComSessao(b, app, config, 'Pessoa Insistente')
    await vincular(b, p.id, com, 'organizador')
    for (let i = 0; i < ESCRITAS_POR_HORA.sugestoes; i++) {
      const r = await req('POST', `/api/v1/c/${com}/sugestoes`, p, {
        titulo: `Sugestão ${i}`,
        texto: 'Texto',
      })
      expect(r.statusCode, `sugestão ${i}`).toBe(200)
    }
    const passou = await req('POST', `/api/v1/c/${com}/sugestoes`, p, {
      titulo: 'Uma a mais',
      texto: 'Texto',
    })
    expect(passou.statusCode).toBe(429)
    expect(Number(passou.headers['retry-after'])).toBeGreaterThan(0)

    const sync = () =>
      req('POST', `/api/v1/c/${com}/sync/operacoes`, p, { operacoes: [{ incompleta: true }] })
    for (let i = 0; i < ESCRITAS_POR_HORA.sincronizacao; i++) {
      expect((await sync()).statusCode).toBe(200)
    }
    expect((await sync()).statusCode).toBe(429)
  })
})

// ================================================================ informativo

describe('associação de domínio por ambiente', () => {
  it('cada ambiente lista só o seu app, inclusive em webcredentials', () => {
    expect(appIdsIos('producao')).toEqual(['8DVJ2U5ZKX.com.solerte.unijovem'])
    expect(appIdsIos('homologacao')).toEqual(['8DVJ2U5ZKX.com.solerte.unijovem.hml'])
    expect(pacotesAndroid('producao')).toEqual(['com.solerte.unijovem'])
    expect(pacotesAndroid('homologacao')).toEqual(['com.solerte.unijovem.hml'])
  })
})
