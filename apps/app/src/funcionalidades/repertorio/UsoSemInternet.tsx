import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { mensagemDoErro } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { quandoNoAparelho, diaEMesNoAparelho } from '../offline/formatos'
import { useOffline } from '../offline/ProvedorOffline'

export const TEXTO_PRONTO_SEM_INTERNET = 'Pronto para tocar sem internet'

/**
 * "Usar sem internet" do repertório (fatia 2 do modo músico, D71): baixa o repertório e as cifras
 * do encontro para o banco cifrado deste aparelho e diz, em texto e com ícone, se está pronto.
 * Só baixa de novo se a versão mudou (o servidor responde "inalterado"). A letra e a cifra nunca
 * vão a log. Na web nada fica guardado, e o cartão diz isso em vez de oferecer um botão que não
 * funciona.
 */
export function UsoSemInternet({ eventoId }: { eventoId: string }) {
  const offline = useOffline()
  const guardado = offline.repertorios.find((r) => r.eventoId === eventoId) ?? null
  const baixar = useMutation({
    mutationFn: () => offline.baixarRepertorio(eventoId),
    // Baixar exige rede de verdade: sem ela o pedido falha e o cartão explica.
    networkMode: 'always',
    onSuccess: (resultado) =>
      mostrarToast({
        texto:
          resultado === 'em_dia'
            ? 'Já está na versão mais nova. Abre sem internet.'
            : resultado === 'atualizado'
              ? 'Repertório atualizado neste aparelho.'
              : `${TEXTO_PRONTO_SEM_INTERNET}.`,
      }),
  })
  const remover = useMutation({
    mutationFn: () => offline.removerRepertorio(eventoId),
    networkMode: 'always',
    onSuccess: () => mostrarToast({ texto: 'O repertório saiu deste aparelho.' }),
  })

  if (!offline.disponivel) {
    return (
      <Cartao sobrancelha="Usar sem internet">
        <Texto variante="corpo" cor="textoSuave">
          No navegador, nada fica guardado. Para tocar sem internet, use o app no celular.
        </Texto>
      </Cartao>
    )
  }

  const erro = baixar.error ?? remover.error
  return (
    <Cartao
      sobrancelha="Usar sem internet"
      extra={guardado ? <Chip situacao="aceitou" texto="Baixado" /> : undefined}
    >
      {guardado ? (
        <View style={{ gap: ESPACO.e4 }}>
          <Texto variante="tituloItem">{TEXTO_PRONTO_SEM_INTERNET}</Texto>
          <Texto variante="meta" cor="textoSuave">
            {`Baixado em ${quandoNoAparelho(guardado.baixadoEm)}. Vale até ${diaEMesNoAparelho(offline.validoAte ?? guardado.validoAte)}.`}
          </Texto>
          <Texto variante="legenda" cor="textoSuave">
            Fica guardado cifrado neste aparelho e sai quando você sai da comunidade.
          </Texto>
        </View>
      ) : (
        <Texto variante="corpo" cor="textoSuave">
          Baixe as músicas e as cifras do encontro com Wi-Fi. Elas abrem aqui e no Modo palco mesmo
          sem internet, e ficam guardadas cifradas neste aparelho.
        </Texto>
      )}
      {erro ? (
        <Aviso tipo="erro" titulo="Não deu certo" anunciar>
          {mensagemDoErro(erro)}
        </Aviso>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Botao
          titulo={guardado ? 'Atualizar agora' : 'Deixar pronto sem internet'}
          icone={guardado ? 'sincronizar' : 'baixar'}
          variante="secundario"
          tamanho="medio"
          carregando={baixar.isPending}
          desabilitado={!offline.online}
          motivo="Baixar exige conexão com a internet."
          aoPressionar={() => baixar.mutate()}
        />
        {guardado ? (
          <Botao
            titulo="Tirar do aparelho"
            variante="terciario"
            tamanho="medio"
            carregando={remover.isPending}
            aoPressionar={() => remover.mutate()}
          />
        ) : null}
      </View>
    </Cartao>
  )
}
