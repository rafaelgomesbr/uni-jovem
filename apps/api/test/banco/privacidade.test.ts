import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gerarToken, hmacDeToken } from '../../src/autenticacao/cripto.ts'
import { carregarConfig } from '../../src/config.ts'
import type { Correio, Mensagem } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import {
  criarComunidade,
  criarConta,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, SENHA_PADRAO, type Pessoa } from '../apoio/pessoas.ts'

/**
 * F18: consentimentos versionados e idade, exclusão de conta, exportação,
 * saída e remoção (art. 16), denúncias, inscrição pública (TC-04 e "apagar
 * agora"), páginas de política e associação de domínio.
 */

const IMPRESSAO = Array.from({ length: 32 }, () => 'AB').join(':')
const config = carregarConfig(
  envDeTeste({ SUPORTE_EMAIL: 'ajuda@exemplo.test', ANDROID_SHA256_IMPRESSOES: IMPRESSAO }),
)
const caixa: Mensagem[] = []
const correio: Correio = {
  modo: 'arquivo',
  async enviar(m) {
    caixa.push(m)
  },
}

let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let admin: Pessoa

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, url: string, p: Pessoa | null, corpo?: object) =>
  app.inject({
    method: metodo,
    url,
    ...(p ? { headers: p.auth } : {}),
    ...(corpo ? { payload: corpo } : {}),
  })

async function convite(comunidadeId = com): Promise<string> {
  const token = gerarToken()
  await b.su.query(
    `insert into uj.convites (comunidade_id, papel, token_hmac, expira_em, criado_por)
     values ($1, 'membro', $2, now() + interval '7 days', $3)`,
    [comunidadeId, hmacDeToken(token, config.CONVITE_SEGREDO), admin.id],
  )
  return token
}

/** Varre todas as colunas de texto do esquema `uj` atrás de um valor. */
async function ondeAparece(valor: string): Promise<string[]> {
  const { rows } = await b.su.query<{ t: string; c: string }>(
    `select table_name as t, column_name as c from information_schema.columns
      where table_schema = 'uj' and data_type in ('text', 'jsonb', 'character varying', 'ARRAY')`,
  )
  const achados: string[] = []
  for (const { t, c } of rows) {
    const r = await b.su.query(`select 1 from uj.${t} where ${c}::text ilike $1 limit 1`, [
      `%${valor}%`,
    ])
    if (r.rows.length > 0) achados.push(`${t}.${c}`)
  }
  return achados
}

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, { api: b.api, auth: b.auth, correio, fatorDeLimitePorIp: 100 })
  await app.ready()
  com = await criarComunidade(b, 'Jovens da Esperança')
  admin = await pessoaComSessao(b, app, config, 'Admin Principal')
  await vincular(b, admin.id, com, 'admin')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

// ================================================================ consentimentos e idade

