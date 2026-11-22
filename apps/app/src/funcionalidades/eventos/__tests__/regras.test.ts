import { ETAPAS, eventoDeTeste, minutos } from '@/testes/fixturas'

import {
  mudancasDoEvento,
  previaDasDatas,
  rascunhoDoEvento,
  regraDoRascunho,
  regraVazia,
  validarRascunho,
} from '../formulario'
import { descreverRegra } from '../nomes'
import {
  acoesDeStatus,
  diasAteOEncontro,
  etiquetaDoEncontro,
  faseDoEncontro,
  momentoDaFase,
  motivoSemInscricao,
  reordenarEtapas,
} from '../regras'

const FUSO = 'America/Sao_Paulo'

describe('regras de evento na tela', () => {
  test('ações de status seguem podeMudarStatus do domínio', () => {
    expect(acoesDeStatus('rascunho')).toMatchObject({
      publicar: true,
      cancelar: false,
      excluir: true,
    })
    expect(acoesDeStatus('publicado')).toMatchObject({
      publicar: false,
      adiar: true,
      cancelar: true,
      encerrar: true,
      excluir: false,
    })
    expect(acoesDeStatus('cancelado')).toEqual({
      publicar: false,
      adiar: false,
      cancelar: false,
      encerrar: false,
      excluir: false,
    })
  })

  test('reordenar recalcula os horários previstos com calcularHorarios', () => {
    const novo = reordenarEtapas(eventoDeTeste(), [ETAPAS[1], ETAPAS[0], ETAPAS[2]])
    expect(novo.etapas.map((e) => e.titulo)).toEqual(['Louvor', 'Boas-vindas', 'Encerramento'])
    expect(novo.etapas[0]?.inicioPrevisto).toBe(minutos(0))
    expect(novo.etapas[1]?.inicioPrevisto).toBe(minutos(15))
    // Lista incompleta não mexe em nada (a API recusaria com 409).
    expect(reordenarEtapas(eventoDeTeste(), [ETAPAS[0]]).etapas[0]?.titulo).toBe('Boas-vindas')
  })

  test('inscrição: aberta só para publicado, futuro e dentro do prazo', () => {
    const agora = new Date('2026-11-14T12:00:00.000Z')
    expect(motivoSemInscricao(eventoDeTeste(), agora)).toBeNull()
    expect(motivoSemInscricao(eventoDeTeste({ status: 'rascunho' }), agora)).toBe('nao_publicado')
    expect(
      motivoSemInscricao(eventoDeTeste({ inscricaoAte: '2026-11-10T00:00:00.000Z' }), agora),
    ).toBe('prazo_encerrado')
  })
})

describe('formulário de evento', () => {
  test('editar sem mudar nada gera um PATCH vazio; mudar o título manda só o título', () => {
    const evento = eventoDeTeste()
    const { dados } = validarRascunho(rascunhoDoEvento(evento), {
      fuso: FUSO,
      duracaoOpcional: false,
    })
    expect(dados).not.toBeNull()
    expect(mudancasDoEvento(evento, dados!, null)).toEqual({})
    const { dados: novos } = validarRascunho(
      { ...rascunhoDoEvento(evento), titulo: 'Outro título' },
      { fuso: FUSO, duracaoOpcional: false },
    )
    expect(mudancasDoEvento(evento, novos!, null)).toEqual({ titulo: 'Outro título' })
  })

  test('prazo de inscrição depois do início é recusado', () => {
    const depois = new Date(Date.parse(minutos(60 * 24)))
    const r = {
      ...rascunhoDoEvento(eventoDeTeste()),
      inscricaoData: depois.toISOString().slice(0, 10),
    }
    const { erros } = validarRascunho(r, { fuso: FUSO, duracaoOpcional: false })
    expect(erros.inscricaoData).toBe(
      'O prazo de inscrição precisa terminar antes do início do evento.',
    )
  })

  test('mensal "na última sexta" a partir da data escolhida, com prévia', () => {
    const { regra } = regraDoRascunho(
      { ...regraVazia(), repeticao: 'mensal', modoMensal: 'semana_do_mes', semanaDoMes: -1 },
      '2026-11-27',
    )
    expect(regra).toEqual({
      frequencia: 'mensal',
      modo: 'semana_do_mes',
      semana: -1,
      diaDaSemana: 5,
    })
    expect(descreverRegra(regra!, '19:30')).toBe('Todo mês, na última sexta-feira, às 19:30')
    expect(previaDasDatas(regra!, '2026-11-27', null, 3)).toEqual([
      '2026-11-27',
      '2026-12-25',
      '2027-01-29',
    ])
  })

  test('semanal sem dia marcado usa o dia da data escolhida', () => {
    const { regra } = regraDoRascunho({ ...regraVazia(), repeticao: 'semanal' }, '2026-11-21')
    expect(regra).toEqual({ frequencia: 'semanal', intervaloSemanas: 1, diasDaSemana: [6] })
    expect(descreverRegra(regra!)).toBe('Toda semana, aos sábados')
  })
})

