import { ALTURA, BORDA, ESPACO, TIPO } from '@uj/tokens'
import { useKeepAwake } from 'expo-keep-awake'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState, type ReactNode } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSessao } from '@/estado/sessao'
import type { ComandoDoAoVivo, EtapaAoVivo, RetratoAoVivo } from '@/servicos/contratoDosEventos'
import { ehErroDaApi, SemConexao } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { registrarRodape } from '@/ui/Toast'
import { sombra, useTema } from '@/ui/tema'
import { useAnunciar } from '@/ui/useAnunciar'
import { Vidro } from '@/ui/Vidro'
import { confirmar } from '@/utilidades/confirmar'
import {
  falarCronometro,
  formatarCronometro,
  formatarDuracao,
  formatarHora,
  minutosEntre,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useEstaOnline } from '../offline/ProvedorOffline'
import { useAoVivoLocal } from '../offline/useAoVivoLocal'
import {
  calcularTempo,
  CONTROLES_POR_SITUACAO,
  descreverAtraso,
  motivoDaRecusa,
  type ControleDoAoVivo,
} from './tempo'
import { useAgora, useAoVivo } from './useAoVivo'

/** Controles do ao vivo: 56 de altura, porque a tela é usada sob pressão (3.5.1). */
const ALTURA_DO_CONTROLE = ALTURA.controleAlto

/** Rota `/evento/[eventoId]/ao-vivo`. */
export function TelaAoVivo() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha aurora={0}>
        <SemComunidade oQue="o ao vivo" />
      </Tela>
    )
  }
  return <AoVivo comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
}

