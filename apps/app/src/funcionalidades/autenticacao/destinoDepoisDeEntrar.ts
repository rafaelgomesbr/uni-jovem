import { router, useGlobalSearchParams, usePathname, useSegments, type Href } from 'expo-router'
import { useEffect, useRef } from 'react'

import type { EstadoDaSessao } from '@/estado/sessao'

/**
 * Para onde voltar depois de entrar (A4). Quem abre um endereço do app sem
 * sessão (ex.: `/app/excluir-conta`, vindo das páginas legais) vai para
 * Entrar; depois de entrar, volta para o que pediu em vez de cair no Início.
 *
 * Só caminho interno do app é aceito, nunca URL externa: o destino vira
 * `router.replace`, e aceitar `//outro.site` ou `https://...` seria um
 * redirecionamento aberto. O destino fica só em memória (como o convite em
 * espera) e é usado uma vez.
 */

/** Rotas da entrada e o Início: voltar a elas depois de entrar não é destino. */
const ROTAS_SEM_DESTINO = new Set([
  '/',
  '/entrar',
  '/segundo-fator',
  '/recuperar-senha',
  '/criar-conta',
  '/completar-cadastro',
  '/colar-convite',
  '/convite',
  '/redefinir-senha',
  '/primeiro-acesso',
  '/biometria',
  '/_catalogo',
])

/** Teto de tamanho: endereço do app é curto; o que passa disso não é navegação legítima. */
const TAMANHO_MAXIMO = 512

/**
 * O caminho, se for um destino interno válido; `null` para qualquer outra
 * coisa. Precisa começar com uma barra só (`//host` e `/\host` o navegador
 * lê como outro site), sem esquema (`https:`, `javascript:`), sem barra
 * invertida, espaço ou caractere de controle.
 */
export function destinoInterno(caminho: string): string | null {
  if (!caminho || caminho.length > TAMANHO_MAXIMO) return null
  if (!caminho.startsWith('/') || caminho.startsWith('//')) return null
  if (/[\\\s]/.test(caminho)) return null
  // Caracteres de controle (U+0000 a U+001F e U+007F).
  for (const letra of caminho) {
    const codigo = letra.charCodeAt(0)
    if (codigo < 0x20 || codigo === 0x7f) return null
  }
  const [rota = ''] = caminho.split(/[?#]/)
  // Dois-pontos no caminho só serviria para montar um esquema; nenhuma rota do app tem.
  if (rota.includes(':')) return null
  if (ROTAS_SEM_DESTINO.has(rota)) return null
  return caminho
}

let destino: string | null = null

export function guardarDestino(caminho: string): void {
  const valido = destinoInterno(caminho)
  if (valido) destino = valido
}

/** Devolve o destino e o esquece (uso único). */
export function tomarDestino(): string | null {
  const atual = destino
  destino = null
  return atual
}

export function esquecerDestino(): void {
  destino = null
}

/** O caminho atual com a consulta (`/conteudos?tipo=musicos`), sem os parâmetros da própria rota. */
function useCaminhoAtual(): string {
  const caminho = usePathname()
  const segmentos = useSegments()
  const parametros = useGlobalSearchParams()
  const daRota = new Set(
    segmentos
      .filter((s) => s.startsWith('['))
      .map((s) => s.replace(/^\[(\.\.\.)?/, '').replace(/\]$/, '')),
  )
  const consulta = new URLSearchParams()
  for (const [chave, valor] of Object.entries(parametros)) {
    if (daRota.has(chave)) continue
    for (const v of Array.isArray(valor) ? valor : [valor]) {
      if (typeof v === 'string') consulta.append(chave, v)
    }
  }
  const texto = consulta.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

/**
 * Montado no layout raiz. Sem sessão, guarda o endereço protegido que a
 * pessoa abriu (o guarda do grupo autenticado a manda para Entrar). Depois
 * de entrar, quando o app chega ao Início, segue para esse endereço. Sair da
 * conta não deixa destino para a próxima pessoa que entrar no aparelho.
 */
export function useDestinoDepoisDeEntrar(estado: EstadoDaSessao): void {
  const caminho = useCaminhoAtual()
  const anterior = useRef<EstadoDaSessao>(estado)

  // A navegação é o sistema externo aqui: o efeito reage à sessão e ao endereço.
  useEffect(() => {
    const saiu = anterior.current === 'autenticado' && estado === 'anonimo'
    anterior.current = estado
    if (estado === 'anonimo') {
      if (saiu) esquecerDestino()
      else guardarDestino(caminho)
      return
    }
    if (estado === 'autenticado' && caminho === '/') {
      const proximo = tomarDestino()
      // Validado de novo na saída: o destino só vira navegação se for interno.
      if (proximo && destinoInterno(proximo)) router.replace(proximo as Href)
    }
  }, [estado, caminho])
}
