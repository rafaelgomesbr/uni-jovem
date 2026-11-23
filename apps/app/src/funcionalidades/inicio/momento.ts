import { ehConvocacaoDeLouvor } from '@uj/dominio'
import type { MomentoDoDia } from '@uj/tokens'

import type { MomentoDoInicio, ParteDoMomento } from '@/servicos/contratoV3'
import { formatarHora } from '@/utilidades/datas'

import { dataCurta, diaEMes, diasAte } from './quando'

/**
 * A lógica do cartão do momento (seções 3.1 e 3.2 do UX, D68), sem tela: o que o relógio, o
 * papel e a parte da pessoa decidem. Funções puras, para testar cada linha das tabelas sem
 * montar nada. Os textos que não dependem do relógio ficam nos componentes.
 */

/** O momento do dia que a `Tela` e o sol usam: o relógio do encontro, ou "fim" depois dele. */
export function momentoDoDia(m: MomentoDoInicio): MomentoDoDia {
  if (!m.evento && m.recemTerminado) return 'fim'
  switch (m.estado) {
    case 'vespera':
      return 'vespera'
    case 'no_dia':
      return 'dia'
    case 'acontecendo':
      return 'agora'
    case 'terminou':
      return 'fim'
    default:
      // Quem serviu no encontro de ontem vê o poente até 24 h depois.
      return m.recemTerminado?.euServi ? 'fim' : 'longe'
  }
}

/** "Louvor · Vocal": a etapa e a função (a convocação ao encontro todo é só a função). */
export function descreverParte(p: Pick<ParteDoMomento, 'funcao' | 'etapaTitulo'>): string {
  return p.etapaTitulo ? `${p.etapaTitulo} · ${p.funcao}` : p.funcao
}

/** "no Louvor", "em Recepção": o lugar da pessoa, para frases como "Que bom ter você no Louvor." */
export function emOnde(p: Pick<ParteDoMomento, 'funcao' | 'etapaTitulo'>): string {
  const onde = p.etapaTitulo ?? p.funcao
  const nome = onde.charAt(0).toLocaleUpperCase('pt-BR') + onde.slice(1)
  return nome === 'Louvor' ? 'no Louvor' : `em ${nome}`
}

/** A pessoa toca no louvor neste encontro (convocação de louvor confirmada)? */
export function tocaNoLouvor(
  partes: readonly Pick<ParteDoMomento, 'funcao' | 'etapaTitulo' | 'estado'>[],
): boolean {
  return partes.some(
    (p) =>
      p.estado === 'confirmada' &&
      ehConvocacaoDeLouvor({ funcao: p.funcao, etapaTitulo: p.etapaTitulo }),
  )
}

/**
 * A pessoa tem convocação de louvor neste encontro que ainda vale (a recusada não conta), aceita ou
 * não? É quem tem o "Meu repertório" (cifra, Modo palco); os demais veem a lista em leitura (D73).
 */
export function estaNoLouvor(
  partes: readonly Pick<ParteDoMomento, 'funcao' | 'etapaTitulo' | 'estado'>[],
): boolean {
  return partes.some(
    (p) =>
      p.estado !== 'recusada' &&
      ehConvocacaoDeLouvor({ funcao: p.funcao, etapaTitulo: p.etapaTitulo }),
  )
}

/** Tempo até o início em linguagem curta: "EM 3 H", "EM 40 MIN". */
function tempoCurto(minutos: number): string {
  if (minutos < 60) return `EM ${Math.max(1, Math.round(minutos))} MIN`
  return `EM ${Math.round(minutos / 60)} H`
}

/**
 * A etiqueta do alto do cartão (a primeira coisa lida): `EM 5 DIAS`, `AMANHÃ · 16:00`,
 * `HOJE · EM 3 H`, `ACONTECENDO AGORA`, `TERMINOU`. O rascunho (só a organização) ganha o
 * prefixo `RASCUNHO · `.
 */
