import {
  RELOGIO,
  eventoDoMomento,
  liderDoMomento,
  momentoDeTeste,
  parteDoMomento,
} from '@/testes/momento'

import {
  acoesDoLider,
  acoesDoMembro,
  descreverParte,
  emOnde,
  estaNoLouvor,
  etiquetaDoMomento,
  momentoDoDia,
  quandoFoiSalva,
  textoDaDespedida,
  tocaNoLouvor,
  type SituacaoDoLider,
  type SituacaoDoMembro,
} from '../momento'
import { dataCurta } from '../quando'

describe('o momento do dia (a Aurora e o sol falam juntos)', () => {
  test('o estado do relógio vira o momento da Tela e a pose do sol', () => {
    expect(momentoDoDia(momentoDeTeste())).toBe('longe')
    expect(momentoDoDia(momentoDeTeste({ ...RELOGIO.vespera }))).toBe('vespera')
    expect(momentoDoDia(momentoDeTeste({ ...RELOGIO.dia }))).toBe('dia')
    expect(momentoDoDia(momentoDeTeste({ ...RELOGIO.agora }))).toBe('agora')
  })

  test('sem encontro, mas com um que terminou há pouco: o poente', () => {
    const m = momentoDeTeste({
      evento: null,
      estado: null,
      minutosParaInicio: null,
      recemTerminado: {
        id: 'e0',
        titulo: 'Sábado Jovem',
        inicio: '2026-11-21T19:00:00.000Z',
        fim: '2026-11-21T20:00:00.000Z',
        fuso: 'America/Sao_Paulo',
        presentes: 12,
        euServi: true,
      },
    })
    expect(momentoDoDia(m)).toBe('fim')
  })

  test('quem serviu ontem vê o poente mesmo com o próximo encontro longe; quem não serviu, não', () => {
    const terminou = (euServi: boolean) => ({
      id: 'e0',
      titulo: 'Sábado Jovem',
      inicio: '2026-11-21T19:00:00.000Z',
      fim: '2026-11-21T20:00:00.000Z',
      fuso: 'America/Sao_Paulo',
      presentes: null,
      euServi,
    })
    expect(momentoDoDia(momentoDeTeste({ recemTerminado: terminou(true) }))).toBe('fim')
    expect(momentoDoDia(momentoDeTeste({ recemTerminado: terminou(false) }))).toBe('longe')
  })
})

describe('a etiqueta do alto do cartão', () => {
  test('longe: "EM 5 DIAS"; véspera: "AMANHÃ · 16:00"; no dia: "HOJE · EM 3 H"; ao vivo; terminou', () => {
    expect(etiquetaDoMomento(momentoDeTeste())).toBe('EM 5 DIAS')
    expect(etiquetaDoMomento(momentoDeTeste({ ...RELOGIO.vespera }))).toBe('AMANHÃ · 16:00')
    expect(etiquetaDoMomento(momentoDeTeste({ ...RELOGIO.dia }))).toBe('HOJE · EM 3 H')
    expect(etiquetaDoMomento(momentoDeTeste({ ...RELOGIO.dia, minutosParaInicio: 40 }))).toBe(
      'HOJE · EM 40 MIN',
    )
    expect(etiquetaDoMomento(momentoDeTeste({ ...RELOGIO.agora }))).toBe('ACONTECENDO AGORA')
    expect(etiquetaDoMomento(momentoDeTeste({ estado: 'terminou' }))).toBe('TERMINOU')
  })

  test('rascunho (só a organização) ganha o prefixo; sem encontro, "NADA MARCADO"', () => {
    expect(
      etiquetaDoMomento(momentoDeTeste({ evento: eventoDoMomento({ status: 'rascunho' }) })),
    ).toBe('RASCUNHO · EM 5 DIAS')
    expect(etiquetaDoMomento(momentoDeTeste({ evento: null, estado: null }))).toBe('NADA MARCADO')
  })
})

describe('os nomes da parte da pessoa', () => {
  test('"Louvor · Vocal", e só a função quando a convocação é ao encontro todo', () => {
    expect(descreverParte({ funcao: 'Vocal', etapaTitulo: 'Louvor' })).toBe('Louvor · Vocal')
    expect(descreverParte({ funcao: 'Recepção', etapaTitulo: null })).toBe('Recepção')
  })

  test('"no Louvor", "em Recepção": a preposição que fala melhor', () => {
    expect(emOnde({ funcao: 'Vocal', etapaTitulo: 'Louvor' })).toBe('no Louvor')
    expect(emOnde({ funcao: 'Recepção', etapaTitulo: null })).toBe('em Recepção')
  })

  test('toca no louvor: só com a convocação de louvor confirmada', () => {
    expect(tocaNoLouvor([parteDoMomento({ estado: 'confirmada' })])).toBe(true)
    expect(tocaNoLouvor([parteDoMomento({ estado: 'pendente' })])).toBe(false)
    expect(tocaNoLouvor([parteDoMomento({ estado: 'recusada' })])).toBe(false)
    expect(
      tocaNoLouvor([
        parteDoMomento({ estado: 'confirmada', funcao: 'Recepção', etapaTitulo: null }),
      ]),
    ).toBe(false)
    // Função de banda vale mesmo com a pessoa convocada ao encontro todo.
    expect(
      tocaNoLouvor([
        parteDoMomento({ estado: 'confirmada', funcao: 'Bateria', etapaTitulo: null }),
      ]),
    ).toBe(true)
  })
})

