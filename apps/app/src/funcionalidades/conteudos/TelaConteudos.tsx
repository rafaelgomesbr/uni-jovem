import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { TipoDeConteudo } from '@/servicos/contratoDosModulos'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { parametro } from '@/utilidades/parametros'
import { BotaoIcone } from '@/ui/Botao'
import { CampoDeBusca } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useConteudos } from './consultas'
import { ehTipoDeConteudo, estaArquivado, TIPOS_DE_CONTEUDO, type DefinicaoDoTipo } from './tipos'

/** Pessoas aparecem com avatar; músicas e dinâmicas, com o ladrilho do tipo. */
const DE_PESSOA: Readonly<Record<TipoDeConteudo, boolean>> = {
  musicas: false,
  musicos: true,
  palestrantes: true,
  dinamicas: false,
}

/**
 * Rota `/conteudos?tipo=` (3.7.3): título com "+" (para quem gerencia),
 * segmentos do tipo (fica na URL para voltar ao mesmo lugar), busca e o
 * cartão lista.
 */
export function TelaConteudos() {
  const doParametro = parametro(useLocalSearchParams<{ tipo?: string }>().tipo)
  const tipo: TipoDeConteudo = ehTipoDeConteudo(doParametro) ? doParametro : 'musicas'
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const gerencia = pode('conteudo', 'gerenciar')
  const def = TIPOS_DE_CONTEUDO[tipo]
  const novo = () => router.push({ pathname: '/conteudos/[tipo]/novo', params: { tipo } })
  return (
    <Tela
      pilha
      titulo="Conteúdos"
      descricao={
        gerencia
          ? 'O repertório da comunidade: músicas e quem toca, músicos, palestrantes e dinâmicas.'
          : 'Músicas, músicos, palestrantes e dinâmicas da comunidade.'
      }
      {...(comunidadeAtiva && gerencia
        ? {
            acoes: (
              <BotaoIcone
                icone="adicionar"
                rotulo={`Adicionar ${def.singular}`}
                circular
                aoPressionar={novo}
              />
            ),
          }
        : {})}
    >
      {comunidadeAtiva ? (
        <>
          <Segmentos
            rotulo="Tipo de conteúdo"
            valor={tipo}
            aoMudar={(t) => router.setParams({ tipo: t })}
            segmentos={(Object.keys(TIPOS_DE_CONTEUDO) as TipoDeConteudo[]).map((t) => ({
              valor: t,
              rotulo: TIPOS_DE_CONTEUDO[t].plural,
            }))}
          />
          <ListaDoTipo
            key={tipo}
            comunidadeId={comunidadeAtiva.id}
            def={def}
            gerencia={gerencia}
            aoAdicionar={novo}
          />
        </>
      ) : (
        <SemComunidade oQue="os conteúdos" />
      )}
    </Tela>
  )
}

function descricaoDoItem(def: DefinicaoDoTipo, item: Record<string, unknown>): string {
  const partes: (string | null)[] = []
  switch (def.tipo) {
    case 'musicas': {
      const musicos = (item['musicos'] as { nome: string }[] | undefined) ?? []
      partes.push(
        item['tom'] ? `Tom ${String(item['tom'])}` : null,
        item['artista'] ? String(item['artista']) : null,
        musicos.length ? musicos.map((m) => m.nome).join(', ') : 'Ninguém escalado para tocar',
      )
      break
    }
    case 'musicos':
      partes.push(
        Array.isArray(item['instrumentos']) && item['instrumentos'].length
          ? (item['instrumentos'] as string[]).join(', ')
          : 'Instrumentos não informados',
      )
      break
    case 'palestrantes':
      partes.push(
        item['temas'] ? String(item['temas']) : null,
        item['origem'] ? String(item['origem']) : null,
      )
      break
    case 'dinamicas':
      partes.push(
        item['objetivo'] ? String(item['objetivo']) : null,
        item['duracaoMin'] ? `${String(item['duracaoMin'])} min` : null,
      )
      break
  }
  return partes.filter(Boolean).join(' · ')
}

