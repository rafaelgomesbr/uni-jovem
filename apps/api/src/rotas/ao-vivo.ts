import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import {
  aplicarComando,
  atrasoEmMinutos,
  calcularHorarios,
  CONCESSAO_DE_CONDUCAO_S,
  type ComandoAoVivo,
  type EstadoAoVivo,
} from '@uj/dominio'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Acompanhamento ao vivo (F11). Atualização quase em tempo real por LONG
 * POLLING (D20): `GET ...?depoisDaVersao=N` segura a resposta até 25 s ou até
 * a versão mudar. Um condutor por vez; comando com versão antiga recebe 409
 * com o estado atual.
 */

export const ESPERA_MAXIMA_MS = 25_000
const INTERVALO_DE_CONSULTA_MS = 500

interface Linha {
  situacao: EstadoAoVivo['situacao']
  etapa_atual_id: string | null
  etapa_iniciada_em: Date | null
  iniciado_em: Date | null
  pausado_em: Date | null
  encerrado_em: Date | null
  condutor_vinculo_id: string | null
  condutor_ate: Date | null
  versao: number
}

const iso = (d: Date | null) => (d ? d.toISOString() : null)

function paraEstado(l: Linha | undefined): EstadoAoVivo & { versao: number } {
  return {
    situacao: l?.situacao ?? 'nao_iniciado',
    etapaAtualId: l?.etapa_atual_id ?? null,
    etapaIniciadaEm: iso(l?.etapa_iniciada_em ?? null),
    iniciadoEm: iso(l?.iniciado_em ?? null),
    pausadoEm: iso(l?.pausado_em ?? null),
    encerradoEm: iso(l?.encerrado_em ?? null),
    versao: l?.versao ?? 0,
  }
}

async function montarRetrato(c: pg.PoolClient, comunidadeId: string, eventoId: string) {
  const evento = (
    await c.query<{ inicio: Date; titulo: string; status: string }>(
      'select inicio, titulo, status from uj.eventos where id = $1 and comunidade_id = $2',
      [eventoId, comunidadeId],
    )
  ).rows[0]
  if (!evento) throw NAO_ENCONTRADO()
  const etapas = (
    await c.query<{ id: string; titulo: string; duracaoMin: number }>(
      'select id, titulo, duracao_min as "duracaoMin" from uj.etapas where evento_id = $1 order by ordem',
      [eventoId],
    )
  ).rows
  const linha = (
    await c.query<Linha>('select * from uj.andamentos where evento_id = $1', [eventoId])
  ).rows[0]
  const estado = paraEstado(linha)
  const horarios = calcularHorarios(evento.inicio, etapas)
  // Início real de cada etapa: a última vez que ela virou a atual.
  const reais = new Map<string, string>()
  for (const r of (
    await c.query<{ etapa_id: string; ocorrido_em: Date }>(
      `select etapa_id, ocorrido_em from uj.andamento_comandos
        where evento_id = $1 and etapa_id is not null and comando in ('iniciar', 'avancar', 'voltar', 'ir_para')
        order by id`,
      [eventoId],
    )
  ).rows) {
    reais.set(r.etapa_id, r.ocorrido_em.toISOString())
  }
  const indiceAtual = etapas.findIndex((e) => e.id === estado.etapaAtualId)
  const eu = (await c.query<{ v: string | null }>('select uj.vinculo_da_conta_no_contexto() as v'))
    .rows[0]?.v
  const condutorValido =
    linha?.condutor_vinculo_id && linha.condutor_ate && linha.condutor_ate > new Date()
      ? linha.condutor_vinculo_id
      : null
  let condutorNome: string | null = null
  if (condutorValido) {
    condutorNome =
      (
        await c.query<{ nome: string }>(
          'select nome from uj.pessoas_da_comunidade() where vinculo_id = $1',
          [condutorValido],
        )
      ).rows[0]?.nome ?? null
  }
  return {
    evento: { id: eventoId, titulo: evento.titulo, status: evento.status, inicio: evento.inicio },
    ...estado,
    condutor: condutorValido
      ? { vinculoId: condutorValido, nome: condutorNome, ate: linha!.condutor_ate }
      : null,
    souCondutor: condutorValido !== null && condutorValido === eu,
    atrasoMin: atrasoEmMinutos(estado, indiceAtual >= 0 ? horarios[indiceAtual]!.inicio : null),
    etapas: etapas.map((e, i) => ({
      ...e,
      inicioPrevisto: horarios[i]!.inicio,
      fimPrevisto: horarios[i]!.fim,
      inicioReal: reais.get(e.id) ?? null,
      situacao:
        i < indiceAtual || estado.situacao === 'encerrado'
          ? 'concluida'
          : i === indiceAtual
            ? 'atual'
            : 'proxima',
    })),
    agora: new Date().toISOString(),
  }
}

const comando = z.discriminatedUnion('comando', [
  z.object({
    comando: z.literal('assumir'),
    versao: z.number().int().min(0),
    forcar: z.boolean().default(false),
  }),
  z.object({ comando: z.literal('liberar'), versao: z.number().int().min(0) }),
  z.object({ comando: z.literal('iniciar'), versao: z.number().int().min(0) }),
  z.object({ comando: z.literal('avancar'), versao: z.number().int().min(0) }),
  z.object({ comando: z.literal('voltar'), versao: z.number().int().min(0) }),
  z.object({ comando: z.literal('ir_para'), versao: z.number().int().min(0), etapaId: z.uuid() }),
  z.object({ comando: z.literal('pausar'), versao: z.number().int().min(0) }),
  z.object({ comando: z.literal('retomar'), versao: z.number().int().min(0) }),
  z.object({ comando: z.literal('encerrar'), versao: z.number().int().min(0) }),
])

