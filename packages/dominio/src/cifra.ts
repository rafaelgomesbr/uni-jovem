/**
 * Cifra em ChordPro (D61): ler, normalizar, converter "acordes sobre a letra",
 * transpor e calcular o capotraste. Tudo função pura, sem rede nem banco.
 *
 * ChordPro é texto simples em que o acorde vem entre colchetes, colado na
 * sílaba onde ele muda: `[G]Sobre a rocha eu [D]firmo os meus pés`. Como o
 * app sabe onde está cada acorde, consegue transpor.
 *
 * Os acordes usam as letras A a G (a notação mais comum nas cifras em
 * português). Aceita ♯ e ♭ na entrada; a saída usa `#` e `b`, e a interface
 * troca por ♯ e ♭ só para desenhar (`simbolosDeAcidente`).
 *
 * Nunca registre o texto da cifra em log: é obra protegida (modo-musico.md,
 * seção 4). Nada aqui registra nada.
 */

// ------------------------------------------------------------------ notas e tons

export type Acidente = 'sustenido' | 'bemol'

const NOTAS_COM_SUSTENIDO = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTAS_COM_BEMOL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const SEMITOM_DA_LETRA: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const modulo12 = (n: number) => ((Math.trunc(n) % 12) + 12) % 12

function valorDoAcidente(a: string): number {
  if (a === '#' || a === '♯') return 1
  if (a === 'b' || a === '♭') return -1
  return 0
}

function semitomDaNota(letra: string, acidente: string): number {
  return modulo12((SEMITOM_DA_LETRA[letra.toUpperCase()] ?? 0) + valorDoAcidente(acidente))
}

function nomeDaNota(semitom: number, acidente: Acidente): string {
  const tabela = acidente === 'bemol' ? NOTAS_COM_BEMOL : NOTAS_COM_SUSTENIDO
  return tabela[modulo12(semitom)]!
}

// ------------------------------------------------------------------ acordes

export interface Acorde {
  /** Nota da raiz, como foi escrita (`C`, `F#`, `Bb`), já com ASCII. */
  raiz: string
  /** O que vem depois da raiz (`m7`, `sus4`, `maj7`, `dim`...), sem o baixo. */
  qualidade: string
  /** Nota do baixo de `C/E`, ou null. */
  baixo: string | null
}

