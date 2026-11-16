import { ALTURA, BARRA_DE_ABAS, RAIO } from '@uj/tokens'
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui'
import { Platform, StyleSheet, useWindowDimensions } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { NomeDoTraco } from '@/ui/IconeDeTraco'
import { ItemDaBarraDeAbas, rotulosCabemNaBarra } from '@/ui/ItemDaBarraDeAbas'
import { useTecladoAberto } from '@/ui/teclado'
import { sombra, useTema } from '@/ui/tema'
import { Vidro } from '@/ui/Vidro'
import { soNaWeb } from '@/ui/web'

import { fotoDaConta } from '../perfil/imagens'
import { ABAS, type DefinicaoDaAba } from './abas'

/** Altura da barra: item de 48, padding de 8 em cima e embaixo e a borda de 1 (66). */
export const ALTURA_DA_BARRA = ALTURA.aba + BARRA_DE_ABAS.preenchimento * 2 + 2

/** Distância do fim: o maior entre (área segura de baixo - 10) e 12; 24 no iPhone com Face ID (M). */
export function distanciaDaBarra(margemDeBaixo: number): number {
  return Math.max(margemDeBaixo - BARRA_DE_ABAS.descontoDaAreaSegura, BARRA_DE_ABAS.distanciaMinima)
}

/** Quanto a barra ocupa no fim da tela (para o toast e para o fim da rolagem). */
export function espacoDaBarra(margemDeBaixo: number): number {
  return distanciaDaBarra(margemDeBaixo) + ALTURA_DA_BARRA
}

/** Os rótulos escritos (a aba Perfil mostra o avatar, sem rótulo). */
const ROTULOS_ESCRITOS = ABAS.filter((a) => a.icone !== 'avatar').map((a) => a.rotulo)

/** Reexportado daqui porque a barra e quem a monta leem o teclado juntos. */
export { useTecladoAberto }

interface PropsDoItem extends Omit<TabTriggerSlotProps, 'ref'> {
  rotulo: string
  icone: NomeDoTraco | 'avatar'
}

/**
 * Item com a sessão (o desenho está em `ui/ItemDaBarraDeAbas`). O `ref` que
 * o TabTrigger repassa é descartado de propósito: o tipo dele não casa com o
 * do Pressable e nada aqui precisa do nó.
 */
function ItemDaBarra({ rotulo, icone, isFocused, onPress, onLongPress }: PropsDoItem) {
  const { conta } = useSessao()
  const { width, fontScale } = useWindowDimensions()
  return (
    <ItemDaBarraDeAbas
      rotulo={rotulo}
      semRotulo={!rotulosCabemNaBarra(ROTULOS_ESCRITOS, ABAS.length, width, fontScale)}
      icone={icone === 'avatar' ? null : icone}
      avatar={
        icone === 'avatar' && conta
          ? { nome: conta.nome, dados: { ...conta.avatar, foto: fotoDaConta(conta) } }
          : null
      }
      ativo={!!isFocused}
      nomeAcessivel={icone === 'avatar' && conta ? `${rotulo} de ${conta.nome}` : rotulo}
      onPress={onPress}
      onLongPress={onLongPress}
    />
  )
}

/**
 * Barra de abas flutuante (seção 2.12.17): vidro da barra, raio 28, 16 das
 * laterais e `distanciaDaBarra` do fim, padding de 8 e sombra flutuante. Com
 * "Reduzir transparência", o `Vidro` vira superfície opaca. O `Tabs` do
 * expo-router só acha os gatilhos em `<TabList>` filha direta dele: por isso
 * aqui saem as props da lista e os filhos, e quem monta a lista é o `AbasDoApp`.
 */
export function propsDaBarraFlutuante(margemDeBaixo: number, escondida = false) {
  return {
    ...(Platform.OS === 'web'
      ? soNaWeb({ role: 'navigation' })
      : { accessibilityRole: 'tablist' as const }),
    'aria-label': 'Navegação principal',
    style: {
      position: 'absolute' as const,
      left: BARRA_DE_ABAS.margemLateral,
      right: BARRA_DE_ABAS.margemLateral,
      bottom: distanciaDaBarra(margemDeBaixo),
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      padding: BARRA_DE_ABAS.preenchimento + 1,
      borderRadius: RAIO.barra,
      ...(escondida ? { display: 'none' as const } : {}),
    },
  }
}

/** Fundo de vidro e os cinco gatilhos (filhos diretos da `TabList`). */
export function itensDaBarraFlutuante() {
  return [
    <FundoDaBarra key="vidro" />,
    ...ABAS.map((aba) => (
      <TabTrigger key={aba.rota} name={aba.rota} href={aba.href} asChild>
        <ItemDaBarra rotulo={aba.rotulo} icone={aba.icone} />
      </TabTrigger>
    )),
  ]
}

/**
 * Os mesmos itens fora do `Tabs`, para a barra das telas empilhadas: não há
 * `TabTrigger` ali, então quem diz a aba marcada (a última aberta) e o que
 * fazer ao tocar é a `BarraDaPilha`.
 */
export function itensDaBarraNaPilha(
  abaMarcada: DefinicaoDaAba['rota'],
  aoEscolher: (aba: DefinicaoDaAba) => void,
) {
  return [
    <FundoDaBarra key="vidro" />,
    ...ABAS.map((aba) => (
      <ItemDaBarra
        key={aba.rota}
        rotulo={aba.rotulo}
        icone={aba.icone}
        isFocused={aba.rota === abaMarcada}
        onPress={() => aoEscolher(aba)}
      />
    )),
  ]
}

function FundoDaBarra() {
  const { elevacao } = useTema()
  return (
    <Vidro
      style={[StyleSheet.absoluteFill, { borderRadius: RAIO.barra }, sombra(elevacao.flutuante)]}
    />
  )
}
