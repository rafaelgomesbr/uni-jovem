import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { Modal, ScrollView, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { ehErroDaApi } from '@/servicos/erros'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'

/** A API pede prova recente de 2FA antes de ações de plataforma (D12, D31). */
export function exigeProvaDeSegundoFator(erro: unknown): boolean {
  return ehErroDaApi(erro, 'segundo_fator_necessario')
}

interface PropsDaProva {
  aoConfirmar: () => void
  aoCancelar?: () => void
  /** Para que é o código (ex.: "Para criar a comunidade"). */
  motivo?: string
}

/**
 * Pede o código do autenticador e troca o token de acesso por um com prova
 * recente (`/api/auth/2fa/provar`, vale 15 min). Depois, quem chamou repete
 * a ação. O login do Criador não pede o código (D31); ele vem aqui, na hora.
 */
export function ProvaDeSegundoFator({ aoConfirmar, aoCancelar, motivo }: PropsDaProva) {
  const { conta } = useSessao()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const provar = useMutation({
    mutationFn: () =>
      api.post<{ acesso: string }>('/api/auth/2fa/provar', { codigo: codigo.trim() }),
    onSuccess: (r) => {
      api.definirAcesso(r.acesso)
      setCodigo('')
      aoConfirmar()
    },
  })

  function enviar() {
    if (codigo.replace(/\s/g, '').length < 6) {
      setErro('Digite os 6 números do app autenticador (ou um código de recuperação).')
      return
    }
    setErro(null)
    provar.mutate()
  }

  if (conta && !conta.doisFatores) {
    return (
      <Cartao titulo="Ative a verificação em duas etapas" icone="seguranca">
        <Texto variante="corpo">
          Ações da plataforma pedem um código do app autenticador. Ative a verificação em duas
          etapas e volte aqui.
        </Texto>
        <Botao
          titulo="Ativar agora"
          icone="seguranca"
          aoPressionar={() => router.push('/ativar-2fa')}
        />
        {aoCancelar ? (
          <Botao titulo="Agora não" variante="terciario" aoPressionar={aoCancelar} />
        ) : null}
      </Cartao>
    )
  }

  return (
    <Cartao titulo="Confirme que é você" icone="seguranca">
      <Texto variante="corpo">
        {motivo ? `${motivo}, digite` : 'Digite'} o código de 6 números do seu app autenticador.
        Ações da plataforma sempre pedem o código, mesmo com a sessão aberta.
      </Texto>
      <Campo
        rotulo="Código do app autenticador"
        ajuda="São 6 números. Sem o celular, use um dos seus códigos de recuperação."
        value={codigo}
        onChangeText={setCodigo}
        erro={erro}
        autoCapitalize="characters"
        autoCorrect={false}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={12}
        onSubmitEditing={enviar}
      />
      {provar.error ? <AvisoDeErro erro={provar.error} /> : null}
      <Botao
        titulo="Confirmar"
        icone="confirmado"
        aoPressionar={enviar}
        carregando={provar.isPending}
      />
      {aoCancelar ? (
        <Botao titulo="Cancelar" variante="terciario" aoPressionar={aoCancelar} />
      ) : null}
    </Cartao>
  )
}

/**
 * O pedido do código como folha por cima da tela: aparece quando uma ação de
 * plataforma recebe 403 `segundo_fator_necessario` e some depois de provar.
 */
export function PedidoDeCodigo({
  prova,
  motivo,
}: {
  prova: { aoProvar: () => void; aoCancelar: () => void } | null
  motivo?: string
}) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  return (
    <Modal
      visible={prova !== null}
      transparent
      animationType={reduzirMovimento ? 'none' : 'fade'}
      onRequestClose={prova?.aoCancelar}
    >
      <View
        accessibilityViewIsModal
        style={{ flex: 1, backgroundColor: 'rgba(10,8,30,0.72)', justifyContent: 'center' }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: ESPACO.e20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
            {prova ? (
              <ProvaDeSegundoFator
                aoConfirmar={prova.aoProvar}
                aoCancelar={prova.aoCancelar}
                {...(motivo ? { motivo } : {})}
              />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
