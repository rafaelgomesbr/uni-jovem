import { describe, expect, it } from 'vitest'
import {
  acidenteDoTom,
  casaDoCapotraste,
  converterParaChordPro,
  detectarFormato,
  ehLinhaDeAcordes,
  lerAcorde,
  lerCifra,
  lerTom,
  metadadosDaCifra,
  nomeDoTom,
  normalizarCifra,
  prepararCifra,
  semitonsEntre,
  simbolosDeAcidente,
  tomQueSeToca,
  transporAcorde,
  transporCifra,
  transporTom,
} from '../src/index.ts'

describe('ler acorde', () => {
  it.each([
    ['C', 'C', '', null],
    ['Am7', 'A', 'm7', null],
    ['D/F#', 'D', '', 'F#'],
    ['Bbmaj7', 'Bb', 'maj7', null],
    ['F#m7b5', 'F#', 'm7b5', null],
    ['Gsus4', 'G', 'sus4', null],
    ['C#dim7', 'C#', 'dim7', null],
    ['E♭', 'Eb', '', null],
    ['F♯m', 'F#', 'm', null],
    ['Cadd9/E', 'C', 'add9', 'E'],
    ['C6/9', 'C', '6/9', null],
    ['Dm(maj7)', 'D', 'm(maj7)', null],
    ['Aaug', 'A', 'aug', null],
    ['C+', 'C', '+', null],
    ['Bº', 'B', 'º', null],
  ])('%s', (texto, raiz, qualidade, baixo) => {
    expect(lerAcorde(texto)).toEqual({ raiz, qualidade, baixo })
  })

  it.each(['', 'H', 'Z7', 'a', 'Sol', 'Amor', 'Em nome', 'C/', '/E', 'Cx'])(
    'não é acorde: %j',
    (texto) => {
      expect(lerAcorde(texto)).toBeNull()
    },
  )

  it('troca ♯ e ♭ só nas notas, para desenhar', () => {
    expect(simbolosDeAcidente('F#m7/C#')).toBe('F♯m7/C♯')
    expect(simbolosDeAcidente('Bbmaj7')).toBe('B♭maj7')
    expect(simbolosDeAcidente('Gb')).toBe('G♭')
    expect(simbolosDeAcidente('Am7b5')).toBe('Am7b5')
    expect(simbolosDeAcidente('*Pausa')).toBe('*Pausa')
  })
})

describe('transpor acorde', () => {
  it.each([
    ['C', 2, 'D'],
    ['C', 1, 'C#'],
    ['B', 1, 'C'],
    ['E', 1, 'F'],
    ['Am7', 3, 'Cm7'],
    ['D/F#', 2, 'E/G#'],
    ['G', 12, 'G'],
    ['G', -12, 'G'],
    ['G', 24, 'G'],
    ['C', -1, 'B'],
    ['C', -13, 'B'],
    ['Cmaj7', 5, 'Fmaj7'],
    ['Gsus4', 2, 'Asus4'],
    ['F#m7b5', 1, 'Gm7b5'],
    ['Edim', 2, 'F#dim'],
    ['Cadd9/E', 7, 'Gadd9/B'],
  ])('%s %i = %s', (acorde, semitons, esperado) => {
    expect(transporAcorde(acorde, semitons)).toBe(esperado)
  })

  it('segue o gosto do próprio acorde quando não há tom (bemol fica bemol)', () => {
    expect(transporAcorde('Bb', 2)).toBe('C')
    expect(transporAcorde('Bb', 1)).toBe('B')
    expect(transporAcorde('Eb', 1)).toBe('E')
    expect(transporAcorde('Bb', -1)).toBe('A')
    expect(transporAcorde('Db', 3)).toBe('E')
    expect(transporAcorde('C', 3)).toBe('D#')
    expect(transporAcorde('Bb', 3)).toBe('Db')
  })

  it('usa a grafia pedida pelo tom de chegada', () => {
    expect(transporAcorde('C', 3, 'bemol')).toBe('Eb')
    expect(transporAcorde('C', 3, 'sustenido')).toBe('D#')
    expect(transporAcorde('G/B', 3, 'bemol')).toBe('Bb/D')
    expect(transporAcorde('F#', 1, 'bemol')).toBe('G')
  })

  it('o que não é acorde volta igual', () => {
    expect(transporAcorde('Refrão', 2)).toBe('Refrão')
    expect(transporAcorde('*Pausa', 2)).toBe('*Pausa')
  })
})

