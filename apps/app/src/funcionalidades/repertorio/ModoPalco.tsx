import { prepararCifra, simbolosDeAcidente } from '@uj/dominio'
import { BORDA, ESPACO } from '@uj/tokens'
import { useKeepAwake } from 'expo-keep-awake'
import { useRef, type ComponentRef } from 'react'
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Aviso } from '@/ui/Aviso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { useAnunciar } from '@/ui/useAnunciar'
import { ProvedorDeTemaForcado, useTema } from '@/ui/tema'

import { CifraNaTela } from './CifraNaTela'
import { proximoPontoDeRolagem } from './rolagem'
import type { AjustesDaCifra } from './useAjustesDaCifra'

interface Props {
  titulo: string
  cifra: string | null
  tomOriginal: string | null
  tomDoDia: string | null
  /** "2 de 4": a posição da música no repertório. */
  posicao: number
  total: number
  ajustes: AjustesDaCifra
  aoSair: () => void
  aoAnterior: (() => void) | null
  aoProxima: (() => void) | null
}

/** Largura mínima de cada botão da fileira de controles: abaixo disso, a fileira quebra. */
const LARGURA_MINIMA_DO_CONTROLE = ESPACO.e32 + ESPACO.e40

/** Tela acesa enquanto o palco está aberto: some sozinha ao sair (usa o que já está instalado). */
function ManterTelaAcesa() {
  useKeepAwake('uj-palco')
  return null
}

/**
 * Modo palco (fatia 2 do modo músico, D71): tela cheia escura, sem barra de abas e sem mais nada
 * no caminho. O título, o tom e a letra grande, com os acordes em negrito sobre a sílaba. A
 * rolagem é por botão (subir e descer uma página) além do dedo; o tamanho da letra fica lembrado;
 * anterior e próxima por botão; sair com um toque. A tela não apaga. Funciona sem internet: lê só
 * da cópia guardada no aparelho (ou da lista já aberta).
 */
export function ModoPalco(props: Props) {
  // O palco é escuro nos dois temas do sistema (palco `#07061A`, acorde `#FFB199`: AA medido).
  return (
    <ProvedorDeTemaForcado nome="escuro">
      <Palco {...props} />
    </ProvedorDeTemaForcado>
  )
}

