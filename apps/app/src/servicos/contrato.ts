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
  /** Foto de perfil (D33); ausentes em API anterior à migração 0018. */
  temFoto?: boolean
  fotoVersao?: string | null
  /** TC-01 declarada (ADR 0007): criar comunidade pede 18 ou mais. Ausente: o app não sabe. */
  faixaEtaria?: '18_mais' | '16_17' | null
  /** Conta criada só com Google ou Apple não tem senha: excluir confirma pelo provedor. */
  temSenha?: boolean
  /** Versão dos Termos e da Política aceita pela conta (ex.: "0.3"). */
  versaoDosTermosAceita?: string | null
}

export interface ComunidadeDoVinculo {
  id: string
  nome: string
  cor: string
  estado: EstadoDaComunidade
  papel: Papel
  designacoes: Designacao[]
  /** Logotipo (D33); ausentes em API anterior à migração 0018. */
  temLogo?: boolean
  logoVersao?: string | null
  /** Admin que ainda não aceitou o Termo do Administrador (TC-16), ou versão nova dele. */
  precisaAceitarTermoDoAdmin?: boolean
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

export interface DetalheDaComunidade extends DetalheDaComunidadeAberta {
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
  /** Foto de perfil (D33), servida só a quem é da mesma comunidade. */
  temFoto?: boolean
  fotoVersao?: string | null
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

// ---------------------------------------------------------------------------
// ADR 0007: app aberto ("livre com rodinhas"). Campos novos ficam opcionais
// quando vêm em respostas que já existiam: o app continua funcionando com uma
// API anterior à mudança.
// ---------------------------------------------------------------------------

/**
 * TC-02 ("Li e concordo com os Termos de Uso e a Política de Privacidade") e,
 * para 16 e 17 anos, a ciência do responsável, que a própria opção da TC-01
 * declara ("meu responsável legal sabe ... e concorda").
 */
export interface Aceites {
  termos: boolean
  responsavelCiente?: boolean
}

/** `POST /api/auth/provedor/:provedor` quando a conta ainda não existe (ADR 0007). */
export interface CadastroPendente {
  cadastroPendente: true
  /** Vale 15 minutos e uma vez. */
  tokenDeCadastro: string
  nome: string
  email: string
}

export type RespostaDoProvedor = RespostaDeEntrar | CadastroPendente

export type VerificacaoDaComunidade = 'nova' | 'verificada'

/** `livre` (sem código) continua não habilitado e não aparece no app. */
export type ModoDeEntrada = 'convite' | 'codigo_com_aprovacao' | 'codigo_direto'

/** Limites da comunidade `nova` e o uso atual (some quando é verificada). */
export interface LimitesDaComunidade {
  /** Vínculos ativos permitidos; `null` sem limite (verificada). */
  membrosAtivos: number | null
  /** Página pública de inscrição permitida (só verificada). */
  eventoPublico?: boolean
}

export interface UsoDaComunidade {
  membrosAtivos: number
}

/** Campos do detalhe da comunidade que a ADR 0007 acrescenta. */
export interface DetalheDaComunidadeAberta {
  idPublico?: string
  cidade?: string | null
  modoEntrada?: ModoDeEntrada
  encontravel?: boolean
  verificacao?: VerificacaoDaComunidade
  limites?: LimitesDaComunidade
  uso?: UsoDaComunidade
  precisaAceitarTermoDoAdmin?: boolean
}

/** `POST /api/v1/comunidades`. */
export interface ComunidadeCriadaPorConta {
  id: string
  nome?: string
  codigo?: string
  link?: string
}

/** Item de `GET /api/v1/comunidades/busca`: nunca traz membros nem contagem. */
export interface ComunidadeEncontrada {
  idPublico: string
  nome: string
  cidade: string | null
  cor: string
  temLogo: boolean
  logoVersao: string | null
  verificada: boolean
  modoEntrada: ModoDeEntrada
}

/** `POST /api/v1/entrada` e `POST /api/v1/comunidades/:idPublico/pedidos`. */
export interface ResultadoDaEntrada {
  resultado: 'membro' | 'pedido_pendente'
  comunidade: { id?: string; nome: string }
}

export type EstadoDoPedidoDeEntrada = 'pendente' | 'aceito' | 'nao_aprovado'

/** Item de `GET /api/v1/eu/pedidos`: quem pediu nunca vê quem decidiu. */
export interface MeuPedidoDeEntrada {
  id: string
  estado: EstadoDoPedidoDeEntrada
  /** O id só vem depois de aceito. */
  comunidade: { id?: string | null; nome: string; cor?: string; cidade?: string | null }
  criadoEm: string
  respondidoEm?: string | null
}

/** Item de `GET /api/v1/c/:comunidadeId/pedidos?estado=pendente` (admin e organizador). */
export interface PedidoDeEntrada {
  id: string
  nome: string
  mensagem: string | null
  /** Por onde chegou: o código ou a busca. */
  origem?: 'codigo' | 'busca' | string
  criadoEm: string
  avatar?: AvatarDaConta | null
}

/** `GET` e `POST .../codigo/trocar` (admin). */
export interface CodigoDaComunidade {
  codigo: string
  link: string
  modoEntrada?: ModoDeEntrada
}

/** Os motivos que a API aceita hoje (TC-19.v1). */
export type MotivoDaDenunciaDeComunidade = 'falsa' | 'golpe' | 'ofensiva' | 'spam' | 'outro'

/** Item de `GET /api/v1/plataforma/comunidades` com os campos da ADR 0007. */
export interface ComunidadeDaPlataformaAberta {
  cidade?: string | null
  criadoEm?: string
  /** Quem criou a comunidade (o admin criador); `null` nas criadas pela Plataforma. */
  criador?: { nome: string; email: string | null } | null
  denunciasAbertas?: number
  verificacao?: VerificacaoDaComunidade
}

export interface PaginaDeComunidadesDaPlataforma {
  comunidades: (ComunidadeDaPlataforma & ComunidadeDaPlataformaAberta)[]
  proximoCursor?: string | null
}

/** Item de `GET /api/v1/plataforma/denuncias-de-comunidade` (padrão: só as abertas). */
export interface DenunciaDeComunidade {
  id: string
  comunidade: { id: string; nome: string }
  motivo: MotivoDaDenunciaDeComunidade | string
  detalhe: string | null
  estado: 'aberta' | 'procedente' | 'improcedente'
  resolucao: string | null
  criadoEm: string
  resolvidaEm: string | null
}

/** `POST .../denuncias-de-comunidade/:id/resolver`. */
export type ResolucaoDaDenuncia = 'procedente' | 'improcedente'
