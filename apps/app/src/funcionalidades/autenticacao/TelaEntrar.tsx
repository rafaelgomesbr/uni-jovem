import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { useSessao, type ResultadoDeEntrar } from '@/estado/sessao'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { IndicadorDeConexao } from '@/ui/IndicadorDeConexao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import LOGO from '../../../assets/images/splash-icon.png'

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
 * Entrar: Face ID (quando há sessão trancada neste aparelho), Apple (iOS),
 * Google (quando configurado) e e-mail e senha. Todos levam ao mesmo lugar;
 * nenhum cria conta (a conta nasce do convite).
 */
export function TelaEntrar() {
  const sessao = useSessao()
  const { cores } = useTema()
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

  return (
    <Tela>
      <AlteracoesDescartadas />
      <IndicadorDeConexao />

      {/* Mockup Aurora: o sol nascendo grande sobre o fundo, o nome em Bricolage. */}
      <View style={{ alignItems: 'center', gap: ESPACO.x2, paddingTop: ESPACO.x6 }}>
        <Image
          source={LOGO}
          style={{ width: 168, height: 168, marginBottom: -ESPACO.x6 }}
          accessible={false}
          accessibilityIgnoresInvertColors
          contentFit="contain"
        />
        <Texto variante="tituloGrande" centralizado style={{ fontSize: 40, lineHeight: 44 }}>
          {NOME_DO_APP}
        </Texto>
        <Texto cor="textoSuave" centralizado style={{ maxWidth: 320 }}>
          Entre para ver a programação, as escalas e os avisos da sua comunidade.
        </Texto>
      </View>

      {entrar.error ? (
        <AvisoDeErro erro={entrar.error} />
      ) : falhaDoProvedor ? (
        <AvisoDeErro mensagem={falhaDoProvedor} />
      ) : null}

      {biometria.travada ? (
        <Cartao titulo="Neste aparelho">
          <Texto>Sua sessão está guardada neste aparelho e protegida pelo {biometria.nome}.</Texto>
          <Botao
            titulo={`Entrar com ${biometria.nome}`}
            icone="seguranca"
            carregando={emAndamento === 'biometria'}
            desabilitado={emAndamento !== null && emAndamento !== 'biometria'}
            aoPressionar={() => entrar.mutate({ tipo: 'biometria' })}
          />
        </Cartao>
      ) : null}

      {temProvedor ? (
        <View style={{ gap: ESPACO.x3 }}>
          <BotaoApple
            carregando={emAndamento === 'apple'}
            aoPressionar={() => entrar.mutate({ tipo: 'apple' })}
          />
          <BotaoGoogle
            carregando={emAndamento === 'google'}
            desabilitado={emAndamento !== null && emAndamento !== 'google'}
            aoObterToken={(idToken) => entrar.mutate({ tipo: 'google', idToken })}
            aoFalhar={(mensagem) => {
              entrar.reset()
              setFalhaDoProvedor(mensagem)
            }}
          />
          <Separador cor={cores.cartaoVidroBorda} />
        </View>
      ) : null}

      <Cartao titulo="Com e-mail e senha">
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
        <Botao
          titulo="Entrar"
          aoPressionar={enviar}
          carregando={emAndamento === 'senha'}
          desabilitado={emAndamento !== null && emAndamento !== 'senha'}
        />
        <View style={{ alignItems: 'center' }}>
          <Botao
            titulo="Esqueci a senha"
            variante="terciario"
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

/** "ou" entre os provedores e o formulário. As linhas são só enfeite. */
function Separador({ cor }: { cor: string }) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x3, marginTop: ESPACO.x2 }}
    >
      <View
        style={{ flex: 1, height: 1, backgroundColor: cor }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Texto variante="apoio" cor="textoSuave">
        ou
      </Texto>
      <View
        style={{ flex: 1, height: 1, backgroundColor: cor }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  )
}
