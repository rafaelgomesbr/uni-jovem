import { describe, expect, it } from 'vitest'
import {
  ALFABETO_DO_CODIGO,
  cadastroSemConviteHabilitado,
  ehCodigoDaComunidade,
  MODO_DE_ENTRADA_PADRAO,
  MODOS_DE_ENTRADA,
  modoDeEntradaHabilitado,
  normalizarCodigoDaComunidade,
  podeCriarComunidade,
  POLITICAS,
  TAMANHO_DO_CODIGO,
} from '../src/index.ts'

/**
 * As três políticas da ADR 0004 com os valores da ADR 0007. Os testes de
 * "não habilitado" da ADR 0004 passam a provar os valores novos: cadastro
 * público e comunidade livre com limites; `livre` continua não habilitado.
 */
describe('políticas de entrada (ADR 0007)', () => {
  it('valores vigentes: cadastro público e comunidade livre com limites', () => {
    expect(POLITICAS).toEqual({ conta: 'cadastro_publico', comunidade: 'livre_com_limites' })
  })

  it('quem cria conta: com cadastro público, sem convite; só por convite, não', () => {
    expect(cadastroSemConviteHabilitado(POLITICAS.conta)).toBe(true)
    expect(cadastroSemConviteHabilitado('somente_por_convite')).toBe(false)
  })

  it('quem cria comunidade: conta com e-mail confirmado; o Criador sempre', () => {
    const p = POLITICAS.comunidade
    expect(podeCriarComunidade(p, { criador: false, emailConfirmado: true })).toBe(true)
    expect(podeCriarComunidade(p, { criador: false, emailConfirmado: false })).toBe(true)
    expect(podeCriarComunidade('somente_criador', { criador: false, emailConfirmado: true })).toBe(
      false,
    )
    expect(podeCriarComunidade('somente_criador', { criador: true, emailConfirmado: true })).toBe(
      true,
    )
  })

  it('como se entra: convite e os dois modos por código; `livre` não está habilitado', () => {
    expect(MODOS_DE_ENTRADA).toContain('livre')
    expect(modoDeEntradaHabilitado('livre')).toBe(false)
    expect(modoDeEntradaHabilitado('solicitacao')).toBe(false)
    for (const m of ['convite', 'codigo_com_aprovacao', 'codigo_direto']) {
      expect(modoDeEntradaHabilitado(m), m).toBe(true)
    }
    expect(MODO_DE_ENTRADA_PADRAO).toBe('codigo_com_aprovacao')
  })
})

describe('código da comunidade', () => {
  it('alfabeto de 32 símbolos sem 0, O, 1 e I', () => {
    expect(ALFABETO_DO_CODIGO).toHaveLength(32)
    expect(new Set(ALFABETO_DO_CODIGO).size).toBe(32)
    for (const ambiguo of ['0', 'O', '1', 'I']) expect(ALFABETO_DO_CODIGO).not.toContain(ambiguo)
  })

  it('normaliza o que foi digitado e confere o formato', () => {
    expect(normalizarCodigoDaComunidade('abcd-efgh')).toBe('ABCDEFGH')
    expect(normalizarCodigoDaComunidade(' ab cd ef gh ')).toBe('ABCDEFGH')
    expect(ehCodigoDaComunidade('ABCDEFGH')).toBe(true)
    expect(ehCodigoDaComunidade('ABCDEFG0')).toBe(false)
    expect(ehCodigoDaComunidade('ABC')).toBe(false)
    expect(TAMANHO_DO_CODIGO).toBe(8)
  })
})
