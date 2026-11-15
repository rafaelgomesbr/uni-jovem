import { ATRIBUICAO, versiculoDoDia } from '@uj/conteudo'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
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

/** Versículo do dia (o mesmo para todos na mesma data, sem depender de comunidade). */
export function CartaoDoVersiculo({ comAtalho = true }: { comAtalho?: boolean }) {
  const v = versiculoDoDia(useHoje())
  return (
    <Cartao titulo="Versículo do dia">
      {/* Mockup: texto de leitura de 17 pt e a referência com a sigla da tradução. */}
      <Texto variante="leitura" selectable style={{ marginTop: -ESPACO.x1 }}>
        {v.texto}
      </Texto>
      <Texto variante="apoio" cor="textoSuave" style={{ fontSize: 13 }}>
        {v.referencia} · {SIGLA}
      </Texto>
      {comAtalho ? (
        <Botao
          titulo="Horário e notificação"
          icone="sino"
          variante="terciario"
          larguraTotal={false}
          rotuloAcessivel={`Horário e notificação do versículo. Tradução: ${ATRIBUICAO.traducao}`}
          aoPressionar={() => router.push('/versiculo')}
          style={{ marginLeft: -ESPACO.x3 }}
        />
      ) : null}
    </Cartao>
  )
}
