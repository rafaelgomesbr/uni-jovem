import { ESPACO, RAIO } from '@uj/tokens'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import * as Clipboard from 'expo-clipboard'
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { Linking, Platform, View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import type { ResultadoDaEntrada } from '@/servicos/contrato'
import type { PreviaDoCodigo } from '@/servicos/contratoV3'
import { anunciar } from '@/ui/anunciar'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Esqueleto, EsqueletoDoMomento } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { useSemConexao } from '@/ui/IndicadorDeConexao'
import { useConfirmarDescarte, useTravaDeEnvio } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { parametro } from '@/utilidades/parametros'

import { abrirConvite, lerTokenDoConvite } from '../comunidade/TelaEntrarComConvite'
import { CamposDoConsentimento, useConsentimentoDaEntrada } from './ConsentimentoDaEntrada'
import {
  CODIGO_NAO_ENCONTRADO,
  formatarCodigoDaComunidade,
  lerCodigoDaComunidade,
  MAXIMO_DA_MENSAGEM,
  tipoDoErroDaPrevia,
  useEntrarComCodigo,
  usePreviaDoCodigo,
} from './consultas'
import { PedidoEnviado } from './PedidoEnviado'
import { PreviaDaComunidade } from './PreviaDaComunidade'
import { AvisoDoPedido, ajudaDaMensagem } from './TextosDoPedido'

/** Quando a prévia ainda não sabe o nome (código incompleto, limite de consultas, sem internet). */
const COMUNIDADE_DO_CODIGO = 'comunidade deste código'
/** O visor da câmera ocupa a largura do cartão até 320 (não há token de layout para o visor). */
const LADO_MAXIMO_DO_VISOR = 320
const NAO_RECONHECIDO =
  'Não reconhecemos esse código. Ele tem 8 letras e números, como ABCD 2345. Se recebeu um link, cole o link inteiro.'
const CODIGO_DO_LINK_INVALIDO =
  'O código deste link não parece certo. Ele tem 8 letras e números, como ABCD 2345. Digite o código que a liderança passou ou cole o link inteiro.'
const MENSAGEM_DO_LIMITE =
  'Muitas consultas agora. A prévia volta em alguns minutos, mas você ainda pode entrar com o código.'

/**
 * "Tenho um código" (UX v3, fluxos a e j): a única tela de código, com ou sem link. Um campo aceita
 * o código da comunidade (8 caracteres), o link do código ou o link de um convite; o QR é lido pela
 * câmera aqui mesmo e "Colar" traz o que foi copiado do WhatsApp. Com o código completo, a PRÉVIA
 * PÚBLICA mostra "Você foi convidado para <comunidade>" (cor, pessoas e próximo encontro público)
 * ANTES de pedir qualquer coisa: o consentimento sobre a fé (TC-03.v4) vem depois dela, logo acima
 * do botão, e a mensagem para a liderança (TC-17) é opcional e fica atrás de um link.
 */
