import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import type { Membro } from '@/servicos/contrato'
import { CampoDeBusca } from '@/ui/Campo'
import { BlocoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha } from '@/ui/Falha'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Texto } from '@/ui/Texto'

import { usePessoasAtivas } from './consultas'

const MAXIMO_VISIVEL = 8

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface PropsDoSeletor {
  comunidadeId: string
  rotulo: string
  valor: string | null
  aoMudar: (vinculoId: string | null) => void
  /** Oferece "Ninguém" como opção (responsável opcional). */
  permitirNinguem?: boolean
  /** Pessoas que não aparecem (ex.: quem já está na etapa, a própria pessoa). */
  excluir?: readonly string[]
  /** Observação por pessoa (ex.: "Indisponível neste dia"). */
  observacao?: (pessoa: Membro) => string | undefined
  /**
   * Motivo para a pessoa aparecer desabilitada (ex.: "Já convocado"). Ela
   * continua na lista, para ninguém achar que sumiu, mas não pode ser escolhida.
   */
  motivoDesabilitada?: (pessoa: Membro) => string | undefined
}

/**
 * Escolher uma pessoa da comunidade: campo de busca de 48 e a lista de
 * opções (papel `radio`), com a observação de cada pessoa na descrição.
 * Funciona igual com teclado, leitor de tela e toque.
 */
export function SeletorDePessoa({
  comunidadeId,
  rotulo,
  valor,
  aoMudar,
  permitirNinguem = false,
  excluir = [],
  observacao,
  motivoDesabilitada,
}: PropsDoSeletor) {
  const [busca, setBusca] = useState('')
  const { pessoas, isPending, error, refetch } = usePessoasAtivas(comunidadeId)

  if (isPending) {
    return (
      <Esqueleto rotulo="Carregando as pessoas">
        <BlocoDeEsqueleto altura={ESPACO.e40} />
        <BlocoDeEsqueleto altura={ESPACO.e40} largura="72%" />
      </Esqueleto>
    )
  }
  if (error) {
    return (
      <AvisoDeFalha
        erro={error}
        titulo="As pessoas não carregaram"
        aoTentarDeNovo={() => void refetch()}
      />
    )
  }

  const termo = semAcento(busca.trim())
  const candidatas = pessoas.filter(
    (p) => !excluir.includes(p.vinculoId) && (!termo || semAcento(p.nome).includes(termo)),
  )
  const escolhida = pessoas.find((p) => p.vinculoId === valor)
  // A escolhida continua visível mesmo fora do filtro, para não sumir da tela.
  const visiveis = candidatas.slice(0, MAXIMO_VISIVEL)
  if (escolhida && !visiveis.includes(escolhida)) visiveis.unshift(escolhida)

  const opcoes = [
    ...(permitirNinguem ? [{ valor: '', rotulo: 'Ninguém por enquanto' }] : []),
    ...visiveis.map((p) => {
      const motivo = motivoDesabilitada?.(p)
      const obs = motivo ?? observacao?.(p)
      return {
        valor: p.vinculoId,
        rotulo: p.nome,
        ...(obs ? { descricao: obs } : {}),
        ...(motivo ? { desabilitada: true } : {}),
      }
    }),
  ]

  return (
    <View style={{ gap: ESPACO.e8 }}>
      <CampoDeBusca
        rotulo={`Buscar pessoa (${rotulo.toLowerCase()})`}
        valor={busca}
        aoMudar={setBusca}
        autoCapitalize="words"
      />
      {candidatas.length > MAXIMO_VISIVEL ? (
        <Texto variante="legenda" cor="textoSuave">
          {`Mostrando ${MAXIMO_VISIVEL} de ${candidatas.length}. Digite parte do nome para achar outras pessoas.`}
        </Texto>
      ) : null}
      {opcoes.length === 0 ? (
        <Texto variante="corpo" cor="textoSuave">
          Ninguém encontrado com esse nome.
        </Texto>
      ) : (
        <ListaDeOpcoes
          rotulo={rotulo}
          valor={valor ?? (permitirNinguem ? '' : null)}
          aoMudar={(v) => aoMudar(v === '' ? null : v)}
          opcoes={opcoes}
        />
      )}
    </View>
  )
}
