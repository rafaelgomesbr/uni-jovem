import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { nomeDoAparelho, plataformaAtual } from '@/servicos/aparelho'
import { api } from '@/servicos/api'
import type { SessaoAberta } from '@/servicos/contrato'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { ehErroDaApi } from '@/servicos/erros'
import { normalizarWhatsApp } from '@/utilidades/formatos'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { focar, type NoDeView } from '@/ui/foco'
import { Texto } from '@/ui/Texto'

import { problemaDaSenha } from '../autenticacao/politicaDeSenha'
import { RegrasDaSenha } from '../autenticacao/RegrasDaSenha'
import {
  AceiteDosTermos,
  ConsentimentoDeFe,
  MenorDe16,
  motivoDoConsentimento,
  PerguntaDeIdade,
} from './Consentimentos'
import { guardarConviteEmEspera } from './conviteEmEspera'

type Passo = 'dados' | 'codigo' | 'senha'

interface Erros {
  nome?: string
  email?: string
  whatsapp?: string
  codigo?: string
  senha?: string
}

const CODIGO_ERRADO = new Set(['codigo_invalido', 'codigo_vencido'])

/**
 * Conta nova pelo convite: dados, idade (TC-01) e Termos (TC-02); código de 6
 * números enviado por e-mail; senha e o consentimento sobre a fé (TC-03).
 * Menor de 16 para no primeiro passo, sem enviar nada.
 */
export function CadastroPorConvite({ token, comunidade }: { token: string; comunidade: string }) {
  const sessao = useSessao()
  const [passo, setPassoAtual] = useState<Passo>('dados')
  // Ao trocar de passo, o que tinha o foco some: o indicador do passo novo recebe o foco.
  const [trocouDePasso, setTrocouDePasso] = useState(false)
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
        '/api/auth/convite/concluir',
        {
          token,
          verificacaoId,
          codigo: codigo.trim(),
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

  if (passo === 'dados') {
    const enviarDados = () => {
      const novos: Erros = {}
      if (!nome.trim()) novos.nome = 'Informe seu nome.'
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) novos.email = 'Informe um e-mail válido.'
      if (whatsapp.trim() && !whatsappNormalizado) {
        novos.whatsapp = 'Informe o WhatsApp com DDD, por exemplo (11) 91234-5678.'
      }
      setErros(novos)
      if (Object.keys(novos).length === 0) iniciar.mutate()
    }
    const motivoDosDados =
      faixa === null
        ? 'Responda quantos anos você tem.'
        : !termos
          ? 'Para criar a conta, é preciso concordar com os Termos de Uso.'
          : null
    return (
      <Cartao titulo="Crie sua conta" icone="convidar">
        <IndicadorDePasso numero={1} titulo="Crie sua conta" focar={trocouDePasso} />
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
          rotulo="WhatsApp (opcional)"
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
          onSubmitEditing={enviarDados}
        />
        <PerguntaDeIdade valor={faixa} aoMudar={setFaixa} />
        {faixa === 'menos_16' ? (
          <MenorDe16 />
        ) : (
          <>
            <AceiteDosTermos marcada={termos} aoMudar={setTermos} />
            {iniciar.error ? <AvisoDeErro erro={iniciar.error} /> : null}
            <Botao
              titulo="Enviar código"
              aoPressionar={enviarDados}
              carregando={iniciar.isPending}
              desabilitado={motivoDosDados !== null}
              {...(motivoDosDados ? { motivo: motivoDosDados } : {})}
            />
          </>
        )}
        <Botao
          titulo="Já tenho conta: entrar"
          variante="discreto"
          aoPressionar={() => {
            guardarConviteEmEspera(token)
            router.push('/entrar')
          }}
          dica="Depois de entrar, você volta para este convite."
        />
      </Cartao>
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
    return (
      <Cartao titulo="Confira seu e-mail" icone="email">
        <IndicadorDePasso numero={2} titulo="Confira seu e-mail" focar={trocouDePasso} />
        <Texto accessibilityLiveRegion="polite">
          Mandamos uma mensagem para {email.trim()}. Se for uma conta nova, ela traz um código de 6
          números que vale por 10 minutos.
        </Texto>
        <Texto variante="apoio" cor="textoSuave">
          Se este e-mail já tem conta, a mensagem explica como entrar nela e aceitar o convite. Não
          chegou? Olhe a caixa de spam.
        </Texto>
        <Campo
          rotulo="Código de 6 números"
          value={codigo}
          onChangeText={setCodigo}
          erro={erros.codigo ?? null}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          onSubmitEditing={enviarCodigo}
        />
        <Botao titulo="Continuar" aoPressionar={enviarCodigo} />
        {iniciar.error ? <AvisoDeErro erro={iniciar.error} /> : null}
        <Botao
          titulo="Mandar outro código"
          variante="secundario"
          aoPressionar={() => iniciar.mutate()}
          carregando={iniciar.isPending}
        />
        <Botao
          titulo="Corrigir meus dados"
          variante="discreto"
          aoPressionar={() => setPasso('dados')}
        />
      </Cartao>
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

  return (
    <Cartao titulo="Crie sua senha" icone="chave">
      <IndicadorDePasso numero={3} titulo="Crie sua senha" focar={trocouDePasso} />
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
      <ConsentimentoDeFe
        comunidade={comunidade}
        marcada={fe}
        aoMudar={setFe}
        pedirResponsavel={adolescente}
        responsavel={responsavel}
        aoMudarResponsavel={setResponsavel}
      />
      {outroErro ? <AvisoDeErro erro={concluir.error} /> : null}
      <Botao
        titulo={`Criar conta e entrar em ${comunidade}`}
        aoPressionar={enviarSenha}
        carregando={concluir.isPending}
        desabilitado={motivoDaFe !== null}
        {...(motivoDaFe ? { motivo: motivoDaFe } : {})}
      />
      <Botao
        titulo="Voltar ao código"
        variante="discreto"
        aoPressionar={() => setPasso('codigo')}
      />
    </Cartao>
  )
}

/**
 * "Passo 2 de 3", visível e anunciado como cabeçalho. Quando o passo muda,
 * recebe o foco do leitor de tela (o botão que a pessoa tocou deixou de existir).
 */
function IndicadorDePasso({
  numero,
  titulo,
  focar: deveFocar,
}: {
  numero: number
  titulo: string
  focar: boolean
}) {
  const ref = useRef<NoDeView>(null)
  useEffect(() => {
    if (deveFocar) focar(ref)
  }, [deveFocar])
  return (
    <View
      ref={ref}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Passo ${numero} de 3: ${titulo}`}
    >
      <Texto variante="apoio" cor="textoSuave">
        Passo {numero} de 3
      </Texto>
    </View>
  )
}
