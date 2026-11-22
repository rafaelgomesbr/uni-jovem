import { Redirect, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { Lista } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { parametro } from '@/utilidades/parametros'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useEvento } from './consultas'
import { AVISO_DE_RASCUNHO, FolhaDeConvocar, useTirarDaConvocacao } from './Convocacao'
import { useConvocadosEmEspera, useRemovidasEmEspera } from './convocadosOtimistas'
import { montarQuemVai, type PessoaNaLista } from './listaDeQuemVai'
import { EQUIPE_GERAL, LinhaDaPessoaNaEquipe } from './QuemVai'

export { EQUIPE_GERAL }

/**
 * Rota `/evento/[eventoId]/etapa/[etapaId]`. Desde a D78 a etapa vive no acordeão do Roteiro, na
 * página do encontro (editar, subir, descer, chamar gente, remover): o link de uma etapa só leva
 * para lá. Com `etapaId = geral` a rota segue sendo a equipe do encontro inteiro (quem ajuda sem
 * ser de uma etapa).
 */
export function TelaEtapa() {
  const { comunidadeAtiva } = useSessao()
  const params = useLocalSearchParams<{ eventoId: string; etapaId: string }>()
  const eventoId = parametro(params.eventoId)
  const etapaId = parametro(params.etapaId)
  const evento = useEvento(comunidadeAtiva?.id ?? null, etapaId === EQUIPE_GERAL ? eventoId : null)

  if (!comunidadeAtiva || !eventoId || !etapaId) {
    return (
      <Tela pilha>
        <SemComunidade oQue="o encontro" />
      </Tela>
    )
  }
  if (etapaId !== EQUIPE_GERAL) {
    return (
      <Redirect href={{ pathname: '/evento/[eventoId]', params: { eventoId, aba: 'roteiro' } }} />
    )
  }
  if (evento.isPending) {
    return (
      <Tela pilha>
        <Esqueleto rotulo="Carregando a equipe">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (evento.error) {
    return (
      <Tela pilha>
        <ErroDaTela erro={evento.error} aoTentarDeNovo={() => void evento.refetch()} />
      </Tela>
    )
  }
  return (
    <Tela pilha titulo="Para o encontro inteiro" descricao={`Equipe de ${evento.data.titulo}`}>
      <Equipe evento={evento.data} comunidadeId={comunidadeAtiva.id} />
    </Tela>
  )
}

function Equipe({ evento, comunidadeId }: { evento: DetalheDoEvento; comunidadeId: string }) {
  const pode = usePode()
  const [convocando, setConvocando] = useState(false)
  const tirar = useTirarDaConvocacao(evento, comunidadeId)
  const emEspera = useConvocadosEmEspera(evento.id)
  const removidas = useRemovidasEmEspera()
  const atribuir = pode('escala', 'atribuir')
  const doEncontro = [
    ...evento.atribuicoes
      .filter((a) => !removidas.has(a.id))
      .map((a) => ({ ...a, emEspera: false })),
    ...emEspera.map((c) => ({
      id: c.chave,
      etapaId: c.etapaId,
      vinculoId: c.vinculoId,
      funcao: c.funcao,
      estado: 'pendente' as const,
      nome: c.nome,
      emEspera: true,
    })),
  ].filter((a) => a.etapaId === null)
  // Uma linha por pessoa, com todos os papéis dela.
  const { banda, equipe } = montarQuemVai(doEncontro, evento.etapas)
  const pessoas: PessoaNaLista[] = [...banda, ...equipe]

  const convocar = atribuir ? (
    <Botao
      titulo="Chamar alguém"
      icone="adicionar"
      variante="terciario"
      alinhado
      aoPressionar={() => setConvocando(true)}
    />
  ) : undefined

  return (
    <>
      {atribuir && evento.status === 'rascunho' ? (
        <Aviso tipo="info">{AVISO_DE_RASCUNHO}</Aviso>
      ) : null}
      {pessoas.length ? (
        <CartaoDeVidro sobrancelha="Quem vai" lista {...(convocar ? { acoes: convocar } : {})}>
          <Lista>
            {pessoas.map((p) => (
              <LinhaDaPessoaNaEquipe
                key={p.vinculoId}
                pessoa={p}
                aoTirar={atribuir ? () => tirar(p, p.papeis) : undefined}
              />
            ))}
          </Lista>
        </CartaoDeVidro>
      ) : (
        <CartaoDeVidro sobrancelha="Quem vai" {...(convocar ? { acoes: convocar } : {})}>
          <Texto variante="corpo" cor="textoSuave">
            Ninguém foi convocado ainda.
          </Texto>
        </CartaoDeVidro>
      )}
      {atribuir ? (
        <FolhaDeConvocar
          evento={evento}
          etapa={null}
          comunidadeId={comunidadeId}
          aberta={convocando}
          aoFechar={() => setConvocando(false)}
        />
      ) : null}
    </>
  )
}
