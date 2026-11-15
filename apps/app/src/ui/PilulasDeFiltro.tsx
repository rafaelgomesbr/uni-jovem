import { ALTURA, ESPACO, RAIO, RITMO } from '@uj/tokens'
import { Pressable, ScrollView } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

export interface Pilula<T extends string> {
  valor: T
  rotulo: string
  /** Contador opcional ("Rascunhos 2"). */
  contagem?: number
}

interface PropsDasPilulas<T extends string> {
  /** Nome do grupo para o leitor de tela ("Filtrar programas"). */
  rotulo: string
  pilulas: readonly Pilula<T>[]
  selecionadas: readonly T[]
  aoMudar: (selecionadas: T[]) => void
  /** Várias ao mesmo tempo (papel `checkbox`); por padrão, uma só (papel `radio`). */
  multipla?: boolean
  /**
   * A linha encosta nas bordas da tela e rola por baixo da margem: o primeiro
   * item fica em x=20 e sobra 20 no fim. Desligue dentro de cartão.
   */
  sangrar?: boolean
}

/**
 * Pílulas de filtro (seção 2.12.5): 36 de altura visual com folga de toque
 * de 4 em cima e embaixo (44 efetivo), rolagem horizontal, intervalo de 8. A
 * ativa tem fundo quente, borda e check de 14: forma além da cor.
 */
export function PilulasDeFiltro<T extends string>({
  rotulo,
  pilulas,
  selecionadas,
  aoMudar,
  multipla = false,
  sangrar = true,
}: PropsDasPilulas<T>) {
  const { cores, solido } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const margem = sangrar ? RITMO.margemDaTela : 0

  function alternar(valor: T) {
    if (!multipla) return aoMudar([valor])
    aoMudar(
      selecionadas.includes(valor)
        ? selecionadas.filter((v) => v !== valor)
        : [...selecionadas, valor],
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole={multipla ? undefined : 'radiogroup'}
      aria-label={rotulo}
      style={{ marginHorizontal: -margem, flexGrow: 0 }}
      contentContainerStyle={{
        paddingHorizontal: margem,
        paddingVertical: ESPACO.e4,
        gap: ESPACO.e8,
      }}
    >
      {pilulas.map((p) => {
        const ativa = selecionadas.includes(p.valor)
        const texto = p.contagem !== undefined ? `${p.rotulo} ${p.contagem}` : p.rotulo
        return (
          <Pressable
            key={p.valor}
            accessibilityRole={multipla ? 'checkbox' : 'radio'}
            accessibilityLabel={texto}
            aria-checked={ativa}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => alternar(p.valor)}
            style={({ pressed }) => ({
              minHeight: ALTURA.filtro,
              flexDirection: 'row',
              alignItems: 'center',
              gap: ESPACO.e6,
              paddingHorizontal: ESPACO.e14,
              borderRadius: RAIO.pilula,
              borderWidth: aumentarContraste ? 2 : 1,
              borderColor: ativa
                ? cores.destaque
                : aumentarContraste
                  ? cores.texto
                  : cores.tonalBorda,
              backgroundColor: ativa
                ? solido(cores.quenteFundo)
                : pressed
                  ? solido(cores.pressionado)
                  : 'transparent',
            })}
          >
            {ativa ? <Icone nome="check" cor={cores.destaque} tamanho={14} peso="forte" /> : null}
            <Texto
              variante="lista"
              peso={ativa ? 'forte' : 'medio'}
              cor={ativa ? 'destaque' : 'textoSuave'}
              tabular={p.contagem !== undefined}
              numberOfLines={1}
            >
              {texto}
            </Texto>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
