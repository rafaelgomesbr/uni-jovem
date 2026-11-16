import { useMutation } from '@tanstack/react-query'
import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { mensagemDoErro } from '@/servicos/erros'
import { copiarTexto } from '@/utilidades/compartilhar'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { anunciar } from '@/ui/anunciar'
import { Chip } from '@/ui/Chip'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { useFocoAoMudar, type NoDeTexto } from '@/ui/foco'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { SemComunidade } from '../navegacao/SemComunidade'
import { AlteracoesDescartadas } from './AlteracoesDescartadas'
import { suaVersao, versaoDoServidor } from './comparacao'
import { textoParaCopiar } from './fila'
import {
  contar,
  diaEMesNoAparelho,
  horaNoAparelho,
  quandoNoAparelho,
  seloDaOperacao,
  textoDoPreparo,
} from './formatos'
import { MENSAGEM_DA_WEB } from './mensagens'
import { useOffline, type Offline } from './ProvedorOffline'
import type { OperacaoNaFila } from './tipos'

/**
 * Rota `/pendencias` (3.7.6): o estado da sincronização num cartão de
 * destaque com "Sincronizar agora"; depois conflitos, recusadas, o que
 * aguarda envio e o que está guardado neste aparelho.
 */
export function TelaPendencias() {
  const offline = useOffline()
  const { comunidadeAtiva } = useSessao()
  // Resolver, descartar ou remover tira o item da tela: o foco volta para o título.
  const { alvo: tituloRef, pedirFoco } = useFocoAoMudar<NoDeTexto>(
    `${offline.operacoes.map((o) => `${o.chave}:${o.estado}`).join()}|${offline.pacotes.length}`,
  )
  return (
    <Tela
      pilha
      refDoTitulo={tituloRef}
      titulo="Uso sem internet"
      descricao="O que foi feito sem internet e ainda não chegou ao servidor."
    >
      <AlteracoesDescartadas />
      {!offline.disponivel ? (
        <Aviso tipo="info" titulo="Sem modo offline aqui">
          {offline.motivoIndisponivel ?? MENSAGEM_DA_WEB}
        </Aviso>
      ) : comunidadeAtiva ? (
        <Pendencias
          offline={offline}
          nomeDaComunidade={comunidadeAtiva.nome}
          pedirFoco={pedirFoco}
        />
      ) : (
        <SemComunidade oQue="as pendências" />
      )}
    </Tela>
  )
}

interface AcaoLocal {
  chave: string
  executar: () => Promise<void>
  /** Frase anunciada ao leitor de tela quando der certo (o item some da tela). */
  feito?: string
}

/**
 * Ações locais rodam sem rede: `networkMode: 'always'` (o padrão pausaria offline).
 * Quem tem `pedirFoco` devolve o foco ao título, já que o item tocado some.
 */
function useAcaoLocal(pedirFoco?: () => void) {
  return useMutation({
    mutationFn: async (acao: AcaoLocal) => {
      pedirFoco?.()
      await acao.executar()
    },
    onSuccess: (_r, acao) => {
      if (acao.feito) anunciar(acao.feito)
    },
    networkMode: 'always',
  })
}

type PedirFoco = () => void