describe('tons', () => {
  it('lê e normaliza o nome do tom', () => {
    expect(nomeDoTom('g')).toBe('G')
    expect(nomeDoTom(' Am ')).toBe('Am')
    expect(nomeDoTom('f#m')).toBe('F#m')
    expect(nomeDoTom('A♭')).toBe('Ab')
    expect(nomeDoTom('Em7')).toBe('Em')
    expect(nomeDoTom('Gmaj7')).toBe('G')
    expect(nomeDoTom('Cmin')).toBe('Cm')
    expect(nomeDoTom('')).toBeNull()
    expect(nomeDoTom(null)).toBeNull()
    expect(nomeDoTom('X')).toBeNull()
    expect(nomeDoTom('G/B')).toBeNull()
    expect(lerTom('Dm')).toEqual({ raiz: 'D', menor: true })
  })

  it('transpõe o tom com a grafia da tonalidade de chegada', () => {
    expect(transporTom('G', 2)).toBe('A')
    expect(transporTom('G', 3)).toBe('Bb')
    expect(transporTom('E', 2)).toBe('F#')
    expect(transporTom('C', 1)).toBe('Db')
    expect(transporTom('A', 1)).toBe('Bb')
    expect(transporTom('D', 1)).toBe('Eb')
    expect(transporTom('Em', 2)).toBe('F#m')
    expect(transporTom('Am', 4)).toBe('C#m')
    expect(transporTom('Am', 1)).toBe('Bbm')
    expect(transporTom('Dm', 12)).toBe('Dm')
    expect(transporTom('G', -2)).toBe('F')
    expect(transporTom('C', -1)).toBe('B')
    expect(transporTom('???', 2)).toBeNull()
  })

  it('distância entre tons, de 0 a 11 para cima', () => {
    expect(semitonsEntre('G', 'A')).toBe(2)
    expect(semitonsEntre('A', 'G')).toBe(10)
    expect(semitonsEntre('G', 'G')).toBe(0)
    expect(semitonsEntre('C', 'Db')).toBe(1)
    expect(semitonsEntre('C', 'C#')).toBe(1)
    expect(semitonsEntre('Bb', 'A#')).toBe(0)
    expect(semitonsEntre('Em', 'G')).toBe(3)
    expect(semitonsEntre('G', null)).toBeNull()
    expect(semitonsEntre('?', 'G')).toBeNull()
  })

  it('tons com bemol e com sustenido por convenção', () => {
    expect(acidenteDoTom({ raiz: 'F', menor: false })).toBe('bemol')
    expect(acidenteDoTom({ raiz: 'G', menor: false })).toBe('sustenido')
    expect(acidenteDoTom({ raiz: 'D', menor: true })).toBe('bemol')
    expect(acidenteDoTom({ raiz: 'E', menor: true })).toBe('sustenido')
    expect(acidenteDoTom({ raiz: 'C', menor: false })).toBe('sustenido')
    expect(acidenteDoTom({ raiz: 'Bb', menor: false })).toBe('bemol')
    expect(acidenteDoTom({ raiz: 'F#', menor: true })).toBe('sustenido')
    expect(acidenteDoTom({ raiz: 'Gb', menor: false })).toBe('bemol')
  })
})

