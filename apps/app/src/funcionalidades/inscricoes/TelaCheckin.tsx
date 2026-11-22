import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { EstadoDaAtribuicao, ListaDeCheckin, Presenca } from '@/servicos/contratoDosEventos'
import { SemConexao } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { BarraDeProgresso } from '@/ui/BarraDeProgresso'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { BotaoDeLinha } from '@/ui/BotaoDeLinha'
import { CampoDeBusca } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Esqueleto, LinhaDeEsqueleto } from '@/ui/Esqueleto'
import { ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { EntradaEmCascata } from '@/ui/primitivasDeMovimento'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { useAnunciar } from '@/ui/useAnunciar'
import { momentoDoEncontro } from '@/utilidades/momentoDoEncontro'
import { parametro } from '@/utilidades/parametros'

import { usePode } from '../comunidade/permissoes'
import { useEvento } from '../eventos/consultas'
import { SemComunidade } from '../navegacao/SemComunidade'
import { MENSAGEM_SEM_PREPARO } from '../offline/mensagens'
import { useOffline, usePacoteDoEvento } from '../offline/ProvedorOffline'
import { listaDeCheckinLocal } from '../offline/vistaLocal'
import {
  useDesfazerPresenca,
  useDesfazerVarias,
  useListaDeCheckin,
  useMarcarPresenca,
  useMarcarVarias,
  usePresencas,
  type AlvoDaPresenca,
  type PedidoDePresenca,
} from './consultas'
import { FolhaDoAvulso, FolhaDoCodigo } from './FolhasDoCheckin'
import { VazioComSol } from './VazioComSol'

export interface PessoaDoCheckin {
  chave: string
  nome: string
  /** A exceção escrita ("Inscrito", "Convocado", "Lista de espera"); vazio para o resto. */
  detalhe: string
  presente: boolean
  alvo: AlvoDaPresenca
  inscricaoId: string | null
  vinculoId: string | null
  /** `esperados`: convocados ou inscritos; `outras`: os demais membros da comunidade. */
  grupo: 'esperados' | 'outras'
  /** Aceitou a convocação deste encontro (é quem o "Marcar todos que aceitaram" alcança). */
  aceitou: boolean
}

/** As convocações do encontro por pessoa: de quem é esperado e de quem já aceitou. */
export type ConvocadosDoEncontro = ReadonlyMap<string, EstadoDaAtribuicao>

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Quem tem uma convocação que não foi recusada: é quem se espera ver. */
export function convocadosDe(
  atribuicoes: readonly { vinculoId: string | null; estado: EstadoDaAtribuicao }[],
): ConvocadosDoEncontro {
  const mapa = new Map<string, EstadoDaAtribuicao>()
  for (const a of atribuicoes) {
    if (!a.vinculoId || a.estado === 'recusada') continue
    // Se a pessoa tem duas funções, vale a melhor resposta (aceitou vence aguardando).
    if (mapa.get(a.vinculoId) !== 'confirmada') mapa.set(a.vinculoId, a.estado)
  }
  return mapa
}

/**
 * Inscritos e membros numa lista só, sem repetir quem é as duas coisas. Os esperados (inscritos
 * e convocados) vêm primeiro; os demais membros ficam em "Outras pessoas". Em cada grupo, ordem
 * alfabética. Só a exceção é escrita ("Inscrito", "Convocado"): "Membro sem inscrição" em 15 linhas
 * seguidas era ruído (D62).
 */
export function montarListaDeCheckin(
  lista: ListaDeCheckin,
  convocados: ConvocadosDoEncontro = new Map(),
): PessoaDoCheckin[] {
  const inscritos: PessoaDoCheckin[] = lista.inscritos.map((i) => ({
    chave: `i-${i.inscricaoId}`,
    nome: i.nome,
    detalhe: [
      i.estado === 'espera' ? 'Lista de espera' : 'Inscrito',
      i.vinculoId && convocados.has(i.vinculoId) ? 'Convocado' : null,
      i.telefone,
    ]
      .filter(Boolean)
      .join(' · '),
    presente: i.presente,
    alvo: { inscricaoId: i.inscricaoId },
    inscricaoId: i.inscricaoId,
    vinculoId: i.vinculoId,
    grupo: 'esperados',
    aceitou: i.vinculoId !== null && convocados.get(i.vinculoId) === 'confirmada',
  }))
  const jaInscritos = new Set(lista.inscritos.map((i) => i.vinculoId).filter(Boolean))
  const membros: PessoaDoCheckin[] = lista.membros
    .filter((m) => !jaInscritos.has(m.vinculoId))
    .map((m) => ({
      chave: `m-${m.vinculoId}`,
      nome: m.nome,
      detalhe: convocados.has(m.vinculoId) ? 'Convocado' : '',
      presente: m.presente,
      alvo: { vinculoId: m.vinculoId },
      inscricaoId: null,
      vinculoId: m.vinculoId,
      grupo: convocados.has(m.vinculoId) ? 'esperados' : 'outras',
      aceitou: convocados.get(m.vinculoId) === 'confirmada',
    }))
  return [...inscritos, ...membros].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function filtrarPorNome(pessoas: readonly PessoaDoCheckin[], busca: string) {
  const termo = semAcento(busca.trim())
  return termo ? pessoas.filter((p) => semAcento(p.nome).includes(termo)) : [...pessoas]
}

export function presencaDe(pessoa: PessoaDoCheckin, presencas: readonly Presenca[]) {
  return (
    presencas.find(
      (p) =>
        (pessoa.inscricaoId !== null && p.inscricaoId === pessoa.inscricaoId) ||
        (pessoa.vinculoId !== null && p.vinculoId === pessoa.vinculoId),
    ) ?? null
  )
}

const MAXIMO_SEM_BUSCA = 40

/**
 * Rota `/evento/[eventoId]/checkin`. O caminho principal não depende de câmera: buscar o nome e
 * tocar na linha de quem chegou. O QR é um atalho.
 */
export function TelaCheckin() {
  const { comunidadeAtiva } = useSessao()
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  const pode = usePode()
  if (!comunidadeAtiva || !eventoId) {
    return (
      <Tela pilha titulo="Marcar quem chegou">
        <SemComunidade oQue="o check-in" />
      </Tela>
    )
  }
  if (!pode('presenca', 'registrar')) {
    return (
      <Tela pilha titulo="Marcar quem chegou">
        <Aviso tipo="info" titulo="Só a organização registra presença">
          Na entrada, mostre o seu código para quem está fazendo o check-in.
        </Aviso>
      </Tela>
    )
  }
  return <Checkin comunidadeId={comunidadeAtiva.id} eventoId={eventoId} />
}

/**
 * Check-in no visual A (D71), feito para quem está em pé, com a fila na porta: a linha inteira
 * de 72 pt é o alvo e marca com UM toque ("Chegou" vira o chip "Presente"); tocar de novo desmarca
 * e dá Desfazer. O contador "9 de 15 presentes", a busca pelo nome, "Marcar todos que aceitaram" e
 * o QR. Sem internet funciona: a presença entra numa fila e vai quando voltar. Presença local
 * mostra Desfazer por 10 s; a resposta do servidor se confirma em segundo plano e, se falhar, a
 * linha volta ao estado de antes com o motivo escrito.
 */
function Checkin({ comunidadeId, eventoId }: { comunidadeId: string; eventoId: string }) {
  const evento = useEvento(comunidadeId, eventoId)
  const lista = useListaDeCheckin(comunidadeId, eventoId)
  const presencas = usePresencas(comunidadeId, eventoId)
  const marcar = useMarcarPresenca(comunidadeId, eventoId)
  const marcarVarias = useMarcarVarias(comunidadeId, eventoId)
  const desfazer = useDesfazerPresenca(comunidadeId, eventoId)
  const desfazerVarias = useDesfazerVarias(comunidadeId, eventoId)
  const [busca, setBusca] = useState('')
  // O que a pessoa tocou e o servidor ainda não confirmou: a linha já mostra o resultado.
  const [otimistas, setOtimistas] = useState<Readonly<Record<string, boolean>>>({})
  // Quem acabou de ser marcado: só o chip deles entra com a animação de "Presente".
  const [recentes, setRecentes] = useState<ReadonlySet<string>>(new Set())
  const [folha, setFolha] = useState<'codigo' | 'avulso' | null>(null)
  const offline = useOffline()
  const guardado = usePacoteDoEvento(eventoId).data ?? null
  const listaLocal = guardado ? listaDeCheckinLocal(guardado.pacote, offline.operacoes) : null
  const pausada = lista.isPending && lista.fetchStatus === 'paused'
  const semRede = !offline.online || pausada || lista.error instanceof SemConexao
  // Sem conexão e com o evento preparado: a lista do aparelho; a presença entra na fila.
  const usarLocal = semRede && listaLocal !== null
  const marcarLocal = useMarcarPresencaNoAparelho(eventoId, guardado?.pacote.vinculoId ?? null)

  // Quem foi marcado neste aparelho e ainda não chegou ao servidor.
  const naFila = new Set(
    offline.operacoes
      .filter(
        (o) =>
          o.tipo === 'presenca.registrar' && o.eventoId === eventoId && o.estado === 'pendente',
      )
      .flatMap((o) => {
        const d = o.dados as Partial<Record<'inscricaoId' | 'vinculoId', string>>
        return [d.inscricaoId, d.vinculoId].filter((v): v is string => !!v)
      }),
  )
  const esperando = offline.operacoes.filter(
    (o) => o.tipo === 'presenca.registrar' && o.eventoId === eventoId && o.estado === 'pendente',
  ).length

  const atribuicoes = usarLocal
    ? (guardado?.pacote.atribuicoes ?? [])
    : (evento.data?.atribuicoes ?? [])
  const convocados = convocadosDe(
    atribuicoes.map((a) => ({
      vinculoId: a.vinculoId,
      estado: a.estado as EstadoDaAtribuicao,
    })),
  )

  const dadosDaLista = usarLocal ? listaLocal : lista.data
  const base = dadosDaLista ? montarListaDeCheckin(dadosDaLista, convocados) : []
  // A pessoa já vê o que tocou, antes de o servidor responder.
  const pessoas = base.map((p) => ({ ...p, presente: otimistas[p.chave] ?? p.presente }))
  const filtradas = filtrarPorNome(pessoas, busca)
  const buscando = busca.trim().length > 0
  const visiveis = buscando ? filtradas : filtradas.slice(0, MAXIMO_SEM_BUSCA)
  const doServidor = usarLocal
    ? base.filter((p) => p.presente).length
    : (presencas.data?.total ?? base.filter((p) => p.presente).length)
  const diferenca = pessoas.filter((p, i) => p.presente !== base[i]!.presente)
  const presentes = Math.max(
    0,
    doServidor + diferenca.reduce((soma, p) => soma + (p.presente ? 1 : -1), 0),
  )
  const total = Math.max(pessoas.length, presentes)
  const falado = `${presentes} de ${total} presentes${esperando ? `, ${esperando} esperando internet` : ''}`
  // O número muda a cada marcação: o leitor de tela ouve a contagem nova.
  useAnunciar(falado, { soMudancas: true })

  const aceitaramQueFaltam = pessoas.filter((p) => p.aceitou && !p.presente)

  function marcarOtimista(chaves: readonly string[], valor: boolean) {
    setOtimistas((atual) => ({ ...atual, ...Object.fromEntries(chaves.map((c) => [c, valor])) }))
  }
  function soltar(chaves: readonly string[]) {
    setOtimistas((atual) => {
      const novo = { ...atual }
      for (const c of chaves) delete novo[c]
      return novo
    })
  }
  function lembrarRecentes(chaves: readonly string[]) {
    setRecentes((atual) => new Set([...atual, ...chaves]))
  }

  function desfazerPresenca(presencaId: string, nome: string, pessoa?: PessoaDoCheckin) {
    desfazer.mutate(
      { presencaId, nome },
      {
        onSuccess: () =>
          mostrarToast({
            texto: `Presença de ${nome} desfeita.`,
            tipo: 'info',
            ...(pessoa
              ? {
                  acao: {
                    titulo: 'Desfazer',
                    aoPressionar: () => marcarPessoa(pessoa),
                  },
                }
              : {}),
          }),
      },
    )
  }

  function falhou(pessoa: PessoaDoCheckin) {
    mostrarToast({
      texto: `Não deu para marcar ${pessoa.nome}. Toque para tentar de novo.`,
      tipo: 'erro',
      acao: { titulo: 'Tentar de novo', aoPressionar: () => marcarPessoa(pessoa) },
    })
  }

  /** Um toque: a linha vira "Presente" na hora; o servidor confirma em segundo plano. */
  function marcarPessoa(pessoa: PessoaDoCheckin) {
    if (pessoa.chave in otimistas) return
    marcarOtimista([pessoa.chave], true)
    lembrarRecentes([pessoa.chave])
    const pedido: PedidoDePresenca = { alvo: pessoa.alvo, origem: 'manual', nome: pessoa.nome }
    if (usarLocal) {
      marcarLocal.mutate(pedido, {
        onError: () => falhou(pessoa),
        onSettled: () => soltar([pessoa.chave]),
      })
      return
    }
    marcar.mutate(pedido, {
      onSuccess: (r) =>
        mostrarToast(
          r.jaRegistrada
            ? { texto: `${pessoa.nome} já estava com presença.`, tipo: 'info' }
            : {
                texto: `Presença de ${pessoa.nome} registrada.`,
                acao: {
                  titulo: 'Desfazer',
                  aoPressionar: () => desfazerPresenca(r.id, pessoa.nome),
                },
              },
        ),
      onError: () => falhou(pessoa),
      onSettled: () => soltar([pessoa.chave]),
    })
  }

  /** Tocar de novo num presente desmarca, sem diálogo, e o toast oferece Desfazer. */
  function desmarcarPessoa(pessoa: PessoaDoCheckin) {
    if (usarLocal) {
      mostrarToast({
        texto: 'Sem internet. Para desfazer uma presença, conecte-se.',
        tipo: 'info',
      })
      return
    }
    const presenca = presencaDe(pessoa, presencas.data?.presencas ?? [])
    if (!presenca) {
      mostrarToast({
        texto: `A presença de ${pessoa.nome} ainda está carregando. Toque de novo em um instante.`,
        tipo: 'info',
      })
      return
    }
    marcarOtimista([pessoa.chave], false)
    desfazer.mutate(
      { presencaId: presenca.id, nome: pessoa.nome },
      {
        onSuccess: () =>
          mostrarToast({
            texto: `Presença de ${pessoa.nome} desfeita.`,
            tipo: 'info',
            acao: { titulo: 'Desfazer', aoPressionar: () => marcarPessoa(pessoa) },
          }),
        onError: () =>
          mostrarToast({
            texto: `Não deu para desfazer a presença de ${pessoa.nome}. Toque para tentar de novo.`,
            tipo: 'erro',
            acao: { titulo: 'Tentar de novo', aoPressionar: () => desmarcarPessoa(pessoa) },
          }),
        onSettled: () => soltar([pessoa.chave]),
      },
    )
  }

  /** "Marcar todos que aceitaram": um toque para a equipe que chega junto, com Desfazer de 10 s. */
  async function marcarTodosQueAceitaram() {
    const alvos = aceitaramQueFaltam
    if (alvos.length === 0) return
    const chaves = alvos.map((p) => p.chave)
    marcarOtimista(chaves, true)
    lembrarRecentes(chaves)
    if (usarLocal) {
      for (const p of alvos) {
        await marcarLocal
          .mutateAsync({ alvo: p.alvo, origem: 'manual', nome: p.nome })
          .catch(() => falhou(p))
      }
      soltar(chaves)
      mostrarToast({
        texto: `${alvos.length} ${alvos.length === 1 ? 'presença anotada' : 'presenças anotadas'} neste aparelho. Vão quando a internet voltar.`,
      })
      return
    }
    marcarVarias.mutate(
      alvos.map((p) => ({ alvo: p.alvo, nome: p.nome })),
      {
        onSuccess: (resultados) => {
          const criadas = resultados.filter((r) => r.ok && r.id)
          const falhas = resultados.filter((r) => !r.ok)
          if (criadas.length > 0) {
            mostrarToast({
              texto: `${criadas.length} ${criadas.length === 1 ? 'presença marcada' : 'presenças marcadas'}.`,
              acao: {
                titulo: 'Desfazer',
                aoPressionar: () =>
                  desfazerVarias.mutate(
                    criadas.map((r) => r.id!),
                    {
                      onSuccess: () =>
                        mostrarToast({ texto: 'As presenças foram desfeitas.', tipo: 'info' }),
                    },
                  ),
              },
            })
          }
          if (falhas.length > 0) {
            mostrarToast({
              texto: `Não deu para marcar ${falhas.map((f) => f.nome).join(', ')}. Toque na linha para tentar de novo.`,
              tipo: 'erro',
            })
          }
        },
        onError: () =>
          mostrarToast({
            texto: 'Não deu para marcar a equipe agora. Tente de novo.',
            tipo: 'erro',
          }),
        onSettled: () => soltar(chaves),
      },
    )
  }

  function marcarPeloCodigo(codigo: string) {
    const dono = dadosDaLista?.inscritos.find((i) => i.codigo === codigo)
    const nome = dono?.nome ?? 'quem tem este código'
    const alvo: AlvoDaPresenca = { codigo }
    if (usarLocal) {
      marcarLocal.mutate(
        { alvo, origem: 'manual', nome },
        {
          onSuccess: (r) =>
            mostrarToast({
              texto:
                r.situacao === 'repetida'
                  ? `${nome} já estava anotado neste aparelho.`
                  : `Presença de ${nome} anotada neste aparelho. Vai quando a internet voltar.`,
              tipo: r.situacao === 'repetida' ? 'info' : 'sucesso',
            }),
        },
      )
      return
    }
    marcar.mutate(
      { alvo, origem: 'manual', nome },
      {
        onSuccess: (r) =>
          mostrarToast(
            r.jaRegistrada
              ? { texto: `${nome} já estava com presença.`, tipo: 'info' }
              : {
                  texto: `Presença de ${nome} registrada.`,
                  acao: { titulo: 'Desfazer', aoPressionar: () => desfazerPresenca(r.id, nome) },
                },
          ),
        onError: () =>
          mostrarToast({
            texto: 'Não deu para marcar pelo código. Confira as letras e os números.',
            tipo: 'erro',
          }),
      },
    )
  }

  function registrarAvulso(nome: string) {
    const alvo: AlvoDaPresenca = { nomeAvulso: nome }
    if (usarLocal) {
      marcarLocal.mutate(
        { alvo, origem: 'manual', nome },
        {
          onSuccess: () =>
            mostrarToast({
              texto: `Presença de ${nome} anotada neste aparelho. Vai quando a internet voltar.`,
            }),
        },
      )
      return
    }
    marcar.mutate(
      { alvo, origem: 'manual', nome },
      {
        onSuccess: (r) =>
          mostrarToast({
            texto: `Presença de ${nome} registrada.`,
            acao: { titulo: 'Desfazer', aoPressionar: () => desfazerPresenca(r.id, nome) },
          }),
        onError: () =>
          mostrarToast({ texto: `Não deu para registrar ${nome}. Tente de novo.`, tipo: 'erro' }),
      },
    )
  }

  const abrirQr = () => router.push({ pathname: '/evento/[eventoId]/ler-qr', params: { eventoId } })
  const carregando = !dadosDaLista && lista.isPending && !pausada
  const erroDaLista = !dadosDaLista && lista.error && !(lista.error instanceof SemConexao)
  const semPreparo = !dadosDaLista && semRede
  const e = evento.data
  const momento = e ? momentoDoEncontro(e.inicio, e.fuso, { duracaoMin: e.duracaoMin }) : 'dia'
  const esperados = visiveis.filter((p) => p.grupo === 'esperados')
  const outras = visiveis.filter((p) => p.grupo === 'outras')
  const totalEsperados = filtradas.filter((p) => p.grupo === 'esperados').length
  const totalOutras = filtradas.filter((p) => p.grupo === 'outras').length

  return (
    <Tela
      pilha
      momento={momento}
      titulo="Marcar quem chegou"
      {...(e ? { descricao: e.titulo } : {})}
      acoes={
        <BotaoIcone
          icone="qr"
          texto="Ler QR"
          rotulo="Ler QR"
          dica="Abre a câmera para ler o QR de entrada."
          aoPressionar={abrirQr}
        />
      }
      {...(dadosDaLista && pessoas.length > 0
        ? {
            barraDeAcao: (
              <BarraDeAcao>
                <Botao
                  titulo="Marcar todos que aceitaram"
                  tamanho="grande"
                  desabilitado={aceitaramQueFaltam.length === 0 || marcarVarias.isPending}
                  motivo={
                    pessoas.some((p) => p.aceitou)
                      ? 'Todos que aceitaram já chegaram.'
                      : 'Ninguém aceitou a convocação ainda.'
                  }
                  aoPressionar={() => void marcarTodosQueAceitaram()}
                />
              </BarraDeAcao>
            ),
          }
        : {})}
    >
      <EntradaEmCascata ordem={1}>
        <View style={{ gap: ESPACO.e8 }}>
          {carregando || (!dadosDaLista && !erroDaLista && !semPreparo) ? (
            <Texto variante="contador" accessibilityRole="text" accessibilityLabel="Carregando">
              {'-- '}
              <Texto variante="tituloItem" cor="textoSuave" accessibilityRole="text">
                de -- presentes
              </Texto>
            </Texto>
          ) : dadosDaLista ? (
            <View
              accessible
              accessibilityLabel={falado}
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                columnGap: ESPACO.e8,
              }}
            >
              <Texto variante="contador" accessibilityRole="text">
                {String(presentes)}
              </Texto>
              <Texto variante="tituloItem" accessibilityRole="text">
                {`de ${total} presentes`}
              </Texto>
              {esperando ? (
                <Texto variante="legenda" cor="textoSuave" accessibilityRole="text">
                  {`(${esperando} esperando internet)`}
                </Texto>
              ) : null}
            </View>
          ) : null}
          {dadosDaLista ? (
            // O número já está escrito acima: a barra só reforça e fica fora da leitura de voz.
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <BarraDeProgresso
                fracao={total ? presentes / total : 0}
                rotulo={`Progresso do check-in: ${presentes} de ${total}`}
                cor="primaria"
                trilho="tonal"
              />
            </View>
          ) : null}
        </View>
      </EntradaEmCascata>

      {usarLocal && listaLocal ? (
        <Aviso tipo="alerta" titulo="Sem internet">
          As presenças ficam guardadas e vão quando voltar. Desfazer uma presença exige conexão.
        </Aviso>
      ) : null}

      {dadosDaLista ? (
        <EntradaEmCascata ordem={2}>
          <View style={{ gap: ESPACO.e12 }}>
            <CampoDeBusca rotulo="Buscar pelo nome" valor={busca} aoMudar={setBusca} />
            {/* Ações do dia do encontro, todas à vista (D75): antes ficavam atrás de um "Mais". */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
              <Botao
                titulo="Chegou sem inscrição"
                icone="pessoa"
                variante="secundario"
                aoPressionar={() => setFolha('avulso')}
              />
              <Botao
                titulo="Pelo código de entrada"
                icone="qr"
                variante="secundario"
                aoPressionar={() => setFolha('codigo')}
              />
              <Botao
                titulo="Ver as inscrições"
                icone="inscricoes"
                variante="terciario"
                aoPressionar={() =>
                  router.push({ pathname: '/evento/[eventoId]/inscricoes', params: { eventoId } })
                }
              />
            </View>
          </View>
        </EntradaEmCascata>
      ) : null}

      {carregando ? (
        <Esqueleto rotulo="Carregando a lista de entrada">
          {Array.from({ length: 6 }, (_, i) => (
            <LinhaDeEsqueleto key={i} altura={72} />
          ))}
        </Esqueleto>
      ) : erroDaLista ? (
        <ErroDaTela
          erro={lista.error}
          titulo="Não deu para carregar quem foi convocado."
          aoTentarDeNovo={() => void lista.refetch()}
        />
      ) : semPreparo ? (
        <Aviso tipo="alerta" titulo="Sem internet">
          {MENSAGEM_SEM_PREPARO}
        </Aviso>
      ) : dadosDaLista && pessoas.length === 0 ? (
        <VazioComSol
          titulo="Ninguém convocado ou inscrito."
          descricao="Procure pelo nome ou leia o QR de quem chegou."
          acao={{ titulo: 'Ler QR', icone: 'qr', aoPressionar: abrirQr }}
        />
      ) : dadosDaLista && visiveis.length === 0 ? (
        <Cartao>
          <Texto variante="tituloItem">Ninguém com esse nome.</Texto>
          <Texto variante="corpo" cor="textoSuave">
            Confira a grafia ou registre quem chegou sem inscrição.
          </Texto>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
            <Botao
              titulo="Mostrar todos"
              variante="secundario"
              tamanho="medio"
              aoPressionar={() => setBusca('')}
            />
            <Botao
              titulo="Chegou sem inscrição"
              variante="terciario"
              tamanho="medio"
              aoPressionar={() => setFolha('avulso')}
            />
          </View>
        </Cartao>
      ) : dadosDaLista ? (
        <>
          {esperados.length > 0 ? (
            <EntradaEmCascata ordem={3}>
              <Secao titulo={`Convocados e inscritos (${totalEsperados})`}>
                <GrupoDePessoas
                  pessoas={esperados}
                  naFila={naFila}
                  recentes={recentes}
                  aoMarcar={marcarPessoa}
                  aoDesmarcar={desmarcarPessoa}
                />
              </Secao>
            </EntradaEmCascata>
          ) : null}
          {outras.length > 0 ? (
            <EntradaEmCascata ordem={4}>
              <Secao titulo={`Outras pessoas (${totalOutras})`}>
                <GrupoDePessoas
                  pessoas={outras}
                  naFila={naFila}
                  recentes={recentes}
                  aoMarcar={marcarPessoa}
                  aoDesmarcar={desmarcarPessoa}
                />
              </Secao>
            </EntradaEmCascata>
          ) : null}
          {!buscando && filtradas.length > MAXIMO_SEM_BUSCA ? (
            <Texto variante="legenda" cor="textoSuave">
              {`Mostrando ${MAXIMO_SEM_BUSCA} de ${filtradas.length}. Busque pelo nome para achar as demais.`}
            </Texto>
          ) : null}
        </>
      ) : null}

      <FolhaDoCodigo
        aberta={folha === 'codigo'}
        aoFechar={() => setFolha(null)}
        aoMarcar={marcarPeloCodigo}
      />
      <FolhaDoAvulso
        aberta={folha === 'avulso'}
        aoFechar={() => setFolha(null)}
        aoRegistrar={registrarAvulso}
      />
    </Tela>
  )
}

/** Um grupo de linhas de 72 pt: a linha inteira é o alvo, o "Chegou" é só o desenho do botão. */
function GrupoDePessoas({
  pessoas,
  naFila,
  recentes,
  aoMarcar,
  aoDesmarcar,
}: {
  pessoas: readonly PessoaDoCheckin[]
  naFila: ReadonlySet<string>
  recentes: ReadonlySet<string>
  aoMarcar: (p: PessoaDoCheckin) => void
  aoDesmarcar: (p: PessoaDoCheckin) => void
}) {
  return (
    <Cartao lista>
      <Lista>
        {pessoas.map((p) => {
          const esperando =
            p.presente &&
            ((p.inscricaoId !== null && naFila.has(p.inscricaoId)) ||
              (p.vinculoId !== null && naFila.has(p.vinculoId)))
          const descricao = [p.detalhe, esperando ? 'Esperando internet' : null]
            .filter(Boolean)
            .join(' · ')
          return (
            <LinhaDeLista
              key={p.chave}
              variante="checkin"
              avatar={{ nome: p.nome }}
              titulo={p.nome}
              {...(descricao ? { descricao } : {})}
              semSeta
              marcada={p.presente}
              extra={
                p.presente ? (
                  <Chip
                    situacao="aceitou"
                    texto="Presente"
                    {...(recentes.has(p.chave) ? { aparecer: 'presente' as const } : {})}
                  />
                ) : (
                  <BotaoDeLinha texto="Chegou" />
                )
              }
              rotuloAcessivel={
                p.presente
                  ? `${[p.nome, descricao].filter(Boolean).join('. ')}. Presente. Toque duas vezes para desfazer.`
                  : `${[p.nome, descricao].filter(Boolean).join('. ')}. Ainda não chegou. Toque duas vezes para marcar presença.`
              }
              aoPressionar={() => (p.presente ? aoDesmarcar(p) : aoMarcar(p))}
            />
          )
        })}
      </Lista>
    </Cartao>
  )
}

/**
 * Presença sem conexão: entra na fila deste aparelho com chave própria. A mesma pessoa marcada de
 * novo não vira outra operação (e o servidor também une).
 */
export function useMarcarPresencaNoAparelho(eventoId: string, vinculoId: string | null) {
  const offline = useOffline()
  return useMutation({
    mutationFn: ({ alvo, nome }: PedidoDePresenca) =>
      offline.registrar(
        {
          tipo: 'presenca.registrar',
          dados: { eventoId, ocorridaEm: new Date().toISOString(), ...alvo },
          eventoId,
          descricao: `Presença de ${nome}`,
          contexto: { nome },
        },
        { vinculoId },
      ),
    networkMode: 'always',
  })
}
