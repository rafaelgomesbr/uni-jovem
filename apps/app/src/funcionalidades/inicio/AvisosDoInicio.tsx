import { router } from 'expo-router'

import type { AvisoDoInicio } from '@/servicos/contratoDosModulos'
import { formatarData } from '@/utilidades/formatos'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { Texto } from '@/ui/Texto'

/**
 * Aviso no Início (3.2.1): só quando há aviso, um cartão com o primeiro (a
 * API manda os fixados primeiro): título em `tituloItem`, 2 linhas de texto e
 * o terciário "Ver todos". O fixado tem o chip "Fixado" com alfinete.
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
    <CartaoDeVidro
      sobrancelha="Aviso"
      comecaComTitulo
      {...(aviso.fixado ? { extra: <Chip texto="Fixado" tom="quente" icone="fixar" /> } : {})}
      aoPressionar={() =>
        router.push({ pathname: '/avisos/[avisoId]', params: { avisoId: aviso.id } })
      }
      rotuloAcessivel={`${aviso.titulo}. ${detalhe}`}
      acoes={
        <Botao
          titulo={avisos.length > 1 ? `Ver todos (${avisos.length})` : 'Ver todos'}
          variante="terciario"
          alinhado
          rotuloAcessivel="Ver todos os avisos"
          aoPressionar={() => router.push('/avisos')}
        />
      }
    >
      <Texto variante="tituloItem">{aviso.titulo}</Texto>
      <Texto variante="corpo" numberOfLines={2}>
        {aviso.texto}
      </Texto>
    </CartaoDeVidro>
  )
}
