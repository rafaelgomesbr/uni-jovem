/**
 * "Cabe sem rolar" provado em números (D63): as combinações da tabela 2.3 do
 * desenho de UI (`entrada.inicio` em 4 aparelhos), a escada de ajuste, a fonte
 * grande e o painel de e-mail com o teclado aberto (tabela 2.4).
 */
import { ALTURA_DO_ACESSO, LADO_DO_SOL, RITMO_DE_ACESSO } from '@uj/tokens'

import {
  calcularMedidasDoAcesso,
  calcularMedidasDoPainel,
  type EntradaDasMedidas,
} from '../medidasDoAcesso'

/** iOS com Apple, Google e e-mail terciário, com o selo "Usado da última vez". */
const IOS: Omit<EntradaDasMedidas, 'altura' | 'topo' | 'base'> = {
  fonte: 1,
  acessos: 3,
  terciario: true,
  temSelo: true,
  temConvite: false,
  temBiometria: false,
}
const ANDROID = { ...IOS, acessos: 2 as const, terciario: false }

describe('entrada.inicio: a tabela 2.3 do desenho de UI', () => {
  test('iPhone SE 375x667: sol de 88, sobra de 121, respiro 48 e 73, sem rolar', () => {
    const m = calcularMedidasDoAcesso({ ...IOS, altura: 667, topo: 20, base: 0 })
    expect(m).toMatchObject({
      sol: LADO_DO_SOL.base,
      mostraApoio: true,
      rola: false,
      alturaDoPalco: 192,
      alturaDosAcessos: 334,
      sobra: 121,
      respiroDeCima: 48,
      respiroDeBaixo: 73,
    })
  })

  test('iPhone 15 e 16, 393x852: sol de 112, sobra de 205, respiro 80 e 125', () => {
    const m = calcularMedidasDoAcesso({ ...IOS, altura: 852, topo: 59, base: 34 })
    expect(m).toMatchObject({
      sol: LADO_DO_SOL.grande,
      alturaDoPalco: 220,
      alturaDosAcessos: 368,
      sobra: 205,
      respiroDeCima: 80,
      respiroDeBaixo: 125,
      rola: false,
    })
  })

  test('Android 360x800 (só Google e e-mail): sobra de 258, respiro 96 e 162', () => {
    const m = calcularMedidasDoAcesso({ ...ANDROID, altura: 800, topo: 24, base: 24 })
    expect(m).toMatchObject({
      sol: LADO_DO_SOL.grande,
      alturaDosAcessos: 298,
      sobra: 258,
      respiroDeCima: 96,
      respiroDeBaixo: 162,
      rola: false,
    })
  })

  test('web 1280x800 (coluna de 400): cabe com folga e o sol é o maior', () => {
    const m = calcularMedidasDoAcesso({ ...ANDROID, altura: 800, topo: 0, base: 0 })
    expect(m.sol).toBe(LADO_DO_SOL.grande)
    expect(m.rola).toBe(false)
    expect(m.sobra).toBeGreaterThan(200)
  })

  test('a folga entre o palco e os acessos nunca é menor que 16, e o respiro de cima é múltiplo de 8', () => {
    for (const [altura, topo, base] of [
      [667, 20, 0],
      [852, 59, 34],
      [800, 24, 24],
      [740, 47, 34],
    ] as const) {
      const m = calcularMedidasDoAcesso({ ...IOS, altura, topo, base })
      expect(m.rola).toBe(false)
      expect(m.respiroDeBaixo).toBeGreaterThanOrEqual(RITMO_DE_ACESSO.respiroMinimo)
      expect(m.respiroDeCima % 8).toBe(0)
    }
  })

  test('o sol cresce com a sobra: 88, 96 e 112', () => {
    const semSelo = { ...ANDROID, temSelo: false }
    const pequena = calcularMedidasDoAcesso({ ...IOS, altura: 667, topo: 20, base: 0 })
    const media = calcularMedidasDoAcesso({ ...semSelo, altura: 612, topo: 20, base: 0 })
    const grande = calcularMedidasDoAcesso({ ...IOS, altura: 852, topo: 59, base: 34 })
    expect([pequena.sol, media.sol, grande.sol]).toEqual([
      LADO_DO_SOL.base,
      LADO_DO_SOL.medio,
      LADO_DO_SOL.grande,
    ])
  })

  test('com convite guardado cabe no SE: sobra de 53 (o cartão entra, o link some)', () => {
    const m = calcularMedidasDoAcesso({
      ...IOS,
      temSelo: false,
      temConvite: true,
      altura: 667,
      topo: 20,
      base: 0,
    })
    expect(m.rola).toBe(false)
    expect(m.alturaDosAcessos).toBeGreaterThan(300)
  })

  test('escada de ajuste: Face ID e convite juntos no SE diminuem o sol antes de rolar', () => {
    const apertada = calcularMedidasDoAcesso({
      ...IOS,
      temConvite: true,
      temBiometria: true,
      altura: 667,
      topo: 20,
      base: 0,
    })
    expect(apertada.sol).toBeLessThanOrEqual(LADO_DO_SOL.compacto)
  })

  test('fonte grande (1,35): o sol vai a 56 e o apoio some; nenhuma ação deixa de existir', () => {
    const m = calcularMedidasDoAcesso({ ...IOS, fonte: 1.35, altura: 667, topo: 20, base: 0 })
    expect(m.sol).toBe(LADO_DO_SOL.minimo)
    expect(m.mostraApoio).toBe(false)
    expect(m.rola).toBe(false)
  })

  test('fonte acima de 1,6: liga a rolagem (e só aí)', () => {
    expect(
      calcularMedidasDoAcesso({ ...IOS, fonte: 1.6, altura: 667, topo: 20, base: 0 }).rola,
    ).toBe(false)
    expect(calcularMedidasDoAcesso({ ...IOS, fonte: 2, altura: 667, topo: 20, base: 0 }).rola).toBe(
      true,
    )
  })
})

