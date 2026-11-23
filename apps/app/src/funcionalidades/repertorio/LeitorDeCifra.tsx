import { CAPOTRASTE_MAXIMO, metadadosDaCifra, prepararCifra } from '@uj/dominio'
import { ESPACO, RAIO, TEMAS } from '@uj/tokens'
import { View } from 'react-native'

import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { ProvedorDeTemaForcado } from '@/ui/tema'

import { BotoesDaCasa, BotoesDaLetra, BotoesDoTom } from './ControlesDaCifra'
import { CifraNaTela } from './CifraNaTela'
import {
  FRASE_DO_PASSO_DO_TOM,
  fraseDeComoTocar,
  fraseDoAjustePessoal,
  fraseDoCapotraste,
  tituloDeVoltarAoTom,
  tituloDoTom,
  tomDivergente,
} from './rotulosDaCifra'
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
 * Leitor de cifra (D61, visual A em D71, controles e cor dos acordes em D82). De cima para baixo:
 * o tom que soa em letra grande (e o capotraste, em palavras), "Descer tom" e "Subir tom",
 * "Voltar ao tom do dia" quando a pessoa mexeu, o capotraste, o tamanho da letra e a cifra num
 * painel escuro de alto contraste, com os acordes em outra cor e em negrito sobre a sílaba. Tudo o
 * que se muda aparece na hora, no tom escrito e nos acordes. Os ajustes valem só neste aparelho e
 * nesta leitura: nunca mudam o tom do dia nem a música.
 */
export function LeitorDeCifra({ cifra, tomOriginal, tomDoDia, tamanhoInicial, ajustes }: Props) {
  const interno = useAjustesDaCifra(tamanhoInicial === undefined ? {} : { tamanhoInicial })
  const a = ajustes ?? interno

  const pedido = { tomOriginal, tomDoDia: tomDoDia ?? null, capotraste: a.capotraste }
  const pronta = prepararCifra(cifra, { ...pedido, ajuste: a.ajuste })
  // O tom para onde "Voltar" leva: o mesmo cálculo, sem o ajuste pessoal.
  const semAjuste = prepararCifra(cifra, { ...pedido, ajuste: 0 })

  if (!cifra || !cifra.trim()) {
    return (
      <Aviso tipo="info" titulo="Esta música ainda não tem cifra">
        Quem organiza pode cadastrar a cifra na música, na Biblioteca.
      </Aviso>
    )
  }

  const titulo = tituloDoTom(pronta)
  const comoTocar = fraseDeComoTocar(pronta, a.capotraste)
  const divergencia = tomDivergente(tomOriginal, metadadosDaCifra(cifra).tom)
  const temTomDoDia = !!tomDoDia
  const resumoDoCapotraste = [fraseDoCapotraste(a.capotraste), comoTocar].filter(Boolean).join('. ')

  return (
    <View style={{ gap: ESPACO.e16 }}>
      {pronta.transpoe ? null : (
        <Aviso tipo="info" titulo="Sem transposição">
          {AVISO_DE_TEXTO_LIVRE}
        </Aviso>
      )}

      {divergencia ? (
        <Aviso tipo="info" titulo={`A cifra está escrita em ${divergencia.daCifra}`}>
          {`O cadastro da música diz ${divergencia.cadastrado}. A tela segue o tom da cifra. Quem organiza pode acertar o tom na Biblioteca.`}
        </Aviso>
      ) : null}

      <Cartao sobrancelha="Tom" opaco intervalo={ESPACO.e12}>
        <TextoAnunciado soMudancas variante="tituloCartao">
          {titulo}
        </TextoAnunciado>

        <BotoesDoTom
          desabilitado={!pronta.transpoe}
          aoDescer={a.descerMeioTom}
          aoSubir={a.subirMeioTom}
        />
        <Texto variante="legenda" cor="textoSuave">
          {FRASE_DO_PASSO_DO_TOM}
        </Texto>

        {a.ajuste !== 0 ? (
          <>
            <Texto variante="legenda" cor="textoSuave">
              {fraseDoAjustePessoal(temTomDoDia, semAjuste.tomQueSoa)}
            </Texto>
            <Botao
              titulo={tituloDeVoltarAoTom(temTomDoDia, semAjuste.tomQueSoa)}
              variante="terciario"
              alinhado
              aoPressionar={a.voltarAoTomDoDia}
            />
          </>
        ) : null}
      </Cartao>

      <Cartao sobrancelha="Capotraste" opaco intervalo={ESPACO.e12}>
        <View accessible accessibilityLabel={resumoDoCapotraste} style={{ gap: ESPACO.e4 }}>
          <Texto variante="tituloItem">{fraseDoCapotraste(a.capotraste)}</Texto>
          {comoTocar ? (
            <Texto variante="meta" cor="textoSuave">
              {comoTocar}
            </Texto>
          ) : null}
        </View>

        <BotoesDaCasa
          desabilitado={!pronta.transpoe}
          noMinimo={a.capotraste === 0}
          noMaximo={a.capotraste >= CAPOTRASTE_MAXIMO}
          aoDescer={a.capoAbaixo}
          aoSubir={a.capoAcima}
        />
      </Cartao>

      <Cartao sobrancelha="Tamanho da letra" opaco>
        <BotoesDaLetra
          noMinimo={a.leitura.noMinimo}
          noMaximo={a.leitura.noMaximo}
          aoMenor={a.leitura.menor}
          aoMaior={a.leitura.maior}
        />
      </Cartao>

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
    </View>
  )
}
