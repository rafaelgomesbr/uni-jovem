import { LIMITES_DA_COMUNIDADE_NOVA } from '@uj/dominio'
import { ESPACO, TIPO } from '@uj/tokens'
import { View } from 'react-native'

import type { DetalheDaComunidade } from '@/servicos/contrato'
import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

/** Limite da comunidade nova quando a API não diz (ADR 0007: 30 vínculos ativos). */
export const LIMITE_DA_COMUNIDADE_NOVA = LIMITES_DA_COMUNIDADE_NOVA.vinculosAtivos

/** "Hoje: 12 de 30." ou `null` quando a comunidade não tem limite (verificada). */
export function textoDoUso(detalhe: DetalheDaComunidade): string | null {
  if (detalhe.verificacao !== 'nova') return null
  const limite = detalhe.limites?.membrosAtivos ?? LIMITE_DA_COMUNIDADE_NOVA
  const uso = detalhe.uso?.membrosAtivos
  return uso === undefined ? null : `Hoje: ${uso} de ${limite}.`
}

/**
 * Aviso discreto da comunidade nova (ADR 0007): uma linha com ícone, sem
 * cartão, dizendo o limite e o uso atual. Some quando a comunidade é verificada.
 */
export function AvisoDeComunidadeNova({ detalhe }: { detalhe: DetalheDaComunidade | undefined }) {
  const { cores } = useTema()
  if (!detalhe || detalhe.verificacao !== 'nova') return null
  const limite = detalhe.limites?.membrosAtivos ?? LIMITE_DA_COMUNIDADE_NOVA
  const uso = textoDoUso(detalhe)
  const texto = `Comunidade nova: até ${limite} pessoas até ser verificada.${uso ? ` ${uso}` : ''}`
  return (
    <View
      accessible
      accessibilityLabel={texto}
      style={{ flexDirection: 'row', gap: ESPACO.e8, alignItems: 'flex-start' }}
    >
      <View style={{ height: TIPO.meta.altura, justifyContent: 'center' }}>
        <Icone nome="info" cor={cores.textoSuave} tamanho={16} />
      </View>
      <Texto variante="meta" cor="textoSuave" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  )
}
