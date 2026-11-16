import { ESPACO, RAIO } from '@uj/tokens'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Linking, Platform, View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import type { ResultadoDaEntrada } from '@/servicos/contrato'
import { anunciar } from '@/ui/anunciar'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { useConfirmarDescarte, useTravaDeEnvio } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { abrirConvite, lerTokenDoConvite } from '../comunidade/TelaEntrarComConvite'
import { CamposDoConsentimento, useConsentimentoDaEntrada } from './ConsentimentoDaEntrada'
import {
  formatarCodigoDaComunidade,
  lerCodigoDaComunidade,
  MAXIMO_DA_MENSAGEM,
  useEntrarComCodigo,
} from './consultas'
import { AvisoDoPedido, ajudaDaMensagem } from './TextosDoPedido'

/** Antes de enviar, o app não sabe de qual comunidade é o código (a API não tem consulta). */
const COMUNIDADE_DO_CODIGO = 'comunidade deste código'
/** O visor da câmera ocupa a largura do cartão até 320 (não há token de layout para o visor). */
const LADO_MAXIMO_DO_VISOR = 320
const NAO_RECONHECIDO =
  'Não reconhecemos esse código. Ele tem 8 letras e números, como ABCD 2345. Se recebeu um link, cole o link inteiro.'

/**
 * "Tenho um código ou convite" (ADR 0007): um campo só aceita o código da
 * comunidade (8 caracteres), o link do código ou o link de um convite. O QR
 * é lido pela câmera aqui mesmo, sem trocar de tela; "Colar" traz o que foi
 * copiado do WhatsApp. Para o código, o TC-03.v4 (fé) vem antes do botão e
 * a mensagem para a liderança (TC-17) é opcional.
 */
export function TelaTenhoUmCodigo() {
  const [texto, setTexto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [camera, setCamera] = useState(false)
  const entrar = useEntrarComCodigo()
  const consentimento = useConsentimentoDaEntrada()
  const trava = useTravaDeEnvio()
  const pedido = entrar.data?.resultado === 'pedido_pendente' ? entrar.data : null
  const liberarSaida = useConfirmarDescarte(
    !entrar.isSuccess && !!(texto.trim() || mensagem.trim()),
  )

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
              router.replace('/')
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

  if (pedido) {
    return (
      <Tela pilha titulo="Pedido enviado">
        <CartaoDeDestaque
          sobrancelha="Aguardando a liderança"
          titulo={pedido.comunidade.nome}
          descricao="A liderança vai ver o seu pedido. Quando decidirem, o sino do app avisa, e a comunidade aparece para você."
          acoes={<Botao titulo="Voltar para o início" aoPressionar={() => router.replace('/')} />}
        />
      </Tela>
    )
  }

  const valido = lerCodigoDaComunidade(texto)
  const ehConvite = !valido && lerTokenDoConvite(texto) !== null
  // O link de convite tem o próprio consentimento, na tela do convite.
  const motivo = ehConvite ? null : (consentimento.motivo ?? undefined)
  return (
    <Tela
      pilha
      titulo="Tenho um código ou convite"
      descricao="Digite o código que a liderança passou, leia o QR ou cole o link."
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo={ehConvite ? 'Abrir o convite' : 'Entrar na comunidade'}
            tamanho="grande"
            carregando={entrar.isPending}
            desabilitado={!!motivo || (!ehConvite && consentimento.menor)}
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
              ? `Código ${formatarCodigoDaComunidade(valido)}`
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
      {ehConvite ? null : (
        <>
          <CartaoDeVidro opaco intervalo={ESPACO.e8}>
            <Campo
              rotulo="Mensagem para a liderança"
              opcional
              ajuda={`Se a comunidade aprova cada entrada: ${ajudaDaMensagem(COMUNIDADE_DO_CODIGO)}`}
              value={mensagem}
              onChangeText={setMensagem}
              multiline
              maxLength={MAXIMO_DA_MENSAGEM}
              mostrarContador
            />
            <AvisoDoPedido />
          </CartaoDeVidro>
          <CamposDoConsentimento consentimento={consentimento} comunidade={COMUNIDADE_DO_CODIGO} />
        </>
      )}
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
