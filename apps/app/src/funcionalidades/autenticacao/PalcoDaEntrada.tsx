import {
  ALTURA_DO_ACESSO,
  BORDA,
  CASCATA_DE_ABERTURA,
  ESPACO,
  LADO_DO_SOL,
  RAIO,
  RITMO_DE_ACESSO,
  TIPO,
} from '@uj/tokens'
import type { Ref } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import type { NoDeTexto } from '@/ui/foco'
import { Icone } from '@/ui/Icone'
import { LinkDeAcesso } from '@/ui/LinkDeAcesso'
import { MarcaDoSol } from '@/ui/MarcaDoSol'
import { Revelar } from '@/ui/Revelar'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { FaseDoPainel } from '@/ui/TrocaDePainel'
import { useAnunciar } from '@/ui/useAnunciar'
import { soNaWeb } from '@/ui/web'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'

import type { ConvitePendente } from './convitePendente'

export const APOIO_DA_ENTRADA = 'Agenda, escalas e recados da sua comunidade, num lugar só.'
export const APOIO_COM_CONVITE = 'Entre ou crie sua conta para participar.'

interface PropsDoPalco {
  /** Lado do sol (`calcularMedidasDoAcesso`). */
  sol: number
  mostraApoio: boolean
  /** `abertura`: o sol nasce; `estatica`: já no lugar (retorno e convite). */
  etapaDoSol: 'abertura' | 'estatica'
  /** O sucesso faz o halo respirar uma vez. */
  pulso: number
  /** Texto do erro de um provedor: toma o lugar do apoio, com ícone (a cor nunca é o único sinal). */
  erroDoProvedor: string | null
  /** Dica gentil (não é erro) depois de cancelar a folha do provedor 2 vezes. */
  dica: string | null
  aoTentarDeNovo?: (() => void) | undefined
  convite: ConvitePendente | null
  aoRemoverConvite: () => void
  refDoTitulo: Ref<NoDeTexto>
}

/**
 * O palco de `entrada.inicio` (D63): o sol, o nome do app como título de nível
 * 1 e uma frase de apoio. Com convite guardado, o cartão compacto "Você foi
 * convidado" entra abaixo. Um erro de provedor toma o lugar do apoio, na mesma
 * caixa, para nada pular de lugar. Tudo parte do lugar final (cascata de
 * abertura de 780 ms) e responde ao toque desde o primeiro quadro.
 */
export function PalcoDaEntrada({
  sol,
  mostraApoio,
  etapaDoSol,
  pulso,
  erroDoProvedor,
  dica,
  aoTentarDeNovo,
  convite,
  aoRemoverConvite,
  refDoTitulo,
}: PropsDoPalco) {
  const { cores, superficie } = useTema()
  const { reduzirTransparencia } = usePreferenciasDeAcessibilidade()
  const c = CASCATA_DE_ABERTURA
  const espacoDoSol =
    sol > LADO_DO_SOL.medio ? RITMO_DE_ACESSO.solGrandeParaTitulo : RITMO_DE_ACESSO.solParaTitulo
  useAnunciar(erroDoProvedor)

  const apoio = convite ? APOIO_COM_CONVITE : APOIO_DA_ENTRADA
  const textoDeApoio = erroDoProvedor ? null : (dica ?? apoio)

  return (
    <FaseDoPainel tipo="sai" ate={0.5} dy={-ESPACO.e12} style={{ alignItems: 'center' }}>
      <FaseDoPainel tipo="sai" ate={0.5} escala={0.92}>
        <MarcaDoSol lado={sol} etapa={etapaDoSol} pulso={pulso} />
      </FaseDoPainel>

      <Revelar atraso={c.nome.atraso} duracao={c.nome.duracao} style={{ marginTop: espacoDoSol }}>
        <Texto variante="tituloTela" centralizado ref={refDoTitulo} {...soNaWeb({ tabIndex: -1 })}>
          {NOME_DO_APP}
        </Texto>
      </Revelar>

      {mostraApoio || erroDoProvedor || dica ? (
        <Revelar
          atraso={c.apoio.atraso}
          duracao={c.apoio.duracao}
          style={{
            marginTop: RITMO_DE_ACESSO.tituloParaApoio,
            alignSelf: 'stretch',
            alignItems: 'center',
            // A caixa do apoio (2 linhas) é a do erro: trocar um pelo outro não move nada.
            minHeight: TIPO.corpo.altura * 2,
          }}
        >
          {erroDoProvedor ? (
            <View style={{ alignItems: 'center', gap: ESPACO.e8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e8 }}>
                <View style={{ height: TIPO.meta.altura, justifyContent: 'center' }}>
                  <Icone nome="erroDeCampo" cor={cores.erro} tamanho={16} />
                </View>
                <Texto
                  variante="meta"
                  peso="forte"
                  centralizado
                  accessibilityRole="alert"
                  style={{ flexShrink: 1 }}
                >
                  {erroDoProvedor}
                </Texto>
              </View>
              {aoTentarDeNovo ? (
                <LinkDeAcesso rotulo="Tentar de novo" aoPressionar={aoTentarDeNovo}>
                  <Texto variante="botao" cor="destaque">
                    Tentar de novo
                  </Texto>
                </LinkDeAcesso>
              ) : null}
            </View>
          ) : (
            <Texto variante="corpo" cor="textoSuave" centralizado>
              {textoDeApoio}
            </Texto>
          )}
        </Revelar>
      ) : null}

      {convite ? (
        <Revelar
          atraso={c.apoio.atraso}
          duracao={c.apoio.duracao}
          style={{ alignSelf: 'stretch', marginTop: RITMO_DE_ACESSO.apoioParaConvite }}
        >
          <View
            accessible={false}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ESPACO.e12,
              minHeight: ALTURA_DO_ACESSO,
              paddingLeft: ESPACO.e16,
              paddingVertical: ESPACO.e8,
              borderRadius: RAIO.controle,
              borderWidth: BORDA.fina,
              borderColor: cores.superficieBorda,
              // Reduzir transparência (ou o tema claro): a versão opaca do cartão.
              backgroundColor:
                reduzirTransparencia || superficie !== 'fundo'
                  ? cores.superficie
                  : cores.superficieTranslucida,
            }}
          >
            <Icone nome="convidar" cor={cores.destaque} tamanho={20} />
            <View style={{ flex: 1 }}>
              <Texto variante="tituloItem">Você foi convidado</Texto>
              <Texto variante="legenda" cor="textoSuave">
                Seu convite está guardado.
              </Texto>
            </View>
            <LinkDeAcesso
              rotulo="Remover o convite"
              aoPressionar={aoRemoverConvite}
              tamanho="curto"
            >
              <Texto variante="botao" cor="destaque">
                Remover
              </Texto>
            </LinkDeAcesso>
          </View>
        </Revelar>
      ) : null}
    </FaseDoPainel>
  )
}
