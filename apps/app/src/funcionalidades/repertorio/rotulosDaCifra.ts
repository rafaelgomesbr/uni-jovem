import { nomeDoTom, semitonsEntre, simbolosDeAcidente, type CifraPronta } from '@uj/dominio'

/**
 * Os textos dos controles da cifra (D82). Ficam num arquivo só para o leitor e o Modo palco dizerem
 * exatamente as mesmas palavras, e para os testes conferirem sem desenhar a tela.
 */

type TomDaCifra = Pick<CifraPronta, 'tomQueSoa' | 'tomEstimado'>
type FormasDaCifra = Pick<CifraPronta, 'tomQueSoa' | 'tomQueSeToca'>

export const ROTULO_DESCER_TOM = 'Descer tom'
export const ROTULO_SUBIR_TOM = 'Subir tom'
export const ROTULO_DESCER_CASA = 'Descer casa'
export const ROTULO_SUBIR_CASA = 'Subir casa'
export const ROTULO_LETRA_MENOR = 'Letra menor'
export const ROTULO_LETRA_MAIOR = 'Letra maior'
/** Cada toque anda meio tom: a frase evita que "subir tom" pareça um salto grande. */
export const FRASE_DO_PASSO_DO_TOM = 'Cada toque sobe ou desce meio tom.'

/** O tom que soa, como a pessoa lê: "Tom A♭", "Tom provável G" ou "Sem tom informado". */
export function tituloDoTom(p: TomDaCifra): string {
  if (!p.tomQueSoa) return 'Sem tom informado'
  const tom = simbolosDeAcidente(p.tomQueSoa)
  return p.tomEstimado ? `Tom provável ${tom}` : `Tom ${tom}`
}

/** "Capotraste: sem" ou "Capotraste na casa 2". */
export function fraseDoCapotraste(casa: number): string {
  return casa === 0 ? 'Capotraste: sem' : `Capotraste na casa ${casa}`
}

/**
 * Com capotraste, os acordes na tela são as FORMAS que a mão faz; o tom que soa é outro. Diz as
 * duas coisas em linguagem comum. Sem capotraste, nada a explicar.
 */
export function fraseDeComoTocar(p: FormasDaCifra, casa: number): string | null {
  if (casa === 0 || !p.tomQueSeToca || !p.tomQueSoa) return null
  const toca = simbolosDeAcidente(p.tomQueSeToca)
  const soa = simbolosDeAcidente(p.tomQueSoa)
  return `Toque como se fosse em ${toca}. O som sai em ${soa}.`
}

/** "Voltar ao tom do dia (A)": o botão que desfaz o ajuste pessoal e diz para onde volta. */
export function tituloDeVoltarAoTom(temTomDoDia: boolean, tom: string | null): string {
  const base = temTomDoDia ? 'Voltar ao tom do dia' : 'Voltar ao tom original'
  return tom ? `${base} (${simbolosDeAcidente(tom)})` : base
}

/** O ajuste vale só neste aparelho: a frase tira a dúvida de quem teme ter mudado o tom do encontro. */
export function fraseDoAjustePessoal(temTomDoDia: boolean, tom: string | null): string {
  const quem = temTomDoDia ? 'o tom do dia' : 'o tom da música'
  return tom
    ? `Só para você: ${quem} continua ${simbolosDeAcidente(tom)}.`
    : 'Só para você: o tom salvo não mudou.'
}

/**
 * A música diz um tom e a cifra está escrita em outro (o cadastro da biblioteca desatualizado).
 * Devolve os dois para o aviso; nulo quando não há conflito.
 */
export function tomDivergente(
  tomCadastrado: string | null | undefined,
  tomDaCifra: string | null | undefined,
): { cadastrado: string; daCifra: string } | null {
  const a = nomeDoTom(tomCadastrado)
  const b = nomeDoTom(tomDaCifra)
  // A♯ e B♭ são o mesmo tom: só diverge quando a nota ou o modo (maior ou menor) mudam.
  if (!a || !b || (semitonsEntre(a, b) === 0 && a.endsWith('m') === b.endsWith('m'))) return null
  return { cadastrado: simbolosDeAcidente(a), daCifra: simbolosDeAcidente(b) }
}
