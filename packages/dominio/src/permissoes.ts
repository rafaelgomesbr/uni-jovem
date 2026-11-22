import { NIVEL, NOME_DO_PAPEL, type Papel } from './papeis.ts'

/**
 * Matriz papel × recurso × ação. É a ÚNICA fonte da verdade de permissão na
 * aplicação: a API consulta `permite`, a interface usa o mesmo resultado só
 * para esconder controles, e `docs/matriz-permissoes.md` é gerado daqui
 * (`npm run gerar:matriz`; o teste reprova se o documento divergir).
 *
 * O banco (RLS) é uma segunda camada independente: mesmo que a API erre, a
 * política da tabela segura a leitura e a escrita fora da comunidade.
 *
 * Negar por padrão: recurso ou ação que não estão aqui não são permitidos.
 */

export type Designacao = 'equipe_oracao'

export type Exigencia =
  /** Qualquer registro da comunidade, a partir deste papel. */
  | { tipo: 'papel'; minimo: Papel }
  /** Só registros da própria pessoa (autora, inscrita, escalada, responsável). */
  | { tipo: 'proprio'; minimo: Papel }
  /** Quem tem a designação, independentemente do papel. */
  | { tipo: 'designacao'; designacao: Designacao }
  /** Ação de plataforma: só o proprietário, com 2FA recente. */
  | { tipo: 'proprietario' }
  /**
   * Ação de plataforma que não destrói nada (ADR 0007): só o proprietário,
   * sem pedir o código do autenticador. Auditada.
   */
  | { tipo: 'criador' }

const papel = (minimo: Papel): Exigencia => ({ tipo: 'papel', minimo })
const proprio = (minimo: Papel = 'membro'): Exigencia => ({ tipo: 'proprio', minimo })
const proprietario: Exigencia = { tipo: 'proprietario' }
const criador: Exigencia = { tipo: 'criador' }

