import * as SQLite from 'expo-sqlite'

import type { PacoteDoRepertorio } from '@/servicos/contratoV3'
import { ErroLocal } from '@/servicos/erros'

import {
  alterarIndice,
  apagarChave,
  criarChave,
  lerChave,
  lerIndice,
  nomeDoArquivo,
} from './cofreDasParticoes'
import { semOracao, tipoPermitidoOffline } from './semOracao'
import type {
  ContextoLocal,
  DepositoLocal,
  EstadoDaOperacao,
  MetaDaParticao,
  NovaOperacao,
  OperacaoNaFila,
  PacoteGuardado,
  PacoteOffline,
  Particao,
  PdfGuardado,
  ParticaoVencida,
  RegistroDaParticao,
  RepertorioGuardado,
  ResumoDoPacote,
  ResumoDoRepertorioGuardado,
} from './tipos'

/**
 * Banco local cifrado (SQLCipher), uma partição por (conta, comunidade), cada
 * uma com a sua chave aleatória no Keychain/Keystore (ADR 0005). Inspirado em
 * `dc360/packages/campo/src/deposito-sqlite.ts`.
 */

const DIA_MS = 24 * 3600_000

const ESQUEMA = `
create table if not exists meta (chave text primary key, valor text not null);
create table if not exists operacoes (
  chave text primary key,
  tipo text not null,
  comunidade_id text not null,
  vinculo_id text not null,
  criada_em text not null,
  evento_id text,
  descricao text not null,
  dados text not null,
  contexto text not null default '{}',
  estado text not null default 'pendente',
  tentativas integer not null default 0,
  motivo text,
  mensagem text,
  estado_servidor text
);
create table if not exists pacotes (
  evento_id text primary key,
  conteudo text not null,
  baixado_em text not null,
  valido_ate text not null
);
create table if not exists repertorios (
  evento_id text primary key,
  versao text not null,
  conteudo text not null,
  baixado_em text not null,
  valido_ate text not null
);
-- PDFs das músicas dos repertórios guardados (D76): na mesma partição cifrada, sob a mesma
-- validade. Saem junto com o repertório do encontro, com a partição e com a conta.
create table if not exists repertorio_pdfs (
  evento_id text not null,
  musica_id text not null,
  versao text not null,
  nome text not null,
  conteudo blob not null,
  baixado_em text not null,
  primary key (evento_id, musica_id)
);
`

export const MENSAGEM_SEM_CIFRAGEM =
  'Este aparelho não tem a cifragem do banco local, então o modo sem internet fica desligado.'

class SemCifragem extends Error {}

interface LinhaDaOperacao {
  chave: string
  tipo: string
  comunidade_id: string
  vinculo_id: string
  criada_em: string
  evento_id: string | null
  descricao: string
  dados: string
  contexto: string
  estado: EstadoDaOperacao
  tentativas: number
  motivo: string | null
  mensagem: string | null
  estado_servidor: string | null
}

function lerJson<T>(texto: string | null, padrao: T): T {
  if (!texto) return padrao
  try {
    return JSON.parse(texto) as T
  } catch {
    return padrao
  }
}

function paraOperacao(l: LinhaDaOperacao): OperacaoNaFila {
  return {
    chave: l.chave,
    tipo: l.tipo,
    comunidadeId: l.comunidade_id,
    vinculoId: l.vinculo_id,
    criadaEm: l.criada_em,
    eventoId: l.evento_id,
    descricao: l.descricao,
    dados: lerJson(l.dados, {}),
    contexto: lerJson<ContextoLocal>(l.contexto, {}),
    estado: l.estado,
    tentativas: Number(l.tentativas),
    motivo: l.motivo,
    mensagem: l.mensagem,
    estadoDoServidor: lerJson<unknown>(l.estado_servidor, null),
  } as OperacaoNaFila
}

async function abrirBanco(nome: string, chave: string): Promise<SQLite.SQLiteDatabase> {
  if (!/^[0-9a-f]{64}$/.test(chave)) throw new Error('Chave da partição inválida.')
  const db = await SQLite.openDatabaseAsync(nome, { useNewConnection: true })
  try {
    // Chave crua (sem derivação): já é aleatória de 256 bits.
    await db.execAsync(`PRAGMA key = "x'${chave}'"`)
    // Sem SQLCipher no binário, `PRAGMA key` não faz nada e o banco ficaria aberto.
    const cifra = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version')
    if (!cifra?.cipher_version) throw new SemCifragem()
    // Com a chave errada, a primeira leitura falha ("file is not a database").
    await db.execAsync(ESQUEMA)
    return db
  } catch (erro) {
    await db.closeAsync().catch(() => undefined)
    throw erro
  }
}

