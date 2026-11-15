import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { executarTarefasDiarias } from '../../src/cli/tarefas-diarias.ts'
import {
  criarComunidade,
  criarConta,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'

/**
 * Tarefas diárias com o papel dono: retenção do mapa de dados, materialização
 * das séries e poda do log de mudanças (sem cortar o que o cursor não viu).
 */

let b: BancoDeTeste
let com: string
let dona: string
let vinculo: string

beforeAll(async () => {
  b = await novoBanco()
  com = await criarComunidade(b, 'Jovens da Retenção')
  await b.su.query('update uj.comunidades set retencao_inscricoes_dias = 30 where id = $1', [com])
  dona = await criarConta(b, 'Dona da Série')
  vinculo = await vincular(b, dona, com, 'admin')
})

afterAll(async () => {
  await b.encerrar()
})

describe('tarefas diárias', () => {
  it('aplica as retenções, materializa séries e poda o log; o relatório só tem contagens', async () => {
    const um = async (sql: string, params: unknown[]) =>
      (await b.dono.query<{ id: string }>(sql, params)).rows[0]!.id
    const antigo = await um(
      `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
       values ($1, 'Evento antigo', 'Outra', now() - interval '40 days', 60, 'America/Sao_Paulo', $2, 'encerrado')
       returning id`,
      [com, dona],
    )
    await b.dono.query(
      `insert into uj.inscricoes (comunidade_id, evento_id, origem, nome, telefone, email, estado, consentimento_em)
       values ($1, $2, 'publica', 'Visitante Antigo', '+5511955554444', 'antigo@exemplo.test', 'confirmada', now())`,
      [com, antigo],
    )
    await b.dono.query(
      `insert into uj.presencas (comunidade_id, evento_id, nome_avulso, origem, registrada_por, chave_idempotencia)
       values ($1, $2, 'Avulso Antigo', 'manual', $3, gen_random_uuid())`,
      [com, antigo, vinculo],
    )
    await b.su.query(
      `insert into uj.sessoes (conta_id, familia, refresh_hash, plataforma, expira_em, criado_em, revogada_em)
       values ($1, gen_random_uuid(), sha256('velha'::bytea), 'ios', now() + interval '10 days',
               now() - interval '60 days', now() - interval '40 days')`,
      [dona],
    )
    await b.su.query(
      `insert into uj.verificacoes_email (email, codigo_hash, finalidade, expira_em, criado_em)
       values ('codigo@exemplo.test', sha256('x'::bytea), 'convite', now() - interval '2 days', now() - interval '2 days')`,
    )
    await b.su.query(
      `insert into uj.convites (comunidade_id, papel, email_destino, token_hmac, expira_em, criado_em, criado_por)
       values ($1, 'membro', 'convidado@exemplo.test', sha256('convite'::bytea),
               now() - interval '35 days', now() - interval '40 days', $2)`,
      [com, dona],
    )
    await b.su.query(
      `insert into uj.exportacoes (comunidade_id, dono_conta_id, tipo, token_hash, nome_arquivo, conteudo, linhas,
                                   criado_em, expira_em)
       values ($1, $2, 'membros', sha256('exp'::bytea), 'membros.csv', 'Nome', 0,
               now() - interval '2 days', now() - interval '1 day')`,
      [com, dona],
    )
    const serie = await um(
      `insert into uj.series (comunidade_id, regra, hora_local, fuso, duracao_min, inicio_em, titulo, categoria, criado_por)
       values ($1, '{"frequencia":"semanal","intervaloSemanas":1,"diasDaSemana":[6]}', '16:00',
               'America/Sao_Paulo', 60, current_date, 'Sábado', 'Outra', $2) returning id`,
      [com, dona],
    )
    await b.dono.query(
      "update uj.mudancas set momento = now() - interval '100 days' where comunidade_id = $1",
      [com],
    )

    const relatorio = await executarTarefasDiarias(b.dono)
    const retencao = relatorio['retencao'] as Record<string, number>
    expect(retencao['inscricoes_anonimizadas']).toBe(1)
    expect(retencao['presencas_avulsas_anonimizadas']).toBe(1)
    expect(retencao['exportacoes_expurgadas']).toBe(1)
    expect(retencao['sessoes_apagadas']).toBe(1)
    expect(retencao['codigos_de_verificacao_apagados']).toBe(1)
    expect(retencao['convites_sem_email']).toBe(1)
    expect(relatorio['ocorrencias_materializadas']).toBeGreaterThan(20)
    expect(typeof relatorio['mudancas_podadas']).toBe('number')
    const texto = JSON.stringify(relatorio)
    for (const pessoal of ['Visitante', 'Avulso', '955554444', 'exemplo.test']) {
      expect(texto).not.toContain(pessoal)
    }

    const inscricao = await b.su.query(
      'select nome, telefone, email from uj.inscricoes where evento_id = $1',
      [antigo],
    )
    expect(inscricao.rows).toEqual([{ nome: 'Participante', telefone: null, email: null }])
    const presenca = await b.su.query('select nome_avulso from uj.presencas where evento_id = $1', [
      antigo,
    ])
    expect(presenca.rows).toEqual([{ nome_avulso: 'Participante' }])
    // Ocorrências com a autoria de quem criou a série (o job não tem usuário).
    const autoria = await b.su.query<{ criado_por: string }>(
      'select distinct criado_por from uj.eventos where serie_id = $1',
      [serie],
    )
    expect(autoria.rows).toEqual([{ criado_por: dona }])
    // A poda só corta abaixo da marca d'água, que transações de outros testes em
    // paralelo podem segurar (D13): tenta por até 10 s.
    let marco = 0
    for (let i = 0; i < 100 && marco === 0; i++) {
      await b.dono.query('select uj.podar_mudancas(90)')
      marco = (await b.su.query('select 1 from uj.marco_de_sincronizacao')).rows.length
      if (marco === 0) await new Promise((r) => setTimeout(r, 100))
    }
    expect(marco).toBe(1)

    // Rodar de novo no mesmo dia não acha mais nada para anonimizar.
    const segunda = await executarTarefasDiarias(b.dono)
    expect((segunda['retencao'] as Record<string, number>)['inscricoes_anonimizadas']).toBe(0)
    expect(segunda['ocorrencias_materializadas']).toBe(0)
  })

  it('a poda nunca aceita prazo menor que a validade offline máxima', async () => {
    await expect(b.dono.query('select uj.podar_mudancas(10)')).rejects.toThrow()
  })

  it('os papéis do aplicativo não executam as rotinas de retenção', async () => {
    for (const papel of [b.api, b.auth]) {
      await expect(papel.query('select uj.executar_retencao()')).rejects.toMatchObject({
        code: '42501',
      })
      await expect(papel.query('select uj.podar_mudancas(90)')).rejects.toMatchObject({
        code: '42501',
      })
    }
  })
})
