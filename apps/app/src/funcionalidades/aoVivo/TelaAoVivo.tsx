import { ESPACO, RAIO } from '@uj/tokens'
import { useKeepAwake } from 'expo-keep-awake'
import { useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ComandoDoAoVivo, RetratoAoVivo } from '@/servicos/contratoDosEventos'
import { ehErroDaApi, SemConexao } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import {
  falarCronometro,
  formatarCronometro,
  formatarDuracao,
  formatarHora,
} from '@/utilidades/datas'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { useAnunciar } from '@/ui/useAnunciar'

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
  NOME_DA_SITUACAO,
  type ControleDoAoVivo,
} from './tempo'
import { useAgora, useAoVivo } from './useAoVivo'

/** Rota `/evento/[eventoId]/ao-vivo`. */
export function TelaAoVivo() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha>
        <SemComunidade oQue="o ao vivo" />
      </Tela>
    )
  }
  return <AoVivo comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
}

export function AoVivo({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const { retrato, conexao, aviso, comandar } = useAoVivo(comunidadeId, eventoId)
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
        aviso={null}
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
      <Tela pilha>
        <Carregando texto="Carregando o andamento" />
      </Tela>
    )
  }
  if (retrato.error) {
    return (
      <Tela pilha>
        <AvisoDeErro erro={retrato.error} aoTentarDeNovo={() => void retrato.refetch()} />
      </Tela>
    )
  }
  return (
    <Painel
      r={retrato.data}
      conexao={conexao}
      aviso={aviso}
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

const ROTULO_DO_CONTROLE: Readonly<Record<ControleDoAoVivo, string>> = {
  iniciar: 'Iniciar',
  voltar: 'Voltar etapa',
  avancar: 'Avançar etapa',
  pausar: 'Pausar',
  retomar: 'Retomar',
  encerrar: 'Encerrar',
}

const ICONE_DO_CONTROLE: Readonly<Record<ControleDoAoVivo, NomeDoIcone>> = {
  iniciar: 'iniciar',
  voltar: 'etapaAnterior',
  avancar: 'proximaEtapa',
  pausar: 'pausar',
  retomar: 'iniciar',
  encerrar: 'encerrar',
}

interface PropsDoPainel {
  /** `recebidoEm` vem do `useAoVivo`; sem ele, usa o relógio do aparelho. */
  r: RetratoAoVivo & { recebidoEm?: number }
  /** `so_neste_aparelho`: sem conexão, comandos guardados como proposta (F13). */
  conexao: 'ao_vivo' | 'reconectando' | 'so_neste_aparelho'
  aviso: string | null
  comandar: (comando: ComandoDoAoVivo, forcar?: boolean) => void
  enviando: ComandoDoAoVivo | null
  erro: unknown
}

/**
 * Tela grande, de alto contraste (texto do tema sobre o fundo, bordas
 * grossas), para ler de longe. O cronômetro não é região viva (seria lido a
 * cada segundo); a troca de etapa, sim, é anunciada.
 */
function Painel({ r, conexao, aviso, comandar, enviando, erro }: PropsDoPainel) {
  const { cores } = useTema()
  const pode = usePode()
  const fuso = useFusoDaComunidade()
  const agora = useAgora()
  // Relógio do aparelho corrigido pelo do servidor (o que vale é o andamento compartilhado).
  const desvioMs = r.recebidoEm === undefined ? 0 : Date.parse(r.agora) - r.recebidoEm
  const t = calcularTempo(r, agora + desvioMs)
  const conduz = pode('ao_vivo', 'conduzir')
  const local = conexao === 'so_neste_aparelho'
  const outroConduz = !local && r.condutor !== null && !r.souCondutor

  // Avisa o leitor de tela quando a etapa muda (o resto da tela não é lido sozinho).
  const idAtual = t.atual?.id
  const tituloAtual = t.atual?.titulo
  useAnunciar(
    idAtual ? `Agora: ${tituloAtual}` : r.situacao === 'encerrado' ? 'Evento encerrado' : null,
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

  // Perder e recuperar a conexão muda o que a tela mostra: o leitor de tela fica sabendo.
  useAnunciar(
    conexao === 'ao_vivo'
      ? 'Conexão de volta. Atualizando em tempo real.'
      : local
        ? 'Sem conexão. Mostrando o andamento guardado neste aparelho.'
        : 'Sem conexão. Tentando de novo.',
    { soMudancas: true },
  )

  const borda = { borderWidth: 2, borderColor: cores.texto, borderRadius: RAIO.cartao }
  const estourou = t.restanteMs !== null && t.restanteMs < 0
  const atraso = r.situacao === 'nao_iniciado' ? null : t.atrasoMin

  return (
    <Tela pilha>
      {r.situacao !== 'encerrado' ? <ManterTelaAcesa /> : null}
      <View style={{ gap: ESPACO.e8 }}>
        <Texto variante="tituloTela">{r.evento.titulo}</Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          <Selo texto={NOME_DA_SITUACAO[r.situacao]} cor="texto" />
          <Selo
            texto={
              conexao === 'ao_vivo'
                ? 'Atualizando em tempo real'
                : local
                  ? 'Só neste aparelho'
                  : 'Sem conexão, tentando de novo'
            }
            cor={conexao === 'ao_vivo' ? 'sucesso' : 'alerta'}
          />
        </View>
      </View>

      {local ? (
        <Aviso tipo="alerta" titulo="Sem conexão: só neste aparelho">
          {conduz
            ? 'Os comandos ficam guardados aqui e vão como proposta quando a internet voltar. Se outra pessoa avançou no servidor, você vê as duas linhas do tempo em Pendências e escolhe qual vale.'
            : 'Este é o andamento da última sincronização. Ele volta a se atualizar quando a internet voltar.'}
        </Aviso>
      ) : null}

      {aviso ? (
        <Aviso tipo="alerta" titulo="O andamento mudou" anunciar>
          {aviso}
        </Aviso>
      ) : null}

      <View
        style={[borda, { padding: ESPACO.e20, gap: ESPACO.e12, backgroundColor: cores.superficie }]}
      >
        {r.situacao === 'nao_iniciado' ? (
          <>
            <Texto variante="rotulo">AINDA NÃO COMEÇOU</Texto>
            <Texto variante="display">Previsto para {formatarHora(r.evento.inicio, fuso)}</Texto>
            {t.atrasoParaComecarMin > 0 ? (
              <LinhaComIcone
                icone="relogio"
                texto={`${t.atrasoParaComecarMin} min além do horário previsto`}
              />
            ) : null}
          </>
        ) : r.situacao === 'encerrado' ? (
          <>
            <Texto variante="rotulo">ENCERRADO</Texto>
            <Texto variante="display">Evento encerrado</Texto>
            <LinhaComIcone
              icone="relogio"
              texto={`Atraso final: ${descreverAtraso(r.atrasoMin)}`}
            />
          </>
        ) : t.atual ? (
          <>
            <Texto variante="rotulo">
              {r.situacao === 'pausado' ? 'PAUSADO EM' : 'AGORA'} · ETAPA {t.indiceAtual + 1} DE{' '}
              {t.total}
            </Texto>
            <Texto variante="display" accessibilityRole="header">
              {t.atual.titulo}
            </Texto>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e24 }}>
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
                    ? `Passou ${falarCronometro(-(t.restanteMs ?? 0))} do previsto`
                    : `Faltam ${falarCronometro(t.restanteMs ?? 0)}`
                }
              />
            </View>
            <Texto variante="corpo">
              Previsto: {formatarDuracao(t.atual.duracaoMin)}, das{' '}
              {formatarHora(t.atual.inicioPrevisto, fuso)} às{' '}
              {formatarHora(t.atual.fimPrevisto, fuso)}.
            </Texto>
          </>
        ) : null}
        {atraso !== null ? (
          <LinhaComIcone
            icone={atraso > 0 ? 'erro' : 'confirmado'}
            texto={`Atraso acumulado: ${descreverAtraso(atraso)}`}
            cor={atraso > 0 ? 'alerta' : 'sucesso'}
          />
        ) : null}
      </View>

      {t.proxima ? (
        <View style={[borda, { padding: ESPACO.e16, gap: ESPACO.e4 }]}>
          <Texto variante="rotulo">A SEGUIR</Texto>
          <Texto variante="tituloItem">{t.proxima.titulo}</Texto>
          <Texto variante="corpo">
            {formatarDuracao(t.proxima.duracaoMin)} · prevista para{' '}
            {formatarHora(t.proxima.inicioPrevisto, fuso)}
          </Texto>
        </View>
      ) : null}

      <BarraDeProgresso
        fracao={t.total ? t.concluidas / t.total : 0}
        rotulo={`${t.concluidas} de ${t.total} etapas concluídas`}
        altura={12}
      />
      <Texto variante="corpo">
        {t.concluidas} de {t.total} etapas concluídas
      </Texto>

      {conduz ? (
        <View style={{ gap: ESPACO.e12 }}>
          <Texto variante="tituloItem">Condução</Texto>
          <Texto>
            {local
              ? 'Sem conexão: você conduz neste aparelho.'
              : r.souCondutor
                ? 'Você está conduzindo.'
                : r.condutor
                  ? `${r.condutor.nome ?? 'Outra pessoa'} está conduzindo.`
                  : 'Ninguém está conduzindo. Quem der o próximo comando passa a conduzir.'}
          </Texto>
          {erro ? <AvisoDeErro erro={erro} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e12 }}>
            {CONTROLES_POR_SITUACAO[r.situacao].map((c) => {
              const recusa = outroConduz
                ? 'Outra pessoa está conduzindo. Assuma a condução para mudar o andamento.'
                : motivoDaRecusa(r, c)
              const rotulo =
                c === 'avancar' && t.indiceAtual === t.total - 1
                  ? 'Concluir a última etapa'
                  : ROTULO_DO_CONTROLE[c]
              return (
                <Botao
                  key={c}
                  titulo={rotulo}
                  icone={ICONE_DO_CONTROLE[c]}
                  variante={
                    c === 'encerrar'
                      ? 'destrutivo'
                      : c === 'avancar' || c === 'iniciar'
                        ? 'primario'
                        : 'secundario'
                  }
                  larguraTotal={false}
                  desabilitado={recusa !== null}
                  {...(recusa ? { motivo: recusa } : {})}
                  carregando={enviando === c}
                  aoPressionar={() => void executar(c)}
                />
              )
            })}
          </View>
          {!local && !r.souCondutor && r.situacao !== 'encerrado' ? (
            <Botao
              titulo="Assumir a condução"
              icone="trocar"
              variante="secundario"
              carregando={enviando === 'assumir'}
              aoPressionar={() => void assumir()}
            />
          ) : null}
          {!local && r.souCondutor && r.situacao !== 'encerrado' ? (
            <Botao
              titulo="Liberar a condução"
              variante="terciario"
              carregando={enviando === 'liberar'}
              aoPressionar={() => comandar('liberar')}
            />
          ) : null}
        </View>
      ) : (
        <Texto variante="corpo">
          Você está acompanhando. Quem conduz o andamento é a organização.
        </Texto>
      )}

      <View style={{ gap: ESPACO.e8 }}>
        <Texto variante="tituloItem">Todas as etapas</Texto>
        {r.etapas.map((e, i) => (
          <View
            key={e.id}
            accessible
            accessibilityLabel={`Etapa ${i + 1} de ${r.etapas.length}: ${e.titulo}, ${formatarDuracao(e.duracaoMin)}, prevista às ${formatarHora(e.inicioPrevisto, fuso)}. ${e.situacao === 'concluida' ? 'Concluída' : e.situacao === 'atual' ? 'Em curso agora' : 'A seguir'}.`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ESPACO.e12,
              padding: ESPACO.e12,
              borderRadius: RAIO.controle,
              borderWidth: e.situacao === 'atual' ? 3 : 1,
              borderColor: e.situacao === 'atual' ? cores.texto : cores.campoBorda,
            }}
          >
            <Icone
              nome={
                e.situacao === 'concluida'
                  ? 'confirmado'
                  : e.situacao === 'atual'
                    ? 'aoVivo'
                    : 'pendente'
              }
              cor={cores.texto}
            />
            <View style={{ flex: 1 }}>
              <Texto variante="tituloItem">{e.titulo}</Texto>
              <Texto variante="legenda" cor="textoSuave">
                {formatarHora(e.inicioPrevisto, fuso)} · {formatarDuracao(e.duracaoMin)} ·{' '}
                {e.situacao === 'concluida'
                  ? 'Concluída'
                  : e.situacao === 'atual'
                    ? 'Agora'
                    : 'A seguir'}
              </Texto>
            </View>
          </View>
        ))}
      </View>
    </Tela>
  )
}

function Cronometro({ rotulo, valor, falado }: { rotulo: string; valor: string; falado: string }) {
  return (
    <View accessible accessibilityLabel={falado} style={{ gap: ESPACO.e4 }}>
      <Texto variante="sobrancelha" cor="textoSuave" accessibilityRole="text">
        {rotulo}
      </Texto>
      {/* Papel `cronometro` (64/68, teto 1,4): o número já é enorme e não pode sair da tela. */}
      <Texto variante="cronometro" accessibilityRole="text">
        {valor}
      </Texto>
    </View>
  )
}

function LinhaComIcone({
  icone,
  texto,
  cor = 'texto',
}: {
  icone: NomeDoIcone
  texto: string
  cor?: 'texto' | 'alerta' | 'sucesso'
}) {
  const { cores } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
      <Icone nome={icone} cor={cores[cor]} />
      <Texto variante="tituloItem" cor={cor}>
        {texto}
      </Texto>
    </View>
  )
}