function Palco({
  titulo,
  cifra,
  tomOriginal,
  tomDoDia,
  posicao,
  total,
  ajustes: a,
  aoSair,
  aoAnterior,
  aoProxima,
}: Props) {
  const { cores } = useTema()
  const margens = useSafeAreaInsets()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null)
  // Posição e medidas da rolagem: só lidas ao tocar, então não pedem nova renderização.
  const medidas = useRef({ atual: 0, janela: 0, conteudo: 0 })

  const pronta = prepararCifra(cifra, {
    tomOriginal,
    tomDoDia,
    ajuste: a.ajuste,
    capotraste: a.capotraste,
  })
  const soa = pronta.tomQueSoa ? simbolosDeAcidente(pronta.tomQueSoa) : null
  const toca = pronta.tomQueSeToca ? simbolosDeAcidente(pronta.tomQueSeToca) : null
  const comCapo = a.capotraste > 0 && toca !== null
  const sobreOTom = soa
    ? `Tom ${soa}${comCapo ? ` · Capotraste ${a.capotraste} (toque em ${toca})` : ''}`
    : null

  // A mão está no instrumento e o foco do leitor de tela fica no botão tocado: quem troca de música
  // ou de tom ouve o resultado, porque nada na tela se anuncia sozinho.
  useAnunciar(`${titulo}, ${posicao} de ${total}`, { soMudancas: true })

  function rolar(sentido: 'cima' | 'baixo') {
    const y = proximoPontoDeRolagem({ ...medidas.current, sentido })
    rolagem.current?.scrollTo({ y, animated: !reduzirMovimento })
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.palco }}>
      <ManterTelaAcesa />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: ESPACO.e8,
          paddingTop: margens.top + ESPACO.e8,
          paddingHorizontal: ESPACO.e16,
          paddingBottom: ESPACO.e8,
        }}
      >
        <Botao
          titulo="Sair do palco"
          icone="fechar"
          variante="secundario"
          tamanho="medio"
          aoPressionar={aoSair}
        />
        <Texto variante="meta" cor="textoSuave" tabular accessibilityRole="text">
          {`${posicao} de ${total}`}
        </Texto>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={rolagem}
          scrollEventThrottle={32}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            medidas.current.atual = e.nativeEvent.contentOffset.y
          }}
          onLayout={(e: LayoutChangeEvent) => {
            medidas.current.janela = e.nativeEvent.layout.height
          }}
          onContentSizeChange={(_largura, altura) => {
            medidas.current.conteudo = altura
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: ESPACO.e12,
            paddingLeft: ESPACO.e24,
            // Espaço dos botões de rolar: a letra nunca fica por baixo deles.
            paddingRight: ESPACO.e24 + 64,
            paddingTop: ESPACO.e8,
            paddingBottom: ESPACO.e32,
          }}
        >
          <Texto variante="tituloTela">{titulo}</Texto>
          {sobreOTom ? (
            <TextoAnunciado soMudancas variante="rotulo" cor="textoSuave">
              {sobreOTom}
            </TextoAnunciado>
          ) : null}
          {!cifra || !cifra.trim() ? (
            <Aviso tipo="info" titulo="Esta música ainda não tem cifra">
              Quem organiza pode cadastrar a cifra na Biblioteca.
            </Aviso>
          ) : pronta.transpoe ? (
            <CifraNaTela linhas={pronta.linhas} tamanho={a.palco.tamanho} tetoDaEscala={1.3} />
          ) : (
            <Texto
              variante="leitura"
              maxFontSizeMultiplier={1.3}
              style={{ fontSize: a.palco.tamanho, lineHeight: a.palco.tamanho * 1.45 }}
            >
              {pronta.texto}
            </Texto>
          )}
        </ScrollView>

        {/* Rolar com um toque (a mão está no instrumento): uma página para cima ou para baixo. */}
        <View
          style={{
            position: 'absolute',
            right: ESPACO.e12,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            gap: ESPACO.e12,
          }}
        >
          <BotaoIcone
            icone="subir"
            rotulo="Rolar a cifra para cima"
            lado={56}
            aoPressionar={() => rolar('cima')}
          />
          <BotaoIcone
            icone="descer"
            rotulo="Rolar a cifra para baixo"
            lado={56}
            aoPressionar={() => rolar('baixo')}
          />
        </View>
      </View>

      <View
        style={{
          gap: ESPACO.e8,
          paddingTop: ESPACO.e12,
          paddingHorizontal: ESPACO.e16,
          paddingBottom: margens.bottom + ESPACO.e12,
          borderTopWidth: BORDA.fina,
          borderTopColor: cores.superficieBorda,
        }}
      >
        <View style={{ flexDirection: 'row', gap: ESPACO.e8 }}>
          <View style={{ flex: 1 }}>
            <Botao
              titulo="Anterior"
              variante="secundario"
              tamanho="alto"
              larguraTotal
              rotuloAcessivel="Música anterior"
              desabilitado={aoAnterior === null}
              aoPressionar={() => aoAnterior?.()}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Botao
              titulo="Próxima"
              tamanho="alto"
              larguraTotal
              rotuloAcessivel="Próxima música"
              desabilitado={aoProxima === null}
              aoPressionar={() => aoProxima?.()}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          {[
            {
              titulo: 'Tom −',
              rotulo: 'Descer meio tom',
              aoPressionar: a.descerMeioTom,
              desabilitado: !pronta.transpoe,
            },
            {
              titulo: 'Tom +',
              rotulo: 'Subir meio tom',
              aoPressionar: a.subirMeioTom,
              desabilitado: !pronta.transpoe,
            },
            {
              titulo: 'A−',
              rotulo: 'Diminuir a letra',
              aoPressionar: a.palco.menor,
              desabilitado: a.palco.noMinimo,
            },
            {
              titulo: 'A+',
              rotulo: 'Aumentar a letra',
              aoPressionar: a.palco.maior,
              desabilitado: a.palco.noMaximo,
            },
          ].map((c) => (
            <View key={c.titulo} style={{ flexGrow: 1, flexBasis: LARGURA_MINIMA_DO_CONTROLE }}>
              <Botao
                titulo={c.titulo}
                variante="secundario"
                tamanho="medio"
                rotuloAcessivel={c.rotulo}
                desabilitado={c.desabilitado}
                aoPressionar={c.aoPressionar}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
