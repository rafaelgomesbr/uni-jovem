import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ehEtapaDeLouvor,
  FUNCOES_DA_BANDA,
  mesmaFuncao,
  normalizarFuncaoDaBanda,
  type FuncaoDaBanda,
} from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { api } from '@/servicos/api'
import { chamadasV3 } from '@/servicos/contratoV3'
import type {
  Atribuicao,
  DetalheDoEvento,
  EstadoDaAtribuicao,
  Etapa,
} from '@/servicos/contratoDosEventos'
import { Botao } from '@/ui/Botao'
import { Campo, CampoDeBusca } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela, MenuDeAcoes } from '@/ui/FolhaNaTela'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { mostrarToast } from '@/ui/Toast'
import { mostrarDesfazer } from '@/ui/ToastComDesfazer'
import { confirmar } from '@/utilidades/confirmar'

import { usePessoasAtivas } from '../comunidade/consultas'
import {
  esperarConvocados,
  tirarConvocadosEmEspera,
  useConvocadosEmEspera,
} from './convocadosOtimistas'
import { naComunidade, useInvalidarEventos } from './consultas'

/**
 * Convocação (D54, D69): a organização convoca, a pessoa aceita ou avisa que não pode ir. Na API
 * e no banco continua sendo "atribuição" e "escala"; só a interface fala em convocação.
 */

/** Aviso fixo dos Convocados enquanto o encontro é rascunho (membro não vê rascunho). */
export const AVISO_DE_RASCUNHO = 'Rascunho: ninguém recebe a convocação até você publicar.'

/**
 * O texto depois de convocar diz o que de fato aconteceu: só o encontro
 * publicado e futuro dispara o aviso no celular (0011 e 0023).
 */
export function textoDepoisDeConvocar(evento: Pick<DetalheDoEvento, 'status' | 'inicio'>): string {
  if (evento.status === 'rascunho') {
    return 'Salvo. A pessoa recebe a convocação quando você publicar.'
  }
  if (evento.status === 'publicado' && new Date(evento.inicio).getTime() > Date.now()) {
    return 'Convocação enviada. A resposta aparece aqui.'
  }
  return 'Convocação salva. A resposta aparece aqui.'
}

/** "1 pessoa" ou "3 pessoas". */
export function quantasPessoas(n: number): string {
  return `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`
}

const PARTES_DO_RESUMO: readonly {
  estado: EstadoDaAtribuicao
  um: string
  varios: string
}[] = [
  { estado: 'confirmada', um: 'aceitou', varios: 'aceitaram' },
  { estado: 'pendente', um: 'aguardando', varios: 'aguardando' },
  { estado: 'recusada', um: 'não pode ir', varios: 'não podem ir' },
  { estado: 'substituicao_pedida', um: 'pediu troca', varios: 'pediram troca' },
]

/**
 * "5 convocados: 3 aceitaram, 1 aguardando, 1 não pode ir". Só as partes com
 * alguém; nulo quando ninguém foi convocado.
 */
export function resumoDosConvocados(atribuicoes: readonly Pick<Atribuicao, 'estado'>[]) {
  const total = atribuicoes.length
  if (total === 0) return null
  const partes = PARTES_DO_RESUMO.map(({ estado, um, varios }) => {
    const n = atribuicoes.filter((a) => a.estado === estado).length
    return n > 0 ? `${n} ${n === 1 ? um : varios}` : null
  }).filter((p): p is string => p !== null)
  return `${total} ${total === 1 ? 'convocado' : 'convocados'}: ${partes.join(', ')}`
}

/** Quantas pessoas, sem repetir, tem a convocação (quem aceita duas partes conta uma vez). */
export function pessoasDistintas(atribuicoes: readonly Pick<Atribuicao, 'vinculoId' | 'estado'>[]) {
  return new Set(atribuicoes.filter((a) => a.estado !== 'recusada').map((a) => a.vinculoId)).size
}

