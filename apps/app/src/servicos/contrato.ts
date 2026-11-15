/**
 * Formato das respostas da API (apps/api). Só tipos: a API é a fonte da
 * verdade e valida tudo; o app não reimplementa regra de negócio.
 */
import type { Papel } from '@uj/dominio'

export type Plataforma = 'ios' | 'android' | 'web'

export interface SessaoAberta {
  segundoFator: false
  acesso: string
  /** Só no celular. Na web o refresh vive num cookie HttpOnly que o JavaScript nunca vê. */
  refresh?: string
}

export type RespostaDeEntrar = SessaoAberta | { segundoFator: true; desafio: string }

export type EstadoDaComunidade = 'ativa' | 'suspensa' | 'arquivada' | 'exclusao_agendada'
export type EstadoDoVinculo = 'ativo' | 'desativado' | 'removido'
export type Designacao = 'equipe_oracao'

/**
 * Avatar escolhido: nomes das listas fechadas de `@uj/tokens` (`ICONES_DO_AVATAR`,
 * `CORES_DO_AVATAR`). Os dois juntos ou nenhum (`null`: usa as iniciais).
 */
export interface AvatarDaConta {
  icone: string
  cor: string
}

export interface Conta {
  id: string
  nome: string
  email: string
  whatsapp: string | null
  criador: boolean
  doisFatores: boolean
  /** Ausente em API anterior à migração 0016; `null` sem escolha. */
  avatar?: AvatarDaConta | null
}

export interface ComunidadeDoVinculo {
  id: string
  nome: string
  cor: string
  estado: EstadoDaComunidade
  papel: Papel
  designacoes: Designacao[]
}

export interface RespostaEu {
  conta: Conta
  comunidades: ComunidadeDoVinculo[]
}

export interface Aparelho {
  id: string
  aparelho: string | null
  plataforma: Plataforma
  ultimoUso: string
  atual: boolean
}

export interface DetalheDaComunidade {
  id: string
  nome: string
  cor: string
  fuso: string
  estado: EstadoDaComunidade
  validadeOfflineDias: number
  retencaoInscricoesDias: number
  versao: number
  meuPapel: Papel
}

export interface Membro {
  vinculoId: string
  contaId: string
  nome: string
  papel: Papel
  estado: EstadoDoVinculo
  designacoes: Designacao[]
  email: string | null
  whatsapp: string | null
  criador: boolean
  desde: string
  avatar?: AvatarDaConta | null
}

export type SituacaoDoConvite =
  'valido' | 'expirado' | 'revogado' | 'usado' | 'indisponivel' | 'inexistente'

export interface ConsultaDeConvite {
  situacao: SituacaoDoConvite
  comunidade?: { nome: string; cor: string }
  papel?: Papel
  emailDestinoMascarado?: string | null
}

export interface ConviteDaComunidade {
  id: string
  papel: Papel
  emailDestino: string | null
  criadoEm: string
  expiraEm: string
  situacao: 'valido' | 'expirado' | 'revogado' | 'usado'
}

export interface ConviteCriado {
  id: string
  link: string
  expiraEm: string
}

export type Provedor = 'google' | 'apple'

export interface ContaConectada {
  provedor: Provedor
  /** O e-mail que o provedor informou (pode ser o de retransmissão da Apple). */
  email: string | null
  conectadaEm: string
}

export interface RespostaProvedores {
  provedores: ContaConectada[]
  /** Provedores ligados na API (com IDs de cliente configurados). */
  disponiveis: Provedor[]
}

export interface ConfiguracaoDoAutenticador {
  uri: string
  segredo: string
}

export interface CodigosDeRecuperacao {
  codigosDeRecuperacao: string[]
}

export interface ComunidadeDaPlataforma {
  id: string
  nome: string
  cor: string
  estado: EstadoDaComunidade
  membrosAtivos: number
  adminsAtivos: number
  exclusaoAgendadaPara: string | null
}

export interface ComunidadeCriada {
  id: string
  conviteDoPrimeiroAdmin: { link: string; expiraEm: string }
}
