import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  gerarMatrizMarkdown,
  MATRIZ,
  permite,
  podeVerPedidoDeOracao,
  VISIBILIDADE_PADRAO_DE_ORACAO,
  type Acao,
  type Ator,
  type Papel,
  type Recurso,
} from '../src/index.ts'

/**
 * Especificação escrita À PARTE da implementação, célula a célula.
 * Notação: A = Administrador ou acima, O = Organizador ou acima, M = Membro ou
 * acima, "X:p" = só o próprio registro, "|" = qualquer uma, C = Criador com 2FA,
 * K = Criador com ou sem 2FA (ADR 0007: ações que não destroem nada).
 * Se alguém acrescentar ação na matriz sem acrescentar aqui, o teste reprova.
 */
const ESPERADO: Record<string, string> = {
  'plataforma.criar_comunidade': 'K',
  'plataforma.suspender_comunidade': 'C',
  'plataforma.arquivar_comunidade': 'C',
  'plataforma.excluir_comunidade': 'C',
  'plataforma.nomear_admin': 'C',
  'plataforma.intervir_em_vinculo': 'C',
  'plataforma.transferir_propriedade': 'C',
  'plataforma.ler_auditoria_da_plataforma': 'C',
  'plataforma.ler_saude_da_plataforma': 'C',
  'plataforma.ler_comunidades': 'K',
  'plataforma.verificar_comunidade': 'K',
  'plataforma.ler_denuncias_de_comunidade': 'K',
  'plataforma.resolver_denuncia_de_comunidade': 'K',
  'comunidade.ler': 'M',
  'comunidade.configurar': 'A',
  'comunidade.trocar_logo': 'A',
  'comunidade.ver_codigo': 'A',
  'comunidade.trocar_codigo': 'A',
  'comunidade.aceitar_termo_do_admin': 'A',
  'pedido_entrada.ler': 'O',
  'pedido_entrada.decidir': 'O',
  'vinculo.listar': 'M',
  'vinculo.ver_contato': 'O',
  'vinculo.alterar_papel': 'A',
  'vinculo.desativar': 'A',
  'vinculo.remover': 'A',
  'vinculo.designar_equipe_oracao': 'A',
  'vinculo.sair': 'M:p',
  'convite.listar': 'A',
  'convite.criar': 'A',
  'convite.revogar': 'A',
  'evento.ler': 'M',
  'evento.criar': 'O',
  'evento.editar': 'O',
  'evento.publicar': 'O',
  'evento.cancelar_ou_adiar': 'O',
  'evento.excluir': 'O',
  'evento.ler_pacote_offline': 'M',
  'modelo.ler': 'O',
  'modelo.gerenciar': 'O',
  'etapa.ler': 'M',
  'etapa.gerenciar': 'O',
  'escala.ler': 'M',
  'escala.atribuir': 'O',
  'escala.confirmar': 'M:p',
  'escala.pedir_substituicao': 'M:p',
  'escala.assumir_substituicao': 'M',
  'disponibilidade.ler': 'O|M:p',
  'disponibilidade.informar': 'M:p',
  'tarefa.ler': 'M',
  'tarefa.gerenciar': 'O',
  'tarefa.concluir': 'O|M:p',
  'material.ler': 'M',
  'material.gerenciar': 'O',
  'checklist.ler': 'M',
  'checklist.gerenciar': 'O',
  'checklist.marcar': 'O|M:p',
  'nota_interna.ler': 'O',
  'nota_interna.gerenciar': 'O',
  'anexo.ler': 'M',
  'anexo.gerenciar': 'O',
  'inscricao.ler_lista': 'O',
  'inscricao.inscrever_se': 'M:p',
  'inscricao.ler_proprias': 'M:p',
  'inscricao.cancelar': 'O|M:p',
  'inscricao.gerenciar': 'O',
  'presenca.ler': 'O',
  'presenca.registrar': 'O',
  'ao_vivo.acompanhar': 'M',
  'ao_vivo.conduzir': 'O',
  'sugestao.criar': 'M',
  'sugestao.ler': 'O|M:p',
  'sugestao.moderar': 'O',
  'pedido_oracao.criar': 'M',
  'pedido_oracao.editar': 'M:p',
  'pedido_oracao.excluir': 'M:p',
  'pedido_oracao.mudar_visibilidade': 'M:p',
  'pedido_oracao.marcar_respondido': 'M:p',
  'pedido_oracao.orar': 'M',
  'conteudo.ler': 'M',
  'conteudo.gerenciar': 'O',
  'aviso.ler': 'M',
  'aviso.publicar': 'O',
  'relatorio.ler': 'O',
  'exportacao.sem_contatos': 'O',
  'exportacao.com_contatos': 'A',
  'exportacao.baixar': 'O:p',
  'auditoria.ler': 'A',
  'denuncia.criar': 'M',
  'denuncia.ler': 'A',
  'denuncia.resolver': 'A',
  'bloqueio.criar': 'M',
  'bloqueio.ler_proprios': 'M:p',
  'bloqueio.desfazer': 'M:p',
  'notificacao.configurar_proprias': 'M',
  'sincronizacao.ler_mudancas': 'M',
  'sincronizacao.enviar_operacoes': 'M',
}

