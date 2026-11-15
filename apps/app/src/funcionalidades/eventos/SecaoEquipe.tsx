import { router } from 'expo-router'

import type { Atribuicao, DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { formatarHora } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import { CHIP_DO_ESTADO_DA_ATRIBUICAO } from './nomes'

/** Valor do parâmetro de etapa para a equipe do evento como um todo (sem etapa). */
export const EQUIPE_GERAL = 'geral'

/**
 * Pessoa escalada: avatar de 40, nome, função e o chip da escala. Devolve a
 * própria `LinhaDeLista` (com a chave), para a `Lista` recuar o separador.
 */
export function linhaDaPessoaEscalada(atribuicao: Atribuicao, aoPressionar?: () => void) {
  const chip = CHIP_DO_ESTADO_DA_ATRIBUICAO[atribuicao.estado]
  return (
    <LinhaDeLista
      key={atribuicao.id}
      avatar={{ nome: atribuicao.nome }}
      titulo={atribuicao.nome}
      descricao={atribuicao.funcao}
      extra={<Chip texto={chip.texto} tom={chip.tom} />}
      rotuloAcessivel={`${atribuicao.nome}, ${atribuicao.funcao}. Escala: ${chip.texto}`}
      {...(aoPressionar ? { aoPressionar, semSeta: true } : {})}
    />
  )
}

/**
 * Equipe (3.4.2, item 7): um cartão lista por grupo, primeiro o evento todo
 * e depois cada etapa, com avatar, nome, função e o chip da escala. Quem
 * escala tem "Escalar pessoa" no rodapé de cada grupo; grupo vazio é uma
 * linha só.
 */
export function SecaoEquipe({ evento }: { evento: DetalheDoEvento }) {
  const pode = usePode()
  const atribuir = pode('escala', 'atribuir')
  const grupos = [
    { id: EQUIPE_GERAL, titulo: 'Evento todo', etapaId: null as string | null },
    ...evento.etapas.map((e) => ({
      id: e.id,
      titulo: `${formatarHora(e.inicioPrevisto, evento.fuso)} · ${e.titulo}`,
      etapaId: e.id as string | null,
    })),
  ]
  return (
    <>
      {grupos.map((g) => {
        const pessoas = evento.atribuicoes.filter((a) => a.etapaId === g.etapaId)
        if (!atribuir && pessoas.length === 0) return null
        const acoes = atribuir ? (
          <Botao
            titulo="Escalar pessoa"
            icone="adicionar"
            variante="terciario"
            alinhado
            rotuloAcessivel={`Escalar pessoa: ${g.etapaId ? g.titulo : 'evento todo'}`}
            aoPressionar={() =>
              router.push({
                pathname: '/evento/[eventoId]/etapa/[etapaId]',
                params: { eventoId: evento.id, etapaId: g.id },
              })
            }
          />
        ) : undefined
        return pessoas.length ? (
          <CartaoDeVidro key={g.id} lista sobrancelha={g.titulo} {...(acoes ? { acoes } : {})}>
            <Lista>{pessoas.map((a) => linhaDaPessoaEscalada(a))}</Lista>
          </CartaoDeVidro>
        ) : (
          <CartaoDeVidro key={g.id} sobrancelha={g.titulo} {...(acoes ? { acoes } : {})}>
            <Texto variante="corpo" cor="textoSuave">
              Ninguém escalado ainda.
            </Texto>
          </CartaoDeVidro>
        )
      })}
    </>
  )
}
