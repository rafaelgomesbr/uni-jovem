import { describe, expect, it } from 'vitest'
import {
  calcularHorarios,
  duracaoTotal,
  ehModeloEmbutido,
  MODELO_SABADO_PADRAO,
  MODELOS_EMBUTIDOS,
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

  it('os modelos do app são poucos, de chave única, com etapas e até uma hora (D81)', () => {
    expect(MODELOS_EMBUTIDOS.map((m) => m.chave)).toEqual([
      'sabado_padrao',
      'reuniao_curta',
      'so_louvor',
    ])
    expect(new Set(MODELOS_EMBUTIDOS.map((m) => m.nome)).size).toBe(MODELOS_EMBUTIDOS.length)
    for (const m of MODELOS_EMBUTIDOS) {
      expect(m.etapas.length).toBeGreaterThan(0)
      expect(duracaoTotal(m.etapas)).toBeLessThanOrEqual(60)
    }
    expect(ehModeloEmbutido('so_louvor')).toBe(true)
    expect(ehModeloEmbutido('inexistente')).toBe(false)
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
