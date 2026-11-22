import {
  DESTINO_DE_ESCALAS,
  destinoDeProgramacoes,
  PARAMETROS_DA_AGENDA,
} from '../Redirecionamentos'

describe('para onde as rotas antigas levam (D68)', () => {
  test('/escalas: a Agenda, em Lista, com "Só o que é meu"', () => {
    expect(DESTINO_DE_ESCALAS).toEqual({
      pathname: '/agenda',
      params: { vista: 'lista', filtro: 'meu' },
    })
  })

  test('/programacoes: a Agenda em Lista; o encontro do link (?evento=) segue junto', () => {
    expect(destinoDeProgramacoes(null)).toEqual({ pathname: '/agenda', params: { vista: 'lista' } })
    expect(destinoDeProgramacoes('e1')).toEqual({
      pathname: '/agenda',
      params: { vista: 'lista', evento: 'e1' },
    })
  })

  test('os nomes dos parâmetros são o contrato que a Agenda lê', () => {
    expect(PARAMETROS_DA_AGENDA).toEqual({ lista: 'lista', soMeu: 'meu' })
  })
})