describe('o relógio do encontro (D69)', () => {
  // Sábado 28/11/2026, 16:00 em São Paulo (19:00 UTC), uma hora de duração.
  const SABADO = { inicio: '2026-11-28T19:00:00.000Z', fuso: FUSO, duracaoMin: 60 }
  const em = (iso: string) => new Date(iso)

  test('as fases: longe, véspera, no dia, check-in (2 h antes), acontecendo e terminou', () => {
    expect(faseDoEncontro(SABADO, em('2026-11-22T15:00:00.000Z'))).toBe('longe')
    expect(faseDoEncontro(SABADO, em('2026-11-27T20:00:00.000Z'))).toBe('vespera')
    expect(faseDoEncontro(SABADO, em('2026-11-28T12:00:00.000Z'))).toBe('no_dia')
    // 14:30 em São Paulo: falta 1 h 30.
    expect(faseDoEncontro(SABADO, em('2026-11-28T17:30:00.000Z'))).toBe('checkin')
    expect(faseDoEncontro(SABADO, em('2026-11-28T19:10:00.000Z'))).toBe('acontecendo')
    expect(faseDoEncontro(SABADO, em('2026-11-28T20:01:00.000Z'))).toBe('terminou')
  })

  test('a véspera e o dia usam o calendário do fuso do encontro, não o do aparelho', () => {
    // 01:00 UTC do dia 28 ainda é noite de sexta em São Paulo: o sábado é amanhã (véspera).
    expect(diasAteOEncontro(SABADO, em('2026-11-28T01:00:00.000Z'))).toBe(1)
    // 04:00 UTC já é 01:00 de sábado lá: é hoje.
    expect(diasAteOEncontro(SABADO, em('2026-11-28T04:00:00.000Z'))).toBe(0)
  })

  test('a etiqueta ao lado do título e a luz da tela acompanham a fase', () => {
    expect(etiquetaDoEncontro(SABADO, em('2026-11-23T15:00:00.000Z'))).toBe('Em 5 dias')
    expect(etiquetaDoEncontro(SABADO, em('2026-11-27T20:00:00.000Z'))).toBe('Amanhã')
    expect(etiquetaDoEncontro(SABADO, em('2026-11-28T12:00:00.000Z'))).toBe('Hoje')
    expect(etiquetaDoEncontro(SABADO, em('2026-11-28T19:10:00.000Z'))).toBe('Acontecendo agora')
    expect(etiquetaDoEncontro(SABADO, em('2026-11-29T12:00:00.000Z'))).toBe('Terminou')
    expect(momentoDaFase('longe')).toBe('longe')
    expect(momentoDaFase('checkin')).toBe('dia')
    expect(momentoDaFase('acontecendo')).toBe('agora')
    expect(momentoDaFase('terminou')).toBe('fim')
  })
})
