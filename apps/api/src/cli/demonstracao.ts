import { randomBytes } from 'node:crypto'
import type pg from 'pg'
import { dataNoFuso, instanteNoFuso } from '@uj/dominio'
import { hashDeSenha } from '../autenticacao/cripto.ts'
import {
  anotar,
  noContexto,
  semearComunidadeA,
  type PessoaEmA,
  type Registro,
} from './demonstracao-comunidade-a.ts'
import { FIGURANTES_DE_A, proximoSabado, type ChaveEmA } from './demonstracao-plano.ts'

/**
 * Dados fictícios de demonstração, para a homologação, o roteiro de
 * isolamento A × B, a conta dos revisores das lojas, os prints das lojas e a
 * prévia local:
 *
 * - Comunidade A ("Comunidade de Demonstração"): duas admins, organizador e
 *   membro com senha, dez figurantes sem senha, e uma comunidade viva: agenda
 *   de sete semanas (sábados com programação, escalas, tarefas e checklist,
 *   um retiro com inscrições, dois sábados passados com presença), escalas
 *   confirmadas e pendentes, uma substituição aberta, disponibilidade, avisos,
 *   pedidos de oração cifrados, sugestões e conteúdos (ver
 *   `demonstracao-plano.ts`).
 * - Comunidade B ("Comunidade Vizinha de Demonstração"): uma admin própria, um
 *   local e um evento interno.
 * - Uma conta presente nas DUAS comunidades (membro em A, organizadora em B),
 *   para conferir que trocar de comunidade troca tudo o que se vê.
 *
 * Idempotente: cada peça é procurada pela chave natural antes de ser criada
 * (comunidade pelo nome, conta pelo e-mail, vínculo pelo par conta e
 * comunidade; o conteúdo de A, ver `demonstracao-comunidade-a.ts`). Rodar de
 * novo cria só o que falta e nunca mexe no que já existe (nem em senha).
 */

export const COMUNIDADE_A = 'Comunidade de Demonstração'
export const COMUNIDADE_B = 'Comunidade Vizinha de Demonstração'
const FUSO = 'America/Sao_Paulo'

type Papel = 'admin' | 'organizador' | 'membro'

interface PessoaFicticia {
  chave: ChaveEmA | 'admin_b'
  nome: string
  email: string
  vinculos: { comunidade: 'A' | 'B'; papel: Papel }[]
  /** Figurante: conta sem senha, só para a comunidade parecer viva. */
  figurante?: true
  avatar?: { icone: string; cor: string }
}

/**
 * As contas de demonstração com senha (uma linha de credencial para cada). Os
 * nomes são os do roteiro das capturas (docs/lojas/capturas.md, seção 4.2); os
 * e-mails `demo.*` são os que os revisores das lojas usam e não mudam. Conta
 * que já existe guarda o nome que tinha (a semente nunca altera conta).
 */
export const PESSOAS_FICTICIAS: readonly PessoaFicticia[] = [
  {
    chave: 'admin',
    nome: 'Ana Ribeiro',
    email: 'demo.admin@unijovem.invalid',
    vinculos: [{ comunidade: 'A', papel: 'admin' }],
  },
  {
    chave: 'organizador',
    nome: 'Bruno Tavares',
    email: 'demo.organizador@unijovem.invalid',
    vinculos: [{ comunidade: 'A', papel: 'organizador' }],
  },
  {
    chave: 'membro',
    nome: 'Carla Menezes',
    email: 'demo.membro@unijovem.invalid',
    vinculos: [{ comunidade: 'A', papel: 'membro' }],
  },
  // Segunda administradora de A: a conta de revisão das lojas (qualquer uma das
  // outras) pode ser excluída sem esbarrar na regra do último administrador.
  {
    chave: 'admin2',
    nome: 'Diana Lopes',
    email: 'demo.admin2@unijovem.invalid',
    vinculos: [{ comunidade: 'A', papel: 'admin' }],
  },
  {
    chave: 'admin_b',
    nome: 'Elisa Vizinha',
    email: 'demo.b.admin@unijovem.invalid',
    vinculos: [{ comunidade: 'B', papel: 'admin' }],
  },
  // Membro em A e organizador em B; o nome é natural porque aparece nas capturas da equipe.
  {
    chave: 'nas_duas',
    nome: 'Fábio Andrade',
    email: 'demo.duas@unijovem.invalid',
    vinculos: [
      { comunidade: 'A', papel: 'membro' },
      { comunidade: 'B', papel: 'organizador' },
    ],
  },
]

