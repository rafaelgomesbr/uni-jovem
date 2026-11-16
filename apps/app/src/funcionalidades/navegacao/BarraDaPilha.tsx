import { router, useSegments } from 'expo-router'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { Platform, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ContextoDaBarraDeAbas } from '@/ui/Tela'
import { registrarRodape } from '@/ui/Toast'

import type { DefinicaoDaAba } from './abas'
import {
  espacoDaBarra,
  itensDaBarraNaPilha,
  propsDaBarraFlutuante,
  useTecladoAberto,
} from './BarraDeAbas'
import { abaDosSegmentos, barraFlutuanteNaJanela, barraFlutuanteNaRota } from './rotasDaBarra'

/** Área segura de baixo que a barra considera (na web, 0, como no `AbasDoApp.web`). */
function useMargemDaBarra(): number {
  const margens = useSafeAreaInsets()
  return Platform.OS === 'web' ? 0 : margens.bottom
}

/** A barra flutuante cabe nesta janela (sempre no celular; só na web estreita). */
function useBarraNaJanela(): boolean {
  const { width } = useWindowDimensions()
  return barraFlutuanteNaJanela(Platform.OS === 'web', width)
}

/**
 * Espaço da barra para cada tela da pilha, decidido pelo nome DELA (não pela
 * rota em foco): durante a transição as duas telas estão montadas, e cada
 * uma mantém o próprio fim de rolagem. Exceções e o grupo das abas recebem 0
 * (o `AbasDoApp` fornece o dele por dentro).
 */
function EspacoDaBarraNaTela({ rota, children }: { rota: string; children: ReactNode }) {
  const margem = useMargemDaBarra()
  const naJanela = useBarraNaJanela()
  const espaco = naJanela && barraFlutuanteNaRota(rota) ? espacoDaBarra(margem) : 0
  return <ContextoDaBarraDeAbas.Provider value={espaco}>{children}</ContextoDaBarraDeAbas.Provider>
}

/** O que a pilha passa ao `screenLayout` (o tipo do React Navigation não é exportado). */
interface ArgumentosDoLeiaute {
  route: { name: string }
  children: ReactElement
}

/** `screenLayout` da pilha `(autenticado)`: embrulha cada tela com o espaço da barra. */
export function leiauteDaTelaNaPilha({ route, children }: ArgumentosDoLeiaute) {
  return <EspacoDaBarraNaTela rota={route.name}>{children}</EspacoDaBarraNaTela>
}

/**
 * Barra de abas flutuante das telas empilhadas (D56): o mesmo visual e a
 * mesma posição da barra das abas, por cima da pilha, para que a navegação
 * principal não suma ao abrir um detalhe ou uma lista. Some no grupo das
 * abas (lá vale a do `Tabs`), nas exceções de `rotasDaBarra` e com o teclado
 * aberto. A aba marcada é a última aberta; tocar numa aba fecha a pilha até
 * as abas e abre aquela (`dismissTo` acha as abas que já existem, sem
 * recriá-las; aberta por link, sem abas embaixo, troca a tela por elas).
 */
export function BarraDaPilha() {
  const segmentos = useSegments()
  const margem = useMargemDaBarra()
  const naJanela = useBarraNaJanela()
  const teclado = useTecladoAberto()
  const abaAberta = abaDosSegmentos(segmentos)
  const [ultimaAba, setUltimaAba] = useState<DefinicaoDaAba['rota']>(abaAberta ?? 'index')
  // Guarda a aba ao trocar (informação da renderização anterior, sem efeito).
  if (abaAberta !== null && abaAberta !== ultimaAba) setUltimaAba(abaAberta)

  const visivel = naJanela && barraFlutuanteNaRota(segmentos)
  const espaco = espacoDaBarra(margem)
  // O toast fica 12 acima da barra enquanto ela está na tela.
  useEffect(() => {
    if (!visivel || teclado) return
    return registrarRodape(espaco)
  }, [visivel, teclado, espaco])

  if (!visivel) return null
  return (
    <View {...propsDaBarraFlutuante(margem, teclado)}>
      {itensDaBarraNaPilha(ultimaAba, (aba) => router.dismissTo(aba.href))}
    </View>
  )
}