export function AoVivo({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const { retrato, conexao, comandar } = useAoVivo(comunidadeId, eventoId)
  const online = useEstaOnline()
  const local = useAoVivoLocal(eventoId, retrato.data ?? null)
  const semRede =
    !online ||
    (retrato.isPending && retrato.fetchStatus === 'paused') ||
    retrato.error instanceof SemConexao
  // Sem conexão: o andamento conhecido + os comandos deste aparelho ("só neste aparelho").
  if (semRede && local.retrato) {
    return (
      <Painel
        r={local.retrato}
        conexao="so_neste_aparelho"
        comandar={(comando) => {
          if (comando !== 'assumir' && comando !== 'liberar') local.comandar(comando)
        }}
        enviando={local.enviando}
        erro={local.erro}
      />
    )
  }
  if (retrato.isPending) {
    return (
      <Tela pilha aurora={0} titulo="Ao vivo">
        <Esqueleto rotulo="Carregando o andamento">
          <CartaoDeEsqueleto titulo />
          <CartaoDeEsqueleto />
        </Esqueleto>
      </Tela>
    )
  }
  if (retrato.error) {
    return (
      <Tela pilha aurora={0} titulo="Ao vivo">
        <ErroDaTela
          erro={retrato.error}
          titulo="O andamento não abriu"
          aoTentarDeNovo={() => void retrato.refetch()}
        />
      </Tela>
    )
  }
  return (
    <Painel
      r={retrato.data}
      conexao={conexao}
      comandar={(comando, forcar) => comandar.mutate({ comando, ...(forcar ? { forcar } : {}) })}
      enviando={comandar.isPending ? (comandar.variables?.comando ?? null) : null}
      erro={
        comandar.error && !(ehErroDaApi(comandar.error) && comandar.error.atual)
          ? comandar.error
          : null
      }
    />
  )
}

/**
 * Tela acesa enquanto alguém conduz ou acompanha (a tela ao vivo fica parada
 * na mão ou no púlpito). Sai do ar sozinho ao encerrar ou ao fechar a tela.
 */
function ManterTelaAcesa() {
  useKeepAwake('uj-ao-vivo')
  return null
}

interface PropsDoPainel {
  /** `recebidoEm` vem do `useAoVivo`; sem ele, usa o relógio do aparelho. */
  r: RetratoAoVivo & { recebidoEm?: number }
  /** `so_neste_aparelho`: sem conexão, comandos guardados como proposta (F13). */
  conexao: 'ao_vivo' | 'reconectando' | 'so_neste_aparelho'
  comandar: (comando: ComandoDoAoVivo, forcar?: boolean) => void
  enviando: ComandoDoAoVivo | null
  erro: unknown
}

const CHIP_DA_CONEXAO = {
  ao_vivo: { texto: 'Conectado', tom: 'sucesso' },
  reconectando: { texto: 'Reconectando', tom: 'alerta' },
  so_neste_aparelho: { texto: 'Só neste aparelho', tom: 'alerta' },
} as const

/**
 * Ao vivo (3.5.1 e quadro 09): fundo chapado (sem Aurora), cartões opacos, a
 * etapa atual no cartão de destaque com os dois cronômetros, "A SEGUIR", o
 * atraso acumulado, o progresso e todas as etapas. Quem conduz tem a barra
 * de controle de 56. O cronômetro não é região viva (seria lido a cada
 * segundo); a troca de etapa, sim, é anunciada.
 */
function Painel({ r, conexao, comandar, enviando, erro }: PropsDoPainel) {
  const pode = usePode()
  const fuso = useFusoDaComunidade()
  const agora = useAgora()
  const [menu, setMenu] = useState(false)
  // Relógio do aparelho corrigido pelo do servidor (o que vale é o andamento compartilhado).
  const desvioMs = r.recebidoEm === undefined ? 0 : Date.parse(r.agora) - r.recebidoEm
  const t = calcularTempo(r, agora + desvioMs)
  const conduz = pode('ao_vivo', 'conduzir')
  const local = conexao === 'so_neste_aparelho'
  const outroConduz = !local && r.condutor !== null && !r.souCondutor
  const controles = CONTROLES_POR_SITUACAO[r.situacao]

  // Avisa o leitor de tela quando a etapa muda (o resto da tela não é lido sozinho).
  const tituloAtual = t.atual?.titulo
  useAnunciar(
    tituloAtual
      ? `Agora: ${tituloAtual}`
      : r.situacao === 'encerrado'
        ? 'Encontro encerrado'
        : null,
  )
  // Perder e recuperar a conexão muda o que a tela mostra: o leitor de tela fica sabendo.
  useAnunciar(
    conexao === 'ao_vivo'
      ? 'Conexão de volta. Atualizando em tempo real.'
      : local
        ? 'Sem conexão. Mostrando o andamento guardado neste aparelho.'
        : 'Sem conexão. Tentando de novo.',
    { soMudancas: true },
  )

  async function executar(controle: ControleDoAoVivo) {
    if (controle === 'encerrar') {
      const ok = await confirmar({
        titulo: 'Encerrar o ao vivo?',
        mensagem: 'O andamento termina para todos que estão acompanhando.',
        confirmar: 'Encerrar',
        destrutivo: true,
      })
      if (!ok) return
    }
    comandar(controle)
  }

  async function assumir() {
    const ok = await confirmar({
      titulo: 'Assumir a condução?',
      mensagem: outroConduz
        ? `${r.condutor?.nome ?? 'Outra pessoa'} está conduzindo agora. Ao assumir, os comandos passam a ser seus e a troca fica registrada.`
        : 'Os comandos passam a ser seus. Só uma pessoa conduz por vez.',
      confirmar: 'Assumir a condução',
    })
    if (ok) comandar('assumir', outroConduz)
  }

  async function liberar() {
    const ok = await confirmar({
      titulo: 'Liberar a condução?',
      mensagem: 'O andamento continua; outra pessoa da organização pode assumir.',
      confirmar: 'Liberar',
    })
    if (ok) comandar('liberar')
  }

  const recusa = (c: ControleDoAoVivo) =>
    outroConduz
      ? 'Outra pessoa está conduzindo. Assuma a condução para mudar o andamento.'
      : controles.includes(c)
        ? motivoDaRecusa(r, c)
        : 'Disponível com o encontro em andamento.'

  const encerrado = r.situacao === 'encerrado'
  const acoesDoMenu = conduz
    ? [
        !local &&
          !r.souCondutor &&
          !encerrado && {
            titulo: 'Assumir a condução',
            icone: 'trocar' as const,
            descricao: outroConduz
              ? `${r.condutor?.nome ?? 'Outra pessoa'} está conduzindo agora`
              : 'Os comandos passam a ser seus',
            aoPressionar: () => void assumir(),
          },
        !local &&
          r.souCondutor &&
          !encerrado && {
            titulo: 'Liberar a condução',
            icone: 'sair' as const,
            aoPressionar: () => void liberar(),
          },
        controles.includes('encerrar') && {
          titulo: 'Encerrar o ao vivo',
          icone: 'encerrar' as const,
          destrutiva: true,
          motivo: recusa('encerrar'),
          aoPressionar: () => void executar('encerrar'),
        },
      ]
    : []
  const temMenu = acoesDoMenu.some(Boolean)

  const chip = CHIP_DA_CONEXAO[conexao]
  const cabecalho = (
    <>
      <Chip texto={chip.texto} tom={chip.tom} ponto />
      {temMenu ? (
        <BotaoIcone
          icone="maisAcoes"
          texto="Mais"
          rotulo="Mais ações"
          circular
          aoPressionar={() => setMenu(true)}
        />
      ) : null}
    </>
  )

  const barra =
    !conduz || encerrado ? null : outroConduz ? (
      <BarraDeControle>
        <View style={{ flex: 1 }}>
          <Texto variante="corpo">
            {`${r.condutor?.nome ?? 'Outra pessoa'} está conduzindo. Você está acompanhando.`}
          </Texto>
        </View>
        <Botao
          titulo="Assumir a condução"
          variante="terciario"
          carregando={enviando === 'assumir'}
          aoPressionar={() => void assumir()}
        />
      </BarraDeControle>
    ) : (
      <BarraDeControle>
        {/* Rótulo escrito embaixo do símbolo: "|◁" sozinho parecia "voltar de tela" (U-20). */}
        {r.situacao !== 'nao_iniciado' ? (
          <BotaoIcone
            icone="etapaAnterior"
            rotulo="Voltar etapa"
            texto="Voltar etapa"
            disposicao="embaixo"
            lado={ALTURA_DO_CONTROLE}
            desabilitado={recusa('voltar') !== null || enviando !== null}
            dica={recusa('voltar') ?? 'Volta para a etapa anterior.'}
            aoPressionar={() => void executar('voltar')}
          />
        ) : null}
        <BotaoDoControle
          titulo={
            r.situacao === 'nao_iniciado'
              ? 'Iniciar'
              : r.situacao === 'pausado'
                ? 'Retomar'
                : t.indiceAtual === t.total - 1
                  ? 'Concluir a última etapa'
                  : 'Avançar etapa'
          }
          controle={
            r.situacao === 'nao_iniciado'
              ? 'iniciar'
              : r.situacao === 'pausado'
                ? 'retomar'
                : 'avancar'
          }
          recusa={recusa}
          enviando={enviando}
          executar={(c) => void executar(c)}
        />
        {r.situacao === 'em_andamento' ? (
          <BotaoIcone
            icone="pausar"
            rotulo="Pausar"
            texto="Pausar"
            disposicao="embaixo"
            lado={ALTURA_DO_CONTROLE}
            desabilitado={recusa('pausar') !== null || enviando !== null}
            dica={recusa('pausar') ?? 'Para o relógio da etapa.'}
            aoPressionar={() => void executar('pausar')}
          />
        ) : null}
      </BarraDeControle>
    )

  return (
    <Tela
      pilha
      aurora={0}
      titulo={r.evento.titulo}
      acoes={cabecalho}
      {...(barra ? { barraDeAcao: barra } : {})}
    >
      {!encerrado ? <ManterTelaAcesa /> : null}

      {local ? (
        <Aviso tipo="alerta" titulo="Sem conexão: só neste aparelho">
          {conduz
            ? 'Os comandos ficam guardados aqui e vão como proposta quando a internet voltar. Se outra pessoa avançou no servidor, você vê as duas linhas do tempo em Perfil, Uso sem internet, e escolhe qual vale.'
            : 'Este é o andamento da última sincronização. Ele volta a se atualizar quando a internet voltar.'}
        </Aviso>
      ) : null}
      {erro ? <AvisoDeFalha erro={erro} titulo="O comando não foi" /> : null}

      <EtapaAtual r={r} t={t} fuso={fuso} />

      {t.proxima ? (
        <CartaoDeVidro sobrancelha="A seguir" opaco comecaComTitulo titulo={t.proxima.titulo}>
          <Texto variante="meta" cor="textoSuave">
            {`${formatarDuracao(t.proxima.duracaoMin)} · das ${formatarHora(t.proxima.inicioPrevisto, fuso)} às ${formatarHora(t.proxima.fimPrevisto, fuso)}`}
          </Texto>
        </CartaoDeVidro>
      ) : null}

      {r.situacao !== 'nao_iniciado' ? (
        <LinhaDoAtraso atrasoMin={t.atrasoMin} final={encerrado} />
      ) : null}

      <View style={{ gap: ESPACO.e8 }}>
        <Trilho fracao={t.total ? t.concluidas / t.total : 0} />
        <Texto variante="meta" cor="textoSuave" tabular>
          {`${t.concluidas} de ${t.total} etapas concluídas`}
        </Texto>
      </View>

      <Secao titulo="Todas as etapas">
        <CartaoDeVidro lista opaco>
          <Lista>
            {r.etapas.map((e, i) => (
              <LinhaDaEtapaAoVivo key={e.id} etapa={e} posicao={i} etapas={r.etapas} fuso={fuso} />
            ))}
          </Lista>
        </CartaoDeVidro>
      </Secao>

      {!conduz ? (
        <Texto variante="corpo" cor="textoSuave">
          Você está acompanhando. Quem conduz o andamento é a organização.
        </Texto>
      ) : null}

      <MenuDeAcoes
        aberto={menu}
        titulo="Mais ações"
        aoFechar={() => setMenu(false)}
        acoes={acoesDoMenu}
      />
    </Tela>
  )
}

/**
 * A etapa atual no cartão de destaque (quadro 09): "AGORA · ETAPA 2 DE 7",
 * o título em `display` e os cronômetros empilhados, cada um com o rótulo à
 * esquerda e o valor em 64/68 à direita. Com fonte grande, o rótulo vai
 * acima do valor. O estouro tem "+", o chip "Atrasado" e o texto.
 */
function EtapaAtual({
  r,
  t,
  fuso,
}: {
  r: RetratoAoVivo
  t: ReturnType<typeof calcularTempo>
  fuso: string
}) {
  if (r.situacao === 'nao_iniciado') {
    return (
      <CartaoDeDestaque sobrancelha="Ainda não começou">
        <Texto variante="display" nivel={2} style={{ marginTop: ESPACO.e8 }}>
          {`Previsto para ${formatarHora(r.evento.inicio, fuso)}`}
        </Texto>
        {t.atrasoParaComecarMin > 0 ? (
          <Texto variante="meta" cor="textoSuave" style={{ marginTop: ESPACO.e12 }}>
            {`${t.atrasoParaComecarMin} min além do horário previsto`}
          </Texto>
        ) : null}
      </CartaoDeDestaque>
    )
  }
  if (r.situacao === 'encerrado' || !t.atual) {
    return (
      <CartaoDeDestaque sobrancelha="Encerrado">
        <Texto variante="display" nivel={2} style={{ marginTop: ESPACO.e8 }}>
          Encontro encerrado
        </Texto>
      </CartaoDeDestaque>
    )
  }
  const estourou = t.restanteMs !== null && t.restanteMs < 0
  return (
    <CartaoDeDestaque
      sobrancelha={`${r.situacao === 'pausado' ? 'Pausado' : 'Agora'} · etapa ${t.indiceAtual + 1} de ${t.total}`}
    >
      <Texto variante="display" nivel={2} style={{ marginTop: ESPACO.e8 }}>
        {t.atual.titulo}
      </Texto>
      <View style={{ marginTop: ESPACO.e16 }}>
        <Cronometro
          rotulo="Decorrido"
          valor={formatarCronometro(t.decorridoMs)}
          falado={`Tempo decorrido: ${falarCronometro(t.decorridoMs)}`}
        />
        <Cronometro
          rotulo={estourou ? 'Além do previsto' : 'Restante'}
          valor={`${estourou ? '+' : ''}${formatarCronometro(Math.abs(t.restanteMs ?? 0))}`}
          falado={
            estourou
              ? `Atrasado. Passou ${falarCronometro(-(t.restanteMs ?? 0))} do previsto`
              : `Faltam ${falarCronometro(t.restanteMs ?? 0)}`
          }
          chip={estourou ? <Chip texto="Atrasado" tom="alerta" /> : null}
          separado
        />
      </View>
      <Texto variante="meta" cor="textoSuave" style={{ marginTop: ESPACO.e12 }}>
        {`Previsto ${formatarDuracao(t.atual.duracaoMin)}, das ${formatarHora(t.atual.inicioPrevisto, fuso)} às ${formatarHora(t.atual.fimPrevisto, fuso)}`}
      </Texto>
    </CartaoDeDestaque>
  )
}

function Cronometro({
  rotulo,
  valor,
  falado,
  chip,
  separado = false,
}: {
  rotulo: string
  valor: string
  falado: string
  chip?: ReactNode
  separado?: boolean
}) {
  const { cores } = useTema()
  const { fontScale } = useWindowDimensions()
  // Com fonte grande, o valor (teto de 1,4) não cabe ao lado do rótulo: empilha.
  const empilhar = fontScale >= 1.35
  return (
    <View
      accessible
      accessibilityLabel={falado}
      style={{
        minHeight: TIPO.cronometro.altura,
        flexDirection: empilhar ? 'column' : 'row',
        alignItems: empilhar ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: empilhar ? ESPACO.e4 : ESPACO.e12,
        borderTopWidth: separado ? BORDA.fina : 0,
        borderTopColor: cores.separador,
        paddingVertical: empilhar ? ESPACO.e8 : 0,
      }}
    >
      <View style={{ gap: ESPACO.e4, alignItems: 'flex-start', flexShrink: 1 }}>
        <Texto variante="sobrancelha" cor="textoSuave" accessibilityRole="text">
          {rotulo}
        </Texto>
        {chip}
      </View>
      {/* Papel `cronometro` (64/68, teto 1,4): o número já é enorme e não pode sair da tela. */}
      <Texto variante="cronometro" accessibilityRole="text" adjustsFontSizeToFit numberOfLines={1}>
        {valor}
      </Texto>
    </View>
  )
}

/** "Atraso acumulado: 4 min de atraso" (alerta) ou "No horário" (sucesso), com ícone. */
function LinhaDoAtraso({ atrasoMin, final }: { atrasoMin: number | null; final: boolean }) {
  const { cores } = useTema()
  if (atrasoMin === null) return null
  const atrasado = atrasoMin > 0
  const texto = atrasado
    ? `${final ? 'Atraso final' : 'Atraso acumulado'}: ${descreverAtraso(atrasoMin)}`
    : atrasoMin === 0
      ? 'No horário'
      : `Adiantado: ${-atrasoMin} min`
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
      <Icone nome="relogio" cor={atrasado ? cores.alerta : cores.sucesso} tamanho={18} />
      <Texto
        variante="corpo"
        peso="forte"
        cor={atrasado ? 'alerta' : 'sucesso'}
        style={{ flex: 1 }}
      >
        {texto}
      </Texto>
    </View>
  )
}

