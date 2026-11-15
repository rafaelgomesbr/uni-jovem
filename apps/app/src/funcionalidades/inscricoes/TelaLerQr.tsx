import { ALTURA, ESPACO, RAIO, RITMO } from '@uj/tokens'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, type ReactNode } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSessao } from '@/estado/sessao'
import { ehErroDaApi, mensagemDoErro, SemConexao } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { voltar } from '@/ui/CabecalhoDeTela'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast, registrarRodape } from '@/ui/Toast'
import { ProvedorDeTemaForcado, useTema } from '@/ui/tema'
import { Vidro } from '@/ui/Vidro'
import { parametro } from '@/utilidades/parametros'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useOffline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { listaDeCheckinLocal } from '../offline/vistaLocal'
import { useListaDeCheckin, useMarcarPresenca } from './consultas'
import { codigoDeEntradaValido, formatarCodigo } from './nomes'
import { useMarcarPresencaNoAparelho } from './TelaCheckin'

/** O mesmo código lido de novo dentro deste intervalo é ignorado (a câmera lê várias vezes). */
const INTERVALO_ENTRE_LEITURAS_MS = 3_000

/** Visor de 240 por 240 com cantos em L de 32 (3.5.3); não há token de layout para o visor. */
const LADO_DO_VISOR = 240

/** Rota `/evento/[eventoId]/ler-qr`: atalho por câmera; a busca por nome segue a um toque. */
export function TelaLerQr() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const pode = usePode()
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha modal titulo="Ler QR">
        <SemComunidade oQue="o check-in" />
      </Tela>
    )
  }
  if (!pode('presenca', 'registrar')) {
    return (
      <Tela pilha modal titulo="Ler QR">
        <Aviso tipo="info" titulo="Só a organização registra presença">
          Mostre o seu código para quem está fazendo o check-in.
        </Aviso>
      </Tela>
    )
  }
  // A câmera é sempre escura (3.5.3): o tema da tela não segue o sistema aqui.
  return (
    <ProvedorDeTemaForcado nome="escuro">
      <LerQr comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
    </ProvedorDeTemaForcado>
  )
}

/**
 * Ler QR (3.5.3): câmera de ponta a ponta, sempre escura; o visor de 240 no
 * centro com cantos em L na cor primária; a instrução numa pílula de vidro no
 * topo; o resultado em toast (anunciado); embaixo, "Buscar pelo nome", que
 * volta para a lista. Sem permissão, um estado vazio com a ação.
 */
