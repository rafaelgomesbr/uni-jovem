import { simbolosDeAcidente, type LinhaDaCifra, type Trecho } from '@uj/dominio'
import { ESPACO, TIPO } from '@uj/tokens'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Texto } from '@/ui/Texto'

export { TAMANHO_PADRAO_DA_LETRA, TAMANHOS_DA_LETRA } from './useAjustesDaCifra'

/** Os acordes de uma linha, para o leitor de tela ("Acordes: G, D"). */
function acordesDaLinha(linha: Extract<LinhaDaCifra, { tipo: 'texto' }>): string[] {
  return linha.trechos.flatMap((t) => (t.acorde ? [simbolosDeAcidente(t.acorde)] : []))
}

/** Um pedaço da letra com o acorde que muda nele (se houver): a coluna "acorde em cima, letra embaixo". */
export interface Coluna {
  acorde: string | null
  letra: string
}

/**
 * Parte a linha em PALAVRAS, cada uma com as suas colunas. A palavra é a unidade que quebra: o
 * acorde nunca se separa da sílaba em que muda (uma palavra com acorde no meio, "Che[G]gamos", fica
 * inteira), e a linha de acordes e a de letra quebram juntas quando não cabem. O acorde fica sobre
 * a primeira sílaba do trecho em que foi escrito.
 */
export function palavrasDaLinha(trechos: readonly Trecho[]): Coluna[][] {
  const palavras: Coluna[][] = []
  // A última coluna terminou sem espaço: a palavra segue no próximo pedaço.
  let aberta = false
  for (const t of trechos) {
    const pedacos = t.letra === '' ? [''] : (t.letra.match(/\S+\s*|\s+/g) ?? [t.letra])
    for (const [i, letra] of pedacos.entries()) {
      const coluna: Coluna = { acorde: i === 0 ? t.acorde : null, letra }
      const continua = aberta && (letra === '' || !/^\s/.test(letra))
      const atual = palavras[palavras.length - 1]
      if (continua && atual) atual.push(coluna)
      else palavras.push([coluna])
      if (letra !== '') aberta = !/\s$/.test(letra)
    }
  }
  return palavras
}

/**
 * A cifra desenhada: cada acorde fica ACIMA da sílaba em que muda, em negrito e em outra cor que a
 * da letra (âmbar, token `acorde`; nunca só a cor: a linha própria e o negrito também o separam), e
 * as seções (Verso, Refrão) têm rótulo em texto. Cada linha é um bloco para o leitor de tela: a
 * letra e depois os acordes. Com a letra grande a linha quebra por palavra, levando o acorde junto
 * (`palavrasDaLinha`). A cor vem do tema em vigor: dentro do painel escuro de leitura e do
 * Modo palco é a paleta escura, com contraste AA (acorde `#FFD166` sobre o painel `#12102A`:
 * 12,85, e sobre o palco `#07061A`: 13,87; com Aumentar contraste, `#FFE08A`).
 *
 * `tetoDaEscala` limita quanto a fonte do sistema ainda aumenta a letra: no Modo palco a pessoa já
 * escolhe o tamanho, e dobrar por cima disso tira a linha da tela.
 */
export function CifraNaTela({
  linhas,
  tamanho = 20,
  tetoDaEscala,
}: {
  linhas: readonly LinhaDaCifra[]
  tamanho?: number
  tetoDaEscala?: number
}) {
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const corDoAcorde = aumentarContraste ? 'acordeContraste' : 'acorde'
  const altura = Math.round(tamanho * 1.45)
  // Acorde e letra bem juntos (um par) e as linhas do par bem separadas entre si: o olho lê o
  // acorde SOBRE a sílaba, e não como uma linha solta entre duas de letra.
  const alturaDoAcorde = Math.round(tamanho * 0.9 * 1.15)
  const alturaDaLetra = Math.round(tamanho * 1.2)
  const respiroEntreLinhas = Math.round(tamanho * 0.4)
  const tamanhoDoAcorde = Math.round(tamanho * 0.9)
  const teto = tetoDaEscala === undefined ? {} : { maxFontSizeMultiplier: tetoDaEscala }
  return (
    <View accessibilityLabel="Cifra" style={{ gap: 0 }}>
      {linhas.map((linha, i) => {
        if (linha.tipo === 'vazia') {
          return <View key={i} style={{ height: Math.round(tamanho * 0.9) }} />
        }
        if (linha.tipo === 'rotulo') {
          return (
            <Texto
              key={i}
              variante="sobrancelha"
              peso="forte"
              {...teto}
              style={{
                marginTop: ESPACO.e8,
                marginBottom: ESPACO.e4,
                ...(tamanho >= 32
                  ? { fontSize: TIPO.rotulo.tamanho, lineHeight: TIPO.rotulo.altura }
                  : {}),
              }}
            >
              {linha.texto}
            </Texto>
          )
        }
        const temAcorde = linha.trechos.some((t) => t.acorde)
        const letra = linha.trechos.map((t) => t.letra).join('')
        const acordes = acordesDaLinha(linha)
        return (
          <View
            key={i}
            accessible
            accessibilityLabel={`${letra.trim() || 'Só acordes'}${acordes.length ? `. Acordes: ${acordes.join(', ')}` : ''}`}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              // Quando a linha quebra, cada par acorde/letra se separa do seguinte.
              rowGap: temAcorde ? respiroEntreLinhas : 0,
              marginBottom: temAcorde ? respiroEntreLinhas : 0,
            }}
          >
            {palavrasDaLinha(linha.trechos).map((palavra, j) => (
              // Uma palavra nunca quebra por dentro: só entre palavras.
              <View key={j} style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                {palavra.map((c, k) => (
                  <View key={k}>
                    {temAcorde ? (
                      <Texto
                        variante="leitura"
                        cor={corDoAcorde}
                        peso="forte"
                        {...teto}
                        style={{ fontSize: tamanhoDoAcorde, lineHeight: alturaDoAcorde }}
                      >
                        {c.acorde ? `${simbolosDeAcidente(c.acorde)} ` : ' '}
                      </Texto>
                    ) : null}
                    <Texto
                      variante="leitura"
                      {...teto}
                      style={{ fontSize: tamanho, lineHeight: temAcorde ? alturaDaLetra : altura }}
                    >
                      {c.letra === '' ? ' ' : c.letra}
                    </Texto>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}
