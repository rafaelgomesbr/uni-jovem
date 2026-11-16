import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ModeloDaComunidade } from '@/servicos/contratoDosEventos'
import { Aviso } from '@/ui/Aviso'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { formatarDuracao } from '@/utilidades/datas'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { naComunidade, useModelos } from './consultas'

function resumo(etapas: readonly { duracaoMin: number }[]): string {
  const total = etapas.reduce((s, e) => s + e.duracaoMin, 0)
  return `${etapas.length} ${etapas.length === 1 ? 'etapa' : 'etapas'}, ${formatarDuracao(total)}`
}

const usar = (modelo: string) => router.push({ pathname: '/evento/novo', params: { modelo } })

/**
 * Rota `/modelos` (3.4.6): cartões lista com os modelos da comunidade
 * (criados a partir de um evento, em "Salvar como modelo") e os do app.
 * Tocar abre a folha com "Usar este modelo" e, para quem gerencia, "Apagar".
 */
export function TelaModelos() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  return (
    <Tela
      pilha
      titulo="Modelos"
      descricao="Pontos de partida para novos encontros. Para criar um, abra um encontro e use Salvar como modelo."
    >
      {!comunidadeAtiva ? (
        <SemComunidade oQue="os modelos" />
      ) : pode('modelo', 'ler') ? (
        <ModelosDaComunidade
          comunidadeId={comunidadeAtiva.id}
          gerencia={pode('modelo', 'gerenciar')}
        />
      ) : (
        <Aviso tipo="info" titulo="Só a organização usa os modelos">
          Organizadores e administradores montam encontros a partir deles.
        </Aviso>
      )}
    </Tela>
  )
}

function ModelosDaComunidade({
  comunidadeId,
  gerencia,
}: {
  comunidadeId: string
  gerencia: boolean
}) {
  const consultas = useQueryClient()
  const modelos = useModelos(comunidadeId, true)
  const [escolhido, setEscolhido] = useState<ModeloDaComunidade | null>(null)
  const apagar = useMutation({
    mutationFn: (m: ModeloDaComunidade) =>
      api.delete(`${naComunidade(comunidadeId)}/modelos/${m.id}`),
    onSuccess: async () => {
      mostrarToast({ texto: 'Modelo apagado.' })
      await consultas.invalidateQueries({ queryKey: CHAVES.modelos(comunidadeId) })
    },
  })

  async function pedirApagar(m: ModeloDaComunidade) {
    const ok = await confirmar({
      titulo: `Apagar o modelo ${m.nome}?`,
      mensagem: 'Os encontros criados com ele continuam iguais. Só o modelo some.',
      confirmar: 'Apagar modelo',
      destrutivo: true,
    })
    if (ok) apagar.mutate(m)
  }

  if (modelos.isPending) {
    return (
      <Esqueleto rotulo="Carregando os modelos">
        <CartaoDeEsqueleto />
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (modelos.error) {
    return <ErroDaTela erro={modelos.error} aoTentarDeNovo={() => void modelos.refetch()} />
  }
  const { embutidos, daComunidade } = modelos.data
  return (
    <>
      {apagar.error ? <AvisoDeFalha erro={apagar.error} titulo="O modelo não foi apagado" /> : null}
      <Secao titulo="Da comunidade">
        {daComunidade.length === 0 ? (
          <EstadoVazio
            icone="modelo"
            titulo="Nenhum modelo próprio"
            descricao="Abra um encontro que deu certo e use Salvar como modelo para repetir depois."
            acao={{
              titulo: 'Ver a agenda',
              variante: 'secundario',
              aoPressionar: () => router.push({ pathname: '/agenda', params: { vista: 'lista' } }),
            }}
          />
        ) : (
          <CartaoDeVidro lista>
            <Lista>
              {daComunidade.map((m) => (
                <LinhaDeLista
                  key={m.id}
                  icone="modelo"
                  titulo={m.nome}
                  descricao={[m.categoria, resumo(m.etapas)].join(' · ')}
                  semSeta
                  dica="Abre as opções do modelo."
                  aoPressionar={() => setEscolhido(m)}
                />
              ))}
            </Lista>
          </CartaoDeVidro>
        )}
      </Secao>
      <Secao titulo="Do app">
        <CartaoDeVidro lista>
          <Lista>
            {embutidos.map((m) => (
              <LinhaDeLista
                key={m.chave}
                icone="modelo"
                titulo={m.nome}
                descricao={`${resumo(m.etapas)}. Vem com o app.`}
                rotuloAcessivel={`${m.nome}. ${resumo(m.etapas)}. Usar este modelo`}
                aoPressionar={() => usar(m.chave)}
              />
            ))}
          </Lista>
        </CartaoDeVidro>
      </Secao>
      <MenuDeAcoes
        aberto={escolhido !== null}
        titulo={escolhido?.nome ?? 'Modelo'}
        aoFechar={() => setEscolhido(null)}
        acoes={
          escolhido
            ? [
                {
                  titulo: 'Usar este modelo',
                  icone: 'adicionar',
                  descricao: 'Novo encontro com as etapas dele',
                  navega: true,
                  aoPressionar: () => usar(escolhido.id),
                },
                gerencia && {
                  titulo: 'Apagar modelo',
                  icone: 'excluir',
                  destrutiva: true,
                  aoPressionar: () => void pedirApagar(escolhido),
                },
              ]
            : []
        }
      />
    </>
  )
}
