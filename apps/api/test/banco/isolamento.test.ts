import type { InjectOptions } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gerarToken, hmacDeToken } from '../../src/autenticacao/cripto.ts'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { emBase64, imagem } from '../apoio/imagens.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * SUÍTE DE ISOLAMENTO ENTRE COMUNIDADES (ADR 0002, item 6).
 *
 * Gerada do inventário de rotas do servidor: toda rota de comunidade precisa
 * ter um caso em CASOS, ou o teste "inventário" reprova. Para cada rota, a
 * administradora da comunidade A tenta:
 *   1. a rota com o id da comunidade B no caminho;
 *   2. a rota com o id de A no caminho e o id de um recurso de B;
 * e o esperado é 404 sempre, com os dados de B intactos no fim.
 */

const config = carregarConfig(envDeTeste())

/** Token verdadeiro da exportação de B: nem com ele A baixa o arquivo. */
const TOKEN_DE_B = 'token-da-exportacao-de-b-com-entropia-suficiente'

/** Imagem válida (PNG 8 × 8) para as rotas de envio de imagem. */
const PNG_PEQUENO =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWOI9r6NFTEMLQkAe/NgQcEglMgAAAAASUVORK5CYII='

/** Corpo válido por rota, para que a validação não responda antes da checagem de acesso. */
const CASOS: Record<string, Record<string, unknown> | undefined> = {
  'GET /api/v1/c/:comunidadeId': undefined,
  'PATCH /api/v1/c/:comunidadeId': { nome: 'Tomada' },
  'GET /api/v1/c/:comunidadeId/membros': undefined,
  'PATCH /api/v1/c/:comunidadeId/membros/:vinculoId': { papel: 'membro' },
  'POST /api/v1/c/:comunidadeId/sair': undefined,
  'GET /api/v1/c/:comunidadeId/convites': undefined,
  'POST /api/v1/c/:comunidadeId/convites': { papel: 'admin' },
  'POST /api/v1/c/:comunidadeId/convites/:conviteId/revogar': undefined,
  'GET /api/v1/c/:comunidadeId/auditoria': undefined,
  // F7: eventos e programação
  'GET /api/v1/c/:comunidadeId/locais': undefined,
  'POST /api/v1/c/:comunidadeId/locais': { nome: 'Salão', tipo: 'interno' },
  'PATCH /api/v1/c/:comunidadeId/locais/:localId': { nome: 'Tomado' },
  'GET /api/v1/c/:comunidadeId/modelos': undefined,
  'POST /api/v1/c/:comunidadeId/modelos': { nome: 'Modelo', categoria: 'Outra', etapas: [] },
  'DELETE /api/v1/c/:comunidadeId/modelos/:modeloId': undefined,
  'GET /api/v1/c/:comunidadeId/eventos': undefined,
  'POST /api/v1/c/:comunidadeId/eventos': {
    titulo: 'Invasão',
    categoria: 'Outra',
    inicio: '2026-12-01T10:00:00-03:00',
    duracaoMin: 30,
  },
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId': undefined,
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId': { versao: 1, titulo: 'Tomado' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/status': { status: 'publicado' },
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/duplicar': {
    inicio: '2026-12-01T10:00:00-03:00',
  },
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/etapas': { titulo: 'Etapa', duracaoMin: 5 },
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId/etapas/:etapaId': { titulo: 'Tomada' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/etapas/:etapaId': undefined,
  'PUT /api/v1/c/:comunidadeId/eventos/:eventoId/etapas/ordem': {
    ids: ['00000000-0000-4000-8000-000000000000'],
  },
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/atribuicoes': {
    vinculoId: '00000000-0000-4000-8000-000000000000',
  },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/atribuicoes/:atribuicaoId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/tarefas': { titulo: 'Tarefa' },
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId/tarefas/:tarefaId': { titulo: 'Tomada' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/tarefas/:tarefaId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/materiais': { nome: 'Material' },
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId/materiais/:materialId': { nome: 'Tomado' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/materiais/:materialId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/checklist': { tipo: 'preparacao', texto: 'Item' },
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId/checklist/:itemId': { texto: 'Tomado' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/checklist/:itemId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/notas': { texto: 'Nota' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/notas/:notaId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/anexos': {
    titulo: 'Link',
    url: 'https://exemplo.test/x',
  },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/anexos/:anexoId': undefined,
  // F8: recorrência
  'POST /api/v1/c/:comunidadeId/series': {
    regra: { frequencia: 'semanal', intervaloSemanas: 1, diasDaSemana: [6] },
    horaLocal: '16:00',
    inicioEm: '2026-12-05',
    titulo: 'Série invasora',
    categoria: 'Outra',
  },
  'GET /api/v1/c/:comunidadeId/series/:serieId': undefined,
  'PATCH /api/v1/c/:comunidadeId/series/:serieId': {
    versao: 1,
    escopo: 'serie',
    mudancas: { titulo: 'Tomada' },
  },
  'POST /api/v1/c/:comunidadeId/series/:serieId/encerrar': {
    aPartirDe: '2026-12-05',
    motivo: 'Invasão',
  },
  'DELETE /api/v1/c/:comunidadeId/series/:serieId': undefined,
  // F9: escalas e disponibilidade
  'GET /api/v1/c/:comunidadeId/minhas-escalas': undefined,
  'POST /api/v1/c/:comunidadeId/atribuicoes/:atribuicaoId/confirmar': undefined,
  'POST /api/v1/c/:comunidadeId/atribuicoes/:atribuicaoId/recusar': undefined,
  'POST /api/v1/c/:comunidadeId/atribuicoes/:atribuicaoId/substituicao': { motivo: 'Invasão' },
  'GET /api/v1/c/:comunidadeId/substituicoes': undefined,
  'POST /api/v1/c/:comunidadeId/substituicoes/:substituicaoId/assumir': undefined,
  'POST /api/v1/c/:comunidadeId/substituicoes/:substituicaoId/cancelar': undefined,
  'GET /api/v1/c/:comunidadeId/disponibilidade': undefined,
  'PUT /api/v1/c/:comunidadeId/disponibilidade/:data': { disponivel: true },
  // F10
  'GET /api/v1/c/:comunidadeId/inicio': undefined,
  // F11
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId/ao-vivo': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/ao-vivo': { comando: 'assumir', versao: 0 },
  // F12
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId/inscricoes': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/inscricoes/eu': undefined,
  'GET /api/v1/c/:comunidadeId/inscricoes/eu': undefined,
  'POST /api/v1/c/:comunidadeId/inscricoes/:inscricaoId/cancelar': undefined,
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId/checkin': undefined,
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId/presencas': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/presencas': {
    chaveIdempotencia: '00000000-0000-4000-8000-000000000001',
    origem: 'manual',
    nomeAvulso: 'Invasor',
  },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/presencas/:presencaId': undefined,
  // F15: pedidos de oração
  'GET /api/v1/c/:comunidadeId/oracao': undefined,
  'POST /api/v1/c/:comunidadeId/oracao': { texto: 'Invasão', visibilidade: 'comunidade' },
  'GET /api/v1/c/:comunidadeId/oracao/:pedidoId': undefined,
  'PATCH /api/v1/c/:comunidadeId/oracao/:pedidoId': { texto: 'Tomado' },
  'PUT /api/v1/c/:comunidadeId/oracao/:pedidoId/visibilidade': {
    de: 'comunidade',
    para: 'somente_eu',
  },
  'POST /api/v1/c/:comunidadeId/oracao/:pedidoId/respondido': { respondido: true },
  'POST /api/v1/c/:comunidadeId/oracao/:pedidoId/orando': undefined,
  'DELETE /api/v1/c/:comunidadeId/oracao/:pedidoId/orando': undefined,
  'DELETE /api/v1/c/:comunidadeId/oracao/:pedidoId': undefined,
  // F15: sugestões
  'GET /api/v1/c/:comunidadeId/sugestoes': undefined,
  'POST /api/v1/c/:comunidadeId/sugestoes': { titulo: 'Invasão', texto: 'Texto' },
  'GET /api/v1/c/:comunidadeId/sugestoes/:sugestaoId': undefined,
  'PATCH /api/v1/c/:comunidadeId/sugestoes/:sugestaoId': { status: 'recusada', resposta: 'Não' },
  'DELETE /api/v1/c/:comunidadeId/sugestoes/:sugestaoId': undefined,
  // F15: conteúdos
  'GET /api/v1/c/:comunidadeId/conteudos/musicas': undefined,
  'POST /api/v1/c/:comunidadeId/conteudos/musicas': { titulo: 'Invasão' },
  'GET /api/v1/c/:comunidadeId/conteudos/musicas/:musicaId': undefined,
  'PATCH /api/v1/c/:comunidadeId/conteudos/musicas/:musicaId': { versao: 1, titulo: 'Tomada' },
  'DELETE /api/v1/c/:comunidadeId/conteudos/musicas/:musicaId': undefined,
  'PUT /api/v1/c/:comunidadeId/conteudos/musicas/:musicaId/musicos': { musicoIds: [] },
  'GET /api/v1/c/:comunidadeId/conteudos/musicos': undefined,
  'POST /api/v1/c/:comunidadeId/conteudos/musicos': { nome: 'Invasor' },
  'GET /api/v1/c/:comunidadeId/conteudos/musicos/:musicoId': undefined,
  'PATCH /api/v1/c/:comunidadeId/conteudos/musicos/:musicoId': { versao: 1, nome: 'Tomado' },
  'DELETE /api/v1/c/:comunidadeId/conteudos/musicos/:musicoId': undefined,
  'GET /api/v1/c/:comunidadeId/conteudos/palestrantes': undefined,
  'POST /api/v1/c/:comunidadeId/conteudos/palestrantes': { nome: 'Invasor' },
  'GET /api/v1/c/:comunidadeId/conteudos/palestrantes/:palestranteId': undefined,
  'PATCH /api/v1/c/:comunidadeId/conteudos/palestrantes/:palestranteId': {
    versao: 1,
    nome: 'Tomado',
  },
  'DELETE /api/v1/c/:comunidadeId/conteudos/palestrantes/:palestranteId': undefined,
  'GET /api/v1/c/:comunidadeId/conteudos/dinamicas': undefined,
  'POST /api/v1/c/:comunidadeId/conteudos/dinamicas': { titulo: 'Invasão' },
  'GET /api/v1/c/:comunidadeId/conteudos/dinamicas/:dinamicaId': undefined,
  'PATCH /api/v1/c/:comunidadeId/conteudos/dinamicas/:dinamicaId': { versao: 1, titulo: 'Tomada' },
  'DELETE /api/v1/c/:comunidadeId/conteudos/dinamicas/:dinamicaId': undefined,
  // F15: avisos
  'GET /api/v1/c/:comunidadeId/avisos': undefined,
  'POST /api/v1/c/:comunidadeId/avisos': { titulo: 'Invasão', texto: 'Texto', publicar: true },
  'GET /api/v1/c/:comunidadeId/avisos/:avisoId': undefined,
  'PATCH /api/v1/c/:comunidadeId/avisos/:avisoId': { versao: 1, titulo: 'Tomado' },
  'POST /api/v1/c/:comunidadeId/avisos/:avisoId/publicar': undefined,
  'POST /api/v1/c/:comunidadeId/avisos/:avisoId/despublicar': undefined,
  'DELETE /api/v1/c/:comunidadeId/avisos/:avisoId': undefined,
  // F16: relatórios e exportações
  'GET /api/v1/c/:comunidadeId/relatorios/presenca': undefined,
  'GET /api/v1/c/:comunidadeId/relatorios/inscricoes': undefined,
  'GET /api/v1/c/:comunidadeId/relatorios/escalas': undefined,
  'GET /api/v1/c/:comunidadeId/relatorios/atividade': undefined,
  'GET /api/v1/c/:comunidadeId/exportacoes': undefined,
  'POST /api/v1/c/:comunidadeId/exportacoes': { tipo: 'membros', comContatos: true },
  'POST /api/v1/c/:comunidadeId/exportacoes/:exportacaoId/arquivo': { token: TOKEN_DE_B },
  'DELETE /api/v1/c/:comunidadeId/exportacoes/:exportacaoId': undefined,
  // F14: notificações (preferências e lista própria)
  'GET /api/v1/c/:comunidadeId/notificacoes': undefined,
  'GET /api/v1/c/:comunidadeId/notificacoes/preferencias': undefined,
  'PUT /api/v1/c/:comunidadeId/notificacoes/preferencias': { tipos: { avisos: false } },
  // F18: denúncias
  'POST /api/v1/c/:comunidadeId/denuncias': {
    recursoTipo: 'aviso',
    recursoId: '00000000-0000-4000-8000-000000000000',
    motivo: 'spam',
  },
  'GET /api/v1/c/:comunidadeId/denuncias': undefined,
  'PATCH /api/v1/c/:comunidadeId/denuncias/:denunciaId': {
    estado: 'procedente',
    retirarConteudo: true,
  },
  // F13: sincronização
  'POST /api/v1/c/:comunidadeId/sync/operacoes': {
    operacoes: [
      {
        chave: '00000000-0000-7000-8000-000000000001',
        vinculoId: '00000000-0000-4000-8000-000000000000',
        criadaEm: '2026-11-14T10:00:00-03:00',
        tipo: 'inscricao.intencao',
        dados: { eventoId: '00000000-0000-4000-8000-000000000000' },
      },
    ],
  },
  'GET /api/v1/c/:comunidadeId/sync/mudancas': undefined,
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId/pacote-offline': undefined,
  // D33: foto de perfil e logotipo
  'GET /api/v1/c/:comunidadeId/pessoas/:vinculoId/foto': undefined,
  'PUT /api/v1/c/:comunidadeId/logo': { imagem: PNG_PEQUENO },
  'DELETE /api/v1/c/:comunidadeId/logo': undefined,
  'GET /api/v1/c/:comunidadeId/logo': undefined,
}

