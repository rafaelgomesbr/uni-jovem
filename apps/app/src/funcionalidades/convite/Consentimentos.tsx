import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Texto } from '@/ui/Texto'

import { abrirDocumento } from '../privacidade/TelaPrivacidade'

/**
 * Textos de consentimento do convite (docs/privacidade/textos-de-consentimento.md,
 * TC-01 a TC-03, versão 1). Nenhuma caixa vem marcada; o botão de continuar
 * fica desabilitado com o motivo escrito até a pessoa marcar.
 */

export const OPCOES_DE_IDADE: { valor: FaixaEtaria; rotulo: string }[] = [
  { valor: '18_mais', rotulo: 'Tenho 18 anos ou mais.' },
  {
    valor: '16_17',
    rotulo: `Tenho 16 ou 17 anos, e meu pai, minha mãe ou meu responsável legal sabe que vou usar o ${NOME_DO_APP} e concorda.`,
  },
  { valor: 'menos_16', rotulo: 'Tenho menos de 16 anos.' },
]

export const MENSAGEM_MENOR_DE_16 = `Que bom que você quer participar! Para ter uma conta no ${NOME_DO_APP} é preciso ter 16 anos ou mais. Fale com a liderança da sua comunidade: ela pode inscrever você nos eventos com a ajuda do seu responsável.`

/** TC-01: escolha única (lista de opções), nenhuma opção pré-selecionada. */
export function PerguntaDeIdade({
  valor,
  aoMudar,
}: {
  valor: FaixaEtaria | null
  aoMudar: (v: FaixaEtaria) => void
}) {
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <ListaDeOpcoes
        rotulo="Quantos anos você tem?"
        opcoes={OPCOES_DE_IDADE}
        valor={valor}
        aoMudar={aoMudar}
      />
      <Texto variante="legenda" cor="textoSuave">
        Não pedimos sua data de nascimento. Guardamos só a sua resposta.
      </Texto>
    </View>
  )
}

/** Fim do fluxo para menores de 16: nada é gravado e o convite não é consumido. */
export function MenorDe16() {
  return (
    <Aviso tipo="info" titulo="Ainda não dá para criar a conta" anunciar>
      {MENSAGEM_MENOR_DE_16}
    </Aviso>
  )
}

/** TC-02: Termos e Política. */
export function AceiteDosTermos({
  marcada,
  aoMudar,
}: {
  marcada: boolean
  aoMudar: (v: boolean) => void
}) {
  return (
    <View style={{ gap: ESPACO.e4 }}>
      <CaixaDeMarcar
        rotulo="Li e concordo com os Termos de Uso e a Política de Privacidade."
        marcada={marcada}
        aoMudar={aoMudar}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: ESPACO.e16 }}>
        <Botao
          titulo="Ler os Termos de Uso"
          variante="terciario"
          alinhado
          aoPressionar={() => void abrirDocumento('/termos')}
        />
        <Botao
          titulo="Ler a Política de Privacidade"
          variante="terciario"
          alinhado
          aoPressionar={() => void abrirDocumento('/privacidade')}
        />
      </View>
    </View>
  )
}

/** TC-03: consentimento sobre a fé, em bloco destacado, um por comunidade. */
export function ConsentimentoDeFe({
  comunidade,
  marcada,
  aoMudar,
  pedirResponsavel,
  responsavel,
  aoMudarResponsavel,
}: {
  comunidade: string
  marcada: boolean
  aoMudar: (v: boolean) => void
  pedirResponsavel: boolean
  responsavel: boolean
  aoMudarResponsavel: (v: boolean) => void
}) {
  // Sem caixa com borda dentro do cartão (2.12.9): o bloco se separa pelo título e pelo espaço.
  return (
    <View accessibilityRole="summary" style={{ gap: ESPACO.e8 }}>
      <Texto variante="tituloItem">Sobre a sua fé</Texto>
      <Texto variante="corpo">
        Participar da {comunidade} no {NOME_DO_APP} mostra que você faz parte de uma comunidade de
        igreja. A lei considera isso um dado sensível.
      </Texto>
      <CaixaDeMarcar
        rotulo={`Concordo que a ${comunidade} e o ${NOME_DO_APP} tratem meus dados para organizar a minha participação nesta comunidade: eventos, escalas, presença, avisos, sugestões e pedidos de oração. Sei que nome e papel ficam visíveis para os membros desta comunidade, e meu e-mail e WhatsApp só para organizadores e administradores.`}
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
      <Texto variante="legenda" cor="textoSuave">
        Você pode desfazer isso quando quiser: em Perfil, Sair da comunidade, ou excluindo sua
        conta.
      </Texto>
      <Botao
        titulo="Saiba mais sobre a fé e seus dados"
        variante="terciario"
        alinhado
        aoPressionar={() => void abrirDocumento('/privacidade#fe')}
      />
    </View>
  )
}

/** Motivo escrito do botão desabilitado (nunca só pela cor). */
export function motivoDoConsentimento(
  consentimento: boolean,
  pedirResponsavel: boolean,
  responsavel: boolean,
): string | null {
  if (!consentimento) return 'Para entrar na comunidade, marque a concordância sobre a sua fé.'
  if (pedirResponsavel && !responsavel) {
    return 'Para quem tem 16 ou 17 anos, confirme que seu responsável sabe e concorda.'
  }
  return null
}
