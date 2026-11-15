import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ModeloDaComunidade } from '@/servicos/contratoDosEventos'
import { confirmar } from '@/utilidades/confirmar'
import { formatarDuracao } from '@/utilidades/datas'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Texto } from '@/ui/Texto'

import { usePode } from '../comunidade/permissoes'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { naComunidade, useModelos } from './consultas'

function resumo(etapas: readonly { duracaoMin: number }[]): string {
  const total = etapas.reduce((s, e) => s + e.duracaoMin, 0)
  return `${etapas.length} ${etapas.length === 1 ? 'etapa' : 'etapas'}, ${formatarDuracao(total)}`
}

/** Rota `/modelos`: modelos da comunidade (criados a partir de um evento) e os do app. */
export function TelaModelos() {
  const pode = usePode()
  return (
    <TelaDaComunidade
      oQue="os modelos"
      titulo="Modelos de programação"
      descricao="Pontos de partida para novas programações. Para criar um, abra um evento e salve-o como modelo."
    >
      {(c) =>
        pode('modelo', 'ler') ? (
          <Lista comunidadeId={c.id} gerencia={pode('modelo', 'gerenciar')} />
        ) : (
          <Aviso tipo="alerta" titulo="Só a organização">
            Organizadores e administradores usam os modelos.
          </Aviso>
        )
      }
    </TelaDaComunidade>
  )
}

function Lista({ comunidadeId, gerencia }: { comunidadeId: string; gerencia: boolean }) {
  const modelos = useModelos(comunidadeId, true)
  if (modelos.isPending) return <Carregando texto="Carregando os modelos" />
  if (modelos.error) {
    return <AvisoDeErro erro={modelos.error} aoTentarDeNovo={() => void modelos.refetch()} />
  }
  const { embutidos, daComunidade } = modelos.data
  return (
    <>
      <Cartao titulo="Da comunidade" icone="modelo">
        {daComunidade.length === 0 ? (
          <EstadoVazio
            icone="modelo"
            titulo="Nenhum modelo próprio"
            descricao="Abra uma programação que deu certo e use “Salvar como modelo” para repetir depois."
            acao={{
              titulo: 'Ver as programações',
              icone: 'programacoes',
              aoPressionar: () => router.push('/programacoes'),
            }}
          />
        ) : (
          daComunidade.map((m) => (
            <ModeloDaLista key={m.id} comunidadeId={comunidadeId} modelo={m} gerencia={gerencia} />
          ))
        )}
      </Cartao>
      <Cartao titulo="Do app" icone="modelo">
        {embutidos.map((m) => (
          <View key={m.chave} style={{ gap: ESPACO.e4 }}>
            <Texto variante="tituloItem">{m.nome}</Texto>
            <Texto variante="legenda" cor="textoSuave">
              {resumo(m.etapas)}. Já vem com o app e não pode ser apagado.
            </Texto>
          </View>
        ))}
      </Cartao>
    </>
  )
}

function ModeloDaLista({
  comunidadeId,
  modelo,
  gerencia,
}: {
  comunidadeId: string
  modelo: ModeloDaComunidade
  gerencia: boolean
}) {
  const consultas = useQueryClient()
  const apagar = useMutation({
    mutationFn: () => api.delete(`${naComunidade(comunidadeId)}/modelos/${modelo.id}`),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.modelos(comunidadeId) }),
  })

  async function pedir() {
    const ok = await confirmar({
      titulo: `Apagar o modelo ${modelo.nome}?`,
      mensagem: 'As programações criadas com ele continuam iguais. Só o modelo some.',
      confirmar: 'Apagar modelo',
      destrutivo: true,
    })
    if (ok) apagar.mutate()
  }

  return (
    <View style={{ gap: ESPACO.e4 }}>
      <Texto variante="tituloItem">{modelo.nome}</Texto>
      <Texto variante="legenda" cor="textoSuave">
        {[modelo.categoria, resumo(modelo.etapas)].join(' · ')}
      </Texto>
      {apagar.error ? <AvisoDeErro erro={apagar.error} /> : null}
      {gerencia ? (
        <Botao
          titulo="Apagar"
          icone="excluir"
          variante="terciario"
          larguraTotal={false}
          rotuloAcessivel={`Apagar o modelo ${modelo.nome}`}
          carregando={apagar.isPending}
          aoPressionar={() => void pedir()}
        />
      ) : null}
    </View>
  )
}