describe('estar no louvor (D73): quem tem a convocação de louvor que ainda vale', () => {
  test('aceita ou pendente conta; recusada e outra função não', () => {
    expect(estaNoLouvor([parteDoMomento({ estado: 'confirmada' })])).toBe(true)
    expect(estaNoLouvor([parteDoMomento({ estado: 'pendente' })])).toBe(true)
    expect(estaNoLouvor([parteDoMomento({ estado: 'substituicao_pedida' })])).toBe(true)
    expect(estaNoLouvor([parteDoMomento({ estado: 'recusada' })])).toBe(false)
    expect(
      estaNoLouvor([
        parteDoMomento({ estado: 'confirmada', funcao: 'Recepção', etapaTitulo: null }),
      ]),
    ).toBe(false)
    expect(estaNoLouvor([])).toBe(false)
  })
})

describe('a faixa de cima quando o encontro de ontem terminou (D73): diz QUAL encontro', () => {
  const agora = new Date('2026-11-22T13:00:00.000Z')
  const ontem = {
    titulo: 'Sábado',
    inicio: '2026-11-21T19:00:00.000Z',
    fuso: 'America/Sao_Paulo',
    presentes: 12,
  }

  test('"Sábado de ontem terminou. 12 presentes." (não "Sábado terminou" ao lado de "Sábado, em 6 dias")', () => {
    expect(textoDaDespedida(ontem, agora)).toBe('Sábado de ontem terminou. 12 presentes.')
    expect(textoDaDespedida({ ...ontem, presentes: 1 }, agora)).toBe(
      'Sábado de ontem terminou. 1 presente.',
    )
  })

  test('presença zerada ou desconhecida não entra: o zero não é um fato, é "ninguém marcou"', () => {
    expect(textoDaDespedida({ ...ontem, presentes: 0 }, agora)).toBe('Sábado de ontem terminou.')
    expect(textoDaDespedida({ ...ontem, presentes: null }, agora)).toBe('Sábado de ontem terminou.')
  })

  test('terminou hoje cedo: "de hoje"; passou mais de um dia: a data entre parênteses', () => {
    expect(textoDaDespedida({ ...ontem, inicio: '2026-11-22T11:00:00.000Z' }, agora)).toBe(
      'Sábado de hoje terminou. 12 presentes.',
    )
    expect(textoDaDespedida(ontem, new Date('2026-11-24T13:00:00.000Z'))).toBe(
      'Sábado (Sáb., 21 de nov.) terminou. 12 presentes.',
    )
  })
})

describe('datas do cartão', () => {
  test('"Sáb., 28 de nov.": o dia da semana abreviado, no fuso do encontro', () => {
    expect(dataCurta('2026-11-28T19:00:00.000Z', 'America/Sao_Paulo')).toBe('Sáb., 28 de nov.')
    // 23:30 em São Paulo ainda é sexta; em UTC já é sábado.
    expect(dataCurta('2026-11-28T02:30:00.000Z', 'America/Sao_Paulo')).toBe('Sex., 27 de nov.')
  })

  test('a cópia salva: "hoje, 14:32" ou a data de outro dia', () => {
    const agora = new Date(2026, 10, 22, 18, 0)
    expect(quandoFoiSalva(new Date(2026, 10, 22, 14, 32).getTime(), agora)).toBe('hoje, 14:32')
    expect(quandoFoiSalva(new Date(2026, 10, 21, 9, 5).getTime(), agora)).toBe('21/11, 09:05')
  })
})

