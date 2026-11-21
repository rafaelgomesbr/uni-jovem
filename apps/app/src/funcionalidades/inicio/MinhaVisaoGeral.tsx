import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import type { ReactElement } from 'react'
import { View } from 'react-native'

import { Acordeao } from '@/ui/Acordeao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { Icone } from '@/ui/Icone'
import { Lista, RECUO_DA_LISTA, SubtituloDaLista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { usePode } from '../comunidade/permissoes'
import { LinhaDeNumero, plural } from './LinhaDeNumero'
import { useMinhaVisaoGeral, useVisaoGeralDaComunidade } from './visaoGeral'
import {
  LINHA_DOS_NUMEROS,
  linhasDaOrganizacao,
  type LinhaDoResumo,
} from './VisaoGeralDaComunidade'

/** O título do acordeão fechado: diz a única coisa que importa, em uma linha (D62). */
export function tituloDoResumo(quantidade: number): string {
  if (quantidade === 0) return 'Tudo em dia'
  return quantidade === 1 ? '1 coisa esperando você' : `${quantidade} coisas esperando você`
}

interface Props {
  comunidadeId: string
  /** Pedidos de substituição que a pessoa pode assumir (vêm do `/inicio`). */
  substituicoesAbertas: number
  /** O encontro da primeira tarefa aberta: é para onde "Concluir tarefas" leva. */
  eventoDaTarefa: string | null
}

/**
 * "Seu resumo" no Início (D62): um acordeão FECHADO por padrão, cujo título
 * diz o que espera a pessoa ("Tudo em dia", "1 coisa esperando você", "3 coisas
 * esperando você"). Aberto, só as linhas com valor, cada uma com o verbo e o
 * destino. Quem organiza vê dois grupos, "Para você" e "Da organização", e a
 * linha fixa "Ver os números e relatórios" (D59, Q1). Sem nada a fazer, "Tudo
 * em dia" é só um aviso, sem seta. Os números de presença, de inscrição e de
 * oração, e as convocações já aceitas, não entram: ninguém age sobre eles.
 * Se os números não carregam, o resto do Início segue e este bloco pede para
 * tentar de novo.
 */
export function MinhaVisaoGeral({
  comunidadeId,
  substituicoesAbertas,
  eventoDaTarefa,
}: Props): ReactElement | null {
  const pode = usePode()
  const organiza = pode('relatorio', 'ler')
  const minha = useMinhaVisaoGeral(comunidadeId)
  const organizacao = useVisaoGeralDaComunidade(comunidadeId, organiza)

  // Sem rede e sem nada carregado, o bloco simplesmente não aparece (o Início já avisa).
  if (minha.isPending && minha.fetchStatus === 'paused') return null
  if (
    minha.isPending ||
    (organiza && organizacao.isPending && organizacao.fetchStatus !== 'paused')
  ) {
    return (
      <Esqueleto rotulo="Carregando o seu resumo">
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (minha.error) {
    return (
      <AvisoDeFalha
        erro={minha.error}
        titulo="Não deu para carregar o seu resumo"
        aoTentarDeNovo={() => void minha.refetch()}
      />
    )
  }

  const d = minha.data
  const paraVoce: LinhaDoResumo[] = []
  if (d.convocacoesParaResponder > 0) {
    paraVoce.push({
      chave: 'responder',
      icone: 'abaEscalas',
      titulo: `Responder ${plural(d.convocacoesParaResponder, 'convocação', 'convocações')}`,
      destino: 'Escalas',
      aoPressionar: () => router.push('/escalas'),
    })
  }
  if (d.tarefasAbertas > 0) {
    paraVoce.push({
      chave: 'tarefas',
      icone: 'tarefas',
      titulo: `Concluir ${plural(d.tarefasAbertas, 'tarefa', 'tarefas')}`,
      destino: eventoDaTarefa ? 'o encontro' : 'Agenda',
      aoPressionar: () =>
        eventoDaTarefa
          ? router.push({ pathname: '/evento/[eventoId]', params: { eventoId: eventoDaTarefa } })
          : router.push('/agenda'),
    })
  }
  if (substituicoesAbertas > 0) {
    paraVoce.push({
      chave: 'substituicoes',
      icone: 'trocar',
      titulo: `Ver ${plural(substituicoesAbertas, 'pedido de substituição', 'pedidos de substituição')}`,
      destino: 'Escalas',
      aoPressionar: () => router.push('/escalas'),
    })
  }

  const daOrganizacao = organiza && organizacao.data ? linhasDaOrganizacao(organizacao.data) : []
  const numeros = organiza ? LINHA_DOS_NUMEROS : null

  const quantidade = paraVoce.length + daOrganizacao.length
  const titulo = tituloDoResumo(quantidade)

  // Nada a fazer e nada a abrir: só um recado, sem seta.
  if (quantidade === 0 && !numeros) return <TudoEmDia />

  const linha = (l: LinhaDoResumo) => (
    <LinhaDeNumero
      key={l.chave}
      icone={l.icone}
      titulo={l.titulo}
      destino={l.destino}
      aoPressionar={l.aoPressionar}
    />
  )

  return (
    <CartaoDeVidro lista>
      <Acordeao
        chave="resumo"
        recuo={RECUO_DA_LISTA.texto}
        rotuloRecolhido={`Seu resumo: ${titulo}. Recolhido, toque para ver.`}
        rotuloAberto={`Seu resumo: ${titulo}. Aberto, toque para recolher.`}
        cabecalho={() => <CabecalhoDoResumo titulo={titulo} />}
      >
        {organiza ? (
          <View>
            {paraVoce.length > 0 ? (
              <>
                <SubtituloDaLista texto="Para você" />
                <Lista>{paraVoce.map(linha)}</Lista>
              </>
            ) : null}
            <SubtituloDaLista texto="Da organização" />
            {organizacao.error ? (
              <View style={{ paddingHorizontal: RECUO_DA_LISTA.texto, paddingBottom: ESPACO.e12 }}>
                <AvisoDeFalha
                  erro={organizacao.error}
                  titulo="Não deu para carregar a visão da organização"
                  aoTentarDeNovo={() => void organizacao.refetch()}
                />
              </View>
            ) : null}
            <Lista>{[...daOrganizacao, ...(numeros ? [numeros] : [])].map(linha)}</Lista>
          </View>
        ) : (
          <Lista>{paraVoce.map(linha)}</Lista>
        )}
      </Acordeao>
    </CartaoDeVidro>
  )
}

function CabecalhoDoResumo({ titulo }: { titulo: string }) {
  return (
    <View style={{ paddingVertical: ESPACO.e4 }}>
      <Texto variante="sobrancelha" accessibilityRole="text">
        Seu resumo
      </Texto>
      <Texto variante="tituloItem" accessibilityRole="text">
        {titulo}
      </Texto>
    </View>
  )
}

/** Nada esperando a pessoa: o recado é só um aviso, sem seta e sem abrir. */
function TudoEmDia() {
  const { cores } = useTema()
  return (
    <CartaoDeVidro>
      <View
        accessible
        accessibilityLabel="Seu resumo: Tudo em dia"
        style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}
      >
        <View style={{ flex: 1 }}>
          <Texto variante="sobrancelha" accessibilityRole="text">
            Seu resumo
          </Texto>
          <Texto variante="tituloItem" accessibilityRole="text">
            {tituloDoResumo(0)}
          </Texto>
        </View>
        <Icone nome="confirmado" cor={cores.sucesso} tamanho={22} />
      </View>
    </CartaoDeVidro>
  )
}
