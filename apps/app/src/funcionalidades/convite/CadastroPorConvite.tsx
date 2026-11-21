import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { nomeDoAparelho, plataformaAtual } from '@/servicos/aparelho'
import { api } from '@/servicos/api'
import type { SessaoAberta } from '@/servicos/contrato'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { ehErroDaApi } from '@/servicos/erros'
import { anunciar } from '@/ui/anunciar'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { BotaoDeAcesso } from '@/ui/BotaoDeAcesso'
import { Botao } from '@/ui/Botao'
import { CampoDeAcesso } from '@/ui/CampoDeAcesso'
import { AvisoDeFalha } from '@/ui/Falha'
import { focar, type NoDeTexto } from '@/ui/foco'
import { LinkDeAcesso } from '@/ui/LinkDeAcesso'
import { Texto } from '@/ui/Texto'

import {
  emailParecido,
  TEXTO_DO_E_MAIL_INCOMPLETO,
  TEXTO_DO_E_MAIL_VAZIO,
} from '../autenticacao/erroDaEntrada'
import { erroDaSenhaNova, statusDaSenha } from '../autenticacao/politicaDeSenha'
import { googleConfigurado } from '../autenticacao/provedores/configuracao'
import { useEstadoDaApple } from '../autenticacao/provedores/BotaoApple'
import { EntradaComProvedores } from '../autenticacao/provedores/EntradaComProvedores'
import { QuadroDeAcesso } from '../autenticacao/QuadroDeAcesso'
import { guardarUltimoMetodo } from '../autenticacao/ultimoMetodo'
import { FaltaPouco } from '../cadastro/FaltaPouco'
import { CadastroTravado, ConsentimentoDeFe, motivoDoConsentimento } from './Consentimentos'
import { guardarConviteEmEspera } from './conviteEmEspera'
import { useCadastroTravado } from './travaDeIdade'

type Passo = 'inicio' | 'dados' | 'idade' | 'fe'

const ORDEM: readonly Passo[] = ['inicio', 'dados', 'idade', 'fe']

interface Erros {
  nome?: string
  email?: string
  senha?: string
}

/**
 * Conta nova pelo convite (D63), no mesmo desenho e vocabulário da entrada:
 * 1. `inicio`: o cartão do convite e os mesmos acessos (Apple, Google e
 *    "Criar conta com e-mail"); quem já tem conta entra e volta ao convite;
 * 2. `dados`: e-mail e senha, juntos;
 * 3. "Falta pouco": nome, idade (TC-01) e Termos (TC-02), a mesma tela de
 *    todo cadastro;
 * 4. "Participar": o consentimento sobre a fé (TC-03) e, para 16 e 17 anos, a
 *    ciência do responsável. A conta é criada e já entra na comunidade.
 * O WhatsApp opcional saiu da entrada (vira sugestão no Perfil) e não há
 * confirmação de e-mail (ADR 0008). Os textos de consentimento são os de sempre.
 */
