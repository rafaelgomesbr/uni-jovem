import { BARRA_DE_ABAS, ESPACO, RAIO } from '@uj/tokens'
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { Avatar } from '@/ui/Avatar'
import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { Vidro } from '@/ui/Vidro'
import { soNaWeb } from '@/ui/web'

import { ABAS } from './abas'

/** Altura da barra: item de 48 + preenchimento de 8 em cima e embaixo + borda. */
export const ALTURA_DA_BARRA = BARRA_DE_ABAS.alturaDoItem + BARRA_DE_ABAS.preenchimento * 2 + 2

/** Quanto a tela reserva no fim da rolagem para a barra não cobrir conteúdo. */
export function espacoDaBarra(margemDeBaixo: number): number {
  return ALTURA_DA_BARRA + BARRA_DE_ABAS.distanciaDoFim + margemDeBaixo + ESPACO.x2
}

interface PropsDoItem extends Omit<TabTriggerSlotProps, 'ref'> {
  rotulo: string
  icone: NomeDoIcone | 'avatar'
}

/**
 * Item da barra (mockup): ícone de 22 e rótulo de 11. O ativo ganha pílula
 * coral translúcida, rótulo em 600 e, no Perfil, anel coral no avatar: forma
 * além da cor. Celular: papel `tab` com estado selecionado; web: link com
 * `aria-current="page"` (navegação, não painel de abas).
 *
 * O `ref` que o TabTrigger repassa é descartado de propósito: o tipo dele não
 * casa com o do Pressable e nada aqui precisa do nó.
 */
function ItemDaBarra({ rotulo, icone, isFocused, onPress, onLongPress }: PropsDoItem) {
  const { cores } = useTema()
  const { conta } = useSessao()
  const ativo = !!isFocused
  const cor = ativo ? cores.destaque : cores.textoSuave
  const web = Platform.OS === 'web'
  const nomeAcessivel = icone === 'avatar' && conta ? `${rotulo} de ${conta.nome}` : rotulo
  return (
    <Pressable
      accessibilityRole={web ? 'link' : 'tab'}
      accessibilityLabel={nomeAcessivel}
      {...(web
        ? soNaWeb({ 'aria-current': ativo ? 'page' : undefined })
        : { 'aria-selected': ativo })}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: Math.max(ALVO, BARRA_DE_ABAS.larguraMinimaDoItem),
        minHeight: Math.max(ALVO, BARRA_DE_ABAS.alturaDoItem),
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderRadius: BARRA_DE_ABAS.raioDoItem,
        backgroundColor: ativo ? cores.abaAtiva : pressed ? cores.superficieRealce : 'transparent',
      })}
    >
      {icone === 'avatar' ? (
        <View
          style={{
            borderRadius: RAIO.pilula,
            borderWidth: 2,
            borderColor: ativo ? cores.destaque : 'transparent',
            padding: 1,
          }}
        >
          {conta ? (
            <Avatar
              nome={conta.nome}
              avatar={conta.avatar ?? null}
              lado={BARRA_DE_ABAS.ladoDoAvatar - 6}
              decorativo
            />
          ) : (
            <Icone nome="pessoa" cor={cor} tamanho={BARRA_DE_ABAS.tamanhoDoIcone} />
          )}
        </View>
      ) : (
        <Icone nome={icone} cor={cor} tamanho={BARRA_DE_ABAS.tamanhoDoIcone} />
      )}
      <Texto
        variante={ativo ? 'rotulo' : 'aba'}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={{ color: cor, fontSize: 11, lineHeight: 14 }}
      >
        {rotulo}
      </Texto>
    </Pressable>
  )
}

/**
 * Barra de abas flutuante do mockup: vidro com desfoque, raio 28, 16 das
 * laterais e 24 do fim (mais a área segura). Com "Reduzir transparência", o
 * `Vidro` vira superfície opaca. O `Tabs` do expo-router só acha os gatilhos
 * em `<TabList>` filha direta dele: por isso aqui saem as props da lista e os
 * filhos, e quem monta a `<TabList>` é o `AbasDoApp`.
 */
export function propsDaBarraFlutuante(margemDeBaixo: number) {
  return {
    ...(Platform.OS === 'web'
      ? soNaWeb({ role: 'navigation' })
      : { accessibilityRole: 'tablist' as const }),
    'aria-label': 'Navegação principal',
    style: {
      position: 'absolute' as const,
      left: BARRA_DE_ABAS.margemLateral,
      right: BARRA_DE_ABAS.margemLateral,
      bottom: BARRA_DE_ABAS.distanciaDoFim + margemDeBaixo,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      gap: 2,
      padding: BARRA_DE_ABAS.preenchimento,
      borderRadius: BARRA_DE_ABAS.raio,
      overflow: 'hidden' as const,
    },
  }
}

/** Fundo de vidro e os cinco gatilhos (filhos diretos da `TabList`). */
export function itensDaBarraFlutuante() {
  return [
    <Vidro key="vidro" style={[StyleSheet.absoluteFill, { borderRadius: BARRA_DE_ABAS.raio }]} />,
    ...ABAS.map((aba) => (
      <TabTrigger key={aba.rota} name={aba.rota} href={aba.href} asChild>
        <ItemDaBarra rotulo={aba.rotulo} icone={aba.icone} />
      </TabTrigger>
    )),
  ]
}
