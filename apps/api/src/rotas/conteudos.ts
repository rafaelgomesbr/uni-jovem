import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { nomeDoTom } from '@uj/dominio'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Conteúdos da comunidade (F15): músicas (com quem toca), músicos,
 * palestrantes e dinâmicas. Membro lê; organizador para cima cadastra, edita
 * e exclui. Cada tipo tem rotas próprias (literais), geradas da tabela abaixo:
 * as colunas vêm de listas fixas, nunca do pedido.
 */

const texto = (max: number) => z.string().trim().max(max)
const link = z
  .string()
  .trim()
  .max(2000)
  .regex(/^https:\/\/\S+$/, 'Use um link que comece com https://.')

/** Tom no formato do app (G, Am, F#m, Bb); vazio apaga. Aceita ♯ e ♭ e devolve ASCII. */
const tom = z
  .string()
  .trim()
  .max(12)
  .refine((v) => v === '' || nomeDoTom(v) !== null, 'Use um tom como G, Am ou F#m.')
  .transform((v) => (v === '' ? null : nomeDoTom(v)))

const MENSAGEM_DE_DIREITOS =
  'Confirme que a sua comunidade pode usar esta letra e esta cifra antes de salvar.'

interface TipoDeConteudo {
  caminho: string
  tabela: string
  parametro: string
  /** campo da API → coluna */
  colunas: Record<string, string>
  /** Colunas longas que não vão na lista (só no detalhe). */
  soNoDetalhe: string[]
  /** Colunas calculadas que entram na lista e no detalhe (sem o texto longo). */
  calculadas?: string[]
  /** Campos só de edição (arquivar, desativar). */
  soNaEdicao: Record<string, z.ZodType>
  criar: z.ZodObject
  ordem: string
}

const TIPOS: TipoDeConteudo[] = [
  {
    caminho: 'musicas',
    tabela: 'musicas',
    parametro: 'musicaId',
    colunas: {
      titulo: 'titulo',
      artista: 'artista',
      tom: 'tom',
      link: 'link',
      cifra: 'cifra',
      andamentoBpm: 'andamento_bpm',
      duracaoSeg: 'duracao_seg',
      observacoes: 'observacoes',
      arquivada: 'arquivada',
    },
    soNoDetalhe: ['cifra'],
    // A lista mostra o selo "Sem cifra" sem trazer o texto da cifra.
    calculadas: [`(cifra is not null and btrim(cifra) <> '') as "temCifra"`],
    soNaEdicao: { arquivada: z.boolean().optional() },
    criar: z.object({
      titulo: z.string().trim().min(1, 'Informe o título da música.').max(120),
      artista: texto(120).nullish(),
      tom: tom.nullish(),
      link: link.nullish(),
      cifra: texto(20000).nullish(),
      andamentoBpm: z.number().int().min(30).max(300).nullish(),
      duracaoSeg: z.number().int().min(10).max(3600).nullish(),
      observacoes: texto(2000).nullish(),
      // Confirmação do aviso de direitos: pedida quando a cifra é nova ou mudou. Não é coluna.
      direitosConfirmados: z.boolean().optional(),
    }),
    ordem: 'arquivada, titulo',
  },
  {
    caminho: 'musicos',
    tabela: 'musicos',
    parametro: 'musicoId',
    colunas: {
      nome: 'nome',
      instrumentos: 'instrumentos',
      vinculoId: 'vinculo_id',
      observacoes: 'observacoes',
      ativo: 'ativo',
    },
    soNoDetalhe: [],
    soNaEdicao: { ativo: z.boolean().optional() },
    criar: z.object({
      nome: z.string().trim().min(2, 'Informe o nome.').max(120),
      instrumentos: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
      vinculoId: z.uuid().nullish(),
      observacoes: texto(2000).nullish(),
    }),
    ordem: 'ativo desc, nome',
  },
  {
    caminho: 'palestrantes',
    tabela: 'palestrantes',
    parametro: 'palestranteId',
    colunas: {
      nome: 'nome',
      temas: 'temas',
      origem: 'origem',
      vinculoId: 'vinculo_id',
      observacoes: 'observacoes',
      ativo: 'ativo',
    },
    soNoDetalhe: [],
    soNaEdicao: { ativo: z.boolean().optional() },
    criar: z.object({
      nome: z.string().trim().min(2, 'Informe o nome.').max(120),
      temas: texto(500).nullish(),
      origem: texto(120).nullish(),
      vinculoId: z.uuid().nullish(),
      observacoes: texto(2000).nullish(),
    }),
    ordem: 'ativo desc, nome',
  },
  {
    caminho: 'dinamicas',
    tabela: 'dinamicas',
    parametro: 'dinamicaId',
    colunas: {
      titulo: 'titulo',
      objetivo: 'objetivo',
      instrucoes: 'instrucoes',
      duracaoMin: 'duracao_min',
      materiais: 'materiais',
      arquivada: 'arquivada',
    },
    soNoDetalhe: ['instrucoes'],
    soNaEdicao: { arquivada: z.boolean().optional() },
    criar: z.object({
      titulo: z.string().trim().min(2, 'Dê um título à dinâmica.').max(120),
      objetivo: texto(500).nullish(),
      instrucoes: texto(10000).nullish(),
      duracaoMin: z.number().int().min(1).max(600).nullish(),
      materiais: texto(2000).nullish(),
    }),
    ordem: 'arquivada, titulo',
  },
]

