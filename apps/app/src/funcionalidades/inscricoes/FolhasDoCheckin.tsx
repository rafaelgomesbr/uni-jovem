import { useState } from 'react'

import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { FolhaNaTela } from '@/ui/FolhaNaTela'

import { codigoDeEntradaValido } from './nomes'

/** "Pelo código de entrada": o código de 10 letras e números que está embaixo do QR. */
export function FolhaDoCodigo({
  aberta,
  aoFechar,
  aoMarcar,
}: {
  aberta: boolean
  aoFechar: () => void
  /** Recebe o código já limpo e em maiúsculas. */
  aoMarcar: (codigo: string) => void
}) {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function marcar() {
    const valido = codigoDeEntradaValido(codigo)
    if (!valido) {
      setErro('O código tem 10 letras (A a F) e números.')
      return
    }
    setErro(null)
    setCodigo('')
    aoFechar()
    aoMarcar(valido)
  }

  return (
    <FolhaNaTela aberta={aberta} titulo="Pelo código de entrada" aoFechar={aoFechar}>
      <Campo
        rotulo="Código de entrada"
        value={codigo}
        onChangeText={(t) => {
          setCodigo(t)
          setErro(null)
        }}
        erro={erro}
        ajuda="10 letras e números, como aparece abaixo do QR."
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        onSubmitEditing={marcar}
      />
      <Botao
        titulo="Marcar presença"
        tamanho="grande"
        larguraTotal
        rotuloAcessivel="Marcar presença pelo código"
        aoPressionar={marcar}
      />
    </FolhaNaTela>
  )
}

/** "Chegou sem inscrição": visitante sem conta e sem inscrição, só o nome. */
export function FolhaDoAvulso({
  aberta,
  aoFechar,
  aoRegistrar,
}: {
  aberta: boolean
  aoFechar: () => void
  aoRegistrar: (nome: string) => void
}) {
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function registrar() {
    if (!nome.trim()) {
      setErro('Escreva o nome de quem chegou.')
      return
    }
    const escolhido = nome.trim()
    setErro(null)
    setNome('')
    aoFechar()
    aoRegistrar(escolhido)
  }

  return (
    <FolhaNaTela aberta={aberta} titulo="Chegou sem inscrição" aoFechar={aoFechar}>
      <Campo
        rotulo="Nome"
        rotuloAcessivel="Nome de quem chegou"
        value={nome}
        onChangeText={(t) => {
          setNome(t)
          setErro(null)
        }}
        erro={erro}
        ajuda="Para visitantes sem inscrição e sem conta: só o nome."
        autoCapitalize="words"
        maxLength={120}
        onSubmitEditing={registrar}
      />
      <Botao
        titulo="Registrar presença"
        tamanho="grande"
        larguraTotal
        rotuloAcessivel="Registrar presença sem inscrição"
        aoPressionar={registrar}
      />
    </FolhaNaTela>
  )
}
