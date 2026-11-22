import { useQuery } from '@tanstack/react-query'
import {
  ehEtapaDeLouvor,
  ehFuncaoDaBanda,
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
import { ehErroDaApi } from '@/servicos/erros'
import { Botao } from '@/ui/Botao'
import { Campo, CampoDeBusca } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { AvisoDeFalha } from '@/ui/Falha'
import { FolhaNaTela } from '@/ui/FolhaNaTela'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { PilulasDeFiltro } from '@/ui/PilulasDeFiltro'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { mostrarToast } from '@/ui/Toast'
import { frasePraDesfazer, mostrarDesfazer, useSegundosDoDesfazer } from '@/ui/ToastComDesfazer'

import { usePessoasAtivas } from '../comunidade/consultas'
import {
  devolverRemovidas,
  esperarConvocados,
  esperarRemocao,
  tirarConvocadosEmEspera,
  useConvocadosEmEspera,
  useRemovidasEmEspera,
} from './convocadosOtimistas'
import { naComunidade, useInvalidarEventos } from './consultas'
import {
  jaTemNaFuncao,
  primeiroNome,
  rotuloDoPapel,
  type PapelDaPessoa,
  type PessoaNaLista,
} from './listaDeQuemVai'

/**
 * Convocação (D54, D69, D74): a organização convoca, a pessoa aceita ou avisa que não pode ir. Na
 * API e no banco continua sendo "atribuição" e "escala"; só a interface fala em convocação.
 */

/** Aviso fixo do Quem vai enquanto o encontro é rascunho (membro não vê rascunho). */
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

// ------------------------------------------------------------------ o papel

type FuncaoDaEquipe = 'responsável' | 'integrante' | 'outra'

/** O que a pessoa vai fazer: uma função da banda ou uma da equipe (D74: o app descobre "onde"). */
export type Papel =
  { tipo: 'banda'; funcao: FuncaoDaBanda } | { tipo: 'equipe'; funcao: FuncaoDaEquipe }

const PAPEIS_DA_EQUIPE: readonly { valor: FuncaoDaEquipe; rotulo: string }[] = [
  { valor: 'responsável', rotulo: 'Quem conduz' },
  { valor: 'integrante', rotulo: 'Quem ajuda' },
  { valor: 'outra', rotulo: 'Outra função' },
]

function papelInicial(
  funcaoInicial: string | null,
  etapa: Pick<Etapa, 'titulo'> | null,
): { papel: Papel | null; outra: string } {
  const noLouvor = etapa !== null && ehEtapaDeLouvor(etapa.titulo)
  if (funcaoInicial) {
    if (noLouvor || ehFuncaoDaBanda(funcaoInicial)) {
      const funcao = normalizarFuncaoDaBanda(funcaoInicial)
      return {
        papel: { tipo: 'banda', funcao },
        outra: funcao === 'Outro' ? funcaoInicial : '',
      }
    }
    if (funcaoInicial === 'responsável' || funcaoInicial === 'integrante') {
      return { papel: { tipo: 'equipe', funcao: funcaoInicial }, outra: '' }
    }
    return { papel: { tipo: 'equipe', funcao: 'outra' }, outra: funcaoInicial }
  }
  if (noLouvor) return { papel: null, outra: '' }
  return { papel: { tipo: 'equipe', funcao: etapa ? 'responsável' : 'integrante' }, outra: '' }
}

/** O nome do papel como a API o guarda (a função da banda é a da lista padrão). */
function nomeDoPapel(papel: Papel | null, outra: string): string {
  if (!papel) return ''
  if (papel.tipo === 'banda') return papel.funcao === 'Outro' ? outra.trim() : papel.funcao
  return papel.funcao === 'outra' ? outra.trim() : papel.funcao
}

/** Como o papel aparece nos títulos: "Violão", "ajudar", "Som da igreja". */
function papelEmPalavras(papel: Papel, nome: string): string {
  if (papel.tipo === 'equipe' && papel.funcao === 'responsável') return 'conduzir'
  if (papel.tipo === 'equipe' && papel.funcao === 'integrante') return 'ajudar'
  return nome
}

/** O encontro já saiu do rascunho e ainda vai acontecer: convocar avisa a pessoa. */
function avisaAoConvocar(evento: Pick<DetalheDoEvento, 'status' | 'inicio'>): boolean {
  return evento.status === 'publicado' && new Date(evento.inicio).getTime() > Date.now()
}

/** Para onde a convocação vai, em uma expressão: "o Louvor", "o encontro", "Boas-vindas". */
function destinoDaConvocacao(
  papel: Papel | null,
  etapaId: string | null,
  etapas: readonly Pick<Etapa, 'id' | 'titulo'>[],
): string {
  const etapa = etapas.find((e) => e.id === etapaId)
  if (papel?.tipo === 'banda') return 'o Louvor'
  return etapa ? etapa.titulo : 'o encontro'
}

/**
 * Folha "Convocar" (D69, D73, D74). Dois passos numa tela só: o que a pessoa vai fazer (o título
 * muda com a escolha: "Convocar para Violão") e quem. O app descobre sozinho onde o papel mora (a
 * banda vai para a etapa do Louvor; o resto, para o encontro, ou para a etapa de onde a folha foi
 * aberta). Cada pessoa aparece UMA vez ("Sugeridas" primeiro, depois as outras). Trocar o papel
 * limpa as marcações: nada vaza de um papel para o outro. O bloqueio vale só para a MESMA combinação
 * de etapa e função, e diz o motivo; função que já tem gente explica ("Bateria: já tem Bruno.") em
 * vez de esconder o caminho. "Convocar 2 pessoas para o Louvor" diz o que acontece: o rascunho não
 * avisa ninguém; o publicado avisa depois da contagem do Desfazer, e o envio sai também se a
 * pessoa sair da tela ou do app (D74).
 */
export function FolhaDeConvocar({
  evento,
  etapa,
  comunidadeId,
  aberta,
  aoFechar,
  funcaoInicial = null,
  semPapelInicial = false,
}: {
  evento: DetalheDoEvento
  /** A etapa fixa (a tela da etapa). Sem ela, o app descobre pelo papel. */
  etapa: Etapa | null
  comunidadeId: string
  aberta: boolean
  aoFechar: () => void
  /** O papel de onde o toque saiu ("Bateria"). Sem ele, a folha abre em "Quem ajuda". */
  funcaoInicial?: string | null
  /** Abre sem nenhum papel escolhido: quem convoca diz qual (a banda, por exemplo). */
  semPapelInicial?: boolean
}) {
  const { cores } = useTema()
  const invalidar = useInvalidarEventos(comunidadeId)
  const segundos = useSegundosDoDesfazer()
  const inicio = semPapelInicial ? { papel: null, outra: '' } : papelInicial(funcaoInicial, etapa)
  const [papel, setPapel] = useState<Papel | null>(inicio.papel)
  const [outra, setOutra] = useState(inicio.outra)
  const [busca, setBusca] = useState('')
  const [marcadas, setMarcadas] = useState<readonly string[]>([])

  const noLouvor = etapa !== null && ehEtapaDeLouvor(etapa.titulo)
  const mostraEquipe = !noLouvor
  const mostraBanda = etapa === null || noLouvor
  const louvor = evento.etapas.find((e) => ehEtapaDeLouvor(e.titulo)) ?? null
  // A banda mora na etapa do Louvor (ou no encontro inteiro, se não houver); o resto, onde a folha abriu.
  const etapaId = etapa ? etapa.id : papel?.tipo === 'banda' ? (louvor?.id ?? null) : null

  const pedeNome = papel !== null && papel.funcao === (papel.tipo === 'banda' ? 'Outro' : 'outra')
  const nomeDaFuncao = nomeDoPapel(papel, outra)
  const pronta = nomeDaFuncao.length >= 2
  const emEspera = useConvocadosEmEspera(evento.id)
  const removidas = useRemovidasEmEspera()

  function escolherPapel(novo: Papel) {
    setPapel(novo)
    setOutra('')
    // Quem estava marcado para o papel anterior não vem junto: a marcação é deste papel.
    setMarcadas([])
  }

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
    ...evento.atribuicoes.filter((a) => !removidas.has(a.id)),
    ...emEspera.map((c) => ({
      id: c.chave,
      etapaId: c.etapaId,
      vinculoId: c.vinculoId,
      funcao: c.funcao,
      estado: 'pendente' as const,
      nome: c.nome,
    })),
  ]
  // O bloqueio é só da MESMA combinação (etapa e função): estar no encontro inteiro não impede de
  // tocar no Louvor, nem tocar violão impede de cantar (D73).
  const naMesmaFuncao = (a: (typeof existentes)[number]) =>
    pronta && a.etapaId === etapaId && mesmaFuncao(a.funcao, nomeDaFuncao)
  const jaPelaApi = new Set(sugestoes.data?.jaConvocadas ?? [])
  const naoPodem = new Set((sugestoes.data?.indisponiveis ?? []).map((i) => i.vinculoId))
  const quemTem = [
    ...new Set(
      existentes
        .filter((a) => naMesmaFuncao(a) && a.estado !== 'recusada')
        .map((a) => primeiroNome(a.nome)),
    ),
  ]
  const rotuloDoPapelEscolhido = pronta
    ? rotuloDoPapel({ funcao: nomeDaFuncao, etapaId }, evento.etapas)
    : ''
  const jaTem = pronta ? jaTemNaFuncao(rotuloDoPapelEscolhido, quemTem) : null

  const termo = semAcento(busca.trim())
  const passaNaBusca = (nome: string) => !termo || semAcento(nome).includes(termo)
  const sugeridas = (sugestoes.data?.sugeridas ?? []).filter((s) => passaNaBusca(s.nome))
  const idsDasSugeridas = new Set(sugeridas.map((s) => s.vinculoId))
  // Cada pessoa aparece UMA vez: quem já está em "Sugeridas" não se repete nas outras.
  const outras = (pessoas.pessoas ?? []).filter(
    (p) => passaNaBusca(p.nome) && !idsDasSugeridas.has(p.vinculoId),
  )

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
    if (!papel) return
    const alvo = marcadas.flatMap((id) => {
      const p = (pessoas.pessoas ?? []).find((x) => x.vinculoId === id)
      return p ? [{ vinculoId: id, nome: p.nome, funcao: nomeDaFuncao, etapaId }] : []
    })
    if (alvo.length === 0 || !pronta) return
    const n = alvo.length
    const corpo = { funcao: nomeDaFuncao, etapaId, vinculoIds: alvo.map((a) => a.vinculoId) }
    const emPalavras = papelEmPalavras(papel, nomeDaFuncao)
    const avisa = avisaAoConvocar(evento)
    let chaves = esperarConvocados(evento.id, alvo)

    // Sai ao fim da contagem, ao sair da tela ou do app, e de novo se a rede falhar (D74).
    async function enviar() {
      if (chaves.length === 0) chaves = esperarConvocados(evento.id, alvo)
      await chamadasV3.convocarEmLote(comunidadeId, evento.id, corpo)
      await invalidar(evento.id)
      tirarConvocadosEmEspera(chaves)
      chaves = []
      const quem = n === 1 ? primeiroNome(alvo[0]!.nome) : quantasPessoas(n)
      mostrarToast({
        texto: avisa
          ? `Pronto. ${quem} ${n === 1 ? 'foi' : 'foram'} convocad${n === 1 ? 'a' : 'as'} para ${emPalavras} e ${n === 1 ? 'recebeu o aviso' : 'receberam o aviso'}.`
          : `Salvo. Ninguém foi avisado ainda: ${quem} ${n === 1 ? 'recebe' : 'recebem'} a convocação quando você publicar.`,
      })
    }

    mostrarDesfazer({
      texto: `Convocando ${quantasPessoas(n)} para ${emPalavras}.`,
      textoDaFalha: `Não deu para convocar para ${emPalavras}. Ninguém foi avisado. Toque em Tentar de novo.`,
      aoDesfazer: () => {
        tirarConvocadosEmEspera(chaves)
        chaves = []
      },
      aoFalhar: () => {
        tirarConvocadosEmEspera(chaves)
        chaves = []
      },
      aoConfirmar: enviar,
    })
    setMarcadas([])
    setBusca('')
    aoFechar()
  }

  const n = marcadas.length
  const titulo =
    papel && pronta ? `Convocar para ${papelEmPalavras(papel, nomeDaFuncao)}` : 'Convocar pessoas'
  const destino = destinoDaConvocacao(papel, etapaId, evento.etapas)

  function linhaDaPessoa(vinculoId: string, nome: string, apoio: string) {
    const igual = existentes.find((a) => a.vinculoId === vinculoId && naMesmaFuncao(a))
    const outros = existentes.filter((a) => a.vinculoId === vinculoId && a !== igual)
    const travada = igual
      ? `Já está como ${rotuloDoPapel(igual, evento.etapas)}${
          igual.estado === 'recusada' ? '. Avisou que não pode ir' : ''
        }`
      : jaPelaApi.has(vinculoId)
        ? 'Já está nesta função'
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

  const botao = !papel
    ? 'Escolha o que a pessoa vai fazer'
    : !pronta
      ? 'Diga a função'
      : n === 0
        ? 'Marque quem convocar'
        : `Convocar ${quantasPessoas(n)} para ${destino}`
  const legenda =
    evento.status === 'rascunho'
      ? AVISO_DE_RASCUNHO
      : avisaAoConvocar(evento)
        ? `${n === 1 ? 'A pessoa será avisada' : 'Elas serão avisadas'} depois da contagem. ${frasePraDesfazer(segundos)}`
        : 'Este encontro já passou ou não está no ar: a convocação fica salva, sem aviso.'

  return (
    <FolhaNaTela aberta={aberta} titulo={titulo} aoFechar={aoFechar}>
      <Texto variante="tituloItem" nivel={3} accessibilityRole="header">
        O que a pessoa vai fazer
      </Texto>
      {mostraEquipe ? (
        <View style={{ gap: ESPACO.e8 }}>
          <Texto variante="meta" cor="textoSuave">
            Na equipe
          </Texto>
          <PilulasDeFiltro
            rotulo="Função na equipe"
            sangrar={false}
            quebrar
            pilulas={PAPEIS_DA_EQUIPE.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))}
            selecionadas={papel?.tipo === 'equipe' ? [papel.funcao] : []}
            aoMudar={(v) => v[0] && escolherPapel({ tipo: 'equipe', funcao: v[0] })}
          />
        </View>
      ) : null}
      {mostraBanda ? (
        <View style={{ gap: ESPACO.e8 }}>
          <Texto variante="meta" cor="textoSuave">
            Na banda
          </Texto>
          <PilulasDeFiltro
            rotulo="Função na banda"
            sangrar={false}
            quebrar
            pilulas={FUNCOES_DA_BANDA.map((f) => ({ valor: f, rotulo: f }))}
            selecionadas={papel?.tipo === 'banda' ? [papel.funcao] : []}
            aoMudar={(v) => v[0] && escolherPapel({ tipo: 'banda', funcao: v[0] })}
          />
        </View>
      ) : null}
      {pedeNome ? (
        <Campo
          rotulo="Nome da função"
          value={outra}
          onChangeText={setOutra}
          exemplo={
            papel?.tipo === 'banda' ? 'Regência, percussão, backing' : 'Som, recepção, fotografia'
          }
          maxLength={60}
        />
      ) : null}

      {jaTem ? (
        <Texto variante="meta" cor="textoSuave" testID="ja-tem-na-funcao">
          {jaTem}
        </Texto>
      ) : null}

      {!pronta ? (
        <Texto variante="corpo" cor="textoSuave">
          {papel
            ? 'Diga a função para ver quem convocar.'
            : 'Escolha o que a pessoa vai fazer para ver quem convocar.'}
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
              {`${sugeridas.length > 0 ? 'Outras pessoas' : 'Todas as pessoas'} (${outras.length})`}
            </Texto>
            {outras.length === 0 && !pessoas.isPending ? (
              <Texto variante="corpo" cor="textoSuave">
                {termo ? 'Ninguém com esse nome.' : 'Não há mais ninguém para escolher.'}
              </Texto>
            ) : (
              <CartaoDeVidro lista opaco>
                <Lista>{outras.map((p) => linhaDaPessoa(p.vinculoId, p.nome, ''))}</Lista>
              </CartaoDeVidro>
            )}
          </View>
        </>
      )}

      <Botao
        titulo={botao}
        tamanho="grande"
        larguraTotal
        desabilitado={!pronta || n === 0}
        aoPressionar={convocar}
      />
      <Texto variante="legenda" cor="textoSuave">
        {legenda}
      </Texto>
      {n >= MAXIMO_POR_LOTE ? (
        <Texto variante="legenda" cor="textoSuave">
          {`No máximo ${MAXIMO_POR_LOTE} pessoas de uma vez.`}
        </Texto>
      ) : null}
    </FolhaNaTela>
  )
}

