/**
 * Contrato das rotas novas da API para o app v3 (D66): tipos das respostas e uma
 * função de chamada por rota. A lista completa, com permissão, corpo e erros,
 * está em `docs/design/v3/api-v3.md`. Só tipos e chamadas: as regras moram na API
 * e em `@uj/dominio`. Datas chegam como ISO.
 *
 * Quem chama decide cache e atualização otimista; aqui não há estado. As rotas
 * que AVISAM pessoas (publicar, convocar em lote, lembrar) não têm espera nem
 * "desfazer" no servidor: o app segura a chamada por 10 s e só então a faz
 * (padrão 5.2 do documento de UX), e se for encerrado à força nada foi enviado.
 */
import { api } from './api'
import type { StatusDoEvento } from '@uj/dominio'
import type { EstadoDaAtribuicao } from './contratoDosEventos'

const daComunidade = (comunidadeId: string) => `/api/v1/c/${comunidadeId}`

// ------------------------------------------------------------ cartão do momento (GET /inicio, campo `momento`)

export type EstadoDoMomento = 'longe' | 'vespera' | 'no_dia' | 'acontecendo' | 'terminou'
export type SituacaoDaInscricaoNoMomento =
  'inscrito' | 'espera' | 'aberta' | 'fechada' | 'nao_se_aplica'

export interface LocalDoMomento {
  nome: string
  tipo: 'interno' | 'externo' | null
  /** Só locais externos têm endereço e coordenadas: sem eles, "Como chegar" abre o encontro. */
  endereco: string | null
  latitude: number | null
  longitude: number | null
  referencia: string | null
}

export interface EventoDoMomento {
  id: string
  titulo: string
  categoria: string
  inicio: string
  fim: string
  duracaoMin: number
  fuso: string
  /** `rascunho` só chega para a organização. */
  status: StatusDoEvento
  visibilidade: 'interna' | 'publica'
  local: LocalDoMomento | null
}

export interface ParteDoMomento {
  atribuicaoId: string
  funcao: string
  /** Título da etapa ("Louvor"); nulo quando a pessoa foi convocada ao encontro todo. */
  etapaTitulo: string | null
  estado: EstadoDaAtribuicao
}

export interface InscricaoDoMomento {
  situacao: SituacaoDaInscricaoNoMomento
  /** Total de inscritos: só a organização o vê; membro recebe nulo. */
  inscritos: number | null
  capacidade: number | null
}

export interface LiderDoMomento {
  convocados: number
  confirmados: number
  recusaram: number
  pendentes: number
  /** "9 de 11 responderam". */
  responderam: number
  /** Até 4 nomes de quem falta responder, com a função de cada um. */
  faltamResponder: { vinculoId: string; nome: string; funcoes: string[] }[]
  faltamResponderTotal: number
  /** "Falta: bateria": funções já convocadas sem ninguém que aceitou. */
  faltaFuncao: string[]
  /** "Louvor: 0 músicas". */
  musicas: number
  inscritos: number
  presentes: number
  /** "Lembrar os 2": quantas pessoas o lembrete alcançaria agora (sem quem já foi lembrado em 24 h). */
  lembraveis: number
  /** "Publicar e avisar 11 pessoas". */
  avisariaAoPublicar: number
}

export interface RecemTerminado {
  id: string
  titulo: string
  inicio: string
  fim: string
  fuso: string
  /** Só a organização vê a contagem; membro recebe nulo. */
  presentes: number | null
  /** A pessoa tinha parte confirmada: "Obrigado por servir ontem". */
  euServi: boolean
}

export interface MomentoDoInicio {
  agora: string
  /** O encontro que está acontecendo ou o próximo; nulo = "nada marcado". */
  evento: EventoDoMomento | null
  estado: EstadoDoMomento | null
  /** Negativo quando já começou. */
  minutosParaInicio: number | null
  /** A pendência primeiro. Vazio = a linha "Sua parte" some. */
  suaParte: ParteDoMomento[]
  inscricao: InscricaoDoMomento | null
  /** Só organização e administração. */
  lider: LiderDoMomento | null
  /** Terminou há menos de 24 h. */
  recemTerminado: RecemTerminado | null
  /** Organização: nada marcado depois do encontro do cartão. Membro: nulo. */
  proximoAMarcar: boolean | null
}

// ------------------------------------------------------------ "Igual ao último sábado"

export interface OpcaoParaCopiar {
  eventoId: string
  titulo: string
  inicio: string
  fuso: string
  duracaoMin: number
  etapas: number
  /** Pessoas ativas que seriam convocadas de novo. */
  convocados: number
  /** Músicas do repertório de origem (não vão, a menos que a pessoa peça). */
  musicas: number
  /** AAAA-MM-DD no fuso do encontro. */
  dataSugerida: string
  /** HH:MM, a mesma do encontro de origem. */
  horaSugerida: string
  inicioSugerido: string
}

