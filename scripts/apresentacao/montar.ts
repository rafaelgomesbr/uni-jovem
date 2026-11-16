/**
 * Monta a apresentação em HTML de um arquivo só (docs/apresentacao), trocando
 * cada {{nome}} do modelo pela tela `scripts/apresentacao/telas/<nome>.jpg`
 * embutida. As telas saem de `telas.ts` (prévia local).
 *
 *   node --import tsx scripts/apresentacao/telas.ts scripts/apresentacao/telas
 *   node --import tsx scripts/apresentacao/montar.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PASTA = import.meta.dirname
const SAIDA = join(PASTA, '..', '..', 'docs', 'apresentacao', 'uni-jovem-apresentacao.html')

const modelo = readFileSync(join(PASTA, 'modelo.html'), 'utf8')
const html = modelo.replace(/\{\{([0-9a-z-]+)\}\}/g, (_, nome: string) => {
  const dados = readFileSync(join(PASTA, 'telas', `${nome}.jpg`)).toString('base64')
  return `data:image/jpeg;base64,${dados}`
})
mkdirSync(join(SAIDA, '..'), { recursive: true })
writeFileSync(SAIDA, html)
console.warn(`Apresentação: ${SAIDA} (${(html.length / 1e6).toFixed(1)} MB)`)