describe('capotraste', () => {
  it('soa em A, capotraste na 2ª casa: toca-se em G', () => {
    expect(tomQueSeToca('A', 2)).toBe('G')
  })
  it('sem capotraste é o próprio tom', () => {
    expect(tomQueSeToca('Am', 0)).toBe('Am')
    expect(tomQueSeToca('f#m', 0)).toBe('F#m')
  })
  it('capotraste que cruza a oitava e tom menor', () => {
    expect(tomQueSeToca('C', 3)).toBe('A')
    expect(tomQueSeToca('Bm', 2)).toBe('Am')
    expect(tomQueSeToca('Eb', 3)).toBe('C')
    expect(tomQueSeToca('G', 7)).toBe('C')
    expect(tomQueSeToca('G', 11)).toBe('Ab')
  })
  it('tom inválido dá nulo e casa fora do limite é ajustada', () => {
    expect(tomQueSeToca('???', 2)).toBeNull()
    expect(tomQueSeToca(null, 2)).toBeNull()
    expect(casaDoCapotraste(-3)).toBe(0)
    expect(casaDoCapotraste(99)).toBe(11)
    expect(casaDoCapotraste(2.9)).toBe(2)
    expect(casaDoCapotraste(Number.NaN)).toBe(0)
  })
})

const CIFRA = `{title: Exemplo}
{key: G}
{comment: Verso}
[G]Sobre a rocha eu [D]firmo os meus pés
[Em]Quando o vento [C]vem

{start_of_chorus}
[C]Firme em [G/B]ti
{end_of_chorus}`

describe('ler cifra', () => {
  it('desenha acordes sobre as sílabas, rótulos e linhas em branco', () => {
    const linhas = lerCifra(CIFRA)
    expect(linhas[0]).toEqual({ tipo: 'rotulo', texto: 'Verso' })
    expect(linhas[1]).toEqual({
      tipo: 'texto',
      trechos: [
        { acorde: 'G', letra: 'Sobre a rocha eu ' },
        { acorde: 'D', letra: 'firmo os meus pés' },
      ],
    })
    expect(linhas[3]).toEqual({ tipo: 'vazia' })
    expect(linhas[4]).toEqual({ tipo: 'rotulo', texto: 'Refrão' })
    expect(linhas.at(-1)).toEqual({
      tipo: 'texto',
      trechos: [
        { acorde: 'C', letra: 'Firme em ' },
        { acorde: 'G/B', letra: 'ti' },
      ],
    })
  })

  it('título, tom e outras diretivas não viram linha; abreviações valem', () => {
    const linhas = lerCifra('{t: X}\n{key: A}\n{c: Intro}\n{soc}\n[A] [E]\n{eoc}\n{sov: Primeira}')
    expect(linhas).toEqual([
      { tipo: 'rotulo', texto: 'Intro' },
      { tipo: 'rotulo', texto: 'Refrão' },
      {
        tipo: 'texto',
        trechos: [
          { acorde: 'A', letra: ' ' },
          { acorde: 'E', letra: '' },
        ],
      },
      { tipo: 'rotulo', texto: 'Primeira' },
    ])
  })

  it('letra sem acorde, acorde sem letra e acorde seguido de acorde', () => {
    expect(lerCifra('Só letra')).toEqual([
      { tipo: 'texto', trechos: [{ acorde: null, letra: 'Só letra' }] },
    ])
    expect(lerCifra('[G][D]')).toEqual([
      {
        tipo: 'texto',
        trechos: [
          { acorde: 'G', letra: '' },
          { acorde: 'D', letra: '' },
        ],
      },
    ])
    expect(lerCifra('Antes [Am]depois')).toEqual([
      {
        tipo: 'texto',
        trechos: [
          { acorde: null, letra: 'Antes ' },
          { acorde: 'Am', letra: 'depois' },
        ],
      },
    ])
  })

  it('vazio e nulo dão uma linha vazia', () => {
    expect(lerCifra(null)).toEqual([{ tipo: 'vazia' }])
    expect(lerCifra('')).toEqual([{ tipo: 'vazia' }])
  })

  it('lê título, artista, tom, andamento e capotraste declarados', () => {
    expect(metadadosDaCifra('{title: A}\n{artist: B}\n{key: f#m}\n{tempo: 72}\n{capo: 2}')).toEqual(
      { titulo: 'A', artista: 'B', tom: 'F#m', andamento: 72, capotraste: 2 },
    )
    expect(metadadosDaCifra(null)).toEqual({
      titulo: null,
      artista: null,
      tom: null,
      andamento: null,
      capotraste: null,
    })
  })
})

describe('normalizar cifra', () => {
  it('fim de linha, BOM, tabulação, espaços e linhas em branco demais', () => {
    expect(normalizarCifra('\uFEFF\r\n[G]a  \r\n\r\n\r\n\r\n[D]b\t \n\n')).toBe('[G]a\n\n[D]b')
  })
})

