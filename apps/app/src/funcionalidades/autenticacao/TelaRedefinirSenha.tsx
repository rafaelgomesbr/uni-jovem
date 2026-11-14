import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'

import { api } from '@/servicos/api'
import { ehErroDaApi } from '@/servicos/erros'
import { useTokenDoFragmento } from '@/utilidades/fragmento'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { problemaDaSenha } from './politicaDeSenha'
import { RegrasDaSenha } from './RegrasDaSenha'

export function TelaRedefinirSenha() {
  const token = useTokenDoFragmento()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const redefinir = useMutation({
    mutationFn: () =>
      api.post<{ mensagem?: string }>(
        '/api/auth/redefinir',
        { token, senha },
        { autenticado: false },
      ),
  })

  if (!token) {
    return (
      <Tela cabecalhoNativo>
        <EstadoVazio
          icone="link"
          titulo="Link incompleto"
          descricao="Abra de novo o link que chegou no seu e-mail. Se ele venceu, peça outro."
          acao={{
            titulo: 'Pedir um link novo',
            aoPressionar: () => router.replace('/recuperar-senha'),
          }}
        />
      </Tela>
    )
  }

  function enviar() {
    const problema = problemaDaSenha(senha, confirmacao)
    setErro(problema)
    if (!problema) redefinir.mutate()
  }

  const erroDaSenha = ehErroDaApi(redefinir.error, 'senha_fraca') ? redefinir.error.mensagem : null

  return (
    <Tela cabecalhoNativo titulo="Criar uma senha nova">
      {redefinir.isSuccess ? (
        <Cartao titulo="Senha alterada" icone="confirmado">
          <Texto accessibilityLiveRegion="polite">
            {redefinir.data?.mensagem ?? 'Senha alterada. Entre com a senha nova.'}
          </Texto>
          <Botao titulo="Ir para entrar" aoPressionar={() => router.replace('/entrar')} />
        </Cartao>
      ) : (
        <Cartao>
          <RegrasDaSenha senha={senha} />
          <Campo
            rotulo="Senha nova"
            senha
            value={senha}
            onChangeText={setSenha}
            erro={erro ?? erroDaSenha}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Campo
            rotulo="Repita a senha nova"
            senha
            value={confirmacao}
            onChangeText={setConfirmacao}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={enviar}
          />
          {redefinir.error && !erroDaSenha ? <AvisoDeErro erro={redefinir.error} /> : null}
          <Botao
            titulo="Salvar senha nova"
            aoPressionar={enviar}
            carregando={redefinir.isPending}
          />
        </Cartao>
      )}
    </Tela>
  )
}
