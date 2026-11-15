import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'

import { mensagemDePendencias } from '../offline/avisoAntesDeApagar'
import { useOffline } from '../offline/ProvedorOffline'

/**
 * Sair da comunidade (Comunidade e Perfil usam o mesmo caminho): confirma,
 * mostra o que não foi enviado e, fora dela, apaga a partição do aparelho.
 */
export function useSairDaComunidade(comunidade: Pick<ComunidadeDoVinculo, 'id' | 'nome'> | null) {
  const consultas = useQueryClient()
  const offline = useOffline()
  const sair = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/c/${id}/sair`),
    onSuccess: async (_r, id) => {
      // Fora da comunidade, a partição dela sai do aparelho.
      await offline.apagarComunidade(id)
      await consultas.invalidateQueries({ queryKey: CHAVES.eu })
      router.replace('/')
    },
  })

  async function pedirParaSair() {
    if (!comunidade) return
    const naoEnviadas = await offline.naoEnviadas(comunidade.id)
    const ok = await confirmar({
      titulo: `Sair de ${comunidade.nome}?`,
      mensagem: `Você deixa de ver a agenda e as programações desta comunidade. Para voltar, vai precisar de um convite novo.${
        naoEnviadas.length
          ? `

${mensagemDePendencias(naoEnviadas)}`
          : ''
      }`,
      confirmar: `Sair de ${comunidade.nome}`,
      destrutivo: true,
    })
    if (ok) sair.mutate(comunidade.id)
  }

  return { pedirParaSair, saindo: sair.isPending, erro: sair.error }
}
