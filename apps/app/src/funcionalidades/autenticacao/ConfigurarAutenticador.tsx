import { ESPACO, RAIO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import type { ConfiguracaoDoAutenticador } from '@/servicos/contrato'
import { abrirLink, copiarTexto } from '@/utilidades/compartilhar'
import { agruparDe4 } from '@/utilidades/formatos'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

/**
 * Passo de cadastro no app autenticador: link `otpauth://` (abre o app no
 * mesmo aparelho) e o segredo em texto para digitar à mão. Sem QR por ora:
 * gerar QR exigiria uma dependência nova.
 */
export function ConfigurarAutenticador({ uri, segredo }: ConfiguracaoDoAutenticador) {
  const { cores } = useTema()
  const [aviso, setAviso] = useState<string | null>(null)

  return (
    <Cartao titulo="Cadastre no seu app autenticador" icone="seguranca">
      <Texto variante="apoio">
        Use um app como Google Authenticator, Microsoft Authenticator ou o app Senhas do iPhone. Se
        ele estiver neste aparelho, toque em &quot;Abrir no app autenticador&quot;. Se não, digite a
        chave abaixo no app.
      </Texto>
      <Botao
        titulo="Abrir no app autenticador"
        icone="link"
        variante="secundario"
        aoPressionar={async () => {
          const abriu = await abrirLink(uri)
          setAviso(abriu ? null : 'Nenhum app autenticador abriu. Digite a chave à mão.')
        }}
      />
      <View style={{ gap: ESPACO.x1 }}>
        <Texto variante="corpoForte">Chave para digitar</Texto>
        <Texto
          selectable
          variante="corpoForte"
          accessibilityLabel={`Chave: ${segredo.split('').join(' ')}`}
          style={{
            padding: ESPACO.x3,
            borderRadius: RAIO.pequeno,
            backgroundColor: cores.superficieElevada,
            letterSpacing: 1,
          }}
        >
          {agruparDe4(segredo)}
        </Texto>
      </View>
      <Botao
        titulo="Copiar a chave"
        icone="copiar"
        variante="secundario"
        aoPressionar={async () => {
          const ok = await copiarTexto(segredo)
          setAviso(ok ? 'Chave copiada.' : 'Não foi possível copiar. Selecione a chave acima.')
        }}
      />
      {aviso ? (
        <Texto variante="apoio" accessibilityLiveRegion="polite">
          {aviso}
        </Texto>
      ) : null}
    </Cartao>
  )
}
