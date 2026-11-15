import { BORDA, ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { Fragment } from 'react'
import { Pressable, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { Aviso } from '@/servicos/contratoDosModulos'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { formatarData } from '@/utilidades/formatos'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Icone } from '@/ui/Icone'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { NOME_DO_ESTADO, useAvisos } from './consultas'

const novoAviso = () => router.push('/avisos/novo')

/**
 * Rota `/avisos` (3.7.4): título com "+" para quem publica; os fixados num
 * cartão lista com a sobrancelha "Fixados" e depois os recentes. "Fixado"
 * aparece uma vez só, na sobrancelha do grupo; o chip de rascunho ou fora do
 * ar é só para a organização.
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
  if (avisos.isPending) {
    return (
      <Esqueleto rotulo="Carregando os avisos">
        <CartaoDeEsqueleto titulo />
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (avisos.error) {
    return (
      <EstadoVazio
        icone={avisos.error instanceof SemConexao ? 'semConexao' : 'erro'}
        titulo="Não deu para carregar os avisos"
        descricao={mensagemDoErro(avisos.error)}
        acao={{ titulo: 'Tentar de novo', aoPressionar: () => void avisos.refetch() }}
      />
    )
  }
  if (avisos.data.length === 0) {
    return (
      <EstadoVazio
        icone="aviso"
        titulo="Nenhum aviso por enquanto"
        descricao={
          publica
            ? 'Escreva o primeiro aviso; ele pode ficar como rascunho até você publicar.'
            : 'Quando a organização publicar um aviso, ele aparece aqui e no Início.'
        }
        acao={
          publica
            ? { titulo: 'Novo aviso', icone: 'adicionar', aoPressionar: novoAviso }
            : { titulo: 'Voltar ao Início', icone: 'inicio', aoPressionar: () => router.push('/') }
        }
      />
    )
  }
  const fixados = avisos.data.filter((a) => a.fixado)
  const recentes = avisos.data.filter((a) => !a.fixado)
  return (
    <>
      {fixados.length ? <Grupo titulo="Fixados" avisos={fixados} mostrarEstado={publica} /> : null}
      {recentes.length ? (
        <Grupo titulo="Recentes" avisos={recentes} mostrarEstado={publica} />
      ) : null}
    </>
  )
}

function Grupo({
  titulo,
  avisos,
  mostrarEstado,
}: {
  titulo: string
  avisos: readonly Aviso[]
  mostrarEstado: boolean
}) {
  const { cores } = useTema()
  return (
    <Secao titulo={titulo}>
      <CartaoDeVidro intervalo={0} style={{ paddingVertical: ESPACO.e4 }}>
        {avisos.map((a, i) => (
          <Fragment key={a.id}>
            {i > 0 ? (
              <View style={{ height: BORDA.fina, backgroundColor: cores.separador }} />
            ) : null}
            <LinhaDoAviso aviso={a} mostrarEstado={mostrarEstado} />
          </Fragment>
        ))}
      </CartaoDeVidro>
    </Secao>
  )
}

/**
 * Linha do aviso: título em `tituloItem`, 2 linhas do texto em `corpo` suave
 * e a data em `legenda`. O chip de situação (rascunho, fora do ar) é só para
 * quem publica; publicado não tem chip.
 */
function LinhaDoAviso({ aviso, mostrarEstado }: { aviso: Aviso; mostrarEstado: boolean }) {
  const { cores } = useTema()
  const partes = [
    aviso.fixado ? 'Fixado' : null,
    mostrarEstado ? NOME_DO_ESTADO[aviso.estado] : null,
    aviso.publicadoEm ? `publicado em ${formatarData(aviso.publicadoEm)}` : null,
  ].filter(Boolean)
  const chip = mostrarEstado && aviso.estado !== 'publicado'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${aviso.titulo}. ${partes.join(', ')}`}
      onPress={() => router.push({ pathname: '/avisos/[avisoId]', params: { avisoId: aviso.id } })}
      style={({ pressed }) => ({
        gap: ESPACO.e4,
        paddingVertical: ESPACO.e12,
        // O pressionado sangra 12 para fora da coluna do cartão, como a linha de pessoa.
        marginHorizontal: -ESPACO.e12,
        paddingHorizontal: ESPACO.e12,
        borderRadius: RAIO.controle,
        backgroundColor: pressed ? cores.pressionado : 'transparent',
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
        <Texto variante="tituloItem" style={{ flex: 1 }}>
          {aviso.titulo}
        </Texto>
        {chip ? (
          <Chip
            texto={aviso.estado === 'rascunho' ? 'Rascunho' : 'Fora do ar'}
            tom={aviso.estado === 'rascunho' ? 'neutro' : 'alerta'}
          />
        ) : null}
        <Icone nome="avancar" cor={cores.textoSuave} tamanho={14} peso="semibold" />
      </View>
      <Texto variante="corpo" cor="textoSuave" numberOfLines={2}>
        {aviso.texto}
      </Texto>
      <Texto variante="meta" cor="textoSuave">
        {aviso.publicadoEm
          ? `Publicado em ${formatarData(aviso.publicadoEm)}`
          : 'Ainda não publicado'}
      </Texto>
    </Pressable>
  )
}
