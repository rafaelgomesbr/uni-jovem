import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { caminhoSemConsulta } from '../../src/log.ts'
import { LIMITE_DO_PDF, nomeSeguroDoArquivo, pareceUmPdf } from '../../src/rotas/musica-pdf.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * PDF anexado à música (D76, migração 0029): envio por corpo bruto, validação do conteúdo, limite,
 * confirmação de direitos autorais (como a cifra em texto), isolamento entre comunidades, leitura
 * por membro com ETag, troca, remoção e o que NÃO vai para auditoria, log de mudanças ou log.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let org: Pessoa
let orgB: Pessoa
let violao: Pessoa
let plateia: Pessoa
let musicaId: string
let musicaDeB: string
let eventoId: string

const MARCA = 'Letra inventada de teste do PDF'
const NOME_SECRETO = 'minha-cifra-secreta-do-grupo.pdf'

function pdfDeTeste(marca = MARCA): Buffer {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${marca}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`,
    'latin1',
  )
}
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

const caminhoDoPdf = (com: string, id: string, consulta = '') =>
  `/api/v1/c/${com}/conteudos/musicas/${id}/pdf${consulta}`

function enviar(
  p: Pessoa,
  corpo: Buffer | string | object | undefined,
  opcoes: {
    com?: string
    id?: string
    direitos?: boolean
    nome?: string
    tipo?: string
  } = {},
) {
  const q = new URLSearchParams()
  if (opcoes.direitos !== false) q.set('direitosConfirmados', 'true')
  q.set('nome', opcoes.nome ?? NOME_SECRETO)
  return app.inject({
    method: 'PUT',
    url: caminhoDoPdf(opcoes.com ?? comA, opcoes.id ?? musicaId, `?${q.toString()}`),
    headers: { ...p.auth, 'content-type': opcoes.tipo ?? 'application/pdf' },
    ...(corpo === undefined ? {} : { payload: corpo as Buffer }),
  })
}

const baixar = (p: Pessoa, headers: Record<string, string> = {}, com = comA, id = musicaId) =>
  app.inject({ method: 'GET', url: caminhoDoPdf(com, id), headers: { ...p.auth, ...headers } })

const remover = (p: Pessoa, com = comA, id = musicaId) =>
  app.inject({ method: 'DELETE', url: caminhoDoPdf(com, id), headers: p.auth })

const musica = async (p: Pessoa, com = comA, id = musicaId) =>
  (
    await app.inject({
      method: 'GET',
      url: `/api/v1/c/${com}/conteudos/musicas/${id}`,
      headers: p.auth,
    })
  ).json()

const pdfsNoBanco = async (id = musicaId) =>
  (await b.su.query('select count(*)::int as n from uj.musica_pdfs where musica_id = $1', [id]))
    .rows[0].n as number

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
  org = await pessoaComSessao(b, app, config, 'Olga')
  orgB = await pessoaComSessao(b, app, config, 'Otávio')
  violao = await pessoaComSessao(b, app, config, 'Violonista')
  plateia = await pessoaComSessao(b, app, config, 'Plateia')
  await vincular(b, org.id, comA, 'organizador')
  await vincular(b, orgB.id, comB, 'organizador')
  const vViolao = await vincular(b, violao.id, comA, 'membro')
  await vincular(b, plateia.id, comA, 'membro')

  const nova = async (p: Pessoa, com: string, titulo: string) => {
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${com}/conteudos/musicas`,
      headers: p.auth,
      payload: { titulo },
    })
    expect(r.statusCode).toBe(200)
    return r.json().id as string
  }
  musicaId = await nova(org, comA, 'Sobre a rocha')
  musicaDeB = await nova(orgB, comB, 'Música de B')

  // Um encontro publicado com a música e o violão convocado, para o repertório e o pacote.
  const ev = await app.inject({
    method: 'POST',
    url: `/api/v1/c/${comA}/eventos`,
    headers: org.auth,
    payload: {
      titulo: 'Sábado do PDF',
      categoria: 'Programação de sábado',
      inicio: new Date(Date.now() + 6 * 86_400_000).toISOString(),
      duracaoMin: 120,
    },
  })
  eventoId = ev.json().id as string
  await app.inject({
    method: 'POST',
    url: `/api/v1/c/${comA}/eventos/${eventoId}/etapas`,
    headers: org.auth,
    payload: { titulo: 'Louvor', duracaoMin: 20 },
  })
  await app.inject({
    method: 'POST',
    url: `/api/v1/c/${comA}/eventos/${eventoId}/status`,
    headers: org.auth,
    payload: { status: 'publicado' },
  })
  const item = await app.inject({
    method: 'POST',
    url: `/api/v1/c/${comA}/eventos/${eventoId}/repertorio`,
    headers: org.auth,
    payload: { musicaId },
  })
  expect(item.statusCode).toBe(200)
  await b.dono.query(
    `insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id, funcao, estado)
     values ($1, $2, $3, 'Violão', 'confirmada')`,
    [comA, eventoId, vViolao],
  )
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('funções puras', () => {
  it('o nome do arquivo vira só o último pedaço, sem controle nem direção de texto, e termina em .pdf', () => {
    expect(nomeSeguroDoArquivo('C:\\Users\\Ana\\Cifras\\Firmes na rocha.pdf')).toBe(
      'Firmes na rocha.pdf',
    )
    expect(nomeSeguroDoArquivo('../../etc/passwd')).toBe('passwd.pdf')
    expect(nomeSeguroDoArquivo('a\u0000b\u202ec.PDF')).toBe('abc.pdf')
    expect(nomeSeguroDoArquivo('   ')).toBe('cifra.pdf')
    expect(nomeSeguroDoArquivo(undefined)).toBe('cifra.pdf')
    expect(nomeSeguroDoArquivo('.pdf')).toBe('pdf.pdf')
    expect(nomeSeguroDoArquivo('x'.repeat(300))).toHaveLength(120)
    expect(nomeSeguroDoArquivo('x'.repeat(300)).endsWith('.pdf')).toBe(true)
  })

  it('só aceita quem começa com %PDF- e um número de versão', () => {
    expect(pareceUmPdf(pdfDeTeste())).toBe(true)
    expect(pareceUmPdf(Buffer.from('%PDF-2.0\n'))).toBe(true)
    expect(pareceUmPdf(Buffer.from('<html>%PDF-1.4'))).toBe(false)
    expect(pareceUmPdf(Buffer.from('%PDF-'))).toBe(false)
    expect(pareceUmPdf(Buffer.from('GIF89a......'))).toBe(false)
  })

  it('o nome do arquivo (que vai na consulta do endereço) nunca entra no registro técnico', () => {
    const url = caminhoDoPdf(comA, musicaId, `?nome=${encodeURIComponent(NOME_SECRETO)}`)
    expect(caminhoSemConsulta(url)).not.toContain('secreta')
    expect(caminhoSemConsulta(url).endsWith('/pdf')).toBe(true)
  })
})

