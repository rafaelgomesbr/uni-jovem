import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { useSessao } from '@/estado/sessao'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { ehErroDaApi } from '@/servicos/erros'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'

import { MenorDe16, PerguntaDeIdade } from '../convite/Consentimentos'
import { abrirDocumento } from '../privacidade/TelaPrivacidade'

/** Onde o TC-03.v3 aparece: pedir ou entrar numa comunidade, ou criar a própria. */
export type FormaDaEntrada = 'entrada' | 'criacao'

/** TC-03.v3, recusa (texto do botão desabilitado). */
export const MENSAGEM_SEM_CONSENTIMENTO =
  'Sem essa concordância não conseguimos incluir você na comunidade, porque o app usa esses dados para funcionar. Se mudar de ideia, é só tentar de novo.'

export const MENSAGEM_SEM_RESPONSAVEL =
  'Para quem tem 16 ou 17 anos, confirme que seu responsável sabe e concorda.'

/**
 * TC-03.v3 (docs/privacidade/textos-de-consentimento.md), palavra por palavra:
 * "Sobre a sua fé", em bloco próprio, separado dos Termos e do Termo do
 * Administrador. Na criação, a primeira frase e a caixa mudam como o texto
 * manda. Para 16 e 17 anos, a caixa do responsável.
 */
export function ConsentimentoDaEntrada({
  comunidade,
  forma,
  marcada,
  aoMudar,
  pedirResponsavel,
  responsavel,
  aoMudarResponsavel,
}: {
  /** O nome, ou "comunidade deste código" quando ainda não se sabe qual é. */
  comunidade: string
  forma: FormaDaEntrada
  marcada: boolean
  aoMudar: (v: boolean) => void
  pedirResponsavel: boolean
  responsavel: boolean
  aoMudarResponsavel: (v: boolean) => void
}) {
  const abertura =
    forma === 'criacao'
      ? `Criar e participar da ${comunidade} no ${NOME_DO_APP} mostra que você tem ligação com uma comunidade de igreja. A lei considera isso um dado sensível.`
      : `Pedir para entrar ou participar da ${comunidade} no ${NOME_DO_APP} mostra que você tem ligação com uma comunidade de igreja. A lei considera isso um dado sensível.`
  const finalidade =
    forma === 'criacao'
      ? 'para organizar a minha participação nesta comunidade'
      : 'para analisar meu pedido de entrada, se eu fizer um, e para organizar a minha participação nesta comunidade'
  return (
    <View accessibilityRole="summary" style={{ gap: ESPACO.e8 }}>
      <Texto variante="tituloItem" accessibilityRole="header">
        Sobre a sua fé
      </Texto>
      <Texto variante="corpo">{abertura}</Texto>
      <CaixaDeMarcar
        rotulo={`Concordo que a ${comunidade} e o ${NOME_DO_APP} tratem meus dados ${finalidade}: eventos, escalas, presença, avisos, sugestões e pedidos de oração. Sei que nome e papel ficam visíveis para os membros desta comunidade, e meu e-mail e WhatsApp só para organizadores e administradores.`}
        marcada={marcada}
        aoMudar={aoMudar}
      />
      {pedirResponsavel ? (
        <CaixaDeMarcar
          rotulo="Meu pai, minha mãe ou meu responsável legal sabe deste consentimento e concorda."
          marcada={responsavel}
          aoMudar={aoMudarResponsavel}
        />
      ) : null}
      <Texto variante="meta" cor="textoSuave">
        {`Você pode desfazer isso quando quiser: cancelando o pedido, saindo da comunidade na aba Equipe ("Sair de ${comunidade}") ou excluindo sua conta.`}
      </Texto>
      <View style={{ alignItems: 'flex-start' }}>
        <Botao
          titulo="Saiba mais"
          rotuloAcessivel="Saiba mais sobre a fé e seus dados"
          variante="terciario"
          alinhado
          aoPressionar={() => void abrirDocumento('/privacidade#fe')}
        />
      </View>
    </View>
  )
}

