import type { z } from 'zod'

/**
 * Erro com status HTTP e mensagem em linguagem humana (pt-BR), que vai para a
 * tela como está. Detalhe técnico nunca entra na mensagem.
 */
export class ErroHttp extends Error {
  constructor(
    public readonly codigo: string,
    public readonly status: number,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroHttp'
  }
}

export const NAO_ENCONTRADO = () =>
  new ErroHttp('nao_encontrado', 404, 'Não encontramos o que você procurou.')
export const SEM_PERMISSAO = () =>
  new ErroHttp('sem_permissao', 403, 'Seu papel nesta comunidade não permite esta ação.')

export const SERIE_ENCERRADA = () =>
  new ErroHttp(
    'serie_encerrada',
    409,
    'Esta série foi encerrada e não recebe mais alterações. Crie uma série nova se precisar.',
  )

/** Comunidade `nova` no teto de vínculos ativos (ADR 0007, gatilho UJ080). */
export const LIMITE_DE_PARTICIPANTES = () =>
  new ErroHttp(
    'limite_de_participantes',
    409,
    'Esta comunidade chegou ao limite de 30 participantes enquanto não é verificada. Fale com a liderança dela.',
  )

/** Comunidade `nova` não tem evento público (ADR 0007, gatilho UJ081). */
export const EVENTO_PUBLICO_INDISPONIVEL = () =>
  new ErroHttp(
    'evento_publico_indisponivel',
    409,
    'Comunidades novas ainda não podem ter evento com inscrição pública. Deixe o evento interno até a comunidade ser verificada.',
  )

/** Quando o campo não tem nome conhecido, a tela recebe só esta frase. */
export const MENSAGEM_DADOS_INVALIDOS = 'Confira os dados e tente de novo.'

/**
 * Nome do campo como a pessoa o vê na tela, para as mensagens padrão de
 * validação. Campo fora desta lista (ids, chaves, opções técnicas) cai na
 * mensagem genérica: um id errado não é algo que a pessoa consiga corrigir.
 */
const ROTULO_DO_CAMPO: Record<string, string> = {
  titulo: 'o título',
  nome: 'o nome',
  email: 'o e-mail',
  whatsapp: 'o WhatsApp',
  texto: 'o texto',
  descricao: 'a descrição',
  categoria: 'a categoria',
  motivo: 'o motivo',
  endereco: 'o endereço',
  informacoesUteis: 'as informações úteis',
  observacao: 'a observação',
  observacoes: 'as observações',
  instrucoes: 'as instruções',
  objetivo: 'o objetivo',
  resposta: 'a resposta',
  referencia: 'a referência',
  artista: 'o artista',
  cifra: 'a cifra',
  tom: 'o tom',
  tomDoDia: 'o tom do dia',
  andamentoBpm: 'o andamento',
  duracaoSeg: 'a duração',
  nota: 'a observação',
  detalhe: 'o detalhe',
  resolucao: 'a resolução',
  senha: 'a senha',
  senhaAtual: 'a senha atual',
  codigo: 'o código',
  capacidade: 'a capacidade',
  duracaoMin: 'a duração',
  inicio: 'a data e a hora de início',
  inscricaoAte: 'o prazo das inscrições',
  quantidade: 'a quantidade',
  prazo: 'o prazo',
  cor: 'a cor',
  nomeAvulso: 'o nome',
  confirmacaoNome: 'o nome de confirmação',
  cidade: 'a cidade',
  mensagem: 'a mensagem',
  q: 'a busca',
  funcao: 'a função',
  data: 'a data',
  hora: 'a hora',
}

/**
 * Mensagem padrão (o esquema não trouxe uma própria) em português humano.
 * Nunca repete o texto do Zod, que é técnico e em inglês ("Too small: ...").
 */
