import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import type { Membro } from '@/servicos/contrato'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
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
}

/**
 * Escolher uma pessoa da comunidade: busca por nome e lista curta de opções
 * (papel `radio`). Funciona igual com teclado, leitor de tela e toque.
 */
export function SeletorDePessoa({
  comunidadeId,
  rotulo,
  valor,
  aoMudar,
  permitirNinguem = false,
  excluir = [],
  observacao,
}: PropsDoSeletor) {
  const [busca, setBusca] = useState('')
  const { pessoas, isPending, error, refetch } = usePessoasAtivas(comunidadeId)

  if (isPending) return <Carregando texto="Carregando as pessoas" />
  if (error) return <AvisoDeErro erro={error} aoTentarDeNovo={() => void refetch()} />

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
      const obs = observacao?.(p)
      return { valor: p.vinculoId, rotulo: p.nome, ...(obs ? { descricao: obs } : {}) }
    }),
  ]

  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Campo
        rotulo={`Buscar pessoa (${rotulo.toLowerCase()})`}
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="words"
        autoCorrect={false}
        exemplo="Digite parte do nome"
      />
      {candidatas.length > MAXIMO_VISIVEL ? (
        <Texto variante="legenda" cor="textoSuave">
          Mostrando {MAXIMO_VISIVEL} de {candidatas.length}. Digite parte do nome para achar outras
          pessoas.
        </Texto>
      ) : null}
      {opcoes.length === 0 ? (
        <Texto variante="legenda" cor="textoSuave">
          Ninguém encontrado com esse nome.
        </Texto>
      ) : (
        <GrupoDeOpcoes
          rotulo={rotulo}
          valor={valor ?? (permitirNinguem ? '' : null)}
          aoMudar={(v) => aoMudar(v === '' ? null : v)}
          opcoes={opcoes}
        />
      )}
    </View>
  )
}
