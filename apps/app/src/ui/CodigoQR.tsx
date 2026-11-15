import { create } from 'qrcode/lib/core/qrcode'
import { View } from 'react-native'

interface PropsDoCodigoQR {
  valor: string
  /** Lido pelo leitor de tela; o código em texto deve aparecer também perto. */
  rotulo: string
  tamanho?: number
}

/**
 * QR desenhado com Views (sem SVG nem dependência nativa). Sempre preto no
 * branco com margem, nos dois temas: é o que os leitores de QR esperam.
 */
export function CodigoQR({ valor, rotulo, tamanho = 200 }: PropsDoCodigoQR) {
  const { modules } = create(valor, { errorCorrectionLevel: 'M' })
  const n = modules.size
  const margem = 4
  const lado = Math.floor(tamanho / (n + margem * 2))
  const linhas = Array.from({ length: n }, (_, l) => l)
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotulo}
      style={{ backgroundColor: '#FFFFFF', padding: lado * margem, alignSelf: 'center' }}
    >
      {linhas.map((l) => (
        <View key={l} style={{ flexDirection: 'row' }}>
          {linhas.map((c) => (
            <View
              key={c}
              style={{
                width: lado,
                height: lado,
                backgroundColor: modules.get(l, c) ? '#000000' : '#FFFFFF',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  )
}
