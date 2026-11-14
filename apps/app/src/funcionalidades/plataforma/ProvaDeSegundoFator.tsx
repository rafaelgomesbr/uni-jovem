import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '@/servicos/api'
import { ehErroDaApi } from '@/servicos/erros'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'

/** A API pede prova recente de 2FA antes de ações de plataforma. */
export function exigeProvaDeSegundoFator(erro: unknown): boolean {
  return ehErroDaApi(erro, 'segundo_fator_necessario')
}

/**
 * Pede o código do autenticador e troca o token de acesso por um com prova
 * recente (`/api/auth/2fa/provar`). Depois, quem chamou repete a ação.
 */
export function ProvaDeSegundoFator({ aoConfirmar }: { aoConfirmar: () => void }) {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const provar = useMutation({
    mutationFn: () =>
      api.post<{ acesso: string }>('/api/auth/2fa/provar', { codigo: codigo.trim() }),
    onSuccess: (r) => {
      api.definirAcesso(r.acesso)
      setCodigo('')
      aoConfirmar()
    },
  })

  function enviar() {
    if (codigo.trim().length < 6) {
      setErro('Digite o código do app autenticador ou um código de recuperação.')
      return
    }
    setErro(null)
    provar.mutate()
  }

  return (
    <Cartao titulo="Confirme que é você" icone="seguranca">
      <Texto variante="apoio">
        Ações da plataforma pedem o código do seu app autenticador, mesmo com a sessão aberta.
      </Texto>
      <Campo
        rotulo="Código do app autenticador"
        value={codigo}
        onChangeText={setCodigo}
        erro={erro}
        autoCapitalize="characters"
        autoCorrect={false}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={12}
        onSubmitEditing={enviar}
      />
      {provar.error ? <AvisoDeErro erro={provar.error} /> : null}
      <Botao titulo="Confirmar" aoPressionar={enviar} carregando={provar.isPending} />
    </Cartao>
  )
}
