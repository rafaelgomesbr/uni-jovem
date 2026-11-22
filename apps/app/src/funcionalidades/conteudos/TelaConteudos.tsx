import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { TipoDeConteudo } from '@/servicos/contratoDosModulos'
import { parametro } from '@/utilidades/parametros'
import { BotaoIcone } from '@/ui/Botao'
import { CampoDeBusca } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'

import { usePode } from '../comunidade/permissoes'
import { VazioComSol } from '../inscricoes/VazioComSol'
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
 * Rota `/conteudos?tipo=`, a Biblioteca (D71): título com "Nova" escrito (para quem gerencia),
 * segmentos do tipo (fica na URL para voltar ao mesmo lugar), busca e o cartão lista. Músicas,
 * músicos, palestrantes e dinâmicas da comunidade; a letra e a cifra ficam só dentro dela.
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
      titulo="Biblioteca"
      descricao={
        gerencia
          ? 'Músicas e cifras, músicos, palestrantes e dinâmicas da comunidade.'
          : 'Músicas, músicos, palestrantes e dinâmicas da comunidade.'
      }
      {...(comunidadeAtiva && gerencia
        ? {
            acoes: (
              <BotaoIcone
                icone="adicionar"
                texto="Nova"
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
        <SemComunidade oQue="a biblioteca" />
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
        <LinhaDeEsqueleto altura={56} />
        <LinhaDeEsqueleto altura={56} />
        <LinhaDeEsqueleto altura={56} />
        <LinhaDeEsqueleto altura={56} />
      </Esqueleto>
    )
  }
  if (itens.error) {
    return (
      <ErroDaTela
        erro={itens.error}
        titulo={`Não deu para carregar ${def.artigo === 'a' ? 'as' : 'os'} ${def.plural.toLowerCase()}`}
        aoTentarDeNovo={() => void itens.refetch()}
      />
    )
  }
  if (itens.data.length === 0) {
    return (
      <VazioComSol
        titulo={`Nenhum${def.artigo === 'a' ? 'a' : ''} ${def.singular} cadastrad${def.artigo}`}
        descricao={
          gerencia
            ? `Cadastre ${def.artigo} primeir${def.artigo} ${def.singular} para a equipe consultar antes dos encontros.`
            : 'Quando a organização cadastrar, aparece aqui.'
        }
        acao={
          gerencia
            ? { titulo: `Adicionar ${def.singular}`, icone: 'adicionar', aoPressionar: aoAdicionar }
            : undefined
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
        <VazioComSol
          titulo="Nada encontrado"
          descricao={`Nenhum${def.artigo === 'a' ? 'a' : ''} ${def.singular} com "${busca.trim()}". Confira a grafia ou limpe a busca.`}
          acao={{ titulo: 'Limpar a busca', aoPressionar: () => setBusca('') }}
        />
      ) : (
        <EntradaEmCascata ordem={1}>
          <Cartao lista>
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
                    rotuloAcessivel={[
                      nome,
                      descricao,
                      arquivado ? def.arquivo.selo : null,
                      def.tipo === 'musicas' && registro['temCifra'] === false ? 'Sem cifra' : null,
                    ]
                      .filter(Boolean)
                      .join('. ')}
                    {...(arquivado
                      ? { extra: <Chip texto={def.arquivo.selo} tom="neutro" /> }
                      : def.tipo === 'musicas' && registro['temCifra'] === false
                        ? { extra: <Chip texto="Sem cifra" tom="neutro" /> }
                        : {})}
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
          </Cartao>
        </EntradaEmCascata>
      )}
    </>
  )
}
