import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui'
import { Pressable, useWindowDimensions, View } from 'react-native'

import { LARGURA_DA_BARRA_LATERAL, NOME_DO_APP } from '@/constantes'
import { useSessao } from '@/estado/sessao'
import { Avatar } from '@/ui/Avatar'
import { FundoAurora } from '@/ui/FundoAurora'
import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { ContextoDaBarraDeAbas } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { soNaWeb } from '@/ui/web'

import { ABAS } from './abas'
import { espacoDaBarra, itensDaBarraFlutuante, propsDaBarraFlutuante } from './BarraDeAbas'
import { useGruposDoMais } from './mais'

interface PropsDoItemLateral extends Omit<TabTriggerSlotProps, 'ref'> {
  rotulo: string
  icone: NomeDoIcone | 'avatar'
}

/**
 * Item da barra lateral (web larga). O aberto tem forma além da cor: pílula
 * coral translúcida, barra de 3 pt à esquerda e rótulo em 600; para o leitor
 * de tela, `aria-current="page"`. O `ref` do TabTrigger é descartado: nada
 * aqui precisa do nó e o tipo dele não casa com o do Pressable.
 */
function ItemLateral({ rotulo, icone, isFocused, onPress, onLongPress }: PropsDoItemLateral) {
  const { cores } = useTema()
  const { conta } = useSessao()
  const ativo = !!isFocused
  const cor = ativo ? cores.destaque : cores.textoSuave
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={icone === 'avatar' && conta ? `${rotulo} de ${conta.nome}` : rotulo}
      {...soNaWeb({ 'aria-current': ativo ? 'page' : undefined })}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        minHeight: ALVO,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.x3,
        paddingHorizontal: ESPACO.x3,
        paddingVertical: ESPACO.x2,
        borderRadius: RAIO.medio,
        backgroundColor: ativo ? cores.abaAtiva : pressed ? cores.superficieRealce : 'transparent',
      })}
    >
      {ativo ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 10,
            bottom: 10,
            width: 3,
            borderRadius: 2,
            backgroundColor: cores.destaque,
          }}
        />
      ) : null}
      {icone === 'avatar' && conta ? (
        <View
          style={{
            borderRadius: RAIO.pilula,
            borderWidth: 2,
            borderColor: ativo ? cores.destaque : 'transparent',
            padding: 1,
          }}
        >
          <Avatar nome={conta.nome} avatar={conta.avatar ?? null} lado={22} decorativo />
        </View>
      ) : (
        <Icone nome={icone === 'avatar' ? 'pessoa' : icone} cor={cor} tamanho={22} />
      )}
      <Texto variante={ativo ? 'corpoForte' : 'corpo'} style={{ color: cor }}>
        {rotulo}
      </Texto>
    </Pressable>
  )
}

/**
 * Módulos que não são abas (avisos, oração, relatórios...), conforme o papel.
 * Na web larga ficam na própria barra lateral; abrem como telas da pilha.
 */
