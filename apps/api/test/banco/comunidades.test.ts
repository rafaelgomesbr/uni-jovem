import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import type { Correio, Mensagem } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
const caixa: Mensagem[] = []
const correio: Correio = {
  modo: 'arquivo',
  async enviar(m) {
    caixa.push(m)
  },
}
let com: string
let admin: Pessoa
let admin2: Pessoa
let organizador: Pessoa
let membro: Pessoa
let criador: Pessoa

const req = (metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, p: Pessoa, corpo?: object) =>
  app.inject({ method: metodo, url, headers: p.auth, ...(corpo ? { payload: corpo } : {}) })

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, { api: b.api, auth: b.auth, correio, fatorDeLimitePorIp: 100 })
  await app.ready()
  com = await criarComunidade(b, 'Jovens Central')
  admin = await pessoaComSessao(b, app, config, 'Admin')
  admin2 = await pessoaComSessao(b, app, config, 'Admin Dois')
  organizador = await pessoaComSessao(b, app, config, 'Organizadora')
  membro = await pessoaComSessao(b, app, config, 'Membro')
  criador = await pessoaComSessao(b, app, config, 'Criador', { criador: true })
  await vincular(b, admin.id, com, 'admin')
  await vincular(b, admin2.id, com, 'admin')
  await vincular(b, organizador.id, com, 'organizador')
  await vincular(b, membro.id, com, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('/api/v1/eu', () => {
  it('mostra a conta e só as comunidades da pessoa, com o papel em cada uma', async () => {
    const r = await req('GET', '/api/v1/eu', membro)
    expect(r.statusCode).toBe(200)
    expect(r.json().conta).toMatchObject({ id: membro.id, criador: false, doisFatores: false })
    expect(r.json().comunidades).toEqual([
      expect.objectContaining({ id: com, papel: 'membro', nome: 'Jovens Central' }),
    ])
  })

  it('altera nome e WhatsApp, valida o formato', async () => {
    expect(
      (
        await req('PATCH', '/api/v1/eu', membro, {
          nome: 'Membro Novo',
          whatsapp: '+5511900001111',
        })
      ).statusCode,
    ).toBe(200)
    const ruim = await req('PATCH', '/api/v1/eu', membro, { whatsapp: '11 9 0000' })
    expect(ruim.statusCode).toBe(400)
    expect(ruim.json().mensagem).toMatch(/DDI/)
  })

  it('lista e revoga aparelhos conectados', async () => {
    const lista = await req('GET', '/api/v1/eu/aparelhos', membro)
    const aparelhos = lista.json().aparelhos as { id: string; atual: boolean }[]
    expect(aparelhos.some((a) => a.atual)).toBe(true)
    const atual = aparelhos.find((a) => a.atual)!
    expect((await req('DELETE', `/api/v1/eu/aparelhos/${atual.id}`, membro)).statusCode).toBe(200)
    // A própria sessão caiu.
    expect((await req('GET', '/api/v1/eu', membro)).statusCode).toBe(401)
    membro = await pessoaComSessao(b, app, config, 'Membro reentrou')
    await vincular(b, membro.id, com, 'membro')
  })
})

describe('membros', () => {
  it('membro vê nomes sem contatos; organizador vê contatos', async () => {
    const deMembro = (await req('GET', `/api/v1/c/${com}/membros`, membro)).json().membros
    expect(deMembro.length).toBeGreaterThan(3)
    expect(deMembro.every((m: { email: string | null }) => m.email === null)).toBe(true)
    const deOrg = (await req('GET', `/api/v1/c/${com}/membros`, organizador)).json().membros
    expect(deOrg.every((m: { email: string | null }) => m.email !== null)).toBe(true)
  })

  it('admin muda papel e designa equipe de oração; tudo auditado', async () => {
    const vinculo = (await req('GET', `/api/v1/c/${com}/membros`, admin))
      .json()
      .membros.find((m: { contaId: string }) => m.contaId === membro.id)
    const r = await req('PATCH', `/api/v1/c/${com}/membros/${vinculo.vinculoId}`, admin, {
      papel: 'organizador',
      equipeDeOracao: true,
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ papel: 'organizador', designacoes: ['equipe_oracao'] })
    const aud = (await req('GET', `/api/v1/c/${com}/auditoria`, admin)).json().registros
    expect(aud[0]).toMatchObject({ acao: 'vinculo.alterado', recursoId: vinculo.vinculoId })
    // Volta ao papel original para os próximos testes.
    await req('PATCH', `/api/v1/c/${com}/membros/${vinculo.vinculoId}`, admin, { papel: 'membro' })
  })

  it('organizador e membro não alteram papéis (403)', async () => {
    const lista = (await req('GET', `/api/v1/c/${com}/membros`, admin)).json().membros
    const alvo = lista.find((m: { contaId: string }) => m.contaId === admin2.id)
    for (const p of [organizador, membro]) {
      const r = await req('PATCH', `/api/v1/c/${com}/membros/${alvo.vinculoId}`, p, {
        papel: 'membro',
      })
      expect(r.statusCode).toBe(403)
    }
  })

  it('ninguém mexe no próprio vínculo pela rota de membros', async () => {
    const meu = (await req('GET', `/api/v1/c/${com}/membros`, admin))
      .json()
      .membros.find((m: { contaId: string }) => m.contaId === admin.id)
    const r = await req('PATCH', `/api/v1/c/${com}/membros/${meu.vinculoId}`, admin, {
      papel: 'membro',
    })
    expect(r.statusCode).toBe(403)
  })

  it('último admin: a mensagem explica o que fazer', async () => {
    const c2 = await criarComunidade(b, 'Comunidade de um admin')
    await vincular(b, admin.id, c2, 'admin')
    const r = await req('POST', `/api/v1/c/${c2}/sair`, admin)
    expect(r.statusCode).toBe(409)
    expect(r.json().mensagem).toMatch(/Nomeie outra pessoa/)
  })

  it('membro pode sair da comunidade', async () => {
    const quemSai = await pessoaComSessao(b, app, config, 'Quem sai')
    await vincular(b, quemSai.id, com, 'membro')
    expect((await req('POST', `/api/v1/c/${com}/sair`, quemSai)).statusCode).toBe(200)
    expect((await req('GET', `/api/v1/c/${com}`, quemSai)).statusCode).toBe(404)
  })
})

describe('convites pela comunidade', () => {
  it('admin cria convite: link com token no fragmento, uma vez só', async () => {
    const r = await req('POST', `/api/v1/c/${com}/convites`, admin, { papel: 'organizador' })
    expect(r.statusCode).toBe(200)
    expect(r.json().link).toMatch(/^http:\/\/localhost:8081\/convite#t=[\w-]{40,}$/)
    const lista = (await req('GET', `/api/v1/c/${com}/convites`, admin)).json().convites
    expect(lista[0]).toMatchObject({ id: r.json().id, papel: 'organizador', situacao: 'valido' })
    expect(JSON.stringify(lista)).not.toContain(r.json().link.split('#t=')[1])
  })

  it('convite dirigido com envio por e-mail', async () => {
    const r = await req('POST', `/api/v1/c/${com}/convites`, admin, {
      papel: 'membro',
      email: 'novo@exemplo.test',
      enviarPorEmail: true,
    })
    await app.emAndamento()
    expect(caixa.at(-1)).toMatchObject({ para: 'novo@exemplo.test' })
    expect(caixa.at(-1)!.corpo).toContain(r.json().link)
  })

  it('organizador e membro não criam nem listam convites', async () => {
    for (const p of [organizador, membro]) {
      expect(
        (await req('POST', `/api/v1/c/${com}/convites`, p, { papel: 'membro' })).statusCode,
      ).toBe(403)
      expect((await req('GET', `/api/v1/c/${com}/convites`, p)).statusCode).toBe(403)
    }
  })

  it('validade acima de 7 dias é recusada', async () => {
    const r = await req('POST', `/api/v1/c/${com}/convites`, admin, {
      papel: 'membro',
      validadeDias: 30,
    })
    expect(r.statusCode).toBe(400)
  })

  it('revogar uma vez; de novo dá 404', async () => {
    const id = (await req('POST', `/api/v1/c/${com}/convites`, admin, { papel: 'membro' })).json()
      .id
    expect((await req('POST', `/api/v1/c/${com}/convites/${id}/revogar`, admin)).statusCode).toBe(
      200,
    )
    expect((await req('POST', `/api/v1/c/${com}/convites/${id}/revogar`, admin)).statusCode).toBe(
      404,
    )
  })
})

describe('comunidade suspensa', () => {
  it('membros ainda consultam; escrita recebe explicação clara', async () => {
    const c = await criarComunidade(b, 'Suspensa')
    await vincular(b, admin.id, c, 'admin')
    await b.dono.query("update uj.comunidades set estado = 'suspensa' where id = $1", [c])
    expect((await req('GET', `/api/v1/c/${c}`, admin)).statusCode).toBe(200)
    const r = await req('POST', `/api/v1/c/${c}/convites`, admin, { papel: 'membro' })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toBe('comunidade_suspensa')
  })
})

describe('plataforma (Criador)', () => {
  it('quem não é o Criador não usa a Plataforma (403), com ou sem 2FA', async () => {
    const comDoisFatores = await pessoaComSessao(b, app, config, 'Admin com 2FA', {
      doisFatores: true,
    })
    for (const p of [admin, membro, comDoisFatores]) {
      const r = await req('GET', '/api/v1/plataforma/comunidades', p)
      expect(r.statusCode).toBe(403)
      expect(r.json().erro).toBe('so_criador')
      const s = await req('GET', '/api/v1/plataforma/saude', p)
      expect(s.statusCode).toBe(403)
    }
  })

  it('Criador cria comunidade e recebe o convite do primeiro admin', async () => {
    const r = await req('POST', '/api/v1/plataforma/comunidades', criador, {
      nome: 'Jovens Norte',
      emailDoAdmin: 'lider.norte@exemplo.test',
    })
    expect(r.statusCode).toBe(200)
    const link = r.json().conviteDoPrimeiroAdmin.link as string
    const token = link.split('#t=')[1]!
    const consulta = await app.inject({
      method: 'POST',
      url: '/api/auth/convite/consultar',
      payload: { token },
    })
    expect(consulta.json()).toMatchObject({ situacao: 'valido', papel: 'admin' })
    const resumo = (await req('GET', '/api/v1/plataforma/comunidades', criador)).json().comunidades
    expect(resumo.find((c: { id: string }) => c.id === r.json().id)).toMatchObject({
      nome: 'Jovens Norte',
      membrosAtivos: 0,
    })
    // Criada pelo Criador: já verificada e sem "quem criou" (o Criador não é o admin).
    expect(resumo.find((c: { id: string }) => c.id === r.json().id)).toMatchObject({
      verificacao: 'verificada',
      criador: null,
    })
    // O resumo não traz nomes de membros.
    expect(JSON.stringify(resumo)).not.toContain('Admin')
  })

  it('Criador não entra em comunidade alheia pelas rotas comuns', async () => {
    expect((await req('GET', `/api/v1/c/${com}/membros`, criador)).statusCode).toBe(404)
  })

  it('exclusão exige digitar o nome; suspender e reativar', async () => {
    const c = await criarComunidade(b, 'Para excluir')
    const url = `/api/v1/plataforma/comunidades/${c}/estado`
    expect((await req('PATCH', url, criador, { estado: 'exclusao_agendada' })).statusCode).toBe(422)
    expect(
      (
        await req('PATCH', url, criador, {
          estado: 'exclusao_agendada',
          confirmacaoNome: 'Para excluir',
        })
      ).statusCode,
    ).toBe(200)
    const { rows } = await b.su.query(
      "select estado, exclusao_agendada_para > now() + interval '29 days' as carencia from uj.comunidades where id = $1",
      [c],
    )
    expect(rows).toEqual([{ estado: 'exclusao_agendada', carencia: true }])
    expect((await req('PATCH', url, criador, { estado: 'ativa' })).statusCode).toBe(200)
  })

  it('intervenção exige motivo e fica na auditoria da comunidade', async () => {
    const semMotivo = await req(
      'POST',
      `/api/v1/plataforma/comunidades/${com}/convites`,
      criador,
      {},
    )
    expect(semMotivo.statusCode).toBe(400)
    const r = await req('POST', `/api/v1/plataforma/comunidades/${com}/convites`, criador, {
      motivo: 'Comunidade pediu ajuda para trocar de liderança',
    })
    expect(r.statusCode).toBe(200)
    const aud = (await req('GET', `/api/v1/c/${com}/auditoria`, admin)).json().registros
    expect(aud.some((a: { acao: string }) => a.acao === 'plataforma.intervencao_convite')).toBe(
      true,
    )
  })

  it('transferência de propriedade: inicia, aceita com 2FA, espera 72 h, conclui', async () => {
    // Conta comum com 2FA: o login com o código gera a prova que o aceite exige.
    const destino = await pessoaComSessao(b, app, config, 'Sucessora', { doisFatores: true })
    const ini = await req('POST', '/api/v1/plataforma/transferencia', criador, {
      email: destino.email,
    })
    expect(ini.statusCode).toBe(200)
    expect(
      (await req('GET', '/api/v1/eu/transferencia', destino)).json().transferencia,
    ).toMatchObject({
      paraConta: destino.id,
    })
    expect((await req('POST', '/api/v1/eu/transferencia/aceitar', destino)).statusCode).toBe(200)
    const cedo = await req('POST', '/api/v1/eu/transferencia/concluir', criador)
    expect(cedo.json().erro).toBe('prazo_de_espera')
    await b.su.query(
      "update uj.transferencias_propriedade set efetiva_apos = now() - interval '1 minute' where concluida_em is null",
    )
    expect((await req('POST', '/api/v1/eu/transferencia/concluir', criador)).statusCode).toBe(200)
    const { rows } = await b.su.query<{ id: string }>(
      'select id from uj.contas where plataforma_proprietario',
    )
    expect(rows).toEqual([{ id: destino.id }])
  })
})
