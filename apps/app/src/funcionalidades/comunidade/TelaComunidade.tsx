import { BORDA, ESPACO, RAIO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ComunidadeDoVinculo } from '@/servicos/contrato'
import type { MuralDaComunidade } from '@/servicos/contratoV3'
import { Acordeao } from '@/ui/Acordeao'
import { Avatar } from '@/ui/Avatar'
import { Aviso } from '@/ui/Aviso'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Esqueleto, LinhaDeEsqueleto, BlocoDeEsqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista, RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { parametro } from '@/utilidades/parametros'

import { SemComunidade } from '../navegacao/SemComunidade'
import { fotoDoMembro } from '../perfil/imagens'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { CabecalhoDeAcordeao } from './CabecalhoDeAcordeao'
import { AvisoDeComunidadeNova } from './ComunidadeNova'
import { useDetalheDaComunidade, useMembros, useMural } from './consultas'
import { dataRelativa } from './datasRelativas'
import { useAtalhosDoMural, type AcaoRapida, type AtalhoDoMural } from './atalhosDoMural'
import { CHIP_DO_ESTADO_DA_COMUNIDADE, NOME_CURTO_DO_ESTADO_DA_COMUNIDADE } from './nomes'
import { usePode } from './permissoes'
import { VazioComSol } from './VazioComSol'

/** `/comunidade?segmento=pedidos` (toque na notificação de pedido) abre os pedidos de entrada. */
function segmentoDosPedidos(valor: string | null): 'pedidos' | 'convites' | null {
  return valor === 'pedidos' || valor === 'convites' ? valor : null
}

