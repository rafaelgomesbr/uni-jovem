import { router, useLocalSearchParams } from 'expo-router'

import type { TipoDeConteudo } from '@/servicos/contratoDosModulos'
import { parametro } from '@/utilidades/parametros'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Linha } from '@/ui/Linha'
import { Segmentos } from '@/ui/Segmentos'
import { Selo } from '@/ui/Selo'

import { usePode } from '../comunidade/permissoes'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { useConteudos } from './consultas'
import { ehTipoDeConteudo, estaArquivado, TIPOS_DE_CONTEUDO, type DefinicaoDoTipo } from './tipos'

/** Rota `/conteudos?tipo=`: o tipo fica na URL para voltar ao mesmo lugar. */
export function TelaConteudos() {
  const doParametro = parametro(useLocalSearchParams<{ tipo?: string }>().tipo)
  const tipo: TipoDeConteudo = ehTipoDeConteudo(doParametro) ? doParametro : 'musicas'
  const pode = usePode()
  const gerencia = pode('conteudo', 'gerenciar')
  return (
    <TelaDaComunidade
      oQue="os conteúdos"
      titulo="Conteúdos"
      descricao={
        gerencia
          ? 'O repertório da comunidade: músicas e quem toca, músicos, palestrantes e dinâmicas.'
          : 'Músicas, músicos, palestrantes e dinâmicas da comunidade.'
      }
    >
      {(c) => (
        <>
          <Segmentos
            rotulo="Tipo de conteúdo"
            valor={tipo}
            aoMudar={(t) => router.setParams({ tipo: t })}
            segmentos={(Object.keys(TIPOS_DE_CONTEUDO) as TipoDeConteudo[]).map((t) => ({
              valor: t,
              rotulo: TIPOS_DE_CONTEUDO[t].plural,
              icone: TIPOS_DE_CONTEUDO[t].icone,
            }))}
          />
          <Lista key={tipo} comunidadeId={c.id} def={TIPOS_DE_CONTEUDO[tipo]} gerencia={gerencia} />
        </>
      )}
    </TelaDaComunidade>
  )
}

function descricaoDoItem(def: DefinicaoDoTipo, item: Record<string, unknown>): string {
  const partes: (string | null)[] = []
  switch (def.tipo) {
    case 'musicas': {
      const musicos = (item['musicos'] as { nome: string }[] | undefined) ?? []
      partes.push(
        item['artista'] ? String(item['artista']) : null,
        item['tom'] ? `tom ${String(item['tom'])}` : null,
        musicos.length
          ? `toca: ${musicos.map((m) => m.nome).join(', ')}`
          : 'ninguém escalado para tocar',
      )
      break
    }
    case 'musicos':
      partes.push(
        Array.isArray(item['instrumentos']) && item['instrumentos'].length
          ? (item['instrumentos'] as string[]).join(', ')
          : 'instrumentos não informados',
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
  if (estaArquivado(def, item)) partes.push(def.arquivo.selo)
  return partes.filter(Boolean).join(' · ')
}

function Lista({
  comunidadeId,
  def,
  gerencia,
}: {
  comunidadeId: string
  def: DefinicaoDoTipo
  gerencia: boolean
}) {
  const itens = useConteudos(comunidadeId, def.tipo)
  const novo = () => router.push({ pathname: '/conteudos/[tipo]/novo', params: { tipo: def.tipo } })

  return (
    <>
      {gerencia ? (
        <Botao titulo={`Adicionar ${def.singular}`} icone="adicionar" aoPressionar={novo} />
      ) : null}
      {itens.isPending ? (
        <Carregando texto={`Carregando ${def.plural.toLowerCase()}`} />
      ) : itens.error ? (
        <AvisoDeErro erro={itens.error} aoTentarDeNovo={() => void itens.refetch()} />
      ) : itens.data.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone={def.icone}
            titulo={`Nenhum${def.artigo === 'a' ? 'a' : ''} ${def.singular} cadastrad${def.artigo}`}
            descricao={
              gerencia
                ? `Cadastre ${def.artigo} primeir${def.artigo} ${def.singular} para a equipe consultar antes dos encontros.`
                : 'Quando a organização cadastrar, aparece aqui.'
            }
            {...(gerencia
              ? {
                  acao: {
                    titulo: `Adicionar ${def.singular}`,
                    icone: 'adicionar',
                    aoPressionar: novo,
                  },
                }
              : {})}
          />
        </Cartao>
      ) : (
        <Cartao>
          {itens.data.map((item) => {
            const registro = item as unknown as Record<string, unknown>
            return (
              <Linha
                key={item.id}
                icone={def.icone}
                titulo={String(registro[def.principal] ?? '')}
                descricao={descricaoDoItem(def, registro)}
                {...(estaArquivado(def, registro)
                  ? { extra: <Selo texto={def.arquivo.selo} /> }
                  : {})}
                aoPressionar={() =>
                  router.push({
                    pathname: '/conteudos/[tipo]/[itemId]',
                    params: { tipo: def.tipo, itemId: item.id },
                  })
                }
              />
            )
          })}
        </Cartao>
      )}
    </>
  )
}
