import {
  agruparBanda,
  ehConvocacaoDeLouvor,
  resumoDaBanda,
  type EstadoDaConvocacao,
} from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

const TEXTO_DO_ESTADO: Readonly<Record<EstadoDaConvocacao, string>> = {
  confirmada: 'aceitou',
  pendente: 'aguardando',
  recusada: 'não pode',
  substituicao_pedida: 'pediu troca',
}

/** "Carla" de "Carla Menezes": a linha da banda é curta, o nome inteiro está no encontro. */
const primeiroNome = (nome: string | null | undefined) => (nome ?? 'Alguém').split(' ')[0]!

/**
 * A banda do encontro (D71): quem foi convocado ao louvor, agrupado por instrumento, com o que
 * ainda falta ("5 de 7 aceitaram. Falta: bateria"). Para quem monta o repertório saber, sem
 * perguntar, se o sábado do louvor está fechado. Só lê as convocações que o encontro já traz: a
 * convocação em si continua na seção Convocados do encontro. Cada função é escrita em texto, e o
 * que falta leva ícone e palavra, nunca só cor.
 */
export function BandaDoEncontro({
  evento,
  podeConvocar,
}: {
  evento: DetalheDoEvento
  /** Quem organiza vê o atalho para convocar quando a banda está vazia. */
  podeConvocar: boolean
}) {
  const { cores } = useTema()
  const titulos = new Map(evento.etapas.map((e) => [e.id, e.titulo]))
  const pessoas = evento.atribuicoes
    .filter((a) =>
      ehConvocacaoDeLouvor({
        funcao: a.funcao,
        etapaTitulo: a.etapaId ? (titulos.get(a.etapaId) ?? null) : null,
      }),
    )
    .map((a) => ({ funcao: a.funcao, estado: a.estado as EstadoDaConvocacao, nome: a.nome }))
  const irParaOEncontro = () =>
    router.push({ pathname: '/evento/[eventoId]', params: { eventoId: evento.id } })

  if (pessoas.length === 0) {
    if (!podeConvocar) return null
    return (
      <Cartao sobrancelha="Banda">
        <Texto variante="corpo" cor="textoSuave">
          Ninguém foi convocado ao louvor ainda. Convoque a banda no encontro para ver quem toca o
          quê.
        </Texto>
        <View style={{ flexDirection: 'row' }}>
          <Botao
            titulo="Convocar a banda"
            variante="secundario"
            tamanho="medio"
            aoPressionar={irParaOEncontro}
          />
        </View>
      </Cartao>
    )
  }

  const resumo = resumoDaBanda(pessoas)
  const grupos = agruparBanda(pessoas).filter((g) => g.pessoas.length > 0)
  const completa = resumo.faltam.length === 0 && pessoas.every((p) => p.estado === 'confirmada')

  return (
    <Cartao
      sobrancelha="Banda"
      extra={completa ? <Chip situacao="aceitou" texto="Banda completa" /> : undefined}
    >
      <View
        accessible
        accessibilityLabel={resumo.texto}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e8 }}
      >
        {resumo.faltam.length > 0 ? (
          <View style={{ paddingTop: ESPACO.e4 }}>
            <Icone nome="avisoAlerta" cor={cores.alerta} tamanho={18} />
          </View>
        ) : null}
        <Texto variante="tituloItem" style={{ flex: 1 }} accessibilityRole="text">
          {resumo.texto}
        </Texto>
      </View>
      <Lista>
        {grupos.map((g) => (
          <LinhaDeLista
            key={g.funcao}
            icone="musica"
            titulo={g.funcao}
            descricao={g.pessoas
              .map((p) => `${primeiroNome(p.nome)} (${TEXTO_DO_ESTADO[p.estado]})`)
              .join(', ')}
            extra={
              g.aceitaram > 0 ? (
                <Chip situacao="aceitou" texto={`${g.aceitaram} de ${g.pessoas.length}`} />
              ) : (
                <Chip situacao="aguardando" texto="Falta" icone="avisoAlerta" />
              )
            }
          />
        ))}
      </Lista>
      <View style={{ flexDirection: 'row' }}>
        <Botao
          titulo="Ver os convocados"
          variante="terciario"
          alinhado
          aoPressionar={irParaOEncontro}
        />
      </View>
    </Cartao>
  )
}
