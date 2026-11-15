import { useGeometriaDaAurora, type PropsDaAurora } from './geometriaDaAurora'

/** Web: as mesmas auroras em CSS puro (o react-native-web não desenha `backgroundImage`). */
export function FundoAurora({ intensidade = 1 }: PropsDaAurora) {
  const g = useGeometriaDaAurora(intensidade)
  if (!g) return null
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <div
        style={{
          position: 'absolute',
          top: g.coral.top,
          right: g.coral.right,
          width: g.coral.lado,
          height: g.coral.lado,
          borderRadius: '50%',
          background: g.coral.fundo,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: g.violeta.top,
          left: g.violeta.left,
          width: g.violeta.lado,
          height: g.violeta.lado,
          borderRadius: '50%',
          background: g.violeta.fundo,
        }}
      />
    </div>
  )
}
