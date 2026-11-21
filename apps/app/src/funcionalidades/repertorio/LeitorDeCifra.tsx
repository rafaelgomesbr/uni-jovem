import { CAPOTRASTE_MAXIMO, prepararCifra, simbolosDeAcidente } from '@uj/dominio'
import { ESPACO, RAIO, TEMAS } from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'
import { ProvedorDeTemaForcado } from '@/ui/tema'

import { CifraNaTela, TAMANHO_PADRAO_DA_LETRA, TAMANHOS_DA_LETRA } from './CifraNaTela'

interface Props {
  cifra: string | null
  /** Tom da música na biblioteca. */
  tomOriginal: string | null
  /** Tom do dia, quando a cifra vem de um repertório. */
  tomDoDia?: string | null
  /** Tamanho inicial da letra. */
  tamanhoInicial?: number
}

const AVISO_DE_TEXTO_LIVRE =
  'Esta cifra está em texto livre, então o tom e o capotraste não mudam os acordes. Quem organiza pode converter a cifra na edição da música.'

/**
 * Leitor de cifra (D61): a cifra no tom do dia, com os botões de subir e
 * descer meio tom, o capotraste e o tamanho da letra. Os ajustes valem só
 * neste aparelho e nesta leitura: nunca mudam o tom do dia nem a música. A
 * leitura é num painel escuro, de alto contraste, com a letra grande.
 */
export function LeitorDeCifra({ cifra, tomOriginal, tomDoDia, tamanhoInicial }: Props) {
  const [ajuste, setAjuste] = useState(0)
  const [capotraste, setCapotraste] = useState(0)
  const [indiceDoTamanho, setIndiceDoTamanho] = useState(() => {
    const i = TAMANHOS_DA_LETRA.findIndex((t) => t === (tamanhoInicial ?? TAMANHO_PADRAO_DA_LETRA))
    return i >= 0 ? i : TAMANHOS_DA_LETRA.findIndex((t) => t === TAMANHO_PADRAO_DA_LETRA)
  })
  const tamanho = TAMANHOS_DA_LETRA[indiceDoTamanho] ?? TAMANHO_PADRAO_DA_LETRA

  const pronta = prepararCifra(cifra, {
    tomOriginal,
    tomDoDia: tomDoDia ?? null,
    ajuste,
    capotraste,
  })

  if (!cifra || !cifra.trim()) {
    return (
      <Aviso tipo="info" titulo="Esta música ainda não tem cifra">
        Quem organiza pode cadastrar a cifra na música, em Conteúdos.
      </Aviso>
    )
  }

  const soa = pronta.tomQueSoa ? simbolosDeAcidente(pronta.tomQueSoa) : null
  const toca = pronta.tomQueSeToca ? simbolosDeAcidente(pronta.tomQueSeToca) : null
  const resumoDoTom = soa
    ? capotraste > 0 && toca
      ? `Soa em ${soa}. Toque em ${toca} com o capotraste na ${capotraste}ª casa.`
      : `Tom ${soa}.`
    : 'Tom não informado.'

  return (
    <>
      <CartaoDeVidro sobrancelha="Tom e letra" opaco>
        <View accessible accessibilityLabel={resumoDoTom}>
          <Texto variante="tituloItem">{soa ? `Tom ${soa}` : 'Sem tom informado'}</Texto>
          {capotraste > 0 && toca ? (
            <Texto variante="meta" cor="textoSuave">
              {`Toca-se em ${toca} (capotraste na ${capotraste}ª casa)`}
            </Texto>
          ) : null}
        </View>
        {pronta.transpoe ? null : (
          <Aviso tipo="info" titulo="Sem transposição">
            {AVISO_DE_TEXTO_LIVRE}
          </Aviso>
        )}
        <Controle titulo="Tom">
          <Botao
            titulo="Tom −"
            variante="secundario"
            rotuloAcessivel="Descer meio tom"
            desabilitado={!pronta.transpoe}
            aoPressionar={() => setAjuste((a) => a - 1)}
          />
          <Botao
            titulo="Tom +"
            variante="secundario"
            rotuloAcessivel="Subir meio tom"
            desabilitado={!pronta.transpoe}
            aoPressionar={() => setAjuste((a) => a + 1)}
          />
          {ajuste !== 0 ? (
            <Botao
              titulo="Tom do dia"
              variante="terciario"
              rotuloAcessivel="Voltar ao tom do dia"
              aoPressionar={() => setAjuste(0)}
            />
          ) : null}
        </Controle>
        <Controle titulo={`Capotraste: ${capotraste === 0 ? 'sem' : `casa ${capotraste}`}`}>
          <Botao
            titulo="Capo −"
            variante="secundario"
            rotuloAcessivel="Capotraste uma casa abaixo"
            desabilitado={!pronta.transpoe || capotraste === 0}
            aoPressionar={() => setCapotraste((c) => Math.max(0, c - 1))}
          />
          <Botao
            titulo="Capo +"
            variante="secundario"
            rotuloAcessivel="Capotraste uma casa acima"
            desabilitado={!pronta.transpoe || capotraste >= CAPOTRASTE_MAXIMO}
            aoPressionar={() => setCapotraste((c) => Math.min(CAPOTRASTE_MAXIMO, c + 1))}
          />
        </Controle>
        <Controle titulo={`Letra: ${tamanho}`}>
          <Botao
            titulo="A−"
            variante="secundario"
            rotuloAcessivel="Diminuir a letra"
            desabilitado={indiceDoTamanho === 0}
            aoPressionar={() => setIndiceDoTamanho((i) => Math.max(0, i - 1))}
          />
          <Botao
            titulo="A+"
            variante="secundario"
            rotuloAcessivel="Aumentar a letra"
            desabilitado={indiceDoTamanho >= TAMANHOS_DA_LETRA.length - 1}
            aoPressionar={() =>
              setIndiceDoTamanho((i) => Math.min(TAMANHOS_DA_LETRA.length - 1, i + 1))
            }
          />
        </Controle>
      </CartaoDeVidro>

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
            <CifraNaTela linhas={pronta.linhas} tamanho={tamanho} />
          ) : (
            <Texto
              variante="leitura"
              selectable
              style={{ fontSize: tamanho, lineHeight: tamanho * 1.45 }}
            >
              {pronta.texto}
            </Texto>
          )}
        </View>
      </ProvedorDeTemaForcado>
    </>
  )
}

function Controle({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Texto variante="meta" cor="textoSuave">
        {titulo}
      </Texto>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8, alignItems: 'center' }}
      >
        {children}
      </View>
    </View>
  )
}
