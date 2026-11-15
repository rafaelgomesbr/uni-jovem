import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { useSessao, type ResultadoDeEntrar } from '@/estado/sessao'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao, BotaoIcone, EmPar } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { IconeDoApp } from '@/ui/IconeDoApp'
import { useSemConexao } from '@/ui/IndicadorDeConexao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { AlteracoesDescartadas } from '../offline/AlteracoesDescartadas'
import { BotaoApple, pedirCredencialDaApple, useAppleDisponivel } from './provedores/BotaoApple'
import { BotaoGoogle } from './provedores/BotaoGoogle'
import { googleConfigurado } from './provedores/configuracao'

interface ErrosDoFormulario {
  email?: string
  senha?: string
}

type Pedido =
  | { tipo: 'senha' }
  | { tipo: 'google'; idToken: string }
  | { tipo: 'apple' }
  | { tipo: 'biometria' }

/**
 * Entrar (3.1.1 e quadro 05): Aurora total, marca a 40 da área segura,
 * cartão "ENTRAR" com e-mail, senha, "Esqueci a senha" e o primário largo
 * (com o Face ID como só ícone de 48 ao lado, se há sessão guardada neste
 * aparelho), e embaixo Google e Apple em fundo branco. Nenhum caminho cria
 * conta: a conta nasce do convite.
 */
export function TelaEntrar() {
  const sessao = useSessao()
  const semConexao = useSemConexao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<ErrosDoFormulario>({})
  // Falha do lado do provedor (antes de chegar à API), com texto pronto.
  const [falhaDoProvedor, setFalhaDoProvedor] = useState<string | null>(null)
  const appleDisponivel = useAppleDisponivel()
  const temProvedor = appleDisponivel || googleConfigurado()
  const { biometria } = sessao

  const entrar = useMutation({
    mutationFn: async (pedido: Pedido): Promise<ResultadoDeEntrar | null> => {
      setFalhaDoProvedor(null)
      switch (pedido.tipo) {
        case 'senha':
          return sessao.entrar({ email, senha })
        case 'google':
          return sessao.entrarComProvedor('google', { idToken: pedido.idToken })
        case 'apple': {
          const credencial = await pedirCredencialDaApple()
          // Cancelou na folha da Apple: nada a mostrar.
          return credencial ? sessao.entrarComProvedor('apple', credencial) : null
        }
        case 'biometria':
          await sessao.desbloquearComBiometria()
          return null
      }
    },
    onSuccess: (resultado) => {
      // 'pronto': o guarda do grupo público leva para o Início sozinho.
      if (resultado === 'segundo_fator') router.push('/segundo-fator')
    },
  })
  const emAndamento = entrar.isPending ? entrar.variables.tipo : null

  function enviar() {
    const novos: ErrosDoFormulario = {}
    if (!email.trim()) novos.email = 'Informe seu e-mail.'
    if (!senha) novos.senha = 'Informe sua senha.'
    setErros(novos)
    if (novos.email || novos.senha) return
    entrar.mutate({ tipo: 'senha' })
  }

  const erroDeEntrada = entrar.error ? (
    <AvisoDeErro erro={entrar.error} />
  ) : falhaDoProvedor ? (
    <AvisoDeErro mensagem={falhaDoProvedor} />
  ) : null

  return (
    <Tela semCabecalho>
      <AlteracoesDescartadas />

      <View>
        <IconeDoApp />
        <Texto variante="display" style={{ marginTop: ESPACO.e16 }}>
          {NOME_DO_APP}
        </Texto>
        <Texto variante="corpo" cor="textoSuave" style={{ marginTop: ESPACO.e4 }}>
          A agenda da juventude, num lugar só
        </Texto>
      </View>

      {semConexao ? (
        <Aviso tipo="alerta" titulo="Sem conexão">
          Para entrar, o aparelho precisa de internet.
        </Aviso>
      ) : null}

      <CartaoDeVidro sobrancelha="Entrar" intervalo={ESPACO.e16} style={{ marginTop: ESPACO.e8 }}>
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
        <View>
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
          <View style={{ alignItems: 'flex-end', marginTop: ESPACO.e8 }}>
            <Botao
              titulo="Esqueci a senha"
              variante="terciario"
              alinhado
              aoPressionar={() => router.push('/recuperar-senha')}
            />
          </View>
        </View>
        {erroDeEntrada}
        <View style={{ flexDirection: 'row', gap: ESPACO.e8 }}>
          {biometria.travada ? (
            <BotaoIcone
              icone="faceId"
              rotulo={`Entrar com ${biometria.nome}`}
              lado={48}
              desabilitado={emAndamento !== null}
              aoPressionar={() => entrar.mutate({ tipo: 'biometria' })}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <EmPar>
              <Botao
                titulo="Entrar"
                tamanho="grande"
                aoPressionar={enviar}
                carregando={emAndamento === 'senha'}
                desabilitado={emAndamento !== null && emAndamento !== 'senha'}
              />
            </EmPar>
          </View>
        </View>
      </CartaoDeVidro>

      {temProvedor ? (
        <View style={{ gap: ESPACO.e8 }}>
          <BotaoGoogle
            carregando={emAndamento === 'google'}
            desabilitado={emAndamento !== null && emAndamento !== 'google'}
            aoObterToken={(idToken) => entrar.mutate({ tipo: 'google', idToken })}
            aoFalhar={(mensagem) => {
              entrar.reset()
              setFalhaDoProvedor(mensagem)
            }}
          />
          <BotaoApple
            carregando={emAndamento === 'apple'}
            aoPressionar={() => entrar.mutate({ tipo: 'apple' })}
          />
        </View>
      ) : null}

      <View style={{ alignItems: 'flex-start' }}>
        <Texto variante="legenda" cor="textoSuave">
          A conta é criada por convite.
        </Texto>
        <Botao
          titulo="Tenho um link de convite"
          variante="terciario"
          alinhado
          aoPressionar={() => router.push('/colar-convite')}
        />
      </View>
    </Tela>
  )
}