/**
 * Barra de progresso de 6 (quadro 09), em `primaria`. Fica oculta para o
 * leitor de tela: a legenda logo abaixo diz o mesmo em texto.
 */
function Trilho({ fracao }: { fracao: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <BarraDeProgresso
        fracao={fracao}
        rotulo="Progresso das etapas"
        cor="primaria"
        trilho="tonal"
      />
    </View>
  )
}

/** Duração real de uma etapa concluída, quando a seguinte já começou. */
function duracaoReal(etapas: readonly EtapaAoVivo[], i: number): number | null {
  const atual = etapas[i]
  const seguinte = etapas[i + 1]
  if (!atual?.inicioReal || !seguinte?.inicioReal) return null
  return minutosEntre(Date.parse(atual.inicioReal), Date.parse(seguinte.inicioReal))
}

function LinhaDaEtapaAoVivo({
  etapa: e,
  posicao,
  etapas,
  fuso,
}: {
  etapa: EtapaAoVivo
  posicao: number
  etapas: readonly EtapaAoVivo[]
  fuso: string
}) {
  const { cores } = useTema()
  const real = e.situacao === 'concluida' ? duracaoReal(etapas, posicao) : null
  const descricao =
    e.situacao === 'concluida'
      ? real !== null
        ? `Concluída em ${real} min, previsto ${e.duracaoMin}`
        : `Concluída · ${formatarDuracao(e.duracaoMin)}`
      : formatarDuracao(e.duracaoMin)
  const situacao =
    e.situacao === 'concluida'
      ? 'Concluída'
      : e.situacao === 'atual'
        ? 'Em curso agora'
        : 'A seguir'
  // A linha atual tem fundo quente e o chip "Agora"; a situação também vai escrita no rótulo.
  return (
    <LinhaDeLista
      hora={formatarHora(e.inicioPrevisto, fuso)}
      titulo={e.titulo}
      descricao={descricao}
      atual={e.situacao === 'atual'}
      rotuloAcessivel={`Etapa ${posicao + 1} de ${etapas.length}: ${e.titulo}, ${formatarDuracao(e.duracaoMin)}, prevista às ${formatarHora(e.inicioPrevisto, fuso)}. ${situacao}.`}
      {...(e.situacao === 'concluida'
        ? { extra: <Icone nome="check" cor={cores.sucesso} tamanho={18} peso="forte" /> }
        : e.situacao === 'atual'
          ? { extra: <Chip texto="Agora" tom="neutro" /> }
          : {})}
    />
  )
}