const NIVEL_LETRA: Record<string, number> = { M: 10, O: 20, A: 30 }
const NIVEL_PAPEL: Record<Papel, number> = { membro: 10, organizador: 20, admin: 30 }

/** Situação da conta perante a plataforma: comum, Criador sem 2FA recente, Criador com 2FA. */
type Plataforma = 'comum' | 'criador_sem_2fa' | 'criador_com_2fa'
const PLATAFORMAS: Plataforma[] = ['comum', 'criador_sem_2fa', 'criador_com_2fa']

function esperado(
  regra: string,
  papel: Papel | null,
  proprio: boolean,
  plataforma: Plataforma,
): boolean {
  return regra.split('|').some((parte) => {
    if (parte === 'C') return plataforma === 'criador_com_2fa'
    if (parte === 'K') return plataforma !== 'comum'
    const [letra, escopo] = parte.split(':')
    if (papel === null) return false
    const nivelOk = NIVEL_PAPEL[papel] >= NIVEL_LETRA[letra!]!
    return escopo === 'p' ? nivelOk && proprio : nivelOk
  })
}

const PAPEIS_TESTADOS: (Papel | null)[] = [null, 'membro', 'organizador', 'admin']

describe('matriz de permissões', () => {
  it('a especificação cobre exatamente as ações da matriz', () => {
    const naMatriz = Object.entries(MATRIZ).flatMap(([r, acoes]) =>
      Object.keys(acoes).map((a) => `${r}.${a}`),
    )
    expect(new Set(naMatriz)).toEqual(new Set(Object.keys(ESPERADO)))
  })

  it('cada célula (papel × próprio × Criador) bate com a especificação', () => {
    let celulas = 0
    for (const [chave, regra] of Object.entries(ESPERADO)) {
      const [recurso, acao] = chave.split('.') as [Recurso, string]
      for (const papel of PAPEIS_TESTADOS) {
        for (const proprio of [false, true]) {
          for (const plataforma of PLATAFORMAS) {
            const ator: Ator = {
              papel,
              designacoes: [],
              proprietarioComDoisFatores: plataforma === 'criador_com_2fa',
              criador: plataforma !== 'comum',
            }
            const obtido = permite(ator, recurso, acao as Acao<typeof recurso>, { proprio })
            expect(obtido, `${chave} papel=${papel} proprio=${proprio} ${plataforma}`).toBe(
              esperado(regra, papel, proprio, plataforma),
            )
            celulas++
          }
        }
      }
    }
    expect(celulas).toBe(Object.keys(ESPERADO).length * 24)
  })

  it('repertório e banda são de leitura para todo vínculo ativo; editar é da organização (D73)', () => {
    const como = (papel: Papel | null): Ator => ({
      papel,
      designacoes: [],
      proprietarioComDoisFatores: false,
    })
    // O repertório é `etapa.ler`, a banda são as convocações (`escala.ler`) e as músicas, a Biblioteca (`conteudo.ler`).
    for (const papel of ['membro', 'organizador', 'admin'] as const) {
      expect(permite(como(papel), 'etapa', 'ler'), `etapa.ler ${papel}`).toBe(true)
      expect(permite(como(papel), 'escala', 'ler'), `escala.ler ${papel}`).toBe(true)
      expect(permite(como(papel), 'conteudo', 'ler'), `conteudo.ler ${papel}`).toBe(true)
    }
    // Sem vínculo ativo (outra comunidade ou conta sem vínculo) nada disso vale.
    expect(permite(como(null), 'etapa', 'ler')).toBe(false)
    expect(permite(como(null), 'escala', 'ler')).toBe(false)
    expect(permite(como(null), 'conteudo', 'ler')).toBe(false)
    // Editar o repertório e convocar continuam só da organização.
    expect(permite(como('membro'), 'etapa', 'gerenciar')).toBe(false)
    expect(permite(como('membro'), 'escala', 'atribuir')).toBe(false)
    expect(permite(como('organizador'), 'etapa', 'gerenciar')).toBe(true)
    expect(permite(como('organizador'), 'escala', 'atribuir')).toBe(true)
  })

  it('ator sem o campo `criador` (como o app monta) não ganha ação de plataforma', () => {
    const comum: Ator = { papel: 'admin', designacoes: [], proprietarioComDoisFatores: false }
    expect(permite(comum, 'plataforma', 'criar_comunidade')).toBe(false)
    expect(permite(comum, 'plataforma', 'verificar_comunidade')).toBe(false)
  })

  it('o Criador sem 2FA recente cria e verifica, mas não suspende, exclui nem intervém', () => {
    const semProva: Ator = {
      papel: null,
      designacoes: [],
      proprietarioComDoisFatores: false,
      criador: true,
    }
    expect(permite(semProva, 'plataforma', 'criar_comunidade')).toBe(true)
    expect(permite(semProva, 'plataforma', 'verificar_comunidade')).toBe(true)
    for (const acao of [
      'suspender_comunidade',
      'arquivar_comunidade',
      'excluir_comunidade',
      'intervir_em_vinculo',
      'nomear_admin',
      'transferir_propriedade',
    ] as const) {
      expect(permite(semProva, 'plataforma', acao), acao).toBe(false)
    }
  })

  it('ação inexistente é negada', () => {
    const admin: Ator = { papel: 'admin', designacoes: [], proprietarioComDoisFatores: true }
    expect(permite(admin, 'evento', 'inventada' as never)).toBe(false)
  })

  it('o Criador sem vínculo não faz nada dentro da comunidade só por ser Criador', () => {
    const criadorSemVinculo: Ator = {
      papel: null,
      designacoes: [],
      proprietarioComDoisFatores: true,
    }
    expect(permite(criadorSemVinculo, 'evento', 'ler')).toBe(false)
    expect(permite(criadorSemVinculo, 'auditoria', 'ler')).toBe(false)
    expect(permite(criadorSemVinculo, 'plataforma', 'criar_comunidade')).toBe(true)
  })
})

