import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { useSessao } from '@/estado/sessao'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { IndicadorDeConexao } from '@/ui/IndicadorDeConexao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { AlteracoesDescartadas } from '../offline/AlteracoesDescartadas'

interface ErrosDoFormulario {
  email?: string
  senha?: string
}

export function TelaEntrar() {
  const sessao = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<ErrosDoFormulario>({})

  const entrar = useMutation({
    mutationFn: () => sessao.entrar({ email, senha }),
    onSuccess: (resultado) => {
      // 'pronto': o guarda do grupo público leva para o Início sozinho.
      if (resultado === 'segundo_fator') router.push('/segundo-fator')
    },
  })

  function enviar() {
    const novos: ErrosDoFormulario = {}
    if (!email.trim()) novos.email = 'Informe seu e-mail.'
    if (!senha) novos.senha = 'Informe sua senha.'
    setErros(novos)
    if (novos.email || novos.senha) return
    entrar.mutate()
  }

  return (
    <Tela titulo={`Entrar no ${NOME_DO_APP}`} descricao="Use o e-mail e a senha da sua conta.">
      <AlteracoesDescartadas />
      <IndicadorDeConexao />
      <Cartao>
        <Campo
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          erro={erros.email ?? null}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          inputMode="email"
          returnKeyType="next"
        />
        <Campo
          rotulo="Senha"
          senha
          value={senha}
          onChangeText={setSenha}
          erro={erros.senha ?? null}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={enviar}
        />
        {entrar.error ? <AvisoDeErro erro={entrar.error} /> : null}
        <Botao titulo="Entrar" aoPressionar={enviar} carregando={entrar.isPending} />
        <View style={{ alignItems: 'center', gap: ESPACO.x2 }}>
          <Botao
            titulo="Esqueci a senha"
            variante="discreto"
            larguraTotal={false}
            aoPressionar={() => router.push('/recuperar-senha')}
          />
        </View>
      </Cartao>
      <Texto variante="apoio" cor="textoSuave" centralizado>
        A conta é criada por convite. Se você ainda não tem uma, peça o link a quem administra a sua
        comunidade.
      </Texto>
    </Tela>
  )
}