describe('consentimentos versionados e idade (TC-01 a TC-03)', () => {
  const ini = (token: string, email: string, extra: object = {}) =>
    req('POST', '/api/auth/convite/iniciar', null, {
      token,
      nome: 'Pessoa Nova',
      email,
      ...extra,
    })
  const codigo = () => caixa.at(-1)!.corpo.match(/é (\d{6})/)![1]!

  it('menor de 16 para no início: nada gravado e o convite continua valendo', async () => {
    const token = await convite()
    const r = await ini(token, 'menor@exemplo.test', { faixaEtaria: 'menos_16' })
    expect(r.statusCode).toBe(422)
    expect(r.json().erro).toBe('menor_de_16')
    expect(r.json().mensagem).toContain('16 anos ou mais')
    const v = await b.su.query(
      "select 1 from uj.verificacoes_email where email = 'menor@exemplo.test'",
    )
    expect(v.rows).toEqual([])
    const consulta = await req('POST', '/api/auth/convite/consultar', null, { token })
    expect(consulta.json().situacao).toBe('valido')
  })

  it('sem termos, sem a caixa da fé ou 16-17 sem o responsável: a conta não é criada', async () => {
    const token = await convite()
    const r = await ini(token, 'jovem@exemplo.test')
    const base = {
      token,
      verificacaoId: r.json().verificacaoId,
      codigo: codigo(),
      nome: 'Pessoa Nova',
      senha: SENHA_PADRAO,
      plataforma: 'android',
    }
    const semTermos = await req('POST', '/api/auth/convite/concluir', null, {
      ...base,
      faixaEtaria: '18_mais',
      consentimentoFe: true,
    })
    expect(semTermos.statusCode).toBe(400)
    expect(semTermos.json().mensagem).toContain('Termos de Uso')
    const semFe = await req('POST', '/api/auth/convite/concluir', null, {
      ...base,
      faixaEtaria: '18_mais',
      aceiteTermos: true,
    })
    expect(semFe.statusCode).toBe(400)
    const semResponsavel = await req('POST', '/api/auth/convite/concluir', null, {
      ...base,
      faixaEtaria: '16_17',
      aceiteTermos: true,
      consentimentoFe: true,
    })
    expect(semResponsavel.statusCode).toBe(422)
    expect(
      (await b.su.query("select 1 from uj.contas where email = 'jovem@exemplo.test'")).rows,
    ).toEqual([])

    const ok = await req('POST', '/api/auth/convite/concluir', null, {
      ...base,
      faixaEtaria: '16_17',
      aceiteTermos: true,
      consentimentoFe: true,
      responsavelCiente: true,
    })
    expect(ok.statusCode).toBe(200)
    const { rows } = await b.su.query<{
      texto_id: string
      versao: number
      forma: string
      faixa_etaria: string | null
      confirmacao_adicional: boolean | null
      comunidade_id: string | null
    }>(
      `select c.texto_id, c.versao, c.forma, c.faixa_etaria, c.confirmacao_adicional, c.comunidade_id
         from uj.consentimentos c join uj.contas a on a.id = c.conta_id
        where a.email = 'jovem@exemplo.test' order by c.texto_id`,
    )
    expect(rows).toEqual([
      {
        texto_id: 'TC-01',
        versao: 1,
        forma: 'android',
        faixa_etaria: '16_17',
        confirmacao_adicional: null,
        comunidade_id: null,
      },
      {
        texto_id: 'TC-02',
        versao: 1,
        forma: 'android',
        faixa_etaria: null,
        confirmacao_adicional: null,
        comunidade_id: null,
      },
      {
        texto_id: 'TC-03',
        versao: 2,
        forma: 'android',
        faixa_etaria: null,
        confirmacao_adicional: true,
        comunidade_id: com,
      },
    ])
    const faixa = await b.su.query(
      "select faixa_etaria from uj.contas where email = 'jovem@exemplo.test'",
    )
    expect(faixa.rows).toEqual([{ faixa_etaria: '16_17' }])
  })

  it('conta antiga sem idade declarada declara ao aceitar; menos de 16 nunca é gravado', async () => {
    const antiga = await pessoaComSessao(b, app, config, 'Conta Antiga')
    const outra = await criarComunidade(b, 'Outra Comunidade')
    const token = await convite(outra)
    const sem = await req('POST', '/api/auth/convite/aceitar', antiga, {
      token,
      consentimentoFe: true,
    })
    expect(sem.statusCode).toBe(422)
    expect(sem.json().erro).toBe('faixa_etaria_necessaria')
    const menor = await req('PUT', '/api/v1/eu/faixa-etaria', antiga, { faixa: 'menos_16' })
    expect(menor.statusCode).toBe(422)
    const ok = await req('POST', '/api/auth/convite/aceitar', antiga, {
      token,
      consentimentoFe: true,
      faixaEtaria: '18_mais',
    })
    expect(ok.statusCode).toBe(200)
    const textos = await b.su.query<{ texto_id: string }>(
      'select texto_id from uj.consentimentos where conta_id = $1 order by texto_id',
      [antiga.id],
    )
    expect(textos.rows.map((r) => r.texto_id)).toEqual(['TC-01', 'TC-03'])
  })

  it('convite que não vale responde o motivo antes de pedir a idade (N2)', async () => {
    const semFaixa = await pessoaComSessao(b, app, config, 'Sem Faixa Declarada')
    const outra = await criarComunidade(b, 'Comunidade do Convite Revogado')
    const aceitar = (token: string) =>
      req('POST', '/api/auth/convite/aceitar', semFaixa, { token, consentimentoFe: true })

    const revogado = await convite(outra)
    await b.su.query('update uj.convites set revogado_em = now() where token_hmac = $1', [
      hmacDeToken(revogado, config.CONVITE_SEGREDO),
    ])
    const r = await aceitar(revogado)
    expect(r.statusCode).toBe(409)
    expect(r.json()).toEqual({
      erro: 'convite_indisponivel',
      situacao: 'revogado',
      mensagem: 'Este convite foi cancelado por quem convidou. Peça um novo.',
    })

    const vencido = await convite(outra)
    await b.su.query(
      `update uj.convites set criado_em = now() - interval '2 days', expira_em = now() - interval '1 day'
        where token_hmac = $1`,
      [hmacDeToken(vencido, config.CONVITE_SEGREDO)],
    )
    expect((await aceitar(vencido)).json()).toMatchObject({
      erro: 'convite_indisponivel',
      situacao: 'expirado',
    })
    expect((await aceitar(gerarToken())).json()).toMatchObject({
      erro: 'convite_indisponivel',
      situacao: 'inexistente',
    })

    const dirigido = gerarToken()
    await b.su.query(
      `insert into uj.convites (comunidade_id, papel, email_destino, token_hmac, expira_em, criado_por)
       values ($1, 'membro', 'outra.pessoa@exemplo.test', $2, now() + interval '7 days', $3)`,
      [outra, hmacDeToken(dirigido, config.CONVITE_SEGREDO), admin.id],
    )
    const outroEmail = await aceitar(dirigido)
    expect(outroEmail.statusCode).toBe(409)
    expect(outroEmail.json().erro).toBe('convite_de_outro_email')

    // Nada foi gravado: nem idade, nem vínculo, nem consentimento.
    const conta = await b.su.query(
      `select a.faixa_etaria,
              (select count(*)::int from uj.vinculos v where v.conta_id = a.id) as vinculos,
              (select count(*)::int from uj.consentimentos c where c.conta_id = a.id) as consentimentos
         from uj.contas a where a.id = $1`,
      [semFaixa.id],
    )
    expect(conta.rows).toEqual([{ faixa_etaria: null, vinculos: 0, consentimentos: 0 }])
    // Convite válido: agora sim, a idade é pedida.
    const valido = await aceitar(await convite(outra))
    expect(valido.json().erro).toBe('faixa_etaria_necessaria')
  })
})