describe('enviar o PDF', () => {
  it('a organização anexa: o corpo vira o arquivo, e a música mostra o resumo sem os bytes', async () => {
    const pdf = pdfDeTeste()
    const r = await enviar(org, pdf)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({
      temPdf: true,
      pdf: { nome: NOME_SECRETO, tamanho: pdf.length, versao: sha(pdf) },
    })
    const detalhe = await musica(org)
    expect(detalhe.temPdf).toBe(true)
    expect(detalhe.pdf).toEqual({ nome: NOME_SECRETO, tamanho: pdf.length, versao: sha(pdf) })
    expect(JSON.stringify(detalhe)).not.toContain(MARCA)
    const lista = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${comA}/conteudos/musicas`,
      headers: org.auth,
    })
    const daLista = (lista.json().itens as { id: string; temPdf: boolean }[]).find(
      (m) => m.id === musicaId,
    )
    expect(daLista?.temPdf).toBe(true)
    expect(lista.body).not.toContain(MARCA)
    expect(await pdfsNoBanco()).toBe(1)
  })

  it('o banco guarda os bytes como vieram, com o SHA-256 e o tamanho calculados por ele', async () => {
    const { rows } = await b.su.query(
      `select conteudo, tamanho, encode(hash, 'hex') as hash, direito_confirmado_em
         from uj.musica_pdfs where musica_id = $1`,
      [musicaId],
    )
    expect(Buffer.from(rows[0].conteudo).equals(pdfDeTeste())).toBe(true)
    expect(rows[0].tamanho).toBe(pdfDeTeste().length)
    expect(rows[0].hash).toBe(sha(pdfDeTeste()))
    expect(rows[0].direito_confirmado_em).not.toBeNull()
  })

  it('arquivo que não é PDF é recusado, com ou sem o tipo certo, e nada é guardado', async () => {
    const outra = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comA}/conteudos/musicas`,
      headers: org.auth,
      payload: { titulo: 'Outra música' },
    })
    const id = outra.json().id as string
    const casos: [Buffer | string | object, string][] = [
      [Buffer.from('Isto é só um texto, não um PDF.'), 'application/pdf'],
      [Buffer.from('<html><script>alert(1)</script></html>'), 'application/pdf'],
      [Buffer.from('GIF89a' + 'x'.repeat(50)), 'application/pdf'],
      [Buffer.alloc(0), 'application/pdf'],
      // O tipo diz PDF mas é outro, ou o tipo nem é PDF (ainda que o conteúdo seja).
      [pdfDeTeste(), 'text/plain'],
      [pdfDeTeste(), 'application/octet-stream'],
      [{ pdf: 'nao-e-assim' }, 'application/json'],
    ]
    for (const [corpo, tipo] of casos) {
      const r = await enviar(org, corpo, { id, tipo })
      expect(r.statusCode, `${tipo}`).toBe(415)
      expect(r.json().erro).toBe('arquivo_nao_e_pdf')
      expect(r.json().mensagem).toBe(
        'Este arquivo não parece ser um PDF. Escolha um arquivo PDF e tente de novo.',
      )
    }
    expect(await pdfsNoBanco(id)).toBe(0)
  })

  it('acima de 10 MB é recusado (413) e o que já estava guardado continua', async () => {
    const grande = Buffer.concat([pdfDeTeste(), Buffer.alloc(LIMITE_DO_PDF)])
    const r = await enviar(org, grande)
    expect(r.statusCode).toBe(413)
    expect(r.json().erro).toBe('grande_demais')
    expect(
      Buffer.from(
        (await b.su.query('select conteudo from uj.musica_pdfs where musica_id = $1', [musicaId]))
          .rows[0].conteudo,
      ).equals(pdfDeTeste()),
    ).toBe(true)
  })

  it('exatamente no limite de 10 MB passa', async () => {
    const outra = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comA}/conteudos/musicas`,
      headers: org.auth,
      payload: { titulo: 'Partitura grande' },
    })
    const id = outra.json().id as string
    const cabeca = pdfDeTeste()
    const no_limite = Buffer.concat([cabeca, Buffer.alloc(LIMITE_DO_PDF - cabeca.length, 0x20)])
    const r = await enviar(org, no_limite, { id })
    expect(r.statusCode).toBe(200)
    expect(r.json().pdf.tamanho).toBe(LIMITE_DO_PDF)
    await remover(org, comA, id)
  })

  it('sem a confirmação de direitos autorais, recusa (400) e nada muda', async () => {
    const outra = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comA}/conteudos/musicas`,
      headers: org.auth,
      payload: { titulo: 'Sem aceite' },
    })
    const id = outra.json().id as string
    const r = await enviar(org, pdfDeTeste(), { id, direitos: false })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toBe('direitos_nao_confirmados')
    const falso = await app.inject({
      method: 'PUT',
      url: caminhoDoPdf(comA, id, '?direitosConfirmados=false'),
      headers: { ...org.auth, 'content-type': 'application/pdf' },
      payload: pdfDeTeste(),
    })
    expect(falso.statusCode).toBe(400)
    expect(await pdfsNoBanco(id)).toBe(0)
  })

  it('o banco recusa sozinho, mesmo com a rota contornada: sem aceite (UJ100), outra comunidade e conteúdo que não é PDF', async () => {
    const contexto = { contaId: org.id, comunidadeId: comA }
    const inserir = (com: string, bytes: Buffer, direito: string | null, id = musicaId) =>
      b.comoApi(
        contexto,
        `insert into uj.musica_pdfs
           (comunidade_id, musica_id, nome, conteudo, tamanho, hash, direito_confirmado_em)
         values ($1, $2, 'x.pdf', $3::bytea, octet_length($3::bytea), sha256($3::bytea), $4)`,
        [com, id, bytes, direito],
      )
    const outra = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comA}/conteudos/musicas`,
      headers: org.auth,
      payload: { titulo: 'Contornada' },
    })
    const id = outra.json().id as string
    await expect(inserir(comA, pdfDeTeste(), null, id)).rejects.toMatchObject({ code: 'UJ100' })
    await expect(
      inserir(comA, Buffer.from('nao e pdf, mas e longo'), new Date().toISOString(), id),
    ).rejects.toThrow()
    await expect(
      b.comoApi(
        contexto,
        `insert into uj.musica_pdfs
           (comunidade_id, musica_id, nome, conteudo, tamanho, hash, direito_confirmado_em)
         values ($1, $2, 'x.pdf', $3::bytea, octet_length($3::bytea), sha256($3::bytea), now())`,
        [comB, musicaDeB, pdfDeTeste()],
      ),
    ).rejects.toThrow()
    // Trocar o conteúdo sem renovar o aceite também é barrado.
    await expect(
      b.comoApi(
        contexto,
        `update uj.musica_pdfs set conteudo = $2::bytea, tamanho = octet_length($2::bytea),
                hash = sha256($2::bytea)
          where musica_id = $1`,
        [musicaId, pdfDeTeste('outro conteudo')],
      ),
    ).rejects.toMatchObject({ code: 'UJ100' })
    expect(await pdfsNoBanco(id)).toBe(0)
    expect(await pdfsNoBanco(musicaDeB)).toBe(0)
  })

  it('quem é só membro não anexa nem remove (403), e nada muda', async () => {
    for (const p of [violao, plateia]) {
      expect((await enviar(p, pdfDeTeste('invasor'))).statusCode).toBe(403)
      expect((await remover(p)).statusCode).toBe(403)
    }
    expect(
      Buffer.from(
        (await b.su.query('select conteudo from uj.musica_pdfs where musica_id = $1', [musicaId]))
          .rows[0].conteudo,
      ).equals(pdfDeTeste()),
    ).toBe(true)
  })

  it('música que não existe ou id que não é UUID: 404 antes de olhar o corpo', async () => {
    expect(
      (await enviar(org, Buffer.from('x'), { id: '00000000-0000-4000-8000-000000000000' }))
        .statusCode,
    ).toBe(404)
    expect((await enviar(org, Buffer.from('x'), { id: 'nao-e-uuid' })).statusCode).toBe(404)
  })
})

describe('ler o PDF', () => {
  it('qualquer membro da comunidade lê: tipo PDF, anexo, sem cache compartilhado e ETag do conteúdo', async () => {
    for (const p of [plateia, violao, org]) {
      const r = await baixar(p)
      expect(r.statusCode).toBe(200)
      expect(r.headers['content-type']).toBe('application/pdf')
      expect(r.headers['cache-control']).toBe('private, no-cache')
      expect(r.headers['etag']).toBe(`"${sha(pdfDeTeste())}"`)
      expect(r.headers['x-content-type-options']).toBe('nosniff')
      expect(r.headers['content-disposition']).toBe(
        `attachment; filename="${NOME_SECRETO}"; filename*=UTF-8''${NOME_SECRETO}`,
      )
      expect(r.rawPayload.equals(pdfDeTeste())).toBe(true)
    }
  })

  it('com o ETag que o aparelho já tem, 304 sem corpo; com outro, o arquivo', async () => {
    const etag = `"${sha(pdfDeTeste())}"`
    const igual = await baixar(plateia, { 'if-none-match': etag })
    expect(igual.statusCode).toBe(304)
    expect(igual.body).toBe('')
    expect(igual.headers['etag']).toBe(etag)
    expect((await baixar(plateia, { 'if-none-match': `W/${etag}` })).statusCode).toBe(304)
    expect((await baixar(plateia, { 'if-none-match': `"${'0'.repeat(64)}"` })).statusCode).toBe(200)
  })

  it('o nome com acento e com caracteres perigosos sai seguro no cabeçalho', async () => {
    const outra = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comA}/conteudos/musicas`,
      headers: org.auth,
      payload: { titulo: 'Nome difícil' },
    })
    const id = outra.json().id as string
    const r = await enviar(org, pdfDeTeste('nome'), {
      id,
      nome: 'Cifra "Santo" (versão 2); a\'b.pdf',
    })
    expect(r.statusCode).toBe(200)
    const g = await baixar(plateia, {}, comA, id)
    const cabecalho = g.headers['content-disposition'] as string
    expect(cabecalho).toBe(
      `attachment; filename="Cifra _Santo_ _versao 2__ a_b.pdf"; filename*=UTF-8''Cifra%20%22Santo%22%20%28vers%C3%A3o%202%29%3B%20a%27b.pdf`,
    )
    expect(cabecalho).not.toMatch(/[\r\n]/)
    await remover(org, comA, id)
  })

  it('música sem PDF: 404', async () => {
    const outra = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comA}/conteudos/musicas`,
      headers: org.auth,
      payload: { titulo: 'Sem PDF' },
    })
    const id = outra.json().id as string
    expect((await baixar(plateia, {}, comA, id)).statusCode).toBe(404)
    expect((await musica(plateia, comA, id)).temPdf).toBe(false)
    expect((await musica(plateia, comA, id)).pdf).toBeNull()
  })
})

describe('isolamento entre comunidades', () => {
  it('a outra comunidade não envia, não lê e não remove o PDF (404), e o arquivo segue igual', async () => {
    const antes = (
      await b.su.query("select encode(hash, 'hex') as h from uj.musica_pdfs where musica_id = $1", [
        musicaId,
      ])
    ).rows[0].h
    // Pelo caminho da comunidade A, sem vínculo nela.
    expect((await enviar(orgB, pdfDeTeste('de B'))).statusCode).toBe(404)
    expect((await baixar(orgB)).statusCode).toBe(404)
    expect((await remover(orgB)).statusCode).toBe(404)
    // Pelo caminho da própria comunidade, com o id da música de A.
    expect((await enviar(orgB, pdfDeTeste('de B'), { com: comB })).statusCode).toBe(404)
    expect((await baixar(orgB, {}, comB)).statusCode).toBe(404)
    expect((await remover(orgB, comB)).statusCode).toBe(404)
    // E o contrário: A com o id da música de B.
    expect((await enviar(org, pdfDeTeste('de A'), { id: musicaDeB })).statusCode).toBe(404)
    expect((await baixar(org, {}, comA, musicaDeB)).statusCode).toBe(404)
    expect((await remover(org, comA, musicaDeB)).statusCode).toBe(404)
    expect(
      (
        await b.su.query(
          "select encode(hash, 'hex') as h from uj.musica_pdfs where musica_id = $1",
          [musicaId],
        )
      ).rows[0].h,
    ).toBe(antes)
    expect(await pdfsNoBanco(musicaDeB)).toBe(0)
  })

  it('o PDF de B é lido só em B', async () => {
    expect(
      (await enviar(orgB, pdfDeTeste('so de B'), { com: comB, id: musicaDeB })).statusCode,
    ).toBe(200)
    const dele = await baixar(orgB, {}, comB, musicaDeB)
    expect(dele.statusCode).toBe(200)
    expect(dele.rawPayload.equals(pdfDeTeste('so de B'))).toBe(true)
    expect((await baixar(org, {}, comA, musicaDeB)).statusCode).toBe(404)
    expect((await baixar(plateia, {}, comB, musicaDeB)).statusCode).toBe(404)
    // A lista de músicas de A não carrega nada de B.
    const lista = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${comA}/conteudos/musicas`,
      headers: org.auth,
    })
    expect(lista.body).not.toContain('Música de B')
  })
})