class ParticaoSqlite implements Particao {
  constructor(
    readonly contaId: string,
    readonly comunidadeId: string,
    readonly db: SQLite.SQLiteDatabase,
    private readonly aoMudarValidade: (validoAte: string) => Promise<void>,
  ) {}

  async meta(): Promise<MetaDaParticao> {
    const linhas = await this.db.getAllAsync<{ chave: string; valor: string }>(
      'select chave, valor from meta',
    )
    const m = Object.fromEntries(linhas.map((l) => [l.chave, lerJson<unknown>(l.valor, null)]))
    return {
      contaId: this.contaId,
      comunidadeId: this.comunidadeId,
      vinculoId: (m['vinculoId'] as string | null | undefined) ?? null,
      validadeDias: Number(m['validadeDias'] ?? 7),
      validoAte: String(m['validoAte'] ?? new Date(0).toISOString()),
      cursor: (m['cursor'] as string | null | undefined) ?? null,
      ultimaSincronizacao: (m['ultimaSincronizacao'] as string | null | undefined) ?? null,
    }
  }

  async atualizarMeta(
    mudanca: Partial<Omit<MetaDaParticao, 'contaId' | 'comunidadeId'>>,
  ): Promise<MetaDaParticao> {
    for (const [chave, valor] of Object.entries(mudanca)) {
      if (valor === undefined) continue
      await this.db.runAsync(
        'insert into meta (chave, valor) values (?, ?) on conflict(chave) do update set valor = excluded.valor',
        [chave, JSON.stringify(valor)],
      )
    }
    if (mudanca.validoAte) await this.aoMudarValidade(mudanca.validoAte)
    return this.meta()
  }