// ================================================================ exclusão de conta

describe('excluir conta', () => {
  it('senha errada: 401 com a mensagem do login; 2FA ligado exige o código', async () => {
    const p = await pessoaComSessao(b, app, config, 'Senha Errada')
    const r = await req('POST', '/api/v1/eu/excluir-conta', p, { senha: 'não é esta senha' })
    expect(r.statusCode).toBe(401)
    expect(r.json().erro).toBe('credenciais_invalidas')
    const com2fa = await pessoaComSessao(b, app, config, 'Com Dois Fatores', { doisFatores: true })
    const r2 = await req('POST', '/api/v1/eu/excluir-conta', com2fa, { senha: SENHA_PADRAO })
    expect(r2.statusCode).toBe(401)
    expect(r2.json().erro).toBe('segundo_fator_necessario')
  })

  it('única admin de comunidade com outras pessoas: 409 dizendo o que fazer, com a comunidade', async () => {
    const unica = await pessoaComSessao(b, app, config, 'Unica Admin')
    const outra = await criarComunidade(b, 'Comunidade da Única')
    await vincular(b, unica.id, outra, 'admin')
    const membro = await criarConta(b, 'Membro da Única')
    await vincular(b, membro, outra, 'membro')
    const r = await req('POST', '/api/v1/eu/excluir-conta', unica, { senha: SENHA_PADRAO })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toMatchObject({
      erro: 'unico_admin',
      acao: 'nomear_admin',
      comunidades: [{ id: outra, nome: 'Comunidade da Única' }],
    })
    expect(r.json().mensagem).toContain('nomeie outra pessoa')
  })

  it('única pessoa da comunidade (não há a quem nomear): a exclusão não trava', async () => {
    const sozinha = await pessoaComSessao(b, app, config, 'Sozinha')
    const deserta = await criarComunidade(b, 'Comunidade Vazia')
    await vincular(b, sozinha.id, deserta, 'admin')
    const r = await req('POST', '/api/v1/eu/excluir-conta', sozinha, { senha: SENHA_PADRAO })
    expect(r.statusCode).toBe(200)
  })

  it('o Criador não exclui a conta sem transferir a propriedade', async () => {
    const criador = await criarConta(b, 'Criador', { proprietario: true })
    // Com a prova de reautenticação (o que a API grava depois de conferir senha e 2FA).
    await b.su.query(
      `insert into uj.provas_de_reautenticacao (prova_hash, conta_id, finalidade, expira_em)
       values (sha256('prova-do-criador'::bytea), $1, 'excluir_conta', now() + interval '1 minute')`,
      [criador],
    )
    await expect(
      b.auth.query('select uj.excluir_conta($1, $2)', [criador, 'prova-do-criador']),
    ).rejects.toMatchObject({ code: 'UJ040' })
  })

  it('apaga oração, nome, e-mail e WhatsApp de todo o banco, mantém os números e avisa o e-mail antigo', async () => {
    const z = await pessoaComSessao(b, app, config, 'Zuleica Exclusiva')
    const vz = await vincular(b, z.id, com, 'membro')
    await req('PATCH', '/api/v1/eu', z, { whatsapp: '+5511977776666' })
    const pedido = await req('POST', `/api/v1/c/${com}/oracao`, z, {
      texto: 'Pedido secreto da Zuleica',
      visibilidade: 'comunidade',
    })
    expect(pedido.statusCode).toBe(200)
    await req('PUT', `/api/v1/c/${com}/disponibilidade/2030-01-05`, z, { disponivel: true })
    await req('POST', `/api/v1/c/${com}/sugestoes`, z, { titulo: 'Sugestão dela', texto: 'Texto' })
    // Passado (fica, sem nome) e futuro (sai).
    const passado = (
      await b.dono.query<{ id: string }>(
        `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
         values ($1, 'Evento passado', 'Outra', now() - interval '10 days', 60, 'America/Sao_Paulo', $2, 'encerrado')
         returning id`,
        [com, admin.id],
      )
    ).rows[0]!.id
    const futuro = (
      await b.dono.query<{ id: string }>(
        `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
         values ($1, 'Evento futuro', 'Outra', now() + interval '10 days', 60, 'America/Sao_Paulo', $2, 'publicado')
         returning id`,
        [com, admin.id],
      )
    ).rows[0]!.id
    await b.dono.query(
      'insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id) values ($1, $2, $3), ($1, $4, $3)',
      [com, passado, vz, futuro],
    )
    await b.dono.query(
      `insert into uj.presencas (comunidade_id, evento_id, vinculo_id, origem, registrada_por, chave_idempotencia)
       values ($1, $2, $3, 'manual', $3, gen_random_uuid())`,
      [com, passado, vz],
    )
    const contagens = async () =>
      (
        await b.su.query(
          `select (select count(*) from uj.presencas where comunidade_id = $1) as presencas,
                  (select count(*) from uj.atribuicoes a join uj.eventos e on e.id = a.evento_id
                    where a.comunidade_id = $1 and e.inicio < now()) as escalas_passadas,
                  (select count(*) from uj.sugestoes where comunidade_id = $1) as sugestoes`,
          [com],
        )
      ).rows[0]
    const antes = await contagens()

    caixa.length = 0
    const r = await req('POST', '/api/v1/eu/excluir-conta', z, { senha: SENHA_PADRAO })
    expect(r.statusCode).toBe(200)
    await app.emAndamento()

    for (const valor of ['Zuleica Exclusiva', z.email, '977776666']) {
      expect(await ondeAparece(valor), valor).toEqual([])
    }
    expect(
      (await b.su.query('select 1 from uj.pedidos_oracao where autor_conta_id = $1', [z.id])).rows,
    ).toEqual([])
    expect(
      (await b.su.query('select 1 from uj.disponibilidades where vinculo_id = $1', [vz])).rows,
    ).toEqual([])
    expect(
      (await b.su.query('select 1 from uj.atribuicoes where evento_id = $1', [futuro])).rows,
    ).toEqual([])
    expect(await contagens()).toEqual(antes)
    expect((await b.su.query('select 1 from uj.sessoes where conta_id = $1', [z.id])).rows).toEqual(
      [],
    )
    const conta = await b.su.query('select nome, estado from uj.contas where id = $1', [z.id])
    expect(conta.rows).toEqual([{ nome: 'Pessoa removida', estado: 'anonimizada' }])
    expect(
      (await b.su.query('select 1 from uj.exclusoes_de_conta where conta_id = $1', [z.id])).rows,
    ).toHaveLength(1)
    // O aparelho que ainda tinha o token de acesso perde a sessão.
    expect((await req('GET', '/api/v1/eu', z)).statusCode).toBe(401)
    expect(caixa.map((m) => m.para)).toEqual([z.email])
    expect(caixa[0]!.corpo).not.toContain('Esperança')
    // Para os outros, o nome some do histórico.
    const pessoas = await b.comoApi<{ nome: string }>(
      { contaId: admin.id, comunidadeId: com },
      'select nome from uj.pessoas_da_comunidade() where vinculo_id = $1',
      [vz],
    )
    expect(pessoas).toEqual([{ nome: 'Pessoa removida' }])
  })
})