interface Rota {
  metodo: string
  url: string
}

let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let adminA: Pessoa
let adminB: Pessoa
let comA: string
let comB: string
const idsDeB: Record<string, string> = {}

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  comA = await criarComunidade(b, 'Comunidade A')
  comB = await criarComunidade(b, 'Comunidade B')
  adminA = await pessoaComSessao(b, app, config, 'Admin A')
  adminB = await pessoaComSessao(b, app, config, 'Admin B')
  await vincular(b, adminA.id, comA, 'admin')
  idsDeB['vinculoId'] = await vincular(b, adminB.id, comB, 'admin')
  const { rows } = await b.su.query<{ id: string }>(
    `insert into uj.convites (comunidade_id, papel, token_hmac, expira_em, criado_por)
     values ($1, 'membro', $2, now() + interval '7 days', $3) returning id`,
    [comB, hmacDeToken(gerarToken(), config.CONVITE_SEGREDO), adminB.id],
  )
  idsDeB['conviteId'] = rows[0]!.id

  // Um exemplar de cada recurso de evento em B (inserido pelo dono do banco).
  const um = async (sql: string, params: unknown[]) =>
    (await b.dono.query<{ id: string }>(sql, params)).rows[0]!.id
  idsDeB['localId'] = await um(
    "insert into uj.locais (comunidade_id, nome, tipo) values ($1, 'Salão de B', 'interno') returning id",
    [comB],
  )
  idsDeB['modeloId'] = await um(
    "insert into uj.modelos (comunidade_id, nome, categoria, criado_por) values ($1, 'Modelo de B', 'Outra', $2) returning id",
    [comB, adminB.id],
  )
  const eventoId = await um(
    `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
     values ($1, 'Evento de B', 'Outra', now(), 60, 'America/Sao_Paulo', $2, 'publicado') returning id`,
    [comB, adminB.id],
  )
  idsDeB['eventoId'] = eventoId
  idsDeB['serieId'] = await um(
    `insert into uj.series (comunidade_id, regra, hora_local, fuso, duracao_min, inicio_em, titulo, categoria, criado_por)
     values ($1, '{"frequencia":"semanal","intervaloSemanas":1,"diasDaSemana":[6]}', '16:00', 'America/Sao_Paulo', 60, current_date, 'Série de B', 'Outra', $2) returning id`,
    [comB, adminB.id],
  )
  idsDeB['etapaId'] = await um(
    "insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min) values ($1, $2, 0, 'Louvor', 15) returning id",
    [comB, eventoId],
  )
  idsDeB['atribuicaoId'] = await um(
    'insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id) values ($1, $2, $3) returning id',
    [comB, eventoId, idsDeB['vinculoId']],
  )
  idsDeB['tarefaId'] = await um(
    "insert into uj.tarefas (comunidade_id, evento_id, titulo) values ($1, $2, 'Tarefa de B') returning id",
    [comB, eventoId],
  )
  idsDeB['materialId'] = await um(
    "insert into uj.materiais (comunidade_id, evento_id, nome) values ($1, $2, 'Material de B') returning id",
    [comB, eventoId],
  )
  idsDeB['itemId'] = await um(
    "insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto) values ($1, $2, 'preparacao', 'Item de B') returning id",
    [comB, eventoId],
  )
  idsDeB['notaId'] = await um(
    "insert into uj.notas_internas (comunidade_id, evento_id, texto, autor_conta_id) values ($1, $2, 'Nota de B', $3) returning id",
    [comB, eventoId, adminB.id],
  )
  idsDeB['substituicaoId'] = await um(
    'insert into uj.substituicoes (comunidade_id, atribuicao_id, pedida_por) values ($1, $2, $3) returning id',
    [comB, idsDeB['atribuicaoId'], idsDeB['vinculoId']],
  )
  idsDeB['data'] = '2026-12-05'
  idsDeB['inscricaoId'] = await um(
    "insert into uj.inscricoes (comunidade_id, evento_id, origem, nome, telefone, estado, consentimento_em) values ($1, $2, 'publica', 'Pessoa de B', '+5511900000000', 'confirmada', now()) returning id",
    [comB, eventoId],
  )
  idsDeB['presencaId'] = await um(
    "insert into uj.presencas (comunidade_id, evento_id, inscricao_id, origem, registrada_por, chave_idempotencia) values ($1, $2, $3, 'manual', $4, gen_random_uuid()) returning id",
    [comB, eventoId, idsDeB['inscricaoId'], idsDeB['vinculoId']],
  )
  // F15 e F16: um exemplar de cada recurso novo em B.
  idsDeB['pedidoId'] = await um(
    `insert into uj.pedidos_oracao (comunidade_id, autor_conta_id, texto_cifrado, visibilidade)
     values ($1, $2, decode('01' || repeat('ab', 40), 'hex'), 'comunidade') returning id`,
    [comB, adminB.id],
  )
  idsDeB['sugestaoId'] = await um(
    "insert into uj.sugestoes (comunidade_id, autor_conta_id, titulo, texto) values ($1, $2, 'Sugestão de B', 'Texto') returning id",
    [comB, adminB.id],
  )
  idsDeB['musicaId'] = await um(
    "insert into uj.musicas (comunidade_id, titulo, criado_por) values ($1, 'Música de B', $2) returning id",
    [comB, adminB.id],
  )
  idsDeB['musicoId'] = await um(
    "insert into uj.musicos (comunidade_id, nome, criado_por) values ($1, 'Músico de B', $2) returning id",
    [comB, adminB.id],
  )
  await um(
    'insert into uj.musica_musicos (comunidade_id, musica_id, musico_id) values ($1, $2, $3) returning id',
    [comB, idsDeB['musicaId'], idsDeB['musicoId']],
  )
  idsDeB['palestranteId'] = await um(
    "insert into uj.palestrantes (comunidade_id, nome, criado_por) values ($1, 'Palestrante de B', $2) returning id",
    [comB, adminB.id],
  )
  idsDeB['dinamicaId'] = await um(
    "insert into uj.dinamicas (comunidade_id, titulo, criado_por) values ($1, 'Dinâmica de B', $2) returning id",
    [comB, adminB.id],
  )
  idsDeB['avisoId'] = await um(
    "insert into uj.avisos (comunidade_id, titulo, texto, estado, criado_por) values ($1, 'Aviso de B', 'Texto', 'publicado', $2) returning id",
    [comB, adminB.id],
  )
  idsDeB['exportacaoId'] = await um(
    `insert into uj.exportacoes (comunidade_id, dono_conta_id, tipo, com_contatos, token_hash, nome_arquivo, conteudo, linhas)
     values ($1, $2, 'membros', true, sha256(convert_to($3, 'UTF8')), 'membros.csv', 'Nome;E-mail', 0) returning id`,
    [comB, adminB.id, TOKEN_DE_B],
  )
  idsDeB['denunciaId'] = await um(
    `insert into uj.denuncias (comunidade_id, recurso_tipo, recurso_id, denunciante_conta_id, motivo)
     values ($1, 'aviso', $2, $3, 'spam') returning id`,
    [comB, idsDeB['avisoId'], adminB.id],
  )
  await b.dono.query(
    `insert into uj.preferencias_notificacao (comunidade_id, conta_id, tipo, ativo)
     values ($1, $2, 'avisos', true)`,
    [comB, adminB.id],
  )
  // D33: B tem logotipo e a admin de B tem foto (pela API, como o app faria).
  const logoB = await app.inject({
    method: 'PUT',
    url: `/api/v1/c/${comB}/logo`,
    headers: adminB.auth,
    payload: { imagem: emBase64(await imagem('png', 32, 32)) },
  })
  expect(logoB.statusCode).toBe(200)
  const fotoB = await app.inject({
    method: 'PUT',
    url: '/api/v1/eu/foto',
    headers: adminB.auth,
    payload: { imagem: emBase64(await imagem('jpeg', 32, 32)) },
  })
  expect(fotoB.statusCode).toBe(200)
  idsDeB['anexoId'] = await um(
    "insert into uj.anexos (comunidade_id, evento_id, titulo, url, criado_por) values ($1, $2, 'Link de B', 'https://exemplo.test/b', $3) returning id",
    [comB, eventoId, adminB.id],
  )
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

