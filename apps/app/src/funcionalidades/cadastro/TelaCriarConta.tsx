import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { nomeDoAparelho, plataformaAtual } from '@/servicos/aparelho'
import { api } from '@/servicos/api'
import type { SessaoAberta } from '@/servicos/contrato'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { ehErroDaApi } from '@/servicos/erros'
import { anunciar } from '@/ui/anunciar'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CampoDeAcesso } from '@/ui/CampoDeAcesso'
import { AvisoDeFalha } from '@/ui/Falha'
import { focar, type NoDeTexto } from '@/ui/foco'
import { LinkDeAcesso } from '@/ui/LinkDeAcesso'
import { useConfirmarDescarte, useTravaDeEnvio, voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { parametro } from '@/utilidades/parametros'

import {
  emailParecido,
  TEXTO_DO_E_MAIL_INCOMPLETO,
  TEXTO_DO_E_MAIL_VAZIO,
} from '../autenticacao/erroDaEntrada'
import { erroDaSenhaNova, statusDaSenha } from '../autenticacao/politicaDeSenha'
import { QuadroDeAcesso } from '../autenticacao/QuadroDeAcesso'
import { guardarUltimoMetodo } from '../autenticacao/ultimoMetodo'
import { CadastroTravado } from '../convite/Consentimentos'
import { useCadastroTravado } from '../convite/travaDeIdade'
import { FaltaPouco } from './FaltaPouco'
import { useVerificacaoHumana } from './verificacaoHumana'

type Passo = 'dados' | 'idade'

interface Erros {
  nome?: string
  email?: string
  senha?: string
}

/** O cadastro por e-mail depende do envio de e-mail (PH-03): sem ele, a API responde 503. */
export function cadastroIndisponivel(erro: unknown): boolean {
  return ehErroDaApi(erro) && erro.status === 503
}

/** E-mail que já tem conta: a tela oferece entrar ou recuperar a senha. */
function emailJaCadastrado(erro: unknown): boolean {
  return ehErroDaApi(erro, 'conta_existente') || (ehErroDaApi(erro) && erro.status === 409)
}

/**
 * Criar conta por e-mail em duas telas (D63): `criar.dados` (e-mail e senha,
 * juntos, para o chaveiro do sistema sugerir uma senha forte e salvar o par) e
 * `criar.idade` ("Falta pouco": nome, idade e aceite dos Termos, a mesma tela
 * de quem veio da Apple ou do Google). Sem "repita a senha": o botão Mostrar
 * a substitui. A conta nasce sem confirmação de e-mail (ADR 0008) e sem
 * comunidade, e cai em "Comece por aqui". Nada é enviado antes da segunda
 * tela: dados, idade e aceites vão numa única chamada.
 */
export function TelaCriarConta() {
  const sessao = useSessao()
  const parametros = useLocalSearchParams<{ email?: string | string[] }>()
  const [passo, setPassoAtual] = useState<Passo>('dados')
  const [direcao, setDirecao] = useState<1 | -1>(1)
  const [trocouDePasso, setTrocouDePasso] = useState(false)
  const titulo = useRef<NoDeTexto>(null)
  useEffect(() => {
    if (trocouDePasso) focar(titulo)
  }, [passo, trocouDePasso])
  const irPara = (novo: Passo) => {
    setDirecao(novo === 'idade' ? 1 : -1)
    setTrocouDePasso(true)
    setPassoAtual(novo)
  }

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState(() => parametro(parametros.email) ?? '')
  const [senha, setSenha] = useState('')
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null)
  const [termos, setTermos] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [disparoDeErro, setDisparoDeErro] = useState(0)
  const trava = useTravaDeEnvio()
  const travado = useCadastroTravado()
  const verificacao = useVerificacaoHumana()

  const sujo = !!(nome.trim() || email.trim() || senha)
  const liberarSaida = useConfirmarDescarte(sujo)

  const concluir = useMutation({
    mutationFn: async () => {
      const resposta = await api.post<SessaoAberta>(
        '/api/auth/cadastro/criar',
        {
          nome: nome.trim(),
          email: email.trim(),
          faixaEtaria: faixa,
          // A opção de 16 ou 17 anos já declara que o responsável sabe e concorda (TC-01.v2).
          aceites: { termos, responsavelCiente: faixa === '16_17' },
          turnstile: verificacao.obterToken(),
          senha,
          plataforma: plataformaAtual(),
          aparelho: nomeDoAparelho(),
        },
        { autenticado: false },
      )
      // Saída de propósito: a sessão aberta leva ao Início sem perguntar "Descartar?".
      liberarSaida()
      guardarUltimoMetodo('email')
      await sessao.abrirSessao(resposta)
      anunciar('Conta criada.')
    },
    onError: (erro) => {
      // Os dois erros que nascem na primeira tela voltam para ela, com a conversa já aberta.
      if (ehErroDaApi(erro, 'senha_fraca')) {
        setErros({ senha: erro.mensagem })
        irPara('dados')
      }
      if (emailJaCadastrado(erro)) irPara('dados')
    },
    onSettled: () => {
      verificacao.reiniciar()
      trava.soltar()
    },
  })
  const jaTemConta = emailJaCadastrado(concluir.error)

  if (travado) {
    return (
      <Tela pilha aurora={1} titulo="Criar conta">
        <CadastroTravado aoVoltar={() => router.replace('/entrar')} />
      </Tela>
    )
  }

  function entrarComEsteEmail() {
    liberarSaida()
    router.replace({
      pathname: '/entrar',
      params: { modo: 'email', ...(email.trim() ? { email: email.trim() } : {}) },
    })
  }

  if (passo === 'dados') {
    const continuar = () => {
      const novos: Erros = {}
      if (!email.trim()) novos.email = TEXTO_DO_E_MAIL_VAZIO
      else if (!emailParecido(email)) novos.email = TEXTO_DO_E_MAIL_INCOMPLETO
      const problema = erroDaSenhaNova(senha, { email })
      if (problema) novos.senha = problema
      setErros(novos)
      if (Object.keys(novos).length > 0) {
        setDisparoDeErro((n) => n + 1)
        return
      }
      concluir.reset()
      irPara('idade')
    }
    const status = statusDaSenha(senha)
    return (
      <QuadroDeAcesso
        titulo="Crie sua conta"
        apoio="Use o e-mail que você mais olha: é com ele que você entra."
        aoVoltar={() => voltarOu('/entrar')}
        chaveDoPasso="dados"
        direcao={direcao}
        refDoTitulo={titulo}
        barraDeAcao={
          <BarraDeAcao>
            <Botao titulo="Continuar" tamanho="alto" aoPressionar={continuar} />
          </BarraDeAcao>
        }
      >
        <View style={{ gap: ESPACO.e4 }}>
          <CampoDeAcesso
            rotulo="E-mail"
            value={email}
            onChangeText={(texto) => {
              setEmail(texto)
              if (erros.email && emailParecido(texto)) setErros((e) => ({ ...e, email: undefined }))
            }}
            onBlur={() => {
              if (email.trim() && !emailParecido(email)) {
                setErros((e) => ({ ...e, email: TEXTO_DO_E_MAIL_INCOMPLETO }))
              }
            }}
            erro={erros.email ?? null}
            disparoDeErro={disparoDeErro}
            exemplo="nome@exemplo.com"
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            submitBehavior="submit"
          />
          <CampoDeAcesso
            rotulo="Crie uma senha"
            senha
            value={senha}
            onChangeText={(texto) => {
              setSenha(texto)
              if (erros.senha) setErros((e) => ({ ...e, senha: undefined }))
            }}
            erro={erros.senha ?? null}
            apoio={status.texto}
            disparoDeErro={disparoDeErro}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={continuar}
          />
        </View>
        {jaTemConta ? (
          <View style={{ gap: ESPACO.e8 }}>
            <Texto variante="meta" peso="forte" accessibilityRole="alert">
              Este e-mail já tem conta.
            </Texto>
            <View style={{ flexDirection: 'row', gap: ESPACO.e8, flexWrap: 'wrap' }}>
              <LinkDeAcesso rotulo="Entrar" aoPressionar={entrarComEsteEmail}>
                <Texto variante="botao" cor="destaque">
                  Entrar
                </Texto>
              </LinkDeAcesso>
              <LinkDeAcesso
                rotulo="Esqueci a senha"
                aoPressionar={() => {
                  liberarSaida()
                  router.replace({
                    pathname: '/recuperar-senha',
                    params: email.trim() ? { email: email.trim() } : {},
                  })
                }}
              >
                <Texto variante="botao" cor="destaque">
                  Esqueci a senha
                </Texto>
              </LinkDeAcesso>
            </View>
          </View>
        ) : null}
        <LinkDeAcesso
          tamanho="rodape"
          rotulo="Já tem conta? Entrar"
          aoPressionar={entrarComEsteEmail}
        >
          <Texto variante="meta" cor="textoSuave">
            Já tem conta?
          </Texto>
          <Texto variante="botao" cor="destaque">
            Entrar
          </Texto>
        </LinkDeAcesso>
      </QuadroDeAcesso>
    )
  }

  const confirmar = () => {
    if (nome.trim().length < 2) {
      setErros({ nome: 'Digite seu nome.' })
      setDisparoDeErro((n) => n + 1)
      return
    }
    setErros({})
    if (!faixa || faixa === 'menos_16' || !termos) return
    if (!trava.pegar()) return
    concluir.mutate()
  }
  const erroDeEnvio = concluir.error && !jaTemConta && !ehErroDaApi(concluir.error, 'senha_fraca')

  return (
    <FaltaPouco
      apoio="Só mais duas coisas."
      nome={{
        valor: nome,
        aoMudar: (texto) => {
          setNome(texto)
          if (erros.nome) setErros({})
        },
        erro: erros.nome ?? null,
        disparoDeErro,
      }}
      faixa={faixa}
      aoMudarFaixa={setFaixa}
      termos={termos}
      aoMudarTermos={setTermos}
      carregando={concluir.isPending}
      aoVoltar={() => {
        concluir.reset()
        irPara('dados')
      }}
      aoConfirmar={confirmar}
      refDoTitulo={titulo}
      chaveDoPasso="idade"
      extra={verificacao.elemento}
      aviso={
        erroDeEnvio ? <AvisoDeFalha erro={concluir.error} titulo="A conta não foi criada" /> : null
      }
    />
  )
}
