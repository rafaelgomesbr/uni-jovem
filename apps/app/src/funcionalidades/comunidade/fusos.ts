import { fusoDoAparelho } from '@/utilidades/datas'

/** Fuso padrão de comunidade nova (premissa P1). */
export const FUSO_PADRAO = 'America/Sao_Paulo'

/** Fusos do Brasil, com nomes que as pessoas reconhecem. */
const FUSOS_DO_BRASIL = [
  { valor: 'America/Sao_Paulo', rotulo: 'Horário de Brasília', descricao: 'A maior parte do país' },
  { valor: 'America/Manaus', rotulo: 'Amazonas e Roraima', descricao: 'Uma hora a menos' },
  {
    valor: 'America/Cuiaba',
    rotulo: 'Mato Grosso e Mato Grosso do Sul',
    descricao: 'Uma hora a menos',
  },
  { valor: 'America/Porto_Velho', rotulo: 'Rondônia', descricao: 'Uma hora a menos' },
  { valor: 'America/Rio_Branco', rotulo: 'Acre', descricao: 'Duas horas a menos' },
  { valor: 'America/Noronha', rotulo: 'Fernando de Noronha', descricao: 'Uma hora a mais' },
] as const

export interface OpcaoDeFuso {
  valor: string
  rotulo: string
  descricao: string
}

/** Opções de fuso: as do Brasil, mais a atual e a do aparelho quando forem outras. */
export function opcoesDeFuso(atual?: string | null): OpcaoDeFuso[] {
  const opcoes: OpcaoDeFuso[] = FUSOS_DO_BRASIL.map((f) => ({ ...f }))
  const extras = [
    { valor: atual, descricao: 'Fuso atual da comunidade' },
    { valor: fusoDoAparelho(), descricao: 'Fuso deste aparelho' },
  ]
  for (const { valor, descricao } of extras) {
    if (valor && !opcoes.some((o) => o.valor === valor)) {
      opcoes.push({ valor, rotulo: valor.replace(/_/g, ' '), descricao })
    }
  }
  return opcoes
}

export function nomeDoFuso(fuso: string): string {
  return FUSOS_DO_BRASIL.find((f) => f.valor === fuso)?.rotulo ?? fuso.replace(/_/g, ' ')
}
