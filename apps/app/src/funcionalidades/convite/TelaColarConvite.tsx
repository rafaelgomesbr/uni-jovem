import { router } from 'expo-router'
import { useState } from 'react'

import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Folha } from '@/ui/Folha'
import { Texto } from '@/ui/Texto'

import { lerTokenDoConvite } from '../comunidade/TelaEntrarComConvite'
import { guardarConviteEmEspera } from './conviteEmEspera'

/**
 * "Tenho um link de convite" (3.1.1): folha com o campo "Cole o link" e
 * "Abrir convite". O token fica só em memória até a tela do convite o usar.
 */
export function TelaColarConvite() {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function abrir() {
    const token = lerTokenDoConvite(texto)
    if (!token) {
      setErro('Cole o link inteiro que você recebeu, do começo ao fim.')
      return
    }
    setErro(null)
    guardarConviteEmEspera(token)
    router.replace('/convite')
  }

  return (
    <Folha titulo="Abrir um convite">
      <Texto variante="corpo" cor="textoSuave">
        A conta é criada pelo convite que a liderança da sua comunidade manda.
      </Texto>
      <Campo
        rotulo="Cole o link"
        value={texto}
        onChangeText={setTexto}
        erro={erro}
        exemplo="https://.../convite#t=..."
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="go"
        onSubmitEditing={abrir}
      />
      <Botao titulo="Abrir convite" tamanho="grande" larguraTotal aoPressionar={abrir} />
    </Folha>
  )
}