export function TelaTenhoUmCodigo() {
  const [texto, setTexto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [comMensagem, setComMensagem] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // O link do código (`/entrar/<codigo>`) chega pelo parâmetro `codigo` (D58).
  const doLink = parametro(useLocalSearchParams<{ codigo?: string | string[] }>().codigo)
  const [linkAplicado, setLinkAplicado] = useState<string | null>(null)
  const [preenchido, setPreenchido] = useState('')
  // Preenche o campo uma vez por link, durante a renderização (sem efeito). Nunca envia
  // sozinho: o consentimento e o botão continuam sendo da pessoa.
  if (doLink !== null && doLink !== linkAplicado) {
    const lido = lerCodigoDaComunidade(doLink)
    setLinkAplicado(doLink)
    setPreenchido(lido ?? '')
    setTexto(lido ?? '')
    setErro(lido ? null : CODIGO_DO_LINK_INVALIDO)
  }
  const [camera, setCamera] = useState(false)
  const semConexao = useSemConexao()
  const entrar = useEntrarComCodigo()
  const consentimento = useConsentimentoDaEntrada()
  const trava = useTravaDeEnvio()
  const pedido = entrar.data?.resultado === 'pedido_pendente' ? entrar.data : null
  const liberarSaida = useConfirmarDescarte(
    !entrar.isSuccess && !!((texto.trim() && texto.trim() !== preenchido) || mensagem.trim()),
  )

  const valido = lerCodigoDaComunidade(texto)
  const ehConvite = !valido && lerTokenDoConvite(texto) !== null
  const previa = usePreviaDoCodigo(valido)
  const tipoDoErro = previa.error ? tipoDoErroDaPrevia(previa.error) : null
  const nomeDaComunidade = previa.data?.comunidade.nome ?? null
  const rotuloDaComunidade = nomeDaComunidade ?? COMUNIDADE_DO_CODIGO

  function continuar(valor = texto) {
    const codigo = lerCodigoDaComunidade(valor)
    if (codigo) {
      setErro(null)
      if (consentimento.motivo || consentimento.menor) return
      if (!trava.pegar()) return
      const recado = mensagem.trim()
      entrar.mutate(
        { codigo, ...consentimento.corpo(), ...(recado ? { mensagem: recado } : {}) },
        {
          onError: consentimento.aoFalhar,
          onSuccess: (r: ResultadoDaEntrada) => {
            if (r.resultado === 'membro') {
              liberarSaida()
              // O degrau antes do Início: "Tudo pronto" e "Ligar os avisos" (UX v3, fluxo a).
              router.replace({
                pathname: '/boas-vindas',
                params: { comunidade: r.comunidade.nome },
              })
            }
          },
          onSettled: () => trava.soltar(),
        },
      )
      return
    }
    // O link de um convite (com papel) segue o caminho de sempre.
    const token = lerTokenDoConvite(valor)
    if (token) {
      setErro(null)
      liberarSaida()
      abrirConvite(token)
      return
    }
    setErro(NAO_RECONHECIDO)
  }

  async function colar() {
    try {
      const copiado = await Clipboard.getStringAsync()
      if (!copiado.trim()) {
        mostrarToast({ texto: 'Não há nada copiado. Copie o código ou o link e tente de novo.' })
        return
      }
      setTexto(copiado.trim())
      setErro(null)
    } catch {
      mostrarToast({ texto: 'Não deu para colar. Toque no campo e cole por ali.', tipo: 'erro' })
    }
  }

  if (pedido) return <PedidoEnviado comunidade={pedido.comunidade.nome} />

  // O código não existe (404 igual para tudo que não entra): sem consentimento nem envio.
  const codigoRecusado = tipoDoErro === 'nao_encontrado'
  // O link de convite tem o próprio consentimento, na tela do convite.
  const pedirConsentimento = !!valido && !codigoRecusado
  const motivo = semConexao
    ? 'Precisa de internet para entrar.'
    : ehConvite
      ? null
      : !texto.trim()
        ? 'Digite o código, cole o link ou leia o QR.'
        : codigoRecusado
          ? 'Confira o código acima.'
          : pedirConsentimento
            ? (consentimento.motivo ?? undefined)
            : undefined
  const tituloDoBotao = ehConvite
    ? 'Abrir o convite'
    : nomeDaComunidade
      ? `Entrar em ${nomeDaComunidade}`
      : 'Entrar na comunidade'
  return (
    <Tela
      pilha
      titulo="Tenho um código"
      descricao="Digite o código que a liderança passou, leia o QR ou cole o link."
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo={tituloDoBotao}
            tamanho="grande"
            carregando={entrar.isPending}
            desabilitado={!!motivo || (pedirConsentimento && consentimento.menor)}
            {...(motivo ? { motivo } : {})}
            aoPressionar={() => continuar()}
          />
        </BarraDeAcao>
      }
    >
      {entrar.error && !consentimento.erroVirouCampo(entrar.error) ? (
        <AvisoDeFalha erro={entrar.error} titulo="Não deu para entrar com esse código" />
      ) : null}
      <CartaoDeVidro opaco intervalo={ESPACO.e16}>
        <Campo
          rotulo="Código ou link"
          exemplo="ABCD 2345"
          ajuda={
            valido
              ? preenchido === valido
                ? `Código do link: ${formatarCodigoDaComunidade(valido)}. Confira e toque em "${tituloDoBotao}".`
                : `Código ${formatarCodigoDaComunidade(valido)}`
              : 'São 8 letras e números. Maiúsculas ou minúsculas, tanto faz.'
          }
          value={texto}
          onChangeText={(v) => {
            setTexto(v)
            if (erro) setErro(null)
          }}
          erro={erro}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="go"
          onSubmitEditing={() => continuar()}
        />
        <ParDeBotoes>
          <Botao
            titulo="Colar"
            icone="copiar"
            variante="secundario"
            aoPressionar={() => void colar()}
          />
          {Platform.OS === 'web' ? null : (
            <Botao
              titulo={camera ? 'Fechar câmera' : 'Ler o QR'}
              icone={camera ? 'fechar' : 'qr'}
              variante="secundario"
              expandido={camera}
              aoPressionar={() => setCamera((c) => !c)}
            />
          )}
        </ParDeBotoes>
      </CartaoDeVidro>
      {camera ? (
        <LeitorDeCodigo
          aoLer={(lido) => {
            setCamera(false)
            setTexto(lido)
            setErro(null)
            anunciar(`Código lido: ${formatarCodigoDaComunidade(lido)}`)
          }}
        />
      ) : null}
      {valido ? (
        <BlocoDaPrevia
          carregando={previa.isPending}
          comunidade={previa.data?.comunidade ?? null}
          tipoDoErro={tipoDoErro}
          aoTentarDeNovo={() => void previa.refetch()}
        />
      ) : null}
      {pedirConsentimento ? (
        <>
          <CamposDoConsentimento consentimento={consentimento} comunidade={rotuloDaComunidade} />
          {comMensagem ? (
            <CartaoDeVidro opaco intervalo={ESPACO.e8}>
              <Campo
                rotulo="Mensagem para a liderança"
                opcional
                ajuda={`Se a comunidade aprova cada entrada: ${ajudaDaMensagem(rotuloDaComunidade)}`}
                value={mensagem}
                onChangeText={setMensagem}
                multiline
                maxLength={MAXIMO_DA_MENSAGEM}
                mostrarContador
              />
              <AvisoDoPedido />
            </CartaoDeVidro>
          ) : (
            <View style={{ gap: ESPACO.e4 }}>
              <Botao
                titulo="Adicionar mensagem para a liderança"
                variante="terciario"
                alinhado
                aoPressionar={() => setComMensagem(true)}
              />
              <AvisoDoPedido />
            </View>
          )}
        </>
      ) : null}
      <Botao
        titulo="Não tenho código: procurar comunidade"
        variante="terciario"
        alinhado
        aoPressionar={() => {
          liberarSaida()
          router.replace('/procurar-comunidade')
        }}
      />
    </Tela>
  )
}