  async enfileirar(op: NovaOperacao): Promise<'nova' | 'repetida'> {
    if (!tipoPermitidoOffline(op.tipo)) {
      throw new ErroLocal('Esta ação não pode ser guardada no aparelho. Ela exige conexão.')
    }
    // A comunidade gravada na operação é a da partição: nunca outra.
    if (op.comunidadeId !== this.comunidadeId) {
      throw new ErroLocal('Esta alteração é de outra comunidade e não foi guardada.')
    }
    const r = await this.db.runAsync(
      `insert or ignore into operacoes
         (chave, tipo, comunidade_id, vinculo_id, criada_em, evento_id, descricao, dados, contexto)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        op.chave,
        op.tipo,
        op.comunidadeId,
        op.vinculoId,
        op.criadaEm,
        op.eventoId,
        op.descricao,
        JSON.stringify(semOracao(op.dados)),
        JSON.stringify(semOracao(op.contexto)),
      ],
    )
    return r.changes === 1 ? 'nova' : 'repetida'
  }

  async operacoes(): Promise<OperacaoNaFila[]> {
    const linhas = await this.db.getAllAsync<LinhaDaOperacao>(
      'select * from operacoes order by rowid',
    )
    return linhas.map(paraOperacao)
  }

  async atualizarOperacao(
    chave: string,
    mudanca: Partial<
      Pick<OperacaoNaFila, 'estado' | 'tentativas' | 'motivo' | 'mensagem' | 'estadoDoServidor'>
    > & { dados?: NovaOperacao['dados'] },
  ): Promise<void> {
    const colunas: [string, string | number | null][] = []
    if (mudanca.estado !== undefined) colunas.push(['estado', mudanca.estado])
    if (mudanca.tentativas !== undefined) colunas.push(['tentativas', mudanca.tentativas])
    if (mudanca.motivo !== undefined) colunas.push(['motivo', mudanca.motivo])
    if (mudanca.mensagem !== undefined) colunas.push(['mensagem', mudanca.mensagem])
    if (mudanca.estadoDoServidor !== undefined) {
      colunas.push(['estado_servidor', JSON.stringify(semOracao(mudanca.estadoDoServidor))])
    }
    if (mudanca.dados !== undefined) colunas.push(['dados', JSON.stringify(mudanca.dados)])
    if (!colunas.length) return
    await this.db.runAsync(
      `update operacoes set ${colunas.map(([c]) => `${c} = ?`).join(', ')} where chave = ?`,
      [...colunas.map(([, v]) => v), chave],
    )
  }

  async removerOperacao(chave: string): Promise<void> {
    await this.db.runAsync('delete from operacoes where chave = ?', [chave])
  }

  async gravarPacote(pacote: PacoteOffline, baixadoEm: string): Promise<void> {
    const limpo = semOracao(pacote)
    await this.db.runAsync(
      `insert into pacotes (evento_id, conteudo, baixado_em, valido_ate) values (?, ?, ?, ?)
       on conflict(evento_id) do update set conteudo = excluded.conteudo,
         baixado_em = excluded.baixado_em, valido_ate = excluded.valido_ate`,
      [limpo.evento.id, JSON.stringify(limpo), baixadoEm, limpo.validoAte],
    )
  }

  async lerPacote(eventoId: string): Promise<PacoteGuardado | null> {
    const l = await this.db.getFirstAsync<{
      conteudo: string
      baixado_em: string
      valido_ate: string
    }>('select conteudo, baixado_em, valido_ate from pacotes where evento_id = ?', [eventoId])
    if (!l) return null
    const pacote = lerJson<PacoteOffline | null>(l.conteudo, null)
    if (!pacote) return null
    return { eventoId, pacote, baixadoEm: l.baixado_em, validoAte: l.valido_ate }
  }

  async pacotes(): Promise<ResumoDoPacote[]> {
    const linhas = await this.db.getAllAsync<{
      evento_id: string
      conteudo: string
      baixado_em: string
      valido_ate: string
    }>('select evento_id, conteudo, baixado_em, valido_ate from pacotes')
    return linhas
      .map((l) => {
        const p = lerJson<PacoteOffline | null>(l.conteudo, null)
        return {
          eventoId: l.evento_id,
          titulo: p?.evento.titulo ?? 'Programação',
          inicio: p?.evento.inicio ?? l.baixado_em,
          duracaoMin: p?.evento.duracaoMin ?? 0,
          fuso: p?.evento.fuso ?? 'America/Sao_Paulo',
          baixadoEm: l.baixado_em,
          validoAte: l.valido_ate,
        }
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
  }

  async removerPacote(eventoId: string): Promise<void> {
    await this.db.runAsync('delete from pacotes where evento_id = ?', [eventoId])
  }

  async gravarRepertorio(pacote: PacoteDoRepertorio, baixadoEm: string): Promise<void> {
    const limpo = semOracao(pacote)
    await this.db.runAsync(
      `insert into repertorios (evento_id, versao, conteudo, baixado_em, valido_ate)
       values (?, ?, ?, ?, ?)
       on conflict(evento_id) do update set versao = excluded.versao,
         conteudo = excluded.conteudo, baixado_em = excluded.baixado_em,
         valido_ate = excluded.valido_ate`,
      [limpo.evento.id, limpo.versao, JSON.stringify(limpo), baixadoEm, limpo.validoAte],
    )
  }

  async lerRepertorio(eventoId: string): Promise<RepertorioGuardado | null> {
    const l = await this.db.getFirstAsync<LinhaDoRepertorio>(
      'select evento_id, versao, conteudo, baixado_em, valido_ate from repertorios where evento_id = ?',
      [eventoId],
    )
    return l ? paraRepertorio(l) : null
  }

  async repertorios(): Promise<RepertorioGuardado[]> {
    const linhas = await this.db.getAllAsync<LinhaDoRepertorio>(
      'select evento_id, versao, conteudo, baixado_em, valido_ate from repertorios',
    )
    return linhas
      .map(paraRepertorio)
      .filter((r): r is RepertorioGuardado => r !== null)
      .sort((a, b) => a.pacote.evento.inicio.localeCompare(b.pacote.evento.inicio))
  }

  async resumoDosRepertorios(): Promise<ResumoDoRepertorioGuardado[]> {
    const resumos: ResumoDoRepertorioGuardado[] = []
    for (const r of await this.repertorios()) {
      const guardados = await this.versoesDosPdfs(r.eventoId)
      const comPdf = r.pacote.itens.filter((i) => i.pdf)
      resumos.push({
        eventoId: r.eventoId,
        versao: r.pacote.versao,
        titulo: r.pacote.evento.titulo,
        inicio: r.pacote.evento.inicio,
        fuso: r.pacote.evento.fuso,
        musicas: r.pacote.itens.length,
        pdfs: comPdf.length,
        // "Pronto" só vale com o PDF na versão que o pacote pede: um PDF antigo não conta.
        pdfsBaixados: comPdf.filter((i) => guardados[i.musicaId] === i.pdf!.versao).length,
        baixadoEm: r.baixadoEm,
        validoAte: r.validoAte,
      })
    }
    return resumos
  }

  async removerRepertorio(eventoId: string): Promise<void> {
    await this.db.runAsync('delete from repertorios where evento_id = ?', [eventoId])
    await this.db.runAsync('delete from repertorio_pdfs where evento_id = ?', [eventoId])
  }

  async gravarPdf(
    eventoId: string,
    musicaId: string,
    pdf: { versao: string; nome: string },
    bytes: Uint8Array,
    baixadoEm: string = new Date().toISOString(),
  ): Promise<void> {
    await this.db.runAsync(
      `insert into repertorio_pdfs (evento_id, musica_id, versao, nome, conteudo, baixado_em)
       values (?, ?, ?, ?, ?, ?)
       on conflict(evento_id, musica_id) do update set versao = excluded.versao,
         nome = excluded.nome, conteudo = excluded.conteudo, baixado_em = excluded.baixado_em`,
      [eventoId, musicaId, pdf.versao, pdf.nome, bytes, baixadoEm],
    )
  }

  async lerPdf(musicaId: string, versao = ''): Promise<PdfGuardado | null> {
    const l = await this.db.getFirstAsync<{ versao: string; nome: string; conteudo: Uint8Array }>(
      `select versao, nome, conteudo from repertorio_pdfs where musica_id = ?
        order by (versao = ?) desc, baixado_em desc limit 1`,
      [musicaId, versao],
    )
    return l ? { versao: l.versao, nome: l.nome, bytes: new Uint8Array(l.conteudo) } : null
  }

  async versoesDosPdfs(eventoId: string): Promise<Record<string, string>> {
    const linhas = await this.db.getAllAsync<{ musica_id: string; versao: string }>(
      'select musica_id, versao from repertorio_pdfs where evento_id = ?',
      [eventoId],
    )
    return Object.fromEntries(linhas.map((l) => [l.musica_id, l.versao]))
  }

  async removerPdfsForaDe(eventoId: string, manter: readonly string[]): Promise<void> {
    const atuais = await this.versoesDosPdfs(eventoId)
    for (const musicaId of Object.keys(atuais)) {
      if (manter.includes(musicaId)) continue
      await this.db.runAsync('delete from repertorio_pdfs where evento_id = ? and musica_id = ?', [
        eventoId,
        musicaId,
      ])
    }
  }
}

interface LinhaDoRepertorio {
  evento_id: string
  versao: string
  conteudo: string
  baixado_em: string
  valido_ate: string
}

function paraRepertorio(l: LinhaDoRepertorio): RepertorioGuardado | null {
  const pacote = lerJson<PacoteDoRepertorio | null>(l.conteudo, null)
  if (!pacote) return null
  return { eventoId: l.evento_id, pacote, baixadoEm: l.baixado_em, validoAte: l.valido_ate }
}

export function criarDeposito(): DepositoLocal {
  const abertas = new Map<string, Promise<ParticaoSqlite | null>>()
  const id = (contaId: string, comunidadeId: string) => `${contaId}|${comunidadeId}`
  let semCifra = false

  async function apagarFisico(contaId: string, comunidadeId: string): Promise<void> {
    const aberta = abertas.get(id(contaId, comunidadeId))
    abertas.delete(id(contaId, comunidadeId))
    const p = await aberta?.catch(() => null)
    await p?.db.closeAsync().catch(() => undefined)
    await SQLite.deleteDatabaseAsync(nomeDoArquivo(contaId, comunidadeId)).catch(() => undefined)
    await apagarChave(contaId, comunidadeId)
  }

  const mudarValidade = (contaId: string, comunidadeId: string) => async (validoAte: string) => {
    await alterarIndice((l) =>
      l.map((r) =>
        r.contaId === contaId && r.comunidadeId === comunidadeId ? { ...r, validoAte } : r,
      ),
    )
  }

  async function abrirComChave(contaId: string, comunidadeId: string) {
    const chave = await lerChave(contaId, comunidadeId)
    if (!chave) return null
    try {
      const db = await abrirBanco(nomeDoArquivo(contaId, comunidadeId), chave)
      return new ParticaoSqlite(contaId, comunidadeId, db, mudarValidade(contaId, comunidadeId))
    } catch (erro) {
      if (erro instanceof SemCifragem) {
        semCifra = true
        throw new ErroLocal(MENSAGEM_SEM_CIFRAGEM)
      }
      // Ilegível (chave perdida, arquivo corrompido): é uma cópia, então recomeça do zero.
      return null
    }
  }

  function obter(contaId: string, comunidadeId: string): Promise<ParticaoSqlite | null> {
    const chave = id(contaId, comunidadeId)
    let aberta = abertas.get(chave)
    if (!aberta) {
      aberta = abrirComChave(contaId, comunidadeId)
      abertas.set(chave, aberta)
      // Falhou ou não existe: não fica no cache, a próxima chamada tenta de novo.
      void aberta.then(
        (p) => {
          if (!p) abertas.delete(chave)
        },
        () => abertas.delete(chave),
      )
    }
    return aberta
  }

  async function apagar(contaId: string, comunidadeId: string): Promise<void> {
    await apagarFisico(contaId, comunidadeId)
    await alterarIndice((l) =>
      l.filter((r) => !(r.contaId === contaId && r.comunidadeId === comunidadeId)),
    )
  }

  const deposito: DepositoLocal = {
    get disponivel() {
      return !semCifra
    },
    get motivoIndisponivel() {
      return semCifra ? MENSAGEM_SEM_CIFRAGEM : null
    },

    async abrir(contaId, comunidadeId, agora = new Date()) {
      if (semCifra) return null
      const registro = (await lerIndice()).find(
        (r) => r.contaId === contaId && r.comunidadeId === comunidadeId,
      )
      if (!registro) return null
      // Vencida: bloqueada e apagada, nunca lida.
      if (Date.parse(registro.validoAte) <= agora.getTime()) {
        await apagar(contaId, comunidadeId)
        return null
      }
      const p = await obter(contaId, comunidadeId)
      if (!p) await apagar(contaId, comunidadeId)
      return p
    },

    async criar({ contaId, comunidadeId, vinculoId, validadeDias }, agora = new Date()) {
      if (semCifra) throw new ErroLocal(MENSAGEM_SEM_CIFRAGEM)
      const existente = await deposito.abrir(contaId, comunidadeId, agora)
      if (existente) return existente
      await apagarFisico(contaId, comunidadeId)
      const chave = await criarChave(contaId, comunidadeId)
      const validoAte = new Date(agora.getTime() + validadeDias * DIA_MS).toISOString()
      await alterarIndice((l) => [
        ...l.filter((r) => !(r.contaId === contaId && r.comunidadeId === comunidadeId)),
        { contaId, comunidadeId, validoAte },
      ])
      let p: ParticaoSqlite | null
      try {
        const db = await abrirBanco(nomeDoArquivo(contaId, comunidadeId), chave)
        p = new ParticaoSqlite(contaId, comunidadeId, db, mudarValidade(contaId, comunidadeId))
      } catch (erro) {
        await apagar(contaId, comunidadeId)
        if (erro instanceof SemCifragem) {
          semCifra = true
          throw new ErroLocal(MENSAGEM_SEM_CIFRAGEM)
        }
        throw erro
      }
      abertas.set(id(contaId, comunidadeId), Promise.resolve(p))
      await p.atualizarMeta({ vinculoId, validadeDias, validoAte, cursor: null })
      return p
    },

    listar: () => lerIndice(),

    apagar,

    async apagarVencidas(agora = new Date()) {
      const vencidas: ParticaoVencida[] = []
      for (const registro of await lerIndice()) {
        if (Date.parse(registro.validoAte) > agora.getTime()) continue
        // Lê o que ficou sem enviar só para mostrar na tela antes de sumir.
        const p = await obter(registro.contaId, registro.comunidadeId).catch(() => null)
        const operacoes = p ? await p.operacoes().catch(() => []) : []
        await apagar(registro.contaId, registro.comunidadeId)
        vencidas.push({ registro, operacoes })
      }
      return vencidas
    },

    async apagarOutrasContas(contaId) {
      const outras: RegistroDaParticao[] = (await lerIndice()).filter((r) => r.contaId !== contaId)
      for (const r of outras) await apagar(r.contaId, r.comunidadeId)
    },

    async apagarTudo() {
      for (const r of await lerIndice()) await apagar(r.contaId, r.comunidadeId)
    },
  }
  return deposito
}

/** Depósito único do app. Testes criam o próprio com `criarDeposito`. */
export const depositoPadrao: DepositoLocal = criarDeposito()
