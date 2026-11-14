import { permite, type Acao, type Alvo, type Ator, type Recurso } from '@uj/dominio'

import { useSessao } from '@/estado/sessao'

/**
 * Mesma matriz da API (`@uj/dominio`), usada aqui só para esconder controles.
 * Quem decide é sempre a API; a interface apenas evita oferecer o impossível.
 */
export function usePode() {
  const { comunidadeAtiva } = useSessao()
  const ator: Ator = {
    papel: comunidadeAtiva?.papel ?? null,
    designacoes: comunidadeAtiva?.designacoes ?? [],
    // Ações de plataforma pedem prova de 2FA que só a API confere.
    proprietarioComDoisFatores: false,
  }
  return <R extends Recurso>(recurso: R, acao: Acao<R>, alvo?: Alvo) =>
    permite(ator, recurso, acao, alvo)
}