interface PropsDoBlocoDaPrevia {
  carregando: boolean
  comunidade: PreviaDoCodigo['comunidade'] | null
  tipoDoErro: 'nao_encontrado' | 'limite' | 'falha' | null
  aoTentarDeNovo: () => void
  /** Sem sessão a folha "Como conseguir um convite" não existe: a saída é só o texto. */
  semSaida?: boolean
}

/**
 * O que a prévia pública mostra, por estado: esqueleto na forma final, o cartão "Você foi
 * convidado para", o código que não existe (a mesma frase para tudo que não entra, com a saída
 * "Como conseguir um convite"), o limite de consultas e a falha de rede. Só o erro de "não existe"
 * bloqueia o envio: limite e rede não impedem de entrar com o código.
 */
export function BlocoDaPrevia({
  carregando,
  comunidade,
  tipoDoErro,
  aoTentarDeNovo,
  semSaida = false,
}: PropsDoBlocoDaPrevia) {
  if (carregando) {
    return (
      <Esqueleto rotulo="Procurando a comunidade deste código">
        <EsqueletoDoMomento />
      </Esqueleto>
    )
  }
  if (comunidade) return <PreviaDaComunidade comunidade={comunidade} />
  if (tipoDoErro === 'nao_encontrado') {
    return (
      <Aviso
        tipo="erro"
        titulo="Código não encontrado"
        {...(semSaida
          ? {}
          : {
              acao: {
                titulo: 'Como conseguir um convite',
                aoPressionar: () => router.push('/como-conseguir-convite'),
              },
            })}
      >
        {CODIGO_NAO_ENCONTRADO}
      </Aviso>
    )
  }
  if (tipoDoErro === 'limite') {
    return (
      <Aviso tipo="info" titulo="A prévia está em pausa">
        {MENSAGEM_DO_LIMITE}
      </Aviso>
    )
  }
  if (tipoDoErro === 'falha') {
    return (
      <Aviso
        tipo="alerta"
        titulo="Não deu para ver a comunidade agora"
        acao={{ titulo: 'Tentar de novo', aoPressionar: aoTentarDeNovo }}
      >
        Confira a internet. Você ainda pode entrar com o código.
      </Aviso>
    )
  }
  return null
}

