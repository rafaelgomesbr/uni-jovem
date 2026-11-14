import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NOME_DO_PAPEL, PAPEIS, podeConcederPapel, type Papel } from '@uj/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { EstadoDoVinculo, Membro } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { useMembros } from './consultas'
import { NOME_DO_ESTADO_DO_VINCULO } from './nomes'
import { usePode } from './permissoes'

const DESCRICAO_DO_ESTADO: Readonly<Record<EstadoDoVinculo, string>> = {
  ativo: 'Participa normalmente.',
  desativado: 'Perde o acesso, mas pode ser reativado depois.',
  removido: 'Sai da comunidade. Para voltar, precisa de um convite novo.',
}

export function TelaMembro() {
  const { vinculoId } = useLocalSearchParams<{ vinculoId: string }>()
  const { comunidadeAtiva } = useSessao()
  const membros = useMembros(comunidadeAtiva?.id ?? null)
  const membro = membros.data?.find((m) => m.vinculoId === vinculoId)

  if (!comunidadeAtiva) return <Tela cabecalhoNativo>{null}</Tela>
  if (membros.isPending) {
    return (
      <Tela cabecalhoNativo>
        <Carregando />
      </Tela>
    )
  }
  if (membros.error) {
    return (
      <Tela cabecalhoNativo>
        <AvisoDeErro erro={membros.error} aoTentarDeNovo={() => void membros.refetch()} />
      </Tela>
    )
  }
  if (!membro) {
    return (
      <Tela cabecalhoNativo>
        <EstadoVazio
          icone="comunidade"
          titulo="Pessoa não encontrada"
          descricao="Ela pode ter saído da comunidade."
          acao={{ titulo: 'Voltar', aoPressionar: () => router.back() }}
        />
      </Tela>
    )
  }
  return (
    <EditarMembro
      membro={membro}
      comunidadeId={comunidadeAtiva.id}
      comunidade={comunidadeAtiva.nome}
      meuPapel={comunidadeAtiva.papel}
    />
  )
}

interface PropsDaEdicao {
  membro: Membro
  comunidadeId: string
  comunidade: string
  meuPapel: Papel
}

function EditarMembro({ membro, comunidadeId, comunidade, meuPapel }: PropsDaEdicao) {
  const pode = usePode()
  const consultas = useQueryClient()
  const [papel, setPapel] = useState<Papel>(membro.papel)
  const [estado, setEstado] = useState<EstadoDoVinculo>(membro.estado)
  const [oracao, setOracao] = useState(membro.designacoes.includes('equipe_oracao'))

  const mudou =
    papel !== membro.papel ||
    estado !== membro.estado ||
    oracao !== membro.designacoes.includes('equipe_oracao')

  const salvar = useMutation({
    mutationFn: () =>
      api.patch(`/api/v1/c/${comunidadeId}/membros/${membro.vinculoId}`, {
        ...(papel !== membro.papel ? { papel } : {}),
        ...(estado !== membro.estado ? { estado } : {}),
        ...(oracao !== membro.designacoes.includes('equipe_oracao')
          ? { equipeDeOracao: oracao }
          : {}),
      }),
    onSuccess: async () => {
      await consultas.invalidateQueries({ queryKey: CHAVES.membros(comunidadeId) })
      router.back()
    },
  })

  async function confirmarESalvar() {
    if (estado === 'removido' && membro.estado !== 'removido') {
      const ok = await confirmar({
        titulo: `Remover ${membro.nome} de ${comunidade}?`,
        mensagem: 'A pessoa perde o acesso. Para voltar, vai precisar de um convite novo.',
        confirmar: `Remover de ${comunidade}`,
        destrutivo: true,
      })
      if (!ok) return
    }
    salvar.mutate()
  }

  return (
    <Tela cabecalhoNativo titulo={membro.nome} descricao={`Em ${comunidade}`}>
      <Cartao>
        {pode('vinculo', 'alterar_papel') ? (
          <GrupoDeOpcoes
            rotulo="Papel"
            valor={papel}
            aoMudar={setPapel}
            opcoes={PAPEIS.map((p) => ({
              valor: p,
              rotulo: NOME_DO_PAPEL[p],
              desabilitada: !podeConcederPapel(meuPapel, p),
            }))}
          />
        ) : null}
        {pode('vinculo', 'desativar') ? (
          <GrupoDeOpcoes
            rotulo="Situação"
            valor={estado}
            aoMudar={setEstado}
            opcoes={(['ativo', 'desativado', 'removido'] as const).map((e) => ({
              valor: e,
              rotulo: NOME_DO_ESTADO_DO_VINCULO[e],
              descricao: DESCRICAO_DO_ESTADO[e],
            }))}
          />
        ) : null}
        {pode('vinculo', 'designar_equipe_oracao') ? (
          <CaixaDeMarcar
            rotulo="Equipe de oração"
            descricao="Vê os pedidos de oração enviados para a equipe."
            marcada={oracao}
            aoMudar={setOracao}
          />
        ) : null}
        {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
        <Botao
          titulo={`Salvar alterações em ${comunidade}`}
          aoPressionar={() => void confirmarESalvar()}
          carregando={salvar.isPending}
          desabilitado={!mudou}
          motivo="Nada foi alterado ainda."
        />
        <Texto variante="apoio" cor="textoSuave">
          A comunidade sempre precisa de pelo menos uma pessoa administradora ativa.
        </Texto>
      </Cartao>
    </Tela>
  )
}
