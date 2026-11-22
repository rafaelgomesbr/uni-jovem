import { INICIO } from '@/testes/fixturas'
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
  frasesDoQueFalta,
  momentoDoDia,
  quandoFoiSalva,
  posicaoNoDia,
  seloDoCartaoDoLider,
  textoDaDespedida,
  textoDoObrigado,
  tituloDoBlocoDoDia,
  tocaNoLouvor,
  type EntradaDoQueFalta,
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

  test('"O encontro de ontem terminou. 12 presentes.": sem o nome do encontro, que nunca vira texto fixo (D79)', () => {
    expect(textoDaDespedida(ontem, agora)).toBe('O encontro de ontem terminou. 12 presentes.')
    expect(textoDaDespedida({ ...ontem, presentes: 1 }, agora)).toBe(
      'O encontro de ontem terminou. 1 presente.',
    )
    // Nenhum texto fixo cita o dia da semana: o título do encontro não entra na frase.
    expect(textoDaDespedida(ontem, agora)).not.toMatch(/sábado/i)
  })

  test('presença zerada ou desconhecida não entra: o zero não é um fato, é "ninguém marcou"', () => {
    expect(textoDaDespedida({ ...ontem, presentes: 0 }, agora)).toBe(
      'O encontro de ontem terminou.',
    )
    expect(textoDaDespedida({ ...ontem, presentes: null }, agora)).toBe(
      'O encontro de ontem terminou.',
    )
  })

  test('terminou hoje cedo: "de hoje"; passou mais de um dia: a data entre parênteses', () => {
    expect(textoDaDespedida({ ...ontem, inicio: '2026-11-22T11:00:00.000Z' }, agora)).toBe(
      'O encontro de hoje terminou. 12 presentes.',
    )
    expect(textoDaDespedida(ontem, new Date('2026-11-24T13:00:00.000Z'))).toBe(
      'O encontro de 21 nov. terminou. 12 presentes.',
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

describe('a UMA próxima ação do cartão do LÍDER (D75, ordem do documento de UX)', () => {
  const base: SituacaoDoLider = {
    momento: 'longe',
    rascunho: false,
    lembraveis: 0,
    pendentes: 0,
    faltaFuncao: [],
    semMusicas: false,
    semConvocados: false,
    naHoraDoCheckin: false,
    terminou: false,
    proximoAMarcar: false,
    semEncontro: false,
  }
  const acao = (s: Partial<SituacaoDoLider>) => acoesDoLider({ ...base, ...s })

  test('ninguém convocado ainda: "Chamar quem vai" vem ANTES do repertório (D79)', () => {
    expect(acao({ semConvocados: true, semMusicas: true })).toEqual({
      primaria: 'chamar',
      secundaria: 'repertorio',
    })
    expect(acao({ semConvocados: true })).toEqual({ primaria: 'chamar', secundaria: 'ver' })
    // O rascunho e o check-in ainda vêm antes.
    expect(acao({ semConvocados: true, rascunho: true }).primaria).toBe('publicar')
    expect(acao({ semConvocados: true, momento: 'agora' }).primaria).toBe('conduzir')
  })

  test('1. sem encontro marcado: "Marcar o próximo encontro", sem secundário', () => {
    expect(acao({ semEncontro: true })).toEqual({ primaria: 'marcarProximo', secundaria: null })
  })

  test('1. terminou e nada marcado depois: marcar o próximo e "Ver o resumo"', () => {
    expect(acao({ momento: 'fim', terminou: true, proximoAMarcar: true })).toEqual({
      primaria: 'marcarProximo',
      secundaria: 'verResumo',
    })
  })

  test('2. rascunho: Publicar vence tudo (e Editar é o caminho)', () => {
    expect(
      acao({ rascunho: true, lembraveis: 3, faltaFuncao: ['Bateria'], semMusicas: true }),
    ).toEqual({ primaria: 'publicar', secundaria: 'editar' })
  })

  test('3. falta gente responder: Lembrar os N, longe, na véspera e no dia antes das 2 h', () => {
    for (const momento of ['longe', 'vespera', 'dia'] as const) {
      expect(acao({ momento, lembraveis: 2, pendentes: 2 })).toEqual({
        primaria: 'lembrar',
        secundaria: 'verConvocados',
      })
    }
  })

  test('4. ninguém a lembrar mas falta uma função: Convocar a função', () => {
    expect(acao({ lembraveis: 0, faltaFuncao: ['Bateria'], semMusicas: true })).toEqual({
      primaria: 'convocarFuncao',
      secundaria: 'verConvocados',
    })
  })

  test('5. banda e respostas em dia, repertório vazio: Montar o repertório', () => {
    expect(acao({ semMusicas: true })).toEqual({
      primaria: 'repertorio',
      secundaria: 'verConvocados',
    })
    expect(acao({ momento: 'vespera', semMusicas: true }).primaria).toBe('repertorio')
  })

  test('6. de 2 h antes até começar: o check-in é o botão (e vence lembrar, banda e repertório)', () => {
    expect(
      acao({
        momento: 'dia',
        naHoraDoCheckin: true,
        lembraveis: 2,
        faltaFuncao: ['Bateria'],
        semMusicas: true,
      }),
    ).toEqual({ primaria: 'checkin', secundaria: 'aoVivo' })
  })

  test('7. acontecendo: Conduzir ao vivo, com o check-in ao lado (a hora de marcar quem chegou)', () => {
    expect(acao({ momento: 'agora', lembraveis: 2 })).toEqual({
      primaria: 'conduzir',
      secundaria: 'checkin',
    })
  })

  test('8. tudo certo: véspera e dia veem os convocados; longe, o encontro e o repertório', () => {
    expect(acao({ momento: 'vespera' })).toEqual({ primaria: 'verConvocados', secundaria: 'ver' })
    expect(acao({ momento: 'dia', naHoraDoCheckin: false })).toEqual({
      primaria: 'verConvocados',
      secundaria: 'ver',
    })
    expect(acao({})).toEqual({ primaria: 'ver', secundaria: 'repertorio' })
    // Já lembrou quem falta: o caminho é a lista, e não um segundo lembrete.
    expect(acao({ lembraveis: 0, pendentes: 2 })).toEqual({
      primaria: 'ver',
      secundaria: 'verConvocados',
    })
  })

  test('nenhum estado devolve duas ações em destaque: o secundário é sempre um caminho diferente', () => {
    const estados: Partial<SituacaoDoLider>[] = [
      { semEncontro: true },
      { rascunho: true },
      { momento: 'agora' },
      { momento: 'dia', naHoraDoCheckin: true },
      { lembraveis: 2, pendentes: 2 },
      { faltaFuncao: ['Bateria'] },
      { semMusicas: true },
      { momento: 'vespera' },
      {},
    ]
    for (const e of estados) {
      const r = acao(e)
      expect(r.primaria).not.toBe(r.secundaria)
    }
  })

  test('o líder do teste tem 2 pessoas a lembrar (a fixture bate com a tabela)', () => {
    expect(liderDoMomento().lembraveis).toBe(2)
  })
})

describe('"o que falta" do cartão: no máximo 2 frases (D75)', () => {
  const base: EntradaDoQueFalta = {
    convocados: 11,
    pendentes: 2,
    quemFalta: 'Faltam: Bruno e Camila',
    lembrou: null,
    faltaFuncao: ['Bateria'],
    semMusicas: true,
  }

  test('quem não respondeu, a banda e o repertório vazio: só as 2 mais importantes aparecem', () => {
    const frases = frasesDoQueFalta(base)
    expect(frases.map((f) => f.texto)).toEqual(['Faltam: Bruno e Camila', 'Falta: bateria'])
    expect(frases.map((f) => f.alerta)).toEqual([false, true])
  })

  test('todos responderam: "Todos responderam ✓" uma vez só, depois o que ainda falta', () => {
    const frases = frasesDoQueFalta({ ...base, pendentes: 0, quemFalta: '' })
    expect(frases.map((f) => f.texto)).toEqual(['Todos responderam ✓', 'Falta: bateria'])
    expect(frases.filter((f) => /Todos responderam/.test(f.texto))).toHaveLength(1)
  })

  test('tudo certo: uma frase só', () => {
    expect(
      frasesDoQueFalta({
        ...base,
        pendentes: 0,
        quemFalta: '',
        faltaFuncao: [],
        semMusicas: false,
      }),
    ).toEqual([{ texto: 'Todos responderam ✓', alerta: false }])
  })

  test('depois de lembrar, a frase é o que o líder fez (nunca a mesma coisa duas vezes)', () => {
    const frases = frasesDoQueFalta({
      ...base,
      lembrou: 'Você lembrou Bruno e Camila, hoje às 11:07.',
      faltaFuncao: [],
      semMusicas: false,
    })
    expect(frases.map((f) => f.texto)).toEqual(['Você lembrou Bruno e Camila, hoje às 11:07.'])
  })

  test('ninguém convocado e o repertório vazio', () => {
    expect(
      frasesDoQueFalta({
        ...base,
        convocados: 0,
        pendentes: 0,
        quemFalta: '',
        faltaFuncao: [],
      }).map((f) => f.texto),
    ).toEqual(['Ninguém foi convocado ainda.', 'O repertório está vazio.'])
  })

  test('nunca passa de 2 frases, qualquer que seja a combinação', () => {
    for (const convocados of [0, 5]) {
      for (const pendentes of [0, 2]) {
        for (const faltaFuncao of [[], ['Bateria', 'Teclado']]) {
          for (const semMusicas of [true, false]) {
            expect(
              frasesDoQueFalta({ ...base, convocados, pendentes, faltaFuncao, semMusicas }).length,
            ).toBeLessThanOrEqual(2)
          }
        }
      }
    }
  })
})

describe('vários encontros no mesmo dia (D79)', () => {
  const doDia = (ids: string[]) =>
    ids.map((id) => ({
      id,
      titulo: id,
      inicio: INICIO,
      fim: INICIO,
      duracaoMin: 60,
      fuso: 'America/Sao_Paulo',
      status: 'publicado' as const,
      situacao: 'adiante' as const,
      localNome: null,
      suaParte: [],
    }))

  test('"1 de 3": a posição do cartão entre os encontros do dia; um só ou sem lista, nada', () => {
    const m = momentoDeTeste({
      evento: eventoDoMomento({ id: 'b' }),
      doDia: doDia(['a', 'b', 'c']),
    })
    expect(posicaoNoDia(m)).toEqual({ indice: 2, total: 3 })
    expect(posicaoNoDia(momentoDeTeste({ doDia: doDia(['e1']) }))).toBeNull()
    expect(posicaoNoDia(momentoDeTeste())).toBeNull()
  })

  test('o título do bloco: "Hoje: 3 encontros", "Amanhã: 2 encontros" ou o dia', () => {
    const base = { evento: eventoDoMomento() }
    expect(
      tituloDoBlocoDoDia(
        momentoDeTeste({ ...base, ...RELOGIO.dia, doDia: doDia(['a', 'b', 'c']) }),
      ),
    ).toBe('Hoje: 3 encontros')
    expect(
      tituloDoBlocoDoDia(momentoDeTeste({ ...base, ...RELOGIO.vespera, doDia: doDia(['a', 'b']) })),
    ).toBe('Amanhã: 2 encontros')
    expect(tituloDoBlocoDoDia(momentoDeTeste({ ...base, doDia: doDia(['a', 'b']) }))).toMatch(
      /^Sáb\., \d+ de [a-z]{3}\.: 2 encontros$/,
    )
    expect(tituloDoBlocoDoDia(momentoDeTeste({ ...base, doDia: doDia(['a']) }))).toBeNull()
  })
})

describe('o selo do cartão do líder: só o que o botão principal não diz (D79)', () => {
  test('"Montar o repertório" já diz que está vazio: sem selo; outra ação: "Sem músicas"', () => {
    expect(
      seloDoCartaoDoLider({ primaria: 'repertorio', faltaFuncao: [], semMusicas: true }),
    ).toBeNull()
    expect(seloDoCartaoDoLider({ primaria: 'lembrar', faltaFuncao: [], semMusicas: true })).toBe(
      'Sem músicas',
    )
  })

  test('"Convocar bateria" já diz que falta: sem selo; outra ação: "Falta: bateria"; no máximo um', () => {
    expect(
      seloDoCartaoDoLider({
        primaria: 'convocarFuncao',
        faltaFuncao: ['Bateria'],
        semMusicas: false,
      }),
    ).toBeNull()
    expect(
      seloDoCartaoDoLider({ primaria: 'lembrar', faltaFuncao: ['Bateria'], semMusicas: true }),
    ).toBe('Falta: bateria')
  })
})

describe('o agradecimento a quem serviu: não diz "ontem" quando foi hoje (D79)', () => {
  const agora = new Date('2026-11-22T13:00:00.000Z')
  const fuso = 'America/Sao_Paulo'
  test('hoje, ontem e uma data', () => {
    expect(textoDoObrigado({ inicio: '2026-11-22T11:00:00.000Z', fuso }, agora)).toBe(
      'Obrigado por servir hoje.',
    )
    expect(textoDoObrigado({ inicio: '2026-11-21T19:00:00.000Z', fuso }, agora)).toBe(
      'Obrigado por servir ontem.',
    )
    expect(textoDoObrigado({ inicio: '2026-11-19T19:00:00.000Z', fuso }, agora)).toBe(
      'Obrigado por servir em 19 nov.',
    )
  })
})
