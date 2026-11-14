import { useMutation } from '@tanstack/react-query'
import { Redirect, router } from 'expo-router'
import { useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { useSessao } from '@/estado/sessao'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Tela } from '@/ui/Tela'

export function TelaSegundoFator() {
  const sessao = useSessao()
  const [codigo, setCodigo] = useState('')
  const [recuperacao, setRecuperacao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const confirmar = useMutation({ mutationFn: () => sessao.confirmarSegundoFator(codigo) })

  // Sem desafio em andamento (ex.: recarregou a página), recomeça pelo e-mail e senha.
  if (!sessao.temSegundoFatorPendente && !confirmar.isPending && !confirmar.isSuccess) {
    return <Redirect href="/entrar" />
  }

  function enviar() {
    const limpo = codigo.trim()
    if (!limpo) {
      setErro(recuperacao ? 'Informe um código de recuperação.' : 'Informe o código de 6 números.')
      return
    }
    setErro(null)
    confirmar.mutate()
  }

  return (
    <Tela
      cabecalhoNativo
      titulo="Verificação em duas etapas"
      descricao={
        recuperacao
          ? 'Digite um dos códigos de recuperação que você guardou (formato XXXX-XXXX). Cada código vale uma vez.'
          : `Abra o seu app autenticador e digite o código de 6 números que aparece para o ${NOME_DO_APP}.`
      }
    >
      <Cartao>
        <Campo
          key={recuperacao ? 'recuperacao' : 'autenticador'}
          rotulo={recuperacao ? 'Código de recuperação' : 'Código do autenticador'}
          value={codigo}
          onChangeText={setCodigo}
          erro={erro}
          autoCapitalize={recuperacao ? 'characters' : 'none'}
          autoCorrect={false}
          keyboardType={recuperacao ? 'default' : 'number-pad'}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={recuperacao ? 12 : 6}
          onSubmitEditing={enviar}
        />
        {confirmar.error ? <AvisoDeErro erro={confirmar.error} /> : null}
        <Botao titulo="Confirmar" aoPressionar={enviar} carregando={confirmar.isPending} />
        <Botao
          titulo={recuperacao ? 'Usar o app autenticador' : 'Usar um código de recuperação'}
          variante="discreto"
          aoPressionar={() => {
            setRecuperacao((v) => !v)
            setCodigo('')
            setErro(null)
          }}
        />
        <Botao
          titulo="Voltar para entrar"
          variante="discreto"
          aoPressionar={() => router.replace('/entrar')}
        />
      </Cartao>
    </Tela>
  )
}
