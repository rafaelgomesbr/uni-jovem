import { useMutation } from '@tanstack/react-query'
import { ALTURA, ESPACO, TIPO, type PoseDoSol } from '@uj/tokens'
import { useKeepAwake } from 'expo-keep-awake'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState, type ReactNode } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSessao } from '@/estado/sessao'
import type { ComandoDoAoVivo, EtapaAoVivo, RetratoAoVivo } from '@/servicos/contratoDosEventos'
import { ehErroDaApi, mensagemDoErro, SemConexao } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Esqueleto, EsqueletoDoMomento, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { registrarRodape } from '@/ui/Toast'
import { frasePraDesfazer, mostrarDesfazer, useSegundosDoDesfazer } from '@/ui/ToastComDesfazer'
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
import { VazioComSol } from '../inscricoes/VazioComSol'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useEstaOnline, useOffline } from '../offline/ProvedorOffline'
import { useAoVivoLocal } from '../offline/useAoVivoLocal'
import {
  calcularTempo,
  CONTROLES_POR_SITUACAO,
  descreverAtraso,
  motivoDaRecusa,
  type ControleDoAoVivo,
} from './tempo'
import { useAgora, useAoVivo } from './useAoVivo'

/** Controles do ao vivo: 56 de altura, porque a tela é usada sob pressão. */
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
        eventoId={eventoId}
      />
    )
  }
  if (semRede) return <SemPacote eventoId={eventoId} />
  if (retrato.isPending) {
    return (
      <Tela pilha aurora={0} titulo="Ao vivo">
        <Esqueleto rotulo="Carregando o andamento">
          <EsqueletoDoMomento />
          <LinhaDeEsqueleto altura={56} />
          <LinhaDeEsqueleto altura={56} />
        </Esqueleto>
      </Tela>
    )
  }
  if (retrato.error) {
    return (
      <Tela pilha aurora={0} titulo="Ao vivo">
        <ErroDaTela
          erro={retrato.error}
          titulo="Não deu para conectar."
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
      eventoId={eventoId}
    />
  )
}

/** Sem internet e sem o encontro baixado: não há andamento para mostrar nem para conduzir. */
function SemPacote({ eventoId }: { eventoId: string }) {
  const offline = useOffline()
  const baixar = useMutation({
    mutationFn: () => offline.prepararEvento(eventoId),
    networkMode: 'always',
  })
  return (
    <Tela
      pilha
      aurora={0}
      titulo="Ao vivo"
      acoes={<Chip situacao="aguardando" texto="Sem conexão" icone="semConexao" />}
    >
      <VazioComSol
        titulo="Sem internet e sem o encontro no aparelho."
        descricao="Para conduzir sem internet, baixe o encontro antes. Faça isso com Wi-Fi."
        acao={{
          titulo: baixar.isPending ? 'Baixando...' : 'Baixar o encontro',
          icone: 'baixar',
          aoPressionar: () => {
            if (offline.online && offline.disponivel) baixar.mutate()
          },
        }}
      />
      {!offline.online ? (
        <Texto variante="legenda" cor="textoSuave">
          Baixar exige conexão com a internet.
        </Texto>
      ) : null}
      {!offline.disponivel ? (
        <Aviso tipo="info" titulo="Só no app do celular">
          {offline.motivoIndisponivel ?? 'Nada fica guardado neste aparelho.'}
        </Aviso>
      ) : null}
      {baixar.error ? (
        <Aviso tipo="erro" titulo="Não deu certo" anunciar>
          {mensagemDoErro(baixar.error)}
        </Aviso>
      ) : null}
    </Tela>
  )
}

/**
 * Tela acesa enquanto alguém conduz ou acompanha (a tela ao vivo fica parada na mão ou no
 * púlpito). Sai do ar sozinho ao encerrar ou ao fechar a tela.
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
  eventoId: string
}

const CHIP_DA_CONEXAO = {
  ao_vivo: { texto: 'Conectado', tom: 'sucesso', icone: 'check' },
  reconectando: { texto: 'Reconectando', tom: 'alerta', icone: 'sincronizar' },
  so_neste_aparelho: { texto: 'Sem conexão', tom: 'alerta', icone: 'semConexao' },
} as const

const POSE_POR_SITUACAO: Readonly<Record<RetratoAoVivo['situacao'], PoseDoSol>> = {
  nao_iniciado: 'escondido',
  em_andamento: 'radiante',
  pausado: 'pleno',
  encerrado: 'poente',
}

/**
 * Ao vivo no visual A (D71): fundo chapado (sem Aurora, a tela é de condução), o cartão da etapa
 * de agora com o tempo que resta em número enorme e o sol radiante, o atraso acumulado, o que vem
 * depois e o roteiro. Quem conduz tem os botões com texto: "Voltar", o primário que NOMEIA a
 * próxima etapa ("Próxima etapa: Oração intercessora") e "Pausar". "Encerrar o ao vivo" não pede
 * confirmação: mostra o resultado e dá 10 s para desfazer, porque avisa quem acompanha. Quem só
 * acompanha vê a mesma tela, sem botões. O cronômetro não é região viva (seria lido a cada
 * segundo); a troca de etapa, sim, é anunciada.
 */
