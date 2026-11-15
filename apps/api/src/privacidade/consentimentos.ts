/**
 * Versões vigentes dos textos de consentimento (docs/privacidade/
 * textos-de-consentimento.md). Mudou o texto, sobe a versão aqui: quem aceitou
 * a anterior continua registrado com ela em `uj.consentimentos`.
 */
export const VERSAO_DO_TEXTO = {
  'TC-01': 1,
  'TC-02': 1,
  'TC-03': 1,
  'TC-04': 1,
} as const

export const FAIXAS_ETARIAS = ['16_17', '18_mais'] as const
export type FaixaEtaria = (typeof FAIXAS_ETARIAS)[number]

/** Mensagem do TC-01 para quem declara menos de 16 anos (nada é gravado). */
export const MENSAGEM_MENOR_DE_16 =
  'Que bom que você quer participar! Para ter uma conta no Uni Jovem é preciso ter 16 anos ou mais. Fale com a liderança da sua comunidade: ela pode inscrever você nos eventos com a ajuda do seu responsável.'

export const MENSAGEM_SEM_TERMOS = 'Para criar a conta, é preciso concordar com os Termos de Uso.'

export const MENSAGEM_SEM_CONSENTIMENTO_DE_FE =
  'Sem essa concordância não conseguimos incluir você na comunidade, porque o app usa esses dados para funcionar. Se mudar de ideia, o mesmo convite continua valendo enquanto não vencer.'

export const MENSAGEM_SEM_RESPONSAVEL =
  'Para quem tem 16 ou 17 anos, confirme que seu pai, sua mãe ou seu responsável legal sabe e concorda.'