export function etiquetaDoMomento(m: MomentoDoInicio): string {
  const evento = m.evento
  if (!evento) return m.recemTerminado ? 'TERMINOU' : 'NADA MARCADO'
  let texto: string
  switch (m.estado) {
    case 'acontecendo':
      texto = 'ACONTECENDO AGORA'
      break
    case 'terminou':
      texto = 'TERMINOU'
      break
    case 'vespera':
      texto = `AMANHÃ · ${formatarHora(evento.inicio, evento.fuso)}`
      break
    case 'no_dia':
      texto = `HOJE · ${tempoCurto(m.minutosParaInicio ?? 0)}`
      break
    default: {
      const dias = diasAte(evento.inicio, evento.fuso, new Date(m.agora))
      texto = dias <= 1 ? 'AMANHÃ' : `EM ${dias} DIAS`
    }
  }
  return evento.status === 'rascunho' ? `RASCUNHO · ${texto}` : texto
}

/**
 * Quando a cópia que a tela mostra foi salva: "hoje, 14:32" (ou "21/11, 14:32" se foi em outro
 * dia). É o que a etiqueta "Última versão" e a faixa "Sem internet" dizem. Hora do aparelho.
 */
export function quandoFoiSalva(salvaEm: number, agora: Date = new Date()): string {
  const quando = new Date(salvaEm)
  const dois = (n: number) => String(n).padStart(2, '0')
  const hora = `${dois(quando.getHours())}:${dois(quando.getMinutes())}`
  const mesmoDia =
    quando.getFullYear() === agora.getFullYear() &&
    quando.getMonth() === agora.getMonth() &&
    quando.getDate() === agora.getDate()
  return mesmoDia
    ? `hoje, ${hora}`
    : `${dois(quando.getDate())}/${dois(quando.getMonth() + 1)}, ${hora}`
}

/**
 * O agradecimento a quem serviu no encontro que acabou: "Obrigado por servir ontem.", "...hoje." ou
 * "...em Sáb., 21 nov." (não diz "ontem" quando foi hoje cedo: auditoria de 22/11/2026, achado 11).
 */
export function textoDoObrigado(
  r: { inicio: string; fuso: string },
  agora: Date = new Date(),
): string {
  const dias = diasAte(r.inicio, r.fuso, agora)
  const quando = dias === 0 ? 'hoje' : dias === -1 ? 'ontem' : `em ${diaEMes(r.inicio, r.fuso)}`
  return quando.endsWith('.') ? `Obrigado por servir ${quando}` : `Obrigado por servir ${quando}.`
}

/**
 * A faixa de cima do Início quando o encontro de ontem acaba de terminar e o cartão já mostra o
 * próximo: "O encontro de ontem terminou. 12 presentes." Diz QUAL terminou (o de hoje cedo ou o de
 * ontem) sem repetir o título: num grupo que se reúne todo sábado os dois têm o mesmo nome e "Sábado
 * terminou" ao lado de "Sábado, em 6 dias" parecia contradição (22/11/2026); e o nome do encontro
 * nunca vira texto fixo (D79: o app não existe só no sábado). Presença zerada não entra: sem check-in
 * o zero não é um fato, é só "ninguém marcou".
 */
export function textoDaDespedida(
  r: { titulo: string; inicio: string; fuso: string; presentes: number | null },
  agora: Date = new Date(),
): string {
  const dias = diasAte(r.inicio, r.fuso, agora)
  const quando =
    dias === 0 ? 'de hoje' : dias === -1 ? 'de ontem' : `de ${diaEMes(r.inicio, r.fuso)}`
  const presentes =
    r.presentes !== null && r.presentes > 0
      ? ` ${r.presentes} ${r.presentes === 1 ? 'presente' : 'presentes'}.`
      : ''
  return `O encontro ${quando} terminou.${presentes}`
}

// ------------------------------------------------------------------ o que o botão faz

