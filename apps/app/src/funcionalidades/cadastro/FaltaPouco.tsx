import { ESPACO } from '@uj/tokens'
import type { ReactNode, Ref } from 'react'
import { View } from 'react-native'

import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CampoDeAcesso } from '@/ui/CampoDeAcesso'
import type { NoDeTexto } from '@/ui/foco'

import { QuadroDeAcesso } from '../autenticacao/QuadroDeAcesso'
import { AceiteDosTermos, MenorDe16, PerguntaDeIdade } from '../convite/Consentimentos'

interface PropsDaFaltaPouco {
  apoio: string
  /** Só quando falta o nome (cadastro por e-mail): Apple e Google já o entregam. */
  nome?: {
    valor: string
    aoMudar: (texto: string) => void
    erro: string | null
    disparoDeErro: number
  }
  faixa: FaixaEtaria | null
  aoMudarFaixa: (faixa: FaixaEtaria) => void
  termos: boolean
  aoMudarTermos: (marcada: boolean) => void
  carregando: boolean
  /** Erro do envio, acima da ação. */
  aviso?: ReactNode
  /** O desafio de segurança da web (ADR 0008): aparece aqui, no momento de criar, nunca numa tela à parte. */
  extra?: ReactNode
  aoVoltar: () => void
  aoConfirmar: () => void
  rotuloDoBotao?: string
  rotuloAcessivelDoBotao?: string
  refDoTitulo?: Ref<NoDeTexto>
  /** `criar.idade` em cada caminho tem a sua chave de passo (anima ao entrar). */
  chaveDoPasso?: string
}

/**
 * "Falta pouco" (`criar.idade`): a MESMA tela para quem veio da Apple, do
 * Google ou do e-mail. Pede só o que o provedor não entrega: o nome (só no
 * e-mail), a idade (TC-01) e o aceite dos Termos (TC-02). Os mecanismos legais
 * são os de sempre, palavra por palavra: a pergunta de idade com a ciência do
 * responsável de 16 e 17 anos (TC-01.v2, e a trava de 24 horas para menos de
 * 16), a caixa de marcar dos Termos e da Política e o botão desabilitado com o
 * motivo escrito até tudo estar marcado. Só a apresentação mudou (PH-11).
 */
export function FaltaPouco({
  apoio,
  nome,
  faixa,
  aoMudarFaixa,
  termos,
  aoMudarTermos,
  carregando,
  aviso,
  extra,
  aoVoltar,
  aoConfirmar,
  rotuloDoBotao = 'Criar conta',
  rotuloAcessivelDoBotao,
  refDoTitulo,
  chaveDoPasso = 'idade',
}: PropsDaFaltaPouco) {
  const menor = faixa === 'menos_16'
  const motivo =
    faixa === null
      ? 'Responda quantos anos você tem.'
      : !termos
        ? 'Para criar a conta, é preciso concordar com os Termos de Uso.'
        : null
  return (
    <QuadroDeAcesso
      titulo="Falta pouco"
      apoio={apoio}
      aoVoltar={aoVoltar}
      chaveDoPasso={chaveDoPasso}
      {...(refDoTitulo ? { refDoTitulo } : {})}
      {...(menor
        ? {}
        : {
            barraDeAcao: (
              <BarraDeAcao>
                <Botao
                  titulo={rotuloDoBotao}
                  {...(rotuloAcessivelDoBotao ? { rotuloAcessivel: rotuloAcessivelDoBotao } : {})}
                  tamanho="alto"
                  aoPressionar={aoConfirmar}
                  carregando={carregando}
                  desabilitado={motivo !== null}
                  {...(motivo ? { motivo } : {})}
                />
              </BarraDeAcao>
            ),
          })}
    >
      {nome ? (
        <CampoDeAcesso
          rotulo="Como você se chama?"
          apoio="É como a sua comunidade vai ver você."
          value={nome.valor}
          onChangeText={nome.aoMudar}
          erro={nome.erro}
          disparoDeErro={nome.disparoDeErro}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          maxLength={80}
          returnKeyType="done"
        />
      ) : null}
      <PerguntaDeIdade valor={faixa} aoMudar={aoMudarFaixa} />
      {menor ? (
        <MenorDe16 />
      ) : (
        <View style={{ gap: ESPACO.e8 }}>
          <AceiteDosTermos marcada={termos} aoMudar={aoMudarTermos} />
        </View>
      )}
      {extra}
      {aviso}
    </QuadroDeAcesso>
  )
}
