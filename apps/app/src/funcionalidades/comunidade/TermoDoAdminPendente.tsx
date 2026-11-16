import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { Botao } from '@/ui/Botao'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela } from '@/ui/FolhaNaTela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { useDetalheDaComunidade } from './consultas'
import { MENSAGEM_SEM_TERMO_DO_ADMIN, TermoDoAdministrador } from './TelaCriarComunidade'

/**
 * Termo do Administrador pendente (TC-16): administrador promovido depois da
 * criação, ou versão nova do termo. Quando a comunidade ativa vem com
 * `precisaAceitarTermoDoAdmin` (na `/eu` ou no detalhe), uma folha pede o
 * aceite antes de administrar. "Agora não" fecha só até o app abrir de novo;
 * quem decide o que fica bloqueado sem o aceite é a API.
 */
export function TermoDoAdminPendente() {
  const { comunidadeAtiva } = useSessao()
  const detalhe = useDetalheDaComunidade(comunidadeAtiva?.id ?? null)
  const [adiadas, setAdiadas] = useState<readonly string[]>([])
  const pendente =
    !!comunidadeAtiva &&
    comunidadeAtiva.papel === 'admin' &&
    (comunidadeAtiva.precisaAceitarTermoDoAdmin === true ||
      detalhe.data?.precisaAceitarTermoDoAdmin === true) &&
    !adiadas.includes(comunidadeAtiva.id)
  if (!pendente || !comunidadeAtiva) return null
  return (
    <Folha
      key={comunidadeAtiva.id}
      comunidadeId={comunidadeAtiva.id}
      nome={comunidadeAtiva.nome}
      aoAdiar={() => setAdiadas((a) => [...a, comunidadeAtiva.id])}
    />
  )
}

function Folha({
  comunidadeId,
  nome,
  aoAdiar,
}: {
  comunidadeId: string
  nome: string
  aoAdiar: () => void
}) {
  const consultas = useQueryClient()
  const [aceite, setAceite] = useState(false)
  const aceitar = useMutation({
    mutationFn: () => api.post(`/api/v1/c/${comunidadeId}/termo-do-admin`, { aceite: true }),
    onSuccess: async () => {
      mostrarToast({ texto: 'Termo aceito. Obrigado.' })
      await Promise.all([
        consultas.invalidateQueries({ queryKey: CHAVES.eu }),
        consultas.invalidateQueries({ queryKey: CHAVES.comunidade(comunidadeId) }),
      ])
    },
  })
  return (
    <FolhaNaTela aberta titulo="Termo do Administrador" aoFechar={aoAdiar}>
      <Texto variante="corpo">
        {`Você administra ${nome}. Antes de continuar, leia e aceite o termo.`}
      </Texto>
      <TermoDoAdministrador aceite={aceite} aoMudar={setAceite} />
      {aceitar.error ? (
        <AvisoDeFalha erro={aceitar.error} titulo="O aceite não foi gravado" />
      ) : null}
      <Botao
        titulo="Aceitar e continuar"
        tamanho="grande"
        larguraTotal
        desabilitado={!aceite}
        motivo={MENSAGEM_SEM_TERMO_DO_ADMIN}
        carregando={aceitar.isPending}
        aoPressionar={() => aceitar.mutate()}
      />
      <Botao titulo="Agora não" variante="terciario" alinhado aoPressionar={aoAdiar} />
    </FolhaNaTela>
  )
}
