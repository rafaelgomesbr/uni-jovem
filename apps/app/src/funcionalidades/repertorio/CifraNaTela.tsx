import { simbolosDeAcidente, type LinhaDaCifra } from '@uj/dominio'
import { View } from 'react-native'

import { Texto } from '@/ui/Texto'

/** Tamanhos da letra, em pontos, do menor ao maior. O padrão é grande: a cifra se lê de longe. */
export const TAMANHOS_DA_LETRA = [14, 16, 18, 20, 24, 28, 32] as const
export const TAMANHO_PADRAO_DA_LETRA = 20

/** Os acordes de uma linha, para o leitor de tela ("Acordes: G, D"). */
function acordesDaLinha(linha: Extract<LinhaDaCifra, { tipo: 'texto' }>): string[] {
  return linha.trechos.flatMap((t) => (t.acorde ? [simbolosDeAcidente(t.acorde)] : []))
}

/**
 * A cifra desenhada: cada acorde fica ACIMA da sílaba em que muda, em negrito
 * (nunca só em cor), e as seções (Verso, Refrão) têm rótulo em texto. Cada
 * linha é um bloco para o leitor de tela: a letra e depois os acordes.
 * A cor vem do tema em vigor: dentro do painel escuro de leitura, é a paleta
 * escura, com contraste AA.
 */
export function CifraNaTela({
  linhas,
  tamanho = TAMANHO_PADRAO_DA_LETRA,
}: {
  linhas: readonly LinhaDaCifra[]
  tamanho?: number
}) {
  const altura = Math.round(tamanho * 1.45)
  const tamanhoDoAcorde = Math.round(tamanho * 0.9)
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
              style={{ marginTop: 6, marginBottom: 2 }}
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
                    style={{ fontSize: tamanhoDoAcorde, lineHeight: altura }}
                  >
                    {t.acorde ? `${simbolosDeAcidente(t.acorde)} ` : ' '}
                  </Texto>
                ) : null}
                <Texto variante="leitura" style={{ fontSize: tamanho, lineHeight: altura }}>
                  {t.letra === '' ? ' ' : t.letra}
                </Texto>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}