/**
 * Barra de controle fixa (quadro 09): o vidro da barra de ação, com botões
 * de 56. Diz ao toast onde termina, para ele aparecer acima dela.
 */
function BarraDeControle({ children }: { children: ReactNode }) {
  const { elevacao } = useTema()
  const margens = useSafeAreaInsets()
  const altura = ESPACO.e12 + ALTURA_DO_CONTROLE + margens.bottom + ESPACO.e12
  // O toast é um sistema externo à tela: registra a altura ao montar e libera ao sair.
  useEffect(() => registrarRodape(altura), [altura])
  return (
    <Vidro borda="cima" style={sombra(elevacao.flutuante)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e8,
          paddingTop: ESPACO.e12,
          paddingHorizontal: ESPACO.e20,
          paddingBottom: margens.bottom + ESPACO.e12,
        }}
      >
        {children}
      </View>
    </Vidro>
  )
}

/** O primário da barra de controle: o botão alto (56) com `flex: 1`. */
function BotaoDoControle({
  titulo,
  controle,
  recusa,
  enviando,
  executar,
}: {
  titulo: string
  controle: ControleDoAoVivo
  recusa: (c: ControleDoAoVivo) => string | null
  enviando: ComandoDoAoVivo | null
  executar: (c: ControleDoAoVivo) => void
}) {
  const motivo = recusa(controle)
  const carregando = enviando === controle
  return (
    <Botao
      titulo={titulo}
      tamanho="alto"
      larguraTotal
      style={{ flex: 1 }}
      carregando={carregando}
      // Outro comando a caminho também trava este: nada sai duas vezes.
      desabilitado={motivo !== null || (enviando !== null && !carregando)}
      {...(motivo ? { dica: motivo } : {})}
      aoPressionar={() => executar(controle)}
    />
  )
}