function Pendencias({
  offline,
  nomeDaComunidade,
  pedirFoco,
}: {
  offline: Offline
  nomeDaComunidade: string
  pedirFoco: PedirFoco
}) {
  const conflitos = offline.operacoes.filter((o) => o.estado === 'conflito')
  const recusadas = offline.operacoes.filter((o) => o.estado === 'rejeitada')
  const aguardando = offline.operacoes.filter((o) => o.estado === 'pendente')
  const nada = !offline.operacoes.length && !offline.pacotes.length

  return (
    <>
      <Sincronizacao
        offline={offline}
        nomeDaComunidade={nomeDaComunidade}
        pendentes={aguardando.length}
      />
      {conflitos.length ? (
        <Secao
          titulo={`Conflitos a resolver (${conflitos.length})`}
          rodape="Isto mudou no servidor enquanto você estava sem conexão. Compare e escolha qual versão vale; nada é decidido sem você."
        >
          {conflitos.map((op) => (
            <Conflito key={op.chave} op={op} offline={offline} pedirFoco={pedirFoco} />
          ))}
        </Secao>
      ) : null}
      {recusadas.length ? (
        <Secao titulo={`Recusadas pelo servidor (${recusadas.length})`}>
          {recusadas.map((op) => (
            <Recusada key={op.chave} op={op} offline={offline} pedirFoco={pedirFoco} />
          ))}
        </Secao>
      ) : null}
      {aguardando.length ? (
        <Secao
          titulo={`Aguardando envio (${aguardando.length})`}
          rodape={
            offline.online
              ? 'Vão para o servidor na próxima sincronização.'
              : 'Ficam guardadas neste aparelho e vão sozinhas quando a internet voltar.'
          }
        >
          <CartaoDeVidro lista>
            <Lista>
              {aguardando.map((op) => (
                <LinhaDeLista
                  key={op.chave}
                  icone="relogio"
                  titulo={op.descricao}
                  descricao={`Feita em ${quandoNoAparelho(op.criadaEm)}${op.tentativas ? ' · já tentamos enviar' : ''}`}
                  extra={<Chip texto={seloDaOperacao(op)} tom="alerta" />}
                  rotuloAcessivel={`${op.descricao}. ${seloDaOperacao(op)}. Feita em ${quandoNoAparelho(op.criadaEm)}`}
                />
              ))}
            </Lista>
          </CartaoDeVidro>
        </Secao>
      ) : null}
      <Preparados offline={offline} pedirFoco={pedirFoco} />
      {nada ? (
        <EstadoVazio
          icone="confirmado"
          titulo="Nada pendente"
          descricao="Tudo o que você fez já está no servidor. Para usar um encontro sem internet, abra o encontro, toque em Mais e depois em Baixar para usar sem internet."
          acao={{
            titulo: 'Ver a agenda',
            icone: 'programacoes',
            aoPressionar: () => router.push({ pathname: '/agenda', params: { vista: 'lista' } }),
          }}
        />
      ) : null}
    </>
  )
}

/**
 * Cartão de destaque (3.7.6): "SINCRONIZAÇÃO", o estado em `tituloCartao`
 * ("Tudo sincronizado", "3 alterações pendentes", "Sem conexão"), a última
 * vez e o prazo de uso sem internet, e "Sincronizar agora" (primário inverso).
 */
function Sincronizacao({
  offline,
  nomeDaComunidade,
  pendentes,
}: {
  offline: Offline
  nomeDaComunidade: string
  pendentes: number
}) {
  const [pediu, setPediu] = useState(false)
  const { online, fase, erro, ultimaSincronizacao, validoAte } = offline
  const titulo = !online
    ? 'Sem conexão'
    : pendentes
      ? contar(pendentes, 'alteração pendente', 'alterações pendentes')
      : 'Tudo sincronizado'
  const detalhes = [
    ultimaSincronizacao
      ? `Última às ${horaNoAparelho(ultimaSincronizacao)} de ${diaEMesNoAparelho(ultimaSincronizacao)}.`
      : `Ainda não houve sincronização neste aparelho para ${nomeDaComunidade}.`,
    online
      ? 'As alterações vão sozinhas: ao abrir o app, ao voltar para ele e quando a rede volta.'
      : 'O que você fizer fica guardado neste aparelho e vai quando a internet voltar.',
    validoAte
      ? `Uso sem internet válido até ${diaEMesNoAparelho(validoAte)} às ${horaNoAparelho(validoAte)}; cada sincronização renova o prazo.`
      : null,
  ]
  return (
    <>
      <CartaoDeDestaque
        sobrancelha="Sincronização"
        titulo={titulo}
        acoes={
          <Botao
            titulo="Sincronizar agora"
            icone="sincronizar"
            carregando={fase === 'sincronizando'}
            desabilitado={!online}
            motivo="Sem conexão. A sincronização acontece sozinha quando a internet voltar."
            aoPressionar={() => {
              setPediu(true)
              void offline.sincronizarAgora()
            }}
          />
        }
      >
        <View style={{ gap: ESPACO.e4 }}>
          {detalhes.filter(Boolean).map((t) => (
            <Texto key={t} variante="legenda" cor="textoSuave">
              {t}
            </Texto>
          ))}
        </View>
      </CartaoDeDestaque>
      {fase === 'falha' && erro ? (
        <Aviso
          tipo="erro"
          titulo="Falha ao sincronizar"
          anunciar
          acao={{ titulo: 'Tentar de novo', aoPressionar: () => void offline.sincronizarAgora() }}
        >
          {erro}
        </Aviso>
      ) : null}
      {pediu && fase === 'concluido' ? (
        <Aviso tipo="sucesso" anunciar>
          Sincronização concluída.
        </Aviso>
      ) : null}
    </>
  )
}

