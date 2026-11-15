import { randomBytes } from 'node:crypto'
import type pg from 'pg'
import { dataNoFuso, instanteNoFuso, MODELO_SABADO_PADRAO } from '@uj/dominio'
import { hashDeSenha } from '../autenticacao/cripto.ts'

/**
 * Dados fictícios de demonstração, para a homologação, o roteiro de
 * isolamento A × B e a conta dos revisores das lojas:
 *
 * - Comunidade A ("Comunidade de Demonstração"): duas admins, organizador e
 *   membro, um local e dois eventos (um "Sábado padrão" público, com etapas,
 *   escala e tarefa).
 * - Comunidade B ("Comunidade Vizinha de Demonstração"): uma admin própria, um
 *   local e um evento interno.
 * - Uma conta presente nas DUAS comunidades (membro em A, organizadora em B),
 *   para conferir que trocar de comunidade troca tudo o que se vê.
 *
 * Idempotente: cada peça é procurada antes de ser criada (comunidade pelo
 * nome, conta pelo e-mail, vínculo pelo par conta e comunidade). Rodar de
 * novo cria só o que falta e nunca mexe no que já existe (nem em senha).
 */

export const COMUNIDADE_A = 'Comunidade de Demonstração'
export const COMUNIDADE_B = 'Comunidade Vizinha de Demonstração'
const FUSO = 'America/Sao_Paulo'

type Papel = 'admin' | 'organizador' | 'membro'

interface PessoaFicticia {
  chave: string
  nome: string
  email: string
  vinculos: { comunidade: 'A' | 'B'; papel: Papel }[]
}

export const PESSOAS_FICTICIAS: readonly PessoaFicticia[] = [
  {
    chave: 'admin',
    nome: 'Ana Demonstração',
    email: 'demo.admin@unijovem.invalid',
    vinculos: [{ comunidade: 'A', papel: 'admin' }],
  },
  {
    chave: 'organizador',
    nome: 'Bruno Demonstração',
    email: 'demo.organizador@unijovem.invalid',
    vinculos: [{ comunidade: 'A', papel: 'organizador' }],
  },
  {
    chave: 'membro',
    nome: 'Carla Demonstração',
    email: 'demo.membro@unijovem.invalid',
    vinculos: [{ comunidade: 'A', papel: 'membro' }],
  },
  // Segunda administradora de A: a conta de revisão das lojas (qualquer uma das
  // outras) pode ser excluída sem esbarrar na regra do último administrador.
  {
    chave: 'admin2',
    nome: 'Diana Demonstração',
    email: 'demo.admin2@unijovem.invalid',
    vinculos: [{ comunidade: 'A', papel: 'admin' }],
  },
  {
    chave: 'admin_b',
    nome: 'Elisa Vizinha',
    email: 'demo.b.admin@unijovem.invalid',
    vinculos: [{ comunidade: 'B', papel: 'admin' }],
  },
  {
    chave: 'nas_duas',
    nome: 'Fábio Nas Duas',
    email: 'demo.duas@unijovem.invalid',
    vinculos: [
      { comunidade: 'A', papel: 'membro' },
      { comunidade: 'B', papel: 'organizador' },
    ],
  },
]

export interface ResultadoDaSemente {
  comunidades: { A: string; B: string }
  /** O que foi criado NESTA execução (vazio na repetição). */
  criadas: string[]
  /** Uma linha por conta criada agora, com a senha aleatória (só aqui, uma vez). */
  credenciais: string[]
}

/** Senha aleatória que passa nas regras do app (letras, números, 20 caracteres). */
const senhaAleatoria = () => randomBytes(15).toString('base64url')

async function novaSenha(): Promise<{ senha: string; hash: string }> {
  const senha = senhaAleatoria()
  return { senha, hash: await hashDeSenha(senha) }
}

/** Data local do próximo sábado (ou de daqui a `semanas` sábados). */
function proximoSabado(semanas = 0): string {
  const hoje = dataNoFuso(new Date(), FUSO)
  const [a, m, d] = hoje.split('-').map(Number) as [number, number, number]
  const base = new Date(Date.UTC(a, m - 1, d))
  const faltam = (6 - base.getUTCDay() + 7) % 7 || 7
  base.setUTCDate(base.getUTCDate() + faltam + semanas * 7)
  return base.toISOString().slice(0, 10)
}

