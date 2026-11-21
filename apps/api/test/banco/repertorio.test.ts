import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Repertório do encontro, cifra com aviso de direitos e "Meu repertório" (D61,
 * migração 0027): permissões por papel, isolamento entre comunidades (id de B
 * dá 404 na rota e é barrado pelo gatilho mesmo com a API contornada), RLS e o
 * aviso à banda pela fila de notificações.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let orgA: Pessoa
let adminA: Pessoa
let membroA: Pessoa
let ana: Pessoa
let bia: Pessoa
let cris: Pessoa
let dani: Pessoa
let orgB: Pessoa
const v: Record<string, string> = {}

const CIFRA = '{key: G}\n[G]Sobre a rocha eu [D]firmo\n[Em]Quando o vento [C]vem'
const AVISO = {
  titulo: 'Repertório atualizado',
  corpo: 'O repertório do louvor foi atualizado. Abra o app para ver.',
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, com: string, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

let dias = 3
interface Encontro {
  eventoId: string
  louvorId: string
  palavraId: string
}
async function novoEncontro(com: string, org: Pessoa, publicar = true): Promise<Encontro> {
  const inicio = new Date(Date.now() + dias++ * 86_400_000).toISOString()
  const r = await req('POST', com, '/eventos', org, {
    titulo: 'Sábado com a juventude',
    categoria: 'Programação de sábado',
    inicio,
    duracaoMin: 120,
  })
  expect(r.statusCode).toBe(200)
  const eventoId = r.json().id as string
  const louvor = await req('POST', com, `/eventos/${eventoId}/etapas`, org, {
    titulo: 'Louvor',
    duracaoMin: 15,
  })
  const palavra = await req('POST', com, `/eventos/${eventoId}/etapas`, org, {
    titulo: 'Palavra',
    duracaoMin: 30,
  })
  if (publicar) {
    const p = await req('POST', com, `/eventos/${eventoId}/status`, org, { status: 'publicado' })
    expect(p.statusCode).toBe(200)
  }
  return {
    eventoId,
    louvorId: louvor.json().id as string,
    palavraId: palavra.json().id as string,
  }
}

async function novaMusica(com: string, org: Pessoa, titulo: string, extra: object = {}) {
  const r = await req('POST', com, '/conteudos/musicas', org, {
    titulo,
    tom: 'G',
    cifra: CIFRA,
    direitosConfirmados: true,
    ...extra,
  })
  expect(r.statusCode).toBe(200)
  return r.json().id as string
}

async function convocar(
  com: string,
  org: Pessoa,
  eventoId: string,
  vinculoId: string,
  etapaId: string | null,
  funcao: string,
) {
  const r = await req('POST', com, `/eventos/${eventoId}/atribuicoes`, org, {
    vinculoId,
    etapaId,
    funcao,
  })
  expect(r.statusCode).toBe(200)
  return r.json().id as string
}

async function avisos(eventoId: string) {
  return (
    await b.su.query<{
      conta_id: string
      comunidade_id: string
      tipo: string
      titulo: string
      corpo: string
    }>(
      `select conta_id, comunidade_id, tipo, titulo, corpo from uj.notificacoes
        where recurso_id = $1 and titulo = $2`,
      [eventoId, AVISO.titulo],
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
  adminA = await pessoaComSessao(b, app, config, 'Abel')
  membroA = await pessoaComSessao(b, app, config, 'Mara')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  bia = await pessoaComSessao(b, app, config, 'Bia')
  cris = await pessoaComSessao(b, app, config, 'Cris')
  dani = await pessoaComSessao(b, app, config, 'Dani')
  orgB = await pessoaComSessao(b, app, config, 'Otto')
  await vincular(b, orgA.id, comA, 'organizador')
  await vincular(b, adminA.id, comA, 'admin')
  await vincular(b, membroA.id, comA, 'membro')
  v['ana'] = await vincular(b, ana.id, comA, 'membro')
  v['bia'] = await vincular(b, bia.id, comA, 'membro')
  v['cris'] = await vincular(b, cris.id, comA, 'membro')
  v['dani'] = await vincular(b, dani.id, comA, 'membro')
  await vincular(b, orgB.id, comB, 'organizador')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('cifra e aviso de direitos autorais', () => {
  it('cifra nova sem a confirmação de direitos: 400, nada gravado', async () => {
    const r = await req('POST', comA, '/conteudos/musicas', orgA, {
      titulo: 'Sem aviso',
      cifra: CIFRA,
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toBe('direitos_nao_confirmados')
    const { rows } = await b.su.query("select 1 from uj.musicas where titulo = 'Sem aviso'")
    expect(rows).toEqual([])
  })

  it('com a confirmação, grava e registra a data do aceite', async () => {
    const id = await novaMusica(comA, orgA, 'Com aviso', { andamentoBpm: 72, duracaoSeg: 245 })
    const { rows } = await b.su.query<{ d: Date | null; andamento_bpm: number }>(
      'select direito_confirmado_em as d, andamento_bpm from uj.musicas where id = $1',
      [id],
    )
    expect(rows[0]!.d).not.toBeNull()
    expect(rows[0]!.andamento_bpm).toBe(72)
  })

  it('música sem cifra não pede confirmação', async () => {
    const r = await req('POST', comA, '/conteudos/musicas', orgA, { titulo: 'Só o título' })
    expect(r.statusCode).toBe(200)
  })

  it('mudar a cifra pede a confirmação de novo; mudar outro campo ou repetir a mesma, não', async () => {
    const id = await novaMusica(comA, orgA, 'Editável')
    const musica = (await req('GET', comA, `/conteudos/musicas/${id}`, orgA)).json()
    // Outro campo: sem confirmação.
    const outro = await req('PATCH', comA, `/conteudos/musicas/${id}`, orgA, {
      versao: musica.versao,
      artista: 'Ministério Exemplo',
    })
    expect(outro.statusCode).toBe(200)
    // A mesma cifra de novo (o app envia o formulário inteiro): sem confirmação.
    const igual = await req('PATCH', comA, `/conteudos/musicas/${id}`, orgA, {
      versao: outro.json().versao,
      cifra: CIFRA,
    })
    expect(igual.statusCode).toBe(200)
    // Cifra diferente: pede.
    const sem = await req('PATCH', comA, `/conteudos/musicas/${id}`, orgA, {
      versao: igual.json().versao,
      cifra: '[A]Outra cifra',
    })
    expect(sem.statusCode).toBe(400)
    expect(sem.json().erro).toBe('direitos_nao_confirmados')
    const com = await req('PATCH', comA, `/conteudos/musicas/${id}`, orgA, {
      versao: igual.json().versao,
      cifra: '[A]Outra cifra',
      direitosConfirmados: true,
    })
    expect(com.statusCode).toBe(200)
  })

  it('o banco recusa cifra sem o aceite mesmo com a rota contornada, e o dono (semente) não é barrado', async () => {
    await expect(
      b.comoApi(
        { contaId: orgA.id, comunidadeId: comA },
        `insert into uj.musicas (comunidade_id, titulo, cifra) values ($1, 'Contornada', '[G]a')`,
        [comA],
      ),
    ).rejects.toMatchObject({ code: 'UJ100' })
    await b.dono.query(
      `insert into uj.musicas (comunidade_id, titulo, cifra, criado_por)
       values ($1, 'Semente', '[G]a', $2)`,
      [comA, orgA.id],
    )
  })

  it('a lista traz "temCifra" sem o texto da cifra; o detalhe traz a cifra', async () => {
    const id = await novaMusica(comA, orgA, 'Lista e detalhe')
    const lista = (await req('GET', comA, '/conteudos/musicas', membroA)).json().itens as {
      id: string
      cifra?: string
      temCifra: boolean
    }[]
    const item = lista.find((m) => m.id === id)!
    expect(item.temCifra).toBe(true)
    expect(item.cifra).toBeUndefined()
    expect(lista.find((m) => m.temCifra === false)).toBeDefined()
    const detalhe = (await req('GET', comA, `/conteudos/musicas/${id}`, membroA)).json()
    expect(detalhe.cifra).toBe(CIFRA)
  })

  it('tom normalizado, andamento e duração com limites', async () => {
    const ok = await req('POST', comA, '/conteudos/musicas', orgA, {
      titulo: 'Tom bonito',
      tom: 'a♭',
    })
    expect(ok.statusCode).toBe(200)
    const lido = (await req('GET', comA, `/conteudos/musicas/${ok.json().id}`, orgA)).json()
    expect(lido.tom).toBe('Ab')
    for (const corpo of [
      { titulo: 'x', tom: 'xyz' },
      { titulo: 'x', andamentoBpm: 10 },
      { titulo: 'x', andamentoBpm: 400 },
      { titulo: 'x', duracaoSeg: 5 },
    ]) {
      expect((await req('POST', comA, '/conteudos/musicas', orgA, corpo)).statusCode).toBe(400)
    }
  })

  it('membro lê a cifra e não cadastra', async () => {
    expect(
      (
        await req('POST', comA, '/conteudos/musicas', membroA, {
          titulo: 'Tentativa',
          cifra: CIFRA,
          direitosConfirmados: true,
        })
      ).statusCode,
    ).toBe(403)
  })
})

describe('repertório do encontro', () => {
  it('organizador monta; ordem e tom do dia; a etapa padrão é a do Louvor', async () => {
    const enc = await novoEncontro(comA, orgA)
    const m1 = await novaMusica(comA, orgA, 'Primeira', { duracaoSeg: 240 })
    const m2 = await novaMusica(comA, orgA, 'Segunda')
    const a = await req('POST', comA, `/eventos/${enc.eventoId}/repertorio`, orgA, {
      musicaId: m1,
      tomDoDia: 'a',
      nota: 'Entra só o coro',
    })
    expect(a.statusCode).toBe(200)
    expect(a.json()).toMatchObject({ ordem: 0, versao: 1 })
    const b2 = await req('POST', comA, `/eventos/${enc.eventoId}/repertorio`, orgA, {
      musicaId: m2,
    })
    expect(b2.json()).toMatchObject({ ordem: 1 })

    const lista = (await req('GET', comA, `/eventos/${enc.eventoId}/repertorio`, orgA)).json()
      .itens as Record<string, unknown>[]
    expect(lista.map((i) => i['titulo'])).toEqual(['Primeira', 'Segunda'])
    expect(lista[0]).toMatchObject({
      tomDoDia: 'A',
      tomOriginal: 'G',
      nota: 'Entra só o coro',
      etapaId: enc.louvorId,
      duracaoSeg: 240,
      temCifra: true,
    })
    expect(lista[0]!['cifra']).toBeUndefined()
    expect(lista[1]!['tomDoDia']).toBeNull()

    // Mudar o tom do dia e apagar a observação; versão errada = 409.
    const id = lista[0]!['id'] as string
    const muda = await req('PATCH', comA, `/eventos/${enc.eventoId}/repertorio/${id}`, orgA, {
      versao: 1,
      tomDoDia: 'Bb',
      nota: '',
    })
    expect(muda.statusCode).toBe(200)
    expect(muda.json().versao).toBe(2)
    expect(
      (
        await req('PATCH', comA, `/eventos/${enc.eventoId}/repertorio/${id}`, orgA, {
          versao: 1,
          tomDoDia: 'C',
        })
      ).statusCode,
    ).toBe(409)
    const depois = (await req('GET', comA, `/eventos/${enc.eventoId}/repertorio`, orgA)).json()
      .itens as Record<string, unknown>[]
    expect(depois[0]).toMatchObject({ tomDoDia: 'Bb', nota: null })
    // A música da biblioteca não mudou.
    expect((await req('GET', comA, `/conteudos/musicas/${m1}`, orgA)).json().tom).toBe('G')
  })

  it('mesma música duas vezes: 409; tom inválido e observação longa: 400', async () => {
    const enc = await novoEncontro(comA, orgA)
    const m = await novaMusica(comA, orgA, 'Repetida')
    const url = `/eventos/${enc.eventoId}/repertorio`
    expect((await req('POST', comA, url, orgA, { musicaId: m })).statusCode).toBe(200)
    expect((await req('POST', comA, url, orgA, { musicaId: m })).statusCode).toBe(409)
    const outra = await novaMusica(comA, orgA, 'Outra')
    expect(
      (await req('POST', comA, url, orgA, { musicaId: outra, tomDoDia: 'Z9' })).statusCode,
    ).toBe(400)
    expect(
      (await req('POST', comA, url, orgA, { musicaId: outra, nota: 'x'.repeat(301) })).statusCode,
    ).toBe(400)
  })

  it('reordena com a lista inteira, tira e fecha o buraco; lista errada = 409', async () => {
    const enc = await novoEncontro(comA, orgA)
    const ids: string[] = []
    for (const t of ['Um', 'Dois', 'Três']) {
      const m = await novaMusica(comA, orgA, t)
      const r = await req('POST', comA, `/eventos/${enc.eventoId}/repertorio`, orgA, {
        musicaId: m,
      })
      ids.push(r.json().id as string)
    }
    const ordem = (await req('PUT', comA, `/eventos/${enc.eventoId}/repertorio/ordem`, orgA, {
      ids: [ids[2]!, ids[0]!, ids[1]!],
    })) as { statusCode: number }
    expect(ordem.statusCode).toBe(200)
    const titulos = async () =>
      (
        (await req('GET', comA, `/eventos/${enc.eventoId}/repertorio`, orgA)).json().itens as {
          titulo: string
          ordem: number
        }[]
      ).map((i) => `${i.ordem}:${i.titulo}`)
    expect(await titulos()).toEqual(['0:Três', '1:Um', '2:Dois'])

    for (const errada of [
      [ids[0]!],
      [ids[0]!, ids[0]!, ids[1]!],
      [ids[0]!, ids[1]!, ids[2]!, ids[0]!],
    ]) {
      expect(
        (await req('PUT', comA, `/eventos/${enc.eventoId}/repertorio/ordem`, orgA, { ids: errada }))
          .statusCode,
      ).toBe(409)
    }

    const tira = await req('DELETE', comA, `/eventos/${enc.eventoId}/repertorio/${ids[0]}`, orgA)
    expect(tira.statusCode).toBe(200)
    expect(await titulos()).toEqual(['0:Três', '1:Dois'])
    expect(
      (await req('DELETE', comA, `/eventos/${enc.eventoId}/repertorio/${ids[0]}`, orgA)).statusCode,
    ).toBe(404)
  })

  it('permissões por papel: membro lê, não edita nem avisa; admin edita', async () => {
    const enc = await novoEncontro(comA, orgA)
    const m = await novaMusica(comA, orgA, 'Permissões')
    const url = `/eventos/${enc.eventoId}/repertorio`
    const item = (await req('POST', comA, url, orgA, { musicaId: m })).json().id as string
    // Membro: só leitura.
    expect((await req('GET', comA, url, membroA)).statusCode).toBe(200)
    expect((await req('POST', comA, url, membroA, { musicaId: m })).statusCode).toBe(403)
    expect(
      (await req('PATCH', comA, `${url}/${item}`, membroA, { tomDoDia: 'A' })).statusCode,
    ).toBe(403)
    expect((await req('DELETE', comA, `${url}/${item}`, membroA)).statusCode).toBe(403)
    expect((await req('PUT', comA, `${url}/ordem`, membroA, { ids: [item] })).statusCode).toBe(403)
    expect((await req('POST', comA, `${url}/avisar`, membroA)).statusCode).toBe(403)
    // O banco também segura: membro gravando direto na tabela.
    await expect(
      b
        .comoApi(
          { contaId: membroA.id, comunidadeId: comA },
          `update uj.repertorio_itens set tom_do_dia = 'C' where id = $1`,
          [item],
        )
        .then((r) => r),
    ).resolves.toEqual([])
    const tom = await b.su.query<{ tom_do_dia: string | null }>(
      'select tom_do_dia from uj.repertorio_itens where id = $1',
      [item],
    )
    expect(tom.rows[0]!.tom_do_dia).toBeNull()
    // Administrador edita (nível acima do organizador).
    expect((await req('PATCH', comA, `${url}/${item}`, adminA, { tomDoDia: 'D' })).statusCode).toBe(
      200,
    )
  })

  it('encontro em rascunho: membro não vê o repertório (404); organizador vê', async () => {
    const enc = await novoEncontro(comA, orgA, false)
    const m = await novaMusica(comA, orgA, 'Rascunho')
    const url = `/eventos/${enc.eventoId}/repertorio`
    expect((await req('POST', comA, url, orgA, { musicaId: m })).statusCode).toBe(200)
    expect((await req('GET', comA, url, membroA)).statusCode).toBe(404)
    expect(((await req('GET', comA, url, orgA)).json().itens as unknown[]).length).toBe(1)
    // O banco: o membro não lê as linhas do rascunho nem direto na tabela.
    const lidas = await b.comoApi(
      { contaId: membroA.id, comunidadeId: comA },
      'select id from uj.repertorio_itens where evento_id = $1',
      [enc.eventoId],
    )
    expect(lidas).toEqual([])
    // Publicado, o membro passa a ver.
    await req('POST', comA, `/eventos/${enc.eventoId}/status`, orgA, { status: 'publicado' })
    expect(((await req('GET', comA, url, membroA)).json().itens as unknown[]).length).toBe(1)
  })

  it('o repertório sai com o encontro e com a música (em cascata)', async () => {
    const enc = await novoEncontro(comA, orgA)
    const m = await novaMusica(comA, orgA, 'Cascata')
    await req('POST', comA, `/eventos/${enc.eventoId}/repertorio`, orgA, { musicaId: m })
    expect((await req('DELETE', comA, `/conteudos/musicas/${m}`, orgA)).statusCode).toBe(200)
    expect(
      (
        (await req('GET', comA, `/eventos/${enc.eventoId}/repertorio`, orgA)).json()
          .itens as unknown[]
      ).length,
    ).toBe(0)
  })

  it('o log de mudanças leva só ids: nunca o título nem a cifra', async () => {
    const enc = await novoEncontro(comA, orgA)
    const m = await novaMusica(comA, orgA, 'Título que não pode vazar')
    const item = (
      await req('POST', comA, `/eventos/${enc.eventoId}/repertorio`, orgA, { musicaId: m })
    ).json().id as string
    const { rows } = await b.su.query<Record<string, unknown>>(
      `select * from uj.mudancas where tabela = 'repertorio_itens' and registro_id = $1`,
      [item],
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(JSON.stringify(rows)).not.toContain('Título que não pode vazar')
    expect(JSON.stringify(rows)).not.toContain('firmo')
  })
})

describe('isolamento do repertório', () => {
  it('música, etapa e item de outra comunidade: 404 na rota, nada gravado', async () => {
    const encA = await novoEncontro(comA, orgA)
    const encB = await novoEncontro(comB, orgB)
    const musicaB = await novaMusica(comB, orgB, 'Música de B')
    const musicaA = await novaMusica(comA, orgA, 'Música de A')
    const itemB = (
      await req('POST', comB, `/eventos/${encB.eventoId}/repertorio`, orgB, { musicaId: musicaB })
    ).json().id as string
    const urlA = `/eventos/${encA.eventoId}/repertorio`

    // musicaId de B no corpo, no encontro de A.
    expect((await req('POST', comA, urlA, orgA, { musicaId: musicaB })).statusCode).toBe(404)
    // etapaId de B no corpo.
    expect(
      (await req('POST', comA, urlA, orgA, { musicaId: musicaA, etapaId: encB.louvorId }))
        .statusCode,
    ).toBe(404)
    // Etapa de outro encontro da MESMA comunidade também é 404.
    const outroDeA = await novoEncontro(comA, orgA)
    expect(
      (await req('POST', comA, urlA, orgA, { musicaId: musicaA, etapaId: outroDeA.louvorId }))
        .statusCode,
    ).toBe(404)
    // Encontro de B pela comunidade de A.
    expect((await req('GET', comA, `/eventos/${encB.eventoId}/repertorio`, orgA)).statusCode).toBe(
      404,
    )
    expect(
      (await req('POST', comA, `/eventos/${encB.eventoId}/repertorio`, orgA, { musicaId: musicaA }))
        .statusCode,
    ).toBe(404)
    // Item de B pelo encontro de A e pelo de B, com a comunidade de A.
    for (const alvo of [encA.eventoId, encB.eventoId]) {
      expect(
        (await req('PATCH', comA, `/eventos/${alvo}/repertorio/${itemB}`, orgA, { tomDoDia: 'C' }))
          .statusCode,
      ).toBe(404)
      expect(
        (await req('DELETE', comA, `/eventos/${alvo}/repertorio/${itemB}`, orgA)).statusCode,
      ).toBe(404)
    }
    expect(
      (await req('PUT', comA, `/eventos/${encB.eventoId}/repertorio/ordem`, orgA, { ids: [itemB] }))
        .statusCode,
    ).toBe(404)
    expect(
      (await req('POST', comA, `/eventos/${encB.eventoId}/repertorio/avisar`, orgA)).statusCode,
    ).toBe(404)

    const naoGravou = await b.su.query('select 1 from uj.repertorio_itens where evento_id = $1', [
      encA.eventoId,
    ])
    expect(naoGravou.rows).toEqual([])
    const doB = await b.su.query<{ tom_do_dia: string | null }>(
      'select tom_do_dia from uj.repertorio_itens where id = $1',
      [itemB],
    )
    expect(doB.rows).toHaveLength(1)
    expect(doB.rows[0]!.tom_do_dia).toBeNull()
  })

  it('o gatilho barra música e etapa de outra comunidade mesmo vindo do dono do banco', async () => {
    const encA = await novoEncontro(comA, orgA)
    const encB = await novoEncontro(comB, orgB)
    const musicaB = await novaMusica(comB, orgB, 'Música de B (gatilho)')
    const musicaA = await novaMusica(comA, orgA, 'Música de A (gatilho)')
    await expect(
      b.dono.query(
        `insert into uj.repertorio_itens (comunidade_id, evento_id, musica_id, ordem)
         values ($1, $2, $3, 0)`,
        [comA, encA.eventoId, musicaB],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    await expect(
      b.dono.query(
        `insert into uj.repertorio_itens (comunidade_id, evento_id, musica_id, ordem)
         values ($1, $2, $3, 0)`,
        [comA, encB.eventoId, musicaA],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    await expect(
      b.dono.query(
        `insert into uj.repertorio_itens (comunidade_id, evento_id, etapa_id, musica_id, ordem)
         values ($1, $2, $3, $4, 0)`,
        [comA, encA.eventoId, encB.louvorId, musicaA],
      ),
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('RLS: quem não tem vínculo na comunidade não lê nem grava o repertório dela', async () => {
    const encB = await novoEncontro(comB, orgB)
    const musicaB = await novaMusica(comB, orgB, 'Música de B (RLS)')
    const itemB = (
      await req('POST', comB, `/eventos/${encB.eventoId}/repertorio`, orgB, { musicaId: musicaB })
    ).json().id as string
    // A organizadora de A, com o contexto de B (sem vínculo lá): nada.
    const lidas = await b.comoApi(
      { contaId: orgA.id, comunidadeId: comB },
      'select id from uj.repertorio_itens where id = $1',
      [itemB],
    )
    expect(lidas).toEqual([])
    const alteradas = await b.comoApi(
      { contaId: orgA.id, comunidadeId: comB },
      `update uj.repertorio_itens set tom_do_dia = 'C' where id = $1 returning id`,
      [itemB],
    )
    expect(alteradas).toEqual([])
    // Com o contexto de A, mas pedindo o item de B: também nada.
    const comContextoA = await b.comoApi(
      { contaId: orgA.id, comunidadeId: comA },
      'select id from uj.repertorio_itens where id = $1',
      [itemB],
    )
    expect(comContextoA).toEqual([])
    await expect(
      b.comoApi(
        { contaId: orgA.id, comunidadeId: comA },
        `insert into uj.repertorio_itens (comunidade_id, evento_id, musica_id, ordem)
         values ($1, $2, $3, 5)`,
        [comB, encB.eventoId, musicaB],
      ),
    ).rejects.toThrow()
    // O papel da API não tem privilégio de coluna sobre a autoria de sistema (id, versão).
    await expect(
      b.comoApi(
        { contaId: orgB.id, comunidadeId: comB },
        `update uj.repertorio_itens set versao = 99 where id = $1`,
        [itemB],
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('Meu repertório', () => {
  it('só para quem foi convocado ao louvor; cada pessoa vê o que é dela', async () => {
    const enc = await novoEncontro(comA, orgA, false)
    const m1 = await novaMusica(comA, orgA, 'Entrada')
    const m2 = await novaMusica(comA, orgA, 'Final', { tom: 'D' })
    await req('POST', comA, `/eventos/${enc.eventoId}/repertorio`, orgA, {
      musicaId: m1,
      tomDoDia: 'A',
    })
    await req('POST', comA, `/eventos/${enc.eventoId}/repertorio`, orgA, { musicaId: m2 })
    // Ana: vocal na etapa Louvor. Bia: violão no encontro todo. Cris: recepção (não é louvor).
    // Dani: baterista que disse "não posso ir".
    await convocar(comA, orgA, enc.eventoId, v['ana']!, enc.louvorId, 'Vocal')
    await convocar(comA, orgA, enc.eventoId, v['bia']!, null, 'violao')
    await convocar(comA, orgA, enc.eventoId, v['cris']!, enc.palavraId, 'recepção')
    const idDani = await convocar(comA, orgA, enc.eventoId, v['dani']!, enc.louvorId, 'Bateria')
    await req('POST', comA, `/eventos/${enc.eventoId}/status`, orgA, { status: 'publicado' })
    expect((await req('POST', comA, `/atribuicoes/${idDani}/recusar`, dani)).statusCode).toBe(200)

    const ana1 = (await req('GET', comA, '/meu-repertorio', ana)).json()
    expect(ana1.encontros).toHaveLength(1)
    const e = ana1.encontros[0]
    expect(e.evento.id).toBe(enc.eventoId)
    expect(e.convocacoes).toEqual([
      expect.objectContaining({ funcao: 'Vocal', estado: 'pendente' }),
    ])
    expect(e.itens.map((i: { titulo: string }) => i.titulo)).toEqual(['Entrada', 'Final'])
    expect(e.itens[0]).toMatchObject({
      tomDoDia: 'A',
      tomOriginal: 'G',
      cifra: CIFRA,
      ordem: 0,
    })
    expect(e.itens[1]).toMatchObject({ tomDoDia: null, tomOriginal: 'D' })

    // Bia: convocada ao encontro todo, mas com função de banda: entra.
    const bia1 = (await req('GET', comA, '/meu-repertorio', bia)).json()
    expect(bia1.encontros).toHaveLength(1)
    // Cris (recepção), Dani (recusou) e a membro que não foi convocada: lista vazia.
    for (const p of [cris, dani, membroA]) {
      expect((await req('GET', comA, '/meu-repertorio', p)).json()).toEqual({ encontros: [] })
    }
  })

  it('aceitar mantém; encontro em rascunho, passado ou de outra comunidade não entra', async () => {
    const rasc = await novoEncontro(comA, orgA, false)
    await convocar(comA, orgA, rasc.eventoId, v['ana']!, rasc.louvorId, 'Vocal')
    // Rascunho: a convocação existe, mas o encontro não foi publicado.
    const antes = (await req('GET', comA, '/meu-repertorio', ana)).json().encontros as {
      evento: { id: string }
    }[]
    expect(antes.find((x) => x.evento.id === rasc.eventoId)).toBeUndefined()

    // Encontro já terminado (início no passado, convocação criada pelo dono do banco).
    const passado = await novoEncontro(comA, orgA)
    await b.su.query(
      `update uj.eventos set inicio = now() - interval '5 hours', duracao_min = 60 where id = $1`,
      [passado.eventoId],
    )
    await b.dono.query(
      `insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id, funcao)
       values ($1, $2, $3, $4, 'Vocal')`,
      [comA, passado.eventoId, passado.louvorId, v['ana']],
    )
    const depois = (await req('GET', comA, '/meu-repertorio', ana)).json().encontros as {
      evento: { id: string }
    }[]
    expect(depois.find((x) => x.evento.id === passado.eventoId)).toBeUndefined()
  })

  it('a convocação de uma comunidade não abre o repertório de outra', async () => {
    const encB = await novoEncontro(comB, orgB)
    const musicaB = await novaMusica(comB, orgB, 'Só de B')
    await req('POST', comB, `/eventos/${encB.eventoId}/repertorio`, orgB, { musicaId: musicaB })
    // Ana é de A: a rota de B é 404 e a de A não traz nada de B.
    expect((await req('GET', comB, '/meu-repertorio', ana)).statusCode).toBe(404)
    const emA = (await req('GET', comA, '/meu-repertorio', ana)).json().encontros as {
      itens: { titulo: string }[]
    }[]
    expect(JSON.stringify(emA)).not.toContain('Só de B')
  })
})

describe('Avisar a banda', () => {
  it('avisa quem foi convocado ao louvor, com texto genérico, respeitando preferências', async () => {
    const enc = await novoEncontro(comA, orgA)
    const m = await novaMusica(comA, orgA, 'Nome secreto da música')
    await req('POST', comA, `/eventos/${enc.eventoId}/repertorio`, orgA, { musicaId: m })
    await convocar(comA, orgA, enc.eventoId, v['ana']!, enc.louvorId, 'Vocal') // pendente
    const idBia = await convocar(comA, orgA, enc.eventoId, v['bia']!, null, 'Violão')
    await req('POST', comA, `/atribuicoes/${idBia}/confirmar`, bia) // aceita
    await convocar(comA, orgA, enc.eventoId, v['cris']!, enc.palavraId, 'recepção') // não é louvor
    const idDani = await convocar(comA, orgA, enc.eventoId, v['dani']!, enc.louvorId, 'Bateria')
    await req('POST', comA, `/atribuicoes/${idDani}/recusar`, dani) // não pode ir

    const r = await req('POST', comA, `/eventos/${enc.eventoId}/repertorio/avisar`, orgA)
    expect(r.statusCode).toBe(200)
    // Convocadas ao louvor e sem recusa: Ana e Bia.
    expect(r.json()).toEqual({ convocadas: 2, avisadas: 2 })

    const enviados = await avisos(enc.eventoId)
    expect(enviados.map((x) => x.conta_id).sort()).toEqual([ana.id, bia.id].sort())
    for (const x of enviados) {
      expect(x).toMatchObject({ ...AVISO, tipo: 'escalas', comunidade_id: comA })
      expect(x.corpo + x.titulo).not.toContain('Nome secreto')
    }
    // A auditoria leva só ids e contagens.
    const { rows } = await b.su.query<{ detalhes: unknown }>(
      `select detalhes from uj.auditoria where acao = 'repertorio.banda_avisada' and recurso_id = $1`,
      [enc.eventoId],
    )
    expect(rows[0]!.detalhes).toEqual({ convocadas: 2, avisadas: 2 })

    // De novo, na mesma hora: a fila deduplica e ninguém é incomodado duas vezes.
    const outra = await req('POST', comA, `/eventos/${enc.eventoId}/repertorio/avisar`, orgA)
    expect(outra.json()).toEqual({ convocadas: 2, avisadas: 0 })
    expect(await avisos(enc.eventoId)).toHaveLength(2)
  })

  it('quem desligou "Escalas" nesta comunidade não recebe; quem avisa não se avisa', async () => {
    const enc = await novoEncontro(comA, orgA)
    await convocar(comA, orgA, enc.eventoId, v['ana']!, enc.louvorId, 'Vocal')
    await convocar(comA, orgA, enc.eventoId, v['bia']!, enc.louvorId, 'Violão')
    await b.su.query(
      `insert into uj.preferencias_notificacao (comunidade_id, conta_id, tipo, ativo)
       values ($1, $2, 'escalas', false)`,
      [comA, bia.id],
    )
    const r = await req('POST', comA, `/eventos/${enc.eventoId}/repertorio/avisar`, orgA)
    expect(r.json()).toEqual({ convocadas: 2, avisadas: 1 })
    expect((await avisos(enc.eventoId)).map((x) => x.conta_id)).toEqual([ana.id])

    // A organizadora também toca teclado: ela mesma não recebe o próprio aviso.
    const enc2 = await novoEncontro(comA, orgA)
    const olga = (
      await b.su.query<{ id: string }>(
        'select id from uj.vinculos where conta_id = $1 and comunidade_id = $2',
        [orgA.id, comA],
      )
    ).rows[0]!.id
    await convocar(comA, orgA, enc2.eventoId, olga, enc2.louvorId, 'Teclado')
    await convocar(comA, orgA, enc2.eventoId, v['ana']!, enc2.louvorId, 'Vocal')
    const r2 = await req('POST', comA, `/eventos/${enc2.eventoId}/repertorio/avisar`, orgA)
    expect(r2.json()).toEqual({ convocadas: 2, avisadas: 1 })
    expect((await avisos(enc2.eventoId)).map((x) => x.conta_id)).toEqual([ana.id])
  })

  it('sem ninguém convocado ao louvor: nada a avisar; sem permissão e rascunho são recusados', async () => {
    const enc = await novoEncontro(comA, orgA)
    const vazio = await req('POST', comA, `/eventos/${enc.eventoId}/repertorio/avisar`, orgA)
    expect(vazio.json()).toEqual({ convocadas: 0, avisadas: 0 })
    expect(
      (await req('POST', comA, `/eventos/${enc.eventoId}/repertorio/avisar`, membroA)).statusCode,
    ).toBe(403)

    const rascunho = await novoEncontro(comA, orgA, false)
    await convocar(comA, orgA, rascunho.eventoId, v['ana']!, rascunho.louvorId, 'Vocal')
    const r = await req('POST', comA, `/eventos/${rascunho.eventoId}/repertorio/avisar`, orgA)
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toBe('encontro_fora_do_ar')
    expect(await avisos(rascunho.eventoId)).toEqual([])
  })

  it('a função atômica do banco só avisa convocações do próprio encontro e da própria comunidade', async () => {
    const encA = await novoEncontro(comA, orgA)
    const encB = await novoEncontro(comB, orgB)
    const membroB = await pessoaComSessao(b, app, config, 'Beto')
    const vBeto = await vincular(b, membroB.id, comB, 'membro')
    const idB = await convocar(comB, orgB, encB.eventoId, vBeto, encB.louvorId, 'Vocal')
    // A organizadora de A tenta avisar a convocação de B usando o encontro de A.
    const n = await b.comoApi<{ n: number }>(
      { contaId: orgA.id, comunidadeId: comA },
      'select uj.avisar_banda($1, $2::uuid[]) as n',
      [encA.eventoId, [idB]],
    )
    expect(n[0]!.n).toBe(0)
    // E pelo encontro de B, sem vínculo lá: o encontro nem existe para ela.
    await expect(
      b.comoApi(
        { contaId: orgA.id, comunidadeId: comA },
        'select uj.avisar_banda($1, $2::uuid[]) as n',
        [encB.eventoId, [idB]],
      ),
    ).rejects.toMatchObject({ code: 'UJ101' })
    expect(await avisos(encA.eventoId)).toEqual([])
    expect(await avisos(encB.eventoId)).toEqual([])
    // Membro não avisa nem direto na função.
    await expect(
      b.comoApi(
        { contaId: membroA.id, comunidadeId: comA },
        'select uj.avisar_banda($1, $2::uuid[]) as n',
        [encA.eventoId, []],
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
