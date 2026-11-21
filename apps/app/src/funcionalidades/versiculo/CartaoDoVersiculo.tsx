import { ATRIBUICAO, versiculoDoDia } from '@uj/conteudo'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, Pressable, View } from 'react-native'

import { Aparecer } from '@/ui/Aparecer'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

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
 * A escolha da pessoa vale só enquanto o app está aberto (D59): nada vai para
 * o aparelho nem para o servidor. Sem isso, trocar de visão no Início
 * recolheria o versículo de novo.
 */
let abertoNestaSessao = false

/** Só para os testes: cada teste começa com o versículo recolhido, como numa sessão nova. */
export function reiniciarVersiculoDaSessao(): void {
  abertoNestaSessao = false
}

interface Props {
  comAtalho?: boolean
  /**
   * Sempre aberto, sem a linha que recolhe: a tela cheia do versículo, onde a
   * pessoa foi justamente para ler.
   */
  fixoAberto?: boolean
}

/**
 * Versículo do dia (o mesmo para todos na mesma data, sem depender de
 * comunidade). Nas telas de navegação aparece RECOLHIDO (D59): uma linha com
 * o rótulo, a referência e o chevron; tocar abre o texto e a tradução, tocar
 * de novo recolhe. Aberto, segue o mockup: texto de leitura 17/26
 * selecionável, 8, referência com a sigla da tradução. Com "Reduzir
 * movimento", abre sem animação.
 */
export function CartaoDoVersiculo({ comAtalho = false, fixoAberto = false }: Props) {
  const v = versiculoDoDia(useHoje())
  const { cores } = useTema()
  const [aberto, setAberto] = useState(abertoNestaSessao)
  const mostrar = fixoAberto || aberto

  function alternar() {
    abertoNestaSessao = !aberto
    setAberto(!aberto)
  }

  const conteudo = (
    <>
      <Texto variante="leitura" selectable>
        {v.texto}
      </Texto>
      <Texto variante="legenda" cor="textoSuave">
        {v.referencia} · {SIGLA}
      </Texto>
      {fixoAberto ? null : (
        <Botao
          titulo="Sobre a tradução"
          variante="terciario"
          alinhado
          rotuloAcessivel={`Sobre a tradução: ${ATRIBUICAO.traducao}, ${ATRIBUICAO.licenca}`}
          aoPressionar={() => router.push('/versiculo/traducao')}
        />
      )}
      {comAtalho ? (
        <Botao
          titulo="Horário e notificação"
          variante="terciario"
          alinhado
          rotuloAcessivel={`Horário e notificação do versículo. Tradução: ${ATRIBUICAO.traducao}`}
          aoPressionar={() => router.push('/versiculo')}
        />
      ) : null}
    </>
  )

  if (fixoAberto) {
    return (
      <CartaoDeVidro sobrancelha="Versículo do dia" intervalo={ESPACO.e8}>
        {conteudo}
      </CartaoDeVidro>
    )
  }

  return (
    <CartaoDeVidro intervalo={ESPACO.e8}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Versículo do dia, ${v.referencia}. ${mostrar ? 'Recolher texto' : 'Mostrar texto'}`}
        aria-expanded={mostrar}
        onPress={alternar}
        style={{
          minHeight: ALVO,
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e8,
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: ESPACO.e8 }}>
          <Texto variante="sobrancelha" accessibilityRole="text">
            Versículo do dia
          </Texto>
          <Texto variante="legenda" cor="textoSuave" accessibilityRole="text">
            {v.referencia}
          </Texto>
        </View>
        <View style={{ transform: [{ rotate: mostrar ? '180deg' : '0deg' }] }}>
          <Icone nome="abrirLista" cor={cores.textoSuave} tamanho={14} peso="semibold" />
        </View>
      </Pressable>
      {mostrar ? <Aparecer style={{ gap: ESPACO.e8 }}>{conteudo}</Aparecer> : null}
    </CartaoDeVidro>
  )
}
