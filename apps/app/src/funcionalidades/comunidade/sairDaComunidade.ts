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
      // TC-12.v2 (docs/privacidade/textos-de-consentimento.md).
      mensagem: `${CONSEQUENCIAS_DE_SAIR.map((c) => `• ${c}`).join('\n')}${
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

/** TC-12.v2: o que acontece ao sair (a volta não precisa mais de convite, ADR 0007). */
export const CONSEQUENCIAS_DE_SAIR = [
  'Seus pedidos de oração nesta comunidade serão apagados.',
  'Sua disponibilidade e suas escalas futuras serão retiradas.',
  'Seu histórico aqui (presenças e escalas passadas) deixa de mostrar seu nome e passa a aparecer como "Pessoa removida".',
  'O que estiver baixado para uso sem internet nesta comunidade será apagado deste aparelho.',
  'Para voltar, peça para entrar de novo ou use um convite ou o código da comunidade. Você volta como pessoa nova, sem o histórico.',
]