type Funcao = 'responsável' | 'integrante' | 'outra'

/** Máximo de pessoas por chamada (o servidor recusa mais que isso). */
const MAXIMO_POR_LOTE = 30

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function descreverSugestao(funcao: string, vezes: number, disponivel: boolean | null): string {
  const partes = [
    vezes > 0
      ? `serviu em ${funcao.toLowerCase()} ${vezes === 1 ? '1 vez' : `${vezes} vezes`}`
      : null,
    disponivel ? 'disponível neste dia' : null,
  ].filter(Boolean)
  return partes.join(' · ')
}

/** "quem conduz" e "quem ajuda": o nome das funções padrão do encontro, como o líder as escolhe. */
export function rotuloDaFuncao(funcao: string): string {
  if (funcao === 'responsável') return 'quem conduz'
  if (funcao === 'integrante') return 'quem ajuda'
  return funcao.toLocaleLowerCase('pt-BR')
}

/** Onde a pessoa serve: o encontro inteiro ou o título da etapa. */
export function nomeDoBloco(
  etapaId: string | null,
  etapas: readonly Pick<Etapa, 'id' | 'titulo'>[],
) {
  if (etapaId === null) return 'Encontro inteiro'
  return etapas.find((e) => e.id === etapaId)?.titulo ?? 'Outra etapa'
}

/** "Encontro inteiro (quem ajuda)", "Louvor (violão)": o bloco e a função, para dizer onde já está. */
export function ondeJaEsta(
  a: Pick<Atribuicao, 'etapaId' | 'funcao'>,
  etapas: readonly Pick<Etapa, 'id' | 'titulo'>[],
): string {
  return `${nomeDoBloco(a.etapaId, etapas)} (${rotuloDaFuncao(a.funcao)})`
}

/**
 * Quem já está no bloco, em uma frase: "Na banda: Ana (violão), Bruno (bateria)." no Louvor e
 * "No encontro inteiro: Ana, Bruno." nos demais. Quem recusou não conta. Uma pessoa com duas
 * funções aparece uma vez, com as duas.
 */
export function quemJaEstaNoBloco(
  atribuicoes: readonly Pick<Atribuicao, 'etapaId' | 'funcao' | 'estado' | 'vinculoId' | 'nome'>[],
  etapaId: string | null,
  etapas: readonly Pick<Etapa, 'id' | 'titulo'>[],
): string {
  const etapa = etapas.find((e) => e.id === etapaId)
  const banda = !!etapa && ehEtapaDeLouvor(etapa.titulo)
  const bloco = banda
    ? 'na banda'
    : etapaId === null
      ? 'no encontro inteiro'
      : `em ${etapa?.titulo ?? 'esta etapa'}`
  const porPessoa = new Map<string, { nome: string; funcoes: string[] }>()
  for (const a of atribuicoes) {
    if (a.etapaId !== etapaId || a.estado === 'recusada') continue
    const atual = porPessoa.get(a.vinculoId) ?? {
      nome: a.nome.split(' ')[0] ?? a.nome,
      funcoes: [],
    }
    atual.funcoes.push(a.funcao.toLocaleLowerCase('pt-BR'))
    porPessoa.set(a.vinculoId, atual)
  }
  if (porPessoa.size === 0) return `Ninguém ${bloco} ainda.`
  const nomes = [...porPessoa.values()].map((p) =>
    banda ? `${p.nome} (${p.funcoes.join(', ')})` : p.nome,
  )
  return `${bloco.charAt(0).toLocaleUpperCase('pt-BR')}${bloco.slice(1)}: ${nomes.join(', ')}.`
}

