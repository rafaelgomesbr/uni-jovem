import type { EstadoDaAtribuicao } from '@/servicos/contratoDosEventos'

import { resumoDosConvocados, textoDepoisDeConvocar } from '../Convocacao'

const com = (...estados: EstadoDaAtribuicao[]) => estados.map((estado) => ({ estado }))

describe('resumo dos convocados', () => {
  test('ninguém convocado: sem resumo (a tela mostra o estado vazio)', () => {
    expect(resumoDosConvocados([])).toBeNull()
  })

  test('só as partes com alguém, no plural certo', () => {
    expect(
      resumoDosConvocados(com('confirmada', 'confirmada', 'confirmada', 'pendente', 'recusada')),
    ).toBe('5 convocados: 3 aceitaram, 1 aguardando, 1 não pode ir')
    expect(resumoDosConvocados(com('pendente', 'pendente', 'recusada', 'recusada'))).toBe(
      '4 convocados: 2 aguardando, 2 não podem ir',
    )
    expect(resumoDosConvocados(com('confirmada'))).toBe('1 convocado: 1 aceitou')
    expect(resumoDosConvocados(com('substituicao_pedida', 'confirmada'))).toBe(
      '2 convocados: 1 aceitou, 1 pediu troca',
    )
  })
})

describe('toast depois de convocar', () => {
  const amanha = new Date(Date.now() + 86_400_000).toISOString()
  const ontem = new Date(Date.now() - 86_400_000).toISOString()

  test('rascunho não promete aviso: só depois de publicar', () => {
    expect(textoDepoisDeConvocar({ status: 'rascunho', inicio: amanha })).toBe(
      'Salvo. A pessoa recebe a convocação quando você publicar.',
    )
  })

  test('publicado e futuro: a convocação sai na hora', () => {
    expect(textoDepoisDeConvocar({ status: 'publicado', inicio: amanha })).toBe(
      'Convocação enviada. A resposta aparece aqui.',
    )
  })

  test('sem aviso no celular (adiado ou já passou): só salva', () => {
    expect(textoDepoisDeConvocar({ status: 'adiado', inicio: amanha })).toBe(
      'Convocação salva. A resposta aparece aqui.',
    )
    expect(textoDepoisDeConvocar({ status: 'publicado', inicio: ontem })).toBe(
      'Convocação salva. A resposta aparece aqui.',
    )
  })
})
