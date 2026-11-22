/**
 * Para onde a rolagem da cifra vai com um toque no botão de subir ou descer. Anda uma página
 * menos uma sobra (80% da janela): a última linha lida continua na tela, e o músico não perde o
 * lugar. Nunca passa do começo nem do fim.
 */
export function proximoPontoDeRolagem({
  atual,
  janela,
  conteudo,
  sentido,
}: {
  atual: number
  janela: number
  conteudo: number
  sentido: 'cima' | 'baixo'
}): number {
  const passo = Math.max(1, Math.round(janela * 0.8))
  const maximo = Math.max(0, conteudo - janela)
  const alvo = sentido === 'baixo' ? atual + passo : atual - passo
  return Math.min(maximo, Math.max(0, alvo))
}
