import { NOME_DO_APP } from '@uj/dominio'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { decifrar } from '../autenticacao/cripto.ts'
import { Limitador } from '../autenticacao/limitador.ts'
import {
  NOME_DO_PROVEDOR,
  TokenDeProvedorRecusado,
  TokensJaUsados,
  type IdentidadeDoProvedor,
  type VerificadorDeProvedores,
} from '../autenticacao/provedores.ts'
import {
  declararFaixaEtaria,
  ErroDeAuth,
  excluirConta,
  type DependenciasAuth,
} from '../autenticacao/servico.ts'
import { emTransacao } from '../banco/contexto.ts'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { faixaEtaria, nomeDoCookieDeRefresh } from './autenticacao.ts'
import { exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Direitos do titular e denúncia (F18):
 * - exportar meus dados (tudo do titular, com os PRÓPRIOS pedidos de oração
 *   decifrados; nada de terceiros);
 * - excluir a conta (senha e 2FA; `uj.excluir_conta`, atômica);
 * - declarar a faixa de idade (TC-01) de conta criada antes da F18;
 * - denunciar conteúdo (Apple 1.2) e a fila de denúncias dos administradores.
 */

const LEIA_ME = [
  `Cópia dos seus dados no ${NOME_DO_APP}, gerada a seu pedido.`,
  'conta: seus dados de cadastro e o avatar (sem senha nem segredo do autenticador).',
  'conta.foto: sua foto de perfil, se houver; a imagem (WebP) está em conteudoBase64.',
  'contasConectadas: contas do Google ou da Apple ligadas à sua, com o e-mail que elas informaram.',
  'consentimentos: o que você aceitou, com a versão do texto e a data.',
  'comunidades: seus vínculos, inclusive os encerrados que ainda estão ligados a você.',
  'escalas, substituicoes, disponibilidades, inscricoes, presencas: sua participação.',
  'pedidosDeOracao: seus pedidos, com o texto decifrado. De quem orou, só a contagem.',
  'sugestoes, avisos, notasInternas, denuncias: o que você escreveu.',
  'bloqueios: em que comunidade e quando você bloqueou alguém (sem dados da outra pessoa).',
  'sessoes, aparelhosDeNotificacao, auditoria: aparelhos conectados e registro das suas ações.',
  'Guarde este arquivo com cuidado: ele contém seus pedidos de oração sem cifragem.',
]

export function registrarRotasDePrivacidade(
  app: FastifyInstance,
  d: DependenciasAuth & { api: pg.Pool; verificador?: VerificadorDeProvedores },
): void {
  const sessao = { preHandler: app.exigirSessao }
  // Tokens de provedor já usados para reautenticar (o mesmo não serve duas vezes).
  const usados = new TokensJaUsados()
  const chaveDeOracao = Buffer.from(d.config.ORACAO_CHAVE, 'base64')
  // Por conta: a senha já tem o limite do login; este corta repetição na exclusão.
  const limExcluir = new Limitador(5, 15 * 60_000)
  const limExportar = new Limitador(10, 60 * 60_000)

  function muitas(r: FastifyReply, l: Limitador, chave: string): never {
    r.header('Retry-After', String(l.segundosParaLiberar(chave)))
    throw new ErroHttp(
      'muitas_tentativas',
      429,
      'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
    )
  }

  // ---------------------------------------------------------------- exportar

  app.get('/api/v1/eu/exportar', sessao, async (pedido, resposta) => {
    const contaId = pedido.sessao!.contaId
    if (!limExportar.tentar(contaId)) muitas(resposta, limExportar, contaId)
    const dados = await emTransacao(d.api, { contaId, comunidadeId: null }, async (c) => {
      try {
        const tudo = (
          await c.query<{ d: Record<string, unknown> }>('select uj.exportar_meus_dados() as d')
        ).rows[0]!.d
        const avatar = (
          await c.query<{ icone: string | null; cor: string | null }>(
            'select avatar_icone as icone, avatar_cor as cor from uj.contas where id = $1',
            [contaId],
          )
        ).rows[0]
        if (tudo['conta'] && typeof tudo['conta'] === 'object') {
          const conta = tudo['conta'] as Record<string, unknown>
          conta['avatar'] = avatar?.icone ? avatar : null
          // A foto vai inteira, em base64: o arquivo exportado não depende de
          // link nem de sessão para ser aberto depois (D33).
          const foto = (
            await c.query<{ conteudo: Buffer }>(
              'select conteudo from uj.fotos_contas where conta_id = $1',
              [contaId],
            )
          ).rows[0]
          if (foto && conta['foto'] && typeof conta['foto'] === 'object') {
            ;(conta['foto'] as Record<string, unknown>)['conteudoBase64'] =
              foto.conteudo.toString('base64')
          }
        }
        // Pedidos de entrada e denúncias de comunidade feitos pela pessoa (ADR 0007).
        Object.assign(
          tudo,
          (await c.query<{ d: Record<string, unknown> }>('select uj.meus_dados_da_abertura() as d'))
            .rows[0]!.d,
        )
        // Bloqueios que a pessoa fez (D35): a decisão é dela; de quem foi
        // bloqueado, nada (nem nome nem id), como no resto do arquivo.
        tudo['bloqueios'] = (
          await c.query(
            `select comunidade_id as "comunidadeId", criado_em as "bloqueadoEm"
               from uj.bloqueios where conta_id = $1 order by criado_em`,
            [contaId],
          )
        ).rows
        return tudo
      } catch (e) {
        traduzirErroDoBanco(e)
      }
    })
    // Vínculos de provedor só o papel de identidade lê (uj_auth): sub e token ficam fora.
    dados['contasConectadas'] = (
      await d.auth.query(
        `select provedor, email_informado as email, criado_em as "conectadaEm",
                ultimo_uso_em as "ultimoUso", desconectado_em as "desconectadaEm"
           from uj.contas_provedores where conta_id = $1 order by provedor`,
        [contaId],
      )
    ).rows
    const pedidos = (dados['pedidosDeOracao'] as Record<string, unknown>[] | undefined) ?? []
    dados['pedidosDeOracao'] = pedidos.map(({ textoCifrado, ...resto }) => {
      let texto: string | null
      try {
        texto = decifrar(
          chaveDeOracao,
          Buffer.from(String(textoCifrado), 'base64'),
          `oracao:${String(resto['id'])}`,
        )
      } catch {
        texto = null
      }
      return { ...resto, texto }
    })
    return resposta
      .header('Content-Disposition', 'attachment; filename="meus-dados-uni-jovem.json"')
      .send({ geradoEm: new Date().toISOString(), leiaMe: LEIA_ME, ...dados })
  })

  // ---------------------------------------------------------------- excluir conta

  app.post('/api/v1/eu/excluir-conta', sessao, async (pedido, resposta) => {
    const contaId = pedido.sessao!.contaId
    if (!limExcluir.tentar(contaId)) muitas(resposta, limExcluir, contaId)
    // Senha OU um token novo do Google ou da Apple (conta criada só pelo
    // provedor não tem senha: Apple 5.1.1(v) e Google Play). 2FA, se ligado.
    const token = z.string().trim().min(20).max(8000)
    const corpo = validar(
      z
        .object({
          senha: z.string().min(1).max(256).optional(),
          codigo: z.string().trim().min(6).max(12).nullish(),
          provedor: z.enum(['google', 'apple']).optional(),
          idToken: token.optional(),
          identityToken: token.optional(),
          nonce: z.string().trim().min(16).max(128).optional(),
        })
        .refine(
          (o) => o.senha !== undefined || o.provedor !== undefined,
          'Confirme com a sua senha ou entrando de novo com Google ou Apple.',
        ),
      pedido.body,
    )
    let identidade: IdentidadeDoProvedor | null = null
    if (corpo.senha === undefined && corpo.provedor) {
      const bruto = corpo.provedor === 'google' ? corpo.idToken : corpo.identityToken
      if (!bruto || !d.verificador) {
        throw new ErroHttp(
          'dados_invalidos',
          400,
          'Confirme com a sua senha ou entrando de novo com Google ou Apple.',
        )
      }
      try {
        identidade = await d.verificador.verificar(corpo.provedor, bruto, { nonce: corpo.nonce })
      } catch (e) {
        if (!(e instanceof TokenDeProvedorRecusado)) throw e
        throw new ErroDeAuth(
          'reautenticacao_invalida',
          401,
          `Não conseguimos confirmar com ${NOME_DO_PROVEDOR[corpo.provedor]}. Tente de novo.`,
        )
      }
      if (!usados.registrar(bruto, identidade.expiraEm)) {
        throw new ErroDeAuth(
          'token_ja_usado',
          401,
          `Esta confirmação do ${NOME_DO_PROVEDOR[corpo.provedor]} já foi usada. Tente de novo.`,
        )
      }
    }
    await excluirConta(d, {
      contaId,
      senha: corpo.senha ?? null,
      codigo: corpo.codigo ?? null,
      identidade,
    })
    resposta.clearCookie(nomeDoCookieDeRefresh(d.config.UJ_AMBIENTE !== 'desenvolvimento'), {
      path: '/api/auth',
    })
    return { ok: true }
  })

  // ---------------------------------------------------------------- idade

  app.put('/api/v1/eu/faixa-etaria', sessao, async (pedido) => {
    const corpo = validar(z.object({ faixa: faixaEtaria }), pedido.body)
    try {
      await declararFaixaEtaria(d, {
        contaId: pedido.sessao!.contaId,
        sessaoId: pedido.sessao!.sessaoId,
        faixa: corpo.faixa,
      })
    } catch (e) {
      if (e instanceof ErroDeAuth) throw e
      traduzirErroDoBanco(e)
    }
    return { ok: true }
  })

  // ---------------------------------------------------------------- denúncias

  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId/denuncias'

  app.post(base, naCom, async (pedido) => {
    exigir(pedido, 'denuncia', 'criar')
    const corpo = validar(
      z.object({
        recursoTipo: z.enum(['pedido_oracao', 'sugestao', 'aviso']),
        recursoId: z.uuid(),
        motivo: z.enum(['ofensivo', 'dados_de_terceiros', 'spam', 'risco', 'outro']),
        detalhe: z.string().trim().max(500).nullish(),
      }),
      pedido.body,
    )
    return naComunidade(d.api, pedido, async (c) => {
      try {
        const { rows } = await c.query<{ id: string }>(
          'select uj.denunciar($1, $2, $3, $4) as id',
          [corpo.recursoTipo, corpo.recursoId, corpo.motivo, corpo.detalhe ?? null],
        )
        return {
          id: rows[0]!.id,
          mensagem: 'Recebemos sua denúncia. A administração da comunidade vai analisar.',
        }
      } catch (e) {
        if ((e as { code?: string }).code === 'UJ050') throw NAO_ENCONTRADO()
        traduzirErroDoBanco(e)
      }
    })
  })

  app.get(base, naCom, async (pedido) => {
    exigir(pedido, 'denuncia', 'ler')
    const q = validar(
      z.object({ estado: z.enum(['aberta', 'procedente', 'improcedente']).default('aberta') }),
      pedido.query,
    )
    return naComunidade(d.api, pedido, async (c) => {
      const { rows } = await c.query(
        `select id, recurso_tipo as "recursoTipo", recurso_id as "recursoId", motivo, detalhe, estado,
                resolucao, conteudo_retirado as "conteudoRetirado", resolvida_em as "resolvidaEm",
                criado_em as "criadoEm"
           from uj.denuncias where comunidade_id = $1 and estado = $2
          order by criado_em desc limit 200`,
        [pedido.comunidade!.id, q.estado],
      )
      return { denuncias: rows }
    })
  })

  app.patch(`${base}/:denunciaId`, naCom, async (pedido) => {
    exigir(pedido, 'denuncia', 'resolver')
    const denunciaId = idDoCaminho(pedido, 'denunciaId')
    const corpo = validar(
      z.object({
        estado: z.enum(['procedente', 'improcedente']),
        resolucao: z.string().trim().max(500).nullish(),
        retirarConteudo: z.boolean().default(false),
      }),
      pedido.body,
    )
    return naComunidade(d.api, pedido, async (c) => {
      try {
        await c.query('select uj.resolver_denuncia($1, $2, $3, $4)', [
          denunciaId,
          corpo.estado,
          corpo.resolucao ?? null,
          corpo.retirarConteudo,
        ])
        return { ok: true }
      } catch (e) {
        if ((e as { code?: string }).code === 'UJ051') throw NAO_ENCONTRADO()
        traduzirErroDoBanco(e)
      }
    })
  })
}
