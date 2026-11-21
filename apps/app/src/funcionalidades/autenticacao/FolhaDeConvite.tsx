import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'

import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Folha } from '@/ui/Folha'
import { voltarOu } from '@/ui/navegacao'

import { guardarConvitePendente, reconhecerConvite } from './convitePendente'

export const TEXTO_DE_CONVITE_NAO_RECONHECIDO =
  'Não reconheci esse link ou código. Cole o link inteiro, do começo ao fim, ou digite o código sem espaços.'

/**
 * `convite.folha` (D63): "Tenho um convite ou código". Um campo "Link ou
 * código" com o botão Colar ao lado (a pessoa quase sempre copiou antes) e
 * Continuar. O convite fica guardado só em memória, a tela volta para a
 * entrada mostrando "Convite guardado", e depois de entrar ou criar a conta a
 * pessoa cai no convite (D58). Convite inválido não prende ninguém: o erro
 * pede o link inteiro e a entrada continua utilizável.
 */
export function FolhaDeConvite() {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function colar() {
    try {
      const copiado = (await Clipboard.getStringAsync()).trim()
      if (copiado) {
        setTexto(copiado)
        setErro(null)
      }
    } catch {
      // Sem acesso à área de transferência (o navegador pediu permissão e a pessoa negou): digita.
    }
  }

  function continuar() {
    const convite = reconhecerConvite(texto)
    if (!convite) {
      setErro(TEXTO_DE_CONVITE_NAO_RECONHECIDO)
      return
    }
    setErro(null)
    guardarConvitePendente(convite)
    voltarOu('/entrar')
  }

  return (
    <Folha titulo="Tenho um convite ou código">
      <Campo
        rotulo="Link ou código"
        ajuda="Cole o link que a liderança mandou ou digite o código da comunidade."
        value={texto}
        onChangeText={(novo) => {
          setTexto(novo)
          if (erro) setErro(null)
        }}
        erro={erro}
        botao={
          <Botao
            titulo="Colar"
            variante="secundario"
            icone="copiar"
            aoPressionar={() => void colar()}
          />
        }
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="go"
        onSubmitEditing={continuar}
      />
      <Botao titulo="Continuar" tamanho="grande" larguraTotal aoPressionar={continuar} />
    </Folha>
  )
}
