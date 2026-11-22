import { textosDaLinhaParaResponder } from '../ParaResponder'

const FUSO = 'America/Sao_Paulo'
// 28/11/2026, 16:00 em São Paulo (UTC-3).
const SABADO_16H = '2026-11-28T19:00:00.000Z'
const SABADO_19H30 = '2026-11-28T22:30:00.000Z'

describe('"Para responder": o título é o encontro, não a função (D75)', () => {
  test('o título é o nome do encontro; a descrição diz o dia, a hora e a sua função', () => {
    const textos = textosDaLinhaParaResponder(
      {
        eventoTitulo: 'Sábado Jovem',
        eventoInicio: SABADO_16H,
        funcao: 'integrante',
        etapaTitulo: null,
      },
      FUSO,
    )
    expect(textos.titulo).toBe('Sábado Jovem')
    // "integrante" nunca é o título, e a função ganha a inicial maiúscula.
    expect(textos.descricao).toMatch(/^Sáb\., 28 de nov\. · 16:00 · Você: Integrante$/)
  })

  test('com a etapa, a parte vem como "Louvor · Vocal"', () => {
    const textos = textosDaLinhaParaResponder(
      {
        eventoTitulo: 'Sábado Jovem',
        eventoInicio: SABADO_16H,
        funcao: 'Vocal',
        etapaTitulo: 'Louvor',
      },
      FUSO,
    )
    expect(textos.descricao).toMatch(/Você: Louvor · Vocal$/)
  })

  test('dois encontros do mesmo nome no mesmo dia se distinguem pela hora', () => {
    const base = { eventoTitulo: 'Sábado Jovem', funcao: 'integrante', etapaTitulo: null }
    const a = textosDaLinhaParaResponder({ ...base, eventoInicio: SABADO_16H }, FUSO)
    const b = textosDaLinhaParaResponder({ ...base, eventoInicio: SABADO_19H30 }, FUSO)
    expect(a.titulo).toBe(b.titulo)
    expect(a.descricao).not.toBe(b.descricao)
    expect(a.descricao).toContain('16:00')
    expect(b.descricao).toContain('19:30')
  })

  test('dois encontros no mesmo dia e na mesma hora se distinguem pela função', () => {
    const base = { eventoTitulo: 'Sábado Jovem', eventoInicio: SABADO_16H }
    const a = textosDaLinhaParaResponder({ ...base, funcao: 'Recepção', etapaTitulo: null }, FUSO)
    const b = textosDaLinhaParaResponder({ ...base, funcao: 'Vocal', etapaTitulo: 'Louvor' }, FUSO)
    expect(a.descricao).not.toBe(b.descricao)
  })
})