/**
 * Uma das versões do conflito, lado a lado com a outra: bloco tonal sem
 * borda (nada de caixa com borda dentro do cartão), lido como um item só.
 */
function Versao({ titulo, linhas }: { titulo: string; linhas: string[] }) {
  const { cores, solido } = useTema()
  return (
    <View
      accessible
      accessibilityLabel={`${titulo}: ${linhas.join('. ')}`}
      style={{
        flex: 1,
        gap: ESPACO.e4,
        padding: ESPACO.e12,
        borderRadius: RAIO.controle,
        backgroundColor: solido(cores.tonal),
      }}
    >
      <Texto variante="rotulo" cor="textoSuave">
        {titulo}
      </Texto>
      {linhas.map((l) => (
        <Texto key={l} variante="corpo">
          {l}
        </Texto>
      ))}
    </View>
  )
}

function Conflito({
  op,
  offline,
  pedirFoco,
}: {
  op: OperacaoNaFila
  offline: Offline
  pedirFoco: PedirFoco
}) {
  const { fontScale } = useWindowDimensions()
  const acao = useAcaoLocal(pedirFoco)
  const ocupado = acao.isPending && acao.variables?.chave === op.chave
  return (
    <CartaoDeVidro
      titulo={op.descricao}
      acoes={
        <ParDeBotoes>
          <Botao
            titulo="Ficar com a do servidor"
            variante="secundario"
            rotuloAcessivel={`Ficar com a do servidor: ${op.descricao}`}
            desabilitado={ocupado}
            aoPressionar={() =>
              acao.mutate({
                chave: op.chave,
                executar: () => offline.descartar(op.chave),
                feito: 'Conflito resolvido: ficou a versão do servidor.',
              })
            }
          />
          <Botao
            titulo="Aplicar a minha"
            variante="secundario"
            rotuloAcessivel={`Aplicar a minha: ${op.descricao}`}
            carregando={ocupado}
            aoPressionar={() =>
              acao.mutate({
                chave: op.chave,
                executar: () => offline.refazer(op.chave),
                feito: 'Conflito resolvido: sua versão vai para o servidor.',
              })
            }
          />
        </ParDeBotoes>
      }
    >
      {op.mensagem ? <Texto variante="corpo">{op.mensagem}</Texto> : null}
      <View style={{ flexDirection: fontScale >= 1.35 ? 'column' : 'row', gap: ESPACO.e12 }}>
        <Versao titulo="Sua versão (neste aparelho)" linhas={suaVersao(op)} />
        <Versao titulo="Versão atual do servidor" linhas={versaoDoServidor(op)} />
      </View>
      {acao.error && acao.variables?.chave === op.chave ? (
        <Aviso tipo="erro" titulo="Não deu certo" anunciar>
          {mensagemDoErro(acao.error)}
        </Aviso>
      ) : null}
    </CartaoDeVidro>
  )
}

