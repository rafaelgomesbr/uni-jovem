import { LARGURA_DA_BARRA_LATERAL } from '@/constantes'

import { ABAS, type DefinicaoDaAba } from './abas'

/**
 * Telas da pilha que NÃO mostram a barra de abas flutuante (D56). Todas são
 * tarefas que se concluem ou se cancelam, o padrão de modal do HIG: trocar de
 * aba no meio delas largaria o que a pessoa escreveu, e a saída certa é
 * "Concluir" ou "Fechar". Também ficam de fora o Ao vivo (tela grande de
 * condução, sem distração) e as folhas e modais de apresentação nativa, que já
 * cobrem a barra. O nome é o da rota no layout `(autenticado)`, sem o
 * `/index` do fim. A lista vale para a barra e para o espaço que a `Tela`
 * reserva no fim da rolagem: as duas leem daqui.
 */
export const ROTAS_SEM_BARRA_FLUTUANTE: ReadonlySet<string> = new Set([
  // Folhas e modais (`formSheet`, `modal`, `fullScreenModal` no layout).
  'trocar-comunidade',
  'como-conseguir-convite',
  'criar-comunidade',
  'evento/novo',
  'evento/[eventoId]/editar',
  'evento/[eventoId]/duplicar',
  'evento/[eventoId]/status',
  'evento/[eventoId]/ler-qr',
  'escalas/substituicao/[atribuicaoId]',
  // Formulários de criação.
  'oracao/novo',
  'sugestoes/nova',
  'avisos/novo',
  'conteudos/[tipo]/novo',
  'plataforma/nova',
  // Condução ao vivo.
  'evento/[eventoId]/ao-vivo',
  // Leitura da cifra (D61): a letra grande ocupa a tela, sem a barra no caminho.
  'meu-repertorio/[eventoId]/[itemId]',
])

const GRUPO_AUTENTICADO = '(autenticado)'
const GRUPO_DAS_ABAS = '(abas)'

/**
 * Nome da rota a partir dos segmentos (`useSegments`) ou do nome da tela na
 * pilha (`route.name`): sem o grupo `(autenticado)` e sem o `/index` do fim.
 */
export function nomeDaRota(rota: string | readonly string[]): string {
  const partes = typeof rota === 'string' ? rota.split('/') : [...rota]
  if (partes[0] === GRUPO_AUTENTICADO) partes.shift()
  if (partes.at(-1) === 'index') partes.pop()
  return partes.join('/')
}

/** A rota é do grupo das abas (lá a barra é a do próprio `Tabs`)? */
function ehDasAbas(nome: string): boolean {
  return nome === GRUPO_DAS_ABAS || nome.startsWith(`${GRUPO_DAS_ABAS}/`)
}

/** Tela empilhada que mostra a barra flutuante global (nem aba, nem exceção). */
export function barraFlutuanteNaRota(rota: string | readonly string[]): boolean {
  const nome = nomeDaRota(rota)
  return nome !== '' && !ehDasAbas(nome) && !ROTAS_SEM_BARRA_FLUTUANTE.has(nome)
}

/** A aba aberta, se os segmentos são do grupo das abas (o Início é a rota vazia). */
export function abaDosSegmentos(segmentos: readonly string[]): DefinicaoDaAba['rota'] | null {
  const nome = nomeDaRota(segmentos)
  if (!ehDasAbas(nome)) return null
  const rota = nome.slice(GRUPO_DAS_ABAS.length + 1) || 'index'
  return ABAS.find((a) => a.rota === rota)?.rota ?? null
}

/**
 * A barra flutuante existe nesta janela? No celular, sempre. Na web larga a
 * navegação é a barra lateral das abas e as telas da pilha seguem só com o
 * voltar, como antes; na web estreita, a mesma barra flutuante do celular.
 */
export function barraFlutuanteNaJanela(web: boolean, largura: number): boolean {
  return !web || largura < LARGURA_DA_BARRA_LATERAL
}
