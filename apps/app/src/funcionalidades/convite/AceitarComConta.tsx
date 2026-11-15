import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { ehErroDaApi } from '@/servicos/erros'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'

import {
  ConsentimentoDeFe,
  MenorDe16,
  motivoDoConsentimento,
  PerguntaDeIdade,
} from './Consentimentos'
import { descartarConviteEmEspera } from './conviteEmEspera'

interface Props {
  token: string
  comunidade: string
  papel: string
}

/** Erros da API que a tela resolve pedindo o que falta, em vez de só mostrar. */
const PEDE_IDADE = 'faixa_etaria_necessaria'
const PEDE_RESPONSAVEL = 'responsavel_necessario'

/**
 * Conta existente e conectada: confirma a entrada na comunidade do convite,
 * com o consentimento sobre a fé desta comunidade (TC-03). A idade (TC-01) só
 * é pedida se a conta ainda não declarou: a API avisa com `faixa_etaria_necessaria`.
 */
export function AceitarComConta({ token, comunidade, papel }: Props) {
  const { conta } = useSessao()
  const consultas = useQueryClient()
  const [fe, setFe] = useState(false)
  const [precisaIdade, setPrecisaIdade] = useState(false)
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null)
  const [precisaResponsavel, setPrecisaResponsavel] = useState(false)
  const [responsavel, setResponsavel] = useState(false)
  const pedirResponsavel = precisaResponsavel || faixa === '16_17'

  const aceitar = useMutation({
    mutationFn: () =>
      api.post<{ vinculoId: string }>('/api/auth/convite/aceitar', {
        token,
        consentimentoFe: fe,
        ...(precisaIdade && faixa ? { faixaEtaria: faixa } : {}),
        responsavelCiente: pedirResponsavel && responsavel,
      }),
    onSuccess: async () => {
      descartarConviteEmEspera()
      await consultas.invalidateQueries({ queryKey: CHAVES.eu })
    },
    onError: (erro) => {
      if (ehErroDaApi(erro, PEDE_IDADE)) setPrecisaIdade(true)
      if (ehErroDaApi(erro, PEDE_RESPONSAVEL)) setPrecisaResponsavel(true)
    },
  })

  if (aceitar.isSuccess) {
    return (
      <Cartao titulo="Pronto!" icone="confirmado">
        <Texto accessibilityLiveRegion="polite">
          Agora você participa de {comunidade} como {papel}.
        </Texto>
        <Botao titulo="Ir para o início" aoPressionar={() => router.replace('/')} />
      </Cartao>
    )
  }

  const menor = precisaIdade && faixa === 'menos_16'
  const motivo =
    precisaIdade && faixa === null
      ? 'Responda quantos anos você tem.'
      : motivoDoConsentimento(fe, pedirResponsavel, responsavel)
  // O pedido do que falta já aparece na tela; o erro da API, só quando for outro.
  const erroParaMostrar =
    aceitar.error && !ehErroDaApi(aceitar.error, PEDE_IDADE) ? aceitar.error : null

  return (
    <Cartao>
      {conta ? (
        <Texto variante="apoio" cor="textoSuave">
          Você está conectado como {conta.email}.
        </Texto>
      ) : null}
      {precisaIdade ? (
        <>
          <Texto>Antes de entrar na comunidade, informe a sua faixa de idade.</Texto>
          <PerguntaDeIdade valor={faixa} aoMudar={setFaixa} />
        </>
      ) : null}
      {menor ? (
        <MenorDe16 />
      ) : (
        <>
          <ConsentimentoDeFe
            comunidade={comunidade}
            marcada={fe}
            aoMudar={setFe}
            pedirResponsavel={pedirResponsavel}
            responsavel={responsavel}
            aoMudarResponsavel={setResponsavel}
          />
          {erroParaMostrar ? <AvisoDeErro erro={erroParaMostrar} /> : null}
          <Botao
            titulo={`Entrar em ${comunidade} como ${papel}`}
            aoPressionar={() => aceitar.mutate()}
            carregando={aceitar.isPending}
            desabilitado={motivo !== null}
            {...(motivo ? { motivo } : {})}
          />
        </>
      )}
      <Botao
        titulo="Agora não"
        variante="discreto"
        aoPressionar={() => {
          descartarConviteEmEspera()
          router.replace('/')
        }}
      />
    </Cartao>
  )
}
