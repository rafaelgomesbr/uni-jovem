import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { formatarDataLocal, somarDias, type DataLocal } from '@/utilidades/datas'
import { CampoDeData } from '@/ui/CampoDeMomento'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
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
  if (!de || !ate) return 'Escolha a data inicial e a final.'
  if (de > ate) return 'A data inicial precisa ser antes da final.'
  const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000
  if (dias > DIAS_MAXIMOS) return 'Escolha um período de até dois anos.'
  return null
}

const ATALHOS: { valor: Atalho; rotulo: string }[] = [
  { valor: '30', rotulo: '30 dias' },
  { valor: '90', rotulo: '90 dias' },
  { valor: '365', rotulo: '12 meses' },
  { valor: 'outro', rotulo: 'Personalizado' },
]

/**
 * Período do relatório (3.7.5): pílulas "30 dias", "90 dias", "12 meses" e
 * "Personalizado"; este mostra Data inicial e Data final lado a lado, com o
 * seletor nativo (nada é digitado). O período só muda quando as duas datas
 * formam um intervalo válido. `sangrar`: a linha de pílulas encosta nas
 * bordas da tela (desligue dentro de cartão).
 */
export function SeletorDePeriodo({
  hoje,
  periodo,
  aoMudar,
  sangrar = true,
}: {
  hoje: DataLocal
  periodo: Periodo
  aoMudar: (p: Periodo) => void
  sangrar?: boolean
}) {
  const { fontScale } = useWindowDimensions()
  const [atalho, setAtalho] = useState<Atalho>('90')
  const [de, setDe] = useState<DataLocal>(periodo.de)
  const [ate, setAte] = useState<DataLocal>(periodo.ate)
  const [erro, setErro] = useState<string | null>(null)

  function escolher(a: Atalho) {
    setAtalho(a)
    setErro(null)
    if (a !== 'outro') aoMudar(periodoDosUltimos(Number(a), hoje))
  }

  function mudarDatas(novoDe: DataLocal, novoAte: DataLocal) {
    setDe(novoDe)
    setAte(novoAte)
    const problema = validarPeriodo(novoDe, novoAte)
    setErro(problema)
    if (!problema) aoMudar({ de: novoDe, ate: novoAte })
  }

  return (
    <View style={{ gap: ESPACO.e12 }}>
      <PilulasDeFiltro
        rotulo="Período"
        pilulas={ATALHOS}
        selecionadas={[atalho]}
        aoMudar={(v) => {
          if (v[0]) escolher(v[0])
        }}
        sangrar={sangrar}
      />
      {atalho === 'outro' ? (
        // Lado a lado, intervalo de 12; com fonte grande, um embaixo do outro.
        <View style={{ flexDirection: fontScale >= 1.35 ? 'column' : 'row', gap: ESPACO.e12 }}>
          <View style={{ flex: 1 }}>
            <CampoDeData
              rotulo="Data inicial"
              valor={de}
              maximo={hoje}
              aoMudar={(d) => mudarDatas(d, ate)}
              reservarApoio
            />
          </View>
          <View style={{ flex: 1 }}>
            <CampoDeData
              rotulo="Data final"
              valor={ate}
              maximo={hoje}
              aoMudar={(d) => mudarDatas(de, d)}
              erro={erro}
              reservarApoio
            />
          </View>
        </View>
      ) : null}
      <TextoAnunciado soMudancas variante="meta" cor="textoSuave">
        De {formatarDataLocal(periodo.de)} a {formatarDataLocal(periodo.ate)}
      </TextoAnunciado>
    </View>
  )
}
