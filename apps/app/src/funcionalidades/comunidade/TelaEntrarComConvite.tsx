import { router } from 'expo-router'
import { useState } from 'react'

import { lerParametroDoFragmento } from '@/utilidades/fragmento'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'

import { guardarConviteEmEspera } from '../convite/conviteEmEspera'
import { CabecalhoDeTela, TelaPropria } from './visual'

/** Token do convite: base64url de 256 bits (43 caracteres); aceita folga para o futuro. */
const TOKEN = /^[A-Za-z0-9_-]{20,200}$/

/**
 * Tira o token do que a pessoa colou: o link inteiro (`.../convite#t=...`),
 * só o pedaço depois de `#t=`, ou o código puro. `null` se não reconhecer.
 */
export function lerTokenDoConvite(texto: string): string | null {
  const limpo = texto.trim()
  if (!limpo) return null
  const aposCerquilha = limpo.includes('#') ? limpo.slice(limpo.indexOf('#') + 1) : null
  const doFragmento = aposCerquilha ? lerParametroDoFragmento(aposCerquilha) : null
  const doParametro = !doFragmento && limpo.startsWith('t=') ? limpo.slice(2) : null
  const candidato = doFragmento ?? doParametro ?? limpo
  return TOKEN.test(candidato) ? candidato : null
}

/** Abre o fluxo de aceitar convite com a conta atual a partir de um link ou código colado. */
export function abrirConvite(token: string) {
  // Só em memória (nada vai para disco); a tela do convite o retoma e descarta.
  guardarConviteEmEspera(token)
  router.push('/convite')
}

export function TelaEntrarComConvite() {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function continuar() {
    const token = lerTokenDoConvite(texto)
    if (!token) {
      setErro(
        'Não reconhecemos esse convite. Cole o link inteiro que você recebeu, do começo ao fim.',
      )
      return
    }
    setErro(null)
    setTexto('')
    abrirConvite(token)
  }

  return (
    <TelaPropria>
      <CabecalhoDeTela
        sobrancelha="Comunidades"
        titulo="Entrar com um convite"
        descricao="Recebeu um link de convite? Cole aqui para entrar na comunidade com a conta que você já tem."
      />
      <Cartao titulo="Link ou código do convite" icone="link">
        <Campo
          rotulo="Link ou código do convite"
          value={texto}
          onChangeText={setTexto}
          erro={erro}
          exemplo="https://.../convite#t=..."
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          onSubmitEditing={continuar}
        />
        <Botao titulo="Continuar" icone="avancar" aoPressionar={continuar} />
        <Texto variante="legenda" cor="textoSuave">
          Na próxima tela aparecem a comunidade e o papel do convite. Nada muda antes de você
          confirmar.
        </Texto>
      </Cartao>
    </TelaPropria>
  )
}
