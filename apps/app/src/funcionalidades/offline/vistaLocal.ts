/**
 * Como a tela mostra um evento sem conexão: o pacote preparado mais as
 * alterações ainda não enviadas (marcadas "pendente"). Funções puras, para
 * testar sem tela.
 */
import { aplicarComando, atrasoEmMinutos, calcularHorarios, type EstadoAoVivo } from '@uj/dominio'

import type {
  DetalheDoEvento,
  EstadoDaAtribuicao,
  ListaDeCheckin,
  RetratoAoVivo,
} from '@/servicos/contratoDosEventos'

import type { AlvoDaPresencaOffline, ComandoProposto, OperacaoNaFila, PacoteOffline } from './tipos'

/** O que as seções do evento precisam saber quando mostram a cópia local. */
export interface ModoLocal {
  /** Vínculo da pessoa (do pacote), para saber o que é "meu". */
  eu: string | null
  pendentes: ReadonlySet<string>
}

export interface VistaLocal {
  evento: DetalheDoEvento
  /** Ids de tarefas e itens com alteração ainda neste aparelho. */
  pendentes: ReadonlySet<string>
}

/** O pacote no formato do detalhe, com as alterações locais por cima. */
export function vistaDoPacote(p: PacoteOffline, fila: readonly OperacaoNaFila[]): VistaLocal {
  const pendentes = new Set<string>()
  const tarefas = new Map<string, string | null>()
  const itens = new Map<string, string | null>()
  for (const op of fila) {
    if (op.estado !== 'pendente') continue
    if (op.tipo === 'tarefa.concluir') {
      tarefas.set(op.dados.tarefaId, op.dados.concluida ? op.criadaEm : null)
      pendentes.add(op.dados.tarefaId)
    } else if (op.tipo === 'checklist.marcar') {
      itens.set(op.dados.itemId, op.dados.marcado ? op.criadaEm : null)
      pendentes.add(op.dados.itemId)
    }
  }
  const horarios = calcularHorarios(new Date(p.evento.inicio), p.etapas)
  const evento: DetalheDoEvento = {
    ...p.evento,
    // O pacote é mínimo: o que não vem nele fica neutro e não aparece na tela local.
    visibilidade: 'interna',
    inscricaoAte: null,
    listaDeEspera: false,
    serieId: null,
    idPublico: '',
    etapas: p.etapas.map((e, i) => ({
      ...e,
      inicioPrevisto: horarios[i]!.inicio.toISOString(),
      fimPrevisto: horarios[i]!.fim.toISOString(),
    })),
    atribuicoes: p.atribuicoes
      .filter((a) => a.vinculoId !== null)
      .map((a) => ({
        id: a.id,
        etapaId: a.etapaId,
        vinculoId: a.vinculoId!,
        funcao: a.funcao,
        estado: a.estado as EstadoDaAtribuicao,
        nome: a.nome ?? 'Pessoa da comunidade',
      })),
    tarefas: p.tarefas.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      descricao: null,
      prazo: t.prazo,
      concluidaEm: tarefas.has(t.id) ? tarefas.get(t.id)! : t.concluidaEm,
      versao: t.versao,
      responsavelVinculoId: t.vinculoId,
      responsavelNome: t.nome,
    })),
    materiais: p.materiais.map((m) => ({
      id: m.id,
      nome: m.item,
      quantidade: m.quantidade,
      providenciadoEm: m.providenciadoEm,
      versao: m.versao,
      responsavelVinculoId: m.vinculoId,
      responsavelNome: m.nome,
    })),
    checklist: p.checklist.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      texto: c.texto,
      ordem: c.ordem,
      marcadoEm: itens.has(c.id) ? itens.get(c.id)! : c.marcadoEm,
      versao: c.versao,
      responsavelVinculoId: c.vinculoId,
      responsavelNome: c.nome,
    })),
    anexos: [],
    notas: [],
  }
  return { evento, pendentes }
}

function alvoDe(op: OperacaoNaFila): AlvoDaPresencaOffline | null {
  return op.tipo === 'presenca.registrar' ? op.dados : null
}

/** Lista de entrada do pacote, com as presenças marcadas neste aparelho. */
export function listaDeCheckinLocal(
  p: PacoteOffline,
  fila: readonly OperacaoNaFila[],
): ListaDeCheckin | null {
  if (!p.checkin) return null
  const alvos = fila
    .filter((o) => o.estado === 'pendente' && o.eventoId === p.evento.id)
    .map(alvoDe)
    .filter((a) => a !== null)
  const marcado = (inscricaoId: string | null, vinculoId: string | null, codigo?: string) =>
    alvos.some(
      (a) =>
        ('inscricaoId' in a && a.inscricaoId === inscricaoId) ||
        ('vinculoId' in a && vinculoId !== null && a.vinculoId === vinculoId) ||
        ('codigo' in a && codigo !== undefined && a.codigo.toUpperCase() === codigo),
    )
  return {
    geradoEm: p.geradoEm,
    inscritos: p.checkin.inscritos.map((i) => ({
      ...i,
      presente: i.presente || marcado(i.inscricaoId, i.vinculoId, i.codigo),
    })),
    membros: p.checkin.membros.map((m) => ({
      ...m,
      presente: m.presente || marcado(null, m.vinculoId),
    })),
  }
}

const MUDAM_A_ETAPA = new Set(['iniciar', 'avancar', 'voltar', 'ir_para'])

/**
 * Ao vivo "só neste aparelho": aplica os comandos locais (a mesma máquina de
 * estados da API) sobre a base conhecida. Quem conduz aqui é a própria pessoa.
 */
export function retratoLocal(
  base: RetratoAoVivo,
  comandos: readonly ComandoProposto[],
  agora: Date,
): RetratoAoVivo {
  let estado: EstadoAoVivo = {
    situacao: base.situacao,
    etapaAtualId: base.etapaAtualId,
    etapaIniciadaEm: base.etapaIniciadaEm,
    iniciadoEm: base.iniciadoEm,
    pausadoEm: base.pausadoEm,
    encerradoEm: base.encerradoEm,
  }
  const ids = base.etapas.map((e) => e.id)
  const reais = new Map(base.etapas.map((e) => [e.id, e.inicioReal]))
  let aplicados = 0
  for (const c of comandos) {
    const r = aplicarComando(
      estado,
      c.comando === 'ir_para' ? { tipo: 'ir_para', etapaId: c.etapaId ?? '' } : { tipo: c.comando },
      ids,
      new Date(c.ocorridoEm),
    )
    if (!r.ok) continue
    estado = r.estado
    aplicados++
    if (MUDAM_A_ETAPA.has(c.comando) && estado.etapaAtualId) {
      reais.set(estado.etapaAtualId, c.ocorridoEm)
    }
  }
  const indiceAtual = estado.etapaAtualId ? ids.indexOf(estado.etapaAtualId) : -1
  const atual = indiceAtual >= 0 ? base.etapas[indiceAtual] : undefined
  return {
    ...base,
    ...estado,
    versao: base.versao + aplicados,
    condutor: null,
    souCondutor: true,
    atrasoMin: atrasoEmMinutos(estado, atual ? new Date(atual.inicioPrevisto) : null),
    etapas: base.etapas.map((e, i) => ({
      ...e,
      inicioReal: reais.get(e.id) ?? null,
      situacao:
        i < indiceAtual || estado.situacao === 'encerrado'
          ? 'concluida'
          : i === indiceAtual
            ? 'atual'
            : 'proxima',
    })),
    agora: agora.toISOString(),
  }
}
