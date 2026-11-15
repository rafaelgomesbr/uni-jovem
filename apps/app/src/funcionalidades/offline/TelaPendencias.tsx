import { useMutation } from '@tanstack/react-query'
import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import { copiarTexto } from '@/utilidades/compartilhar'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { Linha } from '@/ui/Linha'
import { Selo } from '@/ui/Selo'
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

/** Rota `/pendencias`: sincronização, conflitos, recusadas, fila e eventos preparados. */
export function TelaPendencias() {
  const offline = useOffline()
  const { comunidadeAtiva } = useSessao()
  return (
    <Tela
      cabecalhoNativo
      titulo="Pendências"
      descricao="O que foi feito sem internet e ainda não chegou ao servidor."
    >
      <AlteracoesDescartadas />
      {!offline.disponivel ? (
        <Aviso tipo="info" titulo="Sem modo offline aqui">
          {offline.motivoIndisponivel ?? MENSAGEM_DA_WEB}
        </Aviso>
      ) : comunidadeAtiva ? (
        <Pendencias offline={offline} nomeDaComunidade={comunidadeAtiva.nome} />
      ) : (
        <SemComunidade oQue="as pendências" />
      )}
    </Tela>
  )
}

/** Ações locais rodam sem rede: `networkMode: 'always'` (o padrão pausaria offline). */
function useAcaoLocal() {
  return useMutation({
    mutationFn: async (acao: { chave: string; executar: () => Promise<void> }) => acao.executar(),
    networkMode: 'always',
  })
}

function Pendencias({ offline, nomeDaComunidade }: { offline: Offline; nomeDaComunidade: string }) {
  const conflitos = offline.operacoes.filter((o) => o.estado === 'conflito')
  const recusadas = offline.operacoes.filter((o) => o.estado === 'rejeitada')
  const aguardando = offline.operacoes.filter((o) => o.estado === 'pendente')
  const nada = !offline.operacoes.length && !offline.pacotes.length

  return (
    <>
      <Sincronizacao offline={offline} nomeDaComunidade={nomeDaComunidade} />
      {conflitos.length ? (
        <Cartao titulo={`Conflitos a resolver (${conflitos.length})`} icone="erro">
          <Texto variante="apoio">
            Isto mudou no servidor enquanto você estava sem conexão. Compare e escolha qual versão
            vale; nada é decidido sem você.
          </Texto>
          {conflitos.map((op) => (
            <Conflito key={op.chave} op={op} offline={offline} />
          ))}
        </Cartao>
      ) : null}
      {recusadas.length ? (
        <Cartao titulo={`Recusadas pelo servidor (${recusadas.length})`} icone="cancelar">
          {recusadas.map((op) => (
            <Recusada key={op.chave} op={op} offline={offline} />
          ))}
        </Cartao>
      ) : null}
      {aguardando.length ? (
        <Cartao titulo={`Aguardando envio (${aguardando.length})`} icone="relogio">
          <Texto variante="apoio" cor="textoSuave">
            {offline.online
              ? 'Vão para o servidor na próxima sincronização.'
              : 'Ficam guardadas neste aparelho e vão sozinhas quando a internet voltar.'}
          </Texto>
          {aguardando.map((op) => (
            <Linha
              key={op.chave}
              titulo={op.descricao}
              descricao={`${seloDaOperacao(op)} · feita em ${quandoNoAparelho(op.criadaEm)}${op.tentativas ? ' · já tentamos enviar' : ''}`}
            />
          ))}
        </Cartao>
      ) : null}
      <Preparados offline={offline} />
      {nada ? (
        <Cartao>
          <EstadoVazio
            icone="confirmado"
            titulo="Nada pendente"
            descricao="Tudo o que você fez já está no servidor. Para usar um evento sem internet, abra a programação e toque em Preparar para usar sem internet."
            acao={{
              titulo: 'Ver programações',
              icone: 'programacoes',
              aoPressionar: () => router.push('/programacoes'),
            }}
          />
        </Cartao>
      ) : null}
    </>
  )
}

function Sincronizacao({
  offline,
  nomeDaComunidade,
}: {
  offline: Offline
  nomeDaComunidade: string
}) {
  const [pediu, setPediu] = useState(false)
  const { online, fase, erro, ultimaSincronizacao, validoAte } = offline
  return (
    <Cartao titulo="Sincronização" icone="sincronizar">
      <Linha
        icone={online ? 'confirmado' : 'semConexao'}
        titulo={online ? 'Conectado' : 'Sem conexão'}
        descricao={
          online
            ? 'As alterações vão para o servidor sozinhas: ao abrir o app, ao voltar para ele e quando a rede volta.'
            : 'O que você fizer fica guardado neste aparelho e vai quando a internet voltar.'
        }
      />
      <Linha
        icone="relogio"
        titulo="Última sincronização"
        descricao={
          ultimaSincronizacao
            ? quandoNoAparelho(ultimaSincronizacao)
            : `Ainda não houve neste aparelho para ${nomeDaComunidade}.`
        }
      />
      {validoAte ? (
        <Linha
          icone="seguranca"
          titulo={`Uso sem internet válido até ${diaEMesNoAparelho(validoAte)} às ${horaNoAparelho(validoAte)}`}
          descricao="Cada sincronização renova o prazo. Vencido, o que está guardado é apagado deste aparelho."
        />
      ) : null}
      {fase === 'falha' && erro ? (
        <AvisoDeErro
          titulo="Falha ao sincronizar"
          mensagem={erro}
          aoTentarDeNovo={() => void offline.sincronizarAgora()}
        />
      ) : null}
      {pediu && fase === 'concluido' ? (
        <Aviso tipo="sucesso" anunciar>
          Sincronização concluída.
        </Aviso>
      ) : null}
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
    </Cartao>
  )
}

