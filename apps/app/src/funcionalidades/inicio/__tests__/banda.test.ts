import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'

import { funcoesDaBandaCompleta } from '../banda'

type Entrada = Pick<DetalheDoEvento, 'etapas' | 'atribuicoes'>

const etapa = (id: string, titulo: string) =>
  ({ id, titulo, ordem: 1, duracaoMin: 15 }) as Entrada['etapas'][number]
const atribuicao = (
  id: string,
  funcao: string,
  estado: Entrada['atribuicoes'][number]['estado'],
  etapaId: string | null = 'louvor',
) => ({ id, etapaId, vinculoId: `v-${id}`, funcao, estado, nome: `Pessoa ${id}` })

describe('banda completa ("Banda completa: 5 de 5.")', () => {
  const etapas = [etapa('louvor', 'Louvor'), etapa('recepcao', 'Recepção')]

  test('toda função da banda com alguém que aceitou: devolve quantas funções são', () => {
    const e: Entrada = {
      etapas,
      atribuicoes: [
        atribuicao('1', 'Vocal', 'confirmada'),
        atribuicao('2', 'Violão', 'confirmada'),
        atribuicao('3', 'Bateria', 'confirmada'),
        // Recepção não é banda: não entra na conta.
        atribuicao('4', 'Recepção', 'pendente', 'recepcao'),
      ],
    }
    expect(funcoesDaBandaCompleta(e)).toBe(3)
  })

  test('uma função com todos pendentes: a banda não está completa', () => {
    const e: Entrada = {
      etapas,
      atribuicoes: [atribuicao('1', 'Vocal', 'confirmada'), atribuicao('2', 'Violão', 'pendente')],
    }
    expect(funcoesDaBandaCompleta(e)).toBeNull()
  })

  test('duas pessoas na mesma função: basta uma ter aceitado', () => {
    const e: Entrada = {
      etapas,
      atribuicoes: [
        atribuicao('1', 'Vocal', 'confirmada'),
        atribuicao('2', 'Vocal', 'recusada'),
        atribuicao('3', 'Violão', 'confirmada'),
      ],
    }
    expect(funcoesDaBandaCompleta(e)).toBe(2)
  })

  test('função de banda vale mesmo com a pessoa convocada ao encontro todo', () => {
    const e: Entrada = {
      etapas,
      atribuicoes: [atribuicao('1', 'Bateria', 'confirmada', null)],
    }
    expect(funcoesDaBandaCompleta(e)).toBe(1)
  })

  test('sem ninguém no louvor: nada a dizer', () => {
    expect(funcoesDaBandaCompleta({ etapas, atribuicoes: [] })).toBeNull()
    expect(
      funcoesDaBandaCompleta({
        etapas,
        atribuicoes: [atribuicao('1', 'Recepção', 'confirmada', 'recepcao')],
      }),
    ).toBeNull()
  })
})
