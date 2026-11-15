/** Dados fictícios de eventos para os testes de tela (nada de dado pessoal real). */
import type { DetalheDoEvento, RetratoAoVivo } from '@/servicos/contratoDosEventos'

import { FUSO, MEU_VINCULO, PESSOAS } from './telas'

export const EVENTO_ID = '33333333-3333-4333-8333-000000000001'
export const ETAPAS = [
  '44444444-4444-4444-8444-000000000001',
  '44444444-4444-4444-8444-000000000002',
  '44444444-4444-4444-8444-000000000003',
] as const

/**
 * Um sábado entre 7 e 13 dias à frente, às 16:00 em São Paulo (19:00 UTC).
 * Relativo a hoje para os testes não vencerem com o calendário.
 */
function proximoSabado(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7) + 7)
  d.setUTCHours(19, 0, 0, 0)
  return d.toISOString()
}

export const INICIO = proximoSabado()
/** Data local (AAAA-MM-DD) do INICIO. */
export const DIA_DO_INICIO = INICIO.slice(0, 10)

/** Instante `n` minutos depois do início. */
export const minutos = (n: number) => new Date(Date.parse(INICIO) + n * 60_000).toISOString()

export function eventoDeTeste(parcial: Partial<DetalheDoEvento> = {}): DetalheDoEvento {
  return {
    id: EVENTO_ID,
    titulo: 'Sábado com a juventude',
    descricao: null,
    categoria: 'Programação de sábado',
    inicio: INICIO,
    duracaoMin: 30,
    fuso: FUSO,
    status: 'publicado',
    motivoStatus: null,
    visibilidade: 'publica',
    capacidade: 20,
    inscricaoAte: null,
    listaDeEspera: true,
    informacoesUteis: null,
    serieId: null,
    versao: 3,
    idPublico: 'a'.repeat(32),
    local: null,
    etapas: [
      {
        id: ETAPAS[0],
        ordem: 0,
        titulo: 'Boas-vindas',
        descricao: null,
        duracaoMin: 5,
        versao: 1,
        inicioPrevisto: minutos(0),
        fimPrevisto: minutos(5),
      },
      {
        id: ETAPAS[1],
        ordem: 1,
        titulo: 'Louvor',
        descricao: null,
        duracaoMin: 15,
        versao: 1,
        inicioPrevisto: minutos(5),
        fimPrevisto: minutos(20),
      },
      {
        id: ETAPAS[2],
        ordem: 2,
        titulo: 'Encerramento',
        descricao: null,
        duracaoMin: 10,
        versao: 1,
        inicioPrevisto: minutos(20),
        fimPrevisto: minutos(30),
      },
    ],
    atribuicoes: [
      {
        id: 'atr-1',
        etapaId: ETAPAS[1],
        vinculoId: PESSOAS[1]!.vinculoId,
        funcao: 'responsável',
        estado: 'confirmada',
        nome: 'Bruno Lima',
      },
    ],
    tarefas: [
      {
        id: 'tar-1',
        titulo: 'Testar o som',
        descricao: null,
        responsavelVinculoId: MEU_VINCULO,
        responsavelNome: 'Ana Souza',
        prazo: null,
        concluidaEm: null,
        versao: 1,
      },
      {
        id: 'tar-2',
        titulo: 'Comprar o lanche',
        descricao: null,
        responsavelVinculoId: PESSOAS[2]!.vinculoId,
        responsavelNome: 'Carla Dias',
        prazo: null,
        concluidaEm: null,
        versao: 1,
      },
    ],
    materiais: [],
    checklist: [],
    anexos: [],
    notas: [],
    ...parcial,
  }
}

export function retratoDeTeste(parcial: Partial<RetratoAoVivo> = {}): RetratoAoVivo {
  const evento = eventoDeTeste()
  return {
    evento: { id: EVENTO_ID, titulo: evento.titulo, status: 'publicado', inicio: INICIO },
    situacao: 'em_andamento',
    etapaAtualId: ETAPAS[1],
    etapaIniciadaEm: minutos(7),
    iniciadoEm: minutos(2),
    pausadoEm: null,
    encerradoEm: null,
    versao: 3,
    condutor: { vinculoId: MEU_VINCULO, nome: 'Ana Souza', ate: minutos(60) },
    souCondutor: true,
    atrasoMin: 2,
    etapas: evento.etapas.map((e, i) => ({
      id: e.id,
      titulo: e.titulo,
      duracaoMin: e.duracaoMin,
      inicioPrevisto: e.inicioPrevisto,
      fimPrevisto: e.fimPrevisto,
      inicioReal: i <= 1 ? minutos(i === 0 ? 2 : 7) : null,
      situacao: i === 0 ? 'concluida' : i === 1 ? 'atual' : 'proxima',
    })),
    agora: minutos(10),
    ...parcial,
  }
}