function Painel({ r, conexao, comandar, enviando, erro, eventoId }: PropsDoPainel) {
  const pode = usePode()
  const fuso = useFusoDaComunidade()
  const agora = useAgora()
  const segundosDoDesfazer = useSegundosDoDesfazer()
  const [menu, setMenu] = useState(false)
  // "Encerrar" aparece feito na hora; o envio só sai depois da contagem do Desfazer.
  const [encerrando, setEncerrando] = useState(false)
  // Relógio do aparelho corrigido pelo do servidor (o que vale é o andamento compartilhado).
  const desvioMs = r.recebidoEm === undefined ? 0 : Date.parse(r.agora) - r.recebidoEm
  const t = calcularTempo(r, agora + desvioMs)
  const conduz = pode('ao_vivo', 'conduzir')
  const local = conexao === 'so_neste_aparelho'
  const outroConduz = !local && r.condutor !== null && !r.souCondutor
  const controles = CONTROLES_POR_SITUACAO[r.situacao]
  const encerrado = r.situacao === 'encerrado' || (encerrando && !erro)

  // Avisa o leitor de tela quando a etapa muda (o resto da tela não é lido sozinho).
  const tituloAtual = t.atual?.titulo
  useAnunciar(
    tituloAtual && !encerrado ? `Agora: ${tituloAtual}` : encerrado ? 'Encontro encerrado' : null,
  )
  // Perder e recuperar a conexão muda o que a tela mostra: o leitor de tela fica sabendo.
  useAnunciar(
    conexao === 'ao_vivo'
      ? 'Conexão de volta. Atualizando em tempo real.'
      : local
        ? 'Sem conexão. Você pode continuar. As mudanças vão quando a internet voltar.'
        : 'Sem conexão. Tentando de novo.',
    { soMudancas: true },
  )

  function encerrar() {
    setEncerrando(true)
    mostrarDesfazer({
      texto: 'Encerrando o ao vivo para quem acompanha.',
      aoDesfazer: () => setEncerrando(false),
      aoConfirmar: () => comandar('encerrar'),
    })
  }

  function executar(controle: ControleDoAoVivo) {
    if (controle === 'encerrar') {
      encerrar()
      return
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
        controles.includes('encerrar') &&
          !encerrado && {
            titulo: 'Encerrar o ao vivo',
            icone: 'encerrar' as const,
            destrutiva: true,
            descricao: `Avisa quem acompanha. ${frasePraDesfazer(segundosDoDesfazer)}`,
            motivo: outroConduz ? recusa('encerrar') : null,
            aoPressionar: () => executar('encerrar'),
          },
      ]
    : []
  const temMenu = acoesDoMenu.some(Boolean)

  const chip = CHIP_DA_CONEXAO[conexao]
  const cabecalho = (
    <>
      <Chip texto={chip.texto} tom={chip.tom} icone={chip.icone} />
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

  const ultima = t.indiceAtual === t.total - 1
  const nomeDaProxima = t.proxima?.titulo
  const barra =
    !conduz || encerrado || r.etapas.length === 0 ? null : outroConduz ? (
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
        <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: ESPACO.e8 }}>
          {r.situacao === 'em_andamento' ? (
            <Botao
              titulo="Voltar"
              icone="etapaAnterior"
              variante="secundario"
              tamanho="alto"
              rotuloAcessivel="Voltar uma etapa"
              desabilitado={recusa('voltar') !== null || enviando !== null}
              {...(recusa('voltar') ? { dica: recusa('voltar')! } : {})}
              aoPressionar={() => executar('voltar')}
            />
          ) : null}
          <BotaoDoControle
            titulo={
              r.situacao === 'nao_iniciado'
                ? 'Iniciar o encontro'
                : r.situacao === 'pausado'
                  ? 'Retomar'
                  : ultima
                    ? 'Encerrar o ao vivo'
                    : `Próxima etapa: ${nomeDaProxima ?? ''}`
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
            executar={(c) => executar(c === 'avancar' && ultima ? 'encerrar' : c)}
          />
        </View>
        {r.situacao === 'em_andamento' ? (
          <View style={{ alignItems: 'center' }}>
            <Botao
              titulo="Pausar"
              icone="pausar"
              variante="terciario"
              desabilitado={recusa('pausar') !== null || enviando !== null}
              {...(recusa('pausar') ? { dica: recusa('pausar')! } : {})}
              aoPressionar={() => executar('pausar')}
            />
          </View>
        ) : null}
      </BarraDeControle>
    )

  const roteiroVazio = r.etapas.length === 0

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
        <Aviso tipo="alerta" titulo="Sem internet">
          {conduz
            ? 'Você pode continuar. As mudanças vão quando a internet voltar.'
            : 'Este é o andamento da última sincronização. Ele volta a se atualizar quando a internet voltar.'}
        </Aviso>
      ) : null}
      {erro ? <AvisoDeFalha erro={erro} titulo="O comando não foi" /> : null}

      {roteiroVazio ? (
        <VazioComSol
          titulo="Este encontro não tem roteiro."
          descricao="Monte o roteiro para conduzir etapa por etapa."
          {...(pode('etapa', 'gerenciar')
            ? {
                acao: {
                  titulo: 'Montar o roteiro',
                  aoPressionar: () =>
                    router.push({ pathname: '/evento/[eventoId]', params: { eventoId } }),
                },
              }
            : {})}
        />
      ) : (
        <>
          <EntradaEmCascata ordem={1}>
            <EtapaAtual r={r} t={t} fuso={fuso} encerrado={encerrado} />
          </EntradaEmCascata>

          {r.situacao !== 'nao_iniciado' && !encerrado ? (
            <LinhaDoAtraso atrasoMin={t.atrasoMin} final={false} />
          ) : null}
          {encerrado && r.situacao === 'encerrado' ? (
            <LinhaDoAtraso atrasoMin={t.atrasoMin} final />
          ) : null}

          {t.proxima && !encerrado ? (
            <EntradaEmCascata ordem={2}>
              <Cartao sobrancelha="A seguir" comecaComTitulo titulo={t.proxima.titulo}>
                <Texto variante="meta" cor="textoSuave">
                  {`${formatarDuracao(t.proxima.duracaoMin)} · das ${formatarHora(t.proxima.inicioPrevisto, fuso)} às ${formatarHora(t.proxima.fimPrevisto, fuso)}`}
                </Texto>
              </Cartao>
            </EntradaEmCascata>
          ) : null}

          <View style={{ gap: ESPACO.e8 }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <BarraDeProgresso
                fracao={t.total ? t.concluidas / t.total : 0}
                rotulo="Progresso das etapas"
                cor="primaria"
                trilho="tonal"
              />
            </View>
            <Texto variante="meta" cor="textoSuave" tabular>
              {`${t.concluidas} de ${t.total} etapas concluídas`}
            </Texto>
          </View>

          <EntradaEmCascata ordem={3}>
            <Secao titulo="Todas as etapas">
              <Cartao lista>
                <Lista>
                  {r.etapas.map((e, i) => (
                    <LinhaDaEtapaAoVivo
                      key={e.id}
                      etapa={e}
                      posicao={i}
                      etapas={r.etapas}
                      fuso={fuso}
                    />
                  ))}
                </Lista>
              </Cartao>
            </Secao>
          </EntradaEmCascata>
        </>
      )}

      {!conduz && !roteiroVazio ? (
        <Texto variante="corpo" cor="textoSuave">
          Você está acompanhando. Quem conduz o andamento é a organização.
        </Texto>
      ) : null}

      {conduz && encerrado && pode('evento', 'criar') ? (
        <Botao
          titulo="Marcar o próximo encontro"
          tamanho="grande"
          larguraTotal
          aoPressionar={() => router.push('/evento/igual-ao-ultimo')}
        />
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
 * A etapa de agora no cartão do momento: a etiqueta ("AGORA", "AINDA NÃO COMEÇOU", "PAUSADO",
 * "ENCERRADO"), o nome da etapa, o tempo que resta em número enorme e o sol da pose certa. Passou
 * do previsto, o número leva "+" e o chip "Passou N min" (ícone e texto, nunca só cor).
 */
function EtapaAtual({
  r,
  t,
  fuso,
  encerrado,
}: {
  r: RetratoAoVivo
  t: ReturnType<typeof calcularTempo>
  fuso: string
  encerrado: boolean
}) {
  if (encerrado || r.situacao === 'encerrado') {
    return (
      <Cartao
        variante="momento"
        pose={POSE_POR_SITUACAO.encerrado}
        etiqueta="Encerrado"
        titulo="Encontro encerrado."
        meta={`${t.concluidas} de ${t.total} etapas concluídas`}
      />
    )
  }
  if (r.situacao === 'nao_iniciado') {
    return (
      <Cartao
        variante="momento"
        pose={POSE_POR_SITUACAO.nao_iniciado}
        etiqueta="Ainda não começou"
        titulo={`Previsto: ${formatarHora(r.evento.inicio, fuso)}`}
        {...(t.atrasoParaComecarMin > 0
          ? { meta: `${t.atrasoParaComecarMin} min além do horário previsto` }
          : {})}
      />
    )
  }
  if (!t.atual) return null
  const estourou = t.restanteMs !== null && t.restanteMs < 0
  const restanteMin =
    t.restanteMs === null ? 0 : Math.max(0, Math.round(Math.abs(t.restanteMs) / 60_000))
  const chip = estourou ? (
    <Chip situacao="aguardando" texto={`Passou ${Math.max(1, restanteMin)} min`} icone="relogio" />
  ) : (
    <Chip
      tom="neutro"
      icone="relogio"
      texto={restanteMin < 1 ? 'Resta menos de 1 min' : `Restam ${restanteMin} min`}
    />
  )
  const falado = estourou
    ? `Atrasado. Passou ${falarCronometro(-(t.restanteMs ?? 0))} do previsto. Tempo decorrido: ${falarCronometro(t.decorridoMs)}.`
    : `Faltam ${falarCronometro(t.restanteMs ?? 0)}. Tempo decorrido: ${falarCronometro(t.decorridoMs)}.`
  return (
    <Cartao
      variante="momento"
      pose={POSE_POR_SITUACAO[r.situacao]}
      aoVivo={r.situacao === 'em_andamento'}
      etiqueta={r.situacao === 'pausado' ? 'Pausado' : 'Agora'}
      titulo={t.atual.titulo}
      meta={`Etapa ${t.indiceAtual + 1} de ${t.total} · até ${formatarHora(t.atual.fimPrevisto, fuso)}`}
    >
      <Cronometro
        valor={`${estourou ? '+' : ''}${formatarCronometro(Math.abs(t.restanteMs ?? 0))}`}
        falado={falado}
        rotulo={estourou ? 'Além do previsto' : 'Restante'}
        decorrido={`${formatarCronometro(t.decorridoMs)} de ${formatarDuracao(t.atual.duracaoMin)}`}
      />
      {chip}
      {r.condutor ? (
        <Texto variante="meta" cor="textoSuave">
          {r.souCondutor ? 'Você conduz agora.' : `Quem conduz: ${r.condutor.nome}`}
        </Texto>
      ) : null}
    </Cartao>
  )
}

/** O tempo que resta, enorme (papel `cronômetro` 64/68, teto 1,4), e o decorrido em letra pequena. */
function Cronometro({
  valor,
  falado,
  rotulo,
  decorrido,
}: {
  valor: string
  falado: string
  rotulo: string
  decorrido: string
}) {
  return (
    <View accessible accessibilityLabel={falado} style={{ minHeight: TIPO.cronometro.altura }}>
      <Texto variante="sobrancelha" cor="textoSuave" accessibilityRole="text">
        {rotulo}
      </Texto>
      <Texto variante="cronometro" accessibilityRole="text" adjustsFontSizeToFit numberOfLines={1}>
        {valor}
      </Texto>
      <Texto variante="meta" cor="textoSuave" tabular accessibilityRole="text">
        {decorrido}
      </Texto>
    </View>
  )
}

/** "Atraso acumulado: 4 min de atraso" (alerta) ou "No horário" (sucesso), com ícone. */
function LinhaDoAtraso({ atrasoMin, final }: { atrasoMin: number | null; final: boolean }) {
  const { cores } = useTema()
  const { fontScale } = useWindowDimensions()
  if (atrasoMin === null) return null
  const atrasado = atrasoMin > 0
  const texto = atrasado
    ? `${final ? 'Atraso final' : 'Atraso acumulado'}: ${descreverAtraso(atrasoMin)}`
    : atrasoMin === 0
      ? 'No horário'
      : `Adiantado: ${-atrasoMin} min`
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
      <Icone
        nome="relogio"
        cor={atrasado ? cores.alerta : cores.sucesso}
        tamanho={fontScale >= 1.35 ? 22 : 18}
      />
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
          ? { extra: <Chip tom="quente" texto="Agora" /> }
          : {})}
    />
  )
}

/**
 * Barra de controle fixa: o vidro da barra de ação, com botões de 56. Diz ao toast onde termina,
 * para ele aparecer acima dela (e acima do Desfazer do encerramento).
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
          gap: ESPACO.e4,
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

/** O primário da barra de controle: o botão alto (56) com `flex: 1`; o texto pode ir a duas linhas. */
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
