import { ehEtapaDeLouvor, resumoDoRepertorio } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { useMeuRepertorio, useRepertorio } from './consultas'

/**
 * O repertório do louvor no Roteiro do encontro (D61): o resumo das músicas e
 * o caminho para a tela do repertório. Quem organiza o vê sempre que o
 * encontro tem a etapa do Louvor; os demais, só quando há músicas. Quem foi
 * convocado ao louvor ganha o atalho para o Meu repertório.
 */
export function CartaoDoRepertorioNoEncontro({
  evento,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  const pode = usePode()
  const edita = pode('etapa', 'gerenciar')
  const itens = useRepertorio(comunidadeId, evento.id)
  const meu = useMeuRepertorio(comunidadeId)
  const etapaDoLouvor = evento.etapas.find((e) => ehEtapaDeLouvor(e.titulo)) ?? null
  const euToco = (meu.data ?? []).some((e) => e.evento.id === evento.id)

  if (itens.error) {
    return (
      <AvisoDeFalha
        erro={itens.error}
        titulo="O repertório não carregou"
        aoTentarDeNovo={() => void itens.refetch()}
      />
    )
  }
  if (!itens.data) return null

  const total = itens.data.length
  const resumo = resumoDoRepertorio(itens.data, etapaDoLouvor?.duracaoMin ?? null)
  const aparece = total > 0 || euToco || (edita && etapaDoLouvor !== null)
  if (!aparece) return null

  const abrir = () =>
    router.push({ pathname: '/evento/[eventoId]/repertorio', params: { eventoId: evento.id } })

  return (
    <CartaoDeVidro
      sobrancelha="Repertório do louvor"
      acoes={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          <Botao
            titulo={total === 0 && edita ? 'Montar repertório' : 'Ver repertório'}
            variante={total === 0 && edita ? 'primario' : 'secundario'}
            icone="musica"
            aoPressionar={abrir}
          />
          {euToco ? (
            <Botao
              titulo="Meu repertório"
              variante="secundario"
              rotuloAcessivel="Abrir o meu repertório, no tom do dia"
              aoPressionar={() => router.push('/meu-repertorio')}
            />
          ) : null}
        </View>
      }
    >
      <Texto variante="corpo" cor={total === 0 ? 'textoSuave' : 'texto'}>
        {resumo.texto ||
          (edita
            ? 'Nenhuma música ainda. Escolha as músicas na biblioteca e defina o tom do dia.'
            : 'A organização ainda não montou o repertório.')}
      </Texto>
    </CartaoDeVidro>
  )
}