// ================================================================ exportação

describe('exportar meus dados', () => {
  it('tem tudo do titular, com a oração decifrada, e nada de outra pessoa', async () => {
    const titular = await pessoaComSessao(b, app, config, 'Titular Exporta')
    const vizinha = await pessoaComSessao(b, app, config, 'Vizinha Reservada')
    await vincular(b, titular.id, com, 'membro')
    await vincular(b, vizinha.id, com, 'membro')
    await req('POST', `/api/v1/c/${com}/oracao`, titular, {
      texto: 'Meu pedido para exportar',
      visibilidade: 'somente_eu',
    })
    const daVizinha = await req('POST', `/api/v1/c/${com}/oracao`, vizinha, {
      texto: 'Pedido da vizinha',
      visibilidade: 'comunidade',
    })
    await req('POST', `/api/v1/c/${com}/oracao/${daVizinha.json().id}/orando`, titular)
    await req('POST', `/api/v1/c/${com}/sugestoes`, titular, {
      titulo: 'Minha sugestão anônima',
      texto: 'Texto',
      anonima: true,
    })
    const r = await req('GET', '/api/v1/eu/exportar', titular)
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-disposition']).toContain('attachment')
    expect(r.headers['cache-control']).toBe('no-store')
    const d = r.json()
    expect(d.conta.email).toBe(titular.email)
    expect(d.pedidosDeOracao).toHaveLength(1)
    expect(d.pedidosDeOracao[0].texto).toBe('Meu pedido para exportar')
    expect(d.pedidosDeOracao[0].textoCifrado).toBeUndefined()
    expect(d.intercessoes).toHaveLength(1)
    expect(d.sugestoes.map((s: { titulo: string }) => s.titulo)).toEqual(['Minha sugestão anônima'])
    const bruto = r.body
    for (const alheio of [
      'Pedido da vizinha',
      'Vizinha Reservada',
      vizinha.email,
      'Admin Principal',
    ]) {
      expect(bruto).not.toContain(alheio)
    }
  })
})