export function registrarRotasAoVivo(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const url = '/api/v1/c/:comunidadeId/eventos/:eventoId/ao-vivo'

  const ler = (pedido: FastifyRequest, eventoId: string) =>
    naComunidade(api, pedido, (c) => montarRetrato(c, pedido.comunidade!.id, eventoId))

  app.get(url, naCom, async (pedido) => {
    exigir(pedido, 'ao_vivo', 'acompanhar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const q = validar(
      z.object({ depoisDaVersao: z.coerce.number().int().min(0).optional() }),
      pedido.query,
    )
    let retrato = await ler(pedido, eventoId)
    if (q.depoisDaVersao === undefined) return retrato
    const limite = Date.now() + ESPERA_MAXIMA_MS
    while (retrato.versao <= q.depoisDaVersao && Date.now() < limite && !pedido.raw.destroyed) {
      await new Promise((r) => setTimeout(r, INTERVALO_DE_CONSULTA_MS))
      retrato = await ler(pedido, eventoId)
    }
    return retrato
  })

  app.post(url, naCom, async (pedido) => {
    exigir(pedido, 'ao_vivo', 'conduzir')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const cmd = validar(comando, pedido.body)
    return naComunidade(api, pedido, async (c) => {
      try {
        const comunidadeId = pedido.comunidade!.id
        const evento = (
          await c.query<{ status: string }>(
            'select status from uj.eventos where id = $1 and comunidade_id = $2',
            [eventoId, comunidadeId],
          )
        ).rows[0]
        if (!evento) throw NAO_ENCONTRADO()
        if (evento.status !== 'publicado') {
          throw new ErroHttp(
            'evento_nao_publicado',
            409,
            'Só eventos publicados podem ser conduzidos ao vivo.',
          )
        }
        await c.query(
          'insert into uj.andamentos (evento_id, comunidade_id) values ($1, $2) on conflict (evento_id) do nothing',
          [eventoId, comunidadeId],
        )
        const linha = (
          await c.query<Linha>('select * from uj.andamentos where evento_id = $1 for update', [
            eventoId,
          ])
        ).rows[0]!
        const eu = (await c.query<{ v: string }>('select uj.vinculo_da_conta_no_contexto() as v'))
          .rows[0]!.v
        const conflito = async (mensagem: string, codigo = 'conflito') => {
          const e = new ErroHttp(codigo, 409, mensagem) as ErroHttp & { atual?: unknown }
          e.atual = await montarRetrato(c, comunidadeId, eventoId)
          return e
        }
        if (cmd.versao !== linha.versao) {
          throw await conflito(
            'O andamento mudou desde a sua última atualização. Confira o estado atual.',
          )
        }
        const agora = new Date()
        const conducaoAtiva =
          linha.condutor_vinculo_id && linha.condutor_ate && linha.condutor_ate > agora
        const outroConduz = conducaoAtiva && linha.condutor_vinculo_id !== eu

        let condutor = linha.condutor_vinculo_id
        let novo: EstadoAoVivo = paraEstado(linha)
        if (cmd.comando === 'assumir') {
          if (outroConduz && !cmd.forcar) {
            throw await conflito(
              'Outra pessoa está conduzindo agora. Para assumir, confirme.',
              'conduzido_por_outra_pessoa',
            )
          }
          condutor = eu
        } else if (cmd.comando === 'liberar') {
          if (linha.condutor_vinculo_id !== eu)
            throw await conflito('Você não está conduzindo este evento.')
          condutor = null
        } else {
          if (outroConduz) {
            throw await conflito(
              'Outra pessoa está conduzindo agora. Assuma a condução para mudar o andamento.',
              'conduzido_por_outra_pessoa',
            )
          }
          condutor = eu // quem comanda passa a conduzir (ou renova a concessão)
          const etapas = (
            await c.query<{ id: string }>(
              'select id from uj.etapas where evento_id = $1 order by ordem',
              [eventoId],
            )
          ).rows.map((e) => e.id)
          const r = aplicarComando(
            novo,
            (cmd.comando === 'ir_para'
              ? { tipo: 'ir_para', etapaId: cmd.etapaId }
              : { tipo: cmd.comando }) as ComandoAoVivo,
            etapas,
            agora,
          )
          if (!r.ok) throw new ErroHttp('comando_invalido', 409, r.motivo)
          novo = r.estado
        }
        const versao = linha.versao + 1
        await c.query(
          `update uj.andamentos set situacao = $2, etapa_atual_id = $3, etapa_iniciada_em = $4,
                  iniciado_em = $5, pausado_em = $6, encerrado_em = $7, condutor_vinculo_id = $8,
                  condutor_ate = case when $8::uuid is null then null else now() + make_interval(secs => $9) end,
                  versao = $10
            where evento_id = $1`,
          [
            eventoId,
            novo.situacao,
            novo.etapaAtualId,
            novo.etapaIniciadaEm,
            novo.iniciadoEm,
            novo.pausadoEm,
            novo.encerradoEm,
            condutor,
            CONCESSAO_DE_CONDUCAO_S,
            versao,
          ],
        )
        await c.query(
          `insert into uj.andamento_comandos (comunidade_id, evento_id, comando, etapa_id, vinculo_id, ocorrido_em, versao_resultante)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [comunidadeId, eventoId, cmd.comando, novo.etapaAtualId, eu, agora, versao],
        )
        if (cmd.comando === 'assumir' && outroConduz) {
          await auditar(
            c,
            pedido,
            'ao_vivo.conducao_assumida',
            { tipo: 'evento', id: eventoId },
            {
              de: linha.condutor_vinculo_id,
            },
          )
        }
        return montarRetrato(c, comunidadeId, eventoId)
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })
  })
}