/**
 * Folha "Convocar" (D69, seção 3.5): várias pessoas de uma vez. A função vem preenchida do bloco
 * onde o toque saiu ("Convocar" em Bateria já traz Bateria); "Sugeridas" primeiro (quem serviu
 * nessa função e quem avisou que pode neste dia, pela API de sugestões); "Todas as pessoas" com a
 * busca pelo nome. O bloqueio "Já convocado" vale só para a MESMA combinação de bloco (encontro
 * inteiro, etapa ou Louvor) e função (D73): quem já serve o encontro inteiro aparece marcável para o
 * Louvor, com "Já está em: Encontro inteiro (quem ajuda)", e a mesma pessoa pode ter duas funções na
 * banda. Quem avisou que não pode neste dia fica travado, com o motivo escrito. "Convocar 2
 * pessoas" fecha a folha, o bloco mostra as duas como "aguardando" e o aviso a elas só sai depois
 * de 10 s, com Desfazer.
 */
export function FolhaDeConvocar({
  evento,
  etapa,
  comunidadeId,
  aberta,
  aoFechar,
  funcaoInicial = null,
  escolherEtapa = false,
}: {
  evento: DetalheDoEvento
  etapa: Etapa | null
  comunidadeId: string
  aberta: boolean
  aoFechar: () => void
  /** A função do bloco de onde o toque saiu ("Bateria"). Sem ela, o primeiro passo é escolher. */
  funcaoInicial?: string | null
  /** O toque geral ("Convocar pessoas"): oferece onde servir (o encontro inteiro ou uma etapa). */
  escolherEtapa?: boolean
}) {
  const { cores } = useTema()
  const invalidar = useInvalidarEventos(comunidadeId)
  // Etapa do Louvor (D61): a função vem da lista padrão da banda, não de texto livre.
  const [etapaId, setEtapaId] = useState<string | null>(etapa?.id ?? null)
  const etapaAtual = evento.etapas.find((e) => e.id === etapaId) ?? null
  const louvor = etapaAtual !== null && ehEtapaDeLouvor(etapaAtual.titulo)
  const [funcao, setFuncao] = useState<Funcao>(() => {
    if (funcaoInicial && !(etapa !== null && ehEtapaDeLouvor(etapa.titulo))) {
      return funcaoInicial === 'responsável' || funcaoInicial === 'integrante'
        ? funcaoInicial
        : 'outra'
    }
    return etapa ? 'responsável' : 'integrante'
  })
  const [funcaoDaBanda, setFuncaoDaBanda] = useState<FuncaoDaBanda | null>(() =>
    louvor && funcaoInicial ? normalizarFuncaoDaBanda(funcaoInicial) : null,
  )
  const [outra, setOutra] = useState(() =>
    funcaoInicial && !louvor && funcao === 'outra' ? funcaoInicial : '',
  )

  function trocarEtapa(id: string | null) {
    setEtapaId(id)
    // A função da banda e a do resto são listas diferentes: recomeça pela padrão da etapa nova.
    setFuncaoDaBanda(null)
    setFuncao(id ? 'responsável' : 'integrante')
    setOutra('')
    setMarcadas([])
  }
  const [busca, setBusca] = useState('')
  const [marcadas, setMarcadas] = useState<readonly string[]>([])

  const pedeNome = louvor ? funcaoDaBanda === 'Outro' : funcao === 'outra'
  const nomeDaFuncao = pedeNome ? outra.trim() : louvor ? (funcaoDaBanda ?? '') : funcao
  const pronta = nomeDaFuncao.length >= 2
  const emEspera = useConvocadosEmEspera(evento.id)

  const pessoas = usePessoasAtivas(comunidadeId)
  const sugestoes = useQuery({
    queryKey: [
      'c',
      comunidadeId,
      'eventos',
      'sugestoes-de-convocacao',
      evento.id,
      etapaId ?? 'geral',
      nomeDaFuncao,
    ],
    queryFn: () => chamadasV3.sugestoesDeConvocacao(comunidadeId, evento.id, nomeDaFuncao, etapaId),
    enabled: aberta && pronta,
    retry: false,
  })

  // Tudo o que já existe neste encontro, com quem está na espera do Desfazer (também conta).
  const existentes = [
    ...evento.atribuicoes,
    ...emEspera.map((c) => ({
      etapaId: c.etapaId,
      vinculoId: c.vinculoId,
      funcao: c.funcao,
      estado: 'pendente' as const,
      nome: c.nome,
    })),
  ]
  // O bloqueio é só da MESMA combinação (bloco e função): estar no encontro inteiro não impede de
  // tocar no Louvor, nem tocar violão impede de cantar (D73).
  const naMesmaCombinacao = (vinculoId: string) =>
    pronta
      ? existentes.find(
          (a) =>
            a.vinculoId === vinculoId &&
            a.etapaId === etapaId &&
            mesmaFuncao(a.funcao, nomeDaFuncao),
        )
      : undefined
  const jaPelaApi = new Set(sugestoes.data?.jaConvocadas ?? [])
  const naoPodem = new Set((sugestoes.data?.indisponiveis ?? []).map((i) => i.vinculoId))
  const quemJaEsta = quemJaEstaNoBloco(existentes, etapaId, evento.etapas)
  const termo = semAcento(busca.trim())
  const passaNaBusca = (nome: string) => !termo || semAcento(nome).includes(termo)
  const sugeridas = (sugestoes.data?.sugeridas ?? []).filter((s) => passaNaBusca(s.nome))
  const todas = (pessoas.pessoas ?? []).filter((p) => passaNaBusca(p.nome))

  function alternar(vinculoId: string) {
    setMarcadas((atual) =>
      atual.includes(vinculoId)
        ? atual.filter((id) => id !== vinculoId)
        : atual.length >= MAXIMO_POR_LOTE
          ? atual
          : [...atual, vinculoId],
    )
  }

  function convocar() {
    const alvo = marcadas.flatMap((id) => {
      const p = (pessoas.pessoas ?? []).find((x) => x.vinculoId === id)
      return p ? [{ vinculoId: id, nome: p.nome, funcao: nomeDaFuncao, etapaId }] : []
    })
    if (alvo.length === 0 || !pronta) return
    const n = alvo.length
    const corpo = { funcao: nomeDaFuncao, etapaId, vinculoIds: alvo.map((a) => a.vinculoId) }
    const chaves = esperarConvocados(evento.id, alvo)

    async function enviar(chavesDaEspera: string[]) {
      try {
        await chamadasV3.convocarEmLote(comunidadeId, evento.id, corpo)
        await invalidar(evento.id)
      } catch {
        mostrarDesfazer({
          texto: 'Não deu para convocar. Ninguém foi avisado.',
          rotuloDoBotao: 'Tentar de novo',
          aoConfirmar: () => undefined,
          aoDesfazer: () => {
            // Repetir: as pessoas voltam à espera e o envio sai de novo, sem outro Desfazer.
            void enviar(esperarConvocados(evento.id, alvo))
          },
        })
      } finally {
        tirarConvocadosEmEspera(chavesDaEspera)
      }
    }

    mostrarDesfazer({
      texto: `${quantasPessoas(n)} ${n === 1 ? 'convocada' : 'convocadas'}.`,
      aoDesfazer: () => tirarConvocadosEmEspera(chaves),
      aoConfirmar: () => void enviar(chaves),
    })
    setMarcadas([])
    setBusca('')
    aoFechar()
  }

  const n = marcadas.length
  const titulo = funcaoInicial
    ? `Convocar para ${louvor ? normalizarFuncaoDaBanda(funcaoInicial) : funcaoInicial}`
    : 'Convocar pessoas'

  function linhaDaPessoa(vinculoId: string, nome: string, apoio: string) {
    const igual = naMesmaCombinacao(vinculoId)
    const outros = existentes.filter((a) => a.vinculoId === vinculoId && a !== igual)
    const travada = igual
      ? `Já convocado: ${ondeJaEsta(igual, evento.etapas)}${
          igual.estado === 'recusada' ? '. Avisou que não pode ir' : ''
        }`
      : jaPelaApi.has(vinculoId)
        ? 'Já convocado nesta função'
        : naoPodem.has(vinculoId)
          ? 'Avisou que não pode neste dia'
          : null
    // Quem já está em outro bloco ou função continua marcável, com o aviso de onde já está.
    const jaEsta =
      !travada && outros.length > 0
        ? `Já está em: ${[...new Set(outros.map((a) => ondeJaEsta(a, evento.etapas)))].join('; ')}`
        : ''
    const descricao = travada ?? ([apoio, jaEsta].filter(Boolean).join(' · ') || null)
    const marcada = marcadas.includes(vinculoId)
    return (
      <LinhaDeLista
        key={vinculoId}
        avatar={{ nome }}
        titulo={nome}
        {...(descricao ? { descricao } : {})}
        semSeta
        marcada={marcada}
        desabilitada={travada !== null}
        rotuloAcessivel={`${nome}${descricao ? `. ${descricao}` : ''}`}
        extra={
          marcada ? (
            <Icone nome="check" cor={cores.destaque} tamanho={18} peso="forte" />
          ) : undefined
        }
        aoPressionar={() => alternar(vinculoId)}
      />
    )
  }

  return (
    <FolhaNaTela aberta={aberta} titulo={titulo} aoFechar={aoFechar}>
      {escolherEtapa && evento.etapas.length > 0 ? (
        <PilulasDeFiltro
          rotulo="Onde"
          sangrar={false}
          quebrar
          pilulas={[
            { valor: 'geral', rotulo: 'Encontro inteiro' },
            ...evento.etapas.map((e) => ({ valor: e.id, rotulo: e.titulo })),
          ]}
          selecionadas={[etapaId ?? 'geral']}
          aoMudar={(v) => trocarEtapa(!v[0] || v[0] === 'geral' ? null : v[0])}
        />
      ) : null}
      {louvor ? (
        <PilulasDeFiltro
          rotulo="Função na banda"
          sangrar={false}
          quebrar
          pilulas={FUNCOES_DA_BANDA.map((f) => ({ valor: f, rotulo: f }))}
          selecionadas={funcaoDaBanda ? [funcaoDaBanda] : []}
          aoMudar={(v) => setFuncaoDaBanda(v[0] ?? null)}
        />
      ) : (
        <Segmentos
          rotulo="Função"
          valor={funcao}
          aoMudar={setFuncao}
          segmentos={[
            { valor: 'responsável', rotulo: 'Quem conduz' },
            { valor: 'integrante', rotulo: 'Quem ajuda' },
            { valor: 'outra', rotulo: 'Outra função' },
          ]}
        />
      )}
      {pedeNome ? (
        <Campo
          rotulo="Nome da função"
          value={outra}
          onChangeText={setOutra}
          exemplo={louvor ? 'Regência, percussão, backing' : 'Som, recepção, fotografia'}
          maxLength={60}
        />
      ) : null}

      <Texto variante="meta" cor="textoSuave" testID="quem-ja-esta-no-bloco">
        {quemJaEsta}
      </Texto>

      {!pronta ? (
        <Texto variante="corpo" cor="textoSuave">
          {louvor
            ? 'Escolha a função na banda para ver quem convocar.'
            : 'Diga a função para ver quem convocar.'}
        </Texto>
      ) : (
        <>
          <CampoDeBusca
            rotulo="Buscar pelo nome"
            valor={busca}
            aoMudar={setBusca}
            autoCapitalize="words"
          />
          {sugestoes.error ? (
            <AvisoDeFalha
              erro={sugestoes.error}
              titulo="Não deu para ver as sugestões"
              aoTentarDeNovo={() => void sugestoes.refetch()}
            />
          ) : null}
          {pessoas.error ? (
            <AvisoDeFalha
              erro={pessoas.error}
              titulo="As pessoas não carregaram"
              aoTentarDeNovo={() => void pessoas.refetch()}
            />
          ) : null}
          {sugeridas.length > 0 ? (
            <View style={{ gap: ESPACO.e8 }}>
              <Texto variante="tituloItem" nivel={3} accessibilityRole="header">
                Sugeridas
              </Texto>
              <CartaoDeVidro lista opaco>
                <Lista>
                  {sugeridas.map((s) =>
                    linhaDaPessoa(
                      s.vinculoId,
                      s.nome,
                      descreverSugestao(nomeDaFuncao, s.vezes, s.disponivelNoDia),
                    ),
                  )}
                </Lista>
              </CartaoDeVidro>
            </View>
          ) : null}
          <View style={{ gap: ESPACO.e8 }}>
            <Texto variante="tituloItem" nivel={3} accessibilityRole="header">
              {`Todas as pessoas (${todas.length})`}
            </Texto>
            {todas.length === 0 && !pessoas.isPending ? (
              <Texto variante="corpo" cor="textoSuave">
                Ninguém com esse nome.
              </Texto>
            ) : (
              <CartaoDeVidro lista opaco>
                <Lista>{todas.map((p) => linhaDaPessoa(p.vinculoId, p.nome, ''))}</Lista>
              </CartaoDeVidro>
            )}
          </View>
        </>
      )}

      <Botao
        titulo={
          !pronta
            ? 'Escolha a função'
            : n === 0
              ? 'Marque quem convocar'
              : `Convocar ${quantasPessoas(n)}`
        }
        tamanho="grande"
        larguraTotal
        desabilitado={!pronta || n === 0}
        aoPressionar={convocar}
      />
      <Texto variante="legenda" cor="textoSuave">
        {evento.status === 'rascunho'
          ? AVISO_DE_RASCUNHO
          : 'As pessoas só são avisadas depois de 10 segundos: dá tempo de desfazer.'}
      </Texto>
      {n >= MAXIMO_POR_LOTE ? (
        <Texto variante="legenda" cor="textoSuave">
          {`No máximo ${MAXIMO_POR_LOTE} pessoas de uma vez.`}
        </Texto>
      ) : null}
    </FolhaNaTela>
  )
}