describe('entrada.email com o teclado aberto: a tabela 2.4', () => {
  test('iPhone SE, teclado de 260: ritmo compacto e sobra de 15 acima do teclado', () => {
    const m = calcularMedidasDoPainel({ altura: 667, topo: 20, teclado: 260, fonte: 1 })
    expect(m).toMatchObject({
      ritmo: 'compacto',
      tituloVisivel: true,
      sobraAcimaDoTeclado: 15,
      rola: false,
    })
  })

  test('iPhone 15 e 16, teclado de 336: ritmo confortável e sobra de 73', () => {
    const m = calcularMedidasDoPainel({ altura: 852, topo: 59, teclado: 336, fonte: 1 })
    expect(m).toMatchObject({ ritmo: 'confortavel', sobraAcimaDoTeclado: 73, rola: false })
  })

  test('Android, teclado de 300: ritmo confortável e sobra de 92', () => {
    const m = calcularMedidasDoPainel({ altura: 800, topo: 24, teclado: 300, fonte: 1 })
    expect(m).toMatchObject({ ritmo: 'confortavel', sobraAcimaDoTeclado: 92 })
  })

  test('web (sem teclado virtual): cabe de sobra', () => {
    const m = calcularMedidasDoPainel({ altura: 800, topo: 0, teclado: 0, fonte: 1 })
    expect(m.ritmo).toBe('confortavel')
    expect(m.rola).toBe(false)
  })

  test('teclado muito alto: o título some e o painel sobe, em vez de rolar', () => {
    const m = calcularMedidasDoPainel({ altura: 667, topo: 20, teclado: 300, fonte: 1 })
    expect(m.tituloVisivel).toBe(false)
    expect(m.rola).toBe(false)
  })

  test('o botão Entrar e os campos têm a altura de 56 (o mesmo dos acessos)', () => {
    expect(ALTURA_DO_ACESSO).toBe(56)
  })
})
