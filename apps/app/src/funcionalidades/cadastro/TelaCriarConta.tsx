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
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { focar, type NoDeTexto } from '@/ui/foco'
import { useConfirmarDescarte, useTravaDeEnvio } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { problemaDaSenha } from '../autenticacao/politicaDeSenha'
import {
  EntradaComProvedores,
  useTemProvedor,
} from '../autenticacao/provedores/EntradaComProvedores'
import { RegrasDaSenha } from '../autenticacao/RegrasDaSenha'
import {
  AceiteDosTermos,
  CadastroTravado,
  MenorDe16,
  PerguntaDeIdade,
} from '../convite/Consentimentos'
import { useCadastroTravado } from '../convite/travaDeIdade'

type Passo = 'dados' | 'codigo'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODIGO_ERRADO = new Set(['codigo_invalido', 'codigo_vencido'])

interface Erros {
  nome?: string
  email?: string
  codigo?: string
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
 * Criar conta por e-mail (ADR 0007), em 2 passos:
 * 1. Seus dados: nome, e-mail, idade (TC-01) e os Termos (TC-02);
 * 2. Código de 6 números que chegou por e-mail e a senha, numa tela só.
 * O código e a senha vão juntos: quem erra o código corrige ali mesmo, sem
 * digitar a senha de novo (U-10). A conta nasce sem comunidade e cai em
 * "Comece por aqui".
 */
export function TelaCriarConta() {
  const sessao = useSessao()
  const [passo, setPassoAtual] = useState<Passo>('dados')
  const [trocouDePasso, setTrocouDePasso] = useState(false)
  const titulo = useRef<NoDeTexto>(null)
  useEffect(() => {
    if (trocouDePasso) focar(titulo)
  }, [passo, trocouDePasso])
  const setPasso = (novo: Passo) => {
    setTrocouDePasso(true)
    setPassoAtual(novo)
  }

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null)
  const [termos, setTermos] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<Erros>({})
  const trava = useTravaDeEnvio()
  const temProvedor = useTemProvedor()
  const travado = useCadastroTravado()

  const sujo = !!(nome.trim() || email.trim() || codigo.trim() || senha)
  const liberarSaida = useConfirmarDescarte(sujo)

  const iniciar = useMutation({
    mutationFn: () =>
      api.post<unknown>(
        '/api/auth/cadastro/iniciar',
        {
          nome: nome.trim(),
          email: email.trim(),
          faixaEtaria: faixa,
          // A opção de 16 ou 17 anos já declara que o responsável sabe e concorda (TC-01.v2).
          aceites: { termos, ...(faixa === '16_17' ? { responsavelCiente: true } : {}) },
        },
        { autenticado: false },
      ),
    onSuccess: () => {
      setCodigo('')
      setErros({})
      setPasso('codigo')
    },
    onSettled: () => trava.soltar(),
  })

  const concluir = useMutation({
    mutationFn: async () => {
      const resposta = await api.post<SessaoAberta>(
        '/api/auth/cadastro/concluir',
        {
          email: email.trim(),
          codigo: codigo.trim(),
          senha,
          plataforma: plataformaAtual(),
          aparelho: nomeDoAparelho(),
        },
        { autenticado: false },
      )
      // Saída de propósito: a sessão aberta leva ao Início sem perguntar "Descartar?".
      liberarSaida()
      await sessao.abrirSessao(resposta)
    },
    onError: (erro) => {
      if (ehErroDaApi(erro) && CODIGO_ERRADO.has(erro.codigo)) setErros({ codigo: erro.mensagem })
      if (ehErroDaApi(erro, 'senha_fraca')) setErros({ senha: erro.mensagem })
    },
    onSettled: () => trava.soltar(),
  })

  const moldura = (barra: ReactNode, conteudo: ReactNode) => (
    <Tela
      pilha
      aurora={1}
      passos={{ atual: passo === 'dados' ? 1 : 2, total: 2 }}
      titulo={passo === 'dados' ? 'Criar conta' : 'Confira seu e-mail'}
      refDoTitulo={titulo}
      {...(barra ? { barraDeAcao: barra } : {})}
    >
      {conteudo}
    </Tela>
  )

  if (travado) {
    return (
      <Tela pilha aurora={1} titulo="Criar conta">
        <CadastroTravado aoVoltar={() => router.replace('/entrar')} />
      </Tela>
    )
  }