export interface RespostaDeAnterioresParaCopiar {
  /** Até 3, um por título, o mais recente primeiro (o pré-marcado). */
  opcoes: OpcaoParaCopiar[]
}

export interface ConvocadoCopiado {
  atribuicaoId: string
  vinculoId: string
  nome: string
  funcao: string
  etapaTitulo: string | null
}

export interface CorpoDeCopiarEncontro {
  /** AAAA-MM-DD. Sem ela, vale a sugerida (o mesmo dia da semana, depois de hoje). */
  data?: string
  /** HH:MM. Sem ela, a do encontro de origem. */
  hora?: string
  /** "Levar as músicas também". Padrão: não. */
  incluirMusicas?: boolean
}

export interface ResumoDaCopia {
  origem: { id: string; titulo: string; inicio: string }
  etapas: number
  duracaoTotalMin: number
  checklist: number
  tarefas: number
  materiais: number
  convocados: { pessoas: number; itens: ConvocadoCopiado[] }
  /** Gente que saiu da comunidade desde o último encontro. */
  naoCopiados: number
  /** "Bruno avisou que não pode neste dia." */
  indisponiveis: { vinculoId: string; nome: string; funcao: string }[]
  musicas: { copiadas: number; naOrigem: number }
  avisariaAoPublicar: number
}

export interface RespostaDeCopiarEncontro {
  id: string
  versao: number
  status: 'rascunho'
  inicio: string
  fuso: string
  resumo: ResumoDaCopia
}

// ------------------------------------------------------------ convocar em lote e sugestões

export interface CorpoDeConvocarEmLote {
  funcao: string
  etapaId?: string | null
  /** De 1 a 30. */
  vinculoIds: string[]
}

export interface RespostaDeConvocarEmLote {
  criadas: { id: string; vinculoId: string; estado: EstadoDaAtribuicao }[]
  /** Já estavam convocadas nesta função e etapa: nada foi duplicado. */
  jaConvocadas: string[]
}

export interface SugestaoDeConvocacao {
  vinculoId: string
  nome: string
  /** Quantas vezes serviu nesta função nos últimos 12 meses. */
  vezes: number
  ultimaVez: string | null
  /** `true`: informou que pode neste dia; `false` nunca vem aqui; `null`: não informou. */
  disponivelNoDia: boolean | null
}

export interface RespostaDeSugestoes {
  funcao: string
  /** AAAA-MM-DD do encontro. */
  data: string
  sugeridas: SugestaoDeConvocacao[]
  /** Todas as pessoas que avisaram que NÃO podem neste dia ("Avisou que não pode neste dia"). */
  indisponiveis: { vinculoId: string; nome: string }[]
  jaConvocadas: string[]
}

// ------------------------------------------------------------ lembrar quem não respondeu

export interface RespostaDeLembrar {
  /** Pessoas com convocação pendente (sem quem pediu o lembrete). */
  pendentes: number
  /** Lembretes que entraram na fila agora. */
  lembradas: number
  /** Já lembradas nas últimas 24 h: esperam. */
  jaLembradas: number
}

// ------------------------------------------------------------ mural da Comunidade

export interface MuralDaComunidade {
  avisos: {
    total: number
    /** O fixado, ou o mais recente. Sem texto: ele fica em `GET /avisos/:id`. */
    destaque: { id: string; titulo: string; fixado: boolean; publicadoEm: string } | null
  }
  /** Pedidos de oração de outras pessoas, recentes (7 dias), que ela ainda não marcou. Só o número. */
  oracao: { novos: number }
  pessoas: { total: number }
  /** Só para quem decide pedidos de entrada. */
  organizacao: { pedidosDeEntrada: number } | null
}

// ------------------------------------------------------------ sino

/** Acrescentos ao item da caixa (`GET /eu/notificacoes/caixa`). */
export interface AcrescimosDoItemDaCaixa {
  /** Título real do aviso ou do encontro; nulo quando não há ou saiu do ar. Só dentro do app. */
  assunto: string | null
  /** O encontro a que a notificação se refere, para abrir "Sua parte". */
  eventoId: string | null
}

export interface NaoLidasDoSino {
  naoLidas: number
  avisos: number
  convocacoes: number
  pedidosDeEntrada: number
}

// ------------------------------------------------------------ prévia pública do código