describe('o botão do cartão do MEMBRO (tabela 3.1 do UX)', () => {
  const base: SituacaoDoMembro = {
    momento: 'longe',
    pendente: false,
    musicoConfirmado: false,
    podeSeInscrever: false,
    depoisDeUmEncontro: false,
    temRepertorio: false,
  }
  const acao = (s: Partial<SituacaoDoMembro>) => acoesDoMembro({ ...base, ...s })

  test('convocação pendente: Aceitar e Não posso ir, em qualquer estado até o dia (e no dia)', () => {
    for (const momento of ['longe', 'vespera', 'dia', 'agora'] as const) {
      expect(acao({ momento, pendente: true })).toEqual({
        primaria: 'aceitar',
        secundaria: 'naoPossoIr',
      })
    }
  })

  test('longe e confirmado: o músico abre o repertório; outra parte só vê o encontro', () => {
    expect(acao({ musicoConfirmado: true })).toEqual({ primaria: 'repertorio', secundaria: 'ver' })
    expect(acao({})).toEqual({ primaria: 'ver', secundaria: null })
  })

  test('quem não toca vê o repertório em leitura quando o encontro tem músicas (D73)', () => {
    expect(acao({ temRepertorio: true })).toEqual({ primaria: 'ver', secundaria: 'repertorio' })
    expect(acao({ temRepertorio: true, depoisDeUmEncontro: true })).toEqual({
      primaria: 'verProximo',
      secundaria: 'repertorio',
    })
    // O músico confirmado segue com o dele, no primário.
    expect(acao({ temRepertorio: true, musicoConfirmado: true })).toEqual({
      primaria: 'repertorio',
      secundaria: 'ver',
    })
    // Com a inscrição aberta, o primário é Inscrever-me (o repertório vai para um botão à parte).
    expect(acao({ temRepertorio: true, podeSeInscrever: true })).toEqual({
      primaria: 'inscrever',
      secundaria: 'ver',
    })
  })

  test('longe, público e não inscrito: Inscrever-me e Ver o encontro', () => {
    expect(acao({ podeSeInscrever: true })).toEqual({ primaria: 'inscrever', secundaria: 'ver' })
  })

  test('véspera e no dia: Como chegar; acontecendo: Acompanhar ao vivo, sem secundário', () => {
    expect(acao({ momento: 'vespera' })).toEqual({ primaria: 'comoChegar', secundaria: 'ver' })
    expect(acao({ momento: 'dia', musicoConfirmado: true })).toEqual({
      primaria: 'comoChegar',
      secundaria: 'ver',
    })
    expect(acao({ momento: 'agora' })).toEqual({ primaria: 'aoVivo', secundaria: null })
  })

  test('depois de um encontro que terminou: "Ver o próximo encontro"', () => {
    expect(acao({ momento: 'fim', depoisDeUmEncontro: true })).toEqual({
      primaria: 'verProximo',
      secundaria: null,
    })
  })
})

describe('o botão do cartão do LÍDER (tabela 3.2 do UX)', () => {
  const base: SituacaoDoLider = {
    momento: 'longe',
    rascunho: false,
    lembraveis: 0,
    pendentes: 0,
    faltaFuncao: [],
    naHoraDoCheckin: false,
    terminou: false,
    proximoAMarcar: false,
    semEncontro: false,
  }
  const acao = (s: Partial<SituacaoDoLider>) => acoesDoLider({ ...base, ...s })

  test('sem encontro marcado: "Marcar o próximo sábado", sem secundário', () => {
    expect(acao({ semEncontro: true })).toEqual({ primaria: 'marcarProximo', secundaria: null })
  })

  test('terminou e nada marcado depois: "Marcar o próximo sábado" e "Ver o resumo"', () => {
    expect(acao({ momento: 'fim', terminou: true, proximoAMarcar: true })).toEqual({
      primaria: 'marcarProximo',
      secundaria: 'verResumo',
    })
  })

  test('rascunho: Publicar e Editar', () => {
    expect(acao({ rascunho: true })).toEqual({ primaria: 'publicar', secundaria: 'editar' })
  })

  test('publicado e longe, falta resposta: Lembrar os N e Ver convocados', () => {
    expect(acao({ lembraveis: 2, pendentes: 2 })).toEqual({
      primaria: 'lembrar',
      secundaria: 'verConvocados',
    })
  })

  test('publicado e longe, ninguém a lembrar mas falta uma função: Convocar a função', () => {
    expect(acao({ lembraveis: 0, faltaFuncao: ['Bateria'] })).toEqual({
      primaria: 'convocarFuncao',
      secundaria: 'verConvocados',
    })
  })

  test('publicado e longe, já lembrou quem falta: Ver convocados', () => {
    expect(acao({ lembraveis: 0, pendentes: 2 })).toEqual({
      primaria: 'verConvocados',
      secundaria: 'ver',
    })
  })

  test('publicado, tudo respondido: Ver o encontro e Abrir o repertório', () => {
    expect(acao({})).toEqual({ primaria: 'ver', secundaria: 'repertorio' })
  })

  test('véspera: Ver convocados e Ver o encontro; no dia antes das 2 h, o mesmo', () => {
    expect(acao({ momento: 'vespera' })).toEqual({ primaria: 'verConvocados', secundaria: 'ver' })
    expect(acao({ momento: 'dia', naHoraDoCheckin: false })).toEqual({
      primaria: 'verConvocados',
      secundaria: 'ver',
    })
  })

  test('no dia, de 2 h antes: Fazer check-in e Abrir ao vivo; acontecendo: Conduzir e Check-in', () => {
    expect(acao({ momento: 'dia', naHoraDoCheckin: true })).toEqual({
      primaria: 'checkin',
      secundaria: 'aoVivo',
    })
    expect(acao({ momento: 'agora' })).toEqual({ primaria: 'conduzir', secundaria: 'checkin' })
  })

  test('o líder do teste tem 2 pessoas a lembrar (a fixture bate com a tabela)', () => {
    expect(liderDoMomento().lembraveis).toBe(2)
  })
})