// ================================================================ sair e remoção (art. 16)

describe('sair da comunidade e remoção pelo administrador', () => {
  it('sair apaga oração, disponibilidade e escalas futuras e desliga o histórico do nome', async () => {
    const s = await pessoaComSessao(b, app, config, 'Saulo Saindo')
    const vs = await vincular(b, s.id, com, 'membro')
    await req('POST', `/api/v1/c/${com}/oracao`, s, {
      texto: 'Oração do Saulo',
      visibilidade: 'comunidade',
    })
    await req('PUT', `/api/v1/c/${com}/disponibilidade/2030-02-02`, s, { disponivel: false })
    await req('POST', `/api/v1/c/${com}/sugestoes`, s, { titulo: 'Ideia do Saulo', texto: 'Texto' })
    const futuro = (
      await b.dono.query<{ id: string }>(
        `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
         values ($1, 'Futuro do Saulo', 'Outra', now() + interval '5 days', 60, 'America/Sao_Paulo', $2, 'publicado')
         returning id`,
        [com, admin.id],
      )
    ).rows[0]!.id
    await b.dono.query(
      'insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id) values ($1, $2, $3)',
      [com, futuro, vs],
    )
    const r = await req('POST', `/api/v1/c/${com}/sair`, s)
    expect(r.statusCode).toBe(200)
    expect(
      (await b.su.query('select 1 from uj.pedidos_oracao where autor_conta_id = $1', [s.id])).rows,
    ).toEqual([])
    expect(
      (await b.su.query('select 1 from uj.disponibilidades where vinculo_id = $1', [vs])).rows,
    ).toEqual([])
    expect(
      (await b.su.query('select 1 from uj.atribuicoes where vinculo_id = $1', [vs])).rows,
    ).toEqual([])
    // O vínculo e a autoria passam para uma conta anonimizada; a conta da pessoa continua.
    const v = await b.su.query<{ conta_id: string; anonimizado: boolean }>(
      'select conta_id, anonimizado_em is not null as anonimizado from uj.vinculos where id = $1',
      [vs],
    )
    expect(v.rows[0]!.conta_id).not.toBe(s.id)
    expect(v.rows[0]!.anonimizado).toBe(true)
    const sug = await b.comoApi<{ autor_nome: string | null }>(
      { contaId: admin.id, comunidadeId: com },
      "select autor_nome from uj.sugestoes_visiveis() where titulo = 'Ideia do Saulo'",
    )
    expect(sug).toEqual([{ autor_nome: 'Pessoa removida' }])
    expect((await b.su.query('select estado from uj.contas where id = $1', [s.id])).rows).toEqual([
      { estado: 'ativa' },
    ])
    // Volta só como pessoa nova: um convite cria outro vínculo.
    const token = await convite()
    const volta = await req('POST', '/api/auth/convite/aceitar', s, {
      token,
      consentimentoFe: true,
      faixaEtaria: '18_mais',
    })
    expect(volta.statusCode).toBe(200)
    expect(volta.json().vinculoId).not.toBe(vs)
  })

  it('remoção pelo admin: oculta na hora; depois de 30 dias, o job aplica o mesmo efeito', async () => {
    const r = await pessoaComSessao(b, app, config, 'Rita Removida')
    const vr = await vincular(b, r.id, com, 'membro')
    await req('POST', `/api/v1/c/${com}/oracao`, r, {
      texto: 'Oração da Rita',
      visibilidade: 'comunidade',
    })
    const resp = await req('PATCH', `/api/v1/c/${com}/membros/${vr}`, admin, { estado: 'removido' })
    expect(resp.statusCode).toBe(200)
    // Ainda guardado (pode ser desfeito em 30 dias), mas invisível para a comunidade.
    expect(
      (await b.su.query('select 1 from uj.pedidos_oracao where autor_conta_id = $1', [r.id])).rows,
    ).toHaveLength(1)
    const lista = await req('GET', `/api/v1/c/${com}/oracao`, admin)
    expect(JSON.stringify(lista.json())).not.toContain('Oração da Rita')
    await b.dono.query(
      "update uj.vinculos set removido_em = now() - interval '31 days' where id = $1",
      [vr],
    )
    const rel = await b.dono.query<{ r: Record<string, number> }>(
      'select uj.executar_retencao() as r',
    )
    expect(rel.rows[0]!.r['vinculos_removidos_desligados']).toBeGreaterThanOrEqual(1)
    expect(
      (await b.su.query('select 1 from uj.pedidos_oracao where autor_conta_id = $1', [r.id])).rows,
    ).toEqual([])
    const v = await b.su.query<{ conta_id: string }>(
      'select conta_id from uj.vinculos where id = $1',
      [vr],
    )
    expect(v.rows[0]!.conta_id).not.toBe(r.id)
  })
})