describe('visibilidade de pedidos de oração', () => {
  const autor = 'conta-autora'
  const ver = (
    visibilidade: 'somente_eu' | 'equipe_oracao' | 'comunidade',
    contaId: string,
    papel: Papel | null,
    equipe = false,
  ) =>
    podeVerPedidoDeOracao(
      { autorContaId: autor, visibilidade },
      { contaId, papel, designacoes: equipe ? ['equipe_oracao'] : [] },
    )

  it('o padrão é o mais restrito', () => {
    expect(VISIBILIDADE_PADRAO_DE_ORACAO).toBe('somente_eu')
  })

  it('"Somente eu": só a autora; admin não vê', () => {
    expect(ver('somente_eu', autor, 'membro')).toBe(true)
    expect(ver('somente_eu', 'outra', 'admin')).toBe(false)
    expect(ver('somente_eu', 'outra', 'admin', true)).toBe(false)
  })

  it('"Equipe de oração": só quem tem a designação, qualquer que seja o papel', () => {
    expect(ver('equipe_oracao', 'outra', 'membro', true)).toBe(true)
    expect(ver('equipe_oracao', 'outra', 'admin', false)).toBe(false)
    expect(ver('equipe_oracao', 'outra', null, true)).toBe(false)
  })

  it('"Comunidade": membros ativos; sem vínculo, não', () => {
    expect(ver('comunidade', 'outra', 'membro')).toBe(true)
    expect(ver('comunidade', 'outra', null)).toBe(false)
  })
})

describe('documento da matriz', () => {
  it('docs/matriz-permissoes.md está igual ao gerado do código', () => {
    const arquivo = join(import.meta.dirname, '..', '..', '..', 'docs', 'matriz-permissoes.md')
    expect(readFileSync(arquivo, 'utf8')).toBe(gerarMatrizMarkdown())
  })
})