/** O que o botão do cartão faz. O primário muda conforme o relógio, o papel e a parte (D68). */
export type AcaoDoMomento =
  | 'aceitar'
  | 'naoPossoIr'
  | 'aoVivo'
  | 'comoChegar'
  | 'repertorio'
  | 'inscrever'
  | 'ver'
  | 'verProximo'
  | 'publicar'
  | 'lembrar'
  | 'chamar'
  | 'convocarFuncao'
  | 'verConvocados'
  | 'checkin'
  | 'conduzir'
  | 'marcarProximo'
  | 'verResumo'

export interface AcoesDoCartao {
  primaria: AcaoDoMomento
  secundaria: AcaoDoMomento | null
}

export interface SituacaoDoMembro {
  momento: MomentoDoDia
  /** Há uma convocação deste encontro esperando resposta (a pendência vence o relógio). */
  pendente: boolean
  /** Toca no louvor com a convocação já confirmada. */
  musicoConfirmado: boolean
  /** Encontro público com inscrição aberta e a pessoa ainda não está inscrita. */
  podeSeInscrever: boolean
  /** O encontro de ontem acabou de terminar e este é o próximo. */
  depoisDeUmEncontro: boolean
  /** O encontro tem músicas no repertório: qualquer pessoa pode ver (D73). */
  temRepertorio: boolean
}

/**
 * A tabela do membro (3.1 do UX). A convocação pendente vence o relógio: o primário é
 * "Aceitar" até o dia, e no dia também. Acontecendo: "Acompanhar ao vivo". Véspera e dia:
 * "Como chegar". Longe: o músico confirmado abre o repertório, quem pode se inscrever
 * inscreve-se, o resto vê o encontro e, havendo repertório, "Ver o repertório" (D73: o repertório
 * e a banda são de toda a comunidade).
 */
export function acoesDoMembro(s: SituacaoDoMembro): AcoesDoCartao {
  if (s.pendente) return { primaria: 'aceitar', secundaria: 'naoPossoIr' }
  if (s.momento === 'agora') return { primaria: 'aoVivo', secundaria: null }
  if (s.momento === 'vespera' || s.momento === 'dia') {
    return { primaria: 'comoChegar', secundaria: 'ver' }
  }
  if (s.musicoConfirmado) return { primaria: 'repertorio', secundaria: 'ver' }
  if (s.podeSeInscrever) return { primaria: 'inscrever', secundaria: 'ver' }
  // Quem não toca e não precisa de outra coisa: o encontro e, havendo músicas, o repertório em leitura.
  const repertorio = s.temRepertorio ? ('repertorio' as const) : null
  if (s.depoisDeUmEncontro) return { primaria: 'verProximo', secundaria: repertorio }
  return { primaria: 'ver', secundaria: repertorio }
}

export interface SituacaoDoLider {
  momento: MomentoDoDia
  rascunho: boolean
  /** Quantas pessoas o lembrete alcançaria agora ("Lembrar os 2"). */
  lembraveis: number
  /** Convocados sem resposta (inclui quem já foi lembrado nas últimas 24 h). */
  pendentes: number
  /** Funções já convocadas sem ninguém que aceitou. */
  faltaFuncao: readonly string[]
  /** O repertório do encontro está vazio (sem nenhuma música). */
  semMusicas: boolean
  /** Ninguém foi convocado ainda (D79: "Chamar quem vai" vem antes do repertório). */
  semConvocados?: boolean
  /** Faltam 2 h ou menos para começar: hora do check-in. */
  naHoraDoCheckin: boolean
  /** O cartão é o do encontro que terminou há menos de 24 h. */
  terminou: boolean
  /** Nada marcado depois do encontro que terminou. */
  proximoAMarcar: boolean
  /** Não há encontro nenhum. */
  semEncontro: boolean
}

