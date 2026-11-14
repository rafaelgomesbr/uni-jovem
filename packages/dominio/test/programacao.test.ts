import { describe, expect, it } from 'vitest'
import {
  calcularHorarios,
  duracaoTotal,
  MODELO_SABADO_PADRAO,
  podeMudarStatus,
} from '../src/index.ts'

describe('programação', () => {
  it('o Sábado padrão tem as 7 etapas do pedido e soma uma hora', () => {
    expect(MODELO_SABADO_PADRAO.etapas.map((e) => e.titulo)).toEqual([
      'Boas-vindas',
      'Louvor',
      'Oração intercessora',
      'Dinâmica',
      'Estudo da lição',
      'Brinde',
      'Encerramento',
    ])
    expect(duracaoTotal(MODELO_SABADO_PADRAO.etapas)).toBe(60)
  })

  it('horários em sequência a partir do início', () => {
    const inicio = new Date('2026-11-21T19:00:00.000Z')
    const h = calcularHorarios(inicio, [{ duracaoMin: 5 }, { duracaoMin: 15 }])
    expect(h.map((x) => [x.inicio.toISOString(), x.fim.toISOString()])).toEqual([
      ['2026-11-21T19:00:00.000Z', '2026-11-21T19:05:00.000Z'],
      ['2026-11-21T19:05:00.000Z', '2026-11-21T19:20:00.000Z'],
    ])
  })

  it('transições de status', () => {
    expect(podeMudarStatus('rascunho', 'publicado')).toBe(true)
    expect(podeMudarStatus('rascunho', 'cancelado')).toBe(false)
    expect(podeMudarStatus('cancelado', 'publicado')).toBe(false)
    expect(podeMudarStatus('adiado', 'publicado')).toBe(true)
  })
})