// ================================================================ denúncias

describe('denúncias (Apple 1.2)', () => {
  it('membro denuncia oração da comunidade; admin vê a fila sem quem denunciou e retira o conteúdo', async () => {
    const autora = await pessoaComSessao(b, app, config, 'Autora Denunciada')
    const denunciante = await pessoaComSessao(b, app, config, 'Denunciante')
    await vincular(b, autora.id, com, 'membro')
    await vincular(b, denunciante.id, com, 'membro')
    const publico = await req('POST', `/api/v1/c/${com}/oracao`, autora, {
      texto: 'Conteúdo impróprio',
      visibilidade: 'comunidade',
    })
    const privado = await req('POST', `/api/v1/c/${com}/oracao`, autora, {
      texto: 'Só meu',
      visibilidade: 'somente_eu',
    })
    // O que a pessoa não vê não pode ser denunciado (nem confirmado que existe).
    const invisivel = await req('POST', `/api/v1/c/${com}/denuncias`, denunciante, {
      recursoTipo: 'pedido_oracao',
      recursoId: privado.json().id,
      motivo: 'ofensivo',
    })
    expect(invisivel.statusCode).toBe(404)
    const d = await req('POST', `/api/v1/c/${com}/denuncias`, denunciante, {
      recursoTipo: 'pedido_oracao',
      recursoId: publico.json().id,
      motivo: 'ofensivo',
      detalhe: 'Linguagem agressiva',
    })
    expect(d.statusCode).toBe(200)
    // Repetir não abre outra.
    const de_novo = await req('POST', `/api/v1/c/${com}/denuncias`, denunciante, {
      recursoTipo: 'pedido_oracao',
      recursoId: publico.json().id,
      motivo: 'ofensivo',
    })
    expect(de_novo.json().id).toBe(d.json().id)
    expect((await req('GET', `/api/v1/c/${com}/denuncias`, denunciante)).statusCode).toBe(403)
    const fila = await req('GET', `/api/v1/c/${com}/denuncias`, admin)
    expect(fila.statusCode).toBe(200)
    expect(fila.json().denuncias).toHaveLength(1)
    expect(JSON.stringify(fila.json())).not.toContain(denunciante.id)
    const aud = await b.su.query<{ conta_id: string | null }>(
      "select conta_id from uj.auditoria where acao = 'denuncia.criada'",
    )
    expect(aud.rows.every((x) => x.conta_id === null)).toBe(true)
    const resolver = await req('PATCH', `/api/v1/c/${com}/denuncias/${d.json().id}`, admin, {
      estado: 'procedente',
      resolucao: 'Conteúdo retirado da comunidade.',
      retirarConteudo: true,
    })
    expect(resolver.statusCode).toBe(200)
    const vis = await b.su.query('select visibilidade from uj.pedidos_oracao where id = $1', [
      publico.json().id,
    ])
    expect(vis.rows).toEqual([{ visibilidade: 'somente_eu' }])
    expect(
      (
        await req('PATCH', `/api/v1/c/${com}/denuncias/${d.json().id}`, admin, {
          estado: 'improcedente',
        })
      ).statusCode,
    ).toBe(404)
  })
})

