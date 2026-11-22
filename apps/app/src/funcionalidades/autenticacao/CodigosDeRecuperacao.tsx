import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { copiarTexto } from '@/utilidades/compartilhar'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

interface Props {
  codigos: string[]
  aoConcluir: () => void
  rotuloDeConcluir: string
}

/**
 * Códigos de recuperação (3.1.2, resultado): cartão de destaque com os
 * códigos em 2 colunas, algarismos de largura fixa. Aparecem uma única vez;
 * o primário só libera depois de a pessoa dizer que guardou.
 */
export function CodigosDeRecuperacao({ codigos, aoConcluir, rotuloDeConcluir }: Props) {
  const [copiado, setCopiado] = useState<boolean | null>(null)
  const [guardou, setGuardou] = useState(false)
  const metade = Math.ceil(codigos.length / 2)
  const colunas = [codigos.slice(0, metade), codigos.slice(metade)]

  return (
    <Cartao
      sobrancelha="Códigos de recuperação"
      titulo="Guarde estes códigos"
      acoes={
        <View style={{ gap: ESPACO.e8 }}>
          <Botao
            titulo={copiado ? 'Códigos copiados' : 'Copiar os códigos'}
            icone={copiado ? 'confirmado' : 'copiar'}
            variante="secundario"
            aoPressionar={async () => setCopiado(await copiarTexto(codigos.join('\n')))}
          />
          {copiado === false ? (
            <TextoAnunciado variante="legenda" cor="textoSuave">
              Não foi possível copiar. Selecione os códigos acima ou anote à mão.
            </TextoAnunciado>
          ) : null}
          <CaixaDeMarcar
            rotulo="Guardei os códigos em local seguro"
            marcada={guardou}
            aoMudar={setGuardou}
          />
          <Botao
            titulo={rotuloDeConcluir}
            tamanho="grande"
            larguraTotal
            aoPressionar={aoConcluir}
            desabilitado={!guardou}
            motivo="Confirme acima que você guardou os códigos."
          />
        </View>
      }
    >
      <Texto variante="corpo" cor="textoSuave">
        Eles aparecem só agora. Cada um serve uma vez para entrar se você perder o celular com o
        autenticador. Guarde fora deste aparelho.
      </Texto>
      <View
        accessible
        accessibilityLabel={`Códigos de recuperação: ${codigos.join(', ')}`}
        style={{ flexDirection: 'row', gap: ESPACO.e16 }}
      >
        {colunas.map((coluna, i) => (
          <View key={i} style={{ flex: 1, gap: ESPACO.e4 }}>
            {coluna.map((codigo) => (
              <Texto key={codigo} variante="corpo" peso="forte" tabular selectable>
                {codigo}
              </Texto>
            ))}
          </View>
        ))}
      </View>
    </Cartao>
  )
}
