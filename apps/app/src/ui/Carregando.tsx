import { CartaoDeEsqueleto, Esqueleto } from './Esqueleto'

/**
 * Fachada do carregamento antigo (indicador giratório com texto): agora é um
 * esqueleto com a forma de um cartão (seção 2.12.22). O texto vira o rótulo
 * que o leitor de tela ouve.
 */
export function Carregando({ texto = 'Carregando' }: { texto?: string }) {
  return (
    <Esqueleto rotulo={texto}>
      <CartaoDeEsqueleto titulo />
    </Esqueleto>
  )
}
