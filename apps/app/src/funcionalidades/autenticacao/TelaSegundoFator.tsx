import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { Redirect } from 'expo-router'
import { useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { useSessao } from '@/estado/sessao'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { Tela } from '@/ui/Tela'

/**
 * Segundo fator (3.1.4): cabeçalho de pilha, cartão com o código de 6 e o
 * terciário "Usar um código de recuperação", e a barra de ação com o primário.
 */
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
      pilha
      aurora={1}
      titulo="Código extra ao entrar"
      descricao={
        recuperacao
          ? 'Digite um dos códigos de recuperação que você guardou. Cada código vale uma vez.'
          : `Abra o seu app autenticador e digite o código de 6 números do ${NOME_DO_APP}.`
      }
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Confirmar"
            tamanho="grande"
            aoPressionar={enviar}
            carregando={confirmar.isPending}
          />
        </BarraDeAcao>
      }
    >
      <CartaoDeVidro intervalo={ESPACO.e8}>
        <Campo
          key={recuperacao ? 'recuperacao' : 'autenticador'}
          rotulo={recuperacao ? 'Código de recuperação' : 'Código do autenticador'}
          value={codigo}
          onChangeText={setCodigo}
          erro={erro}
          codigo={!recuperacao}
          autoCapitalize={recuperacao ? 'characters' : 'none'}
          autoCorrect={false}
          keyboardType={recuperacao ? 'default' : 'number-pad'}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={recuperacao ? 12 : 6}
          {...(recuperacao ? { exemplo: 'XXXX-XXXX' } : {})}
          onSubmitEditing={enviar}
        />
        <Botao
          titulo={recuperacao ? 'Usar o app autenticador' : 'Usar um código de recuperação'}
          variante="terciario"
          alinhado
          aoPressionar={() => {
            setRecuperacao((v) => !v)
            setCodigo('')
            setErro(null)
          }}
        />
        {confirmar.error ? <AvisoDeFalha erro={confirmar.error} /> : null}
      </CartaoDeVidro>
    </Tela>
  )
}
