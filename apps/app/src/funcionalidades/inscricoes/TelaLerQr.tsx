import { ESPACO, RAIO } from '@uj/tokens'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { Linking, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { ehErroDaApi } from '@/servicos/erros'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useListaDeCheckin, useMarcarPresenca } from './consultas'
import { codigoDeEntradaValido, formatarCodigo } from './nomes'

/** O mesmo código lido de novo dentro deste intervalo é ignorado (a câmera lê várias vezes). */
const INTERVALO_ENTRE_LEITURAS_MS = 3_000

/** Rota `/evento/[eventoId]/ler-qr`: atalho por câmera; a busca por nome segue a um toque. */
export function TelaLerQr() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const pode = usePode()
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela cabecalhoNativo>
        <SemComunidade oQue="o check-in" />
      </Tela>
    )
  }
  if (!pode('presenca', 'registrar')) {
    return (
      <Tela cabecalhoNativo titulo="Ler QR">
        <Aviso tipo="info" titulo="Só a organização registra presença">
          Mostre o seu código para quem está fazendo o check-in.
        </Aviso>
      </Tela>
    )
  }
  return <LerQr comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
}

type Resultado = { tipo: 'sucesso' | 'alerta'; texto: string } | null

function LerQr({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const { cores } = useTema()
  const [permissao, pedirPermissao] = useCameraPermissions()
  const lista = useListaDeCheckin(comunidadeId, eventoId)
  const marcar = useMarcarPresenca(comunidadeId, eventoId)
  const [resultado, setResultado] = useState<Resultado>(null)
  // A câmera chama o leitor muitas vezes por segundo: guarda a última leitura sem re-renderizar.
  const ultimaLeitura = useRef({ codigo: '', em: 0 })

  const voltarParaBusca = (
    <Botao
      titulo="Buscar pelo nome, sem câmera"
      icone="buscar"
      variante="secundario"
      aoPressionar={() => router.back()}
    />
  )

  function aoLer({ data }: BarcodeScanningResult) {
    const agora = Date.now()
    const codigo = codigoDeEntradaValido(data)
    const anterior = ultimaLeitura.current
    if (marcar.isPending) return
    if (data === anterior.codigo && agora - anterior.em < INTERVALO_ENTRE_LEITURAS_MS) return
    ultimaLeitura.current = { codigo: data, em: agora }
    if (!codigo) {
      setResultado({ tipo: 'alerta', texto: 'Este QR não é um código de entrada do Uni Jovem.' })
      return
    }
    const nome = lista.data?.inscritos.find((i) => i.codigo === codigo)?.nome
    marcar.mutate(
      { alvo: { codigo }, origem: 'qr', nome: nome ?? formatarCodigo(codigo) },
      {
        onSuccess: (r) =>
          setResultado({
            tipo: r.jaRegistrada ? 'alerta' : 'sucesso',
            texto: r.jaRegistrada
              ? `${nome ?? 'Esta pessoa'} já estava com presença.`
              : `Presença de ${nome ?? 'quem tem este código'} registrada.`,
          }),
        onError: (erro) =>
          setResultado({
            tipo: 'alerta',
            texto:
              ehErroDaApi(erro) && erro.status === 404
                ? 'Código não encontrado neste evento. Confira se a inscrição é deste encontro.'
                : 'Não deu para registrar agora. Tente de novo ou use a busca por nome.',
          }),
      },
    )
  }

  if (!permissao) {
    return (
      <Tela cabecalhoNativo titulo="Ler QR">
        <Carregando texto="Conferindo a permissão da câmera" />
        {voltarParaBusca}
      </Tela>
    )
  }

  if (!permissao.granted) {
    return (
      <Tela cabecalhoNativo titulo="Ler QR">
        <Cartao titulo="Câmera" icone="qr">
          <Texto>
            Para ler o QR de entrada, o Uni Jovem precisa usar a câmera. A imagem não é gravada nem
            enviada: só o código lido.
          </Texto>
          {permissao.canAskAgain ? (
            <Botao
              titulo="Permitir a câmera"
              icone="qr"
              aoPressionar={() => void pedirPermissao()}
            />
          ) : (
            <>
              <Texto variante="apoio" cor="textoSuave">
                A câmera foi negada antes. Para liberar, abra os ajustes do aparelho.
              </Texto>
              <Botao
                titulo="Abrir os ajustes"
                variante="secundario"
                aoPressionar={() => void Linking.openSettings().catch(() => undefined)}
              />
            </>
          )}
        </Cartao>
        {voltarParaBusca}
      </Tela>
    )
  }

  return (
    <Tela cabecalhoNativo titulo="Ler QR">
      <Texto variante="apoio" cor="textoSuave">
        Aponte para o QR de entrada. Cada leitura registra a presença na hora.
      </Texto>
      <View
        accessible
        accessibilityLabel="Visor da câmera. Aponte para o QR de entrada."
        style={{
          height: 320,
          borderRadius: RAIO.grande,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: cores.texto,
        }}
      >
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={aoLer}
        />
      </View>
      <View style={{ gap: ESPACO.x2 }}>
        {marcar.isPending ? <Carregando texto="Registrando a presença" /> : null}
        {resultado ? (
          <Aviso tipo={resultado.tipo} anunciar>
            {resultado.texto}
          </Aviso>
        ) : null}
        {lista.error ? <AvisoDeErro erro={lista.error} /> : null}
      </View>
      {voltarParaBusca}
    </Tela>
  )
}