/**
 * A tabela do líder, UMA próxima ação (D75, "fácil de usar": o Início diz o que fazer agora e, ao
 * fazer, o botão passa para a seguinte). A primeira condição verdadeira vence, nesta ordem:
 *
 * 1. não há encontro, ou o último terminou e não há outro: "Marcar o próximo encontro";
 * 2. rascunho: "Publicar e avisar N pessoas" (editar é a chamada do próprio cartão, que abre o
 *    encontro já com "Dados do encontro" aberto: um caminho só, sem botão "Editar" ao lado);
 * 3. acontecendo: "Conduzir ao vivo" (e "Marcar quem chegou" ao lado);
 * 4. de 2 h antes até começar: "Marcar quem chegou" (e "Abrir ao vivo");
 * 5. ninguém foi convocado ainda: "Chamar quem vai" (D79, antes do repertório);
 * 6. falta gente responder: "Lembrar N pessoas";
 * 7. falta uma função da banda: "Convocar bateria";
 * 8. repertório vazio: "Montar o repertório";
 * 9. tudo certo: véspera e dia, "Ver quem vai"; longe, "Ver o encontro".
 *
 * O secundário é sempre um caminho, nunca uma segunda decisão: o cartão o mostra como link, exceto
 * o check-in, que durante o encontro é botão.
 */
export function acoesDoLider(s: SituacaoDoLider): AcoesDoCartao {
  if (s.semEncontro || (s.terminou && s.proximoAMarcar)) {
    return { primaria: 'marcarProximo', secundaria: s.terminou ? 'verResumo' : null }
  }
  if (s.rascunho) return { primaria: 'publicar', secundaria: null }
  if (s.momento === 'agora') return { primaria: 'conduzir', secundaria: 'checkin' }
  if (s.momento === 'dia' && s.naHoraDoCheckin) return { primaria: 'checkin', secundaria: 'aoVivo' }
  if (s.semConvocados) {
    return { primaria: 'chamar', secundaria: s.semMusicas ? 'repertorio' : 'ver' }
  }
  if (s.lembraveis > 0) return { primaria: 'lembrar', secundaria: 'verConvocados' }
  if (s.faltaFuncao.length > 0) return { primaria: 'convocarFuncao', secundaria: 'verConvocados' }
  if (s.semMusicas) return { primaria: 'repertorio', secundaria: 'verConvocados' }
  if (s.momento === 'vespera' || s.momento === 'dia') {
    return { primaria: 'verConvocados', secundaria: 'ver' }
  }
  // Longe, publicado e sem pendência: ver o encontro; havendo gente sem responder (já lembrada), a lista.
  return { primaria: 'ver', secundaria: s.pendentes > 0 ? 'verConvocados' : 'repertorio' }
}

/**
 * O cartão já tem a chamada visível "Ver o encontro" (o bloco do título é tocável): um botão "Ver o
 * encontro" ao lado dizia a mesma coisa duas vezes. Tira o botão de ver, promove o que sobrar a
 * principal e, só se não sobrar nenhum, mantém o botão e pede ao cartão que esconda a chamada.
 */
export function semVerRepetido(a: AcoesDoCartao): AcoesDoCartao & { semChamada: boolean } {
  const ehVer = (x: AcaoDoMomento | null) => x === 'ver' || x === 'verProximo'
  const secundaria = ehVer(a.secundaria) ? null : a.secundaria
  if (!ehVer(a.primaria)) return { primaria: a.primaria, secundaria, semChamada: false }
  if (secundaria) return { primaria: secundaria, secundaria: null, semChamada: false }
  return { primaria: a.primaria, secundaria: null, semChamada: true }
}

/** Uma frase do "o que falta" do cartão; `alerta` ganha o ícone de atenção (cor não é o único sinal). */
export interface FraseDoQueFalta {
  texto: string
  alerta: boolean
}

export interface EntradaDoQueFalta {
  /** Quantos foram convocados. */
  convocados: number
  /** Convocados sem resposta (inclui quem já foi lembrado). */
  pendentes: number
  /** "Faltam: Bruno e Camila", pronto; vazio se não há quem listar. */
  quemFalta: string
  /** "Você lembrou Bruno e Camila, hoje às 11:07.", pronto, logo depois de lembrar. */
  lembrou: string | null
  faltaFuncao: readonly string[]
  /** O repertório do encontro está vazio. */
  semMusicas: boolean
}