describe('detectar formato', () => {
  it('ChordPro: diretiva ou acorde entre colchetes', () => {
    expect(detectarFormato('{title: X}\nletra')).toBe('chordpro')
    expect(detectarFormato('Sobre a [G]rocha')).toBe('chordpro')
  })
  it('colchete que não é acorde não faz ChordPro', () => {
    expect(detectarFormato('[Refrão]\nletra simples')).toBe('texto')
  })
  it('acordes sobre a letra', () => {
    expect(detectarFormato('G        D\nSobre a rocha\nEm     C\nQuando o vento')).toBe(
      'acordes_sobre_letra',
    )
  })
  it('uma linha de acordes só, com vários acordes, ainda é cifra', () => {
    expect(detectarFormato('Intro\nG D Em C\nLetra aqui')).toBe('acordes_sobre_letra')
  })
  it('palavras que também são acorde, no meio da letra, não enganam', () => {
    expect(detectarFormato('E a gente canta\nA vida é bela\nEm nome de Jesus')).toBe('texto')
    expect(detectarFormato('A')).toBe('texto')
  })
  it('texto livre e vazio', () => {
    expect(detectarFormato('Só uma letra qualquer')).toBe('texto')
    expect(detectarFormato('')).toBe('texto')
    expect(detectarFormato(null)).toBe('texto')
  })
  it('linha de acordes aceita barra de compasso e repetição', () => {
    expect(ehLinhaDeAcordes('| G | D | x2')).toBe(true)
    expect(ehLinhaDeAcordes('G D Em (x2)')).toBe(true)
    expect(ehLinhaDeAcordes('| |')).toBe(false)
    expect(ehLinhaDeAcordes('G D Amor')).toBe(false)
    expect(ehLinhaDeAcordes('')).toBe(false)
  })
})

describe('converter "acordes sobre a letra" para ChordPro', () => {
  it('põe cada acorde na coluna da sílaba', () => {
    const colada = `G             D
Sobre a rocha eu firmo
Em       C
Quando o vento vem`
    const r = converterParaChordPro(colada)
    expect(r.convertido).toBe(true)
    expect(r.formatoOriginal).toBe('acordes_sobre_letra')
    expect(r.acordes).toBe(4)
    expect(r.texto).toBe('[G]Sobre a rocha [D]eu firmo\n[Em]Quando o [C]vento vem')
  })

  it('acorde no meio da palavra', () => {
    const r = converterParaChordPro('   G      D\nSobre a rocha\nA\nAmém')
    expect(r.texto.split('\n')[0]).toBe('Sob[G]re a ro[D]cha')
  })

  it('acorde além do fim da letra vai para o fim', () => {
    const r = converterParaChordPro('G                    D\nLinha curta\nEm\nOutra')
    expect(r.texto.split('\n')[0]).toBe('[G]Linha curta[D]')
  })

  it('linha só de acordes (introdução) vira acordes entre colchetes', () => {
    const r = converterParaChordPro('G D Em C\n\nG     D\nLetra aqui')
    expect(r.texto).toBe('[G] [D] [Em] [C]\n\n[G]Letra [D]aqui')
  })

  it('rótulo de seção vira comentário e "Intro: G D" vira rótulo mais acordes', () => {
    const r = converterParaChordPro(
      'Intro: G D Em C\n\n[Verso 1]\nG     D\nLetra aqui\n\nRefrão:\nC     G\nOutra letra',
    )
    expect(r.texto).toBe(
      '{comment: Intro}\n[G] [D] [Em] [C]\n\n{comment: Verso 1}\n[G]Letra [D]aqui\n\n{comment: Refrão}\n[C]Outra [G]letra',
    )
  })

  it('frase de letra que começa com palavra de seção não vira rótulo', () => {
    const r = converterParaChordPro('G\nCoro de anjos cantam\nD\nFinal feliz')
    expect(r.texto).toBe('[G]Coro de anjos cantam\n[D]Final feliz')
  })

  it('marca de repetição segue no fim da letra', () => {
    const r = converterParaChordPro('G     D   x2\nLetra aqui bem\nC\nOutra')
    expect(r.texto.split('\n')[0]).toBe('[G]Letra [D]aqui bem x2')
  })

  it('acentos e letras fora do ASCII mantêm a coluna', () => {
    const r = converterParaChordPro('     D\nCoração\nG\nx')
    expect(r.texto.split('\n')[0]).toBe('Coraç[D]ão')
  })

  it('já em ChordPro: só normaliza, sem converter', () => {
    const r = converterParaChordPro('[G]Letra  \r\n[D]mais')
    expect(r.convertido).toBe(false)
    expect(r.formatoOriginal).toBe('chordpro')
    expect(r.texto).toBe('[G]Letra\n[D]mais')
  })

  it('texto livre sem acordes: não converte e avisa pelo resultado', () => {
    const r = converterParaChordPro('Só a letra da música\nSem nenhum acorde')
    expect(r).toEqual({
      texto: 'Só a letra da música\nSem nenhum acorde',
      formatoOriginal: 'texto',
      convertido: false,
      acordes: 0,
    })
  })

  it('o resultado é ChordPro que se transpõe', () => {
    const r = converterParaChordPro('G       D\nSobre a rocha\nEm       C\nQuando o vento')
    expect(detectarFormato(r.texto)).toBe('chordpro')
    expect(transporCifra(r.texto, 2)).toBe('[A]Sobre a [E]rocha\n[F#m]Quando o [D]vento')
  })
})