export interface PreviaDoCodigo {
  comunidade: {
    nome: string
    cor: string
    temLogo: boolean
    pessoas: number
    /** `codigo_direto`: entra na hora; `codigo_com_aprovacao`: vira pedido. */
    modoEntrada: 'codigo_direto' | 'codigo_com_aprovacao'
    proximoEncontro: { titulo: string; inicio: string; fuso: string | null } | null
  }
}

// ------------------------------------------------------------ pacote do repertório (modo palco)

export interface ItemDoPacoteDoRepertorio {
  id: string
  ordem: number
  musicaId: string
  tomDoDia: string | null
  nota: string | null
  titulo: string
  artista: string | null
  tomOriginal: string | null
  andamentoBpm: number | null
  duracaoSeg: number | null
  link: string | null
  cifra: string | null
}

export interface PacoteDoRepertorio {
  /** Impressão digital do conteúdo; igual ao cabeçalho ETag, sem as aspas. */
  versao: string
  geradoEm: string
  /** Mesma validade do pacote do encontro (`validade_offline_dias` da comunidade). */
  validoAte: string
  validadeDias: number
  evento: { id: string; titulo: string; inicio: string; fuso: string; status: StatusDoEvento }
  minhaParte: { funcao: string; estado: EstadoDaAtribuicao }[]
  itens: ItemDoPacoteDoRepertorio[]
}

export interface PacoteInalterado {
  versao: string
  inalterado: true
}

export function pacoteMudou(r: PacoteDoRepertorio | PacoteInalterado): r is PacoteDoRepertorio {
  return !('inalterado' in r)
}

// ------------------------------------------------------------ chamadas

export const chamadasV3 = {
  /** `GET /inicio`: o cartão do momento vem no campo `momento`. */
  inicio: (comunidadeId: string) =>
    api.get<{ momento: MomentoDoInicio }>(`${daComunidade(comunidadeId)}/inicio`),

  anterioresParaCopiar: (comunidadeId: string) =>
    api.get<RespostaDeAnterioresParaCopiar>(
      `${daComunidade(comunidadeId)}/eventos/anteriores-para-copiar`,
    ),

  /** Cria um RASCUNHO. Ninguém é avisado até o encontro ser publicado. */
  copiarEncontro: (comunidadeId: string, eventoId: string, corpo: CorpoDeCopiarEncontro = {}) =>
    api.post<RespostaDeCopiarEncontro>(
      `${daComunidade(comunidadeId)}/eventos/${eventoId}/copiar`,
      corpo,
    ),

  convocarEmLote: (comunidadeId: string, eventoId: string, corpo: CorpoDeConvocarEmLote) =>
    api.post<RespostaDeConvocarEmLote>(
      `${daComunidade(comunidadeId)}/eventos/${eventoId}/atribuicoes/lote`,
      corpo,
    ),

  sugestoesDeConvocacao: (comunidadeId: string, eventoId: string, funcao: string) =>
    api.get<RespostaDeSugestoes>(
      `${daComunidade(comunidadeId)}/eventos/${eventoId}/sugestoes-de-convocacao?funcao=${encodeURIComponent(funcao)}`,
    ),

  /** "Lembrar os N". Genérico, no máximo um por pessoa e por encontro a cada 24 h. */
  lembrarPendentes: (comunidadeId: string, eventoId: string) =>
    api.post<RespostaDeLembrar>(
      `${daComunidade(comunidadeId)}/eventos/${eventoId}/lembrar-pendentes`,
    ),

  mural: (comunidadeId: string) =>
    api.get<MuralDaComunidade>(`${daComunidade(comunidadeId)}/mural`),

  naoLidasDoSino: () => api.get<NaoLidasDoSino>('/api/v1/eu/notificacoes/caixa/nao-lidas'),

  /** Pública (sem sessão): `autenticado: false`. Código inválido, trocado ou sem prévia: 404 igual. */
  previaDoCodigo: (codigo: string) =>
    api.post<PreviaDoCodigo>('/api/auth/codigo/previa', { codigo }, { autenticado: false }),

  /**
   * Pacote do repertório do encontro para usar sem internet. Com `versaoConhecida`,
   * a resposta é `{ versao, inalterado: true }` quando nada mudou (sem cifra no ar);
   * use `pacoteMudou` para separar os dois casos. 403: a pessoa não toca neste encontro.
   */
  pacoteDoRepertorio: (comunidadeId: string, eventoId: string, versaoConhecida?: string) =>
    api.get<PacoteDoRepertorio | PacoteInalterado>(
      `${daComunidade(comunidadeId)}/eventos/${eventoId}/repertorio/pacote${
        versaoConhecida ? `?versao=${encodeURIComponent(versaoConhecida)}` : ''
      }`,
    ),
}