const FIGURANTES: readonly PessoaFicticia[] = FIGURANTES_DE_A.map((f) => ({
  chave: f.chave,
  nome: f.nome,
  email: f.email,
  vinculos: [{ comunidade: 'A', papel: f.papel }],
  figurante: true,
  ...(f.avatar ? { avatar: f.avatar } : {}),
}))

export interface ResultadoDaSemente {
  comunidades: { A: string; B: string }
  /** O que foi criado NESTA execução (vazio na repetição). Nunca traz texto de oração. */
  criadas: string[]
  /** Quantas peças de cada tipo foram criadas nesta execução. */
  contagem: Record<string, number>
  /** Uma linha por conta COM SENHA criada agora, com a senha aleatória (só aqui, uma vez). */
  credenciais: string[]
  /** O que ficou de fora e por quê (por exemplo, oração sem a chave). */
  avisos: string[]
}

export interface OpcoesDaSemente {
  /** ORACAO_CHAVE da API (32 bytes). Sem ela, a semente pula os pedidos de oração. */
  chaveDeOracao?: Buffer | null
}

/** Senha aleatória que passa nas regras do app (letras, números, 20 caracteres). */
const senhaAleatoria = () => randomBytes(15).toString('base64url')

async function novaSenha(): Promise<{ senha: string; hash: string }> {
  const senha = senhaAleatoria()
  return { senha, hash: await hashDeSenha(senha) }
}

