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
 * acima, "X:p" = só o próprio registro, "|" = qualquer uma, C = Criador com 2FA.
 * Se alguém acrescentar ação na matriz sem acrescentar aqui, o teste reprova.
 */
const ESPERADO: Record<string, string> = {
  'plataforma.criar_comunidade': 'C',
  'plataforma.suspender_comunidade': 'C',
  'plataforma.arquivar_comunidade': 'C',
  'plataforma.excluir_comunidade': 'C',
  'plataforma.nomear_admin': 'C',
  'plataforma.intervir_em_vinculo': 'C',
  'plataforma.transferir_propriedade': 'C',
  'plataforma.ler_auditoria_da_plataforma': 'C',
  'comunidade.ler': 'M',
  'comunidade.configurar': 'A',
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
}

const NIVEL_LETRA: Record<string, number> = { M: 10, O: 20, A: 30 }
const NIVEL_PAPEL: Record<Papel, number> = { membro: 10, organizador: 20, admin: 30 }

function esperado(regra: string, papel: Papel | null, proprio: boolean, criador: boolean): boolean {
  return regra.split('|').some((parte) => {
    if (parte === 'C') return criador
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
          for (const criador of [false, true]) {
            const ator: Ator = { papel, designacoes: [], proprietarioComDoisFatores: criador }
            const obtido = permite(ator, recurso, acao as Acao<typeof recurso>, { proprio })
            expect(obtido, `${chave} papel=${papel} proprio=${proprio} criador=${criador}`).toBe(
              esperado(regra, papel, proprio, criador),
            )
            celulas++
          }
        }
      }
    }
    expect(celulas).toBe(Object.keys(ESPERADO).length * 16)
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
