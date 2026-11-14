import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'

import { api } from '@/servicos/api'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

export function TelaRecuperarSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const recuperar = useMutation({
    mutationFn: () =>
      api.post<{ mensagem: string }>(
        '/api/auth/recuperar',
        { email: email.trim() },
        { autenticado: false },
      ),
  })

  function enviar() {
    if (!email.trim()) {
      setErro('Informe o e-mail da sua conta.')
      return
    }
    setErro(null)
    recuperar.mutate()
  }

  return (
    <Tela
      cabecalhoNativo
      titulo="Criar uma senha nova"
      descricao="Enviamos um link para o seu e-mail. Ele vale por 30 minutos e só pode ser usado uma vez."
    >
      {recuperar.data ? (
        <Cartao titulo="Confira seu e-mail" icone="email">
          <Texto accessibilityLiveRegion="polite">{recuperar.data.mensagem}</Texto>
          <Botao
            titulo="Voltar para entrar"
            variante="secundario"
            aoPressionar={() => router.replace('/entrar')}
          />
        </Cartao>
      ) : (
        <Cartao>
          <Campo
            rotulo="E-mail da conta"
            value={email}
            onChangeText={setEmail}
            erro={erro}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={enviar}
          />
          {recuperar.error ? <AvisoDeErro erro={recuperar.error} /> : null}
          <Botao titulo="Enviar link" aoPressionar={enviar} carregando={recuperar.isPending} />
        </Cartao>
      )}
    </Tela>
  )
}
