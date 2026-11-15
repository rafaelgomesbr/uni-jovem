/**
 * Dados fictícios de demonstração (comunidades A e B, contas e o conteúdo de
 * A; ver `demonstracao.ts`). Serve para testar a homologação, para o roteiro
 * de isolamento A × B, para a conta de demonstração dos revisores das lojas,
 * para os prints das lojas e para a prévia local.
 *
 * Uso (no servidor, com o .env do ambiente carregado):
 *   DATABASE_URL_DONO=... ORACAO_CHAVE=... npx tsx apps/api/src/cli/semear.ts > contas-demo.txt
 *
 * ORACAO_CHAVE é a MESMA chave da API: os pedidos de oração são cifrados aqui
 * como a rota `/oracao` cifra. Sem ela, a semente avisa e pula só a oração.
 *
 * As senhas são aleatórias e saem SÓ na saída padrão, uma vez, e só das contas
 * criadas nesta execução (os figurantes não têm senha). Redirecione para um
 * arquivo com permissão restrita. Rodar de novo não duplica nada: cria só o
 * que falta (por exemplo, a agenda das semanas seguintes num ambiente que já
 * tinha a demonstração) e não mexe no que existe.
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
const chaveEmTexto = process.env['ORACAO_CHAVE']
const chaveDeOracao = chaveEmTexto ? Buffer.from(chaveEmTexto, 'base64') : null
if (chaveDeOracao && chaveDeOracao.length !== 32) {
  console.error('ORACAO_CHAVE precisa ter 32 bytes em base64 (a mesma da API).')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: url, max: 1 })
try {
  const r = await semearDemonstracao(pool, { chaveDeOracao })
  for (const aviso of r.avisos) console.error(`Aviso: ${aviso}`)
  if (r.criadas.length === 0 && Object.keys(r.contagem).length === 0) {
    console.error('A demonstração já estava completa; nada foi alterado.')
  } else {
    const saida = [
      `Comunidade A: ${r.comunidades.A}`,
      `Comunidade B: ${r.comunidades.B}`,
      'Criado agora:',
      ...r.criadas.map((linha) => `  ${linha}`),
      `Totais: ${Object.entries(r.contagem)
        .map(([tipo, n]) => `${tipo} ${n}`)
        .join(', ')}`,
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
  // Mensagem do banco ou da semente, sem parâmetros: nenhuma leva texto de oração.
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await pool.end()
}
