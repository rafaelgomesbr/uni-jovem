/**
 * D78: a barra de abas flutuante aparece em TODAS as telas de encontro (a conferência "Igual ao
 * último encontro" e o próprio encontro inclusive: um modal nativo a escondia); fica de fora só o
 * que é formulário de criação ou condução imersiva.
 */
import { barraFlutuanteNaRota, ROTAS_SEM_BARRA_FLUTUANTE } from '../rotasDaBarra'

describe('barra flutuante nas telas de encontro (D78)', () => {
  test.each([
    'evento/igual-ao-ultimo',
    'evento/[eventoId]',
    'evento/[eventoId]/etapa/[etapaId]',
    'evento/[eventoId]/repertorio',
    'evento/[eventoId]/inscricoes',
    'serie/[serieId]',
  ])('%s mostra a barra', (rota) => {
    expect(barraFlutuanteNaRota(rota)).toBe(true)
  })

  test.each([
    'evento/novo',
    'evento/[eventoId]/editar',
    'evento/[eventoId]/status',
    'evento/[eventoId]/ler-qr',
    'evento/[eventoId]/ao-vivo',
    'evento/[eventoId]/checkin',
    'meu-repertorio/[eventoId]/[itemId]',
  ])('%s fica sem a barra (formulário ou condução imersiva)', (rota) => {
    expect(barraFlutuanteNaRota(rota)).toBe(false)
  })

  test('o detalhe do encontro e a conferência nunca entram na lista de exceções', () => {
    expect(ROTAS_SEM_BARRA_FLUTUANTE.has('evento/igual-ao-ultimo')).toBe(false)
    expect(ROTAS_SEM_BARRA_FLUTUANTE.has('evento/[eventoId]')).toBe(false)
  })
})