function rotasDeComunidade(): Rota[] {
  return app.rotas().filter((r) => r.url.startsWith('/api/v1/c/:comunidadeId'))
}

function montar(url: string, comunidade: string, recursos: Record<string, string>): string {
  return url
    .replace(':comunidadeId', comunidade)
    .replace(/:(\w+)/g, (_, nome: string) => recursos[nome] ?? `faltou-${nome}`)
}

function pedir(r: Rota, comunidade: string, quem: Pessoa | null, corpo?: Record<string, unknown>) {
  const opcoes: InjectOptions = {
    method: r.metodo as 'GET',
    url: montar(r.url, comunidade, idsDeB),
  }
  if (quem) opcoes.headers = quem.auth
  const payload = corpo ?? CASOS[`${r.metodo} ${r.url}`]
  if (payload) opcoes.payload = payload
  return app.inject(opcoes)
}

/** Retrato de tudo que é de B: qualquer escrita indevida muda este retrato. */
async function estadoDeB() {
  const { rows } = await b.su.query(
    `select (select json_agg(row(papel, estado) order by id) from uj.vinculos where comunidade_id = $1) as v,
            (select json_agg(row(revogado_em) order by id) from uj.convites where comunidade_id = $1) as c,
            (select nome from uj.comunidades where id = $1) as nome,
            (select json_agg(row(nome, arquivado) order by id) from uj.locais where comunidade_id = $1) as l,
            (select count(*) from uj.modelos where comunidade_id = $1) as m,
            (select json_agg(row(titulo, status, versao) order by id) from uj.eventos where comunidade_id = $1) as e,
            (select json_agg(row(titulo, ordem) order by id) from uj.etapas where comunidade_id = $1) as et,
            (select count(*) from uj.atribuicoes where comunidade_id = $1) as a,
            (select json_agg(row(titulo, concluida_em) order by id) from uj.tarefas where comunidade_id = $1) as t,
            (select json_agg(row(nome) order by id) from uj.materiais where comunidade_id = $1) as ma,
            (select json_agg(row(texto, marcado_em) order by id) from uj.checklist_itens where comunidade_id = $1) as ck,
            (select count(*) from uj.notas_internas where comunidade_id = $1) as n,
            (select count(*) from uj.anexos where comunidade_id = $1) as an,
            (select json_agg(row(titulo, fim_em, versao, estado) order by id) from uj.series where comunidade_id = $1) as s,
            (select json_agg(row(estado, assumida_por) order by id) from uj.substituicoes where comunidade_id = $1) as sb,
            (select json_agg(row(estado, vinculo_id) order by id) from uj.atribuicoes where comunidade_id = $1) as at,
            (select count(*) from uj.disponibilidades where comunidade_id = $1) as d,
            (select json_agg(row(estado) order by id) from uj.inscricoes where comunidade_id = $1) as i,
            (select count(*) from uj.presencas where comunidade_id = $1) as p,
            (select json_agg(row(texto_cifrado, visibilidade, respondido_em, versao) order by id) from uj.pedidos_oracao where comunidade_id = $1) as po,
            (select count(*) from uj.intercessoes where comunidade_id = $1) as io,
            (select json_agg(row(status, resposta, versao) order by id) from uj.sugestoes where comunidade_id = $1) as sg,
            (select json_agg(row(titulo, versao) order by id) from uj.musicas where comunidade_id = $1) as mu,
            (select json_agg(row(nome, versao) order by id) from uj.musicos where comunidade_id = $1) as mo,
            (select count(*) from uj.musica_musicos where comunidade_id = $1) as mm,
            (select json_agg(row(nome, versao) order by id) from uj.palestrantes where comunidade_id = $1) as pa,
            (select json_agg(row(titulo, versao) order by id) from uj.dinamicas where comunidade_id = $1) as di,
            (select json_agg(row(titulo, estado, fixado, versao) order by id) from uj.avisos where comunidade_id = $1) as av,
            (select json_agg(row(downloads, baixada_em) order by id) from uj.exportacoes where comunidade_id = $1) as ex,
            (select json_agg(row(estado, conteudo_retirado) order by id) from uj.denuncias where comunidade_id = $1) as dn,
            (select json_agg(row(tipo, ativo) order by id) from uj.preferencias_notificacao where comunidade_id = $1) as pn,
            (select count(*) from uj.sync_operacoes where comunidade_id = $1) as so,
            (select count(*) from uj.andamento_comandos where comunidade_id = $1) as ac,
            (select encode(hash, 'hex') from uj.logos_comunidades where comunidade_id = $1) as lg,
            (select json_agg(encode(f.hash, 'hex') order by f.conta_id) from uj.fotos_contas f
               join uj.vinculos v on v.conta_id = f.conta_id where v.comunidade_id = $1) as fo`,
    [comB],
  )
  return rows[0]
}