function MaisNaLateral() {
  const { cores } = useTema()
  const grupos = useGruposDoMais()
  return (
    <View
      style={{
        gap: ESPACO.x1,
        marginTop: ESPACO.x4,
        borderTopWidth: 1,
        borderTopColor: cores.cartaoVidroBorda,
      }}
    >
      {grupos.map((g) => (
        <View key={g.titulo} style={{ gap: ESPACO.x1 }}>
          <Texto
            variante="sobrancelha"
            accessibilityRole="header"
            nivel={2}
            style={{ paddingHorizontal: ESPACO.x3, paddingTop: ESPACO.x4 }}
          >
            {g.titulo}
          </Texto>
          {g.itens.map((i) => (
            <Pressable
              key={i.rotulo}
              accessibilityRole="link"
              accessibilityLabel={i.rotulo}
              onPress={() => router.push(i.href)}
              style={({ pressed }) => ({
                minHeight: ALVO,
                flexDirection: 'row',
                alignItems: 'center',
                gap: ESPACO.x3,
                paddingHorizontal: ESPACO.x3,
                borderRadius: RAIO.medio,
                backgroundColor: pressed ? cores.superficieRealce : 'transparent',
              })}
            >
              <Icone nome={i.icone} cor={cores.textoSuave} tamanho={22} />
              <Texto variante="corpo" style={{ color: cores.textoSuave }}>
                {i.rotulo}
              </Texto>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  )
}

const ID_DO_CONTEUDO = 'uj-conteudo'

/**
 * Primeiro item do teclado: leva direto ao conteúdo, sem passar pelas seções.
 * Fica fora da vista até receber foco (CSS em `EstilosDaWeb`, pelo id).
 */
function PularParaOConteudo() {
  const { cores } = useTema()
  return (
    <Pressable
      nativeID="uj-pular"
      accessibilityRole="link"
      onPress={() => document.getElementById(ID_DO_CONTEUDO)?.focus()}
      style={{
        position: 'absolute',
        top: ESPACO.x2,
        left: ESPACO.x2,
        zIndex: 10,
        minHeight: ALVO,
        justifyContent: 'center',
        paddingHorizontal: ESPACO.x4,
        borderRadius: RAIO.medio,
        backgroundColor: cores.primaria,
      }}
    >
      <Texto variante="corpoForte" cor="sobrePrimaria">
        Pular para o conteúdo
      </Texto>
    </Pressable>
  )
}

/**
 * Web: barra lateral (os cinco itens e os módulos) em janela larga; a mesma
 * barra flutuante do celular em janela estreita. Os gatilhos ficam como
 * filhos diretos da TabList, e ela, filha direta de `Tabs` (é só ali que o
 * `Tabs` os procura). O conteúdo fica sempre na mesma posição entre os
 * filhos, então a tela não remonta ao redimensionar.
 */
export function AbasDoApp() {
  const { cores } = useTema()
  const { width } = useWindowDimensions()
  const lateral = width >= LARGURA_DA_BARRA_LATERAL

  const conteudo = (
    <View
      key="conteudo"
      nativeID={ID_DO_CONTEUDO}
      {...soNaWeb({ role: 'main', tabIndex: -1 })}
      style={{ flex: 1 }}
    >
      <TabSlot style={{ flex: 1 }} />
    </View>
  )

  if (!lateral) {
    return (
      <ContextoDaBarraDeAbas.Provider value={espacoDaBarra(0)}>
        <Tabs style={{ flex: 1, backgroundColor: cores.fundo }}>
          <PularParaOConteudo key="pular" />
          {conteudo}
          <TabList key="abas" {...propsDaBarraFlutuante(0)}>
            {itensDaBarraFlutuante()}
          </TabList>
        </Tabs>
      </ContextoDaBarraDeAbas.Provider>
    )
  }

  return (
    <Tabs style={{ flex: 1, flexDirection: 'row', backgroundColor: cores.fundo }}>
      <PularParaOConteudo key="pular" />
      <TabList
        key="abas"
        {...soNaWeb({ role: 'navigation' })}
        aria-label="Navegação principal"
        style={{
          width: 264,
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: ESPACO.x1,
          padding: ESPACO.x4,
          borderRightWidth: 1,
          borderRightColor: cores.cartaoVidroBorda,
          backgroundColor: cores.fundo,
          overflow: 'hidden',
        }}
      >
        <FundoAurora />
        <View style={{ paddingVertical: ESPACO.x4, paddingHorizontal: ESPACO.x3 }}>
          <Texto variante="titulo" accessibilityRole="text">
            {NOME_DO_APP}
          </Texto>
        </View>
        {ABAS.map((aba) => (
          <TabTrigger key={aba.rota} name={aba.rota} href={aba.href} asChild>
            <ItemLateral rotulo={aba.rotulo} icone={aba.icone} />
          </TabTrigger>
        ))}
        <MaisNaLateral key="mais" />
      </TabList>
      {conteudo}
    </Tabs>
  )
}
