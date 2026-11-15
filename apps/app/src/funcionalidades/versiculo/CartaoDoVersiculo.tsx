import { ATRIBUICAO, versiculoDoDia } from '@uj/conteudo'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'

/** Data de hoje no aparelho, trocada ao voltar ao app em outro dia. */
export function useHoje(): Date {
  const [hoje, setHoje] = useState(() => new Date())
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      const agora = new Date()
      setHoje((antes) => (antes.toDateString() === agora.toDateString() ? antes : agora))
    })
    return () => assinatura.remove()
  }, [])
  return hoje
}

/** Sigla da tradução, como no mockup ("Referência · BLIVRE"). */
const SIGLA = /\(([^)]+)\)/.exec(ATRIBUICAO.traducao)?.[1] ?? ATRIBUICAO.traducao

/**
 * Versículo do dia (o mesmo para todos na mesma data, sem depender de
 * comunidade), como no mockup: sobrancelha, 8, texto de leitura 17/26
 * selecionável, 8, referência com a sigla da tradução. No Início não há botão:
 * o ajuste fica no Perfil.
 */
export function CartaoDoVersiculo({ comAtalho = false }: { comAtalho?: boolean }) {
  const v = versiculoDoDia(useHoje())
  return (
    <CartaoDeVidro sobrancelha="Versículo do dia" intervalo={ESPACO.e8}>
      <Texto variante="leitura" selectable>
        {v.texto}
      </Texto>
      <Texto variante="legenda" cor="textoSuave">
        {v.referencia} · {SIGLA}
      </Texto>
      {comAtalho ? (
        <Botao
          titulo="Horário e notificação"
          variante="terciario"
          alinhado
          rotuloAcessivel={`Horário e notificação do versículo. Tradução: ${ATRIBUICAO.traducao}`}
          aoPressionar={() => router.push('/versiculo')}
        />
      ) : null}
    </CartaoDeVidro>
  )
}
