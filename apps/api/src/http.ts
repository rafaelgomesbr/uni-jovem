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

export function validar<T>(esquema: z.ZodType<T>, corpo: unknown): T {
  const r = esquema.safeParse(corpo)
  if (!r.success) {
    throw new ErroHttp('dados_invalidos', 400, r.error.issues.map((i) => i.message).join(' '))
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
