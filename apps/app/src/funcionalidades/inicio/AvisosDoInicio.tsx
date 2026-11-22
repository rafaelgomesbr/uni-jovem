import { router } from 'expo-router'

import type { AvisoDoInicio } from '@/servicos/contratoDosModulos'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { formatarData } from '@/utilidades/formatos'

/**
 * O aviso do Início em UMA linha de 56 pt (3.1 do UX, D68): "Aviso fixado: Ensaio às 15h" com o
 * alfinete e a seta. A API manda os fixados primeiro; sem fixado, a linha diz "Aviso: ..." com o
 * mais recente. Toque abre o aviso. O texto do aviso não entra aqui (está a um toque), e a lista
 * de todos os avisos mora na Comunidade.
 */
export function AvisosDoInicio({
  avisos,
}: {
  avisos: readonly AvisoDoInicio[]
  /** Mantido por compatibilidade; o Início não oferece criar aviso. */
  podePublicar?: boolean
}) {
  const [aviso] = avisos
  if (!aviso) return null
  const detalhe = [
    aviso.fixado ? 'Fixado' : null,
    aviso.publicadoEm ? `publicado em ${formatarData(aviso.publicadoEm)}` : null,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <CartaoDeVidro lista>
      <Lista>
        <LinhaDeLista
          icone="fixar"
          titulo={`${aviso.fixado ? 'Aviso fixado' : 'Aviso'}: ${aviso.titulo}`}
          rotuloAcessivel={`${aviso.titulo}. ${detalhe}`}
          dica="Abre o aviso."
          aoPressionar={() =>
            router.push({ pathname: '/avisos/[avisoId]', params: { avisoId: aviso.id } })
          }
        />
      </Lista>
    </CartaoDeVidro>
  )
}
