import { Image } from 'expo-image'

import { NOME_DO_APP } from '@/constantes'

import ICONE from '../../assets/images/icon.png'

/** Lado e raio do ícone do app nas telas de entrada (56, raio 16) e de bloqueio (72, raio 20). */
const MEDIDAS = { entrada: { lado: 56, raio: 16 }, bloqueio: { lado: 72, raio: 20 } } as const

/**
 * O ícone do app (marca), na entrada e no bloqueio do Face ID. `decorativo`:
 * o nome do app já está escrito ao lado, então o leitor de tela o pula.
 */
export function IconeDoApp({
  tamanho = 'entrada',
  decorativo = false,
}: {
  tamanho?: keyof typeof MEDIDAS
  decorativo?: boolean
}) {
  const { lado, raio } = MEDIDAS[tamanho]
  return (
    <Image
      source={ICONE}
      style={{ width: lado, height: lado, borderRadius: raio }}
      accessible={!decorativo}
      {...(decorativo ? { importantForAccessibility: 'no' as const } : {})}
      accessibilityLabel={`Ícone do ${NOME_DO_APP}`}
      accessibilityIgnoresInvertColors
      contentFit="cover"
    />
  )
}