describe('no repertório e no pacote para tocar sem internet', () => {
  const lista = (p: Pessoa) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/c/${comA}/eventos/${eventoId}/repertorio`,
      headers: p.auth,
    })
  const pacote = (p: Pessoa, headers: Record<string, string> = {}) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/c/${comA}/eventos/${eventoId}/repertorio/pacote`,
      headers: { ...p.auth, ...headers },
    })

  it('a lista do repertório (aberta a todos) marca temPdf e dá a versão, sem os bytes', async () => {
    const r = await lista(plateia)
    expect(r.statusCode).toBe(200)
    const item = r.json().itens[0]
    expect(item.temPdf).toBe(true)
    expect(item.pdf).toEqual({
      nome: NOME_SECRETO,
      tamanho: pdfDeTeste().length,
      versao: sha(pdfDeTeste()),
    })
    expect(r.body).not.toContain(MARCA)
  })

  it('o pacote de quem toca leva o PDF por referência (versão), nunca os bytes', async () => {
    const r = await pacote(violao)
    expect(r.statusCode).toBe(200)
    const item = r.json().itens[0]
    expect(item.temPdf).toBe(true)
    expect(item.pdf.versao).toBe(sha(pdfDeTeste()))
    expect(r.body).not.toContain(MARCA)
    // Quem não toca segue sem o pacote.
    expect((await pacote(plateia)).statusCode).toBe(403)
  })

  it('Meu repertório também traz o resumo do PDF', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${comA}/meu-repertorio`,
      headers: violao.auth,
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().encontros[0].itens[0]).toMatchObject({
      temPdf: true,
      pdf: { versao: sha(pdfDeTeste()) },
    })
  })

  it('trocar ou remover o PDF muda a versão do pacote (o aparelho baixa de novo só se mudou)', async () => {
    const v0 = (await pacote(violao)).json().versao as string
    expect((await pacote(violao)).json().versao).toBe(v0)

    const novo = pdfDeTeste('versao nova do arquivo')
    const troca = await enviar(org, novo)
    expect(troca.statusCode).toBe(200)
    const depois = await pacote(violao)
    expect(depois.json().versao).not.toBe(v0)
    expect(depois.json().itens[0].pdf.versao).toBe(sha(novo))
    // Com a versão antiga, o servidor devolve o pacote novo; com a nova, "inalterado".
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/c/${comA}/eventos/${eventoId}/repertorio/pacote?versao=${depois.json().versao}`,
          headers: violao.auth,
        })
      ).json(),
    ).toEqual({ versao: depois.json().versao, inalterado: true })
    // O arquivo novo, e só ele, é o que o ETag antigo não cobre.
    expect((await baixar(violao, { 'if-none-match': `"${sha(pdfDeTeste())}"` })).statusCode).toBe(
      200,
    )
    expect((await baixar(violao, { 'if-none-match': `"${sha(novo)}"` })).statusCode).toBe(304)

    expect((await remover(org)).statusCode).toBe(200)
    const semPdf = await pacote(violao)
    expect(semPdf.json().itens[0].temPdf).toBe(false)
    expect(semPdf.json().itens[0].pdf).toBeNull()
    expect(semPdf.json().versao).not.toBe(depois.json().versao)
  })
})

