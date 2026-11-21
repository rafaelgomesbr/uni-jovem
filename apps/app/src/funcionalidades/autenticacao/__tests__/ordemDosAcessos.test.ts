import { ordemDosAcessos } from '../ordemDosAcessos'

const resumo = (itens: ReturnType<typeof ordemDosAcessos>) =>
  itens.map((i) => `${i.marca}:${i.nivel}${i.selo ? ':selo' : ''}`)

describe('ordem e peso dos acessos (UX 4)', () => {
  test('iOS: Apple primária, Google secundário, e-mail terciário', () => {
    expect(
      resumo(
        ordemDosAcessos({
          plataforma: 'ios',
          apple: true,
          google: true,
          biometria: false,
          ultimoMetodo: null,
        }),
      ),
    ).toEqual(['apple:primario', 'google:secundario', 'email:terciario'])
  })

  test('Android e web: Google primário e e-mail secundário (a Apple não existe fora do iOS)', () => {
    for (const plataforma of ['android', 'web'] as const) {
      expect(
        resumo(
          ordemDosAcessos({
            plataforma,
            apple: true,
            google: true,
            biometria: false,
            ultimoMetodo: null,
          }),
        ),
      ).toEqual(['google:primario', 'email:secundario'])
    }
  })

  test('o método usado da última vez sobe ao primeiro lugar e ganha o selo; os outros descem', () => {
    expect(
      resumo(
        ordemDosAcessos({
          plataforma: 'ios',
          apple: true,
          google: true,
          biometria: false,
          ultimoMetodo: 'google',
        }),
      ),
    ).toEqual(['google:primario:selo', 'apple:secundario', 'email:terciario'])
  })

  test('o e-mail como último método vira o primeiro (o desenho de primário é coral)', () => {
    expect(
      resumo(
        ordemDosAcessos({
          plataforma: 'android',
          apple: false,
          google: true,
          biometria: false,
          ultimoMetodo: 'email',
        }),
      ),
    ).toEqual(['email:primario:selo', 'google:secundario'])
  })

  test('o último método que este aparelho não oferece (Apple no Android) é ignorado', () => {
    expect(
      resumo(
        ordemDosAcessos({
          plataforma: 'android',
          apple: false,
          google: true,
          biometria: false,
          ultimoMetodo: 'apple',
        }),
      ),
    ).toEqual(['google:primario', 'email:secundario'])
  })

  test('com sessão guardada, "Entrar com Face ID" é sempre o primeiro, sem selo', () => {
    expect(
      resumo(
        ordemDosAcessos({
          plataforma: 'ios',
          apple: true,
          google: true,
          biometria: true,
          ultimoMetodo: 'apple',
        }),
      ),
    ).toEqual(['biometria:primario', 'apple:primario:selo', 'google:secundario', 'email:terciario'])
  })

  test('sem nenhum provedor, só o e-mail, sem selo (não há com o que comparar)', () => {
    expect(
      resumo(
        ordemDosAcessos({
          plataforma: 'web',
          apple: false,
          google: false,
          biometria: false,
          ultimoMetodo: 'email',
        }),
      ),
    ).toEqual(['email:primario'])
  })
})
