import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'

import { descartarConviteEmEspera } from './conviteEmEspera'

interface Props {
  token: string
  comunidade: string
  papel: string
}

/** Conta existente e conectada: confirma a entrada na comunidade do convite. */
export function AceitarComConta({ token, comunidade, papel }: Props) {
  const { conta } = useSessao()
  const consultas = useQueryClient()
  const aceitar = useMutation({
    mutationFn: () => api.post<{ vinculoId: string }>('/api/auth/convite/aceitar', { token }),
    onSuccess: async () => {
      descartarConviteEmEspera()
      await consultas.invalidateQueries({ queryKey: CHAVES.eu })
    },
  })

  if (aceitar.isSuccess) {
    return (
      <Cartao titulo="Pronto!" icone="confirmado">
        <Texto accessibilityLiveRegion="polite">
          Agora você participa de {comunidade} como {papel}.
        </Texto>
        <Botao titulo="Ir para o início" aoPressionar={() => router.replace('/')} />
      </Cartao>
    )
  }

  return (
    <Cartao>
      {conta ? (
        <Texto variante="apoio" cor="textoSuave">
          Você está conectado como {conta.email}.
        </Texto>
      ) : null}
      {aceitar.error ? <AvisoDeErro erro={aceitar.error} /> : null}
      <Botao
        titulo={`Entrar em ${comunidade} como ${papel}`}
        aoPressionar={() => aceitar.mutate()}
        carregando={aceitar.isPending}
      />
      <Botao
        titulo="Agora não"
        variante="discreto"
        aoPressionar={() => {
          descartarConviteEmEspera()
          router.replace('/')
        }}
      />
    </Cartao>
  )
}
