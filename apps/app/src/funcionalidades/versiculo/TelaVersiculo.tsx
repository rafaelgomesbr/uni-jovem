import { ATRIBUICAO, versiculoDoDia } from '@uj/conteudo'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { NOTIFICACOES_DISPONIVEIS } from '@/servicos/notificacoesDoSistema'
import { AvisoDeFalha } from '@/ui/Falha'
import { abrirLink } from '@/utilidades/compartilhar'
import { CampoDeHora } from '@/ui/CampoDeMomento'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { Interruptor } from '@/ui/Interruptor'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { usePreferenciasDaConta, useSalvarVersiculo } from '../notificacoes/consultas'
import { PermissaoDoSistema } from '../notificacoes/PermissaoDoSistema'
import { CartaoDoVersiculo, useHoje } from './CartaoDoVersiculo'

/** TC-10.v1. */
export const TEXTO_DO_VERSICULO =
  'O versículo do dia é agendado no seu aparelho. Nada sobre ele é enviado ao servidor. Você pode desligar ou mudar o horário quando quiser.'

/**
 * Quanto esperar depois do último giro do seletor para salvar: a roda do iOS
 * avisa a cada parada, e só o horário final deve ir para a conta.
 */
const ESPERA_PARA_SALVAR_MS = 600

/**
 * Rota `/versiculo` (3.6.7): a prévia igual à do Início; o cartão com o
 * interruptor "Receber todo dia" e o horário pelo seletor nativo (salva ao
 * escolher e confirma com toast, sem botão Salvar); a permissão do aparelho;
 * e "Sobre a tradução".
 */
export function TelaVersiculo() {
  const prefs = usePreferenciasDaConta()
  return (
    <Tela pilha titulo="Versículo do dia" descricao={TEXTO_DO_VERSICULO}>
      <CartaoDoVersiculo />
      {prefs.isPending ? (
        <Esqueleto rotulo="Carregando a sua preferência">
          <CartaoDeEsqueleto />
        </Esqueleto>
      ) : prefs.error ? (
        <AvisoDeFalha
          erro={prefs.error}
          titulo="Não deu para carregar a sua preferência"
          aoTentarDeNovo={() => void prefs.refetch()}
        />
      ) : (
        <Preferencia ativo={prefs.data.versiculo.ativo} hora={prefs.data.versiculo.hora} />
      )}
      <Secao titulo="Sobre a tradução">
        <CartaoDeVidro lista>
          <LinhaDeLista
            icone="documento"
            titulo={ATRIBUICAO.traducao}
            descricao="CC BY 4.0"
            rotuloAcessivel={`${ATRIBUICAO.traducao}. ${ATRIBUICAO.licenca}`}
            dica="Abre o crédito completo da tradução."
            aoPressionar={() => router.push('/versiculo/traducao')}
          />
        </CartaoDeVidro>
      </Secao>
    </Tela>
  )
}

function Preferencia({ ativo, hora }: { ativo: boolean; hora: string }) {
  const salvar = useSalvarVersiculo()
  // O horário escolhido que ainda não voltou do servidor: o campo mostra ele, não o antigo.
  const [pendente, setPendente] = useState<string | null>(null)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)

  // O relógio da espera é externo à tela: some com ela.
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current)
    },
    [],
  )

  function escolherHora(nova: string) {
    setPendente(nova)
    if (espera.current) clearTimeout(espera.current)
    espera.current = setTimeout(() => {
      if (nova === hora) {
        setPendente(null)
        return
      }
      salvar.mutate(
        { versiculoHora: nova },
        {
          onSuccess: () => {
            setPendente((p) => (p === nova ? null : p))
            mostrarToast({ texto: `Horário salvo: ${nova}.` })
          },
        },
      )
    }, ESPERA_PARA_SALVAR_MS)
  }

  return (
    <>
      <CartaoDeVidro opaco intervalo={0}>
        <Lista>
          <Interruptor
            rotulo="Receber todo dia"
            descricao={
              ativo
                ? `Ligado, todo dia às ${pendente ?? hora}. Vale para a sua conta, em todas as comunidades.`
                : 'Desligado. Vale para a sua conta, em todas as comunidades.'
            }
            ligado={ativo}
            desabilitado={salvar.isPending}
            aoMudar={(v) =>
              salvar.mutate(
                { versiculoAtivo: v },
                {
                  onSuccess: () =>
                    mostrarToast({
                      texto: v ? 'Versículo do dia ligado.' : 'Versículo do dia desligado.',
                    }),
                },
              )
            }
          />
          <View style={{ paddingVertical: ESPACO.e12 }}>
            <CampoDeHora
              rotulo="Horário"
              valor={pendente ?? hora}
              aoMudar={escolherHora}
              ajuda="No fuso do aparelho. Se você viajar, o app reagenda sozinho."
            />
          </View>
        </Lista>
      </CartaoDeVidro>
      {salvar.error ? <AvisoDeFalha erro={salvar.error} /> : null}
      <Secao titulo="Neste aparelho">
        {NOTIFICACOES_DISPONIVEIS ? (
          <PermissaoDoSistema ligadoNoApp={ativo} />
        ) : (
          <Texto variante="corpo" cor="textoSuave">
            Na web o versículo aparece só no Início. A notificação diária chega no app do celular.
          </Texto>
        )}
      </Secao>
    </>
  )
}

/**
 * Rota `/versiculo/traducao`: o crédito completo exigido pela licença CC BY
 * 4.0, em `leitura` num cartão de vidro, e as linhas com os links externos.
 */
export function TelaSobreATraducao() {
  const hoje = useHoje()
  return (
    <Tela pilha titulo="Sobre a tradução">
      <CartaoDeVidro>
        <Texto variante="leitura" selectable>
          {ATRIBUICAO.texto}
        </Texto>
      </CartaoDeVidro>
      <CartaoDeVidro lista>
        <Lista>
          <LinhaDeLista
            icone="documento"
            titulo="Ver a licença"
            descricao={ATRIBUICAO.licenca}
            externo
            aoPressionar={() => void abrirLink(ATRIBUICAO.linkDaLicenca)}
          />
          <LinhaDeLista
            icone="versiculo"
            titulo="Conhecer a Bíblia Livre"
            descricao={`${ATRIBUICAO.autores}, ${ATRIBUICAO.versao}`}
            externo
            aoPressionar={() => void abrirLink(ATRIBUICAO.linkDaTraducao)}
          />
        </Lista>
      </CartaoDeVidro>
      <Texto variante="legenda" cor="textoSuave">
        Hoje: {versiculoDoDia(hoje).referencia}. Os 366 versículos do plano são citados sem
        alteração.
      </Texto>
    </Tela>
  )
}
