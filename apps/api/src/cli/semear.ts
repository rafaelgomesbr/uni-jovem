/**
 * Dados fictícios de demonstração (comunidades A e B, contas e eventos; ver
 * `demonstracao.ts`). Serve para testar a homologação, para o roteiro de
 * isolamento A × B e para a conta de demonstração dos revisores das lojas.
 *
 * Uso (no servidor, com o .env do ambiente carregado):
 *   DATABASE_URL_DONO=... npx tsx apps/api/src/cli/semear.ts > contas-demo.txt
 *
 * As senhas são aleatórias e saem SÓ na saída padrão, uma vez, e só das contas
 * criadas nesta execução. Redirecione para um arquivo com permissão restrita.
 * Rodar de novo não duplica nada: cria só o que falta (por exemplo, a
 * comunidade B num ambiente que já tinha a A) e não mexe no que existe.
 */
import pg from 'pg'
import { semearDemonstracao } from './demonstracao.ts'

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

const pool = new pg.Pool({ connectionString: url, max: 1 })
try {
  const r = await semearDemonstracao(pool)
  if (r.criadas.length === 0) {
    console.error('A demonstração já estava completa; nada foi alterado.')
  } else {
    const saida = [
      `Comunidade A: ${r.comunidades.A}`,
      `Comunidade B: ${r.comunidades.B}`,
      'Criado agora:',
      ...r.criadas.map((linha) => `  ${linha}`),
      ...(r.credenciais.length > 0
        ? [
            'Contas fictícias novas (guarde em local seguro; não são mostradas de novo):',
            ...r.credenciais.map((linha) => `  ${linha}`),
          ]
        : []),
    ]
    process.stdout.write(saida.join('\n') + '\n')
  }
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await pool.end()
}