const temTexto = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

const direitosNaoConfirmados = () =>
  new ErroHttp('direitos_nao_confirmados', 400, MENSAGEM_DE_DIREITOS)

function selecao(t: TipoDeConteudo, detalhe: boolean): string {
  const campos = Object.entries(t.colunas)
    .filter(([, coluna]) => detalhe || !t.soNoDetalhe.includes(coluna))
    .map(([campo, coluna]) => `${coluna} as "${campo}"`)
  return [
    'id',
    ...campos,
    ...(t.calculadas ?? []),
    'versao',
    'criado_em as "criadoEm"',
    'atualizado_em as "atualizadoEm"',
  ].join(', ')
}

function conflito(atual: unknown): ErroHttp & { atual?: unknown } {
  const e = new ErroHttp(
    'conflito',
    409,
    'Outra pessoa alterou isto enquanto você editava. Confira a versão atual antes de salvar de novo.',
  ) as ErroHttp & { atual?: unknown }
  e.atual = atual
  return e
}

export function registrarRotasDeConteudos(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const raiz = '/api/v1/c/:comunidadeId/conteudos'
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })

  /** Quem toca cada música (para a lista e o detalhe de músicas). */
  async function musicosDas(c: pg.PoolClient, musicaIds: string[]) {
    if (musicaIds.length === 0) return new Map<string, { id: string; nome: string }[]>()
    const { rows } = await c.query<{ musicaId: string; id: string; nome: string }>(
      `select mm.musica_id as "musicaId", m.id, m.nome
         from uj.musica_musicos mm join uj.musicos m on m.id = mm.musico_id
        where mm.musica_id = any ($1::uuid[]) order by m.nome`,
      [musicaIds],
    )
    const mapa = new Map<string, { id: string; nome: string }[]>()
    for (const r of rows) {
      const lista = mapa.get(r.musicaId) ?? []
      lista.push({ id: r.id, nome: r.nome })
      mapa.set(r.musicaId, lista)
    }
    return mapa
  }

  for (const t of TIPOS) {
    const base = `${raiz}/${t.caminho}`
    const doItem = `${base}/:${t.parametro}`
    const ehMusica = t.tabela === 'musicas'

    app.get(base, naCom, async (pedido) => {
      exigir(pedido, 'conteudo', 'ler')
      return tx(pedido, async (c) => {
        const { rows } = await c.query<{ id: string }>(
          `select ${selecao(t, false)} from uj.${t.tabela}
            where comunidade_id = $1 order by ${t.ordem} limit 1000`,
          [pedido.comunidade!.id],
        )
        if (!ehMusica) return { itens: rows }
        const mapa = await musicosDas(
          c,
          rows.map((r) => r.id),
        )
        return { itens: rows.map((r) => ({ ...r, musicos: mapa.get(r.id) ?? [] })) }
      })
    })

    app.post(base, naCom, async (pedido) => {
      exigir(pedido, 'conteudo', 'gerenciar')
      const dados = validar(t.criar, pedido.body) as Record<string, unknown>
      const campos = Object.keys(dados).filter((k) => t.colunas[k] !== undefined)
      // Cifra nova: o aviso de direitos autorais precisa ter sido confirmado (e fica registrado).
      const comCifra = ehMusica && temTexto(dados['cifra'])
      if (comCifra && dados['direitosConfirmados'] !== true) throw direitosNaoConfirmados()
      return tx(pedido, async (c) => {
        const colunas = campos.map((k) => t.colunas[k]!)
        const valores = campos.map((_, i) => `$${i + 2}`)
        if (comCifra) {
          colunas.push('direito_confirmado_em')
          valores.push('now()')
        }
        const { rows } = await c.query<{ id: string; versao: number }>(
          `insert into uj.${t.tabela} (comunidade_id, ${colunas.join(', ')})
           values ($1, ${valores.join(', ')}) returning id, versao`,
          [pedido.comunidade!.id, ...campos.map((k) => dados[k] ?? null)],
        )
        await auditar(c, pedido, 'conteudo.criado', { tipo: t.tabela, id: rows[0]!.id })
        return rows[0]
      })
    })

    app.get(doItem, naCom, async (pedido) => {
      exigir(pedido, 'conteudo', 'ler')
      const id = idDoCaminho(pedido, t.parametro)
      return tx(pedido, async (c) => {
        const { rows } = await c.query<{ id: string }>(
          `select ${selecao(t, true)} from uj.${t.tabela} where id = $1 and comunidade_id = $2`,
          [id, pedido.comunidade!.id],
        )
        if (!rows[0]) throw NAO_ENCONTRADO()
        if (!ehMusica) return rows[0]
        return { ...rows[0], musicos: (await musicosDas(c, [id])).get(id) ?? [] }
      })
    })

    const editar = t.criar.partial().extend({
      ...t.soNaEdicao,
      versao: z.number().int().min(1),
    })
    app.patch(doItem, naCom, async (pedido) => {
      exigir(pedido, 'conteudo', 'gerenciar')
      const id = idDoCaminho(pedido, t.parametro)
      const dados = validar(editar, pedido.body) as Record<string, unknown>
      const campos = Object.keys(dados).filter(
        (k) => t.colunas[k] !== undefined && dados[k] !== undefined,
      )
      const versao = dados['versao'] as number
      return tx(pedido, async (c) => {
        const atual = (
          await c.query<{ versao: number; cifra?: string | null }>(
            `select versao${ehMusica ? ', cifra' : ''} from uj.${t.tabela}
              where id = $1 and comunidade_id = $2`,
            [id, pedido.comunidade!.id],
          )
        ).rows[0]
        if (!atual) throw NAO_ENCONTRADO()
        if (atual.versao !== versao) throw conflito({ versao: atual.versao })
        if (campos.length === 0) return { id, versao }
        // Só a cifra que mudou pede a confirmação de direitos de novo.
        const cifraMudou =
          ehMusica && temTexto(dados['cifra']) && dados['cifra'] !== (atual.cifra ?? null)
        if (cifraMudou && dados['direitosConfirmados'] !== true) throw direitosNaoConfirmados()
        const atribuicoes = [
          ...campos.map((k, i) => `${t.colunas[k]} = $${i + 4}`),
          ...(cifraMudou ? ['direito_confirmado_em = now()'] : []),
        ]
        const { rows } = await c.query(
          `update uj.${t.tabela}
              set ${atribuicoes.join(', ')}
            where id = $1 and comunidade_id = $2 and versao = $3 returning id, versao`,
          [id, pedido.comunidade!.id, versao, ...campos.map((k) => dados[k] ?? null)],
        )
        if (!rows[0]) throw conflito({ versao: atual.versao })
        await auditar(c, pedido, 'conteudo.editado', { tipo: t.tabela, id }, { campos })
        return rows[0]
      })
    })

    app.delete(doItem, naCom, async (pedido) => {
      exigir(pedido, 'conteudo', 'gerenciar')
      const id = idDoCaminho(pedido, t.parametro)
      return tx(pedido, async (c) => {
        const r = await c.query(`delete from uj.${t.tabela} where id = $1 and comunidade_id = $2`, [
          id,
          pedido.comunidade!.id,
        ])
        if (!r.rowCount) throw NAO_ENCONTRADO()
        await auditar(c, pedido, 'conteudo.excluido', { tipo: t.tabela, id })
        return { ok: true }
      })
    })
  }

  /** Define quem toca a música (substitui a lista inteira). */
  app.put(`${raiz}/musicas/:musicaId/musicos`, naCom, async (pedido) => {
    exigir(pedido, 'conteudo', 'gerenciar')
    const musicaId = idDoCaminho(pedido, 'musicaId')
    const { musicoIds } = validar(z.object({ musicoIds: z.array(z.uuid()).max(30) }), pedido.body)
    const unicos = [...new Set(musicoIds)]
    return tx(pedido, async (c) => {
      const existe = await c.query(
        'select 1 from uj.musicas where id = $1 and comunidade_id = $2',
        [musicaId, pedido.comunidade!.id],
      )
      if (!existe.rowCount) throw NAO_ENCONTRADO()
      await c.query(
        `delete from uj.musica_musicos
          where musica_id = $1 and comunidade_id = $2 and not (musico_id = any ($3::uuid[]))`,
        [musicaId, pedido.comunidade!.id, unicos],
      )
      for (const musicoId of unicos) {
        await c.query(
          `insert into uj.musica_musicos (comunidade_id, musica_id, musico_id) values ($1, $2, $3)
           on conflict (musica_id, musico_id) do nothing`,
          [pedido.comunidade!.id, musicaId, musicoId],
        )
      }
      await auditar(c, pedido, 'conteudo.musicos_definidos', { tipo: 'musicas', id: musicaId })
      return { musicos: (await musicosDas(c, [musicaId])).get(musicaId) ?? [] }
    })
  })
}