export const MATRIZ = {
  plataforma: {
    // ADR 0007 (revisa D12 e D31): criar comunidade não pede o código do autenticador.
    criar_comunidade: [criador],
    suspender_comunidade: [proprietario],
    arquivar_comunidade: [proprietario],
    excluir_comunidade: [proprietario],
    nomear_admin: [proprietario],
    intervir_em_vinculo: [proprietario],
    transferir_propriedade: [proprietario],
    ler_auditoria_da_plataforma: [proprietario],
    // Painel de saúde: só números agregados, sem conteúdo nem pessoa.
    ler_saude_da_plataforma: [proprietario],
    // ADR 0007: lista de comunidades, verificar e desverificar, denúncias de
    // comunidade. Não destroem nada e ficam na auditoria.
    ler_comunidades: [criador],
    verificar_comunidade: [criador],
    ler_denuncias_de_comunidade: [criador],
    resolver_denuncia_de_comunidade: [criador],
  },
  comunidade: {
    ler: [papel('membro')],
    configurar: [papel('admin')],
    // Enviar ou remover o logotipo (D33). Ver o logotipo é `ler`.
    trocar_logo: [papel('admin')],
    // Código de entrada da comunidade (ADR 0007): ver, com QR e link, e trocar.
    ver_codigo: [papel('admin')],
    trocar_codigo: [papel('admin')],
    // Aceite do termo do administrador (TC-16) por quem foi promovido depois
    // da criação, ou a cada versão nova do termo.
    aceitar_termo_do_admin: [papel('admin')],
    // Excluir a PRÓPRIA comunidade (D77, ADR 0009): só a administração, com 30 dias de
    // carência. Não é `plataforma.excluir_comunidade` (essa é do Criador, com 2FA).
    excluir: [papel('admin')],
    desfazer_exclusao: [papel('admin')],
  },
  pedido_entrada: {
    // Pedidos de quem quer entrar (código com aprovação ou busca).
    ler: [papel('organizador')],
    decidir: [papel('organizador')],
  },
  vinculo: {
    listar: [papel('membro')],
    ver_contato: [papel('organizador')],
    alterar_papel: [papel('admin')],
    desativar: [papel('admin')],
    remover: [papel('admin')],
    designar_equipe_oracao: [papel('admin')],
    sair: [proprio('membro')],
  },
  convite: {
    listar: [papel('admin')],
    criar: [papel('admin')],
    revogar: [papel('admin')],
  },
  evento: {
    ler: [papel('membro')],
    criar: [papel('organizador')],
    editar: [papel('organizador')],
    publicar: [papel('organizador')],
    cancelar_ou_adiar: [papel('organizador')],
    excluir: [papel('organizador')],
    // Limpar de uma vez os próximos encontros (D77): apagar sem avisar ou cancelar e
    // avisar. É a soma de `excluir` e `cancelar_ou_adiar`, as duas já do organizador.
    limpar_proximos: [papel('organizador')],
    // Pacote para uso sem internet (F13): o mesmo que a pessoa já lê, com validade.
    ler_pacote_offline: [papel('membro')],
  },
  modelo: {
    ler: [papel('organizador')],
    gerenciar: [papel('organizador')],
  },
  etapa: {
    ler: [papel('membro')],
    gerenciar: [papel('organizador')],
  },
  escala: {
    ler: [papel('membro')],
    atribuir: [papel('organizador')],
    confirmar: [proprio('membro')],
    pedir_substituicao: [proprio('membro')],
    assumir_substituicao: [papel('membro')],
  },
  disponibilidade: {
    ler: [papel('organizador'), proprio('membro')],
    informar: [proprio('membro')],
  },
  tarefa: {
    ler: [papel('membro')],
    gerenciar: [papel('organizador')],
    concluir: [papel('organizador'), proprio('membro')],
  },
  material: {
    ler: [papel('membro')],
    gerenciar: [papel('organizador')],
  },
  checklist: {
    ler: [papel('membro')],
    gerenciar: [papel('organizador')],
    marcar: [papel('organizador'), proprio('membro')],
  },
  nota_interna: {
    ler: [papel('organizador')],
    gerenciar: [papel('organizador')],
  },
  anexo: {
    ler: [papel('membro')],
    gerenciar: [papel('organizador')],
  },
  inscricao: {
    ler_lista: [papel('organizador')],
    inscrever_se: [proprio('membro')],
    // As próprias inscrições na comunidade (evento, estado e código de entrada).
    ler_proprias: [proprio('membro')],
    cancelar: [papel('organizador'), proprio('membro')],
    gerenciar: [papel('organizador')],
  },
  presenca: {
    ler: [papel('organizador')],
    registrar: [papel('organizador')],
  },
  ao_vivo: {
    acompanhar: [papel('membro')],
    conduzir: [papel('organizador')],
  },
  sugestao: {
    criar: [papel('membro')],
    ler: [papel('organizador'), proprio('membro')],
    moderar: [papel('organizador')],
  },
  pedido_oracao: {
    // Leitura depende da visibilidade do pedido: ver `podeVerPedidoDeOracao`.
    criar: [papel('membro')],
    editar: [proprio('membro')],
    excluir: [proprio('membro')],
    mudar_visibilidade: [proprio('membro')],
    marcar_respondido: [proprio('membro')],
    // "Estou orando": qualquer vínculo, mas só em pedido que a pessoa já vê.
    orar: [papel('membro')],
  },
  conteudo: {
    ler: [papel('membro')],
    gerenciar: [papel('organizador')],
  },
  aviso: {
    ler: [papel('membro')],
    publicar: [papel('organizador')],
  },
  relatorio: {
    ler: [papel('organizador')],
  },
  exportacao: {
    sem_contatos: [papel('organizador')],
    com_contatos: [papel('admin')],
    // Só a própria exportação (dona), dentro da validade; a com contatos, só admin.
    baixar: [proprio('organizador')],
  },
  auditoria: {
    ler: [papel('admin')],
  },
  denuncia: {
    // Só conteúdo que a pessoa vê (o banco confere); quem denunciou não aparece na fila.
    criar: [papel('membro')],
    ler: [papel('admin')],
    resolver: [papel('admin')],
  },
  bloqueio: {
    // Bloquear quem escreveu algo que a pessoa vê (Apple 1.2, D35): só esconde o
    // conteúdo dessa pessoa para quem bloqueou. Ninguém vê os bloqueios de outra
    // pessoa, nem administradores; quem foi bloqueado não fica sabendo.
    criar: [papel('membro')],
    ler_proprios: [proprio('membro')],
    desfazer: [proprio('membro')],
  },
  notificacao: {
    // Preferências e lista das PRÓPRIAS notificações nesta comunidade.
    configurar_proprias: [papel('membro')],
  },
  sincronizacao: {
    // O log já vem filtrado pelo que a pessoa pode ver; cada operação revalida a própria regra.
    ler_mudancas: [papel('membro')],
    enviar_operacoes: [papel('membro')],
  },
} as const satisfies Record<string, Record<string, readonly Exigencia[]>>

export type Recurso = keyof typeof MATRIZ
export type Acao<R extends Recurso> = keyof (typeof MATRIZ)[R] & string

export interface Ator {
  /** Papel do vínculo ATIVO na comunidade do contexto; null sem vínculo. */
  papel: Papel | null
  designacoes: readonly Designacao[]
  /** Proprietário da plataforma, com 2FA recente já conferido pela API. */
  proprietarioComDoisFatores: boolean
  /**
   * Proprietário da plataforma, mesmo sem o 2FA recente (conferido no banco
   * pela API). Sem o campo, vale `proprietarioComDoisFatores`.
   */
  criador?: boolean
}

