import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import type { ConfiguracaoDoAutenticador } from '@/servicos/contrato'
import { abrirLink, copiarTexto } from '@/utilidades/compartilhar'
import { agruparDe4 } from '@/utilidades/formatos'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { CodigoQR } from '@/ui/CodigoQR'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

/**
 * Cadastro no app autenticador (3.1.2, passo 2): cartão de destaque com o QR
 * de 200 sobre branco, a chave numa linha copiável (só ícone "Copiar") e o
 * atalho para abrir o app autenticador no mesmo aparelho.
 */
export function ConfigurarAutenticador({ uri, segredo }: ConfiguracaoDoAutenticador) {
  const [aviso, setAviso] = useState<string | null>(null)

  return (
    <Cartao
      sobrancelha="App autenticador"
      titulo={`Cadastre o ${NOME_DO_APP} no autenticador`}
      acoes={
        <Botao
          titulo="Abrir no app autenticador"
          icone="link"
          variante="secundario"
          aoPressionar={async () => {
            const abriu = await abrirLink(uri)
            setAviso(abriu ? null : 'Nenhum app autenticador abriu. Digite a chave à mão.')
          }}
        />
      }
    >
      <View style={{ gap: ESPACO.e16 }}>
        <Texto variante="corpo" cor="textoSuave">
          Use o Google Authenticator, o Microsoft Authenticator ou o app Senhas do iPhone: leia o QR
          com outro aparelho ou digite a chave.
        </Texto>
        <CodigoQR valor={uri} rotulo="QR para cadastrar no app autenticador" tamanho={200} />
        <View>
          <Texto variante="rotulo" cor="textoSuave">
            Chave para digitar
          </Texto>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
            <Texto
              selectable
              variante="tituloItem"
              tabular
              accessibilityLabel={`Chave: ${segredo.split('').join(' ')}`}
              style={{ flex: 1 }}
            >
              {agruparDe4(segredo)}
            </Texto>
            <BotaoIcone
              icone="copiar"
              rotulo="Copiar a chave"
              aoPressionar={async () => {
                const ok = await copiarTexto(segredo)
                setAviso(ok ? 'Chave copiada.' : 'Não foi possível copiar. Selecione a chave.')
              }}
            />
          </View>
        </View>
        {aviso ? (
          <TextoAnunciado variante="legenda" cor="textoSuave">
            {aviso}
          </TextoAnunciado>
        ) : null}
      </View>
    </Cartao>
  )
}