function Recusada({
  op,
  offline,
  pedirFoco,
}: {
  op: OperacaoNaFila
  offline: Offline
  pedirFoco: PedirFoco
}) {
  const acao = useAcaoLocal(pedirFoco)
  const [copiado, setCopiado] = useState(false)
  const ocupado = acao.isPending && acao.variables?.chave === op.chave

  async function descartar() {
    const ok = await confirmar({
      titulo: 'Descartar esta alteração?',
      mensagem: `"${op.descricao}" sai deste aparelho e não é enviada.`,
      confirmar: 'Descartar',
      destrutivo: true,
    })
    if (ok) {
      acao.mutate({
        chave: op.chave,
        executar: () => offline.descartar(op.chave),
        feito: 'Alteração descartada.',
      })
    }
  }

  return (
    <CartaoDeVidro
      titulo={op.descricao}
      extra={<Chip texto="Recusada" tom="erro" />}
      acoes={
        <View style={{ gap: ESPACO.e12 }}>
          <ParDeBotoes>
            <Botao
              titulo="Refazer"
              variante="secundario"
              rotuloAcessivel={`Refazer: ${op.descricao}`}
              carregando={ocupado}
              aoPressionar={() =>
                acao.mutate({
                  chave: op.chave,
                  executar: () => offline.refazer(op.chave),
                  feito: 'Alteração enviada de novo para a fila.',
                })
              }
            />
            <Botao
              titulo="Copiar"
              variante="secundario"
              rotuloAcessivel={`Copiar: ${op.descricao}`}
              aoPressionar={() => void copiarTexto(textoParaCopiar(op)).then(setCopiado)}
            />
          </ParDeBotoes>
          <Botao
            titulo="Descartar"
            variante="destrutivo"
            rotuloAcessivel={`Descartar: ${op.descricao}`}
            desabilitado={ocupado}
            aoPressionar={() => void descartar()}
          />
        </View>
      }
    >
      <Texto variante="corpo">
        Motivo: {op.mensagem ?? 'O servidor não aceitou esta alteração.'}
      </Texto>
      <Texto variante="meta" cor="textoSuave">
        Feita em {quandoNoAparelho(op.criadaEm)}
      </Texto>
      {copiado ? (
        <Aviso tipo="sucesso" anunciar>
          Copiado.
        </Aviso>
      ) : null}
      {acao.error && acao.variables?.chave === op.chave ? (
        <Aviso tipo="erro" titulo="Não deu certo" anunciar>
          {mensagemDoErro(acao.error)}
        </Aviso>
      ) : null}
    </CartaoDeVidro>
  )
}

/** "Guardado neste aparelho" (3.7.6): cada programação abre o detalhe e pode sair do aparelho. */
function Preparados({ offline, pedirFoco }: { offline: Offline; pedirFoco: PedirFoco }) {
  const acao = useAcaoLocal(pedirFoco)
  if (!offline.pacotes.length) return null
  return (
    <Secao
      titulo="Guardado neste aparelho"
      rodape={`${contar(offline.pacotes.length, 'encontro guardado', 'encontros guardados')}, cifrados, para usar sem internet.`}
    >
      <CartaoDeVidro lista opaco>
        <Lista>
          {offline.pacotes.flatMap((p) => [
            <LinhaDeLista
              key={p.eventoId}
              icone="guardadoNoAparelho"
              titulo={p.titulo}
              descricao={textoDoPreparo(p.baixadoEm, offline.validoAte ?? p.validoAte)}
              aoPressionar={() =>
                router.push({ pathname: '/evento/[eventoId]', params: { eventoId: p.eventoId } })
              }
            />,
            <LinhaDeLista
              key={`${p.eventoId}-remover`}
              icone="excluir"
              titulo="Remover deste aparelho"
              destrutivo
              rotuloAcessivel={`Remover deste aparelho: ${p.titulo}`}
              aoPressionar={
                acao.isPending && acao.variables?.chave === p.eventoId
                  ? undefined
                  : () =>
                      acao.mutate({
                        chave: p.eventoId,
                        executar: () => offline.removerPacote(p.eventoId),
                        feito: `${p.titulo} saiu deste aparelho.`,
                      })
              }
            />,
          ])}
        </Lista>
      </CartaoDeVidro>
    </Secao>
  )
}
