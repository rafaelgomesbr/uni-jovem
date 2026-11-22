import { CAPOTRASTE_MAXIMO } from '@uj/dominio'
import { useEffect, useState } from 'react'

import { gravarPreferenciaLocal, lerPreferenciaLocal } from '@/estado/preferenciaLocal'

/** Tamanhos da letra na leitura, em pontos. O padrão é grande: a cifra se lê de longe. */
export const TAMANHOS_DA_LETRA = [14, 16, 18, 20, 24, 28, 32] as const
export const TAMANHO_PADRAO_DA_LETRA = 20

/**
 * Tamanhos da letra no Modo palco: maiores, para ler de um passo atrás da estante. O padrão (28)
 * é o que cabe com acorde e letra na mesma linha numa tela de 375 pt; quem quer mais aumenta.
 */
export const TAMANHOS_DO_PALCO = [24, 28, 32, 36, 42, 48, 56] as const
export const TAMANHO_PADRAO_DO_PALCO = 28

export const CHAVE_DO_TAMANHO_NA_LEITURA = 'uj.cifra.tamanho'
export const CHAVE_DO_TAMANHO_NO_PALCO = 'uj.palco.tamanho'

interface OpcoesDosAjustes {
  /** Tamanho da letra na leitura quando a pessoa ainda não escolheu um. */
  tamanhoInicial?: number
  /** Chaves em que o tamanho fica lembrado neste aparelho (leitura e palco são separados). */
  lembrar?: boolean
}

function indiceDe(tamanhos: readonly number[], tamanho: number, padrao: number): number {
  const i = tamanhos.indexOf(tamanho)
  return i >= 0 ? i : Math.max(0, tamanhos.indexOf(padrao))
}

/**
 * Os ajustes que o músico faz na cifra, só neste aparelho e nesta leitura: meio tom para cima ou
 * para baixo, o capotraste e o tamanho da letra. Nunca mudam o tom do dia nem a música. O tamanho
 * da letra fica lembrado (leitura e palco guardam o seu), o resto volta ao tom do dia.
 */
export function useAjustesDaCifra({ tamanhoInicial, lembrar = true }: OpcoesDosAjustes = {}) {
  const [ajuste, setAjuste] = useState(0)
  const [capotraste, setCapotraste] = useState(0)
  const [tamanhoNaLeitura, setTamanhoNaLeitura] = useState(
    tamanhoInicial ?? TAMANHO_PADRAO_DA_LETRA,
  )
  const [tamanhoNoPalco, setTamanhoNoPalco] = useState(TAMANHO_PADRAO_DO_PALCO)

  // O tamanho escolhido da última vez volta sozinho (sem pergunta e sem travar a tela).
  useEffect(() => {
    if (!lembrar) return
    let vivo = true
    void lerPreferenciaLocal<number>(CHAVE_DO_TAMANHO_NA_LEITURA).then((v) => {
      if (vivo && v !== null && tamanhoInicial === undefined) setTamanhoNaLeitura(v)
    })
    void lerPreferenciaLocal<number>(CHAVE_DO_TAMANHO_NO_PALCO).then((v) => {
      if (vivo && v !== null) setTamanhoNoPalco(v)
    })
    return () => {
      vivo = false
    }
  }, [lembrar, tamanhoInicial])

  const iNaLeitura = indiceDe(TAMANHOS_DA_LETRA, tamanhoNaLeitura, TAMANHO_PADRAO_DA_LETRA)
  const iNoPalco = indiceDe(TAMANHOS_DO_PALCO, tamanhoNoPalco, TAMANHO_PADRAO_DO_PALCO)

  function mudarNaLeitura(passo: -1 | 1) {
    const novo =
      TAMANHOS_DA_LETRA[Math.min(TAMANHOS_DA_LETRA.length - 1, Math.max(0, iNaLeitura + passo))]
    if (novo === undefined) return
    setTamanhoNaLeitura(novo)
    if (lembrar) void gravarPreferenciaLocal(CHAVE_DO_TAMANHO_NA_LEITURA, novo)
  }

  function mudarNoPalco(passo: -1 | 1) {
    const novo =
      TAMANHOS_DO_PALCO[Math.min(TAMANHOS_DO_PALCO.length - 1, Math.max(0, iNoPalco + passo))]
    if (novo === undefined) return
    setTamanhoNoPalco(novo)
    if (lembrar) void gravarPreferenciaLocal(CHAVE_DO_TAMANHO_NO_PALCO, novo)
  }

  return {
    ajuste,
    capotraste,
    descerMeioTom: () => setAjuste((a) => a - 1),
    subirMeioTom: () => setAjuste((a) => a + 1),
    voltarAoTomDoDia: () => setAjuste(0),
    capoAbaixo: () => setCapotraste((c) => Math.max(0, c - 1)),
    capoAcima: () => setCapotraste((c) => Math.min(CAPOTRASTE_MAXIMO, c + 1)),
    leitura: {
      tamanho: TAMANHOS_DA_LETRA[iNaLeitura] ?? TAMANHO_PADRAO_DA_LETRA,
      menor: () => mudarNaLeitura(-1),
      maior: () => mudarNaLeitura(1),
      noMinimo: iNaLeitura === 0,
      noMaximo: iNaLeitura >= TAMANHOS_DA_LETRA.length - 1,
    },
    palco: {
      tamanho: TAMANHOS_DO_PALCO[iNoPalco] ?? TAMANHO_PADRAO_DO_PALCO,
      menor: () => mudarNoPalco(-1),
      maior: () => mudarNoPalco(1),
      noMinimo: iNoPalco === 0,
      noMaximo: iNoPalco >= TAMANHOS_DO_PALCO.length - 1,
    },
  }
}

export type AjustesDaCifra = ReturnType<typeof useAjustesDaCifra>