/**
 * Menu de uma pessoa convocada (para quem convoca): "Tirar da convocação",
 * com confirmação. Aberto ao tocar na linha da pessoa.
 */
export function MenuDaPessoaConvocada({
  evento,
  comunidadeId,
  escolhida,
  aoFechar,
}: {
  evento: DetalheDoEvento
  comunidadeId: string
  escolhida: Atribuicao | null
  aoFechar: () => void
}) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const remover = useMutation({
    mutationFn: (id: string) =>
      api.delete(`${naComunidade(comunidadeId)}/eventos/${evento.id}/atribuicoes/${id}`),
    onSuccess: async () => {
      mostrarToast({ texto: 'A pessoa saiu da convocação.' })
      await invalidar(evento.id)
    },
  })

  async function pedirRemocao(a: Atribuicao) {
    const ok = await confirmar({
      titulo: `Tirar ${a.nome} da convocação?`,
      mensagem: 'A pessoa deixa de ver esta convocação entre as suas.',
      confirmar: 'Tirar da convocação',
      destrutivo: true,
    })
    if (ok) remover.mutate(a.id)
  }

  return (
    <>
      {remover.error ? <AvisoDeFalha erro={remover.error} titulo="A convocação não mudou" /> : null}
      <MenuDeAcoes
        aberto={escolhida !== null}
        titulo={escolhida?.nome ?? 'Pessoa'}
        aoFechar={aoFechar}
        acoes={
          escolhida
            ? [
                {
                  titulo: 'Tirar da convocação',
                  icone: 'excluir',
                  descricao: escolhida.funcao,
                  destrutiva: true,
                  aoPressionar: () => void pedirRemocao(escolhida),
                },
              ]
            : []
        }
      />
    </>
  )
}
