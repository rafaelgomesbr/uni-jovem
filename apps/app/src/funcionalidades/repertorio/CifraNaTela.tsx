import { simbolosDeAcidente, type LinhaDaCifra } from '@uj/dominio'
import { ESPACO, TIPO } from '@uj/tokens'
import { View } from 'react-native'

import { Texto } from '@/ui/Texto'

export { TAMANHO_PADRAO_DA_LETRA, TAMANHOS_DA_LETRA } from './useAjustesDaCifra'

/** Os acordes de uma linha, para o leitor de tela ("Acordes: G, D"). */
function acordesDaLinha(linha: Extract<LinhaDaCifra, { tipo: 'texto' }>): string[] {
  return linha.trechos.flatMap((t) => (t.acorde ? [simbolosDeAcidente(t.acorde)] : []))
}

/**
 * A cifra desenhada: cada acorde fica ACIMA da sílaba em que muda, em negrito (nunca só em cor),
 * e as seções (Verso, Refrão) têm rótulo em texto. Cada linha é um bloco para o leitor de tela: a
 * letra e depois os acordes. A cor vem do tema em vigor: dentro do painel escuro de leitura e do
 * Modo palco é a paleta escura, com contraste AA (acorde `#FFB199` sobre `#07061A`: 11,43).
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
  const altura = Math.round(tamanho * 1.45)
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
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            {linha.trechos.map((t, j) => (
              <View key={j}>
                {temAcorde ? (
                  <Texto
                    variante="leitura"
                    cor="destaque"
                    peso="forte"
                    {...teto}
                    style={{ fontSize: tamanhoDoAcorde, lineHeight: altura }}
                  >
                    {t.acorde ? `${simbolosDeAcidente(t.acorde)} ` : ' '}
                  </Texto>
                ) : null}
                <Texto
                  variante="leitura"
                  {...teto}
                  style={{ fontSize: tamanho, lineHeight: altura }}
                >
                  {t.letra === '' ? ' ' : t.letra}
                </Texto>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}