// ================================================================ inscrição pública

describe('inscrição pública: TC-04 e "cancelar e apagar agora"', () => {
  async function eventoPublico(): Promise<string> {
    return (
      await b.dono.query<{ id_publico: string }>(
        `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status, visibilidade)
         values ($1, 'Show aberto', 'Outra', now() + interval '3 days', 60, 'America/Sao_Paulo', $2, 'publicado', 'publica')
         returning id_publico`,
        [com, admin.id],
      )
    ).rows[0]!.id_publico
  }
  const formulario = (idPublico: string, dados: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: `/e/${idPublico}/inscricao`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(dados).toString(),
    })

  it('o formulário mostra o TC-04 com o prazo e exige a confirmação de idade', async () => {
    const id = await eventoPublico()
    const pagina = await app.inject({ method: 'GET', url: `/e/${id}` })
    expect(pagina.body).toContain('comunidade religiosa')
    expect(pagina.body).toContain('apagados 90 dias')
    expect(pagina.body).toContain('16 anos ou mais')
    const semIdade = await formulario(id, {
      nome: 'Visitante',
      telefone: '11911112222',
      consentimento: 'sim',
    })
    expect(semIdade.statusCode).toBe(400)
    expect(semIdade.body).toContain('confirme a idade')
  })

  it('registra o consentimento versionado e apaga na hora pelo link', async () => {
    const id = await eventoPublico()
    const ok = await formulario(id, {
      nome: 'Visitante Apagável',
      telefone: '11933334444',
      email: 'visitante@exemplo.test',
      consentimento: 'sim',
      idade: 'sim',
    })
    expect(ok.statusCode).toBe(200)
    const token = ok.body.match(/cancelar#t=([\w-]+)/)![1]!
    const cons = await b.su.query<{
      texto_id: string
      forma: string
      confirmacao_adicional: boolean
    }>(
      `select c.texto_id, c.forma, c.confirmacao_adicional from uj.consentimentos c
         join uj.inscricoes i on i.id = c.inscricao_id where i.telefone = '+5511933334444'`,
    )
    expect(cons.rows).toEqual([
      { texto_id: 'TC-04', forma: 'pagina_publica', confirmacao_adicional: true },
    ])
    const tela = await app.inject({ method: 'GET', url: `/e/${id}/cancelar` })
    expect(tela.body).toContain('Cancelar e apagar meus dados agora')
    const apagar = await app.inject({
      method: 'POST',
      url: `/e/${id}/cancelar`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ token, acao: 'apagar' }).toString(),
    })
    expect(apagar.statusCode).toBe(200)
    expect(apagar.body).toContain('dados apagados')
    expect(await ondeAparece('Visitante Apagável')).toEqual([])
    expect(await ondeAparece('933334444')).toEqual([])
    // O link não vale mais.
    const deNovo = await app.inject({
      method: 'POST',
      url: `/e/${id}/cancelar`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ token, acao: 'apagar' }).toString(),
    })
    expect(deNovo.statusCode).toBe(404)
  })
})