function Bloco({ titulo, linhas }: { titulo: string; linhas: string[] }) {
  const { cores } = useTema()
  return (
    <View
      accessible
      accessibilityLabel={`${titulo}: ${linhas.join('. ')}`}
      style={{
        flex: 1,
        minWidth: 200,
        gap: ESPACO.x1,
        padding: ESPACO.x3,
        borderRadius: RAIO.medio,
        borderWidth: 1,
        borderColor: cores.borda,
      }}
    >
      <Texto variante="rotulo">{titulo}</Texto>
      {linhas.map((l) => (
        <Texto key={l} variante="apoio">
          {l}
        </Texto>
      ))}
    </View>
  )
}

function Conflito({ op, offline }: { op: OperacaoNaFila; offline: Offline }) {
  const acao = useAcaoLocal()
  const ocupado = acao.isPending && acao.variables?.chave === op.chave
  return (
    <View style={{ gap: ESPACO.x2 }}>
      <Texto variante="corpoForte">{op.descricao}</Texto>
      {op.mensagem ? <Texto variante="apoio">{op.mensagem}</Texto> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        <Bloco titulo="Sua versão (neste aparelho)" linhas={suaVersao(op)} />
        <Bloco titulo="Versão atual do servidor" linhas={versaoDoServidor(op)} />
      </View>
      {acao.error && acao.variables?.chave === op.chave ? <AvisoDeErro erro={acao.error} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        <Botao
          titulo="Ficar com a do servidor"
          variante="secundario"
          larguraTotal={false}
          rotuloAcessivel={`Ficar com a versão do servidor: ${op.descricao}`}
          desabilitado={ocupado}
          aoPressionar={() =>
            acao.mutate({ chave: op.chave, executar: () => offline.descartar(op.chave) })
          }
        />
        <Botao
          titulo="Aplicar a minha"
          larguraTotal={false}
          rotuloAcessivel={`Aplicar a sua versão: ${op.descricao}`}
          carregando={ocupado}
          aoPressionar={() =>
            acao.mutate({ chave: op.chave, executar: () => offline.refazer(op.chave) })
          }
        />
      </View>
    </View>
  )
}

function Recusada({ op, offline }: { op: OperacaoNaFila; offline: Offline }) {
  const acao = useAcaoLocal()
  const [copiado, setCopiado] = useState(false)
  const ocupado = acao.isPending && acao.variables?.chave === op.chave

  async function descartar() {
    const ok = await confirmar({
      titulo: 'Descartar esta alteração?',
      mensagem: `"${op.descricao}" sai deste aparelho e não é enviada.`,
      confirmar: 'Descartar',
      destrutivo: true,
    })
    if (ok) acao.mutate({ chave: op.chave, executar: () => offline.descartar(op.chave) })
  }

  return (
    <View style={{ gap: ESPACO.x2 }}>
      <Texto variante="corpoForte">{op.descricao}</Texto>
      <Selo texto="Recusada" cor="erro" />
      <Texto variante="apoio">
        Motivo: {op.mensagem ?? 'O servidor não aceitou esta alteração.'}
      </Texto>
      <Texto variante="apoio" cor="textoSuave">
        Feita em {quandoNoAparelho(op.criadaEm)}
      </Texto>
      {copiado ? (
        <Aviso tipo="sucesso" anunciar>
          Copiado.
        </Aviso>
      ) : null}
      {acao.error && acao.variables?.chave === op.chave ? <AvisoDeErro erro={acao.error} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
        <Botao
          titulo="Descartar"
          icone="excluir"
          variante="perigo"
          larguraTotal={false}
          rotuloAcessivel={`Descartar: ${op.descricao}`}
          desabilitado={ocupado}
          aoPressionar={() => void descartar()}
        />
        <Botao
          titulo="Copiar"
          icone="copiar"
          variante="secundario"
          larguraTotal={false}
          rotuloAcessivel={`Copiar: ${op.descricao}`}
          aoPressionar={() => void copiarTexto(textoParaCopiar(op)).then(setCopiado)}
        />
        <Botao
          titulo="Refazer"
          icone="repetir"
          larguraTotal={false}
          rotuloAcessivel={`Refazer: ${op.descricao}`}
          carregando={ocupado}
          aoPressionar={() =>
            acao.mutate({ chave: op.chave, executar: () => offline.refazer(op.chave) })
          }
        />
      </View>
    </View>
  )
}

function Preparados({ offline }: { offline: Offline }) {
  const acao = useAcaoLocal()
  if (!offline.pacotes.length) return null
  return (
    <Cartao titulo="Preparados neste aparelho" icone="guardadoNoAparelho">
      <Texto variante="apoio" cor="textoSuave">
        {contar(offline.pacotes.length, 'programação guardada', 'programações guardadas')},
        cifradas, para usar sem internet.
      </Texto>
      {offline.pacotes.map((p) => (
        <View key={p.eventoId} style={{ gap: ESPACO.x1 }}>
          <Linha
            titulo={p.titulo}
            descricao={textoDoPreparo(p.baixadoEm, offline.validoAte ?? p.validoAte)}
            aoPressionar={() =>
              router.push({ pathname: '/evento/[eventoId]', params: { eventoId: p.eventoId } })
            }
          />
          <Botao
            titulo="Remover deste aparelho"
            variante="discreto"
            icone="excluir"
            larguraTotal={false}
            rotuloAcessivel={`Remover ${p.titulo} deste aparelho`}
            carregando={acao.isPending && acao.variables?.chave === p.eventoId}
            aoPressionar={() =>
              acao.mutate({ chave: p.eventoId, executar: () => offline.removerPacote(p.eventoId) })
            }
          />
        </View>
      ))}
    </Cartao>
  )
}
