import { ATRIBUICAO, versiculoDoDia } from '@uj/conteudo'
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

/** Versículo do dia (o mesmo para todos na mesma data, sem depender de comunidade). */
export function CartaoDoVersiculo({ comAtalho = true }: { comAtalho?: boolean }) {
  const v = versiculoDoDia(useHoje())
  return (
    <Cartao titulo="Versículo do dia" icone="versiculo">
      <Texto selectable>{v.texto}</Texto>
      <Texto variante="corpoForte">{v.referencia}</Texto>
      <Texto variante="apoio" cor="textoSuave">
        {ATRIBUICAO.traducao}
      </Texto>
      {comAtalho ? (
        <Botao
          titulo="Horário e notificação"
          icone="sino"
          variante="discreto"
          larguraTotal={false}
          aoPressionar={() => router.push('/versiculo')}
        />
      ) : null}
    </Cartao>
  )
}
