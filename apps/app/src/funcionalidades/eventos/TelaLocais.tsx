import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { Local } from '@/servicos/contratoDosEventos'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { usePode } from '../comunidade/permissoes'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { naComunidade, useInvalidarEventos, useLocais } from './consultas'

function descrever(l: Local): string {
  return [
    l.tipo === 'interno' ? 'Local interno' : (l.endereco ?? 'Local externo'),
    l.referencia,
    l.arquivado ? 'Arquivado' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Rota `/locais`: locais da comunidade (novos são criados no formulário do evento). */
export function TelaLocais() {
  const pode = usePode()
  return (
    <TelaDaComunidade
      oQue="os locais"
      titulo="Locais"
      descricao="Onde os encontros acontecem. Arquivar tira o local da escolha de novos eventos sem mexer nos antigos."
    >
      {(c) =>
        pode('evento', 'editar') ? (
          <Lista comunidadeId={c.id} />
        ) : (
          <Aviso tipo="alerta" titulo="Só a organização">
            Organizadores e administradores cuidam dos locais.
          </Aviso>
        )
      }
    </TelaDaComunidade>
  )
}

function Lista({ comunidadeId }: { comunidadeId: string }) {
  const locais = useLocais(comunidadeId)
  if (locais.isPending) return <Carregando texto="Carregando os locais" />
  if (locais.error) {
    return <AvisoDeErro erro={locais.error} aoTentarDeNovo={() => void locais.refetch()} />
  }
  if (locais.data.length === 0) {
    return (
      <Cartao>
        <EstadoVazio
          icone="local"
          titulo="Nenhum local cadastrado"
          descricao="O primeiro local é criado junto com uma programação, no campo Local."
          acao={{
            titulo: 'Nova programação',
            icone: 'adicionar',
            aoPressionar: () => router.push('/evento/novo'),
          }}
        />
      </Cartao>
    )
  }
  return (
    <Cartao>
      {locais.data.map((l) => (
        <Linha
          key={l.id}
          icone="local"
          titulo={l.nome}
          descricao={descrever(l)}
          {...(l.arquivado ? { extra: <Selo texto="Arquivado" /> } : {})}
          aoPressionar={() =>
            router.push({ pathname: '/locais/[localId]', params: { localId: l.id } })
          }
        />
      ))}
    </Cartao>
  )
}

/** Rota `/locais/[localId]`: editar nome, endereço e referência; arquivar. */
export function TelaLocal() {
  const localId = parametro(useLocalSearchParams<{ localId: string }>().localId)
  return (
    <TelaDaComunidade oQue="o local" titulo="Local">
      {(c) => (localId ? <EditarLocal comunidadeId={c.id} localId={localId} /> : null)}
    </TelaDaComunidade>
  )
}

function EditarLocal({ comunidadeId, localId }: { comunidadeId: string; localId: string }) {
  const locais = useLocais(comunidadeId)
  const local = locais.data?.find((l) => l.id === localId)
  if (locais.isPending) return <Carregando texto="Carregando o local" />
  if (locais.error) {
    return <AvisoDeErro erro={locais.error} aoTentarDeNovo={() => void locais.refetch()} />
  }
  if (!local) {
    return (
      <Aviso tipo="alerta" titulo="Local não encontrado">
        Ele pode ter sido removido. Volte para a lista de locais.
      </Aviso>
    )
  }
  return (
    <Formulario
      key={`${local.id}-${local.versao ?? 0}`}
      comunidadeId={comunidadeId}
      local={local}
    />
  )
}

function Formulario({ comunidadeId, local }: { comunidadeId: string; local: Local }) {
  const consultas = useQueryClient()
  const invalidarEventos = useInvalidarEventos(comunidadeId)
  const [nome, setNome] = useState(local.nome)
  const [endereco, setEndereco] = useState(local.endereco ?? '')
  const [referencia, setReferencia] = useState(local.referencia ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const salvar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) =>
      api.patch(`${naComunidade(comunidadeId)}/locais/${local.id}`, corpo),
    onSuccess: () =>
      Promise.all([
        consultas.invalidateQueries({ queryKey: CHAVES.locais(comunidadeId) }),
        invalidarEventos(),
      ]),
  })

  function enviar() {
    if (nome.trim().length < 2) {
      setErro('Informe o nome do local.')
      return
    }
    if (local.tipo === 'externo' && !endereco.trim()) {
      setErro('Local externo precisa de endereço.')
      return
    }
    setErro(null)
    salvar.mutate({
      nome: nome.trim(),
      endereco: endereco.trim() || null,
      referencia: referencia.trim() || null,
    })
  }

  async function alternarArquivo() {
    if (!local.arquivado) {
      const ok = await confirmar({
        titulo: `Arquivar ${local.nome}?`,
        mensagem:
          'Ele deixa de aparecer na escolha de local de novas programações. As que já usam continuam iguais.',
        confirmar: 'Arquivar',
      })
      if (!ok) return
    }
    salvar.mutate({ arquivado: !local.arquivado })
  }

  return (
    <>
      <Cartao>
        <Texto variante="legenda" cor="textoSuave">
          {local.tipo === 'interno' ? 'Local interno da igreja.' : 'Local externo, com endereço.'}
        </Texto>
        <Campo rotulo="Nome" value={nome} onChangeText={setNome} erro={erro} maxLength={120} />
        <Campo
          rotulo={local.tipo === 'externo' ? 'Endereço' : 'Endereço (opcional)'}
          value={endereco}
          onChangeText={setEndereco}
          maxLength={300}
        />
        <Campo
          rotulo="Referência (opcional)"
          ajuda="Por exemplo: salão do segundo andar, portão lateral."
          value={referencia}
          onChangeText={setReferencia}
          maxLength={300}
        />
        {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
        {salvar.isSuccess ? (
          <TextoAnunciado variante="corpo" cor="sucesso">
            Local salvo.
          </TextoAnunciado>
        ) : null}
        <Botao titulo="Salvar" carregando={salvar.isPending} aoPressionar={enviar} />
      </Cartao>
      <Botao
        titulo={local.arquivado ? 'Tirar do arquivo' : 'Arquivar local'}
        icone={local.arquivado ? 'confirmado' : 'material'}
        variante="secundario"
        carregando={salvar.isPending}
        aoPressionar={() => void alternarArquivo()}
      />
    </>
  )
}
