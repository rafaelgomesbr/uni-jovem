import { NOME_DO_PAPEL } from '@uj/dominio'
import { ALTURA, ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { PilulaDaComunidade as Pilula } from '@/ui/PilulaDaComunidade'
import { soNaWeb } from '@/ui/web'

import { NOME_DO_ESTADO_DA_COMUNIDADE } from '../comunidade/nomes'
import { logoDaComunidade } from '../perfil/imagens'
import { IndicadorDeSincronizacao } from '../offline/IndicadorDeSincronizacao'

/** O que a pílula mostra e faz, a partir da sessão. */
function usePilula() {
  const { comunidadeAtiva, comunidades } = useSessao()
  const vazia = comunidades.length === 0
  const podeTrocar = comunidades.length > 1 || (!comunidadeAtiva && comunidades.length > 0)
  const nome = comunidadeAtiva
    ? comunidadeAtiva.nome
    : vazia
      ? 'Sem comunidade'
      : 'Escolher comunidade'
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
  const rotulo = comunidadeAtiva
    ? `Comunidade ${comunidadeAtiva.nome}, ${detalhe}.${podeTrocar ? ' Trocar de comunidade' : ''}`
    : vazia
      ? 'Sem comunidade. Entrar numa comunidade'
      : 'Escolher comunidade'
  const aoPressionar = podeTrocar
    ? () => router.push('/trocar-comunidade')
    : vazia
      ? () => router.push('/entrar-com-convite')
      : null
  // Logotipo da comunidade (D33): sem ele, as iniciais em coral do mockup.
  const logo = comunidadeAtiva ? logoDaComunidade(comunidadeAtiva) : null
  return { nome, vazia, podeTrocar, rotulo, aoPressionar, logo }
}

/** Pílula da comunidade com a sessão (o desenho está em `ui/PilulaDaComunidade`). */
export function PilulaDaComunidade({ compacta = false }: { compacta?: boolean }) {
  return <Pilula {...usePilula()} compacta={compacta} />
}

/**
 * Linha do topo das raízes de aba (M): pílula à esquerda e status à direita,
 * `space-between`, intervalo de 12. Sem comunidade, não há status. Com fonte
 * grande, o status desce para a linha de baixo.
 */
export function CabecalhoDaComunidade({ compacto = false }: { compacto?: boolean }) {
  const { comunidades } = useSessao()
  return (
    <View
      {...soNaWeb({ role: 'banner' })}
      style={{
        minHeight: compacto ? 36 : ALTURA.pilula,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: ESPACO.e12,
      }}
    >
      <PilulaDaComunidade compacta={compacto} />
      {comunidades.length ? <IndicadorDeSincronizacao /> : null}
    </View>
  )
}
