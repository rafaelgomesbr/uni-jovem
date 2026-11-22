import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import type { ComunidadeEncontrada } from '@/servicos/contrato'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { useSemConexao } from '@/ui/IndicadorDeConexao'
import { useConfirmarDescarte, useTravaDeEnvio } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { parametro } from '@/utilidades/parametros'

import { IdentidadeDaComunidade } from '../comunidade/Identidade'
import { CamposDoConsentimento, useConsentimentoDaEntrada } from './ConsentimentoDaEntrada'
import {
  logoDaEncontrada,
  MAXIMO_DA_MENSAGEM,
  useComunidadeEncontrada,
  usePedirParaEntrar,
} from './consultas'
import { PedidoEnviado } from './PedidoEnviado'
import { AvisoDoPedido, ajudaDaMensagem } from './TextosDoPedido'
import { SeloVerificada } from './TelaProcurarComunidade'

/** Rota `/comunidade-encontrada/[idPublico]`: a comunidade tocada na busca. */
export function TelaComunidadeEncontrada() {
  const idPublico = parametro(useLocalSearchParams<{ idPublico: string }>().idPublico) ?? ''
  const comunidade = useComunidadeEncontrada(idPublico)
  if (!comunidade) {
    return (
      <Tela pilha titulo="Comunidade">
        <EstadoVazio
          icone="buscar"
          titulo="Procure de novo"
          descricao="Esta tela abre a partir da busca. Faça a busca outra vez para ver a comunidade."
          acao={{
            titulo: 'Procurar comunidade',
            aoPressionar: () => router.replace('/procurar-comunidade'),
          }}
        />
      </Tela>
    )
  }
  return <Detalhe comunidade={comunidade} />
}

/**
 * A comunidade encontrada (ADR 0007): logotipo, nome, cidade, o selo e, se
 * ela aceita pedidos, "Pedir para entrar" com a mensagem opcional (TC-17) e
 * o consentimento sobre a fé (TC-03.v4) acima do botão. Só por convite:
 * explica e não oferece o pedido. "Denunciar comunidade" fica no fim.
 */
function Detalhe({ comunidade }: { comunidade: ComunidadeEncontrada }) {
  const [mensagem, setMensagem] = useState('')
  const pedir = usePedirParaEntrar(comunidade.idPublico)
  const semConexao = useSemConexao()
  const consentimento = useConsentimentoDaEntrada()
  const trava = useTravaDeEnvio()
  const liberarSaida = useConfirmarDescarte(!pedir.isSuccess && mensagem.trim().length > 0)
  const soConvite = comunidade.modoEntrada === 'convite'
  const direta = comunidade.modoEntrada === 'codigo_direto'

  function enviar() {
    if (consentimento.motivo || consentimento.menor || !trava.pegar()) return
    const recado = mensagem.trim()
    pedir.mutate(
      { ...consentimento.corpo(), ...(recado ? { mensagem: recado } : {}) },
      {
        onError: consentimento.aoFalhar,
        onSuccess: (r) => {
          liberarSaida()
          if (r.resultado === 'membro') {
            router.replace({ pathname: '/boas-vindas', params: { comunidade: comunidade.nome } })
          }
        },
        onSettled: () => trava.soltar(),
      },
    )
  }

  if (pedir.data?.resultado === 'pedido_pendente') {
    return <PedidoEnviado comunidade={comunidade.nome} />
  }

  return (
    <Tela
      pilha
      titulo={comunidade.nome}
      {...(soConvite
        ? {}
        : {
            barraDeAcao: (
              <BarraDeAcao>
                <Botao
                  titulo={direta ? 'Entrar na comunidade' : 'Pedir para entrar'}
                  tamanho="grande"
                  rotuloAcessivel={`${direta ? 'Entrar em' : 'Pedir para entrar em'} ${comunidade.nome}`}
                  carregando={pedir.isPending}
                  desabilitado={semConexao || consentimento.motivo !== null || consentimento.menor}
                  {...(semConexao
                    ? { motivo: 'Precisa de internet para pedir.' }
                    : consentimento.motivo
                      ? { motivo: consentimento.motivo }
                      : {})}
                  aoPressionar={enviar}
                />
              </BarraDeAcao>
            ),
          })}
    >
      <CartaoDeVidro>
        <View style={{ gap: ESPACO.e12 }}>
          <IdentidadeDaComunidade
            nome={comunidade.nome}
            cor={comunidade.cor}
            {...(comunidade.cidade ? { detalhe: comunidade.cidade } : {})}
            logo={logoDaEncontrada(comunidade)}
          />
          {comunidade.verificada ? (
            <View style={{ alignItems: 'flex-start', gap: ESPACO.e4 }}>
              <SeloVerificada />
              <Texto variante="meta" cor="textoSuave">
                A equipe do app conferiu que esta comunidade existe.
              </Texto>
            </View>
          ) : null}
        </View>
      </CartaoDeVidro>

      {pedir.error && !consentimento.erroVirouCampo(pedir.error) ? (
        <AvisoDeFalha erro={pedir.error} titulo="O pedido não foi enviado" />
      ) : null}

      {soConvite ? (
        <Aviso tipo="info" titulo="Esta comunidade só aceita convite">
          Peça um convite a alguém da liderança. Quando receber o link, abra no celular ou cole em
          "Tenho um código".
        </Aviso>
      ) : (
        <CartaoDeVidro opaco intervalo={ESPACO.e8}>
          <Texto variante="corpo">
            {direta
              ? 'Você entra na hora, como membro.'
              : 'A liderança recebe o seu pedido e decide. Você vê a resposta em "Meus pedidos", no Início.'}
          </Texto>
          {direta ? null : (
            <>
              <Campo
                rotulo="Mensagem para a liderança"
                opcional
                ajuda={ajudaDaMensagem(comunidade.nome)}
                value={mensagem}
                onChangeText={setMensagem}
                multiline
                maxLength={MAXIMO_DA_MENSAGEM}
                mostrarContador
              />
              <AvisoDoPedido />
            </>
          )}
        </CartaoDeVidro>
      )}
      {soConvite ? null : (
        <CamposDoConsentimento consentimento={consentimento} comunidade={comunidade.nome} />
      )}

      <Botao
        titulo="Denunciar comunidade"
        icone="denuncia"
        variante="terciario"
        alinhado
        rotuloAcessivel={`Denunciar a comunidade ${comunidade.nome}`}
        aoPressionar={() =>
          router.push({
            pathname: '/denunciar-comunidade',
            params: { idPublico: comunidade.idPublico, nome: comunidade.nome },
          })
        }
      />
    </Tela>
  )
}