/** Roda com a conexão do DONO do banco, numa transação só: ou tudo, ou nada. */
export async function semearDemonstracao(
  dono: pg.Pool,
  opcoes: OpcoesDaSemente = {},
): Promise<ResultadoDaSemente> {
  const chaveDeOracao = opcoes.chaveDeOracao ?? null
  if (chaveDeOracao && chaveDeOracao.length !== 32) {
    throw new Error('ORACAO_CHAVE precisa ter 32 bytes (em base64).')
  }
  // As senhas das contas que faltam são geradas ANTES da transação: o hash é
  // lento de propósito, e uma transação aberta com escrita segura a marca
  // d'água da sincronização do cluster inteiro (D13).
  const jaExistem = new Set(
    (
      await dono.query<{ email: string }>('select email from uj.contas where email = any($1)', [
        PESSOAS_FICTICIAS.map((p) => p.email),
      ])
    ).rows.map((r) => r.email),
  )
  const senhas = new Map<string, { senha: string; hash: string }>()
  await Promise.all(
    PESSOAS_FICTICIAS.filter((p) => !jaExistem.has(p.email)).map(async (p) => {
      senhas.set(p.email, await novaSenha())
    }),
  )

  const c = await dono.connect()
  const registro: Registro = { criadas: [], contagem: {}, avisos: [] }
  const credenciais: string[] = []
  try {
    await c.query('begin')
    // Duas execuções ao mesmo tempo: a segunda espera e encontra tudo pronto.
    await c.query("select pg_advisory_xact_lock(hashtext('uj_semear_demonstracao'))")

    const comunidade = async (nome: string, cor: string) => {
      const ja = await c.query<{ id: string }>('select id from uj.comunidades where nome = $1', [
        nome,
      ])
      if (ja.rows[0]) return { id: ja.rows[0].id, nova: false }
      const nova = await c.query<{ id: string }>(
        `insert into uj.comunidades (nome, cor, fuso, validade_offline_dias)
         values ($1, $2, $3, 7) returning id`,
        [nome, cor, FUSO],
      )
      anotar(registro, 'comunidades', `comunidade ${nome}`)
      return { id: nova.rows[0]!.id, nova: true }
    }
    const a = await comunidade(COMUNIDADE_A, '#9D8FFF')
    const b = await comunidade(COMUNIDADE_B, '#2E9E83')
    const idDa = { A: a.id, B: b.id }

    const contas: Record<string, string> = {}
    for (const p of [...PESSOAS_FICTICIAS, ...FIGURANTES]) {
      const ja = await c.query<{ id: string }>('select id from uj.contas where email = $1', [
        p.email,
      ])
      let conta = ja.rows[0]?.id
      if (!conta && p.figurante) {
        // Sem senha (`senha_hash` nulo): a entrada por senha recusa a conta.
        conta = (
          await c.query<{ id: string }>(
            `insert into uj.contas (nome, email, email_verificado_em, faixa_etaria,
               avatar_icone, avatar_cor)
             values ($1, $2, now(), '18_mais', $3, $4) returning id`,
            [p.nome, p.email, p.avatar?.icone ?? null, p.avatar?.cor ?? null],
          )
        ).rows[0]!.id
        anotar(registro, 'contas', `conta ${p.email} (figurante, sem senha)`)
      } else if (!conta) {
        // Sem senha pronta só se a conta sumiu entre a leitura e aqui (raro).
        const { senha, hash } = senhas.get(p.email) ?? (await novaSenha())
        conta = (
          await c.query<{ id: string }>(
            `insert into uj.contas (nome, email, email_verificado_em, senha_hash, faixa_etaria)
             values ($1, $2, now(), $3, '18_mais') returning id`,
            [p.nome, p.email, hash],
          )
        ).rows[0]!.id
        anotar(registro, 'contas', `conta ${p.email}`)
        credenciais.push(`${p.chave.padEnd(12)} ${p.email}  senha: ${senha}`)
      }
      contas[p.chave] = conta
      for (const v of p.vinculos) {
        const existente = await c.query<{ id: string }>(
          'select id from uj.vinculos where conta_id = $1 and comunidade_id = $2',
          [conta, idDa[v.comunidade]],
        )
        if (!existente.rows[0]) {
          await c.query(
            'insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1, $2, $3)',
            [conta, idDa[v.comunidade], v.papel],
          )
          anotar(registro, 'vínculos', `vínculo ${p.email} em ${v.comunidade}`)
        }
      }
    }

    // Só quem está ATIVO em A entra no conteúdo: uma conta de revisão excluída
    // (ou um vínculo removido pela equipe) fica de fora, sem derrubar a semente.
    const ativas = await c.query<{ email: string; conta: string; vinculo: string }>(
      `select a.email, a.id as conta, v.id as vinculo
         from uj.vinculos v join uj.contas a on a.id = v.conta_id
        where v.comunidade_id = $1 and v.estado = 'ativo' and a.estado = 'ativa'
          and a.email = any($2)`,
      [a.id, [...PESSOAS_FICTICIAS, ...FIGURANTES].map((p) => p.email)],
    )
    const pessoas: Partial<Record<ChaveEmA, PessoaEmA>> = {}
    for (const p of [...PESSOAS_FICTICIAS, ...FIGURANTES]) {
      const linha = ativas.rows.find((r) => r.email === p.email)
      if (linha && p.chave !== 'admin_b') {
        pessoas[p.chave] = { conta: linha.conta, vinculo: linha.vinculo }
      }
    }
    // Na repetição, cria só o que falta; o que a equipe mudou não é desfeito.
    await semearComunidadeA(c, { comunidade: a.id, pessoas, chaveDeOracao, registro })
    if (b.nova) await conteudoDeB(c, b.id, contas['admin_b']!, registro)

    await c.query('commit')
    return {
      comunidades: { A: a.id, B: b.id },
      criadas: registro.criadas,
      contagem: registro.contagem,
      credenciais,
      avisos: registro.avisos,
    }
  } catch (e) {
    await c.query('rollback').catch(() => undefined)
    throw e
  } finally {
    c.release()
  }
}

async function conteudoDeB(
  c: pg.PoolClient,
  comunidade: string,
  autora: string,
  registro: Registro,
): Promise<void> {
  await noContexto(c, autora, comunidade)
  const local = (
    await c.query<{ id: string }>(
      `insert into uj.locais (comunidade_id, nome, tipo, referencia)
       values ($1, 'Sala dos jovens', 'interno', 'Segundo andar, porta azul') returning id`,
      [comunidade],
    )
  ).rows[0]!.id
  anotar(registro, 'locais')
  await c.query(
    `insert into uj.eventos (comunidade_id, titulo, descricao, categoria, inicio, duracao_min, fuso,
       status, visibilidade, local_id)
     values ($1, 'Encontro da Vizinha', 'Evento fictício que só existe na comunidade B.',
       'Encontro', $2, 120, $3, 'publicado', 'interna', $4)`,
    [
      comunidade,
      instanteNoFuso(proximoSabado(dataNoFuso(new Date(), FUSO)), '19:00', FUSO),
      FUSO,
      local,
    ],
  )
  anotar(registro, 'eventos', 'evento Encontro da Vizinha')
}
