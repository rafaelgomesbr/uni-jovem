import { encantoJaVisto, reiniciarEncantosParaTestes, reivindicarEncanto } from '../encantos'

const cofre = (jest.requireMock('expo-secure-store') as { __cofre: Map<string, string> }).__cofre

beforeEach(() => {
  cofre.clear()
  reiniciarEncantosParaTestes()
})

describe('os cinco encantos do sol: uma vez por conta, um por sessão (6.3 do UX)', () => {
  test('a primeira vez vale e fica guardada; a segunda do mesmo não', async () => {
    expect(await reivindicarEncanto('conta-a', 'aceitar')).toBe(true)
    expect(JSON.parse(cofre.get('uj.encantos.conta-a')!)).toEqual({ aceitar: true })
    // Outra sessão (o app foi aberto de novo): o mesmo encanto não volta.
    reiniciarEncantosParaTestes()
    expect(await reivindicarEncanto('conta-a', 'aceitar')).toBe(false)
  })

  test('no máximo um por sessão: o segundo fica para a próxima abertura e não é gravado', async () => {
    expect(await reivindicarEncanto('conta-a', 'tudoEmDia')).toBe(true)
    expect(await reivindicarEncanto('conta-a', 'banda')).toBe(false)
    expect(JSON.parse(cofre.get('uj.encantos.conta-a')!)).toEqual({ tudoEmDia: true })
    reiniciarEncantosParaTestes()
    expect(await reivindicarEncanto('conta-a', 'banda')).toBe(true)
    expect(JSON.parse(cofre.get('uj.encantos.conta-a')!)).toEqual({ tudoEmDia: true, banda: true })
  })

  test('cada conta tem os seus (o encanto é da pessoa, não do aparelho)', async () => {
    expect(await reivindicarEncanto('conta-a', 'aceitar')).toBe(true)
    reiniciarEncantosParaTestes()
    expect(await reivindicarEncanto('conta-b', 'aceitar')).toBe(true)
  })

  test('duas chamadas ao mesmo tempo: só uma ganha', async () => {
    const [a, b] = await Promise.all([
      reivindicarEncanto('conta-a', 'publicou'),
      reivindicarEncanto('conta-a', 'presenca'),
    ])
    expect([a, b].filter(Boolean)).toHaveLength(1)
  })

  test('sem conta (sessão ainda não abriu): nada acontece', async () => {
    expect(await reivindicarEncanto(undefined, 'aceitar')).toBe(false)
    expect(await reivindicarEncanto(null, 'aceitar')).toBe(false)
  })

  test('"já viu?" só lê: não consome o encanto', async () => {
    expect(await encantoJaVisto('conta-a', 'presenca')).toBe(false)
    expect(await encantoJaVisto('conta-a', 'presenca')).toBe(false)
    await reivindicarEncanto('conta-a', 'presenca')
    expect(await encantoJaVisto('conta-a', 'presenca')).toBe(true)
  })
})
