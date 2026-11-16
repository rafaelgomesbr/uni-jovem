import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { TrabalhadorDePush } from '../../src/notificacoes/trabalhador.ts'
import {
  transporteEmArquivo,
  type MensagemPush,
  type TransportePush,
} from '../../src/notificacoes/transportes.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * F14: fila de notificações no banco (gatilhos), preferências, aparelho por
 * sessão e o trabalhador com o transporte em arquivo (o que iria para a rede).
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let org: Pessoa
let ana: Pessoa
let ambos: Pessoa
let bruno: Pessoa
let pasta: string
let arquivo: string
let trabalhador: TrabalhadorDePush

const TOKEN = {
  org: 'fcm-token-da-organizadora-0001',
  ana: 'fcm-token-da-ana-000000000001',
  ambos: 'fcm-token-de-quem-esta-em-a-e-b',
  bruno: 'fcm-token-do-bruno-so-em-b-001',
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, url: string, p: Pessoa, corpo?: object) =>
  app.inject({ method: metodo, url, headers: p.auth, ...(corpo ? { payload: corpo } : {}) })

const registrar = (p: Pessoa, token: string) =>
  req('PUT', '/api/v1/eu/notificacoes/aparelho', p, { plataforma: 'android', token })

async function enviados(): Promise<(MensagemPush & { token: string })[]> {
  await trabalhador.processarUmaVez()
  try {
    return (await readFile(arquivo, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as MensagemPush & { token: string })
  } catch {
    return []
  }
}

async function publicarAviso(titulo: string, texto: string, com = comA): Promise<string> {
  const r = await req('POST', `/api/v1/c/${com}/avisos`, org, { titulo, texto, publicar: true })
  expect(r.statusCode).toBe(200)
  return r.json().id as string
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
  comA = await criarComunidade(b, 'Comunidade Batista do Vale')
  comB = await criarComunidade(b, 'Comunidade B')
  org = await pessoaComSessao(b, app, config, 'Organizadora')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  ambos = await pessoaComSessao(b, app, config, 'Carla')
  bruno = await pessoaComSessao(b, app, config, 'Bruno')
  await vincular(b, org.id, comA, 'organizador')
  await vincular(b, org.id, comB, 'organizador')
  await vincular(b, ana.id, comA, 'membro')
  await vincular(b, ambos.id, comA, 'membro')
  await vincular(b, ambos.id, comB, 'membro')
  await vincular(b, bruno.id, comB, 'membro')
  pasta = await mkdtemp(join(tmpdir(), 'uj-push-'))
  arquivo = join(pasta, 'push.jsonl')
  trabalhador = new TrabalhadorDePush(b.auth, transporteEmArquivo(arquivo))
  for (const [p, t] of [
    [org, TOKEN.org],
    [ana, TOKEN.ana],
    [ambos, TOKEN.ambos],
    [bruno, TOKEN.bruno],
  ] as const) {
    expect((await registrar(p, t)).statusCode).toBe(200)
  }
})

afterAll(async () => {
  await trabalhador.parar()
  await app.close()
  await b.encerrar()
  await rm(pasta, { recursive: true, force: true })
})

beforeEach(async () => {
  await rm(arquivo, { force: true })
})

