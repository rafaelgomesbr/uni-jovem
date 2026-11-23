import { prepararCifra } from '@uj/dominio'

import {
  fraseDeComoTocar,
  fraseDoAjustePessoal,
  fraseDoCapotraste,
  tituloDeVoltarAoTom,
  tituloDoTom,
  tomDivergente,
} from '../rotulosDaCifra'

const CIFRA = '{key: G}\n[G]Sobre a rocha eu [D]firmo'

describe('rótulos dos controles da cifra (D82)', () => {
  test('o título do tom usa ♭ e ♯ e diz quando é só um palpite', () => {
    expect(tituloDoTom(prepararCifra(CIFRA, { tomOriginal: 'G', ajuste: 1 }))).toBe('Tom A♭')
    expect(tituloDoTom(prepararCifra(CIFRA, { tomOriginal: 'G', tomDoDia: 'F#m' }))).toBe('Tom F♯m')
    expect(tituloDoTom(prepararCifra('[C]a [G]b'))).toBe('Tom provável C')
    expect(tituloDoTom(prepararCifra('Só a letra, sem acorde'))).toBe('Sem tom informado')
  })

  test('capotraste em palavras: "sem" ou "na casa N"', () => {
    expect(fraseDoCapotraste(0)).toBe('Capotraste: sem')
    expect(fraseDoCapotraste(3)).toBe('Capotraste na casa 3')
  })

  test('com capotraste: as formas que a mão faz e o tom que soa; sem, nada a dizer', () => {
    const com = prepararCifra(CIFRA, { tomOriginal: 'G', tomDoDia: 'A', capotraste: 2 })
    expect(fraseDeComoTocar(com, 2)).toBe('Toque como se fosse em G. O som sai em A.')
    expect(fraseDeComoTocar(prepararCifra(CIFRA, { tomOriginal: 'G' }), 0)).toBeNull()
  })

  test('voltar ao tom diz para onde volta e se é o do dia ou o original', () => {
    expect(tituloDeVoltarAoTom(true, 'Bb')).toBe('Voltar ao tom do dia (B♭)')
    expect(tituloDeVoltarAoTom(false, 'G')).toBe('Voltar ao tom original (G)')
    expect(tituloDeVoltarAoTom(false, null)).toBe('Voltar ao tom original')
  })

  test('o ajuste pessoal avisa que o tom salvo não mudou', () => {
    expect(fraseDoAjustePessoal(true, 'A')).toBe('Só para você: o tom do dia continua A.')
    expect(fraseDoAjustePessoal(false, 'G')).toBe('Só para você: o tom da música continua G.')
  })

  test('divergência entre o cadastro e a cifra: A♯ e B♭ são o mesmo tom, C e A não', () => {
    expect(tomDivergente('C', 'A')).toEqual({ cadastrado: 'C', daCifra: 'A' })
    expect(tomDivergente('A#', 'Bb')).toBeNull()
    expect(tomDivergente('Am', 'A')).not.toBeNull()
    expect(tomDivergente(null, 'A')).toBeNull()
    expect(tomDivergente('G', 'G')).toBeNull()
  })
})
