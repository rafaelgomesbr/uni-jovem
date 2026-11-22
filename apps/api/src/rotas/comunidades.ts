import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import {
  LIMITES_DA_COMUNIDADE_NOVA,
  modoDeEntradaHabilitado,
  MODOS_DE_ENTRADA,
  NOME_DO_APP,
  PAPEIS,
  podeConcederPapel,
} from '@uj/dominio'
import { ehCorDoAvatar, ehIconeDoAvatar } from '@uj/tokens'
import { gerarToken, hmacDeToken } from '../autenticacao/cripto.ts'
import { sortearCodigo } from '../autenticacao/codigoDaComunidade.ts'
import type { Config } from '../config.ts'
import type { Correio } from '../correio/correio.ts'
import { ErroHttp, NAO_ENCONTRADO, SEM_PERMISSAO, traduzirErroDoBanco, validar } from '../http.ts'
import {
  nome as campoNome,
  whatsapp as campoWhatsapp,
  email as campoEmail,
} from './autenticacao.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'
import { emTransacao } from '../banco/contexto.ts'
import { versaoDoHash } from '../imagens/processar.ts'
import { VERSAO_DO_TEXTO } from '../privacidade/consentimentos.ts'

export interface DependenciasComunidades {
  config: Config
  api: pg.Pool
  correio: Correio
  emSegundoPlano: (trabalho: Promise<unknown>) => void
}

export const VALIDADE_MAXIMA_CONVITE_DIAS = 7

export const fusoValido = z
  .string()
  .max(64)
  .refine((f) => {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: f })
      return true
    } catch {
      return false
    }
  }, 'Fuso horário desconhecido.')
const cor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor no formato #RRGGBB.')
const papel = z.enum(PAPEIS)

/** Link do convite: token no FRAGMENTO, que não vai para log de servidor nem Referer. */
export function linkDoConvite(config: Config, token: string): string {
  return new URL(`/convite#t=${token}`, config.URL_PUBLICA).toString()
}

export async function criarConvite(
  c: pg.PoolClient,
  config: Config,
  dados: {
    comunidadeId: string
    papel: string
    email: string | null
    validadeDias: number
    criadoPor: string
  },
): Promise<{ id: string; token: string; expiraEm: Date }> {
  const token = gerarToken()
  const { rows } = await c.query<{ id: string; expira_em: Date }>(
    `insert into uj.convites (comunidade_id, papel, email_destino, token_hmac, expira_em, criado_por)
     values ($1, $2, $3, $4, now() + make_interval(days => $5), $6) returning id, expira_em`,
    [
      dados.comunidadeId,
      dados.papel,
      dados.email,
      hmacDeToken(token, config.CONVITE_SEGREDO),
      dados.validadeDias,
      dados.criadoPor,
    ],
  )
  return { id: rows[0]!.id, token, expiraEm: rows[0]!.expira_em }
}

/** `{ icone, cor }` ou `null` (sem avatar escolhido: o app mostra as iniciais). */
export function avatarDaLinha(linha: {
  avatar_icone: string | null
  avatar_cor: string | null
}): { icone: string; cor: string } | null {
  return linha.avatar_icone && linha.avatar_cor
    ? { icone: linha.avatar_icone, cor: linha.avatar_cor }
    : null
}

