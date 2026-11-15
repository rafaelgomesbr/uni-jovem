import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LARGURA_MAXIMA_DO_CONTEUDO } from '@/constantes'
import { useSessao } from '@/estado/sessao'
import { Botao } from '@/ui/Botao'
import { Texto } from '@/ui/Texto'
import { Vidro } from '@/ui/Vidro'

import { IdentidadeDaComunidade } from '../comunidade/Identidade'
import { NOME_DO_ESTADO_DA_COMUNIDADE } from '../comunidade/nomes'
import { IndicadorDeSincronizacao } from '../offline/IndicadorDeSincronizacao'

/**
 * Faixa flutuante (vidro) com a comunidade ativa SEMPRE visível e o seletor
 * explícito para trocar. Toda tela do app autenticado começa por ela.
 */
export function CabecalhoDaComunidade() {
  const { comunidadeAtiva, comunidades } = useSessao()
  const margens = useSafeAreaInsets()
  const podeTrocar = comunidades.length > 1

  const detalhe = comunidadeAtiva
    ? [
        NOME_DO_PAPEL[comunidadeAtiva.papel],
        comunidadeAtiva.estado !== 'ativa'
          ? NOME_DO_ESTADO_DA_COMUNIDADE[comunidadeAtiva.estado]
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <Vidro style={{ borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 }}>
      <View
        accessibilityRole="header"
        style={{
          paddingTop: (Platform.OS === 'web' ? 0 : margens.top) + ESPACO.x2,
          paddingBottom: ESPACO.x2,
          paddingHorizontal: ESPACO.x4,
          width: '100%',
          maxWidth: LARGURA_MAXIMA_DO_CONTEUDO + ESPACO.x8,
          alignSelf: 'center',
          gap: ESPACO.x2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x3 }}>
          <View style={{ flex: 1 }}>
            {comunidadeAtiva ? (
              <IdentidadeDaComunidade
                nome={comunidadeAtiva.nome}
                cor={comunidadeAtiva.cor}
                {...(detalhe ? { detalhe } : {})}
              />
            ) : (
              <Texto variante="corpoForte">
                {comunidades.length === 0 ? 'Sem comunidade' : 'Nenhuma comunidade escolhida'}
              </Texto>
            )}
          </View>
          {podeTrocar || (!comunidadeAtiva && comunidades.length > 0) ? (
            <Botao
              titulo={comunidadeAtiva ? 'Trocar' : 'Escolher'}
              icone="trocar"
              variante="secundario"
              larguraTotal={false}
              rotuloAcessivel={
                comunidadeAtiva
                  ? `Trocar de comunidade. Ativa agora: ${comunidadeAtiva.nome}`
                  : 'Escolher comunidade'
              }
              aoPressionar={() => router.push('/trocar-comunidade')}
            />
          ) : null}
        </View>
        <IndicadorDeSincronizacao />
      </View>
    </Vidro>
  )
}
