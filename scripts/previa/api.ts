import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Processo da API na prévia: carrega apps/api/src/index.ts sem mudar nada nele
 * e acrescenta só um jeito de pedir a parada que funciona no Windows.
 *
 * No Windows não há sinal entre processos (kill vira TerminateProcess). O
 * orquestrador pede a parada pelo canal IPC, e aqui ela vira o mesmo SIGINT
 * que a API já trata: fecha o servidor e os pools e sai com código 0.
 */

const pedirParada = () => {
  process.emit('SIGINT', 'SIGINT')
}
process.on('message', (mensagem) => {
  if (mensagem === 'parar') pedirParada()
})
// O orquestrador caiu sem avisar: a API para junto, sem ficar órfã.
process.on('disconnect', pedirParada)

// Caminho montado em tempo de execução para o tsc da raiz não checar a API
// inteira (ela tem o próprio tsconfig e a própria verificação).
const entrada = join(import.meta.dirname, '..', '..', 'apps', 'api', 'src', 'index.ts')
await import(pathToFileURL(entrada).href)
