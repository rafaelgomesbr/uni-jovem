import { useState } from 'react'

import type { Atribuicao, DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Texto } from '@/ui/Texto'
import { formatarHora } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import {
  AVISO_DE_RASCUNHO,
  FolhaDeConvocar,
  MenuDaPessoaConvocada,
  resumoDosConvocados,
} from './Convocacao'
import { CHIP_DO_ESTADO_DA_ATRIBUICAO } from './nomes'

/** Valor do parâmetro de etapa para a equipe do evento como um todo (sem etapa). */
export const EQUIPE_GERAL = 'geral'

/**
 * Pessoa convocada: avatar de 40, nome, função e o chip da resposta. Devolve
 * a própria `LinhaDeLista` (com a chave), para a `Lista` recuar o separador.
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
      rotuloAcessivel={`${atribuicao.nome}, ${atribuicao.funcao}. Convocação: ${chip.texto}`}
      {...(aoPressionar ? { aoPressionar, semSeta: true } : {})}
    />
  )
}

/**
 * Convocados (3.4.2, item 7): o resumo das respostas no topo, depois um
 * cartão lista por grupo (primeiro o evento todo e depois cada etapa), com
 * avatar, nome, função e o chip da resposta. Quem convoca tem "Convocar
 * pessoa" no rodapé de cada grupo, que abre a folha aqui mesmo, e toca na
 * pessoa para tirá-la da convocação. No rascunho, um aviso fixo lembra que
 * ninguém recebe nada antes de publicar.
 */
export function SecaoEquipe({
  evento,
  comunidadeId,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
}) {
  const pode = usePode()
  const atribuir = pode('escala', 'atribuir')
  // A folha guarda o último grupo aberto (a chave zera a escolha ao trocar de grupo).
  const [folha, setFolha] = useState<{ grupo: string; aberta: boolean }>({
    grupo: EQUIPE_GERAL,
    aberta: false,
  })
  const [escolhida, setEscolhida] = useState<Atribuicao | null>(null)
  const grupos = [
    { id: EQUIPE_GERAL, titulo: 'Encontro todo', etapaId: null as string | null },
    ...evento.etapas.map((e) => ({
      id: e.id,
      titulo: `${formatarHora(e.inicioPrevisto, evento.fuso)} · ${e.titulo}`,
      etapaId: e.id as string | null,
    })),
  ]
  const resumo = resumoDosConvocados(evento.atribuicoes)
  const abrirFolha = (grupo: string) => setFolha({ grupo, aberta: true })
  const etapaDaFolha = evento.etapas.find((e) => e.id === folha.grupo) ?? null

  return (
    <>
      {atribuir && evento.status === 'rascunho' ? (
        <Aviso tipo="info">{AVISO_DE_RASCUNHO}</Aviso>
      ) : null}
      {resumo ? (
        <Texto variante="corpo">{resumo}</Texto>
      ) : atribuir ? (
        <EstadoVazio
          icone="escalas"
          titulo="Ninguém convocado ainda"
          descricao="Convoque quem vai servir neste encontro."
          acao={{
            titulo: 'Convocar pessoa',
            icone: 'adicionar',
            aoPressionar: () => abrirFolha(EQUIPE_GERAL),
          }}
        />
      ) : null}
      {grupos.map((g) => {
        const pessoas = evento.atribuicoes.filter((a) => a.etapaId === g.etapaId)
        if (!atribuir && pessoas.length === 0) return null
        // Sem ninguém convocado, o estado vazio acima já é o grupo "Evento todo".
        if (!resumo && g.id === EQUIPE_GERAL) return null
        const acoes = atribuir ? (
          <Botao
            titulo="Convocar pessoa"
            icone="adicionar"
            variante="terciario"
            alinhado
            rotuloAcessivel={`Convocar pessoa: ${g.etapaId ? g.titulo : 'encontro todo'}`}
            aoPressionar={() => abrirFolha(g.id)}
          />
        ) : undefined
        return pessoas.length ? (
          <CartaoDeVidro key={g.id} lista sobrancelha={g.titulo} {...(acoes ? { acoes } : {})}>
            <Lista>
              {pessoas.map((a) =>
                linhaDaPessoaEscalada(a, atribuir ? () => setEscolhida(a) : undefined),
              )}
            </Lista>
          </CartaoDeVidro>
        ) : (
          <CartaoDeVidro key={g.id} sobrancelha={g.titulo} {...(acoes ? { acoes } : {})}>
            <Texto variante="corpo" cor="textoSuave">
              Ninguém convocado ainda.
            </Texto>
          </CartaoDeVidro>
        )
      })}
      {atribuir ? (
        <>
          <FolhaDeConvocar
            key={folha.grupo}
            evento={evento}
            etapa={etapaDaFolha}
            comunidadeId={comunidadeId}
            aberta={folha.aberta}
            aoFechar={() => setFolha((f) => ({ ...f, aberta: false }))}
          />
          <MenuDaPessoaConvocada
            evento={evento}
            comunidadeId={comunidadeId}
            escolhida={escolhida}
            aoFechar={() => setEscolhida(null)}
          />
        </>
      ) : null}
    </>
  )
}
