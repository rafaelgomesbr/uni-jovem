import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { FAMILIA } from '@/ui/fontes'
import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { soNaWeb } from '@/ui/web'

import { NOME_DO_ESTADO_DA_COMUNIDADE } from '../comunidade/nomes'
import { IndicadorDeSincronizacao } from '../offline/IndicadorDeSincronizacao'

/** Iniciais da comunidade para o círculo coral ("Jovens Central" vira "JC"). */
function iniciaisDaComunidade(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p))
  const letras = partes.length > 1 ? [partes[0]!, partes.at(-1)!] : partes.slice(0, 1)
  return (
    letras
      .map((p) => [...p][0] ?? '')
      .join('')
      .toLocaleUpperCase('pt-BR') || '?'
  )
}

/**
 * Topo das abas (mockup Aurora): pílula da comunidade ativa, sempre visível,
 * que abre a troca; à direita, o estado da sincronização. Fica dentro da
 * rolagem, sobre a aurora; a área segura de cima é da `Tela`.
 */
export function CabecalhoDaComunidade() {
  const { comunidadeAtiva, comunidades } = useSessao()
  const { cores } = useTema()
  const podeTrocar = comunidades.length > 1 || (!comunidadeAtiva && comunidades.length > 0)

  const detalhe = comunidadeAtiva
    ? [
        NOME_DO_PAPEL[comunidadeAtiva.papel],
        comunidadeAtiva.estado !== 'ativa'
          ? NOME_DO_ESTADO_DA_COMUNIDADE[comunidadeAtiva.estado]
          : null,
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  const nome = comunidadeAtiva
    ? comunidadeAtiva.nome
    : comunidades.length === 0
      ? 'Sem comunidade'
      : 'Escolher comunidade'

  const pilula = (pressionado: boolean) => (
    <View
      style={{
        minHeight: ALVO,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
        paddingLeft: 6,
        paddingRight: 14,
        borderRadius: RAIO.pilula,
        borderWidth: 1,
        borderColor: cores.cartaoVidroBorda,
        backgroundColor: pressionado ? cores.superficieRealce : cores.cartaoVidro,
        maxWidth: '100%',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: cores.primaria,
        }}
      >
        {comunidadeAtiva ? (
          <Text
            allowFontScaling={false}
            importantForAccessibility="no"
            style={{
              color: cores.sobrePrimaria,
              fontFamily: FAMILIA.tituloForte,
              fontSize: 13,
              lineHeight: 16,
            }}
          >
            {iniciaisDaComunidade(comunidadeAtiva.nome)}
          </Text>
        ) : (
          <Icone nome="comunidade" cor={cores.sobrePrimaria} tamanho={18} />
        )}
      </View>
      <Texto variante="corpoForte" numberOfLines={1} style={{ fontSize: 15, flexShrink: 1 }}>
        {nome}
      </Texto>
      {podeTrocar ? <Icone nome="abrirLista" cor={cores.texto} tamanho={16} /> : null}
    </View>
  )

  return (
    <View
      {...soNaWeb({ role: 'banner' })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: ESPACO.x3,
      }}
    >
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        {podeTrocar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              comunidadeAtiva
                ? `Comunidade ${comunidadeAtiva.nome}, ${detalhe}. Trocar de comunidade`
                : 'Escolher comunidade'
            }
            onPress={() => router.push('/trocar-comunidade')}
          >
            {({ pressed }) => pilula(pressed)}
          </Pressable>
        ) : (
          <View
            accessible
            accessibilityLabel={
              comunidadeAtiva ? `Comunidade ${comunidadeAtiva.nome}, ${detalhe}` : nome
            }
          >
            {pilula(false)}
          </View>
        )}
      </View>
      <IndicadorDeSincronizacao />
    </View>
  )
}
