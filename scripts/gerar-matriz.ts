import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gerarMatrizMarkdown } from '../packages/dominio/src/index.ts'

const destino = join(import.meta.dirname, '..', 'docs', 'matriz-permissoes.md')
await writeFile(destino, gerarMatrizMarkdown(), 'utf8')
console.warn(`Matriz gravada em ${destino}`)