export interface Alvo {
  /** O registro pertence à própria pessoa (autora, inscrita, escalada, responsável). */
  proprio: boolean
}

function atende(exigencia: Exigencia, ator: Ator, alvo: Alvo | undefined): boolean {
  switch (exigencia.tipo) {
    case 'proprietario':
      return ator.proprietarioComDoisFatores
    case 'criador':
      return ator.criador === true || ator.proprietarioComDoisFatores
    case 'designacao':
      return ator.papel !== null && ator.designacoes.includes(exigencia.designacao)
    case 'papel':
      return ator.papel !== null && NIVEL[ator.papel] >= NIVEL[exigencia.minimo]
    case 'proprio':
      return (
        ator.papel !== null &&
        NIVEL[ator.papel] >= NIVEL[exigencia.minimo] &&
        alvo?.proprio === true
      )
  }
}

export function permite<R extends Recurso>(
  ator: Ator,
  recurso: R,
  acao: Acao<R>,
  alvo?: Alvo,
): boolean {
  const exigencias = (MATRIZ[recurso] as Record<string, readonly Exigencia[] | undefined>)[acao]
  if (!exigencias) return false
  return exigencias.some((e) => atende(e, ator, alvo))
}

// ------------------------------------------------------------ pedidos de oração

export const VISIBILIDADES_DE_ORACAO = ['somente_eu', 'equipe_oracao', 'comunidade'] as const
export type VisibilidadeDeOracao = (typeof VISIBILIDADES_DE_ORACAO)[number]
/** Todo pedido começa no público mais restrito. */
export const VISIBILIDADE_PADRAO_DE_ORACAO: VisibilidadeDeOracao = 'somente_eu'

export const QUEM_VE_O_PEDIDO: Readonly<Record<VisibilidadeDeOracao, string>> = {
  somente_eu: 'Só você.',
  equipe_oracao:
    'Você e as pessoas designadas para a equipe de oração desta comunidade. Administradores não veem, a menos que estejam na equipe.',
  comunidade: 'Você e todos os membros ativos desta comunidade.',
}

/**
 * Quem lê um pedido. Ser admin ou proprietário da plataforma NÃO dá acesso:
 * a regra só olha autoria, designação e vínculo ativo.
 */
export function podeVerPedidoDeOracao(
  pedido: { autorContaId: string; visibilidade: VisibilidadeDeOracao },
  ator: { contaId: string; papel: Papel | null; designacoes: readonly Designacao[] },
): boolean {
  if (ator.contaId === pedido.autorContaId) return true
  if (ator.papel === null) return false
  switch (pedido.visibilidade) {
    case 'somente_eu':
      return false
    case 'equipe_oracao':
      return ator.designacoes.includes('equipe_oracao')
    case 'comunidade':
      return true
  }
}

// ------------------------------------------------------------ documento gerado

function descrever(e: Exigencia): string {
  switch (e.tipo) {
    case 'proprietario':
      return 'Criador (2FA)'
    case 'criador':
      return 'Criador (sem 2FA)'
    case 'designacao':
      return 'equipe de oração'
    case 'papel':
      return `${NOME_DO_PAPEL[e.minimo]} ou acima`
    case 'proprio':
      return `${NOME_DO_PAPEL[e.minimo]} ou acima, só o próprio`
  }
}

export function gerarMatrizMarkdown(): string {
  const linhas = [
    '# Matriz de permissões',
    '',
    '> Gerado de `packages/dominio/src/permissoes.ts` por `npm run gerar:matriz`. Não edite à mão:',
    '> o teste `matriz-documento` reprova quando este arquivo diverge do código.',
    '',
    'Hierarquia: Administrador (30) > Organizador (20) > Membro (10). "Criador" é o proprietário',
    'da plataforma, um atributo global e não um papel de comunidade. Tudo que não está listado é negado.',
    '',
    '| Recurso | Ação | Quem pode |',
    '| --- | --- | --- |',
  ]
  for (const [recurso, acoes] of Object.entries(MATRIZ)) {
    for (const [acao, exigencias] of Object.entries(
      acoes as Record<string, readonly Exigencia[]>,
    )) {
      linhas.push(`| ${recurso} | ${acao} | ${exigencias.map(descrever).join('; ')} |`)
    }
  }
  linhas.push(
    '',
    '## Pedidos de oração',
    '',
    '| Visibilidade | Quem lê |',
    '| --- | --- |',
    ...VISIBILIDADES_DE_ORACAO.map((v) => `| ${v} | ${QUEM_VE_O_PEDIDO[v]} |`),
    '',
    'Administradores e o Criador não recebem acesso automático a pedidos de outras pessoas.',
    '',
  )
  return linhas.join('\n')
}
