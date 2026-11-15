import { AURORA } from '@uj/tokens'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { gradienteDaAurora } from './FundoAurora'
import { useTema } from './tema'

/** Web: as mesmas auroras em CSS puro (o react-native-web não desenha `backgroundImage`). */
export function FundoAurora() {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  if (aumentarContraste) return null
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <div
        style={{
          position: 'absolute',
          top: AURORA.coral.topo,
          right: AURORA.coral.direita,
          width: AURORA.coral.lado,
          height: AURORA.coral.lado,
          borderRadius: '50%',
          background: gradienteDaAurora(cores.auroraCoral),
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: AURORA.violeta.topo,
          left: AURORA.violeta.esquerda,
          width: AURORA.violeta.lado,
          height: AURORA.violeta.lado,
          borderRadius: '50%',
          background: gradienteDaAurora(cores.auroraVioleta),
        }}
      />
    </div>
  )
}
