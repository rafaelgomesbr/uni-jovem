import { ESPACO, RAIO, type Paleta } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { AccessibilityInfo, Pressable, View } from 'react-native'

import { Botao } from '@/ui/Botao'
import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { IndicadorDeConexao } from '@/ui/IndicadorDeConexao'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { contar, horaNoAparelho } from './formatos'
import { useOffline, type Offline } from './ProvedorOffline'

export interface SinalDaSincronizacao {
  texto: string
  icone: NomeDoIcone
  cor: keyof Paleta
  tentarDeNovo: boolean
}

type Entrada = Pick<
  Offline,
  | 'online'
  | 'fase'
  | 'pendentes'
  | 'rejeitadas'
  | 'conflitos'
  | 'ultimaSincronizacao'
  | 'temParticao'
>

/**
 * O que o selo diz, em ordem de urgência. Sempre texto e ícone: a cor só
 * reforça. `null` quando não há nada guardado nem pendente (cabeçalho limpo).
 */
export function sinalDaSincronizacao(o: Entrada): SinalDaSincronizacao | null {
  const pendentes = contar(o.pendentes, 'alteração pendente', 'alterações pendentes')
  if (!o.online) {
    return {
      texto: o.pendentes
        ? `Sem conexão · ${pendentes}`
        : o.ultimaSincronizacao
          ? `Sem conexão · sincronizado às ${horaNoAparelho(o.ultimaSincronizacao)}`
          : 'Sem conexão',
      icone: 'semConexao',
      cor: 'alerta',
      tentarDeNovo: false,
    }
  }
  if (o.fase === 'sincronizando') {
    return { texto: 'Sincronizando…', icone: 'sincronizar', cor: 'destaque', tentarDeNovo: false }
  }
  if (o.conflitos) {
    return {
      texto: `${contar(o.conflitos, 'conflito', 'conflitos')} a resolver`,
      icone: 'erro',
      cor: 'alerta',
      tentarDeNovo: false,
    }
  }
  if (o.fase === 'falha') {
    return { texto: 'Falha ao sincronizar', icone: 'erro', cor: 'erro', tentarDeNovo: true }
  }
  if (o.rejeitadas) {
    return {
      texto: contar(o.rejeitadas, 'alteração recusada', 'alterações recusadas'),
      icone: 'erro',
      cor: 'alerta',
      tentarDeNovo: false,
    }
  }
  if (o.pendentes) return { texto: pendentes, icone: 'relogio', cor: 'alerta', tentarDeNovo: false }
  if (o.temParticao && o.ultimaSincronizacao) {
    return {
      texto: `Sincronizado às ${horaNoAparelho(o.ultimaSincronizacao)}`,
      icone: 'confirmado',
      cor: 'sucesso',
      tentarDeNovo: false,
    }
  }
  return null
}

/**
 * Estado da sincronização no cabeçalho: sem conexão, pendentes, sincronizando,
 * concluído, falha (com "Tentar de novo") e conflitos. Toca para abrir
 * Pendências. Na web (sem modo offline), mostra só o "Sem conexão".
 */
export function IndicadorDeSincronizacao() {
  const offline = useOffline()
  const { cores } = useTema()
  const online = offline.online
  const disponivel = offline.disponivel

  // O selo visual não é anunciado sozinho: avisa o leitor de tela quando a rede cai.
  // Sem modo offline, quem anuncia é o `IndicadorDeConexao` (um aviso só).
  useEffect(() => {
    if (!online && disponivel) {
      AccessibilityInfo.announceForAccessibility('Sem conexão com a internet')
    }
  }, [online, disponivel])

  if (!offline.disponivel) return <IndicadorDeConexao />
  const sinal = sinalDaSincronizacao(offline)
  if (!sinal) return null

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: ESPACO.x2 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${sinal.texto}. Abrir pendências e sincronização.`}
        onPress={() => router.push('/pendencias')}
        style={({ pressed }) => ({
          minHeight: ALVO,
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.x1,
          paddingHorizontal: ESPACO.x3,
          borderRadius: RAIO.pilula,
          borderWidth: 1,
          borderColor: cores[sinal.cor],
          backgroundColor: cores.superficie,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icone nome={sinal.icone} cor={cores[sinal.cor]} tamanho={16} />
        <Texto variante="rotulo" cor={sinal.cor}>
          {sinal.texto}
        </Texto>
      </Pressable>
      {sinal.tentarDeNovo ? (
        <Botao
          titulo="Tentar de novo"
          icone="sincronizar"
          variante="discreto"
          larguraTotal={false}
          rotuloAcessivel="Tentar sincronizar de novo"
          aoPressionar={() => void offline.sincronizarAgora()}
        />
      ) : null}
    </View>
  )
}