/** "Falta: bateria", "Falta: bateria, teclado": a banda que ainda não tem quem toque. */
export function textoDaFuncaoQueFalta(funcoes: readonly string[]): string {
  return `Falta: ${funcoes.map((f) => f.toLocaleLowerCase('pt-BR')).join(', ')}`
}

/**
 * O que falta resolver num encontro publicado, em no MÁXIMO 2 frases (D75): o resto do cartão fica
 * recolhido em "Ver detalhes". Ordem de importância: quem não respondeu, a função da banda sem
 * ninguém, o repertório vazio. Sem nada faltando, uma frase só de "tudo certo". "Todos responderam"
 * aparece uma vez (aqui), nunca de novo no resumo nem nos detalhes.
 */
export function frasesDoQueFalta(e: EntradaDoQueFalta): FraseDoQueFalta[] {
  const frases: FraseDoQueFalta[] = []
  if (e.convocados === 0) {
    frases.push({ texto: 'Ninguém foi convocado ainda.', alerta: false })
  } else if (e.lembrou) {
    frases.push({ texto: e.lembrou, alerta: false })
  } else if (e.pendentes === 0) {
    frases.push({ texto: 'Todos responderam ✓', alerta: false })
  } else {
    frases.push({
      texto: e.quemFalta || 'Quem falta já foi lembrado hoje.',
      alerta: false,
    })
  }
  if (e.faltaFuncao.length > 0) {
    frases.push({ texto: textoDaFuncaoQueFalta(e.faltaFuncao), alerta: true })
  }
  if (e.semMusicas) frases.push({ texto: 'O repertório está vazio.', alerta: true })
  return frases.slice(0, 2)
}

// ------------------------------------------------------------------ vários encontros no dia (D79)

/**
 * "1 de 3": a posição do encontro do cartão entre os do mesmo dia. `null` quando há um só (ou a
 * API antiga não mandou a lista): o cartão não diz nada de mais.
 */
export function posicaoNoDia(m: MomentoDoInicio): { indice: number; total: number } | null {
  const lista = m.doDia ?? []
  if (!m.evento || lista.length < 2) return null
  const indice = lista.findIndex((e) => e.id === m.evento?.id)
  return indice < 0 ? null : { indice: indice + 1, total: lista.length }
}

/**
 * O título do bloco da lista: "Hoje: 3 encontros", "Amanhã: 2 encontros" ou, mais longe, o dia
 * ("Dom., 29 de nov.: 2 encontros"). `null` com menos de 2 encontros (o cartão basta).
 */
export function tituloDoBlocoDoDia(m: MomentoDoInicio): string | null {
  const lista = m.doDia ?? []
  if (!m.evento || lista.length < 2) return null
  const dias = diasAte(m.evento.inicio, m.evento.fuso, new Date(m.agora))
  const dia =
    dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : dataCurta(m.evento.inicio, m.evento.fuso)
  return `${dia}: ${lista.length} encontros`
}

/**
 * O selo de alerta do cartão do líder (D79): no máximo UM, e só do que o botão principal NÃO diz.
 * "Montar o repertório" já diz que o repertório está vazio; "Convocar bateria" já diz que falta a
 * bateria: repetir em frase era texto demais. O que sobra, num selo pequeno.
 */
export function seloDoCartaoDoLider(e: {
  primaria: AcaoDoMomento
  faltaFuncao: readonly string[]
  semMusicas: boolean
}): string | null {
  if (e.faltaFuncao.length > 0 && e.primaria !== 'convocarFuncao') {
    return textoDaFuncaoQueFalta(e.faltaFuncao)
  }
  if (e.semMusicas && e.primaria !== 'repertorio') return 'Sem músicas'
  return null
}
