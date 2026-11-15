import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'

import { api } from '@/servicos/api'
import { ehErroDaApi } from '@/servicos/erros'
import { useTokenDoFragmento } from '@/utilidades/fragmento'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'

import { problemaDaSenha } from './politicaDeSenha'
import { RegrasDaSenha } from './RegrasDaSenha'

/** Redefinir a senha pelo link do e-mail (3.1.4). O token vem no fragmento do link. */
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
      <Tela pilha aurora={1} semVoltar>
        <EstadoVazio
          icone="link"
          titulo="Link incompleto"
          descricao="Abra de novo o link que chegou no seu e-mail. Se ele venceu, peça outro."
          telaInteira
          acao={{
            titulo: 'Pedir um link novo',
            aoPressionar: () => router.replace('/recuperar-senha'),
          }}
        />
      </Tela>
    )
  }

  if (redefinir.isSuccess) {
    return (
      <Tela pilha aurora={1} semVoltar titulo="Criar uma senha nova">
        <CartaoDeDestaque
          titulo="Senha alterada"
          descricao={redefinir.data?.mensagem ?? 'Entre com a senha nova.'}
          acoes={<Botao titulo="Ir para entrar" aoPressionar={() => router.replace('/entrar')} />}
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
    <Tela
      pilha
      aurora={1}
      semVoltar
      titulo="Criar uma senha nova"
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Salvar senha nova"
            tamanho="grande"
            aoPressionar={enviar}
            carregando={redefinir.isPending}
          />
        </BarraDeAcao>
      }
    >
      <CartaoDeVidro intervalo={ESPACO.e16}>
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
      </CartaoDeVidro>
    </Tela>
  )
}
