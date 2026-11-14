import { describe, expect, it } from 'vitest'
import { ehPapel, NIVEL, PAPEIS, podeConcederPapel } from '../src/index.ts'

describe('papéis', () => {
  it('a hierarquia é estritamente ordenada', () => {
    expect(NIVEL.admin).toBeGreaterThan(NIVEL.organizador)
    expect(NIVEL.organizador).toBeGreaterThan(NIVEL.membro)
  })

  it('"criador" e "leitor" não são papéis de comunidade', () => {
    expect(ehPapel('criador')).toBe(false)
    expect(ehPapel('leitor')).toBe(false)
    expect(ehPapel('membro')).toBe(true)
  })

  it('só admin concede papéis, e todos os três', () => {
    for (const alvo of PAPEIS) {
      expect(podeConcederPapel('admin', alvo)).toBe(true)
      expect(podeConcederPapel('organizador', alvo)).toBe(false)
      expect(podeConcederPapel('membro', alvo)).toBe(false)
    }
  })
})