// ------------------------------------------------------------------ tirar da convocação

/**
 * "Tirar" da convocação, sem diálogo (D74): a pessoa some da lista na hora, a faixa diz quem saiu e
 * tem Desfazer, e o servidor só é chamado ao fim da contagem (ou antes, se a pessoa sair da tela ou
 * do app). Falhou: ela volta à lista e a faixa oferece "Tentar de novo".
 */
export function useTirarDaConvocacao(evento: DetalheDoEvento, comunidadeId: string) {
  const invalidar = useInvalidarEventos(comunidadeId)

  /** Tira os papéis dados (só os que o servidor já conhece). */
  function tirar(pessoa: Pick<PessoaNaLista, 'nome'>, papeis: readonly PapelDaPessoa[]) {
    const ids = papeis.filter((p) => !p.emEspera).map((p) => p.id)
    if (ids.length === 0) return
    esperarRemocao(ids)
    const nome = primeiroNome(pessoa.nome)
    mostrarDesfazer({
      texto:
        papeis.length === 1
          ? `${nome} saiu da convocação: ${papeis[0]!.rotulo}.`
          : `${nome} saiu da convocação.`,
      textoDaFalha: `Não deu para tirar ${nome}. A pessoa continua na lista. Toque em Tentar de novo.`,
      aoDesfazer: () => devolverRemovidas(ids),
      aoFalhar: () => devolverRemovidas(ids),
      aoConfirmar: async () => {
        esperarRemocao(ids)
        await Promise.all(
          ids.map((id) =>
            api
              .delete(`${naComunidade(comunidadeId)}/eventos/${evento.id}/atribuicoes/${id}`)
              // Já tinha saído (por outra pessoa ou por outro aparelho): o resultado é o mesmo.
              .catch((erro: unknown) => {
                if (!(ehErroDaApi(erro) && erro.status === 404)) throw erro
              }),
          ),
        )
        await invalidar(evento.id)
        devolverRemovidas(ids)
      },
    })
  }

  return tirar
}