const PADRAO_DO_ACORDE =
  /^([A-G])([#♯b♭]?)((?:maj|min|dim|aug|sus|add|alt|no|m|M|\+|°|º|ø|-|\d+|\/\d+|[#b♯♭]|\([^)\s]*\))*)(?:\/([A-G])([#♯b♭]?))?$/

function ascii(acidente: string): string {
  return acidente === '♯' ? '#' : acidente === '♭' ? 'b' : acidente
}

/** Lê um acorde (`C`, `Am7`, `D/F#`, `Bbmaj7`, `F#m7b5`). Nulo se não for acorde. */
export function lerAcorde(texto: string): Acorde | null {
  const m = PADRAO_DO_ACORDE.exec(texto.trim())
  if (!m) return null
  return {
    raiz: `${m[1]}${ascii(m[2] ?? '')}`,
    qualidade: m[3] ?? '',
    baixo: m[4] ? `${m[4]}${ascii(m[5] ?? '')}` : null,
  }
}

export function ehAcorde(texto: string): boolean {
  return lerAcorde(texto) !== null
}

function semitomDaRaiz(nota: string): number {
  return semitomDaNota(nota[0]!, nota.slice(1))
}

/** Escreve o acorde de volta (`C`, `m7`, `E` viram `C/E` com baixo). */
export function acordeParaTexto(a: Acorde): string {
  return `${a.raiz}${a.qualidade}${a.baixo ? `/${a.baixo}` : ''}`
}

/** Troca `#` por ♯ e `b` por ♭ só nas notas (raiz e baixo): para desenhar na tela. */
export function simbolosDeAcidente(acorde: string): string {
  const a = lerAcorde(acorde)
  if (!a) return acorde
  const nota = (n: string) => n.replace('#', '♯').replace(/^([A-G])b$/, '$1♭')
  return `${nota(a.raiz)}${a.qualidade}${a.baixo ? `/${nota(a.baixo)}` : ''}`
}

/**
 * Transpõe um acorde. `acidente` diz como escrever as notas pretas; sem ele,
 * vale o que o próprio acorde já usava (bemol se tinha `b`, senão sustenido).
 * O que não é acorde volta igual.
 */
export function transporAcorde(texto: string, semitons: number, acidente?: Acidente): string {
  const a = lerAcorde(texto)
  if (!a) return texto
  const preferencia: Acidente =
    acidente ?? (a.raiz.endsWith('b') || a.baixo?.endsWith('b') ? 'bemol' : 'sustenido')
  return acordeParaTexto({
    raiz: nomeDaNota(semitomDaRaiz(a.raiz) + semitons, preferencia),
    qualidade: a.qualidade,
    baixo: a.baixo ? nomeDaNota(semitomDaRaiz(a.baixo) + semitons, preferencia) : null,
  })
}

// ------------------------------------------------------------------ tons

export interface Tom {
  /** Raiz como escrita, em ASCII: `G`, `F#`, `Bb`. */
  raiz: string
  menor: boolean
}

/** Lê um tom: `G`, `Am`, `f#m`, `Bb`, `Em7`. Aceita raiz em minúscula. Nulo se não for tom. */
export function lerTom(texto: string | null | undefined): Tom | null {
  const limpo = (texto ?? '').trim()
  if (!limpo) return null
  const m = /^([A-Ga-g])([#♯b♭]?)(.*)$/.exec(limpo)
  if (!m) return null
  const a = lerAcorde(`${m[1]!.toUpperCase()}${m[2]}${m[3]}`)
  if (!a || a.baixo) return null
  const menor = /^(m|min)(?!aj)/.test(a.qualidade) || a.qualidade.startsWith('-')
  return { raiz: a.raiz, menor }
}

/**
 * Tons que se escrevem com bemol (e os menores relativos): F, Bb, Eb, Ab, Db,
 * Gb e Dm, Gm, Cm, Fm, Bbm, Ebm. O resto usa sustenido (C e Am também).
 */
const MAIORES_COM_BEMOL = new Set([5, 10, 3, 8, 1])
const MENORES_COM_BEMOL = new Set([2, 7, 0, 5, 10])

/**
 * Como escrever as notas pretas numa tonalidade. Se o tom foi escrito com `b`
 * ou `#`, vale o que foi escrito; senão, a convenção da armadura.
 */
export function acidenteDoTom(tom: Tom): Acidente {
  if (tom.raiz.endsWith('b')) return 'bemol'
  if (tom.raiz.endsWith('#')) return 'sustenido'
  const pc = semitomDaRaiz(tom.raiz)
  return (tom.menor ? MENORES_COM_BEMOL : MAIORES_COM_BEMOL).has(pc) ? 'bemol' : 'sustenido'
}

/** Nome padrão do tom (`g` vira `G`, `a♭` vira `Ab`, `f#M` não existe: nulo). */
export function nomeDoTom(texto: string | null | undefined): string | null {
  const tom = lerTom(texto)
  return tom ? `${tom.raiz}${tom.menor ? 'm' : ''}` : null
}

/**
 * Tom depois de subir `semitons` (negativo desce). A grafia segue a convenção
 * do tom de chegada: G +3 dá `Bb` (nunca `A#`), E +2 dá `F#`. Texto que não é
 * tom volta nulo.
 */
export function transporTom(texto: string | null | undefined, semitons: number): string | null {
  const tom = lerTom(texto)
  if (!tom) return null
  const alvo = modulo12(semitomDaRaiz(tom.raiz) + semitons)
  const natural = NOTAS_COM_SUSTENIDO[alvo]!
  const comBemol = (tom.menor ? MENORES_COM_BEMOL : MAIORES_COM_BEMOL).has(alvo)
  const raiz = natural.length === 1 ? natural : nomeDaNota(alvo, comBemol ? 'bemol' : 'sustenido')
  return `${raiz}${tom.menor ? 'm' : ''}`
}

/**
 * Distância em semitons (0 a 11, para cima) de um tom a outro, olhando só a
 * raiz. Nulo se algum dos dois não for tom.
 */
export function semitonsEntre(
  de: string | null | undefined,
  para: string | null | undefined,
): number | null {
  const a = lerTom(de)
  const b = lerTom(para)
  if (!a || !b) return null
  return modulo12(semitomDaRaiz(b.raiz) - semitomDaRaiz(a.raiz))
}

/** Capotraste: de 0 (sem capotraste) a 11. */
export const CAPOTRASTE_MAXIMO = 11

/** Ajusta o valor do capotraste para um inteiro de 0 a 11. */
export function casaDoCapotraste(casa: number): number {
  if (!Number.isFinite(casa)) return 0
  return Math.min(CAPOTRASTE_MAXIMO, Math.max(0, Math.trunc(casa)))
}

/**
 * O tom das formas que se tocam com o capotraste: soa em A, capotraste na 2ª
 * casa, toca-se em G. Sem capotraste, é o próprio tom.
 */
export function tomQueSeToca(tomQueSoa: string | null | undefined, casa: number): string | null {
  const nome = nomeDoTom(tomQueSoa)
  if (!nome) return null
  const c = casaDoCapotraste(casa)
  return c === 0 ? nome : transporTom(nome, -c)
}

// ------------------------------------------------------------------ linhas de cifra

const PADRAO_DE_ACORDE_ENTRE_COLCHETES = /\[([^\]\n]*)\]/g

/** Texto com fim de linha uniforme, sem BOM, sem espaço sobrando e com no máximo uma linha em branco seguida. */
export function normalizarCifra(texto: string): string {
  return texto
    .replace(new RegExp(`^${String.fromCharCode(0xfeff)}`), '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

export type FormatoDaCifra = 'chordpro' | 'acordes_sobre_letra' | 'texto'

/** Símbolos que aparecem nas linhas de acordes sem serem acorde: barra de compasso e repetição. */
const SOBRA_DE_LINHA_DE_ACORDES = /^(?:\||\|\||:|\(?x\d+\)?|N\.?C\.?)$/i

function simbolos(linha: string): { texto: string; coluna: number }[] {
  const saida: { texto: string; coluna: number }[] = []
  const letras = Array.from(linha)
  let i = 0
  while (i < letras.length) {
    if (/\s/.test(letras[i]!)) {
      i++
      continue
    }
    const inicio = i
    while (i < letras.length && !/\s/.test(letras[i]!)) i++
    saida.push({ texto: letras.slice(inicio, i).join(''), coluna: inicio })
  }
  return saida
}

/**
 * Linha só de acordes? Todos os pedaços são acorde (ou barra de compasso,
 * "x2"), com ao menos um acorde. Palavras comuns que também são acorde ("A",
 * "E", "Em") só contam se a linha inteira for assim.
 */
export function ehLinhaDeAcordes(linha: string): boolean {
  const partes = simbolos(linha)
  if (partes.length === 0) return false
  let acordes = 0
  for (const p of partes) {
    if (ehAcorde(p.texto)) acordes++
    else if (!SOBRA_DE_LINHA_DE_ACORDES.test(p.texto)) return false
  }
  return acordes > 0
}

function acordesDeLinha(linha: string): { acorde: string; coluna: number; cru: boolean }[] {
  return simbolos(linha).map((p) => ({
    acorde: p.texto,
    coluna: p.coluna,
    cru: !ehAcorde(p.texto),
  }))
}

const PADRAO_DE_DIRETIVA = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i

/** O formato de um texto de cifra, para saber se a transposição funciona. */
export function detectarFormato(texto: string | null | undefined): FormatoDaCifra {
  const t = normalizarCifra(texto ?? '')
  if (!t) return 'texto'
  const linhas = t.split('\n')
  if (linhas.some((l) => PADRAO_DE_DIRETIVA.test(l))) return 'chordpro'
  for (const l of linhas) {
    for (const m of l.matchAll(PADRAO_DE_ACORDE_ENTRE_COLCHETES)) {
      if (ehAcorde(m[1]!)) return 'chordpro'
    }
  }
  const deAcordes = linhas.filter(ehLinhaDeAcordes)
  if (deAcordes.length >= 2) return 'acordes_sobre_letra'
  if (deAcordes.length === 1 && simbolos(deAcordes[0]!).length >= 2) return 'acordes_sobre_letra'
  return 'texto'
}

const PALAVRAS_DE_SECAO = String.raw`intro(?:du[cç][aã]o)?|verso|estrofe|refr[aã]o|pr[eé][\s-]?refr[aã]o|ponte|coro|final|solo|instrumental|interl[uú]dio|tag|outro|bridge|chorus|verse|pre[\s-]?chorus`
/** Só o rótulo: "[Refrão]", "Refrão:", "Verso 2" ou "Refrão (2x)". Frase de letra não entra. */
const ROTULO_DE_SECAO = new RegExp(
  String.raw`^(?:\[\s*([^\]]{1,40}?)\s*\]|((?:${PALAVRAS_DE_SECAO})(?:\s+\d+)?(?:\s*\(?\d+\s*x\)?)?)\s*:?)$`,
  'i',
)
/** Rótulo seguido de acordes na mesma linha: "Intro: G D Em C" ou "[Intro] G D". */
const ROTULO_COM_ACORDES = new RegExp(
  String.raw`^(?:\[\s*([^\]]{1,40}?)\s*\]|((?:${PALAVRAS_DE_SECAO})(?:\s+\d+)?)\s*:)\s*(.+)$`,
  'i',
)

function emChordPro(linhaDeAcordes: string, letra: string | null): string {
  const acordes = acordesDeLinha(linhaDeAcordes)
  if (letra === null) {
    return acordes.map((a) => (a.cru ? a.acorde : `[${a.acorde}]`)).join(' ')
  }
  const letras = Array.from(letra)
  let saida = ''
  let usado = 0
  for (const a of acordes) {
    if (a.cru) continue
    const corte = Math.min(Math.max(a.coluna, usado), letras.length)
    saida += letras.slice(usado, corte).join('') + `[${a.acorde}]`
    usado = corte
  }
  // "x2" e parecidos não são acorde nem barra de compasso: seguem no fim da letra.
  const repeticoes = acordes.filter((a) => a.cru && a.acorde !== '|' && a.acorde !== '||')
  const marca = repeticoes.length ? ` ${repeticoes.map((a) => a.acorde).join(' ')}` : ''
  return saida + letras.slice(usado).join('') + marca
}

export interface ResultadoDaConversao {
  /** Texto em ChordPro (ou o texto de entrada, normalizado, se não deu para converter). */
  texto: string
  formatoOriginal: FormatoDaCifra
  /** Houve conversão de "acordes sobre a letra" para ChordPro. */
  convertido: boolean
  /** Quantos acordes passaram a ter colchetes. */
  acordes: number
}

/**
 * Converte a cifra colada no formato "linha de acordes sobre a linha de
 * letra" para ChordPro, pondo cada acorde entre colchetes na coluna em que
 * estava. Já em ChordPro, ou texto sem acordes reconhecíveis: só normaliza e
 * diz que não converteu (a transposição não vai funcionar nesse caso).
 */
export function converterParaChordPro(texto: string): ResultadoDaConversao {
  const normal = normalizarCifra(texto)
  const formato = detectarFormato(normal)
  if (formato !== 'acordes_sobre_letra') {
    return { texto: normal, formatoOriginal: formato, convertido: false, acordes: 0 }
  }
  const linhas = normal.split('\n')
  const saida: string[] = []
  let total = 0
  const contar = (linha: string) => acordesDeLinha(linha).filter((a) => !a.cru).length
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!
    if (linha.trim() === '') {
      saida.push('')
      continue
    }
    // "Intro: G D Em C": rótulo e acordes na mesma linha.
    const comAcordes = ROTULO_COM_ACORDES.exec(linha)
    if (comAcordes && ehLinhaDeAcordes(comAcordes[3]!)) {
      saida.push(`{comment: ${(comAcordes[1] ?? comAcordes[2]!).trim()}}`)
      total += contar(comAcordes[3]!)
      saida.push(emChordPro(comAcordes[3]!.trim(), null))
      continue
    }
    const rotulo = ROTULO_DE_SECAO.exec(linha.trim())
    if (rotulo && !ehLinhaDeAcordes(linha)) {
      saida.push(`{comment: ${(rotulo[1] ?? rotulo[2]!).trim()}}`)
      continue
    }
    if (ehLinhaDeAcordes(linha)) {
      const proxima = linhas[i + 1]
      const temLetra =
        proxima !== undefined &&
        proxima.trim() !== '' &&
        !ehLinhaDeAcordes(proxima) &&
        !ROTULO_DE_SECAO.test(proxima.trim())
      total += contar(linha)
      if (temLetra) {
        saida.push(emChordPro(linha, proxima))
        i++
      } else {
        saida.push(emChordPro(linha.trim(), null))
      }
      continue
    }
    saida.push(linha)
  }
  return { texto: saida.join('\n'), formatoOriginal: formato, convertido: true, acordes: total }
}

// ------------------------------------------------------------------ leitura estruturada

export interface Trecho {
  /** Acorde que toca antes desta letra, ou null. Fica como foi escrito. */
  acorde: string | null
  letra: string
}

export type LinhaDaCifra =
  { tipo: 'vazia' } | { tipo: 'rotulo'; texto: string } | { tipo: 'texto'; trechos: Trecho[] }

export interface MetadadosDaCifra {
  titulo: string | null
  artista: string | null
  tom: string | null
  andamento: number | null
  capotraste: number | null
}

const ROTULOS_DE_SECAO: Readonly<Record<string, string>> = {
  chorus: 'Refrão',
  verse: 'Verso',
  bridge: 'Ponte',
  tab: 'Tablatura',
  grid: 'Grade',
}

function diretivaDaLinha(linha: string): { nome: string; valor: string } | null {
  const m = PADRAO_DE_DIRETIVA.exec(linha)
  if (!m) return null
  return { nome: m[1]!.toLowerCase(), valor: (m[2] ?? '').trim() }
}

/** Nomes completos de cada abreviação de diretiva ChordPro. */
const ABREVIACOES: Readonly<Record<string, string>> = {
  t: 'title',
  st: 'subtitle',
  c: 'comment',
  ci: 'comment_italic',
  soc: 'start_of_chorus',
  eoc: 'end_of_chorus',
  sov: 'start_of_verse',
  eov: 'end_of_verse',
  sob: 'start_of_bridge',
  eob: 'end_of_bridge',
}

function nomeCompleto(nome: string): string {
  return ABREVIACOES[nome] ?? nome
}

/** Título, artista, tom, andamento e capotraste que a própria cifra declara. */
export function metadadosDaCifra(texto: string | null | undefined): MetadadosDaCifra {
  const meta: MetadadosDaCifra = {
    titulo: null,
    artista: null,
    tom: null,
    andamento: null,
    capotraste: null,
  }
  for (const linha of normalizarCifra(texto ?? '').split('\n')) {
    const d = diretivaDaLinha(linha)
    if (!d) continue
    const nome = nomeCompleto(d.nome)
    if (nome === 'title') meta.titulo = d.valor || null
    else if (nome === 'artist') meta.artista = d.valor || null
    else if (nome === 'key') meta.tom = nomeDoTom(d.valor)
    else if (nome === 'tempo' && /^\d{2,3}$/.test(d.valor)) meta.andamento = Number(d.valor)
    else if (nome === 'capo' && /^\d{1,2}$/.test(d.valor)) meta.capotraste = Number(d.valor)
  }
  return meta
}

function trechosDaLinha(linha: string): Trecho[] {
  const trechos: Trecho[] = []
  let ultimo = 0
  let acordeAberto: string | null = null
  for (const m of linha.matchAll(PADRAO_DE_ACORDE_ENTRE_COLCHETES)) {
    const antes = linha.slice(ultimo, m.index)
    if (antes !== '' || acordeAberto !== null) trechos.push({ acorde: acordeAberto, letra: antes })
    acordeAberto = m[1]!.trim()
    ultimo = m.index + m[0].length
  }
  const resto = linha.slice(ultimo)
  if (resto !== '' || acordeAberto !== null) trechos.push({ acorde: acordeAberto, letra: resto })
  return trechos
}

/**
 * Lê a cifra em linhas prontas para desenhar: acordes sobre as sílabas,
 * rótulos de seção ("Refrão") e linhas em branco. As diretivas de título,
 * artista, tom e andamento ficam fora (a tela já mostra isso no cabeçalho).
 */
export function lerCifra(texto: string | null | undefined): LinhaDaCifra[] {
  const linhas: LinhaDaCifra[] = []
  for (const linha of normalizarCifra(texto ?? '').split('\n')) {
    const d = diretivaDaLinha(linha)
    if (d) {
      const nome = nomeCompleto(d.nome)
      if (nome === 'comment' || nome === 'comment_italic') {
        if (d.valor) linhas.push({ tipo: 'rotulo', texto: d.valor })
      } else if (nome.startsWith('start_of_')) {
        const tipo = nome.slice('start_of_'.length)
        const rotulo = d.valor || ROTULOS_DE_SECAO[tipo] || ''
        if (rotulo) linhas.push({ tipo: 'rotulo', texto: rotulo })
      }
      continue
    }
    if (linha.trim() === '') {
      linhas.push({ tipo: 'vazia' })
      continue
    }
    linhas.push({ tipo: 'texto', trechos: trechosDaLinha(linha) })
  }
  return linhas
}

// ------------------------------------------------------------------ transposição da cifra

export interface OpcoesDaTransposicao {
  /** Tom de chegada (define ♯ ou ♭). Sem ele, deduz do tom da cifra ou dos próprios acordes. */
  tomDeChegada?: string | null
  /** Tom da cifra, quando ela não declara `{key: ...}`. */
  tomOriginal?: string | null
}

function acidenteDeChegada(texto: string, semitons: number, o: OpcoesDaTransposicao): Acidente {
  const chegada = lerTom(o.tomDeChegada)
  if (chegada) return acidenteDoTom(chegada)
  const original = o.tomOriginal ?? metadadosDaCifra(texto).tom
  const transposto = transporTom(original, semitons)
  const tom = lerTom(transposto)
  if (tom) return acidenteDoTom(tom)
  // Sem tom nenhum: mantém o gosto da própria cifra (bemol se ela já usa bemol).
  for (const m of texto.matchAll(PADRAO_DE_ACORDE_ENTRE_COLCHETES)) {
    const a = lerAcorde(m[1]!)
    if (a && (a.raiz.endsWith('b') || a.baixo?.endsWith('b'))) return 'bemol'
  }
  return 'sustenido'
}

/**
 * Transpõe todos os acordes entre colchetes (e a diretiva `{key: ...}`) e
 * devolve o ChordPro novo. O que não é acorde (rótulos, notas como `[*A]`)
 * fica como está. Zero semitons devolve o texto sem mexer.
 */
export function transporCifra(
  texto: string,
  semitons: number,
  opcoes: OpcoesDaTransposicao = {},
): string {
  const n = modulo12(semitons)
  if (n === 0) return texto
  const acidente = acidenteDeChegada(texto, n, opcoes)
  return texto
    .split('\n')
    .map((linha) => {
      const d = diretivaDaLinha(linha)
      if (d) {
        if (nomeCompleto(d.nome) === 'key') {
          const novo = transporTom(d.valor, n)
          return novo ? `{key: ${novo}}` : linha
        }
        return linha
      }
      return linha.replace(PADRAO_DE_ACORDE_ENTRE_COLCHETES, (todo, dentro: string) => {
        if (!ehAcorde(dentro)) return todo
        return `[${transporAcorde(dentro, n, acidente)}]`
      })
    })
    .join('\n')
}

// ------------------------------------------------------------------ preparar para tocar

export interface PedidoDeCifra {
  /** Tom da música na biblioteca; sem ele vale o `{key}` da cifra. */
  tomOriginal?: string | null
  /** Tom do dia (o do repertório do encontro); sem ele, o original. */
  tomDoDia?: string | null
  /** Ajuste só deste aparelho, em semitons, por cima do tom do dia. */
  ajuste?: number
  /** Casa do capotraste, de 0 a 11. */
  capotraste?: number
}

export interface CifraPronta {
  formato: FormatoDaCifra
  /** A transposição só vale em ChordPro; em texto livre a cifra sai igual. */
  transpoe: boolean
  /** Tom que soa (depois do tom do dia e do ajuste). Nulo se não houver tom nenhum. */
  tomQueSoa: string | null
  /** Tom das formas que se tocam (tom que soa menos o capotraste). */
  tomQueSeToca: string | null
  capotraste: number
  /** Semitons aplicados aos acordes escritos (inclui o capotraste). */
  semitons: number
  /** ChordPro já com os acordes que se tocam. */
  texto: string
  linhas: LinhaDaCifra[]
}

/**
 * A cifra no ponto de tocar: tom do dia, ajuste do músico e capotraste. A
 * distância do tom original ao tom do dia vem só das raízes (G para A = 2). Os
 * acordes saem na grafia do tom que se toca (com capotraste, o das formas).
 */
export function prepararCifra(
  cifra: string | null | undefined,
  p: PedidoDeCifra = {},
): CifraPronta {
  const original = normalizarCifra(cifra ?? '')
  const formato = detectarFormato(original)
  const meta = metadadosDaCifra(original)
  const tomOriginal = nomeDoTom(p.tomOriginal) ?? meta.tom
  const casa = casaDoCapotraste(p.capotraste ?? 0)
  const ajuste = Math.trunc(p.ajuste ?? 0)
  const doDia = nomeDoTom(p.tomDoDia) ?? tomOriginal
  const distanciaDoDia = tomOriginal && doDia ? (semitonsEntre(tomOriginal, doDia) ?? 0) : 0
  const tomQueSoa = doDia ? transporTom(doDia, ajuste) : null
  const formas = tomQueSoa ? tomQueSeToca(tomQueSoa, casa) : null
  const semitons = modulo12(distanciaDoDia + ajuste - casa)
  const transpoe = formato === 'chordpro'
  const texto = transpoe
    ? transporCifra(original, semitons, {
        tomDeChegada: formas,
        tomOriginal,
      })
    : original
  return {
    formato,
    transpoe,
    tomQueSoa,
    tomQueSeToca: formas,
    capotraste: casa,
    semitons,
    texto,
    linhas: lerCifra(texto),
  }
}
