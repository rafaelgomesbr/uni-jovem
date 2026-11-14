/**
 * Papéis por comunidade e a hierarquia numérica entre eles.
 *
 * O papel vive no VÍNCULO (conta × comunidade), nunca na conta: a mesma pessoa
 * pode ser admin numa comunidade e membro em outra. "Criador" não é papel de
 * comunidade; é um atributo global único da plataforma (coluna
 * `contas.plataforma_proprietario`, ações em `MATRIZ.plataforma` de
 * `permissoes.ts`), e por isso não aparece aqui e não pode ser concedido por convite.
 *
 * A hierarquia segue o ADR 0006 do dc360: ninguém concede, altera ou remove
 * um papel de nível acima do próprio, e ninguém mexe no próprio papel.
 */

export const PAPEIS = ['admin', 'organizador', 'membro'] as const
export type Papel = (typeof PAPEIS)[number]

export const NIVEL: Readonly<Record<Papel, number>> = {
  admin: 30,
  organizador: 20,
  membro: 10,
}

export const NOME_DO_PAPEL: Readonly<Record<Papel, string>> = {
  admin: 'Administrador',
  organizador: 'Organizador',
  membro: 'Membro',
}

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor)
}

/** Quem tem papel `concedente` pode conceder (por convite ou alteração) o papel `alvo`? */
export function podeConcederPapel(concedente: Papel, alvo: Papel): boolean {
  return concedente === 'admin' && NIVEL[alvo] <= NIVEL[concedente]
}