describe('trocar, remover e o que não vai a lugar nenhum', () => {
  it('trocar é regravar a mesma linha (um PDF por música) e remover apaga; remover de novo é inofensivo', async () => {
    const um = await enviar(org, pdfDeTeste('primeiro'), { nome: 'primeiro.pdf' })
    expect(um.statusCode).toBe(200)
    const dois = await enviar(org, pdfDeTeste('segundo, maior'), { nome: 'segundo.pdf' })
    expect(dois.json().pdf.nome).toBe('segundo.pdf')
    expect(dois.json().pdf.versao).not.toBe(um.json().pdf.versao)
    expect(await pdfsNoBanco()).toBe(1)

    const fora = await remover(org)
    expect(fora.statusCode).toBe(200)
    expect(fora.json()).toEqual({ temPdf: false, pdf: null })
    expect(await pdfsNoBanco()).toBe(0)
    expect((await baixar(org)).statusCode).toBe(404)
    expect((await musica(org)).temPdf).toBe(false)
    expect((await remover(org)).statusCode).toBe(200)
  })

  it('apagar a música leva o PDF junto', async () => {
    const outra = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comA}/conteudos/musicas`,
      headers: org.auth,
      payload: { titulo: 'Vai embora' },
    })
    const id = outra.json().id as string
    expect((await enviar(org, pdfDeTeste('vai embora'), { id })).statusCode).toBe(200)
    expect(await pdfsNoBanco(id)).toBe(1)
    const apagada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/c/${comA}/conteudos/musicas/${id}`,
      headers: org.auth,
    })
    expect(apagada.statusCode).toBe(200)
    expect(await pdfsNoBanco(id)).toBe(0)
  })

  it('auditoria e log de mudanças levam só ids: nem o nome do arquivo, nem o conteúdo', async () => {
    await enviar(org, pdfDeTeste('conteudo-do-pdf-na-auditoria'), {
      nome: 'nome-do-arquivo-na-auditoria.pdf',
    })
    await remover(org)
    const { rows } = await b.su.query<{ acao: string; t: string }>(
      `select acao, coalesce(detalhes::text, '') || coalesce(recurso_tipo, '') || coalesce(recurso_id::text, '') as t
         from uj.auditoria where acao like 'conteudo.pdf_%'`,
    )
    expect(rows.map((r) => r.acao)).toEqual(
      expect.arrayContaining([
        'conteudo.pdf_anexado',
        'conteudo.pdf_trocado',
        'conteudo.pdf_removido',
      ]),
    )
    const tudo = rows.map((r) => r.t).join(' ')
    expect(tudo).not.toContain('nome-do-arquivo')
    expect(tudo).not.toContain('conteudo-do-pdf')
    expect(tudo).not.toContain('.pdf')
    const mudancas = (
      await b.su.query(
        `select string_agg(row_to_json(m)::text, ' ') as t from uj.mudancas m where tabela = 'musica_pdfs'`,
      )
    ).rows[0].t as string
    expect(mudancas).toBeTruthy()
    expect(mudancas).not.toContain('nome-do-arquivo')
    expect(mudancas).not.toContain('conteudo-do-pdf')
  })

  it('a resposta de erro nunca repete o conteúdo nem o nome enviados', async () => {
    const r = await enviar(org, Buffer.from('conteudo-secreto-que-nao-e-pdf'), {
      nome: 'nome-secreto-que-nao-vale.pdf',
    })
    expect(r.statusCode).toBe(415)
    expect(r.body).not.toContain('secreto')
  })
})