describe('transpor cifra', () => {
  it('troca todos os acordes e a diretiva key', () => {
    const r = transporCifra(CIFRA, 2)
    expect(r).toContain('{key: A}')
    expect(r).toContain('[A]Sobre a rocha eu [E]firmo os meus pés')
    expect(r).toContain('[F#m]Quando o vento [D]vem')
    expect(r).toContain('[D]Firme em [A/C#]ti')
    expect(r).toContain('{title: Exemplo}')
  })

  it('zero e 12 semitons não mudam nada', () => {
    expect(transporCifra(CIFRA, 0)).toBe(CIFRA)
    expect(transporCifra(CIFRA, 12)).toBe(CIFRA)
    expect(transporCifra(CIFRA, -24)).toBe(CIFRA)
  })

  it('subir e descer a mesma distância volta ao original (em tons de sustenido)', () => {
    for (const n of [2, 5, 7]) {
      expect(transporCifra(transporCifra(CIFRA, n), -n)).toBe(CIFRA)
    }
  })

  it('usa bemol quando o tom de chegada é bemol (G para Bb)', () => {
    const r = transporCifra(CIFRA, 3)
    expect(r).toContain('{key: Bb}')
    expect(r).toContain('[Bb]Sobre a rocha eu [F]firmo')
    expect(r).toContain('[Gm]Quando o vento [Eb]vem')
    expect(r).toContain('[Eb]Firme em [Bb/D]ti')
    expect(r).not.toContain('#')
  })

  it('usa sustenido em tom de sustenido (G para B)', () => {
    const r = transporCifra('{key: G}\n[G]a [Em]b [C#]c [A/C#]d', 4)
    expect(r).toContain('{key: B}')
    expect(r).toContain('[B]a [G#m]b [F]c [C#/F]d')
  })

  it('sem key na cifra, o tom informado decide a grafia', () => {
    const texto = '[C]a [Am]b [F]c'
    expect(transporCifra(texto, 3, { tomOriginal: 'C' })).toBe('[Eb]a [Cm]b [Ab]c')
    expect(transporCifra(texto, 3, { tomDeChegada: 'D#' })).toBe('[D#]a [Cm]b [G#]c')
  })

  it('sem tom nenhum, a cifra com bemol continua com bemol', () => {
    expect(transporCifra('[Bb]a [Gm]b [Eb]c', 2)).toBe('[C]a [Am]b [F]c')
    expect(transporCifra('[Bb]a [Gm]b [Eb]c', 1)).toBe('[B]a [Abm]b [E]c')
  })

  it('rótulos e anotações que não são acorde ficam como estão', () => {
    expect(transporCifra('[*Pausa][G]letra\n{comment: Refrão [2x]}', 2)).toBe(
      '[*Pausa][A]letra\n{comment: Refrão [2x]}',
    )
  })

  it('acordes difíceis: baixo invertido, sus, dim, maj7, add', () => {
    const r = transporCifra('{key: C}\n[C/E] [Dm7] [Gsus4] [G] [Bdim] [Cmaj7] [Fadd9] [Am7/G]', 2)
    expect(r).toBe('{key: D}\n[D/F#] [Em7] [Asus4] [A] [C#dim] [Dmaj7] [Gadd9] [Bm7/A]')
  })
})

