import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Texto } from './Texto'
import { useTema } from './tema'

/** Acima disso o selo mostra "99+" (quem usa o selo diz o número inteiro no rótulo). */
const TETO_DO_SELO = 99

/**
 * Selo de contagem sobre um ícone (o sino): o NÚMERO, não só cor, no par
 * primária e sobre primária dos botões cheios, que passa AA nos dois temas.
 * Fica oculto do leitor de tela: o rótulo do botão já diz a contagem.
 */
export function SeloDeContagem({ valor }: { valor: number }) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  if (valor <= 0) return null
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={{
        position: 'absolute',
        top: 4,
        right: 2,
        // Cresce com a fonte do sistema (D75): o número nunca é cortado nem fica sem a bolinha.
        minWidth: 22,
        minHeight: 22,
        paddingHorizontal: 4,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: cores.primaria,
        // Separa o selo do traço do ícone; com "Aumentar contraste", borda na cor do texto.
        borderWidth: aumentarContraste ? 2 : 1.5,
        borderColor: aumentarContraste ? cores.texto : cores.fundo,
      }}
    >
      <Texto
        variante="chip"
        peso="forte"
        tabular
        style={{ color: cores.sobrePrimaria, fontSize: 14, lineHeight: 18 }}
      >
        {valor > TETO_DO_SELO ? `${TETO_DO_SELO}+` : String(valor)}
      </Texto>
    </View>
  )
}

/**
 * Marca de item novo numa linha: forma (ponto de 10), não só cor. Oculta do
 * leitor de tela; a linha diz "Nova" no próprio rótulo.
 */
export function PontoDeNovo() {
  const { cores } = useTema()
  return (
    <View
      testID="ponto-de-nova"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cores.destaque }}
    />
  )
}