describe('aviso publicado', () => {
  it('chega a quem é de A, nunca a B nem a quem publicou, e sem conteúdo sensível', async () => {
    const avisoId = await publicarAviso(
      'Oração pela saúde da Maria',
      'Texto sigiloso com o telefone 11 91234-5678',
    )
    const lista = await enviados()
    const tokens = lista.map((m) => m.token).sort()
    expect(tokens).toEqual([`…${TOKEN.ambos.slice(-6)}`, `…${TOKEN.ana.slice(-6)}`].sort())
    const bruto = JSON.stringify(lista)
    for (const proibido of ['Maria', 'sigiloso', '91234', 'Batista', 'Vale', 'Organizadora']) {
      expect(bruto).not.toContain(proibido)
    }
    for (const m of lista) {
      expect(m.titulo).toBe('Novo aviso')
      expect(m.dados).toMatchObject({ comunidadeId: comA, tipo: 'avisos', recursoId: avisoId })
    }
    // Ninguém de B recebeu, nem como notificação na fila.
    const deB = await b.su.query(
      'select 1 from uj.notificacoes where conta_id = $1 or comunidade_id = $2',
      [bruno.id, comB],
    )
    expect(deB.rows).toEqual([])
  })

  it('não duplica: publicar, despublicar e publicar de novo gera uma notificação por pessoa', async () => {
    const id = await publicarAviso('Aviso repetido', 'Texto')
    await req('POST', `/api/v1/c/${comA}/avisos/${id}/despublicar`, org)
    await req('POST', `/api/v1/c/${comA}/avisos/${id}/publicar`, org)
    const { rows } = await b.su.query<{ n: number }>(
      'select count(*)::int as n from uj.notificacoes where recurso_id = $1 and conta_id = $2',
      [id, ana.id],
    )
    expect(rows[0]!.n).toBe(1)
    expect((await enviados()).filter((m) => m.token.endsWith(TOKEN.ana.slice(-6)))).toHaveLength(1)
  })
})

