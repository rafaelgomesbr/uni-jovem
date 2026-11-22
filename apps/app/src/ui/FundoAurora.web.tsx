import { AURORA, CURVAS_DE_ACESSO, LUZ_POR_MOMENTO, MOVIMENTO_DAS_TELAS } from '@uj/tokens'
import type { CSSProperties } from 'react'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useGeometriaDaAurora } from './geometriaDaAurora'
import type { PropsDoFundoAurora } from './propsDoFundoAurora'

export type { PropsDaAurora } from './geometriaDaAurora'
export type { PropsDoFundoAurora } from './propsDoFundoAurora'

const { coral, violeta, abertura } = AURORA.deriva
const [x1, y1, x2, y2] = CURVAS_DE_ACESSO.saida

/**
 * A deriva e a abertura na web são `@keyframes` de CSS (só `transform` e
 * `opacity`): rodam no compositor, sem JavaScript. O período é o meio ciclo
 * duas vezes (`alternate`), seis vezes no total, e termina no repouso. O
 * `prefers-reduced-motion` do sistema é a mesma preferência que o app lê, mas o
 * CSS também a respeita sozinho.
 */
const CSS_DA_AURORA = `
@keyframes uj-aurora-abertura {
  from { opacity: ${abertura.opacidadeInicial}; transform: scale(${abertura.escalaInicial}); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes uj-aurora-deriva-coral {
  from { opacity: 1; transform: translate(0px, 0px) scale(1); }
  to { opacity: ${coral.opacidade}; transform: translate(${coral.x}px, ${coral.y}px) scale(${coral.escala}); }
}
@keyframes uj-aurora-deriva-violeta {
  from { opacity: 1; transform: translate(0px, 0px) scale(1); }
  to { opacity: ${violeta.opacidade}; transform: translate(${violeta.x}px, ${violeta.y}px) scale(${violeta.escala}); }
}
@media (prefers-reduced-motion: reduce) {
  .uj-aurora-anima { animation: none !important; }
}
`

/** Web: as mesmas auroras em CSS puro (o react-native-web não desenha `backgroundImage`). */
export function FundoAurora({
  intensidade = 1,
  movimento = 'estatico',
  amanhecer = false,
  pausada = false,
  momento,
}: PropsDoFundoAurora) {
  const g = useGeometriaDaAurora(intensidade)
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  if (!g) return null
  const ambiente = movimento === 'ambiente' && !reduzirMovimento
  const abrir = amanhecer && !reduzirMovimento
  const estado: CSSProperties = { animationPlayState: pausada ? 'paused' : 'running' }
  // O relógio do encontro: o coral esquenta e se reposiciona com uma transição de 900 ms (120 de
  // dissolve com Reduzir movimento, sem deslocamento nem escala).
  const luz = momento ? LUZ_POR_MOMENTO[momento].coral : null
  const [n1, n2, n3, n4] = CURVAS_DE_ACESSO.nasce
  const transicaoDaLuz: CSSProperties = luz
    ? {
        // O relógio do encontro move a luz: animação, não estado.
        // eslint-disable-next-line no-restricted-syntax
        opacity: luz.opacidade,
        transform: reduzirMovimento
          ? 'none'
          : `translate(${luz.x}px, ${luz.y}px) scale(${luz.escala})`,
        transition: reduzirMovimento
          ? `opacity ${MOVIMENTO_DAS_TELAS.dissolver}ms linear`
          : `opacity ${MOVIMENTO_DAS_TELAS.luz}ms cubic-bezier(${n1},${n2},${n3},${n4}), transform ${MOVIMENTO_DAS_TELAS.luz}ms cubic-bezier(${n1},${n2},${n3},${n4})`,
      }
    : {}
  const deriva = (
    nome: 'coral' | 'violeta',
    cfg: { meioCiclo: number; meiasVoltas: number },
  ): CSSProperties =>
    ambiente
      ? {
          animation: `uj-aurora-deriva-${nome} ${cfg.meioCiclo}ms ease-in-out ${cfg.meiasVoltas} alternate`,
          ...estado,
        }
      : {}
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {ambiente || abrir ? <style>{CSS_DA_AURORA}</style> : null}
      <div
        className="uj-aurora-anima"
        style={{
          position: 'absolute',
          top: g.coral.top,
          right: g.coral.right,
          width: g.coral.lado,
          height: g.coral.lado,
          ...(abrir
            ? {
                animation: `uj-aurora-abertura ${abertura.duracao}ms cubic-bezier(${x1},${y1},${x2},${y2}) both`,
              }
            : {}),
        }}
      >
        <div style={{ width: '100%', height: '100%', ...transicaoDaLuz }}>
          <div
            className="uj-aurora-anima"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: g.coral.fundo,
              ...deriva('coral', coral),
            }}
          />
        </div>
      </div>
      <div
        className="uj-aurora-anima"
        style={{
          position: 'absolute',
          top: g.violeta.top,
          left: g.violeta.left,
          width: g.violeta.lado,
          height: g.violeta.lado,
        }}
      >
        <div
          className="uj-aurora-anima"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: g.violeta.fundo,
            ...deriva('violeta', violeta),
          }}
        />
      </div>
    </div>
  )
}
