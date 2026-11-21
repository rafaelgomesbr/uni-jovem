import { useMutation } from '@tanstack/react-query'
import { ESPACO, LARGURA_DA_COLUNA_DE_ACESSO, RITMO, RITMO_DE_ACESSO } from '@uj/tokens'
import { router, useIsFocused, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import type { TextInput } from 'react-native'
import { Dimensions, Platform, ScrollView, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSessao, type ResultadoDeEntrar } from '@/estado/sessao'
import { SemConexao } from '@/servicos/erros'
import { anunciar } from '@/ui/anunciar'
import { Aviso } from '@/ui/Aviso'
import { focar, type NoDeTexto, type NoDeView } from '@/ui/foco'
import { FundoAurora } from '@/ui/FundoAurora'
import { useSemConexao } from '@/ui/IndicadorDeConexao'
import { calcularMedidasDoAcesso, calcularMedidasDoPainel } from '@/ui/medidasDoAcesso'
import { ProvedorDeRevelacao, type ModoDeRevelacao } from '@/ui/Revelar'
import { useTecladoAberto } from '@/ui/teclado'
import { useTema } from '@/ui/tema'
import { TrocaDePainel, type PainelDaEntrada } from '@/ui/TrocaDePainel'
import { parametro } from '@/utilidades/parametros'

import { AlteracoesDescartadas } from '../offline/AlteracoesDescartadas'
import { consumirAberturaCompleta } from './aberturaDaEntrada'
import { AcessosDaEntrada, type AcessoEmAndamento } from './AcessosDaEntrada'
import { removerConvitePendente, useConvitePendente } from './convitePendente'
import {
  DICA_DE_CANCELAMENTO,
  emailParecido,
  erroDaEntrada,
  TEXTO_DA_SENHA_VAZIA,
  TEXTO_DO_E_MAIL_INCOMPLETO,
  TEXTO_DO_E_MAIL_VAZIO,
  textoDoErroDoProvedor,
} from './erroDaEntrada'
import { ordemDosAcessos } from './ordemDosAcessos'
import { PainelDeEmail, type ErrosDoPainel } from './PainelDeEmail'
import { PalcoDaEntrada } from './PalcoDaEntrada'
import { pedirCredencialDaApple, useEstadoDaApple } from './provedores/BotaoApple'
import { googleConfigurado } from './provedores/configuracao'
import { segurarRedirecionamento, soltarRedirecionamento } from './sucessoDaEntrada'
import { guardarUltimoMetodo, useUltimoMetodo } from './ultimoMetodo'
import { mostrarToast } from '@/ui/Toast'

type Pedido =
  | { tipo: 'senha' }
  | { tipo: 'google'; idToken: string }
  | { tipo: 'apple' }
  | { tipo: 'biometria' }

/** Quanto o teclado costuma ocupar (a altura de verdade só chega com ele aberto, e o painel não pode pular). */
function tecladoEstimado(altura: number): number {
  if (Platform.OS === 'web') return 0
  if (Platform.OS === 'android') return 300
  return altura <= 700 ? 260 : 336
}

/** Passou de 10 s esperando a entrada: "Ainda entrando...". */
function useDemorou(ativo: boolean): boolean {
  const [demorou, setDemorou] = useState(false)
  // O relógio é um sistema externo: conta enquanto a entrada trabalha e zera ao terminar.
  useEffect(() => {
    if (!ativo) return
    const espera = setTimeout(() => setDemorou(true), 10_000)
    return () => {
      clearTimeout(espera)
      setDemorou(false)
    }
  }, [ativo])
  return demorou
}

/**
 * Entrar (D63, refeita do zero): uma tela só, com revelação progressiva.
 * `entrada.inicio` mostra o sol (a marca), o nome do app e os acessos que a
 * maioria usa; o e-mail e a senha aparecem no lugar, quando pedidos, e o
 * estado vive na rota (`/entrar?modo=email`), então o voltar do sistema fecha
 * o painel em vez de sair da tela. Apple, Google e e-mail em três pesos (um só
 * preenchimento forte por estado), o método usado da última vez sobe e ganha
 * selo, e o Face ID vem primeiro quando há sessão guardada. Cabe sem rolar no
 * iPhone SE. Conta aberta (ADR 0007): Google ou Apple com e-mail novo levam a
 * "Falta pouco"; a conta nasce sem confirmação de e-mail (ADR 0008).
 */
export function TelaEntrar() {
  const sessao = useSessao()
  const { cores } = useTema()
  const semConexao = useSemConexao()
  const margens = useSafeAreaInsets()
  const { height: alturaDaJanela, fontScale } = useWindowDimensions()
  const parametros = useLocalSearchParams<{ modo?: string | string[]; email?: string | string[] }>()
  const focada = useIsFocused()
  const tecladoAberto = useTecladoAberto()

  const estadoDaApple = useEstadoDaApple()
  const apple = estadoDaApple === 'sim'
  const google = googleConfigurado()
  const semProvedor = estadoDaApple === 'nao' && !google
  const ultimoMetodo = useUltimoMetodo()
  const convite = useConvitePendente()
  const { biometria } = sessao

  // O estado do painel vive na rota; sem nenhum provedor, o e-mail já nasce aberto.
  const painel: PainelDaEntrada =
    semProvedor || parametro(parametros.modo) === 'email' ? 'email' : 'inicio'

  const [email, setEmail] = useState(() => parametro(parametros.email) ?? '')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<ErrosDoPainel>({})
  const [disparoDosCampos, setDisparoDosCampos] = useState(0)
  const [balancoDaApple, setBalancoDaApple] = useState(0)
  const [balancoDoGoogle, setBalancoDoGoogle] = useState(0)
  const [falhasDeSenha, setFalhasDeSenha] = useState(0)
  const [cancelamentos, setCancelamentos] = useState(0)
  const [sucesso, setSucesso] = useState(false)
  const [pulso, setPulso] = useState(0)
  // Falha do lado do provedor (antes de chegar à API), com texto pronto.
  const [falhaDoProvedor, setFalhaDoProvedor] = useState<string | null>(null)

  const titulo = useRef<NoDeTexto>(null)
  const tituloDoPainel = useRef<NoDeTexto>(null)
  const botaoDeEmail = useRef<NoDeView>(null)
  const campoDoEmail = useRef<ComponentRef<typeof TextInput>>(null)
  const campoDaSenha = useRef<ComponentRef<typeof TextInput>>(null)

  // Como entra: a cascata completa só na primeira vez da abertura do app; o resto é curto.
  const [modo] = useState<ModoDeRevelacao>(() => {
    const primeira = consumirAberturaCompleta()
    if (painel === 'email') return 'imediata'
    return primeira && !convite ? 'completa' : 'curta'
  })

  // Com leitor de tela, a tela abre lendo o nome do app, não o último foco da tela anterior.
  useEffect(() => {
    if (Platform.OS !== 'web') focar(titulo)
  }, [])

  const entrar = useMutation({
    mutationFn: async (pedido: Pedido): Promise<ResultadoDeEntrar | null> => {
      setFalhaDoProvedor(null)
      // A entrada vai dar o check de 200 ms antes da troca de tela: o guarda espera.
      if (pedido.tipo !== 'biometria') segurarRedirecionamento()
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
    onSuccess: (resultado, pedido) => {
      if (pedido.tipo === 'apple' && resultado === null) {
        soltarRedirecionamento(0)
        setCancelamentos((n) => n + 1)
        return
      }
      setCancelamentos(0)
      if (resultado === 'pronto') {
        // 'pronto': o guarda do grupo público leva para o Início depois de 200 ms.
        if (pedido.tipo !== 'biometria') {
          guardarUltimoMetodo(pedido.tipo === 'senha' ? 'email' : pedido.tipo)
        }
        setSucesso(true)
        setPulso((n) => n + 1)
        anunciar('Você entrou.')
        soltarRedirecionamento()
        return
      }
      soltarRedirecionamento(0)
      if (resultado === 'segundo_fator') {
        if (pedido.tipo !== 'biometria') {
          guardarUltimoMetodo(pedido.tipo === 'senha' ? 'email' : pedido.tipo)
        }
        router.push('/segundo-fator')
      }
      if (resultado === 'cadastro_pendente') router.push('/completar-cadastro')
    },
    onError: (erro, pedido) => {
      soltarRedirecionamento(0)
      setCancelamentos(0)
      if (pedido.tipo === 'apple') setBalancoDaApple((n) => n + 1)
      if (pedido.tipo === 'google') setBalancoDoGoogle((n) => n + 1)
      if (pedido.tipo === 'senha') {
        setDisparoDosCampos((n) => n + 1)
        if (erroDaEntrada(erro).tipo === 'credencial') setFalhasDeSenha((n) => n + 1)
      }
    },
  })
  const emAndamento: AcessoEmAndamento | null = entrar.isPending ? entrar.variables.tipo : null
  const demorando = useDemorou(emAndamento === 'senha')

  const itens = ordemDosAcessos({
    plataforma: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    apple,
    google,
    biometria: biometria.travada,
    ultimoMetodo,
  })
  const doAcesso = itens.filter((i) => i.marca !== 'biometria')

  // Medidas: o sol cresce enquanto sobra espaço; o apoio some e a rolagem liga só no aperto.
  const altura = Platform.OS === 'android' ? Dimensions.get('screen').height : alturaDaJanela
  const medidas = calcularMedidasDoAcesso({
    altura,
    topo: margens.top,
    base: margens.bottom,
    fonte: fontScale,
    acessos: doAcesso.length >= 3 ? 3 : 2,
    terciario: doAcesso.at(-1)?.nivel === 'terciario',
    temSelo: doAcesso.some((i) => i.selo),
    temConvite: convite !== null,
    temBiometria: biometria.travada,
  })
  const medidasDoPainel = calcularMedidasDoPainel({
    altura,
    topo: margens.top,
    teclado: tecladoEstimado(altura),
    fonte: fontScale,
  })

  // O erro aparece perto de quem o causou: do provedor, no lugar do apoio; da senha, acima do botão.
  const erroDoPedido = entrar.error ? entrar.variables?.tipo : null
  const provedorComErro =
    erroDoPedido === 'google' || erroDoPedido === 'apple' ? erroDoPedido : null
  const erroDoProvedor = provedorComErro
    ? textoDoErroDoProvedor(entrar.error, provedorComErro)
    : falhaDoProvedor
  const erroGeral =
    entrar.error && entrar.variables?.tipo === 'senha' ? erroDaEntrada(entrar.error) : null
  const tentarDeNovo =
    entrar.error instanceof SemConexao && entrar.variables
      ? () => entrar.mutate(entrar.variables)
      : undefined

  function enviar() {
    if (emAndamento) return
    const novos: ErrosDoPainel = {}
    if (!email.trim()) novos.email = TEXTO_DO_E_MAIL_VAZIO
    else if (!emailParecido(email)) novos.email = TEXTO_DO_E_MAIL_INCOMPLETO
    if (!senha) novos.senha = TEXTO_DA_SENHA_VAZIA
    setErros(novos)
    if (novos.email || novos.senha) {
      setDisparoDosCampos((n) => n + 1)
      // O foco vai ao primeiro campo com erro.
      if (novos.email) campoDoEmail.current?.focus()
      else campoDaSenha.current?.focus()
      return
    }
    entrar.mutate({ tipo: 'senha' })
  }

  function mudarEmail(texto: string) {
    setEmail(texto)
    if (entrar.isError) entrar.reset()
    // O erro some assim que o valor fica certo (e não a cada tecla errada).
    if (erros.email && emailParecido(texto)) setErros((e) => ({ ...e, email: undefined }))
  }

  function mudarSenha(texto: string) {
    setSenha(texto)
    if (entrar.isError) entrar.reset()
    if (erros.senha && texto) setErros((e) => ({ ...e, senha: undefined }))
  }

  // Erro por campo ao sair do campo, sem gritar a cada tecla e sem balanço.
  function aoSairDoEmail() {
    if (email.trim() && !emailParecido(email)) {
      setErros((e) => ({ ...e, email: TEXTO_DO_E_MAIL_INCOMPLETO }))
    }
  }

  function abrirEmail() {
    router.push({ pathname: '/entrar', params: { modo: 'email' } })
  }

  function fecharEmail() {
    if (router.canGoBack()) router.back()
    else router.setParams({ modo: undefined })
  }

  function aoAssentar(qual: PainelDaEntrada) {
    // O foco só vai ao campo depois que o painel assentou: o teclado não abre no meio do movimento.
    if (qual === 'email') campoDoEmail.current?.focus()
    else focar(botaoDeEmail)
  }

  function esquecerSenha() {
    router.push({
      pathname: '/recuperar-senha',
      params: email.trim() ? { email: email.trim() } : {},
    })
  }

  function removerConvite() {
    const desfazer = removerConvitePendente()
    mostrarToast({
      texto: 'Convite removido.',
      acao: { titulo: 'Desfazer', aoPressionar: desfazer },
    })
  }

  const colunaDaTela = {
    flex: 1,
    width: '100%',
    maxWidth: LARGURA_DA_COLUNA_DE_ACESSO + RITMO.margemDaTela * 2,
    paddingHorizontal: RITMO.margemDaTela,
  } as const

  const camadaDosAcessos = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        paddingTop: margens.top,
        paddingBottom: margens.bottom + ESPACO.e12,
      }}
    >
      <View style={colunaDaTela}>
        <AlteracoesDescartadas />
        {semConexao ? (
          <View style={{ paddingTop: RITMO.topoDaTela }}>
            <Aviso tipo="alerta" titulo="Sem internet">
              Para entrar, o aparelho precisa estar conectado.
            </Aviso>
          </View>
        ) : null}
        <View style={{ flex: 2, minHeight: RITMO_DE_ACESSO.respiroMinimo }} />
        <PalcoDaEntrada
          sol={medidas.sol}
          mostraApoio={medidas.mostraApoio}
          etapaDoSol={modo === 'completa' ? 'abertura' : 'estatica'}
          pulso={pulso}
          erroDoProvedor={erroDoProvedor}
          dica={cancelamentos >= 2 ? DICA_DE_CANCELAMENTO : null}
          aoTentarDeNovo={provedorComErro ? tentarDeNovo : undefined}
          convite={convite}
          aoRemoverConvite={removerConvite}
          refDoTitulo={titulo}
        />
        <View style={{ flex: 3, minHeight: RITMO_DE_ACESSO.respiroMinimo }} />
        <AcessosDaEntrada
          itens={itens}
          emAndamento={emAndamento}
          sucesso={sucesso}
          balancoDaApple={balancoDaApple}
          balancoDoGoogle={balancoDoGoogle}
          nomeDaBiometria={biometria.nome}
          aoPedirApple={() => entrar.mutate({ tipo: 'apple' })}
          aoObterTokenDoGoogle={(idToken) => entrar.mutate({ tipo: 'google', idToken })}
          aoFalharGoogle={(mensagem) => {
            entrar.reset()
            setFalhaDoProvedor(mensagem)
            setBalancoDoGoogle((n) => n + 1)
          }}
          aoCancelarProvedor={() => setCancelamentos((n) => n + 1)}
          aoEscolherEmail={abrirEmail}
          aoUsarBiometria={() => entrar.mutate({ tipo: 'biometria' })}
          aoCriarConta={() => router.push('/criar-conta')}
          aoAbrirConvite={() => router.push('/colar-convite')}
          temConvite={convite !== null}
          refDoEmail={botaoDeEmail}
        />
      </View>
    </ScrollView>
  )

  return (
    <ProvedorDeRevelacao value={modo}>
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        {/* A aurora é o céu: nasce com o sol e deriva devagar; para com o teclado do e-mail. */}
        <FundoAurora
          intensidade={1}
          movimento="ambiente"
          amanhecer={modo === 'completa'}
          pausada={!focada || (painel === 'email' && tecladoAberto)}
        />
        <TrocaDePainel
          painel={painel}
          aoAssentar={aoAssentar}
          inicio={camadaDosAcessos}
          email={
            <PainelDeEmail
              email={email}
              senha={senha}
              aoMudarEmail={mudarEmail}
              aoMudarSenha={mudarSenha}
              erros={erros}
              disparoDeErro={disparoDosCampos}
              erroGeral={erroGeral}
              falhasDeSenha={falhasDeSenha}
              carregando={emAndamento === 'senha'}
              demorando={demorando}
              sucesso={sucesso}
              tituloVisivel={medidasDoPainel.tituloVisivel}
              ritmo={medidasDoPainel.ritmo}
              aoSairDoEmail={aoSairDoEmail}
              aoIrParaSenha={() => campoDaSenha.current?.focus()}
              aoEnviar={enviar}
              aoVoltar={fecharEmail}
              aoEsquecerSenha={esquecerSenha}
              aoCriarConta={() => router.push('/criar-conta')}
              aoTentarDeNovo={() => tentarDeNovo?.()}
              refDoTitulo={tituloDoPainel}
              refDoEmail={campoDoEmail}
              refDaSenha={campoDaSenha}
              semConexao={semConexao}
            />
          }
        />
      </View>
    </ProvedorDeRevelacao>
  )
}
