import { useMutation } from '@tanstack/react-query'
import { ESPACO, RITMO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { Modal, ScrollView, View } from 'react-native'

import { LARGURA_MAXIMA_DO_CONTEUDO } from '@/constantes'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { ehErroDaApi } from '@/servicos/erros'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { AvisoDeFalha } from '@/ui/Falha'
import { useTema } from '@/ui/tema'

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
 * É o cartão de destaque da Plataforma quando a prova é exigida (3.6.3).
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

  const cancelar = aoCancelar ? (
    <Botao titulo="Agora não" variante="terciario" alinhado aoPressionar={aoCancelar} />
  ) : null

  if (conta && !conta.doisFatores) {
    return (
      <CartaoDeDestaque
        sobrancelha="Segurança"
        titulo="Ligue o código extra ao entrar"
        descricao="Ações da plataforma pedem um código do app autenticador. Ligue o código extra ao entrar (verificação em duas etapas) e volte aqui."
        acoes={
          <View style={{ gap: ESPACO.e8, alignItems: 'flex-start' }}>
            <Botao titulo="Ativar agora" aoPressionar={() => router.push('/ativar-2fa')} />
            {cancelar}
          </View>
        }
      />
    )
  }

  return (
    <CartaoDeDestaque
      sobrancelha="Confirme que é você"
      titulo="Código do autenticador"
      descricao={`${motivo ? `${motivo}, digite` : 'Digite'} o código de 6 números do seu app autenticador. Ações da plataforma sempre pedem o código, mesmo com a sessão aberta.`}
      acoes={
        <View style={{ gap: ESPACO.e8, alignItems: 'flex-start' }}>
          <Botao titulo="Confirmar" carregando={provar.isPending} aoPressionar={enviar} />
          {cancelar}
        </View>
      }
    >
      <View style={{ gap: ESPACO.e8 }}>
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
        {provar.error ? (
          <AvisoDeFalha erro={provar.error} titulo="O código não foi aceito" />
        ) : null}
      </View>
    </CartaoDeDestaque>
  )
}

/**
 * O pedido do código por cima da tela: aparece quando uma ação de
 * plataforma recebe 403 `segundo_fator_necessario` e some depois de provar.
 */
export function PedidoDeCodigo({
  prova,
  motivo,
}: {
  prova: { aoProvar: () => void; aoCancelar: () => void } | null
  motivo?: string
}) {
  const { cores } = useTema()
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
        style={{ flex: 1, backgroundColor: cores.veu, justifyContent: 'center' }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: RITMO.margemDaTela,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{ width: '100%', maxWidth: LARGURA_MAXIMA_DO_CONTEUDO, alignSelf: 'center' }}
          >
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
