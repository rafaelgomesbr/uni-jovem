import { useMutation } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { api } from '@/servicos/api'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { parametro } from '@/utilidades/parametros'

/**
 * Recuperar a senha (3.1.4): pilha, cartão com o e-mail e a barra de ação.
 * Depois de enviar, o destaque "Confira seu e-mail" com a mensagem da API
 * (que traz o e-mail mascarado e não diz se a conta existe).
 */
export function TelaRecuperarSenha() {
  // A entrada manda o e-mail que a pessoa já digitou (D63): ela não digita de novo.
  const parametros = useLocalSearchParams<{ email?: string | string[] }>()
  const [email, setEmail] = useState(() => parametro(parametros.email) ?? '')
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

  if (recuperar.data) {
    return (
      <Tela pilha aurora={1} titulo="Recuperar a senha">
        <Cartao
          variante="momento"
          pose="nascendo"
          etiqueta="Link enviado"
          titulo="Confira seu e-mail"
          acoes={
            <Botao
              titulo="Voltar para entrar"
              variante="secundario"
              aoPressionar={() => router.replace('/entrar')}
            />
          }
        >
          <Texto variante="corpo" cor="textoSuave">
            {recuperar.data.mensagem}
          </Texto>
        </Cartao>
      </Tela>
    )
  }

  return (
    <Tela
      pilha
      aurora={1}
      titulo="Recuperar a senha"
      descricao="Enviamos um link para o seu e-mail. Ele vale por 30 minutos e só pode ser usado uma vez."
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Enviar link"
            tamanho="grande"
            aoPressionar={enviar}
            carregando={recuperar.isPending}
          />
        </BarraDeAcao>
      }
    >
      <CartaoDeVidro>
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
        {recuperar.error ? <AvisoDeFalha erro={recuperar.error} /> : null}
      </CartaoDeVidro>
    </Tela>
  )
}
