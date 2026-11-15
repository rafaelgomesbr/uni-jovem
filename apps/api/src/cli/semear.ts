/**
 * Dados fictícios de demonstração: uma comunidade com duas admins, organizador e
 * membro, um local e dois eventos (um "Sábado padrão" público, com etapas,
 * escala e tarefa). Serve para testar a homologação e para a conta de
 * demonstração dos revisores das lojas.
 *
 * Uso (no servidor, com o .env do ambiente carregado):
 *   DATABASE_URL_DONO=... npx tsx apps/api/src/cli/semear.ts > contas-demo.txt
 *
 * As senhas são aleatórias e saem SÓ na saída padrão, uma vez. Redirecione
 * para um arquivo com permissão restrita. Rodar de novo não duplica nada: se
 * a comunidade de demonstração já existe, o script para.
 */
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { dataNoFuso, instanteNoFuso, MODELO_SABADO_PADRAO } from '@uj/dominio'
import { hashDeSenha } from '../autenticacao/cripto.ts'

const NOME_DA_COMUNIDADE = 'Comunidade de Demonstração'
const FUSO = 'America/Sao_Paulo'

const url = process.env['DATABASE_URL_DONO']
if (!url) {
  console.error('Defina DATABASE_URL_DONO no ambiente.')
  process.exit(1)
}
if (process.env['UJ_AMBIENTE'] === 'producao' && process.env['UJ_SEMEAR_EM_PRODUCAO'] !== 'sim') {
  console.error(
    'Em produção, confirme com UJ_SEMEAR_EM_PRODUCAO=sim (só para a conta dos revisores).',
  )
  process.exit(1)
}

/** Senha aleatória que passa nas regras do app (letras, números, 20 caracteres). */
const senhaAleatoria = () => randomBytes(15).toString('base64url')

/** Data local do próximo sábado (ou de daqui a `semanas` sábados). */
function proximoSabado(semanas = 0): string {
  const hoje = dataNoFuso(new Date(), FUSO)
  const [a, m, d] = hoje.split('-').map(Number) as [number, number, number]
  const base = new Date(Date.UTC(a, m - 1, d))
  const faltam = (6 - base.getUTCDay() + 7) % 7 || 7
  base.setUTCDate(base.getUTCDate() + faltam + semanas * 7)
  return base.toISOString().slice(0, 10)
}

const pool = new pg.Pool({ connectionString: url, max: 1 })
const c = await pool.connect()
try {
  await c.query('begin')
  const ja = await c.query('select id from uj.comunidades where nome = $1', [NOME_DA_COMUNIDADE])
  if (ja.rows[0]) {
    console.error('A comunidade de demonstração já existe; nada foi alterado.')
    await c.query('rollback')
    process.exit(0)
  }

  const pessoas = [
    { nome: 'Ana Demonstração', email: 'demo.admin@unijovem.invalid', papel: 'admin' },
    {
      nome: 'Bruno Demonstração',
      email: 'demo.organizador@unijovem.invalid',
      papel: 'organizador',
    },
    { nome: 'Carla Demonstração', email: 'demo.membro@unijovem.invalid', papel: 'membro' },
    // Segunda administradora: a conta de revisão das lojas (qualquer uma das
    // outras) pode ser excluída sem esbarrar na regra do último administrador.
    { nome: 'Diana Demonstração', email: 'demo.admin2@unijovem.invalid', papel: 'admin2' },
  ] as const
  const comunidade = (
    await c.query<{ id: string }>(
      `insert into uj.comunidades (nome, cor, fuso, validade_offline_dias) values ($1, $2, $3, 7) returning id`,
      [NOME_DA_COMUNIDADE, '#9D8FFF', FUSO],
    )
  ).rows[0]!.id

  const credenciais: string[] = []
  const vinculos: Record<string, string> = {}
  const contas: Record<string, string> = {}
  for (const p of pessoas) {
    const senha = senhaAleatoria()
    const conta = (
      await c.query<{ id: string }>(
        `insert into uj.contas (nome, email, email_verificado_em, senha_hash, faixa_etaria)
         values ($1, $2, now(), $3, '18_mais') returning id`,
        [p.nome, p.email, await hashDeSenha(senha)],
      )
    ).rows[0]!.id
    contas[p.papel] = conta
    vinculos[p.papel] = (
      await c.query<{ id: string }>(
        'insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1, $2, $3) returning id',
        [conta, comunidade, p.papel === 'admin2' ? 'admin' : p.papel],
      )
    ).rows[0]!.id
    credenciais.push(`${p.papel.padEnd(12)} ${p.email}  senha: ${senha}`)
  }

  // A autoria dos eventos vem do contexto (criado_por = uj.conta_atual()).
  await c.query("select set_config('app.conta_id', $1, true)", [contas['admin']])
  await c.query("select set_config('app.comunidade_id', $1, true)", [comunidade])

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
    [comunidade, evento, louvor, vinculos['membro'], vinculos['organizador']],
  )
  await c.query(
    `insert into uj.tarefas (comunidade_id, evento_id, titulo, responsavel_vinculo_id)
     values ($1, $2, 'Imprimir a lição da semana', $3)`,
    [comunidade, evento, vinculos['organizador']],
  )
  await c.query(
    `insert into uj.eventos (comunidade_id, titulo, descricao, categoria, inicio, duracao_min, fuso,
       status, visibilidade, local_id)
     values ($1, 'Noite de jogos', 'Jogos de tabuleiro e lanche.', 'Noite de jogos', $2, 150, $3,
       'publicado', 'interna', $4)`,
    [comunidade, instanteNoFuso(proximoSabado(1), '19:30', FUSO), FUSO, local],
  )

  await c.query('commit')
  const saida = [
    `Comunidade de demonstração criada (${comunidade}).`,
    'Contas fictícias (guarde em local seguro; não são mostradas de novo):',
    ...credenciais.map((linha) => `  ${linha}`),
  ]
  process.stdout.write(saida.join('\n') + '\n')
} catch (e) {
  await c.query('rollback')
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  c.release()
  await pool.end()
}
