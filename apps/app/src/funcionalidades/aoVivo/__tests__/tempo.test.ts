import { minutos, retratoDeTeste } from '@/testes/fixturas'

import { calcularTempo, descreverAtraso, motivoDaRecusa } from '../tempo'

const ms = (iso: string) => Date.parse(iso)

describe('tempo do ao vivo', () => {
  test('decorrido, restante e próxima etapa', () => {
    // Louvor (15 min) começou às 16:07; agora são 16:10.
    const t = calcularTempo(retratoDeTeste(), ms(minutos(10)))
    expect(t.atual?.titulo).toBe('Louvor')
    expect(t.proxima?.titulo).toBe('Encerramento')
    expect(t.decorridoMs).toBe(3 * 60_000)
    expect(t.restanteMs).toBe(12 * 60_000)
    expect(t.atrasoMin).toBe(2)
    expect(t.concluidas).toBe(1)
  })

  test('etapa que passa do previsto soma no atraso acumulado', () => {
    // 16:07 + 15 min = 16:22 previsto; às 16:27 passou 5 min.
    const t = calcularTempo(retratoDeTeste(), ms(minutos(27)))
    expect(t.restanteMs).toBe(-5 * 60_000)
    expect(t.atrasoMin).toBe(7)
    expect(descreverAtraso(t.atrasoMin)).toBe('7 min de atraso')
  })

  test('pausado: o relógio para no momento da pausa', () => {
    const r = retratoDeTeste({ situacao: 'pausado', pausadoEm: minutos(9) })
    expect(calcularTempo(r, ms(minutos(30))).decorridoMs).toBe(2 * 60_000)
  })

  test('os controles usam a máquina de estados do domínio', () => {
    expect(motivoDaRecusa(retratoDeTeste(), 'avancar')).toBeNull()
    expect(motivoDaRecusa(retratoDeTeste(), 'iniciar')).toBe('O evento já foi iniciado.')
    const naPrimeira = retratoDeTeste({ etapaAtualId: retratoDeTeste().etapas[0]!.id })
    expect(motivoDaRecusa(naPrimeira, 'voltar')).toBe('Já está na primeira etapa.')
  })
})
