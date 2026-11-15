import { ESPACO, RAIO, TIPO } from '@uj/tokens'
import { useKeepAwake } from 'expo-keep-awake'
import { useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { AccessibilityInfo, View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ComandoDoAoVivo, RetratoAoVivo } from '@/servicos/contratoDosEventos'
import { ehErroDaApi } from '@/servicos/erros'
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

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { SemComunidade } from '../navegacao/SemComunidade'
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
      <Tela cabecalhoNativo>
        <SemComunidade oQue="o ao vivo" />
      </Tela>
    )
  }
  return <AoVivo comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
}

export function AoVivo({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const { retrato, conexao, aviso, comandar } = useAoVivo(comunidadeId, eventoId)
  if (retrato.isPending) {
    return (
      <Tela cabecalhoNativo>
        <Carregando texto="Carregando o andamento" />
      </Tela>
    )
  }
  if (retrato.error) {
    return (
      <Tela cabecalhoNativo>
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
  conexao: 'ao_vivo' | 'reconectando'
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
  const outroConduz = r.condutor !== null && !r.souCondutor

  // Avisa o leitor de tela quando a etapa muda (o resto da tela não é lido sozinho).
  const idAtual = t.atual?.id
  const tituloAtual = t.atual?.titulo
  useEffect(() => {
    if (idAtual) AccessibilityInfo.announceForAccessibility(`Agora: ${tituloAtual}`)
    else if (r.situacao === 'encerrado')
      AccessibilityInfo.announceForAccessibility('Evento encerrado')
  }, [idAtual, tituloAtual, r.situacao])

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

  const borda = { borderWidth: 2, borderColor: cores.texto, borderRadius: RAIO.grande }
  const estourou = t.restanteMs !== null && t.restanteMs < 0
  const atraso = r.situacao === 'nao_iniciado' ? null : t.atrasoMin

  return (
    <Tela cabecalhoNativo>
      {r.situacao !== 'encerrado' ? <ManterTelaAcesa /> : null}
      <View style={{ gap: ESPACO.x2 }}>
        <Texto variante="titulo">{r.evento.titulo}</Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
          <Selo texto={NOME_DA_SITUACAO[r.situacao]} cor="texto" />
          <Selo
            texto={
              conexao === 'ao_vivo' ? 'Atualizando em tempo real' : 'Sem conexão, tentando de novo'
            }
            cor={conexao === 'ao_vivo' ? 'sucesso' : 'alerta'}
          />
        </View>
      </View>

      {aviso ? (
        <Aviso tipo="alerta" titulo="O andamento mudou" anunciar>
          {aviso}
        </Aviso>
      ) : null}

      <View
        style={[borda, { padding: ESPACO.x5, gap: ESPACO.x3, backgroundColor: cores.superficie }]}
      >
        {r.situacao === 'nao_iniciado' ? (
          <>
            <Texto variante="rotulo">AINDA NÃO COMEÇOU</Texto>
            <Texto variante="tituloGrande">
              Previsto para {formatarHora(r.evento.inicio, fuso)}
            </Texto>
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
            <Texto variante="tituloGrande">Evento encerrado</Texto>
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
            <Texto variante="tituloGrande" accessibilityRole="header">
              {t.atual.titulo}
            </Texto>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x6 }}>
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
            <Texto variante="apoio">
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
        <View style={[borda, { padding: ESPACO.x4, gap: ESPACO.x1 }]}>
          <Texto variante="rotulo">A SEGUIR</Texto>
          <Texto variante="subtitulo">{t.proxima.titulo}</Texto>
          <Texto variante="apoio">
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
      <Texto variante="apoio">
        {t.concluidas} de {t.total} etapas concluídas
      </Texto>

      {conduz ? (
        <View style={{ gap: ESPACO.x3 }}>
          <Texto variante="subtitulo">Condução</Texto>
          <Texto>
            {r.souCondutor
              ? 'Você está conduzindo.'
              : r.condutor
                ? `${r.condutor.nome ?? 'Outra pessoa'} está conduzindo.`
                : 'Ninguém está conduzindo. Quem der o próximo comando passa a conduzir.'}
          </Texto>
          {erro ? <AvisoDeErro erro={erro} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x3 }}>
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
                      ? 'perigo'
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
          {!r.souCondutor && r.situacao !== 'encerrado' ? (
            <Botao
              titulo="Assumir a condução"
              icone="trocar"
              variante="secundario"
              carregando={enviando === 'assumir'}
              aoPressionar={() => void assumir()}
            />
          ) : null}
          {r.souCondutor && r.situacao !== 'encerrado' ? (
            <Botao
              titulo="Liberar a condução"
              variante="discreto"
              carregando={enviando === 'liberar'}
              aoPressionar={() => comandar('liberar')}
            />
          ) : null}
        </View>
      ) : (
        <Texto variante="apoio">
          Você está acompanhando. Quem conduz o andamento é a organização.
        </Texto>
      )}

      <View style={{ gap: ESPACO.x2 }}>
        <Texto variante="subtitulo">Todas as etapas</Texto>
        {r.etapas.map((e, i) => (
          <View
            key={e.id}
            accessible
            accessibilityLabel={`Etapa ${i + 1} de ${r.etapas.length}: ${e.titulo}, ${formatarDuracao(e.duracaoMin)}, prevista às ${formatarHora(e.inicioPrevisto, fuso)}. ${e.situacao === 'concluida' ? 'Concluída' : e.situacao === 'atual' ? 'Em curso agora' : 'A seguir'}.`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ESPACO.x3,
              padding: ESPACO.x3,
              borderRadius: RAIO.medio,
              borderWidth: e.situacao === 'atual' ? 3 : 1,
              borderColor: e.situacao === 'atual' ? cores.texto : cores.borda,
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
              <Texto variante="corpoForte">{e.titulo}</Texto>
              <Texto variante="apoio" cor="textoSuave">
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
    <View accessible accessibilityLabel={falado} style={{ gap: ESPACO.x1 }}>
      <Texto variante="rotulo">{rotulo.toUpperCase()}</Texto>
      <Texto
        variante="tituloGrande"
        style={{
          fontSize: TIPO.tituloGrande.tamanho * 1.6,
          lineHeight: TIPO.tituloGrande.altura * 1.6,
          fontVariant: ['tabular-nums'],
        }}
      >
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x2 }}>
      <Icone nome={icone} cor={cores[cor]} />
      <Texto variante="corpoForte" cor={cor}>
        {texto}
      </Texto>
    </View>
  )
}
