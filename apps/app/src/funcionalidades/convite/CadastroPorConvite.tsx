import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { CADASTRO_SIMPLIFICADO } from '@uj/dominio'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useSessao } from '@/estado/sessao'
import { nomeDoAparelho, plataformaAtual } from '@/servicos/aparelho'
import { api } from '@/servicos/api'
import type { SessaoAberta } from '@/servicos/contrato'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { ehErroDaApi } from '@/servicos/erros'
import { AvisoDeFalha } from '@/ui/Falha'
import { normalizarWhatsApp } from '@/utilidades/formatos'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { focar, type NoDeTexto } from '@/ui/foco'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { CabecalhoDeAcesso } from '../autenticacao/CabecalhoDeAcesso'
import { problemaDaSenha } from '../autenticacao/politicaDeSenha'
import { RegrasDaSenha } from '../autenticacao/RegrasDaSenha'
import { EntradaComProvedores } from '../autenticacao/provedores/EntradaComProvedores'
import {
  AceiteDosTermos,
  CadastroTravado,
  ConsentimentoDeFe,
  MenorDe16,
  motivoDoConsentimento,
  PerguntaDeIdade,
} from './Consentimentos'
import { guardarConviteEmEspera } from './conviteEmEspera'
import { useCadastroTravado } from './travaDeIdade'

type Passo = 'dados' | 'codigo' | 'senha'

const NUMERO: Readonly<Record<Passo, number>> = { dados: 1, codigo: 2, senha: 3 }
const TITULO: Readonly<Record<Passo, string>> = {
  dados: 'Seus dados',
  codigo: 'Confira seu e-mail',
  senha: 'Crie sua senha',
}

interface Erros {
  nome?: string
  email?: string
  whatsapp?: string
  codigo?: string
  senha?: string
}

const CODIGO_ERRADO = new Set(['codigo_invalido', 'codigo_vencido'])

