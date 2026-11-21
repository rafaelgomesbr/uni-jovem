import { CASCATA_DE_ABERTURA, ESPACO, RITMO_DE_ACESSO } from '@uj/tokens'
import type { Ref } from 'react'
import { View } from 'react-native'

import { BotaoDeAcesso } from '@/ui/BotaoDeAcesso'
import type { NoDeView } from '@/ui/foco'
import { LinkDeAcesso } from '@/ui/LinkDeAcesso'
import { Revelar } from '@/ui/Revelar'
import { Texto } from '@/ui/Texto'
import { FaseDoPainel } from '@/ui/TrocaDePainel'

import type { ItemDoAcesso } from './ordemDosAcessos'
import { BotaoApple } from './provedores/BotaoApple'
import { BotaoGoogle } from './provedores/BotaoGoogle'

export type AcessoEmAndamento = 'apple' | 'google' | 'senha' | 'biometria'

/** Atraso e duração de cada botão na cascata (50 ms de passo). */
const CASCATA_DOS_BOTOES = [
  CASCATA_DE_ABERTURA.botao1,
  CASCATA_DE_ABERTURA.botao2,
  CASCATA_DE_ABERTURA.botao3,
  CASCATA_DE_ABERTURA.botao3,
] as const

interface PropsDosAcessos {
  itens: ItemDoAcesso[]
  /** Qual acesso está trabalhando agora; os outros ficam inativos (nunca dois pedidos de uma vez). */
  emAndamento: AcessoEmAndamento | null
  /** Depois de entrar: o indicador do botão tocado vira um check. */
  sucesso: boolean
  /** Cada vez que sobe, o botão do provedor balança (falha). */
  balancoDaApple: number
  balancoDoGoogle: number
  nomeDaBiometria: string
  aoPedirApple: () => void
  aoObterTokenDoGoogle: (idToken: string) => void
  aoFalharGoogle: (mensagem: string) => void
  aoCancelarProvedor: () => void
  aoEscolherEmail: () => void
  aoUsarBiometria: () => void
  aoCriarConta: () => void
  aoAbrirConvite: () => void
  /** Já há um convite guardado: o link "Tenho um convite ou código" some (o cartão o substitui). */
  temConvite: boolean
  refDoEmail?: Ref<NoDeView>
}

/** Os acessos de `entrada.inicio` e o rodapé: de baixo para cima, na zona do polegar. */
export function AcessosDaEntrada({
  itens,
  emAndamento,
  sucesso,
  balancoDaApple,
  balancoDoGoogle,
  nomeDaBiometria,
  aoPedirApple,
  aoObterTokenDoGoogle,
  aoFalharGoogle,
  aoCancelarProvedor,
  aoEscolherEmail,
  aoUsarBiometria,
  aoCriarConta,
  aoAbrirConvite,
  temConvite,
  refDoEmail,
}: PropsDosAcessos) {
  const c = CASCATA_DE_ABERTURA
  const ocupado = emAndamento !== null
  const outroTrabalhando = (meu: AcessoEmAndamento) => ocupado && emAndamento !== meu

  return (
    <FaseDoPainel tipo="sai" ate={0.4} dy={ESPACO.e12}>
      <View style={{ gap: RITMO_DE_ACESSO.entreAcessos }}>
        {itens.map((item, i) => {
          const passo = CASCATA_DOS_BOTOES[Math.min(i, CASCATA_DOS_BOTOES.length - 1)]!
          const selo = item.selo ? 'Usado da última vez' : undefined
          return (
            <Revelar key={item.marca} atraso={passo.atraso} duracao={passo.duracao} dy={ESPACO.e16}>
              {item.marca === 'apple' ? (
                <BotaoApple
                  nivel={item.nivel}
                  {...(selo ? { selo } : {})}
                  carregando={emAndamento === 'apple' && !sucesso}
                  sucesso={sucesso && emAndamento === 'apple'}
                  desabilitado={outroTrabalhando('apple')}
                  disparoDeErro={balancoDaApple}
                  aoPressionar={aoPedirApple}
                />
              ) : item.marca === 'google' ? (
                <BotaoGoogle
                  nivel={item.nivel}
                  {...(selo ? { selo } : {})}
                  carregando={emAndamento === 'google' && !sucesso}
                  sucesso={sucesso && emAndamento === 'google'}
                  desabilitado={outroTrabalhando('google')}
                  disparoDeErro={balancoDoGoogle}
                  aoObterToken={aoObterTokenDoGoogle}
                  aoFalhar={aoFalharGoogle}
                  aoCancelar={aoCancelarProvedor}
                />
              ) : item.marca === 'biometria' ? (
                <BotaoDeAcesso
                  marca="biometria"
                  nivel="primario"
                  titulo={`Entrar com ${nomeDaBiometria}`}
                  carregando={emAndamento === 'biometria'}
                  inativo={outroTrabalhando('biometria')}
                  aoPressionar={aoUsarBiometria}
                />
              ) : (
                <BotaoDeAcesso
                  ref={refDoEmail}
                  marca="email"
                  nivel={item.nivel}
                  titulo="Entrar com e-mail"
                  {...(selo ? { selo } : {})}
                  inativo={ocupado}
                  aoPressionar={aoEscolherEmail}
                />
              )}
            </Revelar>
          )
        })}
      </View>

      <View style={{ marginTop: RITMO_DE_ACESSO.acessosParaRodape }}>
        <Revelar atraso={c.rodape1.atraso} duracao={c.rodape1.duracao} dy={ESPACO.e8}>
          <LinkDeAcesso
            tamanho="rodape"
            rotulo="Primeira vez aqui? Criar conta"
            aoPressionar={aoCriarConta}
            desabilitado={ocupado}
          >
            <Texto variante="meta" cor="textoSuave">
              Primeira vez aqui?
            </Texto>
            <Texto variante="botao" cor="destaque">
              Criar conta
            </Texto>
          </LinkDeAcesso>
        </Revelar>
        {temConvite ? null : (
          <Revelar atraso={c.rodape2.atraso} duracao={c.rodape2.duracao} dy={ESPACO.e8}>
            <LinkDeAcesso
              rotulo="Tenho um convite ou código"
              aoPressionar={aoAbrirConvite}
              desabilitado={ocupado}
            >
              <Texto variante="meta" cor="textoSuave" style={{ textDecorationLine: 'underline' }}>
                Tenho um convite ou código
              </Texto>
            </LinkDeAcesso>
          </Revelar>
        )}
      </View>
    </FaseDoPainel>
  )
}