export function registrarRotasDeComunidade(app: FastifyInstance, d: DependenciasComunidades): void {
  const { api } = d

  // ================================================================ a própria conta

  app.get('/api/v1/eu', { preHandler: app.exigirSessao }, async (pedido) => {
    const s = pedido.sessao!
    return emTransacao(
      api,
      { contaId: s.contaId, comunidadeId: null, prova: s.prova },
      async (c) => {
        const conta = (
          await c.query<{
            id: string
            nome: string
            email: string
            whatsapp: string | null
            criador: boolean
            dois_fatores: boolean
            avatar_icone: string | null
            avatar_cor: string | null
            foto_hash: string | null
          }>(
            `select a.id, a.nome, a.email, a.whatsapp, a.plataforma_proprietario as criador,
                  a.totp_ativado_em is not null as dois_fatores, a.avatar_icone, a.avatar_cor,
                  encode(f.hash, 'hex') as foto_hash
             from uj.contas a left join uj.fotos_contas f on f.conta_id = a.id
            where a.id = $1`,
            [s.contaId],
          )
        ).rows[0]
        const comunidades = (
          await c.query(
            `select c.id, c.nome, c.cor, c.estado, v.papel, v.designacoes,
                    l.hash is not null as "temLogo",
                    left(encode(l.hash, 'hex'), 16) as "logoVersao"
             from uj.vinculos v join uj.comunidades c on c.id = v.comunidade_id
             left join uj.logos_comunidades l on l.comunidade_id = c.id
            where v.conta_id = $1 and v.estado = 'ativo'
            order by c.nome`,
            [s.contaId],
          )
        ).rows
        if (!conta) throw NAO_ENCONTRADO()
        return {
          conta: {
            id: conta.id,
            nome: conta.nome,
            email: conta.email,
            whatsapp: conta.whatsapp,
            criador: conta.criador,
            doisFatores: conta.dois_fatores,
            avatar: avatarDaLinha(conta),
            // A foto, quando há, tem precedência sobre o avatar (D33).
            temFoto: conta.foto_hash !== null,
            fotoVersao: versaoDoHash(conta.foto_hash),
          },
          comunidades,
        }
      },
    )
  })

  /** Comunidades em carência que a própria pessoa (administradora) ainda pode desfazer (D77). */
  app.get(
    '/api/v1/eu/comunidades-em-exclusao',
    { preHandler: app.exigirSessao },
    async (pedido) => {
      const s = pedido.sessao!
      return emTransacao(
        api,
        { contaId: s.contaId, comunidadeId: null, prova: s.prova },
        async (c) => {
          const { rows } = await c.query(
            `select id, nome, exclusao_agendada_para as "apagadaEm", pedida_em as "pedidaEm"
             from uj.minhas_comunidades_em_exclusao()`,
          )
          return { comunidades: rows }
        },
      )
    },
  )

  app.patch('/api/v1/eu', { preHandler: app.exigirSessao }, async (pedido) => {
    const corpo = validar(
      z
        .object({ nome: campoNome.optional(), whatsapp: campoWhatsapp })
        .refine((o) => o.nome !== undefined || o.whatsapp !== undefined, 'Nada para alterar.'),
      pedido.body,
    )
    const s = pedido.sessao!
    await emTransacao(api, { contaId: s.contaId, comunidadeId: null }, async (c) => {
      await c.query(
        `update uj.contas set nome = coalesce($2, nome),
                whatsapp = case when $3::boolean then $4 else whatsapp end
          where id = $1`,
        [s.contaId, corpo.nome ?? null, corpo.whatsapp !== undefined, corpo.whatsapp ?? null],
      )
    })
    return { ok: true }
  })

  /**
   * Avatar: ícone e cor de listas fechadas (packages/tokens/src/avatar.ts; o
   * banco confere de novo). `null` nos dois volta ao avatar com as iniciais.
   */
  app.put('/api/v1/eu/avatar', { preHandler: app.exigirSessao }, async (pedido) => {
    const corpo = validar(
      z.union([
        z.object({
          icone: z.string().refine(ehIconeDoAvatar, 'Escolha um dos ícones da lista.'),
          cor: z.string().refine(ehCorDoAvatar, 'Escolha uma das cores da lista.'),
        }),
        z.object({ icone: z.null(), cor: z.null() }),
      ]),
      pedido.body,
    )
    const s = pedido.sessao!
    await emTransacao(api, { contaId: s.contaId, comunidadeId: null }, async (c) => {
      try {
        await c.query('update uj.contas set avatar_icone = $2, avatar_cor = $3 where id = $1', [
          s.contaId,
          corpo.icone,
          corpo.cor,
        ])
      } catch (e) {
        traduzirErroDoBanco(e)
      }
    })
    return { avatar: avatarDaLinha({ avatar_icone: corpo.icone, avatar_cor: corpo.cor }) }
  })

  app.get('/api/v1/eu/aparelhos', { preHandler: app.exigirSessao }, async (pedido) => {
    const s = pedido.sessao!
    return emTransacao(api, { contaId: s.contaId, comunidadeId: null }, async (c) => {
      const { rows } = await c.query(
        `with vivas as (
           select distinct on (familia) familia, aparelho, plataforma, criado_em, ultimo_uso_em
             from uj.sessoes
            where conta_id = $1 and revogada_em is null and substituida_em is null
              and expira_em > now()
            order by familia, criado_em desc)
         select familia as id, aparelho, plataforma, ultimo_uso_em as "ultimoUso",
                familia = (select familia from uj.sessoes where id = $2) as atual
           from vivas order by ultimo_uso_em desc`,
        [s.contaId, s.sessaoId],
      )
      return { aparelhos: rows }
    })
  })

  app.delete('/api/v1/eu/aparelhos/:familia', { preHandler: app.exigirSessao }, async (pedido) => {
    const familia = idDoCaminho(pedido, 'familia')
    const s = pedido.sessao!
    const r = await emTransacao(api, { contaId: s.contaId, comunidadeId: null }, (c) =>
      c.query(
        `update uj.sessoes set revogada_em = now(), motivo_revogacao = 'revogada_pelo_usuario'
          where familia = $1 and revogada_em is null`,
        [familia],
      ),
    )
    if (!r.rowCount) throw NAO_ENCONTRADO()
    return { ok: true }
  })

  // ================================================================ comunidade

  const naCom = { preHandler: app.comComunidade }

  app.get('/api/v1/c/:comunidadeId', naCom, async (pedido) => {
    exigir(pedido, 'comunidade', 'ler')
    return naComunidade(api, pedido, async (c) => {
      const { rows } = await c.query(
        `select c.id, c.nome, c.cor, c.fuso, c.estado,
                c.validade_offline_dias as "validadeOfflineDias",
                c.retencao_inscricoes_dias as "retencaoInscricoesDias", c.versao,
                l.hash is not null as "temLogo", left(encode(l.hash, 'hex'), 16) as "logoVersao",
                c.cidade, c.modo_entrada as "modoEntrada", c.encontravel, c.verificacao,
                c.id_publico as "idPublico",
                (select count(*)::int from uj.vinculos v
                  where v.comunidade_id = c.id and v.estado = 'ativo') as "membrosAtivos"
           from uj.comunidades c left join uj.logos_comunidades l on l.comunidade_id = c.id
          where c.id = $1`,
        [pedido.comunidade!.id],
      )
      if (!rows[0]) throw NAO_ENCONTRADO()
      // TC-16 (ADR 0007): admin promovido depois, ou versão nova do termo.
      const termo = await c.query<{ precisa: boolean }>(
        'select uj.precisa_aceitar_termo_do_admin($1) as precisa',
        [VERSAO_DO_TEXTO['TC-16']],
      )
      const { membrosAtivos, ...comunidade } = rows[0] as Record<string, unknown> & {
        membrosAtivos: number
        verificacao: string
      }
      const nova = comunidade.verificacao === 'nova'
      return {
        ...comunidade,
        // Rodinhas (ADR 0007): somem quando a comunidade é verificada.
        limites: {
          membrosAtivos: nova ? LIMITES_DA_COMUNIDADE_NOVA.vinculosAtivos : null,
          eventoPublico: !nova,
        },
        uso: { membrosAtivos },
        precisaAceitarTermoDoAdmin: termo.rows[0]?.precisa === true,
        meuPapel: pedido.comunidade!.papel,
      }
    })
  })

  app.patch('/api/v1/c/:comunidadeId', naCom, async (pedido) => {
    exigir(pedido, 'comunidade', 'configurar')
    const corpo = validar(
      z.object({
        nome: z.string().trim().min(2).max(80).optional(),
        cor: cor.optional(),
        fuso: fusoValido.optional(),
        validadeOfflineDias: z.number().int().min(3).max(30).optional(),
        retencaoInscricoesDias: z.number().int().min(30).max(365).optional(),
        // ADR 0007: como se entra, aparecer na busca e a cidade (null apaga).
        modoEntrada: z.enum(MODOS_DE_ENTRADA, { error: 'Escolha um modo de entrada.' }).optional(),
        encontravel: z.boolean().optional(),
        cidade: z
          .string()
          .trim()
          .min(2, 'Confira a cidade: tem poucos caracteres.')
          .max(80)
          .nullable()
          .optional(),
      }),
      pedido.body,
    )
    if (corpo.modoEntrada !== undefined && !modoDeEntradaHabilitado(corpo.modoEntrada)) {
      throw new ErroHttp(
        'modo_nao_habilitado',
        422,
        'Este modo de entrada ainda não está disponível. Escolha convite ou código.',
      )
    }
    // Quem passa a entrar por código ganha um código, se ainda não tinha.
    const codigo = sortearCodigo(d.config.CONVITE_SEGREDO)
    return naComunidade(api, pedido, async (c) => {
      try {
        const { rows } = await c.query<{ versao: number }>(
          `update uj.comunidades set
              nome = coalesce($2, nome), cor = coalesce($3, cor), fuso = coalesce($4, fuso),
              validade_offline_dias = coalesce($5, validade_offline_dias),
              retencao_inscricoes_dias = coalesce($6, retencao_inscricoes_dias),
              modo_entrada = coalesce($7, modo_entrada),
              encontravel = coalesce($8, encontravel),
              cidade = case when $9::boolean then $10 else cidade end,
              codigo_semente = case when coalesce($7, modo_entrada) <> 'convite'
                                    then coalesce(codigo_semente, $11) else codigo_semente end,
              codigo_hmac = case when coalesce($7, modo_entrada) <> 'convite'
                                 then coalesce(codigo_hmac, $12) else codigo_hmac end,
              codigo_gerado_em = case when coalesce($7, modo_entrada) <> 'convite'
                                      then coalesce(codigo_gerado_em, now())
                                      else codigo_gerado_em end
            where id = $1 returning versao`,
          [
            pedido.comunidade!.id,
            corpo.nome ?? null,
            corpo.cor ?? null,
            corpo.fuso ?? null,
            corpo.validadeOfflineDias ?? null,
            corpo.retencaoInscricoesDias ?? null,
            corpo.modoEntrada ?? null,
            corpo.encontravel ?? null,
            corpo.cidade !== undefined,
            corpo.cidade ?? null,
            codigo.semente,
            codigo.hmac,
          ],
        )
        if (!rows[0]) throw SEM_PERMISSAO()
        await auditar(
          c,
          pedido,
          'comunidade.configurada',
          { tipo: 'comunidade', id: pedido.comunidade!.id },
          {
            campos: Object.keys(corpo),
          },
        )
        return { versao: rows[0].versao }
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })
  })

  // ---------------------------------------------------------------- membros

  app.get('/api/v1/c/:comunidadeId/membros', naCom, async (pedido) => {
    exigir(pedido, 'vinculo', 'listar')
    return naComunidade(api, pedido, async (c) => {
      const { rows } = await c.query(
        `select vinculo_id as "vinculoId", conta_id as "contaId", nome, papel, estado, designacoes,
                email, whatsapp, eh_proprietario as "criador", desde, avatar_icone, avatar_cor,
                foto_versao
           from uj.pessoas_da_comunidade() order by nome`,
      )
      return {
        membros: rows.map(({ avatar_icone, avatar_cor, foto_versao, ...membro }) => ({
          ...membro,
          avatar: avatarDaLinha({ avatar_icone, avatar_cor }),
          // Foto em GET /c/:comunidadeId/pessoas/:vinculoId/foto (só de vínculo ativo).
          temFoto: foto_versao !== null,
          fotoVersao: foto_versao,
        })),
      }
    })
  })

  app.patch('/api/v1/c/:comunidadeId/membros/:vinculoId', naCom, async (pedido) => {
    const vinculoId = idDoCaminho(pedido, 'vinculoId')
    const corpo = validar(
      z
        .object({
          papel: papel.optional(),
          estado: z.enum(['ativo', 'desativado', 'removido']).optional(),
          equipeDeOracao: z.boolean().optional(),
        })
        .refine((o) => Object.keys(o).length > 0, 'Nada para alterar.'),
      pedido.body,
    )
    if (corpo.papel) {
      exigir(pedido, 'vinculo', 'alterar_papel')
      if (!podeConcederPapel(pedido.comunidade!.papel, corpo.papel)) throw SEM_PERMISSAO()
    }
    if (corpo.estado === 'desativado' || corpo.estado === 'ativo')
      exigir(pedido, 'vinculo', 'desativar')
    if (corpo.estado === 'removido') exigir(pedido, 'vinculo', 'remover')
    if (corpo.equipeDeOracao !== undefined) exigir(pedido, 'vinculo', 'designar_equipe_oracao')

    return naComunidade(api, pedido, async (c) => {
      try {
        const antes = (
          await c.query<{ conta_id: string; papel: string; estado: string; designacoes: string[] }>(
            'select conta_id, papel, estado, designacoes from uj.vinculos where id = $1 and comunidade_id = $2',
            [vinculoId, pedido.comunidade!.id],
          )
        ).rows[0]
        if (!antes) throw NAO_ENCONTRADO()
        if (antes.conta_id === pedido.sessao!.contaId) {
          throw new ErroHttp(
            'proprio_vinculo',
            403,
            'Para sair da comunidade, use "Sair da comunidade".',
          )
        }
        const designacoes =
          corpo.equipeDeOracao === undefined
            ? antes.designacoes
            : corpo.equipeDeOracao
              ? ['equipe_oracao']
              : []
        const { rows } = await c.query(
          `update uj.vinculos set papel = $3, estado = $4, designacoes = $5
            where id = $1 and comunidade_id = $2
            returning id, papel, estado, designacoes`,
          [
            vinculoId,
            pedido.comunidade!.id,
            corpo.papel ?? antes.papel,
            corpo.estado ?? antes.estado,
            designacoes,
          ],
        )
        if (!rows[0]) throw NAO_ENCONTRADO()
        await auditar(
          c,
          pedido,
          'vinculo.alterado',
          { tipo: 'vinculo', id: vinculoId },
          {
            antes: {
              papel: antes.papel,
              estado: antes.estado,
              equipeDeOracao: antes.designacoes.length > 0,
            },
            depois: {
              papel: rows[0].papel,
              estado: rows[0].estado,
              equipeDeOracao: designacoes.length > 0,
            },
          },
        )
        return rows[0]
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })
  })

  app.post('/api/v1/c/:comunidadeId/sair', naCom, async (pedido) => {
    exigir(pedido, 'vinculo', 'sair', { proprio: true })
    return naComunidade(api, pedido, async (c) => {
      try {
        const r = await c.query(
          `update uj.vinculos set estado = 'removido'
            where conta_id = $1 and comunidade_id = $2 and estado = 'ativo' returning id`,
          [pedido.sessao!.contaId, pedido.comunidade!.id],
        )
        if (!r.rowCount) throw NAO_ENCONTRADO()
        // Art. 16 (exclusao-de-conta.md, caso 2): oração, disponibilidade e escalas
        // futuras saem, e o histórico daqui passa a ser de "Pessoa removida".
        await c.query('select uj.efeitos_da_saida()')
        await auditar(c, pedido, 'vinculo.saiu', { tipo: 'vinculo', id: r.rows[0].id as string })
        return { ok: true }
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })
  })

  // ---------------------------------------------------------------- excluir a comunidade (D77, ADR 0009)

  /**
   * A administração pede a exclusão da PRÓPRIA comunidade. Não apaga na hora: a comunidade
   * vai para `exclusao_agendada` (some das listas e não aceita acessos) e fica 30 dias
   * assim; a rotina diária de retenção apaga de vez. O nome vem da tela (a pessoa viu
   * o nome escrito antes de confirmar): se a comunidade foi renomeada nesse meio tempo,
   * a confirmação não vale. As contas das pessoas continuam; só o vínculo e os dados
   * da comunidade saem. O banco (função `agendar_exclusao_da_comunidade`) confere o
   * papel de novo e é o único caminho para o administrador mudar o estado.
   */
  app.post('/api/v1/c/:comunidadeId/excluir', naCom, async (pedido) => {
    exigir(pedido, 'comunidade', 'excluir')
    const corpo = validar(
      z.object({
        nome: z.string().trim().min(1, 'Confirme o nome da comunidade.').max(80),
        confirmo: z.literal(true, { error: 'Confirme que quer excluir a comunidade.' }),
      }),
      pedido.body,
    )
    return naComunidade(api, pedido, async (c) => {
      try {
        const atual = (
          await c.query<{ nome: string }>('select nome from uj.comunidades where id = $1', [
            pedido.comunidade!.id,
          ])
        ).rows[0]
        if (!atual) throw NAO_ENCONTRADO()
        if (corpo.nome !== atual.nome) {
          throw new ErroHttp(
            'confirmacao_necessaria',
            422,
            'O nome não confere com o da comunidade. Volte e confira antes de excluir.',
          )
        }
        // Antes da função: depois dela a comunidade deixa de ser contexto e a auditoria não entra.
        await auditar(c, pedido, 'comunidade.exclusao_agendada', {
          tipo: 'comunidade',
          id: pedido.comunidade!.id,
        })
        const r = await c.query<{ fim: Date | null }>(
          'select uj.agendar_exclusao_da_comunidade() as fim',
        )
        const fim = r.rows[0]?.fim
        if (!fim) throw NAO_ENCONTRADO()
        return { ok: true, estado: 'exclusao_agendada', apagadaEm: fim }
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })
  })

  /**
   * Desfaz a exclusão dentro da carência. Não usa `comComunidade`: a comunidade em exclusão
   * não é mais contexto de ninguém. Quem responde é a função do banco, que só aceita a
   * administradora ativa e só o pedido que a própria administração fez; qualquer outro
   * caso (outra comunidade, outro papel, prazo vencido) é 404, sem dizer que ela existe.
   */
  app.post(
    '/api/v1/c/:comunidadeId/exclusao/desfazer',
    { preHandler: app.exigirSessao },
    async (pedido) => {
      const comunidadeId = idDoCaminho(pedido, 'comunidadeId')
      const s = pedido.sessao!
      return emTransacao(api, { contaId: s.contaId, comunidadeId, prova: s.prova }, async (c) => {
        const r = await c.query<{ ok: boolean }>(
          'select uj.desfazer_exclusao_da_comunidade($1) as ok',
          [comunidadeId],
        )
        if (!r.rows[0]?.ok) throw NAO_ENCONTRADO()
        await auditar(
          c,
          pedido,
          'comunidade.exclusao_desfeita',
          { tipo: 'comunidade', id: comunidadeId },
          {},
          comunidadeId,
        )
        return { ok: true, estado: 'ativa' }
      })
    },
  )

  // ---------------------------------------------------------------- convites

  app.get('/api/v1/c/:comunidadeId/convites', naCom, async (pedido) => {
    exigir(pedido, 'convite', 'listar')
    return naComunidade(api, pedido, async (c) => {
      const { rows } = await c.query(
        `select id, papel, email_destino as "emailDestino", criado_em as "criadoEm",
                expira_em as "expiraEm", criado_por as "criadoPor",
                case when revogado_em is not null then 'revogado'
                     when usos >= usos_maximos then 'usado'
                     when expira_em <= now() then 'expirado'
                     else 'valido' end as situacao
           from uj.convites where comunidade_id = $1 order by criado_em desc limit 200`,
        [pedido.comunidade!.id],
      )
      return { convites: rows }
    })
  })

  app.post('/api/v1/c/:comunidadeId/convites', naCom, async (pedido) => {
    exigir(pedido, 'convite', 'criar')
    const corpo = validar(
      z.object({
        papel,
        email: campoEmail.nullish(),
        validadeDias: z.number().int().min(1).max(VALIDADE_MAXIMA_CONVITE_DIAS).default(7),
        enviarPorEmail: z.boolean().default(false),
      }),
      pedido.body,
    )
    if (!podeConcederPapel(pedido.comunidade!.papel, corpo.papel)) throw SEM_PERMISSAO()
    const emailDestino = corpo.email ? corpo.email.trim().toLowerCase() : null
    const convite = await naComunidade(api, pedido, async (c) => {
      try {
        const novo = await criarConvite(c, d.config, {
          comunidadeId: pedido.comunidade!.id,
          papel: corpo.papel,
          email: emailDestino,
          validadeDias: corpo.validadeDias,
          criadoPor: pedido.sessao!.contaId,
        })
        await auditar(
          c,
          pedido,
          'convite.criado',
          { tipo: 'convite', id: novo.id },
          {
            papel: corpo.papel,
            dirigido: emailDestino !== null,
          },
        )
        return novo
      } catch (e) {
        traduzirErroDoBanco(e)
      }
    })
    const link = linkDoConvite(d.config, convite.token)
    if (emailDestino && corpo.enviarPorEmail) {
      d.emSegundoPlano(
        d.correio.enviar({
          para: emailDestino,
          assunto: `Você foi convidado para o ${NOME_DO_APP}`,
          corpo: [
            'Olá!',
            '',
            `Você recebeu um convite para participar de uma comunidade no ${NOME_DO_APP}.`,
            `Abra o link para aceitar (vale até ${convite.expiraEm.toLocaleDateString('pt-BR')}):`,
            link,
            '',
            'Se você não esperava este convite, pode ignorar esta mensagem.',
          ].join('\n'),
          chaveDeIdempotencia: convite.id,
        }),
      )
    }
    return { id: convite.id, link, expiraEm: convite.expiraEm }
  })

  app.post('/api/v1/c/:comunidadeId/convites/:conviteId/revogar', naCom, async (pedido) => {
    exigir(pedido, 'convite', 'revogar')
    const conviteId = idDoCaminho(pedido, 'conviteId')
    return naComunidade(api, pedido, async (c) => {
      const r = await c.query(
        `update uj.convites set revogado_em = now()
          where id = $1 and comunidade_id = $2 and revogado_em is null returning id`,
        [conviteId, pedido.comunidade!.id],
      )
      if (!r.rowCount) throw NAO_ENCONTRADO()
      await auditar(c, pedido, 'convite.revogado', { tipo: 'convite', id: conviteId })
      return { ok: true }
    })
  })

  // ---------------------------------------------------------------- auditoria

  app.get('/api/v1/c/:comunidadeId/auditoria', naCom, async (pedido) => {
    exigir(pedido, 'auditoria', 'ler')
    const q = validar(
      z.object({
        antes: z.coerce.number().int().positive().optional(),
        limite: z.coerce.number().int().min(1).max(100).default(50),
      }),
      pedido.query,
    )
    return naComunidade(api, pedido, async (c) => {
      const { rows } = await c.query(
        `select id, momento, conta_id as "contaId", acao, recurso_tipo as "recursoTipo",
                recurso_id as "recursoId", detalhes
           from uj.auditoria
          where comunidade_id = $1 and ($2::bigint is null or id < $2)
          order by id desc limit $3`,
        [pedido.comunidade!.id, q.antes ?? null, q.limite],
      )
      return { registros: rows }
    })
  })
}
