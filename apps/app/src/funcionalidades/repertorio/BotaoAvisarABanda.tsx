import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import type { TamanhoDoBotao, VarianteDoBotao } from '@/ui/Botao'
import { Botao } from '@/ui/Botao'
import { AvisoDeFalha } from '@/ui/Falha'
import { mostrarToast } from '@/ui/Toast'
import { mostrarDesfazer } from '@/ui/ToastComDesfazer'

import { usePode } from '../comunidade/permissoes'
import { useAvisarABanda } from './consultas'

/**
 * "Avisar a banda" (D61, D71): manda às pessoas convocadas ao louvor um aviso de que o repertório
 * foi atualizado. O aviso não diz quais músicas. Avisa gente, então não sai na hora: o toast dá 10 s
 * para desfazer e SÓ DEPOIS a chamada vai ao servidor (se o app for fechado à força, nada saiu).
 * Só quem convoca vê o botão; ele fica desligado, com o motivo, enquanto o encontro não está
 * publicado. Depois de enviar, diz a quantas pessoas saiu (quem desligou os avisos ou já foi
 * avisado na última hora não conta).
 */
export function BotaoAvisarABanda({
  comunidadeId,
  eventoId,
  publicado,
  variante = 'secundario',
  tamanho = 'medio',
}: {
  comunidadeId: string
  eventoId: string
  publicado: boolean
  variante?: VarianteDoBotao
  tamanho?: TamanhoDoBotao
}) {
  const pode = usePode()
  const avisar = useAvisarABanda(comunidadeId, eventoId)
  // Durante a contagem o botão não se repete: um segundo toque enviaria o primeiro na hora.
  const [esperando, setEsperando] = useState(false)
  if (!pode('escala', 'atribuir')) return null

  function avisarABanda() {
    setEsperando(true)
    mostrarDesfazer({
      texto: 'Avisando a banda de que o repertório mudou.',
      textoDaFalha: 'Não deu para avisar a banda. Ninguém foi avisado. Toque em Tentar de novo.',
      aoDesfazer: () => setEsperando(false),
      aoFalhar: () => setEsperando(false),
      // Sai ao fim da contagem, ao sair da tela ou do app (D74), e repete se a rede falhar.
      aoConfirmar: async () => {
        const r = await avisar.mutateAsync()
        setEsperando(false)
        mostrarToast({
          texto:
            r.convocadas === 0
              ? 'Ninguém foi convocado ao louvor ainda. Convoque a banda no encontro.'
              : r.avisadas > 0
                ? `Pronto. Aviso enviado a ${r.avisadas} ${r.avisadas === 1 ? 'pessoa' : 'pessoas'} da banda.`
                : 'Ninguém novo para avisar agora: a banda já foi avisada há pouco, ou desligou os avisos.',
        })
      },
    })
  }

  return (
    <View style={{ gap: ESPACO.e8 }}>
      {avisar.error ? <AvisoDeFalha erro={avisar.error} titulo="A banda não foi avisada" /> : null}
      <Botao
        titulo="Avisar a banda"
        variante={variante}
        tamanho={tamanho}
        carregando={avisar.isPending || esperando}
        {...(publicado
          ? {}
          : { desabilitado: true, motivo: 'Publique o encontro para avisar a banda.' })}
        aoPressionar={avisarABanda}
      />
    </View>
  )
}