// ================================================================ páginas e associação

describe('páginas públicas de política e suporte', () => {
  it('/privacidade, /termos e /excluir-conta: do documento, sem notas internas, com aviso de rascunho e CSP', async () => {
    for (const [url, trecho] of [
      ['/privacidade', 'Política de Privacidade'],
      ['/termos', 'Termos de Uso'],
      ['/excluir-conta', 'Excluir sua conta do Uni Jovem'],
    ] as const) {
      const r = await app.inject({ method: 'GET', url })
      expect(r.statusCode, url).toBe(200)
      expect(r.headers['content-security-policy']).toContain("default-src 'self'")
      expect(r.body).toContain(trecho)
      expect(r.body).toContain('Rascunho em revisão jurídica')
      expect(r.body).not.toContain('REVISÃO JURÍDICA')
      expect(r.body).not.toContain('IMPLEMENTAÇÃO')
      expect(r.body).not.toMatch(/Anexo \(não publicar\)/)
      expect(r.body).not.toContain('<script')
    }
    const privacidade = await app.inject({ method: 'GET', url: '/privacidade' })
    expect(privacidade.body).toContain('id="fe"')
    expect(privacidade.body).toContain('id="inscricao"')
    // O app (novo pedido de oração) aponta para /privacidade#oracao.
    expect(privacidade.body).toContain('id="oracao"')
    // O aviso de rascunho não fala mais em trechos a completar: não sobrou nenhum.
    expect(privacidade.body).not.toContain('Trechos entre colchetes')
  })

  it('/suporte mostra o e-mail configurado e os caminhos', async () => {
    const r = await app.inject({ method: 'GET', url: '/suporte' })
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('mailto:ajuda@exemplo.test')
    expect(r.body).toContain('href="/excluir-conta"')
    expect(r.body).toContain('href="/privacidade"')
  })

  it('associação de domínio: iOS (convite e app) e Android (impressões da configuração)', async () => {
    // Desenvolvimento usa o app de homologação; só ele é associado.
    const aasa = await app.inject({ method: 'GET', url: '/.well-known/apple-app-site-association' })
    expect(aasa.headers['content-type']).toContain('application/json')
    expect(aasa.json().applinks.details[0]).toEqual({
      appIDs: ['8DVJ2U5ZKX.com.solerte.unijovem.hml'],
      components: [{ '/': '/convite*' }, { '/': '/app/*' }],
    })
    expect(aasa.json().webcredentials).toEqual({ apps: ['8DVJ2U5ZKX.com.solerte.unijovem.hml'] })
    const links = await app.inject({ method: 'GET', url: '/.well-known/assetlinks.json' })
    expect(links.json()).toHaveLength(1)
    expect(links.json()[0].target.package_name).toBe('com.solerte.unijovem.hml')
    expect(links.json()[0].target.sha256_cert_fingerprints).toEqual([IMPRESSAO])

    const semImpressao = criarServidor(carregarConfig(envDeTeste()), {
      api: b.api,
      auth: b.auth,
      correio,
    })
    const vazio = await semImpressao.inject({ method: 'GET', url: '/.well-known/assetlinks.json' })
    expect(vazio.json()).toEqual([])
    await semImpressao.close()
  })
})