function LerQr({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const [permissao, pedirPermissao] = useCameraPermissions()
  const lista = useListaDeCheckin(comunidadeId, eventoId)
  const marcar = useMarcarPresenca(comunidadeId, eventoId)
  const offline = useOffline()
  const guardado = usePacoteDoEvento(eventoId).data ?? null
  const listaLocal = guardado ? listaDeCheckinLocal(guardado.pacote, offline.operacoes) : null
  const semRede =
    !offline.online ||
    (lista.isPending && lista.fetchStatus === 'paused') ||
    lista.error instanceof SemConexao
  // Sem conexão e com o evento preparado: a leitura entra na fila deste aparelho.
  const usarLocal = semRede && listaLocal !== null
  const marcarLocal = useMarcarPresencaNoAparelho(eventoId, guardado?.pacote.vinculoId ?? null)
  // A câmera chama o leitor muitas vezes por segundo: guarda a última leitura sem re-renderizar.
  const ultimaLeitura = useRef({ codigo: '', em: 0 })
  const registrando = marcar.isPending || marcarLocal.isPending

  function aoLer({ data }: BarcodeScanningResult) {
    const agora = Date.now()
    const codigo = codigoDeEntradaValido(data)
    const anterior = ultimaLeitura.current
    if (registrando) return
    if (data === anterior.codigo && agora - anterior.em < INTERVALO_ENTRE_LEITURAS_MS) return
    ultimaLeitura.current = { codigo: data, em: agora }
    if (!codigo) {
      mostrarToast({ texto: 'Este QR não é um código de entrada do Uni Jovem.', tipo: 'erro' })
      return
    }
    const nome = (usarLocal ? listaLocal : lista.data)?.inscritos.find(
      (i) => i.codigo === codigo,
    )?.nome
    if (usarLocal) {
      marcarLocal.mutate(
        { alvo: { codigo }, origem: 'qr', nome: nome ?? formatarCodigo(codigo) },
        {
          onSuccess: (r) =>
            mostrarToast(
              r.situacao === 'repetida'
                ? {
                    texto: `${nome ?? 'Este código'} já estava anotado neste aparelho.`,
                    tipo: 'info',
                  }
                : nome
                  ? {
                      texto: `Presença de ${nome} anotada neste aparelho. Vai quando a internet voltar.`,
                    }
                  : {
                      texto:
                        'Código fora da lista preparada. Ficou anotado e o servidor confere depois.',
                      tipo: 'info',
                    },
            ),
          onError: (erro) => mostrarToast({ texto: mensagemDoErro(erro), tipo: 'erro' }),
        },
      )
      return
    }
    marcar.mutate(
      { alvo: { codigo }, origem: 'qr', nome: nome ?? formatarCodigo(codigo) },
      {
        onSuccess: (r) =>
          mostrarToast(
            r.jaRegistrada
              ? { texto: `${nome ?? 'Esta pessoa'} já estava com presença.`, tipo: 'info' }
              : { texto: `Presença de ${nome ?? 'quem tem este código'} registrada.` },
          ),
        onError: (erro) =>
          mostrarToast({
            texto:
              ehErroDaApi(erro) && erro.status === 404
                ? 'Código não encontrado neste evento. Confira se a inscrição é deste encontro.'
                : 'Não deu para registrar agora. Tente de novo ou use a busca por nome.',
            tipo: 'erro',
          }),
      },
    )
  }

  const instrucao = registrando
    ? 'Registrando a presença'
    : usarLocal
      ? 'Sem conexão: a leitura fica neste aparelho'
      : 'Aponte para o QR de entrada'

  if (permissao && !permissao.granted) {
    return (
      <Moldura instrucao="A câmera está desligada">
        <EstadoVazio
          icone="qr"
          titulo="Permita a câmera para ler o QR"
          descricao="O Uni Jovem usa a câmera só para ler o código de entrada. A imagem não é gravada nem enviada."
          acao={
            permissao.canAskAgain
              ? { titulo: 'Permitir a câmera', aoPressionar: () => void pedirPermissao() }
              : {
                  titulo: 'Abrir os ajustes',
                  aoPressionar: () => void Linking.openSettings().catch(() => undefined),
                }
          }
        />
      </Moldura>
    )
  }

  return (
    <Moldura
      instrucao={permissao ? instrucao : 'Conferindo a permissão da câmera'}
      camera={
        permissao ? (
          <View
            accessible
            accessibilityLabel="Visor da câmera. Aponte para o QR de entrada."
            style={StyleSheet.absoluteFill}
          >
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={aoLer}
            />
          </View>
        ) : null
      }
    >
      {lista.error && !usarLocal && !(lista.error instanceof SemConexao) ? (
        <Aviso tipo="alerta" titulo="A lista de entrada não abriu">
          A leitura continua: o servidor confere cada código.
        </Aviso>
      ) : null}
      <View pointerEvents="none" style={{ alignItems: 'center' }}>
        <Visor />
      </View>
    </Moldura>
  )
}

/** Fundo escuro, a câmera atrás, a pílula no topo e "Buscar pelo nome" embaixo. */
function Moldura({
  instrucao,
  camera,
  children,
}: {
  instrucao: string
  camera?: ReactNode
  children: ReactNode
}) {
  const { cores } = useTema()
  const margens = useSafeAreaInsets()
  const rodape = margens.bottom + ESPACO.e24 + ALTURA.controle
  // O toast aparece acima do botão de baixo: a tela diz onde ele termina.
  useEffect(() => registrarRodape(rodape), [rodape])
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      {camera}
      <View
        style={{
          flex: 1,
          paddingTop: margens.top + RITMO.topoDaTela,
          paddingBottom: rodape,
          paddingHorizontal: RITMO.margemDaTela,
          gap: RITMO.entreSecoes,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
          <BotaoIcone icone="fechar" rotulo="Fechar" circular aoPressionar={voltar} />
          <Vidro
            style={{
              flexShrink: 1,
              minHeight: ALTURA.pilula,
              justifyContent: 'center',
              paddingHorizontal: ESPACO.e16,
              borderRadius: RAIO.pilula,
            }}
          >
            <Texto variante="botao" accessibilityRole="text" accessibilityLiveRegion="polite">
              {instrucao}
            </Texto>
          </Vidro>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: RITMO.entreSecoes }}>
          {children}
        </View>
      </View>
      <View
        style={{
          position: 'absolute',
          left: RITMO.margemDaTela,
          right: RITMO.margemDaTela,
          bottom: margens.bottom + ESPACO.e24,
        }}
      >
        <Botao
          titulo="Buscar pelo nome"
          rotuloAcessivel="Buscar pelo nome, sem câmera"
          variante="secundario"
          tamanho="grande"
          larguraTotal
          aoPressionar={() => router.back()}
        />
      </View>
    </View>
  )
}

/** Visor de 240 com cantos em L de 4 de espessura e 32 de comprimento, raio 22. */
function Visor() {
  const { cores } = useTema()
  const canto = {
    position: 'absolute' as const,
    width: ESPACO.e32,
    height: ESPACO.e32,
    borderColor: cores.primaria,
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: LADO_DO_VISOR, height: LADO_DO_VISOR }}
    >
      <View
        style={[
          canto,
          { top: 0, left: 0, borderTopWidth: ESPACO.e4, borderLeftWidth: ESPACO.e4 },
          { borderTopLeftRadius: RAIO.cartao },
        ]}
      />
      <View
        style={[
          canto,
          { top: 0, right: 0, borderTopWidth: ESPACO.e4, borderRightWidth: ESPACO.e4 },
          { borderTopRightRadius: RAIO.cartao },
        ]}
      />
      <View
        style={[
          canto,
          { bottom: 0, left: 0, borderBottomWidth: ESPACO.e4, borderLeftWidth: ESPACO.e4 },
          { borderBottomLeftRadius: RAIO.cartao },
        ]}
      />
      <View
        style={[
          canto,
          { bottom: 0, right: 0, borderBottomWidth: ESPACO.e4, borderRightWidth: ESPACO.e4 },
          { borderBottomRightRadius: RAIO.cartao },
        ]}
      />
    </View>
  )
}
