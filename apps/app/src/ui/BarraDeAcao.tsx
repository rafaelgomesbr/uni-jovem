import { ALTURA, ESPACO } from '@uj/tokens'
import { Children, useEffect, useId, type ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ContextoDoMotivoNaBarra, EmPar } from './Botao'
import { Texto } from './Texto'
import { sombra, useTema } from './tema'
import { registrarRodape } from './Toast'
import { Vidro } from './Vidro'

/** Quanto a barra ocupa: padding de 12, botão de 48 e a área segura mais 12. */
export function alturaDaBarraDeAcao(margemDeBaixo: number): number {
  return ESPACO.e12 + ALTURA.controle + margemDeBaixo + ESPACO.e12
}

/** Padding de fim do conteúdo de uma tela com barra de ação: 48 + 24 + área segura + 16. */
export function fimComBarraDeAcao(margemDeBaixo: number): number {
  return ALTURA.controle + ESPACO.e24 + margemDeBaixo + ESPACO.e16
}

/**
 * Barra de ação (seção 2.12.18): rodapé fixo das telas de pilha com ação
 * principal. Vidro da barra com borda de cima, padding 12 por 20 e a área
 * segura mais 12 embaixo. Até 2 botões grandes lado a lado (secundário à
 * esquerda, primário à direita) ou o primário com o botão de ícone "Mais".
 * Quem a posiciona (e a faz subir com o teclado) é a `Tela`.
 *
 * O motivo de um botão desabilitado fica numa linha própria, na largura toda,
 * embaixo dos botões (ao lado, na meia coluna, o texto ficava espremido). O
 * `aviso` (erro de envio, por exemplo) fica acima dos botões, sempre à vista.
 */
export function BarraDeAcao({ children, aviso }: { children: ReactNode; aviso?: ReactNode }) {
  const { elevacao } = useTema()
  const margens = useSafeAreaInsets()
  const altura = alturaDaBarraDeAcao(margens.bottom)
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
          paddingBottom: margens.bottom + ESPACO.e12,
        }}
      >
        {aviso}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e10 }}>
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
          <Texto variante="legenda" cor="textoSuave" nativeID={idDoMotivo}>
            {motivos.join(' ')}
          </Texto>
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
