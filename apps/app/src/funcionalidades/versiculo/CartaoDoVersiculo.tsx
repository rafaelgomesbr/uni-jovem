import { ATRIBUICAO, versiculoDoDia } from '@uj/conteudo'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, useWindowDimensions, View } from 'react-native'

import { Acordeao, reiniciarAcordeoesDaSessao } from '@/ui/Acordeao'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Icone } from '@/ui/Icone'
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
 * Os colchetes da Bíblia Livre marcam palavras que o tradutor acrescentou;
 * para quem lê parecem erro de digitação (D62, Q7). A explicação continua em
 * "Sobre a tradução".
 */
export function semColchetes(texto: string): string {
  return texto.replace(/\[([^\]]*)\]/g, '$1')
}

/** As primeiras palavras do texto, para a linha recolhida: `“Não fostes vós que me escolhestes…”`. */
export function comecoDoVersiculo(texto: string, palavras = 7): string {
  const todas = semColchetes(texto).split(/\s+/).filter(Boolean)
  const inicio = todas
    .slice(0, palavras)
    .join(' ')
    .replace(/[\s,;:.!?]+$/, '')
  return `“${inicio}${todas.length > palavras ? '…' : ''}”`
}

/** Para os testes: o versículo recolhido na sessão nova (a escolha mora no `Acordeao`). */
export function reiniciarVersiculoDaSessao(): void {
  reiniciarAcordeoesDaSessao()
}

interface Props {
  /**
   * Sempre aberto, sem a linha que recolhe: a tela cheia do versículo, onde a
   * pessoa foi justamente para ler.
   */
  fixoAberto?: boolean
}

/**
 * Versículo do dia (o mesmo para todos na mesma data, sem depender de
 * comunidade). Nas telas de navegação é uma linha fina de 44 pt sob a
 * saudação (D62): ícone, o começo do texto entre aspas e o chevron; tocar abre
 * o texto inteiro e a tradução, tocar de novo recolhe. Aberto, segue o
 * mockup: texto de leitura 17/26 selecionável, referência com a sigla da
 * tradução e "Sobre a tradução". Com fonte grande (1,35 ou mais) o começo vai
 * a 2 linhas e a referência desce.
 */
export function CartaoDoVersiculo({ fixoAberto = false }: Props) {
  const v = versiculoDoDia(useHoje())
  const { cores } = useTema()
  const { fontScale } = useWindowDimensions()
  const fonteGrande = fontScale >= 1.35
  const texto = semColchetes(v.texto)

  const conteudo = (
    <>
      <Texto variante="leitura" selectable>
        {texto}
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
    <Acordeao
      chave="versiculo"
      rotuloRecolhido={`Versículo do dia, ${v.referencia}. Recolhido. Toque para ler.`}
      rotuloAberto={`Versículo do dia, ${v.referencia}. Aberto. Toque para recolher.`}
      cabecalho={(aberto) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
          <Icone nome="versiculo" cor={cores.textoSuave} tamanho={18} />
          <View style={{ flex: 1 }}>
            {aberto ? (
              <Texto variante="rotulo" cor="textoSuave" accessibilityRole="text">
                Versículo do dia
              </Texto>
            ) : (
              <>
                <Texto
                  variante="corpo"
                  cor="textoSuave"
                  numberOfLines={fonteGrande ? 2 : 1}
                  accessibilityRole="text"
                >
                  {comecoDoVersiculo(v.texto)}
                </Texto>
                {fonteGrande ? (
                  <Texto variante="legenda" cor="textoSuave" accessibilityRole="text">
                    {v.referencia}
                  </Texto>
                ) : null}
              </>
            )}
          </View>
        </View>
      )}
    >
      <CartaoDeVidro intervalo={ESPACO.e8}>{conteudo}</CartaoDeVidro>
    </Acordeao>
  )
}
