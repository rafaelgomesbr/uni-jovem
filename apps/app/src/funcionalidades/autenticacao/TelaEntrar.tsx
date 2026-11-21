import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Platform, TextInput, View } from 'react-native'

import { useSessao, type ResultadoDeEntrar } from '@/estado/sessao'
import { Aviso } from '@/ui/Aviso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { focar, type NoDeTexto } from '@/ui/foco'
import { useSemConexao } from '@/ui/IndicadorDeConexao'
import { SeparadorComTexto } from '@/ui/SeparadorComTexto'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { AlteracoesDescartadas } from '../offline/AlteracoesDescartadas'
import { CabecalhoDeAcesso } from './CabecalhoDeAcesso'
import { AcessosRapidos } from './provedores/AcessosRapidos'
import { pedirCredencialDaApple } from './provedores/BotaoApple'
import { useTemProvedor } from './provedores/EntradaComProvedores'

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
 * Entrar (D60): a marca, "Bem-vindo de volta" e, primeiro, os acessos rápidos
 * grandes (Apple no iOS, Google onde existe), depois "ou com e-mail" e o
 * formulário de e-mail e senha (com o Face ID como só ícone ao lado de
 * "Entrar", se há sessão guardada neste aparelho). No rodapé, "Criar conta" em
 * destaque e o link de convite. Conta aberta (ADR 0007): Google ou Apple com
 * um e-mail novo levam a "Falta pouco" (idade e aceites), e a conta nasce sem
 * confirmação de e-mail (ADR 0008).
 */
export function TelaEntrar() {
  const sessao = useSessao()
  const semConexao = useSemConexao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<ErrosDoFormulario>({})
  // Falha do lado do provedor (antes de chegar à API), com texto pronto.
  const [falhaDoProvedor, setFalhaDoProvedor] = useState<string | null>(null)
  const temProvedor = useTemProvedor()
  const { biometria } = sessao
  const titulo = useRef<NoDeTexto>(null)
  const campoDaSenha = useRef<ComponentRef<typeof TextInput>>(null)

  // Com leitor de tela, a tela abre lendo o título, não o último foco da tela anterior.
  useEffect(() => {
    if (Platform.OS !== 'web') focar(titulo)
  }, [])

  const entrar = useMutation({
    mutationFn: async (pedido: Pedido): Promise<ResultadoDeEntrar | null> => {
      setFalhaDoProvedor(null)
      switch (pedido.tipo) {
        case 'senha':
          return sessao.entrar({ email, senha })
        case 'google':
          return sessao.entrarComProvedor('google', { idToken: pedido.idToken })
        case 'apple': {
          const credencial = await pedirCredencialDaApple({ comNome: true })
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
      if (resultado === 'cadastro_pendente') router.push('/completar-cadastro')
    },
  })
  const emAndamento = entrar.isPending ? entrar.variables.tipo : null
  const provedorEmAndamento =
    emAndamento === 'google' || emAndamento === 'apple' ? emAndamento : null

  function enviar() {
    const novos: ErrosDoFormulario = {}
    if (!email.trim()) novos.email = 'Informe seu e-mail.'
    if (!senha) novos.senha = 'Informe sua senha.'
    setErros(novos)
    if (novos.email || novos.senha) return
    entrar.mutate({ tipo: 'senha' })
  }

  // O erro aparece perto de quem o causou: dos botões rápidos, acima deles; da senha, acima de "Entrar".
  const erroDoPedido = entrar.error ? entrar.variables?.tipo : null
  const erroNosAcessos = erroDoPedido === 'google' || erroDoPedido === 'apple'
  const avisoDosAcessos = erroNosAcessos ? (
    <AvisoDeFalha erro={entrar.error} />
  ) : falhaDoProvedor ? (
    <AvisoDeFalha mensagem={falhaDoProvedor} />
  ) : null
  const avisoDoFormulario =
    entrar.error && !erroNosAcessos ? <AvisoDeFalha erro={entrar.error} /> : null

  return (
    <Tela semCabecalho>
      <AlteracoesDescartadas />

      <CabecalhoDeAcesso
        titulo="Bem-vindo de volta"
        apoio="Entre para ver a agenda, as escalas e os recados da sua comunidade."
        refDoTitulo={titulo}
      />

      {semConexao ? (
        <Aviso tipo="alerta" titulo="Sem conexão">
          Para entrar, o aparelho precisa de internet.
        </Aviso>
      ) : null}

      {temProvedor ? (
        <View style={{ gap: ESPACO.e16 }}>
          <View style={{ gap: ESPACO.e12 }}>
            {avisoDosAcessos}
            <AcessosRapidos
              carregando={provedorEmAndamento}
              desabilitado={emAndamento === 'senha' || emAndamento === 'biometria'}
              aoObterTokenDoGoogle={(idToken) => entrar.mutate({ tipo: 'google', idToken })}
              aoPedirApple={() => entrar.mutate({ tipo: 'apple' })}
              aoFalhar={(mensagem) => {
                entrar.reset()
                setFalhaDoProvedor(mensagem)
              }}
            />
          </View>
          <SeparadorComTexto texto="ou com e-mail" />
        </View>
      ) : null}

      <CartaoDeVidro intervalo={ESPACO.e16}>
        <Campo
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          erro={erros.email ?? null}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          inputMode="email"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => campoDaSenha.current?.focus()}
        />
        <View>
          <Campo
            ref={campoDaSenha}
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
        {avisoDoFormulario}
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
            <Botao
              titulo="Entrar"
              tamanho="grande"
              larguraTotal
              aoPressionar={enviar}
              carregando={emAndamento === 'senha'}
              desabilitado={emAndamento !== null && emAndamento !== 'senha'}
            />
          </View>
        </View>
      </CartaoDeVidro>

      <View style={{ gap: ESPACO.e8, alignItems: 'center' }}>
        <Texto variante="meta" cor="textoSuave" centralizado>
          Ainda não tem conta?
        </Texto>
        <Botao
          titulo="Criar conta"
          variante="secundario"
          tamanho="grande"
          larguraTotal
          desabilitado={emAndamento !== null}
          aoPressionar={() => router.push('/criar-conta')}
        />
        <Botao
          titulo="Tenho um link de convite"
          variante="terciario"
          aoPressionar={() => router.push('/colar-convite')}
        />
      </View>
    </Tela>
  )
}
