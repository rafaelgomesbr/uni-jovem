import { NOME_DO_APP } from '@uj/dominio'

/**
 * Versões vigentes dos textos de consentimento (docs/privacidade/
 * textos-de-consentimento.md). Mudou o texto, sobe a versão aqui: quem aceitou
 * a anterior continua registrado com ela em `uj.consentimentos`.
 */
export const VERSAO_DO_TEXTO = {
  // v2 (15/11/2026, ADR 0007): cadastro com ou sem convite (e-mail, Google, Apple).
  'TC-01': 2,
  // v2 (15/11/2026): aceite dos Termos 0.3 e da Política 0.3.
  'TC-02': 2,
  // v3 (15/11/2026, ADR 0007): também ao pedir entrada, entrar por código e
  // criar comunidade. (A v2 trocou o caminho para desfazer para a aba Equipe.)
  'TC-03': 3,
  'TC-04': 1,
  // Termo do administrador da comunidade (ADR 0007), aceito ao criar uma comunidade.
  'TC-16': 1,
} as const

export const FAIXAS_ETARIAS = ['16_17', '18_mais'] as const
export type FaixaEtaria = (typeof FAIXAS_ETARIAS)[number]

/** Mensagem do TC-01 para quem declara menos de 16 anos (nada é gravado). */
export const MENSAGEM_MENOR_DE_16 = `Que bom que você quer participar! Para ter uma conta no ${NOME_DO_APP} é preciso ter 16 anos ou mais. Se o seu grupo tiver um evento com inscrição aberta, seu pai, sua mãe ou seu responsável pode inscrever você pela página do evento.`

export const MENSAGEM_SEM_TERMOS = 'Para criar a conta, é preciso concordar com os Termos de Uso.'

export const MENSAGEM_SEM_CONSENTIMENTO_DE_FE =
  'Sem essa concordância não conseguimos incluir você na comunidade, porque o app usa esses dados para funcionar. Se mudar de ideia, é só tentar de novo.'

/** TC-03 na entrada por código, no pedido e na criação (ADR 0007): o mesmo texto. */
export const MENSAGEM_SEM_CONSENTIMENTO_DE_FE_NA_ENTRADA = MENSAGEM_SEM_CONSENTIMENTO_DE_FE

/** TC-16: termo do administrador da comunidade. */
export const MENSAGEM_SEM_TERMO_DO_ADMIN =
  'Para criar a comunidade, é preciso aceitar o Termo do Administrador.'

export const MENSAGEM_SEM_RESPONSAVEL =
  'Para quem tem 16 ou 17 anos, confirme que seu pai, sua mãe ou seu responsável legal sabe e concorda.'
