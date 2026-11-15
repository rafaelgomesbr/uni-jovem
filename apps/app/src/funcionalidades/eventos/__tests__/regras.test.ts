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
import { acoesDeStatus, motivoSemInscricao, reordenarEtapas } from '../regras'

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
