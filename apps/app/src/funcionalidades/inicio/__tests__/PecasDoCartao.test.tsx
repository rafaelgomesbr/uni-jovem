import { listarNomes, pessoas } from '../PecasDoCartao'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

describe('os textos do cartão do líder', () => {
  test('"Bruno", "Bruno e Camila", "Bruno, Camila e Davi": só o primeiro nome, o último com "e"', () => {
    expect(listarNomes(['Bruno Tavares'])).toBe('Bruno')
    expect(listarNomes(['Bruno Tavares', 'Camila Nunes'])).toBe('Bruno e Camila')
    expect(listarNomes(['Bruno Tavares', 'Camila Nunes', 'Davi Monteiro'])).toBe(
      'Bruno, Camila e Davi',
    )
    expect(listarNomes([])).toBe('')
  })

  test('a lista cortada em 4 diz quantos mais faltam', () => {
    const quatro = ['Ana A', 'Bia B', 'Caio C', 'Davi D']
    expect(listarNomes(quatro, 7)).toBe('Ana, Bia, Caio, Davi e mais 3')
    expect(listarNomes(quatro, 4)).toBe('Ana, Bia, Caio e Davi')
  })

  test('"1 pessoa", "11 pessoas"', () => {
    expect(pessoas(1)).toBe('1 pessoa')
    expect(pessoas(11)).toBe('11 pessoas')
  })
})
