import { eventoDeTeste } from '@/testes/fixturas'

import { comTituloDoDia } from '../consultas'
import {
  equipeDoRascunho,
  escolhaDeData,
  fraseDoRascunho,
  tituloDaConferencia,
} from '../conferencia'

describe('conferência "Igual ao último encontro" (regras puras, D78)', () => {
  test('qual data está marcada: a sugerida, uma semana depois ou "Outra data"', () => {
    const base = { aberta: false, sugerida: '2026-11-28', depois: '2026-12-05' }
    expect(escolhaDeData({ ...base, dataAtual: '2026-11-28' })).toBe('sugerida')
    expect(escolhaDeData({ ...base, dataAtual: '2026-12-05' })).toBe('depois')
    expect(escolhaDeData({ ...base, dataAtual: '2026-12-12' })).toBe('outra')
    expect(escolhaDeData({ ...base, aberta: true, dataAtual: '2026-11-28' })).toBe('outra')
    expect(escolhaDeData({ ...base, dataAtual: null })).toBe('sugerida')
  })

  test('o título acompanha o dia: "Sábado" num domingo é "Domingo", "Sábado" num sábado fica', () => {
    expect(tituloDaConferencia(null, 'Sábado', '2026-11-29')).toBe('Domingo')
    expect(tituloDaConferencia(null, 'Sábado', '2026-12-02')).toBe('Quarta')
    expect(tituloDaConferencia(null, 'Sábado', '2026-11-28')).toBe('Sábado')
  })

  test('o título que a pessoa escreveu nunca muda, em nenhum dia', () => {
    expect(tituloDaConferencia(null, 'Sábado Jovem', '2026-11-29')).toBe('Sábado Jovem')
    expect(tituloDaConferencia(null, 'Retiro', '2026-12-02')).toBe('Retiro')
  })

  test('com o encontro carregado, vale o título dele', () => {
    expect(tituloDaConferencia({ titulo: 'Domingo' }, 'Sábado', '2026-11-29')).toBe('Domingo')
  })

  test('a frase do rascunho diz que ninguém foi avisado e quantos receberão ao publicar', () => {
    expect(fraseDoRascunho(0)).toBe('Ninguém foi avisado ainda.')
    expect(fraseDoRascunho(1)).toBe(
      'Ninguém foi avisado ainda. Ao publicar, 1 pessoa recebe o aviso.',
    )
    expect(fraseDoRascunho(11)).toBe(
      'Ninguém foi avisado ainda. Ao publicar, 11 pessoas recebem o aviso.',
    )
  })

  test('a equipe vem do encontro carregado (com o bloco) e, enquanto ele carrega, da cópia', () => {
    const resumo = {
      convocados: {
        pessoas: 1,
        itens: [
          {
            atribuicaoId: 'a1',
            vinculoId: 'v1',
            nome: 'Ana',
            funcao: 'Violão',
            etapaTitulo: 'Louvor',
          },
        ],
      },
    }
    expect(equipeDoRascunho(null, resumo)).toEqual([
      { chave: 'a1', vinculoId: 'v1', nome: 'Ana', funcao: 'Violão', onde: 'Louvor' },
    ])
    const detalhe = eventoDeTeste()
    const doEncontro = equipeDoRascunho(detalhe, resumo)
    expect(doEncontro).toEqual([
      expect.objectContaining({ nome: 'Bruno Lima', funcao: 'responsável', onde: 'Louvor' }),
    ])
  })
})

describe('título que combina com o dia, na exibição de encontros já gravados (D78)', () => {
  const FUSO = 'America/Sao_Paulo'
  // Domingo, 29/11/2026, 16:00 em Brasília.
  const domingo = { inicio: '2026-11-29T19:00:00.000Z', fuso: FUSO }

  test('"Sábado" gravado num domingo aparece como "Domingo"; os dados não são mexidos', () => {
    const gravado = { titulo: 'Sábado', ...domingo }
    expect(comTituloDoDia(gravado).titulo).toBe('Domingo')
    expect(gravado.titulo).toBe('Sábado')
  })

  test('título escrito pela pessoa, ou que já bate com o dia, vem como está (mesmo objeto)', () => {
    const escrito = { titulo: 'Sábado Jovem', ...domingo }
    expect(comTituloDoDia(escrito)).toBe(escrito)
    const certo = { titulo: 'Domingo', ...domingo }
    expect(comTituloDoDia(certo)).toBe(certo)
  })

  test('o dia é o do fuso do encontro, não o do UTC (23:30 em Brasília ainda é sábado)', () => {
    // 29/11 02:30 UTC é sábado 28/11 23:30 em Brasília.
    const tarde = { titulo: 'Sábado', inicio: '2026-11-29T02:30:00.000Z', fuso: FUSO }
    expect(comTituloDoDia(tarde).titulo).toBe('Sábado')
  })
})