function mensagemPadrao(iss: {
  code: string
  path?: PropertyKey[] | undefined
  input?: unknown
  origin?: string | undefined
}): string {
  const campo = [...(iss.path ?? [])].reverse().find((p) => typeof p === 'string')
  const rotulo = campo ? ROTULO_DO_CAMPO[campo] : undefined
  if (!rotulo) return MENSAGEM_DADOS_INVALIDOS
  const vazio =
    iss.input === undefined ||
    iss.input === null ||
    (typeof iss.input === 'string' && iss.input.trim() === '')
  if ((iss.code === 'invalid_type' || iss.code === 'too_small') && vazio) {
    return `Preencha ${rotulo}.`
  }
  if (iss.origin === 'string' && iss.code === 'too_small') {
    return `Confira ${rotulo}: tem poucos caracteres.`
  }
  if (iss.origin === 'string' && iss.code === 'too_big') {
    return `Encurte ${rotulo}: passou do tamanho permitido.`
  }
  if (iss.code === 'too_small' || iss.code === 'too_big') {
    return `Confira ${rotulo}: o valor está fora do permitido.`
  }
  return `Confira ${rotulo} e tente de novo.`
}

export function validar<T>(esquema: z.ZodType<T>, corpo: unknown): T {
  // O mapa por chamada só vale onde o esquema não tem mensagem própria: as
  // mensagens de regra de negócio ("Informe seu nome.") passam como estão.
  const r = esquema.safeParse(corpo, { error: (iss) => mensagemPadrao(iss) })
  if (!r.success) {
    const mensagens = [...new Set(r.error.issues.map((i) => i.message))]
    throw new ErroHttp('dados_invalidos', 400, mensagens.join(' '))
  }
  return r.data
}

/**
 * Traduz erros que o banco levanta pelas regras de negócio (gatilhos, CHECK,
 * RLS) para respostas HTTP. Erro desconhecido segue adiante (vira 500).
 */
export function traduzirErroDoBanco(e: unknown): never {
  const erro = e as { code?: string; message?: string }
  const msg = erro.message ?? ''
  if (msg.includes('sem administrador')) {
    throw new ErroHttp(
      'ultimo_admin',
      409,
      'A comunidade ficaria sem administrador. Nomeie outra pessoa como administradora antes.',
    )
  }
  if (msg.includes('proprio papel')) {
    throw new ErroHttp('proprio_papel', 403, 'Ninguém altera o próprio papel.')
  }
  if (msg.includes('so e permitido sair')) {
    throw new ErroHttp('so_sair', 403, 'Sobre o seu próprio vínculo, só é possível sair.')
  }
  if (msg.includes('protegido')) {
    throw new ErroHttp('conta_protegida', 403, 'A conta do Criador não pode ser alterada.')
  }
  if (msg.includes('exclusivo do proprietario')) {
    throw new ErroHttp('so_criador', 403, 'Só o Criador altera o ciclo de vida da comunidade.')
  }
  if (msg.includes('so organizadores')) {
    throw new ErroHttp('so_organizadores', 403, 'Só organizadores podem editar isto.')
  }
  if (msg.includes('row-level security')) throw SEM_PERMISSAO()
  if (erro.code === 'UJ060') {
    throw new ErroHttp(
      'limite_de_avisos',
      429,
      'Muitos avisos publicados na última hora. Espere um pouco antes de publicar outro.',
    )
  }
  if (erro.code === 'UJ100') {
    throw new ErroHttp(
      'direitos_nao_confirmados',
      400,
      'Confirme que a sua comunidade pode usar esta letra e esta cifra antes de salvar.',
    )
  }
  if (erro.code === 'UJ070') {
    throw SERIE_ENCERRADA()
  }
  // Rodinhas da comunidade nova (ADR 0007), conferidas por gatilho no banco.
  if (erro.code === 'UJ080') throw LIMITE_DE_PARTICIPANTES()
  if (erro.code === 'UJ081') throw EVENTO_PUBLICO_INDISPONIVEL()
  if (erro.code === '23503') {
    // Referência a algo de outra comunidade ou inexistente: mesmo tratamento.
    throw new ErroHttp(
      'referencia_invalida',
      400,
      'Uma das pessoas ou itens escolhidos não existe aqui.',
    )
  }
  if (erro.code === '23505') {
    throw new ErroHttp('duplicado', 409, 'Isto já está cadastrado.')
  }
  if (erro.code === '23514') {
    throw new ErroHttp('dados_invalidos', 400, 'Algum valor está fora do permitido.')
  }
  throw e
}
