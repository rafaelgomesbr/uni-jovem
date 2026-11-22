import { ALTURA, ESPACO, TIPO } from '@uj/tokens'
import { Children, createContext, useContext, useEffect, useId, type ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ContextoDoMotivoNaBarra, EmPar } from './Botao'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { sombra, useTema } from './tema'
import { registrarRodape } from './Toast'
import { Vidro } from './Vidro'

/**
 * Quanto a barra de abas flutuante ocupa embaixo da barra de ação (0 sem
 * ela, ou com o teclado aberto). A `Tela` fornece. Com a barra flutuante, o
 * fundo da barra de ação desce por trás dela até o fim da tela e os botões
 * ficam logo acima: esse espaço toma o lugar da área segura (a barra
 * flutuante já cuida dela), sem somar as duas.
 */
export const ContextoDaBarraFlutuanteEmbaixo = createContext(0)

/** O que fica embaixo dos botões: a barra flutuante, se houver; senão, a área segura. */
export function baseDaBarraDeAcao(margemDeBaixo: number, barraFlutuante: number): number {
  return barraFlutuante > 0 ? barraFlutuante : margemDeBaixo
}

/** Quanto a barra ocupa: padding de 12, botão grande de 56 e a área segura mais 12. */
export function alturaDaBarraDeAcao(margemDeBaixo: number): number {
  return ESPACO.e12 + ALTURA.botao.grande + margemDeBaixo + ESPACO.e12
}

/** Padding de fim do conteúdo de uma tela com barra de ação: 56 + 24 + área segura + 16. */
export function fimComBarraDeAcao(margemDeBaixo: number): number {
  return ALTURA.botao.grande + ESPACO.e24 + margemDeBaixo + ESPACO.e16
}

/**
 * Barra de ação (seção 2.12.18): rodapé fixo das telas de pilha com ação
 * principal. Vidro da barra com borda de cima, padding 12 por 20 e a área
 * segura (ou a barra de abas flutuante) mais 12 embaixo. Até 2 botões
 * grandes (56) lado a lado, intervalo de 12 (secundário à esquerda, primário à
 * direita) ou o primário com o botão de ícone "Mais".
 * Quem a posiciona (e a faz subir com o teclado) é a `Tela`.
 *
 * O motivo de um botão desabilitado fica numa linha própria, na largura toda,
 * embaixo dos botões (ao lado, na meia coluna, o texto ficava espremido). O
 * `aviso` (erro de envio, por exemplo) fica acima dos botões, sempre à vista.
 */
export function BarraDeAcao({ children, aviso }: { children: ReactNode; aviso?: ReactNode }) {
  const { elevacao, cores } = useTema()
  const margens = useSafeAreaInsets()
  const barraFlutuante = useContext(ContextoDaBarraFlutuanteEmbaixo)
  const base = baseDaBarraDeAcao(margens.bottom, barraFlutuante)
  const altura = alturaDaBarraDeAcao(base)
  // O toast precisa saber onde a barra termina: registra ao montar e libera ao sair.
  useEffect(() => registrarRodape(altura), [altura])
  const idDoMotivo = `motivo-da-barra-${useId()}`
  const itens = Children.toArray(children).filter(Boolean)
  const motivos = itens.map(motivoDoFilho).filter((m): m is string => m !== null)
  return (
    <Vidro borda="cima" style={sombra(elevacao.flutuante)}>
      <View
        style={{
          gap: ESPACO.e8,
          paddingTop: ESPACO.e12,
          paddingHorizontal: ESPACO.e20,
          paddingBottom: base + ESPACO.e12,
        }}
      >
        {aviso}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
          <ContextoDoMotivoNaBarra.Provider value={idDoMotivo}>
            <EmPar>
              {itens.map((filho, i) => (
                <View key={i} style={ehSoIcone(filho) ? null : { flex: 1 }}>
                  {filho}
                </View>
              ))}
            </EmPar>
          </ContextoDoMotivoNaBarra.Provider>
        </View>
        {motivos.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e6 }}>
            <View style={{ height: TIPO.legenda.altura, justifyContent: 'center' }}>
              <Icone nome="cadeado" cor={cores.textoSuave} tamanho={14} />
            </View>
            <Texto variante="legenda" cor="textoSuave" nativeID={idDoMotivo} style={{ flex: 1 }}>
              {motivos.join(' ')}
            </Texto>
          </View>
        ) : null}
      </View>
    </Vidro>
  )
}

/** O motivo escrito de um botão desabilitado (o mesmo critério do `Botao`). */
function motivoDoFilho(filho: ReactNode): string | null {
  if (typeof filho !== 'object' || filho === null || !('props' in filho)) return null
  const p = filho.props as { desabilitado?: unknown; carregando?: unknown; motivo?: unknown }
  return p.desabilitado === true &&
    p.carregando !== true &&
    typeof p.motivo === 'string' &&
    p.motivo
    ? p.motivo
    : null
}

/** O botão de ícone ("… Mais") não estica: fica na medida dele, ao lado do primário. */
function ehSoIcone(filho: ReactNode): boolean {
  return (
    typeof filho === 'object' &&
    filho !== null &&
    'props' in filho &&
    typeof (filho.props as { icone?: unknown; titulo?: unknown }).icone === 'string' &&
    (filho.props as { titulo?: unknown }).titulo === undefined
  )
}
