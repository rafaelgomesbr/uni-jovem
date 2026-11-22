import { ALTURA, ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { falarQuando } from '@/utilidades/datas'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { useAssumirComDesfazer, useSubstituicoes } from '../escalas/consultas'
import { dataCurtaDoEncontro, primeiraMaiuscula } from './semanas'

/**
 * "Pedem ajuda" (a antiga seção "Pedidos de substituição" da aba Escalas, D69): só aparece quando
 * alguém pediu e a pessoa pode assumir. "Assumir" é um toque, com Desfazer de 10 s: quem pediu
 * só é avisado depois. Sem internet, o botão fica desabilitado com o motivo escrito.
 */
export function PedemAjuda({
  comunidadeId,
  semInternet,
}: {
  comunidadeId: string
  semInternet: boolean
}) {
  const { cores } = useTema()
  const fuso = useFusoDaComunidade()
  const pedidos = useSubstituicoes(comunidadeId)
  const { assumidos, assumir } = useAssumirComDesfazer(comunidadeId)

  if (pedidos.isPending) return null
  if (pedidos.error) {
    return (
      <AvisoDeFalha
        erro={pedidos.error}
        titulo="Não deu para ver quem pede ajuda"
        aoTentarDeNovo={() => void pedidos.refetch()}
      />
    )
  }
  const visiveis = pedidos.data.filter((s) => s.possoAssumir && !assumidos.has(s.id))
  if (visiveis.length === 0) return null

  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Texto variante="tituloItem" nivel={2} accessibilityRole="header">
        {`Pedem ajuda (${visiveis.length})`}
      </Texto>
      <CartaoDeVidro lista>
        {visiveis.map((s) => {
          const nome = s.etapa
            ? `${s.etapa} · ${primeiraMaiuscula(s.funcao)}`
            : primeiraMaiuscula(s.funcao)
          const descricao = `${dataCurtaDoEncontro(s.evento.inicio, fuso)} · ${s.evento.titulo}`
          return (
            <View
              key={s.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: ESPACO.e12,
                minHeight: ALTURA.linhaAlta,
                paddingHorizontal: ESPACO.e16,
                paddingVertical: ESPACO.e12,
              }}
            >
              <Icone nome="trocar" cor={cores.destaque} tamanho={20} />
              <View style={{ flex: 1, gap: ESPACO.e4 }}>
                <Texto variante="tituloItem">{nome}</Texto>
                <Texto variante="meta" cor="textoSuave">
                  {descricao}
                </Texto>
                {s.motivo ? (
                  <Texto variante="legenda" cor="textoSuave">
                    {`Motivo: ${s.motivo}`}
                  </Texto>
                ) : null}
              </View>
              <Botao
                titulo="Assumir"
                tamanho="medio"
                desabilitado={semInternet}
                rotuloAcessivel={`Assumir ${nome}, ${falarQuando(s.evento.inicio, fuso)}`}
                aoPressionar={() =>
                  assumir({
                    id: s.id,
                    funcao: s.funcao,
                    etapa: s.etapa,
                    inicio: s.evento.inicio,
                    fuso,
                  })
                }
              />
            </View>
          )
        })}
      </CartaoDeVidro>
      {semInternet ? (
        <View style={{ flexDirection: 'row', gap: ESPACO.e8, alignItems: 'flex-start' }}>
          <Icone nome="cadeado" cor={cores.textoSuave} tamanho={14} />
          <Texto variante="legenda" cor="textoSuave" style={{ flex: 1 }}>
            Precisa de internet para responder.
          </Texto>
        </View>
      ) : null}
    </View>
  )
}