/** O motivo escrito do botão desabilitado; `null` quando pode enviar. */
export function motivoDaEntrada(
  marcada: boolean,
  pedirResponsavel: boolean,
  responsavel: boolean,
): string | null {
  if (!marcada) return MENSAGEM_SEM_CONSENTIMENTO
  if (pedirResponsavel && !responsavel) return MENSAGEM_SEM_RESPONSAVEL
  return null
}

/**
 * Estado do TC-03.v3 numa tela de entrada. A idade só é pedida se a API
 * disser que a conta ainda não declarou (`faixa_etaria_necessaria`); a caixa
 * do responsável aparece de saída para quem declarou 16 ou 17 (U-21) ou
 * quando a API pedir (`responsavel_necessario`).
 */
export function useConsentimentoDaEntrada() {
  const { conta } = useSessao()
  const [fe, setFe] = useState(false)
  const [responsavel, setResponsavel] = useState(false)
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null)
  const [precisaIdade, setPrecisaIdade] = useState(false)
  const [precisaResponsavel, setPrecisaResponsavel] = useState(false)
  const pedirResponsavel = conta?.faixaEtaria === '16_17' || precisaResponsavel || faixa === '16_17'
  const menor = precisaIdade && faixa === 'menos_16'
  const motivo =
    precisaIdade && faixa === null
      ? 'Responda quantos anos você tem.'
      : motivoDaEntrada(fe, pedirResponsavel, responsavel)
  return {
    fe,
    setFe,
    responsavel,
    setResponsavel,
    faixa,
    setFaixa,
    precisaIdade,
    pedirResponsavel,
    menor,
    motivo,
    /** Campos do corpo de `POST /entrada` e `POST /comunidades/:idPublico/pedidos`. */
    corpo: () => ({
      consentimentoFe: fe,
      responsavelCiente: pedirResponsavel && responsavel,
      ...(precisaIdade && faixa ? { faixaEtaria: faixa } : {}),
    }),
    /** A API pediu idade ou responsável: a tela mostra o que falta, sem perder o resto. */
    aoFalhar: (erro: unknown) => {
      if (ehErroDaApi(erro, 'faixa_etaria_necessaria')) setPrecisaIdade(true)
      if (ehErroDaApi(erro, 'responsavel_necessario')) setPrecisaResponsavel(true)
    },
    /** Erro que vira campo na tela (não precisa de aviso à parte). */
    erroVirouCampo: (erro: unknown) =>
      ehErroDaApi(erro, 'faixa_etaria_necessaria') || ehErroDaApi(erro, 'responsavel_necessario'),
  }
}

/** A pergunta de idade (quando a API pede) e o TC-03.v3, num cartão opaco. */
export function CamposDoConsentimento({
  consentimento: c,
  comunidade,
  forma = 'entrada',
}: {
  consentimento: ReturnType<typeof useConsentimentoDaEntrada>
  comunidade: string
  forma?: FormaDaEntrada
}) {
  return (
    <>
      {c.precisaIdade ? (
        <View style={{ gap: ESPACO.e8 }}>
          <Texto variante="corpo">
            Antes de entrar na comunidade, informe a sua faixa de idade.
          </Texto>
          <PerguntaDeIdade valor={c.faixa} aoMudar={c.setFaixa} />
        </View>
      ) : null}
      {c.menor ? (
        <MenorDe16 />
      ) : (
        <CartaoDeVidro opaco>
          <ConsentimentoDaEntrada
            comunidade={comunidade}
            forma={forma}
            marcada={c.fe}
            aoMudar={c.setFe}
            pedirResponsavel={c.pedirResponsavel}
            responsavel={c.responsavel}
            aoMudarResponsavel={c.setResponsavel}
          />
        </CartaoDeVidro>
      )}
    </>
  )
}
