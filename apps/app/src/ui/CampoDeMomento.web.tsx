import { ESPACO, RAIO } from '@uj/tokens'
import { useId, useState } from 'react'

import { BlocoDoCampo } from './Campo'
import {
  deDate,
  formatarMomento,
  paraDate,
  type PropsDoCampoDeMomento,
  type TipoDeMomento,
} from './momento'
import { FAMILIA } from './fontes'
import { useTema } from './tema'
import { useAnunciar } from './useAnunciar'

export { deDate, formatarMomento, paraDate }
export type { PropsDoCampoDeMomento, TipoDeMomento }

/** Web: o `<input type="date|time">` do navegador, com a caixa do Campo. */
export function CampoDeMomento({
  tipo,
  rotulo,
  valor,
  aoMudar,
  erro,
  ajuda,
  opcional,
  desabilitado = false,
  minimo,
  maximo,
  reservarApoio,
}: PropsDoCampoDeMomento & { tipo: TipoDeMomento }) {
  const { cores, escuro } = useTema()
  const id = useId()
  const [focado, setFocado] = useState(false)
  useAnunciar(erro ? `${rotulo}: ${erro}` : null, { naWeb: true })
  const corDaBorda = erro ? cores.erro : focado ? cores.foco : cores.campoBorda
  return (
    <BlocoDoCampo
      rotulo={rotulo}
      opcional={opcional}
      idDoRotulo={`rotulo-${id}`}
      ajuda={ajuda}
      erro={erro}
      idDaAjuda={`ajuda-${id}`}
      idDoErro={`erro-${id}`}
      reservarApoio={reservarApoio}
    >
      <input
        type={tipo === 'data' ? 'date' : 'time'}
        aria-labelledby={`rotulo-${id}`}
        aria-describedby={erro ? `erro-${id}` : ajuda ? `ajuda-${id}` : undefined}
        aria-invalid={erro ? true : undefined}
        title={formatarMomento(tipo, valor) ?? undefined}
        value={valor ?? ''}
        min={tipo === 'data' ? minimo : undefined}
        max={tipo === 'data' ? maximo : undefined}
        disabled={desabilitado}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        onChange={(e) => {
          const v = e.currentTarget.value
          if (v) aoMudar(tipo === 'data' ? v : deDate('hora', paraDate('hora', v)))
        }}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          height: 48,
          padding: `0 ${ESPACO.e16}px`,
          borderRadius: RAIO.controle,
          border: `1px ${desabilitado ? 'dashed' : 'solid'} ${desabilitado ? cores.tonalBorda : corDaBorda}`,
          boxShadow: erro || focado ? `inset 0 0 0 1px ${corDaBorda}` : 'none',
          outline: 'none',
          background: desabilitado ? 'transparent' : cores.campoFundo,
          color: desabilitado ? cores.textoSuave : cores.texto,
          colorScheme: escuro ? 'dark' : 'light',
          fontFamily: FAMILIA.texto,
          fontSize: 16,
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    </BlocoDoCampo>
  )
}

export function CampoDeData(props: PropsDoCampoDeMomento) {
  return <CampoDeMomento tipo="data" {...props} />
}

export function CampoDeHora(props: PropsDoCampoDeMomento) {
  return <CampoDeMomento tipo="hora" {...props} />
}
