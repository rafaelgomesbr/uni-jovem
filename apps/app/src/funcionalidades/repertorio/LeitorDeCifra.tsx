import { CAPOTRASTE_MAXIMO, prepararCifra, simbolosDeAcidente } from '@uj/dominio'
import { ESPACO, RAIO, TEMAS } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Texto } from '@/ui/Texto'
import { ProvedorDeTemaForcado } from '@/ui/tema'

import { CifraNaTela } from './CifraNaTela'
import { useAjustesDaCifra, type AjustesDaCifra } from './useAjustesDaCifra'

interface Props {
  cifra: string | null
  /** Tom da música na biblioteca. */
  tomOriginal: string | null
  /** Tom do dia, quando a cifra vem de um repertório. */
  tomDoDia?: string | null
  /** Tamanho inicial da letra (sem ele, vale o último que a pessoa escolheu). */
  tamanhoInicial?: number
  /**
   * Ajustes vindos de fora, para o leitor e o Modo palco compartilharem o tom e o capotraste da
   * mesma leitura. Sem eles, o leitor guarda os próprios.
   */
  ajustes?: AjustesDaCifra
}

const AVISO_DE_TEXTO_LIVRE =
  'Esta cifra está em texto livre, então o tom e o capotraste não mudam os acordes. Quem organiza pode converter a cifra na edição da música.'

/**
 * Leitor de cifra (D61, visual A em D71): o tom que soa e o capotraste no alto, os botões de tom
 * (meio tom por vez), capotraste e tamanho da letra com alvo de 48, e a cifra num painel escuro
 * de alto contraste, com a letra grande e os acordes em negrito sobre a sílaba. Os ajustes valem
 * só neste aparelho e nesta leitura: nunca mudam o tom do dia nem a música.
 */
export function LeitorDeCifra({ cifra, tomOriginal, tomDoDia, tamanhoInicial, ajustes }: Props) {
  const interno = useAjustesDaCifra(tamanhoInicial === undefined ? {} : { tamanhoInicial })
  const a = ajustes ?? interno

  const pronta = prepararCifra(cifra, {
    tomOriginal,
    tomDoDia: tomDoDia ?? null,
    ajuste: a.ajuste,
    capotraste: a.capotraste,
  })

  if (!cifra || !cifra.trim()) {
    return (
      <Aviso tipo="info" titulo="Esta música ainda não tem cifra">
        Quem organiza pode cadastrar a cifra na música, na Biblioteca.
      </Aviso>
    )
  }

  const soa = pronta.tomQueSoa ? simbolosDeAcidente(pronta.tomQueSoa) : null
  const toca = pronta.tomQueSeToca ? simbolosDeAcidente(pronta.tomQueSeToca) : null
  const comCapo = a.capotraste > 0 && toca !== null
  const resumoDoTom = soa
    ? comCapo
      ? `Soa em ${soa}. Toque em ${toca} com o capotraste na ${a.capotraste}ª casa.`
      : `Tom ${soa}.`
    : 'Tom não informado.'

  return (
    <View style={{ gap: ESPACO.e16 }}>
      <View accessible accessibilityLabel={resumoDoTom} style={{ gap: ESPACO.e4 }}>
        <Texto variante="tituloItem">
          {soa ? `Tom ${soa}` : 'Sem tom informado'}
          {comCapo ? `  ·  Capotraste ${a.capotraste}` : ''}
        </Texto>
        {comCapo ? (
          <Texto variante="meta" cor="textoSuave">
            {`Toca-se em ${toca} (capotraste na ${a.capotraste}ª casa)`}
          </Texto>
        ) : null}
      </View>

      {pronta.transpoe ? null : (
        <Aviso tipo="info" titulo="Sem transposição">
          {AVISO_DE_TEXTO_LIVRE}
        </Aviso>
      )}

      {/* Quatro controles na mesma linha, como no protótipo; quebram quando a fonte cresce. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Controle>
          <Botao
            titulo="Tom −"
            variante="secundario"
            tamanho="medio"
            rotuloAcessivel="Descer meio tom"
            desabilitado={!pronta.transpoe}
            aoPressionar={a.descerMeioTom}
          />
        </Controle>
        <Controle>
          <Botao
            titulo="Tom +"
            variante="secundario"
            tamanho="medio"
            rotuloAcessivel="Subir meio tom"
            desabilitado={!pronta.transpoe}
            aoPressionar={a.subirMeioTom}
          />
        </Controle>
        <Controle>
          <Botao
            titulo="A−"
            variante="secundario"
            tamanho="medio"
            rotuloAcessivel="Diminuir a letra"
            desabilitado={a.leitura.noMinimo}
            aoPressionar={a.leitura.menor}
          />
        </Controle>
        <Controle>
          <Botao
            titulo="A+"
            variante="secundario"
            tamanho="medio"
            rotuloAcessivel="Aumentar a letra"
            desabilitado={a.leitura.noMaximo}
            aoPressionar={a.leitura.maior}
          />
        </Controle>
      </View>

      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: ESPACO.e8 }}
      >
        <Texto variante="meta" cor="textoSuave" style={{ marginRight: ESPACO.e4 }}>
          {`Capotraste: ${a.capotraste === 0 ? 'sem' : `casa ${a.capotraste}`}`}
        </Texto>
        <Botao
          titulo="Capo −"
          variante="secundario"
          tamanho="medio"
          rotuloAcessivel="Capotraste uma casa abaixo"
          desabilitado={!pronta.transpoe || a.capotraste === 0}
          aoPressionar={a.capoAbaixo}
        />
        <Botao
          titulo="Capo +"
          variante="secundario"
          tamanho="medio"
          rotuloAcessivel="Capotraste uma casa acima"
          desabilitado={!pronta.transpoe || a.capotraste >= CAPOTRASTE_MAXIMO}
          aoPressionar={a.capoAcima}
        />
        {a.ajuste !== 0 ? (
          <Botao
            titulo="Tom do dia"
            variante="terciario"
            rotuloAcessivel="Voltar ao tom do dia"
            aoPressionar={a.voltarAoTomDoDia}
          />
        ) : null}
      </View>

      {/* Painel de leitura: sempre escuro e de alto contraste, qualquer que seja o tema do sistema. */}
      <ProvedorDeTemaForcado nome="escuro">
        <View
          accessibilityLabel="Cifra para tocar"
          style={{
            backgroundColor: TEMAS.escuro.base.fundo,
            borderRadius: RAIO.cartao,
            padding: ESPACO.e16,
          }}
        >
          {pronta.transpoe ? (
            <CifraNaTela linhas={pronta.linhas} tamanho={a.leitura.tamanho} />
          ) : (
            <Texto
              variante="leitura"
              selectable
              style={{ fontSize: a.leitura.tamanho, lineHeight: a.leitura.tamanho * 1.45 }}
            >
              {pronta.texto}
            </Texto>
          )}
        </View>
      </ProvedorDeTemaForcado>
      <Texto variante="legenda" cor="textoSuave" accessibilityRole="text">
        {`Letra: ${a.leitura.tamanho}`}
      </Texto>
    </View>
  )
}

/** Largura mínima de cada controle: abaixo disso, a fileira quebra em duas. */
const LARGURA_MINIMA_DO_CONTROLE = ESPACO.e32 + ESPACO.e40

/** Cada botão da fileira de quatro divide a linha; abaixo de 72 de largura, quebra. */
function Controle({ children }: { children: ReactNode }) {
  return <View style={{ flexGrow: 1, flexBasis: LARGURA_MINIMA_DO_CONTROLE }}>{children}</View>
}
