import { ESPACO, HALO_DE_FOCO, RAIO, TIPO } from '@uj/tokens'
import { useId, useState } from 'react'
import { View } from 'react-native'

import { BlocoDoCampo } from './Campo'
import { comOpacidade } from './cor'
import { FAMILIA } from './fontes'
import { Icone } from './Icone'
import {
  deDate,
  formatarMomento,
  paraDate,
  type PropsDoCampoDeMomento,
  type TipoDeMomento,
} from './momento'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useAnunciar } from './useAnunciar'

export { deDate, formatarMomento, paraDate }
export type { PropsDoCampoDeMomento, TipoDeMomento }

/**
 * Web: o `<input type="date|time">` do navegador, com a caixa do Campo (D64):
 * ícone de calendário ou relógio à esquerda e, vazio, "Escolher" em
 * `campoExemplo` no lugar do "dd/mm/aaaa" do navegador (a camada some quando o
 * campo recebe o foco, para o teclado ver os segmentos).
 */
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
  const vazio = !valor
  const corDoAnel = erro ? cores.erro : cores.foco
  // Anel de 2 pt: a borda de 1 mais 1 por dentro; o halo de 4 só com foco.
  const anel = erro || focado ? `inset 0 0 0 1px ${corDoAnel}` : ''
  const halo = focado ? `0 0 0 ${HALO_DE_FOCO}px ${erro ? cores.erroFundo : cores.focoHalo}` : ''
  const sombra = [anel, halo].filter(Boolean).join(', ') || 'none'
  const corDoValor = desabilitado ? comOpacidade(cores.textoSuave, 0.6) : cores.texto
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
      <View style={{ position: 'relative' }}>
        <input
          type={tipo === 'data' ? 'date' : 'time'}
          data-campo=""
          data-campo-momento=""
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
            height: 56,
            padding: `0 ${ESPACO.e16}px 0 48px`,
            borderRadius: RAIO.campo,
            border: `1px solid ${
              desabilitado
                ? 'transparent'
                : erro
                  ? cores.erro
                  : focado
                    ? cores.foco
                    : cores.campoBorda
            }`,
            boxShadow: sombra,
            transition: 'box-shadow 160ms ease-out, border-color 160ms ease-out',
            outline: 'none',
            background: desabilitado ? cores.campoDesabilitado : cores.campoFundo,
            color: corDoValor,
            caretColor: cores.primaria,
            colorScheme: escuro ? 'dark' : 'light',
            fontFamily: FAMILIA.texto,
            fontSize: TIPO.campo.tamanho,
            lineHeight: `${TIPO.campo.altura}px`,
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ESPACO.e16,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}
        >
          <Icone
            nome={tipo === 'data' ? 'calendario' : 'relogio'}
            cor={desabilitado ? corDoValor : cores.textoSuave}
            tamanho={20}
          />
        </View>
        {vazio && !focado ? (
          // Cobre o "dd/mm/aaaa" do navegador, sem tapar o seletor à direita.
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 44,
              right: ESPACO.e12,
              top: 2,
              bottom: 2,
              justifyContent: 'center',
              paddingLeft: ESPACO.e4,
              backgroundColor: desabilitado ? 'transparent' : cores.campoFundo,
            }}
          >
            <Texto
              variante="corpo"
              numberOfLines={1}
              style={{
                color: desabilitado ? corDoValor : cores.campoExemplo,
                fontSize: TIPO.campo.tamanho,
                lineHeight: TIPO.campo.altura,
              }}
            >
              Escolher
            </Texto>
          </View>
        ) : null}
      </View>
    </BlocoDoCampo>
  )
}

export function CampoDeData(props: PropsDoCampoDeMomento) {
  return <CampoDeMomento tipo="data" {...props} />
}

export function CampoDeHora(props: PropsDoCampoDeMomento) {
  return <CampoDeMomento tipo="hora" {...props} />
}
