import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { formatarDataLocal, lerDataDigitada, somarDias, type DataLocal } from '@/utilidades/datas'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Segmentos } from '@/ui/Segmentos'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

export type Atalho = '30' | '90' | '365' | 'outro'

export interface Periodo {
  de: DataLocal
  ate: DataLocal
}

/** Os últimos `dias` dias, contando hoje (no fuso da comunidade). */
export function periodoDosUltimos(dias: number, hoje: DataLocal): Periodo {
  return { de: somarDias(hoje, -(dias - 1)), ate: hoje }
}

/** Até dois anos, como a API aceita. */
const DIAS_MAXIMOS = 731

export function validarPeriodo(de: DataLocal | null, ate: DataLocal | null): string | null {
  if (!de || !ate) return 'Use datas no formato DD/MM/AAAA.'
  if (de > ate) return 'A data inicial precisa ser antes da final.'
  const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000
  if (dias > DIAS_MAXIMOS) return 'Escolha um período de até dois anos.'
  return null
}

/**
 * Período do relatório: atalhos (30, 90 e 365 dias) ou datas digitadas.
 * As datas digitadas só valem ao tocar em "Aplicar" (evita buscar a cada tecla).
 */
export function SeletorDePeriodo({
  hoje,
  periodo,
  aoMudar,
}: {
  hoje: DataLocal
  periodo: Periodo
  aoMudar: (p: Periodo) => void
}) {
  const [atalho, setAtalho] = useState<Atalho>('90')
  const [de, setDe] = useState(formatarDataLocal(periodo.de))
  const [ate, setAte] = useState(formatarDataLocal(periodo.ate))
  const [erro, setErro] = useState<string | null>(null)

  function escolher(a: Atalho) {
    setAtalho(a)
    setErro(null)
    if (a !== 'outro') aoMudar(periodoDosUltimos(Number(a), hoje))
  }

  function aplicar() {
    const d = lerDataDigitada(de)
    const a = lerDataDigitada(ate)
    const problema = validarPeriodo(d, a)
    setErro(problema)
    if (!problema && d && a) aoMudar({ de: d, ate: a })
  }

  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Segmentos
        rotulo="Período"
        valor={atalho}
        aoMudar={escolher}
        segmentos={[
          { valor: '30', rotulo: '30 dias' },
          { valor: '90', rotulo: '90 dias' },
          { valor: '365', rotulo: '1 ano' },
          { valor: 'outro', rotulo: 'Outras datas' },
        ]}
      />
      {atalho === 'outro' ? (
        <View style={{ gap: ESPACO.e8 }}>
          <Campo
            rotulo="De"
            exemplo="01/09/2026"
            formato="data"
            value={de}
            onChangeText={setDe}
            inputMode="numeric"
          />
          <Campo
            rotulo="Até"
            exemplo="30/11/2026"
            formato="data"
            value={ate}
            onChangeText={setAte}
            erro={erro}
            inputMode="numeric"
          />
          <Botao titulo="Aplicar datas" variante="secundario" aoPressionar={aplicar} />
        </View>
      ) : null}
      <TextoAnunciado soMudancas variante="legenda" cor="textoSuave">
        De {formatarDataLocal(periodo.de)} a {formatarDataLocal(periodo.ate)}
      </TextoAnunciado>
    </View>
  )
}