/**
 * Câmera dentro da tela, num quadrado com cantos arredondados. Lê só QR; um
 * QR que não é de comunidade avisa e continua lendo. Sem permissão, o
 * estado vazio com a ação de liberar.
 */
function LeitorDeCodigo({ aoLer }: { aoLer: (codigo: string) => void }) {
  const [permissao, pedirPermissao] = useCameraPermissions()
  // A câmera chama o leitor muitas vezes por segundo: guarda a última leitura sem re-renderizar.
  const ultimo = useRef('')

  function aoEscanear({ data }: BarcodeScanningResult) {
    if (data === ultimo.current) return
    ultimo.current = data
    const codigo = lerCodigoDaComunidade(data)
    if (codigo) {
      aoLer(codigo)
      return
    }
    const token = lerTokenDoConvite(data)
    if (token) {
      abrirConvite(token)
      return
    }
    mostrarToast({ texto: `Este QR não é de uma comunidade do ${NOME_DO_APP}.`, tipo: 'erro' })
  }

  if (permissao && !permissao.granted) {
    return (
      <EstadoVazio
        icone="qr"
        titulo="Permita a câmera para ler o QR"
        descricao={`O ${NOME_DO_APP} usa a câmera só para ler o código. A imagem não é gravada nem enviada.`}
        acao={
          permissao.canAskAgain
            ? { titulo: 'Permitir a câmera', aoPressionar: () => void pedirPermissao() }
            : {
                titulo: 'Abrir os ajustes',
                aoPressionar: () => void Linking.openSettings().catch(() => undefined),
              }
        }
      />
    )
  }

  return (
    <CartaoDeVidro sobrancelha="Ler o QR">
      <View
        accessible
        accessibilityLabel="Visor da câmera. Aponte para o QR da comunidade."
        style={{
          width: '100%',
          aspectRatio: 1,
          maxWidth: LADO_MAXIMO_DO_VISOR,
          alignSelf: 'center',
          borderRadius: RAIO.cartao,
          overflow: 'hidden',
        }}
      >
        {permissao ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={aoEscanear}
          />
        ) : null}
      </View>
      <Texto variante="corpo" cor="textoSuave">
        Aponte para o QR que a liderança mostrou. O código aparece no campo sozinho.
      </Texto>
    </CartaoDeVidro>
  )
}