/** Roda com a conexão do DONO do banco, numa transação só: ou tudo, ou nada. */
export async function semearDemonstracao(dono: pg.Pool): Promise<ResultadoDaSemente> {
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
  const criadas: string[] = []
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
      criadas.push(`comunidade ${nome}`)
      return { id: nova.rows[0]!.id, nova: true }
    }
    const a = await comunidade(COMUNIDADE_A, '#9D8FFF')
    const b = await comunidade(COMUNIDADE_B, '#2E9E83')
    const idDa = { A: a.id, B: b.id }

    const contas: Record<string, string> = {}
    const vinculos: Record<string, string> = {}
    for (const p of PESSOAS_FICTICIAS) {
      const ja = await c.query<{ id: string }>('select id from uj.contas where email = $1', [
        p.email,
      ])
      let conta = ja.rows[0]?.id
      if (!conta) {
        // Sem senha pronta só se a conta sumiu entre a leitura e aqui (raro).
        const { senha, hash } = senhas.get(p.email) ?? (await novaSenha())
        conta = (
          await c.query<{ id: string }>(
            `insert into uj.contas (nome, email, email_verificado_em, senha_hash, faixa_etaria)
             values ($1, $2, now(), $3, '18_mais') returning id`,
            [p.nome, p.email, hash],
          )
        ).rows[0]!.id
        criadas.push(`conta ${p.email}`)
        credenciais.push(`${p.chave.padEnd(12)} ${p.email}  senha: ${senha}`)
      }
      contas[p.chave] = conta
      for (const v of p.vinculos) {
        const existente = await c.query<{ id: string }>(
          'select id from uj.vinculos where conta_id = $1 and comunidade_id = $2',
          [conta, idDa[v.comunidade]],
        )
        let id = existente.rows[0]?.id
        if (!id) {
          id = (
            await c.query<{ id: string }>(
              `insert into uj.vinculos (conta_id, comunidade_id, papel)
               values ($1, $2, $3) returning id`,
              [conta, idDa[v.comunidade], v.papel],
            )
          ).rows[0]!.id
          criadas.push(`vínculo ${p.email} em ${v.comunidade}`)
        }
        vinculos[`${p.chave}:${v.comunidade}`] = id
      }
    }

    // Conteúdo só na comunidade que nasceu agora: na repetição, nada se duplica
    // e nada do que a equipe mudou na demonstração é desfeito.
    if (a.nova) {
      await conteudoDeA(c, a.id, contas['admin']!, {
        membro: vinculos['membro:A']!,
        organizador: vinculos['organizador:A']!,
      })
    }
    if (b.nova) await conteudoDeB(c, b.id, contas['admin_b']!)

    await c.query('commit')
    return { comunidades: { A: a.id, B: b.id }, criadas, credenciais }
  } catch (e) {
    await c.query('rollback').catch(() => undefined)
    throw e
  } finally {
    c.release()
  }
}

/** A autoria dos eventos vem do contexto (criado_por = uj.conta_atual()). */
async function noContexto(c: pg.PoolClient, contaId: string, comunidadeId: string) {
  await c.query("select set_config('app.conta_id', $1, true)", [contaId])
  await c.query("select set_config('app.comunidade_id', $1, true)", [comunidadeId])
}

async function conteudoDeA(
  c: pg.PoolClient,
  comunidade: string,
  autora: string,
  vinculos: { membro: string; organizador: string },
): Promise<void> {
  await noContexto(c, autora, comunidade)
  const local = (
    await c.query<{ id: string }>(
      `insert into uj.locais (comunidade_id, nome, tipo, referencia)
       values ($1, 'Salão da igreja', 'interno', 'Entrada lateral, ao lado da secretaria') returning id`,
      [comunidade],
    )
  ).rows[0]!.id

  const sabado = MODELO_SABADO_PADRAO
  const duracao = sabado.etapas.reduce((t, e) => t + e.duracaoMin, 0)
  const evento = (
    await c.query<{ id: string }>(
      `insert into uj.eventos (comunidade_id, titulo, descricao, categoria, inicio, duracao_min, fuso,
         status, visibilidade, local_id, capacidade, lista_de_espera)
       values ($1, 'Sábado Jovem', 'Programação de sábado com louvor, dinâmica e estudo.', $2, $3, $4, $5,
         'publicado', 'publica', $6, 60, true) returning id`,
      [
        comunidade,
        sabado.categoria,
        instanteNoFuso(proximoSabado(), '16:00', FUSO),
        duracao,
        FUSO,
        local,
      ],
    )
  ).rows[0]!.id
  let louvor = ''
  for (const [ordem, etapa] of sabado.etapas.entries()) {
    const id = (
      await c.query<{ id: string }>(
        `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min)
         values ($1, $2, $3, $4, $5) returning id`,
        [comunidade, evento, ordem, etapa.titulo, etapa.duracaoMin],
      )
    ).rows[0]!.id
    if (etapa.titulo === 'Louvor') louvor = id
  }
  await c.query(
    `insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id, funcao)
     values ($1, $2, $3, $4, 'vocal'), ($1, $2, $3, $5, 'violão')`,
    [comunidade, evento, louvor, vinculos.membro, vinculos.organizador],
  )
  await c.query(
    `insert into uj.tarefas (comunidade_id, evento_id, titulo, responsavel_vinculo_id)
     values ($1, $2, 'Imprimir a lição da semana', $3)`,
    [comunidade, evento, vinculos.organizador],
  )
  await c.query(
    `insert into uj.eventos (comunidade_id, titulo, descricao, categoria, inicio, duracao_min, fuso,
       status, visibilidade, local_id)
     values ($1, 'Noite de jogos', 'Jogos de tabuleiro e lanche.', 'Noite de jogos', $2, 150, $3,
       'publicado', 'interna', $4)`,
    [comunidade, instanteNoFuso(proximoSabado(1), '19:30', FUSO), FUSO, local],
  )
}

async function conteudoDeB(c: pg.PoolClient, comunidade: string, autora: string): Promise<void> {
  await noContexto(c, autora, comunidade)
  const local = (
    await c.query<{ id: string }>(
      `insert into uj.locais (comunidade_id, nome, tipo, referencia)
       values ($1, 'Sala dos jovens', 'interno', 'Segundo andar, porta azul') returning id`,
      [comunidade],
    )
  ).rows[0]!.id
  await c.query(
    `insert into uj.eventos (comunidade_id, titulo, descricao, categoria, inicio, duracao_min, fuso,
       status, visibilidade, local_id)
     values ($1, 'Encontro da Vizinha', 'Evento fictício que só existe na comunidade B.',
       'Encontro', $2, 120, $3, 'publicado', 'interna', $4)`,
    [comunidade, instanteNoFuso(proximoSabado(), '19:00', FUSO), FUSO, local],
  )
}
