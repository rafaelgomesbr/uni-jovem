import { ESPACO } from '@uj/tokens'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { gravarPreferenciaLocal, lerPreferenciaLocal } from '@/estado/preferenciaLocal'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Texto } from '@/ui/Texto'

import { abrirDocumento } from './TelaPrivacidade'

/** Versão dos Termos de Uso e da Política de Privacidade do app aberto (ADR 0007, TC-02.v2). */
export const VERSAO_DOS_TERMOS = '0.3'

const chave = (contaId: string) => `uj.aviso-dos-termos.${VERSAO_DOS_TERMOS}.${contaId}`

/**
 * Aviso único de mudança dos Termos e da Política (Termos, seção 16) para
 * quem já tinha conta: aparece no Início até a pessoa tocar em "Entendi"
 * (guardado neste aparelho, por conta). Conta que já aceitou a versão nova
 * (`versaoDosTermosAceita`, quando a API mandar) não vê.
 */
export function AvisoDosTermos() {
  const { conta } = useSessao()
  const contaId = conta?.id ?? null
  const jaAceitou = conta?.versaoDosTermosAceita === VERSAO_DOS_TERMOS
  // `null`: ainda lendo do aparelho (nada aparece, para não piscar).
  const [visto, setVisto] = useState<{ contaId: string; visto: boolean } | null>(null)

  useEffect(() => {
    if (!contaId || jaAceitou) return
    let vivo = true
    void lerPreferenciaLocal<boolean>(chave(contaId)).then((v) => {
      if (vivo) setVisto({ contaId, visto: v === true })
    })
    return () => {
      vivo = false
    }
  }, [contaId, jaAceitou])

  if (!contaId || jaAceitou || !visto || visto.contaId !== contaId || visto.visto) return null

  function entendi() {
    if (!contaId) return
    setVisto({ contaId, visto: true })
    void gravarPreferenciaLocal(chave(contaId), true)
  }

  return (
    <Aviso tipo="info" titulo="Os Termos de Uso e a Política de Privacidade mudaram">
      <View style={{ gap: ESPACO.e8 }}>
        <Texto variante="corpo">
          Agora qualquer pessoa cria conta e comunidades, e cada comunidade responde pelos dados de
          quem participa dela. Leia o que mudou.
        </Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: ESPACO.e16 }}>
          <Botao
            titulo="Ler os Termos de Uso"
            variante="terciario"
            alinhado
            aoPressionar={() => void abrirDocumento('/termos')}
          />
          <Botao
            titulo="Ler a Política de Privacidade"
            variante="terciario"
            alinhado
            aoPressionar={() => void abrirDocumento('/privacidade')}
          />
        </View>
        <Botao titulo="Entendi" variante="secundario" aoPressionar={entendi} />
      </View>
    </Aviso>
  )
}
