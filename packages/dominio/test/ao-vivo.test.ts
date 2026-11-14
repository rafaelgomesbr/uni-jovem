import { describe, expect, it } from 'vitest'
import { aplicarComando, atrasoEmMinutos, ESTADO_INICIAL, type EstadoAoVivo } from '../src/index.ts'

const etapas = ['e1', 'e2', 'e3']
const t = (min: number) => new Date(Date.UTC(2026, 10, 21, 19, min))

function aplicar(estado: EstadoAoVivo, ...comandos: Parameters<typeof aplicarComando>[1][]) {
  let e = estado
  for (const [i, c] of comandos.entries()) {
    const r = aplicarComando(e, c, etapas, t(i))
    if (!r.ok) throw new Error(r.motivo)
    e = r.estado
  }
  return e
}

describe('ao vivo', () => {
  it('iniciar, avançar até o fim encerra', () => {
    const e = aplicar(ESTADO_INICIAL, { tipo: 'iniciar' }, { tipo: 'avancar' }, { tipo: 'avancar' })
    expect(e).toMatchObject({ situacao: 'em_andamento', etapaAtualId: 'e3' })
    const fim = aplicarComando(e, { tipo: 'avancar' }, etapas, t(9))
    expect(fim.ok && fim.estado.situacao).toBe('encerrado')
  })

  it('pausar e retomar mantêm a etapa', () => {
    const e = aplicar(ESTADO_INICIAL, { tipo: 'iniciar' }, { tipo: 'pausar' }, { tipo: 'retomar' })
    expect(e).toMatchObject({ situacao: 'em_andamento', etapaAtualId: 'e1', pausadoEm: null })
  })

  it('recusas com explicação', () => {
    expect(aplicarComando(ESTADO_INICIAL, { tipo: 'avancar' }, etapas, t(0))).toEqual({
      ok: false,
      motivo: 'O evento não está em andamento.',
    })
    const iniciado = aplicar(ESTADO_INICIAL, { tipo: 'iniciar' })
    expect(aplicarComando(iniciado, { tipo: 'voltar' }, etapas, t(1)).ok).toBe(false)
    expect(aplicarComando(iniciado, { tipo: 'ir_para', etapaId: 'x' }, etapas, t(1)).ok).toBe(false)
    expect(aplicarComando(ESTADO_INICIAL, { tipo: 'iniciar' }, [], t(0)).ok).toBe(false)
  })

  it('atraso: início real da etapa menos o previsto', () => {
    const e = aplicar(ESTADO_INICIAL, { tipo: 'iniciar' }, { tipo: 'avancar' })
    // e2 começou em t(1); previsto era t(-4): 5 minutos de atraso.
    expect(atrasoEmMinutos(e, t(-4))).toBe(5)
    expect(atrasoEmMinutos(ESTADO_INICIAL, t(0))).toBeNull()
  })
})