describe('isolamento entre comunidades', () => {
  it('inventário: toda rota de comunidade tem caso de isolamento', () => {
    const semCaso = rotasDeComunidade()
      .map((r) => `${r.metodo} ${r.url}`)
      .filter((chave) => !(chave in CASOS))
    expect(semCaso).toEqual([])
    expect(rotasDeComunidade().length).toBe(Object.keys(CASOS).length)
  })

  it('A não alcança nada de B pelo caminho, em nenhuma rota (404)', async () => {
    const antes = await estadoDeB()
    for (const r of rotasDeComunidade()) {
      const resposta = await pedir(r, comB, adminA)
      expect(resposta.statusCode, `${r.metodo} ${r.url}`).toBe(404)
    }
    expect(await estadoDeB()).toEqual(antes)
  })

  it('A não alcança recurso de B trocando só o id do recurso (404)', async () => {
    const antes = await estadoDeB()
    // `:data` (disponibilidade) não é id de recurso: fica fora deste ataque.
    const comRecurso = rotasDeComunidade().filter((r) => /:(?!comunidadeId|data\b)\w+/.test(r.url))
    expect(comRecurso.length).toBeGreaterThan(0)
    for (const r of comRecurso) {
      const resposta = await pedir(r, comA, adminA)
      expect(resposta.statusCode, `${r.metodo} ${r.url}`).toBe(404)
    }
    expect(await estadoDeB()).toEqual(antes)
  })

  it('ids inválidos ou inexistentes dão 404, sem erro interno', async () => {
    for (const id of ['nao-e-uuid', '00000000-0000-0000-0000-000000000000', "1' or '1'='1"]) {
      const r = await app.inject({
        method: 'GET',
        url: `/api/v1/c/${encodeURIComponent(id)}/membros`,
        headers: adminA.auth,
      })
      expect(r.statusCode).toBe(404)
    }
  })

  it('rotas de plataforma recusam quem não é Criador com 2FA (403)', async () => {
    const plataforma = app.rotas().filter((r) => r.url.startsWith('/api/v1/plataforma'))
    expect(plataforma.length).toBeGreaterThan(0)
    for (const r of plataforma) {
      const resposta = await pedir(r, comB, adminA, {})
      expect(resposta.statusCode, `${r.metodo} ${r.url}`).toBe(403)
    }
  })

  it('sem sessão, toda rota /api/v1 responde 401', async () => {
    for (const r of app.rotas().filter((x) => x.url.startsWith('/api/v1/'))) {
      const resposta = await pedir(r, comA, null)
      expect(resposta.statusCode, `${r.metodo} ${r.url}`).toBe(401)
    }
  })
})