const pessoas = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`

/**
 * Aba Comunidade (rota `/comunidade`, D70): um mural curto, não um menu de links (UX 3.6).
 * Do alto para baixo: as duas ações rápidas, o aviso à vista (título, não só atalho), os
 * pedidos de oração (só o número de novos: o texto nunca aparece aqui), as pessoas, "Mais"
 * (Biblioteca, Louvor para quem toca ou organiza, Sugestões) e, para quem organiza, a
 * "Organização" dobrada. Tudo vem de uma chamada (`GET /mural`). Cada bloco só aparece
 * para quem pode usá-lo; quem decide de verdade é a API.
 */
export function TelaComunidade() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <TelaDoApp titulo="Comunidade">
        <SemComunidade />
      </TelaDoApp>
    )
  }
  return <Mural comunidade={comunidadeAtiva} />
}

function Mural({ comunidade }: { comunidade: ComunidadeDoVinculo }) {
  const ativa = comunidade.estado === 'ativa'
  const pode = usePode()
  const online = useEstaOnline()
  const mural = useMural(comunidade.id)
  const detalhe = useDetalheDaComunidade(comunidade.id)
  const { acoes, mais, organizacao, verPedidosEConvites, verPedidos } = useAtalhosDoMural(ativa)
  const equipeDeOracao = comunidade.designacoes.includes('equipe_oracao')

  // Notificação de pedido de entrada: abre a tela dos pedidos uma vez por toque. Limpar o
  // parâmetro antes de empurrar deixa o toque seguinte (mesmo valor) valer de novo.
  const segmento = segmentoDosPedidos(
    parametro(useLocalSearchParams<{ segmento?: string }>().segmento),
  )
  const tratado = useRef<string | null>(null)
  useEffect(() => {
    if (!segmento) {
      tratado.current = null
      return
    }
    if (tratado.current === segmento) return
    tratado.current = segmento
    if (!verPedidosEConvites) return
    router.setParams({ segmento: undefined })
    router.push({ pathname: '/pedidos-de-entrada', params: { segmento } })
  }, [segmento, verPedidosEConvites])

  const dados = mural.data
  const total = dados?.pessoas.total
  const descricao = total === undefined ? undefined : pessoas(total)

  return (
    <TelaDoApp titulo="Comunidade" {...(descricao ? { descricao } : {})}>
      {!ativa || equipeDeOracao ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          {!ativa ? (
            <Chip
              texto={NOME_CURTO_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]}
              tom={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].tom}
            />
          ) : null}
          {equipeDeOracao ? <Chip texto="Equipe de oração" tom="quente" /> : null}
        </View>
      ) : null}

      {!ativa ? (
        <Aviso tipo="alerta" titulo="Comunidade sem alterações por enquanto">
          {comunidade.estado === 'suspensa'
            ? 'Esta comunidade está suspensa: dá para consultar, mas não convidar nem mudar papéis.'
            : 'Esta comunidade não está ativa. Fale com o Criador da plataforma se precisar reativá-la.'}
        </Aviso>
      ) : null}

      {dados && !online ? (
        <Aviso tipo="alerta" titulo="Sem internet">
          Você vê a última versão. As ações que avisam pessoas esperam a conexão.
        </Aviso>
      ) : null}

      <EntradaEmCascata ordem={0}>
        <AcoesRapidas acoes={acoes} online={online} />
      </EntradaEmCascata>

      {mural.isPending ? (
        <EsqueletoDoMural />
      ) : mural.isError && !dados ? (
        <ErroDaTela
          erro={mural.error}
          oQue="a comunidade"
          aoTentarDeNovo={() => void mural.refetch()}
        />
      ) : dados ? (
        <>
          <EntradaEmCascata ordem={1}>
            <BlocoDeAvisos
              avisos={dados.avisos}
              podePublicar={pode('aviso', 'publicar')}
              acaoJaNoTopo={acoes.some((a) => a.id === 'novo_aviso')}
            />
          </EntradaEmCascata>
          <EntradaEmCascata ordem={2}>
            <PedidosEPessoas comunidadeId={comunidade.id} dados={dados} />
          </EntradaEmCascata>
        </>
      ) : null}

      <EntradaEmCascata ordem={3}>
        <View style={{ gap: ESPACO.e8 }}>
          <TituloDaSecao>Mais</TituloDaSecao>
          <Cartao lista>
            <Lista>
              {mais.map((a) => (
                <LinhaDeLista
                  key={a.rotulo}
                  icone={a.icone}
                  titulo={a.rotulo}
                  descricao={a.descricao}
                  rotuloAcessivel={`${a.rotulo}. ${a.descricao}`}
                  aoPressionar={() => router.push(a.href)}
                />
              ))}
            </Lista>
          </Cartao>
        </View>
      </EntradaEmCascata>

      {organizacao.length > 0 || verPedidosEConvites ? (
        <EntradaEmCascata ordem={4}>
          <Organizacao
            itens={organizacao}
            mostrarPedidos={verPedidosEConvites}
            pedidosDeEntrada={verPedidos ? (dados?.organizacao?.pedidosDeEntrada ?? 0) : 0}
          />
        </EntradaEmCascata>
      ) : null}

      {verPedidos ? <AvisoDeComunidadeNova detalhe={detalhe.data} /> : null}
    </TelaDoApp>
  )
}

/** Título de seção do mural (16 em 600, como o protótipo): a sobrancelha é só dos cartões. */
function TituloDaSecao({ children }: { children: string }) {
  return (
    <Texto variante="tituloItem" accessibilityRole="header" nivel={2}>
      {children}
    </Texto>
  )
}

/**
 * Duas ações rápidas lado a lado, secundárias de verdade (o que a pessoa vem fazer aqui).
 * Sem internet ficam desabilitadas e a linha de baixo diz por quê (o motivo nunca é só a
 * cor apagada).
 */
function AcoesRapidas({ acoes, online }: { acoes: readonly AcaoRapida[]; online: boolean }) {
  const { cores } = useTema()
  const motivo = online ? null : (acoes[0]?.motivoSemInternet ?? null)
  return (
    <View>
      <ParDeBotoes larguraMinima={150}>
        {acoes.map((a) => (
          <Botao
            key={a.id}
            titulo={a.titulo}
            icone={a.icone}
            variante="secundario"
            desabilitado={!online}
            aoPressionar={() => router.push(a.href)}
          />
        ))}
      </ParDeBotoes>
      {motivo ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: ESPACO.e8,
            marginTop: ESPACO.e8,
          }}
        >
          <Icone nome="cadeado" cor={cores.textoSuave} tamanho={14} />
          <Texto variante="meta" cor="textoSuave" style={{ flex: 1 }}>
            {motivo}
          </Texto>
        </View>
      ) : null}
    </View>
  )
}

/** O aviso mais importante com título (o fixado, ou o mais recente) e o caminho para todos. */
function BlocoDeAvisos({
  avisos,
  podePublicar,
  acaoJaNoTopo,
}: {
  avisos: MuralDaComunidade['avisos']
  podePublicar: boolean
  /** "Novo aviso" já é uma ação rápida do topo: o vazio não repete o botão (sem duplicação). */
  acaoJaNoTopo: boolean
}) {
  const destaque = avisos.destaque
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <TituloDaSecao>Avisos</TituloDaSecao>
      {destaque ? (
        <>
          <Cartao lista>
            <Lista>
              <LinhaDeLista
                variante="checkin"
                icone={destaque.fixado ? 'fixar' : 'aviso'}
                titulo={destaque.fixado ? `Fixado: ${destaque.titulo}` : destaque.titulo}
                descricao={dataRelativa(destaque.publicadoEm)}
                rotuloAcessivel={`${destaque.fixado ? 'Aviso fixado' : 'Último aviso'}: ${destaque.titulo}, ${dataRelativa(destaque.publicadoEm)}`}
                aoPressionar={() =>
                  router.push({
                    pathname: '/avisos/[avisoId]',
                    params: { avisoId: destaque.id },
                  })
                }
              />
              {/* A última linha do cartão, alinhada ao texto das outras: link solto no meio da tela
                  ficava fora do eixo (D79). */}
              <LinhaDeLista
                icone="mais"
                titulo="Ver todos os avisos"
                valor={String(avisos.total)}
                rotuloAcessivel={`Ver todos os avisos, ${avisos.total}`}
                aoPressionar={() => router.push('/avisos')}
              />
            </Lista>
          </Cartao>
        </>
      ) : (
        <VazioComSol
          titulo="Nenhum aviso por enquanto."
          descricao={
            podePublicar ? 'Escreva o primeiro aviso.' : 'Os avisos da liderança aparecem aqui.'
          }
          {...(podePublicar && !acaoJaNoTopo
            ? {
                acao: {
                  titulo: 'Novo aviso',
                  icone: 'aviso' as const,
                  aoPressionar: () => router.push('/avisos/novo'),
                },
              }
            : {})}
        />
      )}
    </View>
  )
}

/**
 * Pedidos de oração (só o número de novos, em texto: nunca o texto de um pedido) e Pessoas
 * (três avatares e o total). O número "novos" vem do servidor, que conta o que a pessoa já
 * pode ler e ainda não marcou.
 */
function PedidosEPessoas({
  comunidadeId,
  dados,
}: {
  comunidadeId: string
  dados: MuralDaComunidade
}) {
  const { cores } = useTema()
  const membros = useMembros(comunidadeId)
  const novos = dados.oracao.novos
  const rostos = (membros.data ?? []).filter((m) => m.estado === 'ativo').slice(0, 3)
  return (
    <Cartao lista>
      <Lista>
        <LinhaDeLista
          icone="coracao"
          titulo="Pedidos de oração"
          rotuloAcessivel={`Pedidos de oração${novos > 0 ? `. ${novos} ${novos === 1 ? 'novo' : 'novos'}` : ''}`}
          {...(novos > 0
            ? {
                extra: (
                  <Chip situacao="novo" texto={`${novos} ${novos === 1 ? 'novo' : 'novos'}`} />
                ),
              }
            : {})}
          aoPressionar={() => router.push('/oracao')}
        />
        <LinhaDeLista
          icone="pessoas"
          titulo="Pessoas"
          rotuloAcessivel={`Pessoas. ${pessoas(dados.pessoas.total)}`}
          extra={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
              <View style={{ flexDirection: 'row' }}>
                {rostos.map((m, i) => (
                  <View
                    key={m.vinculoId}
                    style={{
                      marginLeft: i === 0 ? 0 : -ESPACO.e8,
                      borderRadius: RAIO.pilula,
                      borderWidth: BORDA.anel,
                      borderColor: cores.superficie,
                    }}
                  >
                    <Avatar
                      nome={m.nome}
                      avatar={m.avatar ?? null}
                      foto={fotoDoMembro(comunidadeId, m)}
                      lado={28}
                      decorativo
                    />
                  </View>
                ))}
              </View>
              <Texto variante="corpo" cor="textoSuave" tabular>
                {String(dados.pessoas.total)}
              </Texto>
            </View>
          }
          aoPressionar={() => router.push('/pessoas')}
        />
      </Lista>
    </Cartao>
  )
}

/**
 * Organização, dobrada (só para quem organiza): pedidos de entrada e convites, relatórios,
 * locais, modelos, denúncias, configurações e código. O número de pedidos esperando fica
 * visível mesmo com o bloco fechado, em texto.
 */
function Organizacao({
  itens,
  mostrarPedidos,
  pedidosDeEntrada,
}: {
  itens: readonly AtalhoDoMural[]
  mostrarPedidos: boolean
  pedidosDeEntrada: number
}) {
  const textoDosPedidos = `${pedidosDeEntrada} ${pedidosDeEntrada === 1 ? 'pedido' : 'pedidos'}`
  return (
    <Cartao lista>
      <Acordeao
        chave="organizacao-da-comunidade"
        recuo={RECUO_DA_LISTA.texto}
        rotuloRecolhido={`Organização${pedidosDeEntrada ? `, ${textoDosPedidos} de entrada` : ''}. Recolhido, toque para ver.`}
        rotuloAberto="Organização. Aberto, toque para recolher."
        cabecalho={() => (
          <CabecalhoDeAcordeao
            icone="ajustes"
            titulo="Organização"
            {...(pedidosDeEntrada > 0
              ? { extra: <Chip situacao="novo" texto={textoDosPedidos} /> }
              : {})}
          />
        )}
      >
        <Lista>
          {[
            ...(mostrarPedidos
              ? [
                  <LinhaDeLista
                    key="pedidos"
                    icone="convidar"
                    titulo="Pedidos de entrada e convites"
                    descricao="Quem pediu para entrar e os convites criados."
                    rotuloAcessivel={`Pedidos de entrada e convites${pedidosDeEntrada ? `. ${textoDosPedidos} esperando` : ''}`}
                    {...(pedidosDeEntrada > 0
                      ? { extra: <Chip situacao="novo" texto={textoDosPedidos} /> }
                      : {})}
                    aoPressionar={() => router.push('/pedidos-de-entrada')}
                  />,
                ]
              : []),
            ...itens.map((i) => (
              <LinhaDeLista
                key={i.rotulo}
                icone={i.icone}
                titulo={i.rotulo}
                descricao={i.descricao}
                rotuloAcessivel={`${i.rotulo}. ${i.descricao}`}
                aoPressionar={() => router.push(i.href)}
              />
            )),
          ]}
        </Lista>
      </Acordeao>
    </Cartao>
  )
}

/** Três blocos de esqueleto com a altura do conteúdo final: avisos, pedidos e pessoas. */
function EsqueletoDoMural() {
  return (
    <Esqueleto rotulo="Carregando a comunidade">
      <BlocoDeEsqueleto largura="24%" altura={18} />
      <LinhaDeEsqueleto altura={72} />
      <LinhaDeEsqueleto altura={64} />
      <LinhaDeEsqueleto altura={64} />
    </Esqueleto>
  )
}
