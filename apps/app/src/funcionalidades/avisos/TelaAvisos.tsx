import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import type { Aviso } from '@/servicos/contratoDosModulos'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'

import { dataRelativa } from '../comunidade/datasRelativas'
import { usePode } from '../comunidade/permissoes'
import { VazioComSol } from '../comunidade/VazioComSol'
import { SemComunidade } from '../navegacao/SemComunidade'
import { NOME_DO_ESTADO, useAvisos, usePessoasAAvisar } from './consultas'

const novoAviso = () => router.push('/avisos/novo')

/**
 * Rota `/avisos` (D70): os fixados num cartão lista com a sobrancelha "Fixados" e depois os
 * recentes, cada um com a data relativa ("há 2 dias"). Quem publica vê também os rascunhos,
 * com "Vai avisar N pessoas" e o chip da situação (texto, nunca só cor); o botão "Novo
 * aviso" fica no cabeçalho.
 */
export function TelaAvisos() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const publica = pode('aviso', 'publicar')
  return (
    <Tela
      pilha
      titulo="Avisos"
      descricao={
        publica
          ? 'Escreva, publique, fixe no topo ou tire do ar. Rascunhos só a organização vê.'
          : 'Recados da organização da comunidade. Os fixados ficam no topo.'
      }
      {...(comunidadeAtiva && publica
        ? {
            acoes: (
              <Botao
                titulo="Novo aviso"
                icone="adicionar"
                variante="secundario"
                aoPressionar={novoAviso}
              />
            ),
          }
        : {})}
    >
      {comunidadeAtiva ? (
        <ListaDeAvisos comunidadeId={comunidadeAtiva.id} publica={publica} />
      ) : (
        <SemComunidade oQue="os avisos" />
      )}
    </Tela>
  )
}

function ListaDeAvisos({ comunidadeId, publica }: { comunidadeId: string; publica: boolean }) {
  const avisos = useAvisos(comunidadeId)
  const aAvisar = usePessoasAAvisar(comunidadeId)
  if (avisos.isPending) {
    return (
      <Esqueleto rotulo="Carregando os avisos">
        <LinhaDeEsqueleto altura={72} />
        <LinhaDeEsqueleto altura={72} />
        <LinhaDeEsqueleto altura={72} />
      </Esqueleto>
    )
  }
  if (avisos.error) {
    return (
      <ErroDaTela
        erro={avisos.error}
        oQue="os avisos"
        aoTentarDeNovo={() => void avisos.refetch()}
      />
    )
  }
  if (avisos.data.length === 0) {
    return (
      <VazioComSol
        titulo="Nenhum aviso por enquanto."
        descricao={publica ? 'Escreva o primeiro aviso.' : 'Os avisos da liderança aparecem aqui.'}
        {...(publica
          ? { acao: { titulo: 'Novo aviso', icone: 'adicionar' as const, aoPressionar: novoAviso } }
          : {})}
      />
    )
  }
  const fixados = avisos.data.filter((a) => a.fixado)
  const recentes = avisos.data.filter((a) => !a.fixado)
  return (
    <>
      {fixados.length ? (
        <Grupo titulo="Fixados" avisos={fixados} mostrarEstado={publica} aAvisar={aAvisar} />
      ) : null}
      {recentes.length ? (
        <Grupo titulo="Recentes" avisos={recentes} mostrarEstado={publica} aAvisar={aAvisar} />
      ) : null}
    </>
  )
}

function Grupo({
  titulo,
  avisos,
  mostrarEstado,
  aAvisar,
}: {
  titulo: string
  avisos: readonly Aviso[]
  mostrarEstado: boolean
  aAvisar: number | null
}) {
  return (
    <Secao titulo={titulo}>
      <Cartao lista>
        <Lista>
          {avisos.map((a) => (
            <LinhaDoAviso key={a.id} aviso={a} mostrarEstado={mostrarEstado} aAvisar={aAvisar} />
          ))}
        </Lista>
      </Cartao>
    </Secao>
  )
}

/**
 * O que a linha diz abaixo do título: "há 2 dias" no publicado; "Vai avisar 11 pessoas" no
 * rascunho (a organização sabe o que o botão fará); "Fora do ar" no despublicado.
 */
export function descricaoDoAviso(aviso: Aviso, aAvisar: number | null, agora = new Date()): string {
  if (aviso.estado === 'rascunho') {
    return aAvisar
      ? `Vai avisar ${aAvisar} ${aAvisar === 1 ? 'pessoa' : 'pessoas'} ao publicar`
      : 'Ainda não publicado'
  }
  if (aviso.estado === 'despublicado') return 'Fora do ar para os membros'
  return aviso.publicadoEm ? `Publicado ${dataRelativa(aviso.publicadoEm, agora)}` : ''
}

function LinhaDoAviso({
  aviso,
  mostrarEstado,
  aAvisar,
}: {
  aviso: Aviso
  mostrarEstado: boolean
  aAvisar: number | null
}) {
  const descricao = descricaoDoAviso(aviso, aAvisar)
  const partes = [
    aviso.fixado ? 'Fixado' : null,
    mostrarEstado ? NOME_DO_ESTADO[aviso.estado] : null,
    descricao,
  ].filter(Boolean)
  const chip = mostrarEstado && aviso.estado !== 'publicado'
  return (
    <LinhaDeLista
      variante="checkin"
      icone={aviso.fixado ? 'fixar' : 'aviso'}
      titulo={aviso.titulo}
      descricao={descricao}
      rotuloAcessivel={`${aviso.titulo}. ${partes.join(', ')}`}
      {...(chip
        ? {
            extra: (
              <Chip
                texto={aviso.estado === 'rascunho' ? 'Rascunho' : 'Fora do ar'}
                tom={aviso.estado === 'rascunho' ? 'neutro' : 'alerta'}
              />
            ),
          }
        : {})}
      aoPressionar={() =>
        router.push({ pathname: '/avisos/[avisoId]', params: { avisoId: aviso.id } })
      }
    />
  )
}