/**
 * Conta nova pelo convite (3.1.2), em 3 passos com o cabeçalho de passos:
 * 1. Seus dados (nome, WhatsApp, e-mail, idade TC-01 e Termos TC-02);
 * 2. Código de 6 números enviado por e-mail;
 * 3. Senha e o consentimento sobre a fé (TC-03).
 * A ação principal fica na barra de ação; menor de 16 para no primeiro passo.
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
  const [passo, setPassoAtual] = useState<Passo>('dados')
  // Ao trocar de passo, o que tinha o foco some: o título do passo novo recebe o foco.
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
  const [whatsapp, setWhatsapp] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [verificacaoId, setVerificacaoId] = useState<string | null>(null)
  const [erros, setErros] = useState<Erros>({})
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null)
  const [termos, setTermos] = useState(false)
  const [fe, setFe] = useState(false)
  const [responsavel, setResponsavel] = useState(false)
  const adolescente = faixa === '16_17'
  const travado = useCadastroTravado()

  const whatsappNormalizado = normalizarWhatsApp(whatsapp)

  const iniciar = useMutation({
    mutationFn: () =>
      api.post<{ verificacaoId: string }>(
        '/api/auth/convite/iniciar',
        {
          token,
          nome: nome.trim(),
          email: email.trim(),
          ...(whatsappNormalizado ? { whatsapp: whatsappNormalizado } : {}),
          ...(faixa ? { faixaEtaria: faixa } : {}),
        },
        { autenticado: false },
      ),
    onSuccess: (r) => {
      setVerificacaoId(r.verificacaoId)
      setCodigo('')
      setPasso('codigo')
    },
  })

  const concluir = useMutation({
    mutationFn: async () => {
      const resposta = await api.post<SessaoAberta>(
        CADASTRO_SIMPLIFICADO ? '/api/auth/convite/criar' : '/api/auth/convite/concluir',
        {
          token,
          ...(CADASTRO_SIMPLIFICADO
            ? {
                email: email.trim(),
                aceites: { termos, responsavelCiente: adolescente && responsavel },
              }
            : {}),
          ...(!CADASTRO_SIMPLIFICADO ? { verificacaoId, codigo: codigo.trim() } : {}),
          nome: nome.trim(),
          ...(whatsappNormalizado ? { whatsapp: whatsappNormalizado } : {}),
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
      await sessao.abrirSessao(resposta)
    },
    onSuccess: () => router.replace('/'),
    onError: (erro) => {
      if (ehErroDaApi(erro) && CODIGO_ERRADO.has(erro.codigo)) {
        setErros({ codigo: erro.mensagem })
        setPasso('codigo')
      }
    },
  })

  const moldura = (barra: ReactNode, conteudo: ReactNode) => (
    <Tela
      pilha
      semVoltar
      aurora={1}
      passos={{
        atual: CADASTRO_SIMPLIFICADO && passo === 'senha' ? 2 : NUMERO[passo],
        total: CADASTRO_SIMPLIFICADO ? 2 : 3,
      }}
      titulo={TITULO[passo]}
      refDoTitulo={titulo}
      {...(barra ? { barraDeAcao: barra } : {})}
    >
      {conteudo}
    </Tela>
  )

  if (travado) {
    return moldura(
      null,
      <CadastroTravado
        aoVoltar={() => {
          guardarConviteEmEspera(token)
          router.replace('/entrar')
        }}
      />,
    )
  }

  if (passo === 'dados') {
    const enviarDados = () => {
      const novos: Erros = {}
      if (!nome.trim()) novos.nome = 'Informe seu nome.'
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) novos.email = 'Informe um e-mail válido.'
      if (whatsapp.trim() && !whatsappNormalizado) {
        novos.whatsapp = 'Use o formato com DDD, como (11) 91234-5678.'
      }
      setErros(novos)
      if (Object.keys(novos).length === 0) {
        if (CADASTRO_SIMPLIFICADO) setPasso('senha')
        else iniciar.mutate()
      }
    }
    const motivoDosDados =
      faixa === null
        ? 'Responda quantos anos você tem.'
        : !termos
          ? 'Para criar a conta, é preciso concordar com os Termos de Uso.'
          : null
    const menor = faixa === 'menos_16'
    return moldura(
      menor ? null : (
        <BarraDeAcao>
          <Botao
            titulo={CADASTRO_SIMPLIFICADO ? 'Continuar' : 'Enviar código'}
            tamanho="grande"
            aoPressionar={enviarDados}
            carregando={iniciar.isPending}
            desabilitado={motivoDosDados !== null}
            {...(motivoDosDados ? { motivo: motivoDosDados } : {})}
          />
        </BarraDeAcao>
      ),
      <>
        {cartaoDoConvite}
        <CabecalhoDeAcesso
          semMarca
          apoio={
            CADASTRO_SIMPLIFICADO
              ? 'Crie sua conta para entrar na comunidade. Não precisa confirmar o e-mail: é só preencher e entrar.'
              : 'Crie sua conta para entrar na comunidade.'
          }
        />
        {!menor ? (
          <EntradaComProvedores
            aoComecar={() => guardarConviteEmEspera(token)}
            separador="ou crie com e-mail"
          />
        ) : null}
        <CartaoDeVidro intervalo={ESPACO.e16}>
          <Campo
            rotulo="Nome"
            value={nome}
            onChangeText={setNome}
            erro={erros.nome ?? null}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
          />
          <Campo
            rotulo="WhatsApp"
            opcional
            ajuda="Com DDD. Fora do Brasil, comece com + e o código do país."
            exemplo="(11) 91234-5678"
            value={whatsapp}
            onChangeText={setWhatsapp}
            erro={erros.whatsapp ?? null}
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <Campo
            rotulo="E-mail"
            ajuda={
              CADASTRO_SIMPLIFICADO
                ? 'É com este e-mail que você vai entrar. Não precisa confirmar.'
                : 'Vamos mandar um código de 6 números para confirmar.'
            }
            value={email}
            onChangeText={setEmail}
            erro={erros.email ?? null}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={enviarDados}
          />
        </CartaoDeVidro>
        <PerguntaDeIdade valor={faixa} aoMudar={setFaixa} />
        {menor ? (
          <MenorDe16 />
        ) : (
          <CartaoDeVidro>
            <AceiteDosTermos marcada={termos} aoMudar={setTermos} />
          </CartaoDeVidro>
        )}
        {iniciar.error ? <AvisoDeFalha erro={iniciar.error} /> : null}
        <Botao
          titulo="Já tenho conta: entrar"
          variante="terciario"
          alinhado
          aoPressionar={() => {
            guardarConviteEmEspera(token)
            router.push('/entrar')
          }}
          dica="Depois de entrar, você volta para este convite."
        />
      </>,
    )
  }

  if (passo === 'codigo') {
    const enviarCodigo = () => {
      if (!/^\d{6}$/.test(codigo.trim())) {
        setErros({ codigo: 'O código tem 6 números.' })
        return
      }
      setErros({})
      setPasso('senha')
    }
    return moldura(
      <BarraDeAcao>
        <Botao
          titulo="Mandar outro código"
          variante="secundario"
          tamanho="grande"
          aoPressionar={() => iniciar.mutate()}
          carregando={iniciar.isPending}
        />
        <Botao titulo="Continuar" tamanho="grande" aoPressionar={enviarCodigo} />
      </BarraDeAcao>,
      <>
        <CartaoDeVidro intervalo={ESPACO.e16}>
          <Texto variante="corpo" accessibilityLiveRegion="polite">
            Mandamos uma mensagem para {email.trim()}. Se for uma conta nova, ela traz um código de
            6 números que vale por 10 minutos.
          </Texto>
          <Campo
            rotulo="Código de 6 números"
            value={codigo}
            onChangeText={setCodigo}
            erro={erros.codigo ?? null}
            codigo
            ajuda="Não chegou? Olhe a caixa de spam. Se o e-mail já tem conta, a mensagem explica como entrar."
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            onSubmitEditing={enviarCodigo}
          />
        </CartaoDeVidro>
        {iniciar.error ? <AvisoDeFalha erro={iniciar.error} /> : null}
        <Botao
          titulo="Corrigir meus dados"
          variante="terciario"
          alinhado
          aoPressionar={() => setPasso('dados')}
        />
      </>,
    )
  }

  const motivoDaFe = motivoDoConsentimento(fe, adolescente, responsavel)
  const enviarSenha = () => {
    if (motivoDaFe) return
    const problema = problemaDaSenha(senha, confirmacao, { nome, email })
    setErros(problema ? { senha: problema } : {})
    if (!problema) concluir.mutate()
  }
  const senhaFraca = ehErroDaApi(concluir.error, 'senha_fraca') ? concluir.error.mensagem : null
  const outroErro =
    concluir.error &&
    !senhaFraca &&
    !(ehErroDaApi(concluir.error) && CODIGO_ERRADO.has(concluir.error.codigo))

  return moldura(
    <BarraDeAcao>
      <Botao
        titulo="Criar conta e entrar"
        tamanho="grande"
        rotuloAcessivel={`Criar conta e entrar em ${comunidade}`}
        aoPressionar={enviarSenha}
        carregando={concluir.isPending}
        desabilitado={motivoDaFe !== null}
        {...(motivoDaFe ? { motivo: motivoDaFe } : {})}
      />
    </BarraDeAcao>,
    <>
      <CartaoDeVidro intervalo={ESPACO.e16}>
        <RegrasDaSenha senha={senha} nome={nome} email={email} />
        <Campo
          rotulo="Senha"
          senha
          value={senha}
          onChangeText={setSenha}
          erro={erros.senha ?? senhaFraca}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Campo
          rotulo="Repita a senha"
          senha
          value={confirmacao}
          onChangeText={setConfirmacao}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={enviarSenha}
        />
      </CartaoDeVidro>
      <CartaoDeVidro>
        <ConsentimentoDeFe
          comunidade={comunidade}
          marcada={fe}
          aoMudar={setFe}
          pedirResponsavel={adolescente}
          responsavel={responsavel}
          aoMudarResponsavel={setResponsavel}
        />
      </CartaoDeVidro>
      {outroErro ? <AvisoDeFalha erro={concluir.error} /> : null}
      <Botao
        titulo={CADASTRO_SIMPLIFICADO ? 'Corrigir meus dados' : 'Voltar ao código'}
        variante="terciario"
        alinhado
        aoPressionar={() => setPasso(CADASTRO_SIMPLIFICADO ? 'dados' : 'codigo')}
      />
    </>,
  )
}