describe('preparar cifra para tocar', () => {
  it('sem ajuste, a cifra sai no tom original', () => {
    const p = prepararCifra(CIFRA, { tomOriginal: 'G' })
    expect(p.transpoe).toBe(true)
    expect(p.formato).toBe('chordpro')
    expect(p.tomQueSoa).toBe('G')
    expect(p.tomQueSeToca).toBe('G')
    expect(p.semitons).toBe(0)
    expect(p.texto).toBe(CIFRA)
  })

  it('tom do dia: de G para A sobe 2', () => {
    const p = prepararCifra(CIFRA, { tomOriginal: 'G', tomDoDia: 'A' })
    expect(p.tomQueSoa).toBe('A')
    expect(p.semitons).toBe(2)
    expect(p.texto).toContain('[A]Sobre a rocha eu [E]firmo')
  })

  it('o tom original sai da diretiva key quando a música não o tem', () => {
    const p = prepararCifra(CIFRA, { tomDoDia: 'A' })
    expect(p.tomQueSoa).toBe('A')
    expect(p.semitons).toBe(2)
  })

  it('ajuste do músico soma ao tom do dia', () => {
    const p = prepararCifra(CIFRA, { tomOriginal: 'G', tomDoDia: 'A', ajuste: 1 })
    expect(p.tomQueSoa).toBe('Bb')
    expect(p.semitons).toBe(3)
    expect(p.texto).toContain('[Bb]Sobre a rocha')
  })

  it('capotraste: soa em A, capo na 2ª casa, toca-se em G', () => {
    const p = prepararCifra(CIFRA, { tomOriginal: 'G', tomDoDia: 'A', capotraste: 2 })
    expect(p.tomQueSoa).toBe('A')
    expect(p.tomQueSeToca).toBe('G')
    expect(p.capotraste).toBe(2)
    expect(p.semitons).toBe(0)
    expect(p.texto).toContain('[G]Sobre a rocha eu [D]firmo')
  })

  it('capotraste com tom que soa em bemol: formas na grafia do tom que se toca', () => {
    const p = prepararCifra('[Bb]a [Eb]b [F]c', { tomOriginal: 'Bb', capotraste: 3 })
    expect(p.tomQueSoa).toBe('Bb')
    expect(p.tomQueSeToca).toBe('G')
    expect(p.texto).toBe('[G]a [C]b [D]c')
  })

  it('texto livre não transpõe e sai igual, com o tom que soa', () => {
    const p = prepararCifra('Só letra\nsem acordes', { tomOriginal: 'G', tomDoDia: 'A' })
    expect(p.transpoe).toBe(false)
    expect(p.formato).toBe('texto')
    expect(p.texto).toBe('Só letra\nsem acordes')
    expect(p.tomQueSoa).toBe('A')
  })

  it('sem tom nenhum, o ajuste ainda transpõe os acordes', () => {
    const p = prepararCifra('[C]a [G]b', { ajuste: 2 })
    expect(p.tomQueSoa).toBeNull()
    expect(p.texto).toBe('[D]a [A]b')
  })

  it('cifra vazia ou nula', () => {
    expect(prepararCifra(null).linhas).toEqual([{ tipo: 'vazia' }])
    expect(prepararCifra('', { tomOriginal: 'G' }).transpoe).toBe(false)
  })

  it('tom do dia inválido cai no tom original', () => {
    const p = prepararCifra(CIFRA, { tomOriginal: 'G', tomDoDia: '???' })
    expect(p.tomQueSoa).toBe('G')
    expect(p.semitons).toBe(0)
  })
})