  if (passo === 'dados') {
    const menor = faixa === 'menos_16'
    const indisponivel = cadastroIndisponivel(iniciar.error)
    const motivo =
      faixa === null
        ? 'Responda quantos anos você tem.'
        : !termos
          ? 'Para criar a conta, é preciso concordar com os Termos de Uso.'
          : null
    const enviarDados = () => {
      const novos: Erros = {}
      if (nome.trim().length < 2) novos.nome = 'Informe seu nome.'
      if (!EMAIL.test(email.trim())) novos.email = 'Informe um e-mail válido, como ana@exemplo.com.'
      setErros(novos)
      if (Object.keys(novos).length > 0 || motivo) return
      if (!trava.pegar()) return
      iniciar.mutate()
    }
    return moldura(
      menor ? null : (
        <BarraDeAcao>
          <Botao
            titulo="Enviar código"
            tamanho="grande"
            aoPressionar={enviarDados}
            carregando={iniciar.isPending}
            desabilitado={motivo !== null}
            {...(motivo ? { motivo } : {})}
          />
        </BarraDeAcao>
      ),
      <>
        <Texto variante="corpo" cor="textoSuave">
          Sua conta é sua, não da igreja. Depois você entra numa comunidade ou cria a sua.
        </Texto>
        {indisponivel ? (
          <Aviso tipo="info" titulo="Cadastro por e-mail indisponível agora" anunciar>
            {temProvedor
              ? 'Por enquanto, crie a conta com o Google ou com a Apple. É rápido e não precisa de senha.'
              : 'Por enquanto, não dá para criar conta por e-mail. Tente de novo mais tarde.'}
          </Aviso>
        ) : null}
        {indisponivel && temProvedor ? <EntradaComProvedores /> : null}
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          <Campo
            rotulo="Nome"
            value={nome}
            onChangeText={setNome}
            erro={erros.nome ?? null}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            maxLength={80}
          />
          <Campo
            rotulo="E-mail"
            ajuda="Vamos mandar um código de 6 números para confirmar."
            value={email}
            onChangeText={setEmail}
            erro={erros.email ?? null}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />
        </CartaoDeVidro>
        <PerguntaDeIdade valor={faixa} aoMudar={setFaixa} />
        {menor ? (
          <MenorDe16 />
        ) : (
          <CartaoDeVidro opaco>
            <AceiteDosTermos marcada={termos} aoMudar={setTermos} />
          </CartaoDeVidro>
        )}
        {iniciar.error && !indisponivel ? (
          <AvisoDeFalha erro={iniciar.error} titulo="O código não foi enviado" />
        ) : null}
        <Botao
          titulo="Já tenho conta: entrar"
          variante="terciario"
          alinhado
          aoPressionar={() => {
            liberarSaida()
            router.replace('/entrar')
          }}
        />
      </>,
    )
  }

  const enviarCodigo = () => {
    const novos: Erros = {}
    if (!/^\d{6}$/.test(codigo.trim())) novos.codigo = 'O código tem 6 números.'
    const problema = problemaDaSenha(senha, senha, { nome, email })
    if (problema) novos.senha = problema
    setErros(novos)
    if (Object.keys(novos).length > 0) return
    if (!trava.pegar()) return
    concluir.mutate()
  }
  const jaTemConta = emailJaCadastrado(concluir.error)
  const outroErro =
    concluir.error &&
    !jaTemConta &&
    !(ehErroDaApi(concluir.error) && CODIGO_ERRADO.has(concluir.error.codigo)) &&
    !ehErroDaApi(concluir.error, 'senha_fraca')

  return moldura(
    <BarraDeAcao>
      <Botao
        titulo="Criar conta"
        tamanho="grande"
        aoPressionar={enviarCodigo}
        carregando={concluir.isPending}
      />
    </BarraDeAcao>,
    <>
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <Texto variante="corpo" accessibilityLiveRegion="polite">
          {`Mandamos um código de 6 números para ${email.trim()}. Ele vale por 10 minutos.`}
        </Texto>
        <Campo
          rotulo="Código de 6 números"
          value={codigo}
          onChangeText={setCodigo}
          erro={erros.codigo ?? null}
          codigo
          ajuda="Não chegou? Olhe a caixa de spam ou mande outro código."
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
        />
      </CartaoDeVidro>
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <RegrasDaSenha senha={senha} nome={nome} email={email} />
        <Campo
          rotulo="Crie uma senha"
          senha
          value={senha}
          onChangeText={setSenha}
          erro={erros.senha ?? null}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={enviarCodigo}
        />
      </CartaoDeVidro>
      {jaTemConta ? (
        <View style={{ gap: ESPACO.e8 }}>
          <AvisoDeFalha erro={concluir.error} titulo="Este e-mail já tem conta" />
          <ParDeBotoes>
            <Botao
              titulo="Entrar"
              variante="secundario"
              aoPressionar={() => {
                liberarSaida()
                router.replace('/entrar')
              }}
            />
            <Botao
              titulo="Esqueci a senha"
              variante="secundario"
              aoPressionar={() => {
                liberarSaida()
                router.replace('/recuperar-senha')
              }}
            />
          </ParDeBotoes>
        </View>
      ) : null}
      {outroErro ? <AvisoDeFalha erro={concluir.error} titulo="A conta não foi criada" /> : null}
      {iniciar.error ? (
        <AvisoDeFalha erro={iniciar.error} titulo="O código não foi enviado" />
      ) : null}
      <View style={{ alignItems: 'flex-start' }}>
        <Botao
          titulo="Mandar outro código"
          variante="terciario"
          alinhado
          carregando={iniciar.isPending}
          aoPressionar={() => {
            if (!trava.pegar()) return
            iniciar.mutate()
          }}
        />
        <Botao
          titulo="Corrigir meus dados"
          variante="terciario"
          alinhado
          aoPressionar={() => {
            concluir.reset()
            setPasso('dados')
          }}
        />
      </View>
    </>,
  )
}
