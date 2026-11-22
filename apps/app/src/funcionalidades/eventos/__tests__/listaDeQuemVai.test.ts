/**
 * D74: a lista "Quem vai" em contas puras: a banda é uma seção, a mesma pessoa com vários papéis
 * aparece UMA vez por seção, e a situação da linha é a de quem falta responder primeiro.
 */
import type { Atribuicao } from '@/servicos/contratoDosEventos'

import {
  descricaoDosPapeis,
  ehDaBanda,
  estadoCombinado,
  jaTemNaFuncao,
  montarQuemVai,
  primeiroNome,
  rotuloDoPapel,
} from '../listaDeQuemVai'

const ETAPAS = [
  { id: 'e-boas-vindas', titulo: 'Boas-vindas' },
  { id: 'e-louvor', titulo: 'Louvor' },
]

function atr(
  id: string,
  vinculoId: string,
  nome: string,
  funcao: string,
  estado: Atribuicao['estado'] = 'confirmada',
  etapaId: string | null = 'e-louvor',
): Atribuicao {
  return { id, etapaId, vinculoId, funcao, estado, nome }
}

describe('o que é da banda e como o papel se escreve', () => {
  test('função da banda é da banda em qualquer etapa; qualquer função na etapa do Louvor também', () => {
    expect(ehDaBanda({ funcao: 'Violão', etapaId: null }, ETAPAS)).toBe(true)
    expect(ehDaBanda({ funcao: 'integrante', etapaId: 'e-louvor' }, ETAPAS)).toBe(true)
    expect(ehDaBanda({ funcao: 'integrante', etapaId: null }, ETAPAS)).toBe(false)
    expect(ehDaBanda({ funcao: 'responsável', etapaId: 'e-boas-vindas' }, ETAPAS)).toBe(false)
  })

  test('rótulos: banda na lista padrão, equipe em palavras comuns, com a etapa quando há', () => {
    expect(rotuloDoPapel({ funcao: 'violao', etapaId: 'e-louvor' }, ETAPAS)).toBe('Violão')
    expect(rotuloDoPapel({ funcao: 'regência', etapaId: 'e-louvor' }, ETAPAS)).toBe('Regência')
    expect(rotuloDoPapel({ funcao: 'responsável', etapaId: null }, ETAPAS)).toBe('Quem conduz')
    expect(rotuloDoPapel({ funcao: 'integrante', etapaId: null }, ETAPAS)).toBe('Quem ajuda')
    expect(rotuloDoPapel({ funcao: 'recepção', etapaId: 'e-boas-vindas' }, ETAPAS)).toBe(
      'Recepção (Boas-vindas)',
    )
  })
})

describe('montar a lista', () => {
  const todas = [
    atr('1', 'ana', 'Ana Souza', 'Violão'),
    atr('2', 'ana', 'Ana Souza', 'Vocal'),
    atr('3', 'bruno', 'Bruno Lima', 'Bateria', 'pendente'),
    atr('4', 'ana', 'Ana Souza', 'recepção', 'pendente', null),
    atr('5', 'carla', 'Carla Dias', 'Vocal', 'recusada'),
  ]

  test('a mesma pessoa com dois papéis aparece uma vez na banda, e de novo (uma vez) na equipe', () => {
    const { banda, equipe } = montarQuemVai(todas, ETAPAS)
    expect(banda.map((p) => p.nome)).toEqual(['Ana Souza', 'Carla Dias', 'Bruno Lima'])
    const ana = banda.find((p) => p.vinculoId === 'ana')!
    expect(ana.papeis.map((p) => p.rotulo)).toEqual(['Violão', 'Vocal'])
    expect(descricaoDosPapeis(ana)).toBe('Violão, Vocal')
    expect(equipe.map((p) => p.nome)).toEqual(['Ana Souza'])
    expect(equipe[0]!.papeis.map((p) => p.rotulo)).toEqual(['Recepção'])
  })

  test('a banda segue a ordem da lista padrão (vocal, violão, bateria...)', () => {
    const { banda } = montarQuemVai(
      [
        atr('1', 'b', 'Bruno', 'Bateria'),
        atr('2', 'v', 'Vera', 'Vocal'),
        atr('3', 'k', 'Kai', 'Violão'),
      ],
      ETAPAS,
    )
    expect(banda.map((p) => p.nome)).toEqual(['Vera', 'Kai', 'Bruno'])
  })

  test('quem ainda espera o Desfazer vem marcado: o servidor não sabe dele', () => {
    const { banda } = montarQuemVai(
      [
        { ...atr('espera-1', 'd', 'Davi', 'Teclado', 'pendente'), emEspera: true },
        atr('2', 'v', 'Vera', 'Vocal'),
      ],
      ETAPAS,
    )
    expect(banda.find((p) => p.vinculoId === 'd')?.emEspera).toBe(true)
    expect(banda.find((p) => p.vinculoId === 'v')?.emEspera).toBe(false)
  })
})

describe('a situação da linha', () => {
  test('quem falta responder manda; depois a troca, a recusa e o aceite', () => {
    expect(estadoCombinado(['confirmada', 'pendente'])).toBe('pendente')
    expect(estadoCombinado(['confirmada', 'substituicao_pedida'])).toBe('substituicao_pedida')
    expect(estadoCombinado(['confirmada', 'recusada'])).toBe('recusada')
    expect(estadoCombinado(['confirmada', 'confirmada'])).toBe('confirmada')
  })

  test('papéis com situações diferentes dizem cada um a sua: "Vocal (aguardando), Violão (aceitou)"', () => {
    const { banda } = montarQuemVai(
      [atr('1', 'a', 'Ana', 'Vocal', 'pendente'), atr('2', 'a', 'Ana', 'Violão')],
      ETAPAS,
    )
    expect(descricaoDosPapeis(banda[0]!)).toBe('Vocal (aguardando), Violão (aceitou)')
  })
})

describe('"já tem": a função cheia explica', () => {
  test('uma, duas ou nenhuma pessoa', () => {
    expect(jaTemNaFuncao('Bateria', ['Bruno'])).toBe('Bateria: já tem Bruno.')
    expect(jaTemNaFuncao('Violão', ['Ana', 'Bruno'])).toBe('Violão: já têm Ana e Bruno.')
    expect(jaTemNaFuncao('Violão', ['Ana', 'Bruno', 'Carla'])).toBe(
      'Violão: já têm Ana, Bruno e Carla.',
    )
    expect(jaTemNaFuncao('Baixo', [])).toBeNull()
    expect(primeiroNome('Bruno Tavares')).toBe('Bruno')
  })
})