/** Busca sem acento e sem caixa: "musica" acha "Música". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function ListaDoTipo({
  comunidadeId,
  def,
  gerencia,
  aoAdicionar,
}: {
  comunidadeId: string
  def: DefinicaoDoTipo
  gerencia: boolean
  aoAdicionar: () => void
}) {
  const itens = useConteudos(comunidadeId, def.tipo)
  const [busca, setBusca] = useState('')
  const termo = normalizar(busca.trim())

  if (itens.isPending) {
    return (
      <Esqueleto rotulo={`Carregando ${def.plural.toLowerCase()}`}>
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (itens.error) {
    return (
      <EstadoVazio
        icone={itens.error instanceof SemConexao ? 'semConexao' : 'erro'}
        titulo={`Não deu para carregar ${def.artigo === 'a' ? 'as' : 'os'} ${def.plural.toLowerCase()}`}
        descricao={mensagemDoErro(itens.error)}
        acao={{ titulo: 'Tentar de novo', aoPressionar: () => void itens.refetch() }}
      />
    )
  }
  if (itens.data.length === 0) {
    return (
      <EstadoVazio
        icone={def.icone}
        titulo={`Nenhum${def.artigo === 'a' ? 'a' : ''} ${def.singular} cadastrad${def.artigo}`}
        descricao={
          gerencia
            ? `Cadastre ${def.artigo} primeir${def.artigo} ${def.singular} para a equipe consultar antes dos encontros.`
            : 'Quando a organização cadastrar, aparece aqui.'
        }
        acao={
          gerencia
            ? { titulo: `Adicionar ${def.singular}`, icone: 'adicionar', aoPressionar: aoAdicionar }
            : { titulo: 'Voltar ao Início', aoPressionar: () => router.push('/') }
        }
      />
    )
  }

  const registros = itens.data.map((item) => item as unknown as Record<string, unknown>)
  const visiveis = termo
    ? registros.filter((r) =>
        normalizar(`${String(r[def.principal] ?? '')} ${descricaoDoItem(def, r)}`).includes(termo),
      )
    : registros

  return (
    <>
      <CampoDeBusca
        rotulo={`Buscar em ${def.plural.toLowerCase()}`}
        valor={busca}
        aoMudar={setBusca}
      />
      {visiveis.length === 0 ? (
        <EstadoVazio
          icone="buscar"
          titulo="Nada encontrado"
          descricao={`Nenhum${def.artigo === 'a' ? 'a' : ''} ${def.singular} com "${busca.trim()}". Confira a grafia ou limpe a busca.`}
          acao={{
            titulo: 'Limpar a busca',
            variante: 'secundario',
            aoPressionar: () => setBusca(''),
          }}
        />
      ) : (
        <CartaoDeVidro lista>
          <Lista>
            {visiveis.map((registro) => {
              const nome = String(registro[def.principal] ?? '')
              const arquivado = estaArquivado(def, registro)
              const descricao = descricaoDoItem(def, registro)
              return (
                <LinhaDeLista
                  key={String(registro['id'])}
                  {...(DE_PESSOA[def.tipo] ? { avatar: { nome } } : { icone: def.icone })}
                  titulo={nome}
                  descricao={descricao}
                  rotuloAcessivel={[nome, descricao, arquivado ? def.arquivo.selo : null]
                    .filter(Boolean)
                    .join('. ')}
                  {...(arquivado ? { extra: <Chip texto={def.arquivo.selo} tom="neutro" /> } : {})}
                  aoPressionar={() =>
                    router.push({
                      pathname: '/conteudos/[tipo]/[itemId]',
                      params: { tipo: def.tipo, itemId: String(registro['id']) },
                    })
                  }
                />
              )
            })}
          </Lista>
        </CartaoDeVidro>
      )}
    </>
  )
}