describe('preferências', () => {
  it('tipo desligado na comunidade: nada é enfileirado nem enviado', async () => {
    const r = await req('PUT', `/api/v1/c/${comA}/notificacoes/preferencias`, ana, {
      tipos: { avisos: false },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().tipos).toContainEqual({ tipo: 'avisos', ativo: false })
    const id = await publicarAviso('Sem aviso para a Ana', 'Texto')
    const fila = await b.su.query(
      'select 1 from uj.notificacoes where recurso_id = $1 and conta_id = $2',
      [id, ana.id],
    )
    expect(fila.rows).toEqual([])
    expect((await enviados()).map((m) => m.token)).toEqual([`…${TOKEN.ambos.slice(-6)}`])
    await req('PUT', `/api/v1/c/${comA}/notificacoes/preferencias`, ana, {
      tipos: { avisos: true },
    })
  })

  it('comunidade silenciada ("todas") vale só para ela', async () => {
    await req('PUT', `/api/v1/c/${comA}/notificacoes/preferencias`, ambos, { todas: false })
    await publicarAviso('Em A', 'Texto')
    await publicarAviso('Em B', 'Texto', comB)
    const lista = await enviados()
    const deCarla = lista.filter((m) => m.token.endsWith(TOKEN.ambos.slice(-6)))
    expect(deCarla.map((m) => m.dados['comunidadeId'])).toEqual([comB])
    await req('PUT', `/api/v1/c/${comA}/notificacoes/preferencias`, ambos, { todas: true })
  })

  it('preferência desligada depois de enfileirar: o envio é descartado', async () => {
    await publicarAviso('Desliguei depois', 'Texto')
    await req('PUT', `/api/v1/c/${comA}/notificacoes/preferencias`, ana, {
      tipos: { avisos: false },
    })
    const lista = await enviados()
    expect(lista.some((m) => m.token.endsWith(TOKEN.ana.slice(-6)))).toBe(false)
    await req('PUT', `/api/v1/c/${comA}/notificacoes/preferencias`, ana, {
      tipos: { avisos: true },
    })
  })

  it('versículo do dia: preferência da conta, ligada às 07:00 por padrão', async () => {
    const padrao = await req('GET', '/api/v1/eu/notificacoes', ana)
    expect(padrao.json().versiculo).toEqual({ ativo: true, hora: '07:00' })
    expect(padrao.json().aparelhoAtual.registrado).toBe(true)
    const mudou = await req('PUT', '/api/v1/eu/notificacoes', ana, { versiculoHora: '06:30' })
    expect(mudou.json().versiculo).toEqual({ ativo: true, hora: '06:30' })
    expect(
      (await req('PUT', '/api/v1/eu/notificacoes', ana, { versiculoHora: '25:00' })).statusCode,
    ).toBe(400)
  })
})

describe('aparelho e sessão', () => {
  it('sair da conta silencia o aparelho: o token some e nada é enviado a ele', async () => {
    const dani = await pessoaComSessao(b, app, config, 'Dani')
    await vincular(b, dani.id, comA, 'membro')
    const token = 'fcm-token-da-dani-que-vai-sair'
    expect((await registrar(dani, token)).statusCode).toBe(200)
    expect(
      (await app.inject({ method: 'POST', url: '/api/auth/sair', headers: dani.auth })).statusCode,
    ).toBe(200)
    const sobrou = await b.su.query('select 1 from uj.aparelhos_push where conta_id = $1', [
      dani.id,
    ])
    expect(sobrou.rows).toEqual([])
    await publicarAviso('Depois da saída', 'Texto')
    expect((await enviados()).some((m) => m.token.endsWith(token.slice(-6)))).toBe(false)
  })

  it('o mesmo token registrado por outra conta deixa de ser da primeira', async () => {
    const eva = await pessoaComSessao(b, app, config, 'Eva')
    await vincular(b, eva.id, comB, 'membro')
    const token = 'fcm-token-de-aparelho-emprestado'
    await registrar(eva, token)
    const fabio = await pessoaComSessao(b, app, config, 'Fabio')
    await registrar(fabio, token)
    const { rows } = await b.su.query<{ conta_id: string }>(
      'select conta_id from uj.aparelhos_push where token = $1',
      [token],
    )
    expect(rows).toEqual([{ conta_id: fabio.id }])
  })

  it('token recusado pelo provedor é expurgado', async () => {
    const recusa: TransportePush = {
      async enviar() {
        return { resultado: 'token_invalido', erro: 'fcm_UNREGISTERED' }
      },
    }
    const gina = await pessoaComSessao(b, app, config, 'Gina')
    await vincular(b, gina.id, comA, 'membro')
    await registrar(gina, 'fcm-token-que-o-google-recusa')
    // Só o envio da Gina passa pelo transporte que recusa; os outros vão ao arquivo.
    const misto: TransportePush = {
      enviar: (m) =>
        m.token === 'fcm-token-que-o-google-recusa'
          ? recusa.enviar(m)
          : transporteEmArquivo(arquivo).enviar(m),
    }
    await publicarAviso('Para a Gina', 'Texto')
    await new TrabalhadorDePush(b.auth, misto).processarUmaVez()
    const { rows } = await b.su.query('select 1 from uj.aparelhos_push where conta_id = $1', [
      gina.id,
    ])
    expect(rows).toEqual([])
  })

  it('token com formato inválido é recusado na entrada', async () => {
    const r = await req('PUT', '/api/v1/eu/notificacoes/aparelho', ana, {
      plataforma: 'ios',
      token: 'nao-e-hexadecimal',
    })
    expect(r.statusCode).toBe(400)
  })
})

describe('eventos, escalas, substituições e inscrições', () => {
  it('escala no rascunho avisa ao publicar; cancelar avisa escalados e inscritos', async () => {
    const vinculoAna = (
      await b.su.query<{ id: string }>(
        'select id from uj.vinculos where conta_id = $1 and comunidade_id = $2',
        [ana.id, comA],
      )
    ).rows[0]!.id
    const inicio = new Date(Date.now() + 7 * 24 * 3600_000).toISOString()
    const evento = await req('POST', `/api/v1/c/${comA}/eventos`, org, {
      titulo: 'Retiro de jovens',
      categoria: 'Retiro',
      inicio,
      duracaoMin: 120,
    })
    const eventoId = evento.json().id as string
    await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/atribuicoes`, org, {
      vinculoId: vinculoAna,
    })
    // Rascunho: ainda nada.
    let titulos = (
      await b.su.query<{ titulo: string }>(
        'select titulo from uj.notificacoes where conta_id = $1 and tipo = $2',
        [ana.id, 'escalas'],
      )
    ).rows
    expect(titulos).toEqual([])
    await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/status`, org, { status: 'publicado' })
    await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/inscricoes/eu`, ambos)
    await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/status`, org, {
      status: 'cancelado',
      motivo: 'Chuva forte na estrada',
    })
    titulos = (
      await b.su.query<{ titulo: string }>(
        `select titulo from uj.notificacoes where comunidade_id = $1 and conta_id = $2
          order by criado_em`,
        [comA, ana.id],
      )
    ).rows
    expect(titulos.map((t) => t.titulo)).toEqual(
      expect.arrayContaining(['Nova convocação', 'Evento cancelado']),
    )
    const carla = await b.su.query<{ titulo: string; corpo: string }>(
      `select titulo, corpo from uj.notificacoes where conta_id = $1 and recurso_id = $2`,
      [ambos.id, eventoId],
    )
    expect(carla.rows).toHaveLength(1)
    expect(JSON.stringify(carla.rows)).not.toContain('Chuva')
    expect(JSON.stringify(carla.rows)).not.toContain('Retiro')
  })

  it('substituição dirigida leva só o primeiro nome de quem pediu; o aceite avisa quem pediu', async () => {
    const vinculos = Object.fromEntries(
      (
        await b.su.query<{ conta_id: string; id: string }>(
          'select conta_id, id from uj.vinculos where comunidade_id = $1',
          [comA],
        )
      ).rows.map((r) => [r.conta_id, r.id]),
    )
    const inicio = new Date(Date.now() + 9 * 24 * 3600_000).toISOString()
    const eventoId = (
      await req('POST', `/api/v1/c/${comA}/eventos`, org, {
        titulo: 'Culto jovem',
        categoria: 'Culto',
        inicio,
        duracaoMin: 90,
      })
    ).json().id as string
    await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/status`, org, { status: 'publicado' })
    const atrib = await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/atribuicoes`, org, {
      vinculoId: vinculos[ana.id],
    })
    const atribuicaoId = atrib.json().id as string
    const pedido = await req(
      'POST',
      `/api/v1/c/${comA}/atribuicoes/${atribuicaoId}/substituicao`,
      ana,
      { motivo: 'Consulta médica', paraVinculoId: vinculos[ambos.id] },
    )
    expect(pedido.statusCode).toBe(200)
    const paraCarla = await b.su.query<{ corpo: string }>(
      "select corpo from uj.notificacoes where conta_id = $1 and tipo = 'substituicoes'",
      [ambos.id],
    )
    expect(paraCarla.rows.map((r) => r.corpo)).toEqual([
      'Ana pediu para você assumir uma escala. Abra o app para responder.',
    ])
    expect(JSON.stringify(paraCarla.rows)).not.toContain('médica')
    const substituicaoId = (
      await b.su.query<{ id: string }>('select id from uj.substituicoes where atribuicao_id = $1', [
        atribuicaoId,
      ])
    ).rows[0]!.id
    await req('POST', `/api/v1/c/${comA}/substituicoes/${substituicaoId}/assumir`, ambos)
    const paraAna = await b.su.query<{ titulo: string }>(
      "select titulo from uj.notificacoes where conta_id = $1 and tipo = 'substituicoes'",
      [ana.id],
    )
    expect(paraAna.rows.map((r) => r.titulo)).toEqual(['Substituição aceita'])
  })

  it('inscrição promovida da lista de espera avisa a pessoa promovida', async () => {
    const inicio = new Date(Date.now() + 10 * 24 * 3600_000).toISOString()
    const eventoId = (
      await req('POST', `/api/v1/c/${comA}/eventos`, org, {
        titulo: 'Passeio',
        categoria: 'Passeio',
        inicio,
        duracaoMin: 60,
        capacidade: 1,
        listaDeEspera: true,
      })
    ).json().id as string
    await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/status`, org, { status: 'publicado' })
    const primeira = await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/inscricoes/eu`, ana)
    const segunda = await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/inscricoes/eu`, ambos)
    expect(segunda.json().estado).toBe('espera')
    await req('POST', `/api/v1/c/${comA}/inscricoes/${primeira.json().inscricaoId}/cancelar`, ana)
    const { rows } = await b.su.query<{ titulo: string }>(
      "select titulo from uj.notificacoes where conta_id = $1 and tipo = 'inscricoes'",
      [ambos.id],
    )
    expect(rows.map((r) => r.titulo)).toEqual(['Vaga confirmada'])
  })
})