describe('isolamento no corpo e nos filtros (F13, F14, F18)', () => {
  it('fila offline em A citando recursos de B: tudo rejeitado, B intacto', async () => {
    const antes = await estadoDeB()
    const vinculoA = (
      await b.su.query<{ id: string }>(
        'select id from uj.vinculos where conta_id = $1 and comunidade_id = $2',
        [adminA.id, comA],
      )
    ).rows[0]!.id
    const env = (n: number) => ({
      chave: `00000000-0000-7000-8000-00000000010${n}`,
      vinculoId: vinculoA,
      criadaEm: new Date().toISOString(),
    })
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comA}/sync/operacoes`,
      headers: adminA.auth,
      payload: {
        operacoes: [
          {
            ...env(1),
            tipo: 'tarefa.concluir',
            dados: { tarefaId: idsDeB['tarefaId'], concluida: true },
          },
          {
            ...env(2),
            tipo: 'checklist.marcar',
            dados: { itemId: idsDeB['itemId'], marcado: true },
          },
          {
            ...env(3),
            tipo: 'presenca.registrar',
            dados: { eventoId: idsDeB['eventoId'], inscricaoId: idsDeB['inscricaoId'] },
          },
          { ...env(4), tipo: 'inscricao.intencao', dados: { eventoId: idsDeB['eventoId'] } },
          {
            ...env(5),
            tipo: 'ao_vivo.proposta',
            dados: {
              eventoId: idsDeB['eventoId'],
              versaoBase: 0,
              comandos: [{ comando: 'iniciar', ocorridoEm: new Date().toISOString() }],
            },
          },
        ],
      },
    })
    expect(r.statusCode).toBe(200)
    const status = (r.json().resultados as { status: string }[]).map((x) => x.status)
    expect(status).toEqual(['rejeitada', 'rejeitada', 'rejeitada', 'rejeitada', 'rejeitada'])
    expect(await estadoDeB()).toEqual(antes)
  })

  it('presença em evento de B citando o vínculo de alguém de A: 404 na rota, recusada na fila e no banco', async () => {
    const vinculoA = (
      await b.su.query<{ id: string }>(
        'select id from uj.vinculos where conta_id = $1 and comunidade_id = $2',
        [adminA.id, comA],
      )
    ).rows[0]!.id
    const presencasDeA = async () =>
      (await b.su.query('select id from uj.presencas where vinculo_id = $1', [vinculoA])).rows
    // Quem age é a admin de B, no PRÓPRIO evento, citando a pessoa de A.
    const rota = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comB}/eventos/${idsDeB['eventoId']}/presencas`,
      headers: adminB.auth,
      payload: {
        chaveIdempotencia: '00000000-0000-4000-8000-0000000000a1',
        origem: 'manual',
        vinculoId: vinculoA,
      },
    })
    expect(rota.statusCode).toBe(404)
    const fila = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comB}/sync/operacoes`,
      headers: adminB.auth,
      payload: {
        operacoes: [
          {
            chave: '00000000-0000-7000-8000-0000000000a2',
            vinculoId: idsDeB['vinculoId'],
            criadaEm: new Date().toISOString(),
            tipo: 'presenca.registrar',
            dados: { eventoId: idsDeB['eventoId'], vinculoId: vinculoA },
          },
        ],
      },
    })
    expect(fila.statusCode).toBe(200)
    expect(fila.json().resultados[0].status).toBe('rejeitada')
    // O próprio banco recusa, mesmo vindo do dono (gatilho, não só a rota).
    await expect(
      b.dono.query(
        `insert into uj.presencas (comunidade_id, evento_id, vinculo_id, origem, registrada_por, chave_idempotencia)
         values ($1, $2, $3, 'manual', $4, gen_random_uuid())`,
        [comB, idsDeB['eventoId'], vinculoA, idsDeB['vinculoId']],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    expect(await presencasDeA()).toEqual([])
    // E nada de B aparece no "exportar meus dados" da pessoa de A.
    const exportado = await app.inject({
      method: 'GET',
      url: '/api/v1/eu/exportar',
      headers: adminA.auth,
    })
    expect(exportado.json().presencas).toEqual([])
  })

  it('denunciar em A um aviso de B: 404, nada gravado', async () => {
    const antes = await estadoDeB()
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${comA}/denuncias`,
      headers: adminA.auth,
      payload: { recursoTipo: 'aviso', recursoId: idsDeB['avisoId'], motivo: 'spam' },
    })
    expect(r.statusCode).toBe(404)
    expect(await estadoDeB()).toEqual(antes)
  })

  it('"minhas inscrições" em A nunca traz a inscrição da mesma pessoa em B', async () => {
    // Uma conta presente nas duas comunidades, inscrita num evento de B.
    const nasDuas = await pessoaComSessao(b, app, config, 'Pessoa Nas Duas')
    await vincular(b, nasDuas.id, comA, 'membro')
    const vinculoEmB = await vincular(b, nasDuas.id, comB, 'membro')
    const inscricaoEmB = (
      await b.dono.query<{ id: string }>(
        `insert into uj.inscricoes (comunidade_id, evento_id, origem, vinculo_id, nome, estado)
         values ($1, $2, 'membro', $3, 'Pessoa Nas Duas', 'confirmada') returning id`,
        [comB, idsDeB['eventoId'], vinculoEmB],
      )
    ).rows[0]!.id
    for (const periodo of ['proximas', 'todas']) {
      const r = await app.inject({
        method: 'GET',
        url: `/api/v1/c/${comA}/inscricoes/eu?periodo=${periodo}`,
        headers: nasDuas.auth,
      })
      expect(r.statusCode).toBe(200)
      expect(r.json()).toEqual({ inscricoes: [] })
    }
    // Em B, a mesma pessoa vê a sua (o evento de B começou agora e dura 60 min).
    const emB = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${comB}/inscricoes/eu`,
      headers: nasDuas.auth,
    })
    expect(emB.json().inscricoes.map((i: { inscricaoId: string }) => i.inscricaoId)).toEqual([
      inscricaoEmB,
    ])
    // E a admin de A, que não está em B, recebe 404 em B, como em toda rota.
    const deFora = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${comB}/inscricoes/eu`,
      headers: adminA.auth,
    })
    expect(deFora.statusCode).toBe(404)
  })

  it('o log de mudanças de A nunca traz registro de B', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${comA}/sync/mudancas?limite=1000`,
      headers: adminA.auth,
    })
    expect(r.statusCode).toBe(200)
    const ids = new Set((r.json().mudancas as { id: string }[]).map((m) => m.id))
    for (const id of Object.values(idsDeB)) expect(ids.has(id)).toBe(false)
    expect(ids.has(comB)).toBe(false)
  })
})