export function CadastroPorConvite({
  token,
  comunidade,
  cartaoDoConvite,
}: {
  token: string
  comunidade: string
  /** O convite em destaque, no topo do primeiro passo. */
  cartaoDoConvite?: ReactNode
}) {
  const sessao = useSessao()
  const [passo, setPassoAtual] = useState<Passo>('inicio')
  const [direcao, setDirecao] = useState<1 | -1>(1)
  // Ao trocar de passo, o que tinha o foco some: o título do passo novo recebe o foco.
  const [trocouDePasso, setTrocouDePasso] = useState(false)
  const titulo = useRef<NoDeTexto>(null)
  useEffect(() => {
    if (trocouDePasso) focar(titulo)
  }, [passo, trocouDePasso])
  const irPara = (novo: Passo) => {
    setDirecao(ORDEM.indexOf(novo) > ORDEM.indexOf(passo) ? 1 : -1)
    setTrocouDePasso(true)
    setPassoAtual(novo)
  }

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<Erros>({})
  const [disparoDeErro, setDisparoDeErro] = useState(0)
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null)
  const [termos, setTermos] = useState(false)
  const [fe, setFe] = useState(false)
  const [responsavel, setResponsavel] = useState(false)
  const adolescente = faixa === '16_17'
  const travado = useCadastroTravado()
  const apple = useEstadoDaApple() === 'sim'
  const google = googleConfigurado()
  const provedores = (apple ? 1 : 0) + (google ? 1 : 0)

  const concluir = useMutation({
    mutationFn: async () => {
      const resposta = await api.post<SessaoAberta>(
        '/api/auth/convite/criar',
        {
          token,
          email: email.trim(),
          aceites: { termos, responsavelCiente: adolescente && responsavel },
          nome: nome.trim(),
          senha,
          plataforma: plataformaAtual(),
          aparelho: nomeDoAparelho(),
          faixaEtaria: faixa,
          aceiteTermos: termos,
          consentimentoFe: fe,
          responsavelCiente: adolescente && responsavel,
        },
        { autenticado: false },
      )
      guardarUltimoMetodo('email')
      await sessao.abrirSessao(resposta)
      anunciar('Conta criada.')
    },
    onSuccess: () => router.replace('/'),
    onError: (erro) => {
      // Os erros que nascem na tela de e-mail e senha voltam para ela.
      if (ehErroDaApi(erro, 'senha_fraca')) {
        setErros({ senha: erro.mensagem })
        irPara('dados')
      }
      if (ehErroDaApi(erro, 'conta_existente') || (ehErroDaApi(erro) && erro.status === 409)) {
        irPara('dados')
      }
    },
  })
  const jaTemConta =
    ehErroDaApi(concluir.error, 'conta_existente') ||
    (ehErroDaApi(concluir.error) && concluir.error.status === 409)

  function entrarNaContaQueJaTenho() {
    guardarConviteEmEspera(token)
    router.push({
      pathname: '/entrar',
      params: { modo: 'email', ...(email.trim() ? { email: email.trim() } : {}) },
    })
  }

  if (travado) {
    return (
      <QuadroDeAcesso titulo="Criar conta" semVoltar chaveDoPasso="travado">
        <CadastroTravado
          aoVoltar={() => {
            guardarConviteEmEspera(token)
            router.replace('/entrar')
          }}
        />
      </QuadroDeAcesso>
    )
  }

  if (passo === 'inicio') {
    return (
      <QuadroDeAcesso
        titulo="Crie sua conta"
        apoio={`Crie sua conta para participar da ${comunidade}.`}
        semVoltar
        chaveDoPasso="inicio"
        direcao={direcao}
        refDoTitulo={titulo}
      >
        {cartaoDoConvite}
        <EntradaComProvedores aoComecar={() => guardarConviteEmEspera(token)} />
        <BotaoDeAcesso
          marca="email"
          nivel={provedores === 0 ? 'primario' : provedores === 1 ? 'secundario' : 'terciario'}
          titulo="Criar conta com e-mail"
          aoPressionar={() => irPara('dados')}
        />
        <LinkDeAcesso
          tamanho="rodape"
          rotulo="Já tem conta? Entrar"
          dica="Depois de entrar, você volta para este convite."
          aoPressionar={entrarNaContaQueJaTenho}
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
    return (
      <QuadroDeAcesso
        titulo="Seu e-mail e sua senha"
        apoio="Use o e-mail que você mais olha: é com ele que você entra."
        aoVoltar={() => irPara('inicio')}
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
            apoio={statusDaSenha(senha).texto}
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
            <LinkDeAcesso rotulo="Entrar" aoPressionar={entrarNaContaQueJaTenho}>
              <Texto variante="botao" cor="destaque">
                Entrar
              </Texto>
            </LinkDeAcesso>
          </View>
        ) : null}
      </QuadroDeAcesso>
    )
  }

  if (passo === 'idade') {
    const continuar = () => {
      if (nome.trim().length < 2) {
        setErros({ nome: 'Digite seu nome.' })
        setDisparoDeErro((n) => n + 1)
        return
      }
      setErros({})
      if (!faixa || faixa === 'menos_16' || !termos) return
      irPara('fe')
    }
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
        carregando={false}
        aoVoltar={() => irPara('dados')}
        aoConfirmar={continuar}
        rotuloDoBotao="Continuar"
        refDoTitulo={titulo}
        chaveDoPasso="idade"
      />
    )
  }

  const motivoDaFe = motivoDoConsentimento(fe, adolescente, responsavel)
  const senhaFraca = ehErroDaApi(concluir.error, 'senha_fraca') ? concluir.error.mensagem : null
  const outroErro = concluir.error && !senhaFraca && !jaTemConta
  return (
    <QuadroDeAcesso
      titulo={`Participar da ${comunidade}`}
      aoVoltar={() => irPara('idade')}
      chaveDoPasso="fe"
      direcao={direcao}
      refDoTitulo={titulo}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Criar conta e participar"
            rotuloAcessivel={`Criar conta e participar da ${comunidade}`}
            tamanho="alto"
            aoPressionar={() => {
              if (!motivoDaFe) concluir.mutate()
            }}
            carregando={concluir.isPending}
            desabilitado={motivoDaFe !== null}
            {...(motivoDaFe ? { motivo: motivoDaFe } : {})}
          />
        </BarraDeAcao>
      }
    >
      <ConsentimentoDeFe
        comunidade={comunidade}
        marcada={fe}
        aoMudar={setFe}
        pedirResponsavel={adolescente}
        responsavel={responsavel}
        aoMudarResponsavel={setResponsavel}
      />
      {outroErro ? <AvisoDeFalha erro={concluir.error} /> : null}
    </QuadroDeAcesso>
  )
}
