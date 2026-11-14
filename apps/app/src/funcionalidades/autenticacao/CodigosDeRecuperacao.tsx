import { ESPACO, RAIO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { copiarTexto } from '@/utilidades/compartilhar'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Cartao } from '@/ui/Cartao'
import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

interface Props {
  codigos: string[]
  aoConcluir: () => void
  rotuloDeConcluir: string
}

/** Códigos de recuperação: aparecem uma única vez, com cópia e aviso claro. */
export function CodigosDeRecuperacao({ codigos, aoConcluir, rotuloDeConcluir }: Props) {
  const { cores } = useTema()
  const [copiado, setCopiado] = useState<boolean | null>(null)
  const [guardou, setGuardou] = useState(false)

  return (
    <Cartao titulo="Guarde seus códigos de recuperação" icone="chave">
      <View
        accessibilityRole="alert"
        style={{
          flexDirection: 'row',
          gap: ESPACO.x2,
          padding: ESPACO.x3,
          borderRadius: RAIO.medio,
          borderWidth: 1.5,
          borderColor: cores.alerta,
        }}
      >
        <Icone nome="erro" cor={cores.alerta} />
        <Texto variante="apoio" style={{ flex: 1 }}>
          Estes códigos aparecem só agora. Cada um serve uma vez para entrar se você perder o
          celular com o autenticador. Guarde num lugar seguro, fora deste aparelho.
        </Texto>
      </View>
      <View
        accessible
        accessibilityLabel={`Códigos de recuperação: ${codigos.join(', ')}`}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}
      >
        {codigos.map((codigo) => (
          <Texto
            key={codigo}
            selectable
            variante="corpoForte"
            style={{
              paddingHorizontal: ESPACO.x3,
              paddingVertical: ESPACO.x1,
              borderRadius: RAIO.pequeno,
              backgroundColor: cores.superficieElevada,
              fontVariant: ['tabular-nums'],
            }}
          >
            {codigo}
          </Texto>
        ))}
      </View>
      <Botao
        titulo={copiado ? 'Códigos copiados' : 'Copiar todos os códigos'}
        icone={copiado ? 'confirmado' : 'copiar'}
        variante="secundario"
        aoPressionar={async () => setCopiado(await copiarTexto(codigos.join('\n')))}
      />
      {copiado === false ? (
        <Texto variante="apoio" cor="erro">
          Não foi possível copiar. Selecione os códigos acima ou anote-os à mão.
        </Texto>
      ) : null}
      <CaixaDeMarcar
        rotulo="Guardei os códigos em local seguro"
        marcada={guardou}
        aoMudar={setGuardou}
      />
      <Botao
        titulo={rotuloDeConcluir}
        aoPressionar={aoConcluir}
        desabilitado={!guardou}
        motivo="Confirme acima que você guardou os códigos."
      />
    </Cartao>
  )
}
