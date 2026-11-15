import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import QRCode from 'qrcode'
import { z } from 'zod'
import { gerarToken, hashDeToken } from '../autenticacao/cripto.ts'
import { Limitador, truncarIp } from '../autenticacao/limitador.ts'
import type { Config } from '../config.ts'
import { CSP_PUBLICA, ESTILO, Seguro, SCRIPT_CANCELAR, html, pagina } from './html.ts'
import { dataPorExtenso, normalizarTelefone, verificarTurnstile } from './apoio.ts'
import { VERSAO_DO_TEXTO } from '../privacidade/consentimentos.ts'

/**
 * Páginas públicas de evento (F12): `/e/:idPublico`, inscrição, confirmação e
 * cancelamento. Renderizadas no servidor (prévia correta no WhatsApp,
 * funcionam sem JavaScript). Só falam com as funções públicas do banco
 * (`uj.evento_publico`, `uj.inscrever_publico`, `uj.cancelar_inscricao_publica`):
 * nada interno, nenhuma lista de participantes.
 */

interface EventoPublico {
  titulo: string
  descricao: string | null
  categoria: string
  inicio: Date
  duracao_min: number
  fuso: string
  status: string
  motivo_status: string | null
  informacoes_uteis: string | null
  local_nome: string | null
  local_tipo: string | null
  local_endereco: string | null
  local_latitude: number | null
  local_longitude: number | null
  comunidade_nome: string
  comunidade_cor: string
  capacidade: number | null
  vagas_restantes: number | null
  lista_de_espera: boolean
  inscricoes_abertas: boolean
  retencao_dias: number
}

const idPublico = z.string().regex(/^[0-9a-f]{32}$/)

export interface OpcoesPublicas {
  config: Config
  api: pg.Pool
  chaveDoSiteTurnstile?: string
  fatorDeLimitePorIp?: number
  buscar?: typeof fetch
}

function responder(r: FastifyReply, status: number, conteudo: string) {
  return r
    .code(status)
    .header('Content-Type', 'text/html; charset=utf-8')
    .header('Content-Security-Policy', CSP_PUBLICA)
    .header('X-Robots-Tag', 'noindex, nofollow')
    .send(conteudo)
}

function naoEncontrado(r: FastifyReply) {
  return responder(
    r,
    404,
    pagina(
      html`<h1>Evento não encontrado</h1>
        <p class="suave">
          Confira o link com quem compartilhou. Ele pode ter sido digitado errado ou o evento não
          está mais disponível.
        </p>`,
      { titulo: 'Evento não encontrado' },
    ),
  )
}

/** Teto de inscrições ativas por WhatsApp num evento (UJ036, migração 0021). */
export const TETO_POR_WHATSAPP = 10

/**
 * Resumo para a pessoa mandar ao próprio WhatsApp: evento, código e o link de
 * cancelamento. Sem nome, telefone nem e-mail (a conversa pode ser
 * encaminhada, e o nome junto do evento de igreja é dado sensível).
 */
function textoParaWhatsapp(
  e: { titulo: string; inicio: Date; fuso: string; local_nome: string | null },
  codigo: string,
  cancelar: string,
): string {
  return [
    `Inscrição: ${e.titulo}`,
    `${dataPorExtenso(e.inicio, e.fuso)}${e.local_nome ? `, ${e.local_nome}` : ''}`,
    `Código de entrada: ${codigo}`,
    `Para ver o QR de novo, cancelar ou apagar os dados: ${cancelar}`,
  ].join('\n')
}

const MENSAGEM_OCUPADO =
  'Muita gente se inscrevendo agora. Espere alguns segundos e toque de novo em "Confirmar inscrição".'

/**
 * Pico maior que o pool de conexões: o pedido esperou uma conexão livre além
 * do limite. Nada foi gravado; é caso de "tente de novo", não de erro interno.
 */
function ehFilaDoBancoEsgotada(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : ''
  return (
    mensagem.includes('timeout exceeded when trying to connect') ||
    mensagem.includes('Connection terminated due to connection timeout')
  )
}

/** "Inscrever outra pessoa": volta ao formulário com o mesmo contato, sem pôr nada na URL. */
function botaoOutraPessoa(id: string, telefone: string, email: string): Seguro {
  return html`<form method="post" action="/e/${id}/outra">
    <input type="hidden" name="telefone" value="${telefone}" />
    <input type="hidden" name="email" value="${email}" />
    <button type="submit" class="secundario">Inscrever outra pessoa</button>
  </form>`
}

async function cartaoDoCodigo(
  e: { titulo: string; inicio: Date; fuso: string },
  estado: string | null,
  codigo: string,
): Promise<Seguro> {
  const qr = await QRCode.toString(codigo, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  return html`<div class="cartao">
    <p><strong>${e.titulo}</strong><br />${dataPorExtenso(e.inicio, e.fuso)}</p>
    ${estado === 'espera' ? html`<p>Se abrir uma vaga, sua inscrição passa a confirmada automaticamente.</p>` : ''}
    <p>Na entrada, mostre este código:</p>
    <div class="qr" role="img" aria-label="Código de entrada ${codigo}">${new Seguro(qr)}</div>
    <p>Código: <strong>${codigo}</strong></p>
  </div>`
}

export function registrarPaginasPublicas(app: FastifyInstance, o: OpcoesPublicas): void {
  const fator = o.fatorDeLimitePorIp ?? 1
  const limInscricaoIp = new Limitador(10 * fator, 60 * 60_000)
  const limInscricaoEvento = new Limitador(300, 60 * 60_000)
  const limCancelarIp = new Limitador(20 * fator, 60 * 60_000)

  async function lerEvento(id: string): Promise<EventoPublico | undefined> {
    return (await o.api.query<EventoPublico>('select * from uj.evento_publico($1)', [id])).rows[0]
  }

  const urlDoEvento = (id: string) => new URL(`/e/${id}`, o.config.URL_PUBLICA).toString()

  function detalhes(e: EventoPublico): Seguro {
    const quando = dataPorExtenso(e.inicio, e.fuso)
    const mapa =
      e.local_latitude !== null && e.local_longitude !== null
        ? `https://www.openstreetmap.org/?mlat=${e.local_latitude}&mlon=${e.local_longitude}#map=17/${e.local_latitude}/${e.local_longitude}`
        : null
    return html` <p>
        <span class="selo">${e.categoria}</span> <span class="suave">${e.comunidade_nome}</span>
      </p>
      <h1>${e.titulo}</h1>
      ${e.status === 'cancelado' ? html`<p class="erro">Este evento foi cancelado.${e.motivo_status ? ` ${e.motivo_status}` : ''}</p>` : ''}
      ${e.status === 'adiado' ? html`<p class="erro">Este evento foi adiado.${e.motivo_status ? ` ${e.motivo_status}` : ''}</p>` : ''}
      <div class="cartao">
        <p><strong>Quando:</strong> ${quando} (${e.duracao_min} min)</p>
        ${e.local_nome ? html`<p><strong>Onde:</strong> ${e.local_nome}${e.local_endereco ? html`, ${e.local_endereco}` : ''}</p>` : ''}
        ${mapa ? html`<p><a href="${mapa}" rel="noopener noreferrer">Ver no mapa</a></p>` : ''}
        ${e.capacidade !== null ? html`<p><strong>Vagas:</strong> ${e.vagas_restantes ?? 0} de ${e.capacidade}${e.vagas_restantes === 0 && e.lista_de_espera ? ' (lista de espera aberta)' : ''}</p>` : ''}
      </div>
      ${e.descricao ? html`<p>${e.descricao}</p>` : ''}
      ${
        e.informacoes_uteis
          ? html`<h2>Informações úteis</h2>
              <p>${e.informacoes_uteis}</p>`
          : ''
      }`
  }

  function formulario(
    id: string,
    e: EventoPublico,
    erro?: string,
    valores: Record<string, string> = {},
    aviso?: string,
  ): Seguro {
    if (!e.inscricoes_abertas) {
      return html`<div class="cartao">
        <p class="suave">As inscrições para este evento estão encerradas.</p>
      </div>`
    }
    if (e.vagas_restantes === 0 && !e.lista_de_espera) {
      return html`<div class="cartao"><p class="suave">As vagas acabaram.</p></div>`
    }
    return html` <h2 id="inscricao">Inscrição</h2>
      ${erro ? html`<p class="erro" role="alert">${erro}</p>` : ''}
      ${aviso ? html`<p class="ok" role="status">${aviso}</p>` : ''}
      <form method="post" action="/e/${id}/inscricao" class="cartao" novalidate>
        <label for="nome">Nome de quem vai participar</label>
        <input
          id="nome"
          name="nome"
          autocomplete="name"
          required
          maxlength="120"
          value="${valores['nome'] ?? ''}"
        />
        <label for="telefone">WhatsApp</label>
        <input
          id="telefone"
          name="telefone"
          type="tel"
          autocomplete="tel"
          inputmode="tel"
          required
          placeholder="(11) 91234-5678"
          value="${valores['telefone'] ?? ''}"
        />
        <label for="email">E-mail <span class="suave">(opcional)</span></label>
        <input
          id="email"
          name="email"
          type="email"
          autocomplete="email"
          maxlength="254"
          value="${valores['email'] ?? ''}"
        />
        <div class="isca" aria-hidden="true">
          <label for="site">Não preencha</label
          ><input id="site" name="site" tabindex="-1" autocomplete="off" />
        </div>
        <div class="caixa">
          <input id="consentimento" name="consentimento" type="checkbox" value="sim" required />
          <label for="consentimento"
            >Concordo que a ${e.comunidade_nome} use meu nome, WhatsApp e e-mail (se eu informar) só
            para organizar este evento. Sei que me inscrever num evento de igreja mostra que
            participo de uma comunidade religiosa. Meus dados são apagados ${e.retencao_dias} dias
            depois do evento. Posso cancelar e apagar antes pelo link que recebo ao me inscrever.
            <a href="/privacidade#inscricao">Saiba mais sobre a privacidade</a>.</label
          >
        </div>
        <div class="caixa">
          <input id="idade" name="idade" type="checkbox" value="sim" required />
          <label for="idade"
            >A pessoa inscrita tem 16 anos ou mais, ou eu sou o pai, a mãe ou o responsável legal
            dela e informei o meu WhatsApp como contato.</label
          >
        </div>
        ${o.chaveDoSiteTurnstile ? html`<div class="cf-turnstile" data-sitekey="${o.chaveDoSiteTurnstile}"></div>` : ''}
        <p>
          <button type="submit">
            ${e.vagas_restantes === 0 ? 'Entrar na lista de espera' : 'Confirmar inscrição'}
          </button>
        </p>
      </form>`
  }

  app.get('/publico/estilo.css', async (_p, r) =>
    r
      .header('Content-Type', 'text/css; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .send(ESTILO),
  )
  app.get('/publico/cancelar.js', async (_p, r) =>
    r.header('Content-Type', 'text/javascript; charset=utf-8').send(SCRIPT_CANCELAR),
  )

  app.get('/e/:idPublico', async (pedido, resposta) => {
    const id = idPublico.safeParse((pedido.params as { idPublico: string }).idPublico)
    if (!id.success) return naoEncontrado(resposta)
    const e = await lerEvento(id.data)
    if (!e) return naoEncontrado(resposta)
    return responder(
      resposta,
      200,
      pagina(html`${detalhes(e)}${formulario(id.data, e)}`, {
        titulo: e.titulo,
        descricao: `${dataPorExtenso(e.inicio, e.fuso)}${e.local_nome ? ` · ${e.local_nome}` : ''} · ${e.comunidade_nome}`,
        urlCanonica: urlDoEvento(id.data),
        cor: e.comunidade_cor,
        scripts: o.chaveDoSiteTurnstile
          ? ['https://challenges.cloudflare.com/turnstile/v0/api.js']
          : [],
      }),
    )
  })

  app.post('/e/:idPublico/inscricao', async (pedido, resposta) => {
    const id = idPublico.safeParse((pedido.params as { idPublico: string }).idPublico)
    if (!id.success) return naoEncontrado(resposta)
    let lido: EventoPublico | undefined
    try {
      lido = await lerEvento(id.data)
    } catch (err) {
      if (!ehFilaDoBancoEsgotada(err)) throw err
      // Sem o evento não há formulário para redesenhar: o voltar do navegador
      // devolve o que foi preenchido.
      return responder(
        resposta.header('Retry-After', '5'),
        503,
        pagina(
          html`<h1>Muita gente se inscrevendo agora</h1>
            <p>
              Espere alguns segundos e tente de novo. Se voltar pelo botão do navegador, o que você
              preencheu continua lá.
            </p>
            <p><a class="botao" href="/e/${id.data}#inscricao">Voltar ao evento</a></p>`,
          { titulo: 'Tente de novo' },
        ),
      )
    }
    if (!lido) return naoEncontrado(resposta)
    const e = lido
    const corpo = (pedido.body ?? {}) as Record<string, string | undefined>
    const valores = {
      nome: corpo['nome'] ?? '',
      telefone: corpo['telefone'] ?? '',
      email: corpo['email'] ?? '',
    }
    const comErro = (status: number, mensagem: string) =>
      responder(
        resposta,
        status,
        pagina(html`${detalhes(e)}${formulario(id.data, e, mensagem, valores)}`, {
          titulo: e.titulo,
          scripts: o.chaveDoSiteTurnstile
            ? ['https://challenges.cloudflare.com/turnstile/v0/api.js']
            : [],
        }),
      )

    const ip = truncarIp(pedido.ip)
    if (!limInscricaoIp.tentar(ip) || !limInscricaoEvento.tentar(id.data)) {
      return comErro(429, 'Muitas inscrições seguidas. Espere alguns minutos e tente de novo.')
    }
    // Campo-isca preenchido: robô. Responde como sucesso genérico e não grava nada.
    if (corpo['site']) {
      return responder(
        resposta,
        200,
        pagina(html`<h1>Recebemos sua inscrição</h1>`, { titulo: 'Inscrição' }),
      )
    }
    if (
      !(await verificarTurnstile(
        o.config.TURNSTILE_SEGREDO,
        corpo['cf-turnstile-response'],
        pedido.ip,
        o.buscar,
      ))
    ) {
      return comErro(400, 'Não conseguimos confirmar que você não é um robô. Tente de novo.')
    }
    const nome = valores.nome.trim()
    if (nome.length < 1) return comErro(400, 'Informe o nome de quem vai participar.')
    if (nome.length > 120)
      return comErro(400, 'O nome passou de 120 letras. Use uma forma mais curta.')
    const telefone = normalizarTelefone(valores.telefone)
    if (!telefone) return comErro(400, 'Informe o WhatsApp com DDD, por exemplo (11) 91234-5678.')
    const email = valores.email.trim().toLowerCase()
    if (email && !z.email().safeParse(email).success)
      return comErro(400, 'O e-mail não parece válido.')
    if (corpo['consentimento'] !== 'sim') {
      return comErro(400, 'Para se inscrever, marque a concordância com o uso dos seus dados.')
    }
    if (corpo['idade'] !== 'sim') {
      return comErro(400, 'Para se inscrever, confirme a idade ou que você é o responsável.')
    }

    const token = gerarToken()
    let r: { estado: string | null; codigo_checkin: string | null; ja_existia: boolean } | undefined
    try {
      r = (
        await o.api.query('select * from uj.inscrever_publico($1, $2, $3, $4, $5, $6, $7, $8)', [
          id.data,
          nome,
          telefone,
          email || null,
          hashDeToken(token),
          'TC-04',
          VERSAO_DO_TEXTO['TC-04'],
          true,
        ])
      ).rows[0]
    } catch (err) {
      const codigo = (err as { code?: string }).code
      if (codigo === 'UJ031') return comErro(409, 'As vagas acabaram enquanto você preenchia.')
      if (codigo === 'UJ030')
        return comErro(409, 'As inscrições para este evento estão encerradas.')
      if (ehFilaDoBancoEsgotada(err)) {
        resposta.header('Retry-After', '5')
        return comErro(503, MENSAGEM_OCUPADO)
      }
      if (codigo === 'UJ036') {
        return comErro(
          409,
          `Este WhatsApp já tem ${TETO_POR_WHATSAPP} inscrições neste evento. Para inscrever mais pessoas, fale com a organização.`,
        )
      }
      throw err
    }
    if (!r) return naoEncontrado(resposta)
    // A mesma pessoa (WhatsApp e nome) de novo: diz que ela já está inscrita,
    // sem fingir sucesso. Nada de código, QR ou estado (M2 de 0015): quem só
    // sabe o número e o nome de alguém não leva a entrada dela; o código volta
    // pelo link de cancelamento, que só quem se inscreveu recebeu.
    if (r.ja_existia || r.codigo_checkin === null) {
      return responder(
        resposta,
        409,
        pagina(
          html` <p class="suave">${e.comunidade_nome}</p>
            <h1>Esta pessoa já está inscrita neste evento</h1>
            <div class="cartao">
              <p><strong>${e.titulo}</strong><br />${dataPorExtenso(e.inicio, e.fuso)}</p>
              <p>
                <strong>${nome}</strong> já tem inscrição com este WhatsApp. Nada foi feito agora: a
                inscrição de antes continua valendo.
              </p>
              <p>
                Para ver o código de entrada de novo, use o link de cancelamento que apareceu na
                primeira inscrição e toque em "Ver meu código de entrada". Se perdeu o link, fale
                com a organização no dia.
              </p>
            </div>
            <div class="acoes">${botaoOutraPessoa(id.data, valores.telefone, email)}</div>`,
          { titulo: 'Já inscrito', cor: e.comunidade_cor },
        ),
      )
    }
    const cancelar = new URL(`/e/${id.data}/cancelar#t=${token}`, o.config.URL_PUBLICA).toString()
    const meuWhatsapp = `https://wa.me/?text=${encodeURIComponent(textoParaWhatsapp(e, r.codigo_checkin, cancelar))}`
    const compartilhar = `https://wa.me/?text=${encodeURIComponent(`${e.titulo}: ${urlDoEvento(id.data)}`)}`
    return responder(
      resposta,
      200,
      pagina(
        html` <p class="suave">${e.comunidade_nome}</p>
          <h1>
            ${r.estado === 'espera' ? 'Inscrição na lista de espera' : 'Inscrição confirmada'}
          </h1>
          <p><strong>${nome}</strong></p>
          <p class="print">Tire um print: é a entrada dessa pessoa.</p>
          ${await cartaoDoCodigo(e, r.estado, r.codigo_checkin)}
          <div class="acoes">
            <a class="botao" href="${meuWhatsapp}" rel="noopener noreferrer"
              >Mandar para o meu WhatsApp</a
            >
            ${botaoOutraPessoa(id.data, valores.telefone, email)}
          </div>
          <p>
            Para cancelar ou apagar os dados desta inscrição, use este link:
            <a href="${cancelar}">cancelar esta inscrição</a>. Ele só aparece aqui e na mensagem do
            WhatsApp.
          </p>
          <p>
            <a href="${compartilhar}" rel="noopener noreferrer">Convidar alguém pelo WhatsApp</a>
          </p>`,
        { titulo: 'Inscrição', cor: e.comunidade_cor },
      ),
    )
  })

  // "Inscrever outra pessoa": o formulário de novo, com o mesmo WhatsApp e
  // e-mail e o nome em branco. POST para o contato não ir para a URL (log,
  // histórico). Só lê o evento; quem grava é a inscrição, com os limites dela.
  app.post('/e/:idPublico/outra', async (pedido, resposta) => {
    const id = idPublico.safeParse((pedido.params as { idPublico: string }).idPublico)
    if (!id.success) return naoEncontrado(resposta)
    const e = await lerEvento(id.data)
    if (!e) return naoEncontrado(resposta)
    const corpo = (pedido.body ?? {}) as Record<string, string | undefined>
    const valores = {
      nome: '',
      telefone: String(corpo['telefone'] ?? '').slice(0, 40),
      email: String(corpo['email'] ?? '').slice(0, 254),
    }
    return responder(
      resposta,
      200,
      pagina(
        html`${detalhes(e)}${formulario(
          id.data,
          e,
          undefined,
          valores,
          'Mesmo WhatsApp da inscrição anterior. Agora preencha o nome da outra pessoa.',
        )}`,
        {
          titulo: e.titulo,
          scripts: o.chaveDoSiteTurnstile
            ? ['https://challenges.cloudflare.com/turnstile/v0/api.js']
            : [],
        },
      ),
    )
  })

  app.get('/e/:idPublico/cancelar', async (pedido, resposta) => {
    const id = idPublico.safeParse((pedido.params as { idPublico: string }).idPublico)
    if (!id.success) return naoEncontrado(resposta)
    const e = await lerEvento(id.data)
    if (!e) return naoEncontrado(resposta)
    return responder(
      resposta,
      200,
      pagina(
        html` <p class="suave">${e.comunidade_nome}</p>
          <h1>Cancelar inscrição</h1>
          <p><strong>${e.titulo}</strong>, ${dataPorExtenso(e.inicio, e.fuso)}</p>
          <p id="sem-token" class="erro" hidden>
            Abra o link completo que você recebeu ao se inscrever.
          </p>
          <noscript
            ><p class="erro">
              Para cancelar, abra este link num navegador com JavaScript ativado.
            </p></noscript
          >
          <form method="post" action="/e/${id.data}/cancelar" class="cartao">
            <input type="hidden" id="token" name="token" />
            <p>
              <button type="submit" name="acao" value="codigo">Ver meu código de entrada</button>
            </p>
            <p>Ao cancelar, sua vaga fica livre para outra pessoa.</p>
            <p>
              <button type="submit" name="acao" value="cancelar">Cancelar minha inscrição</button>
            </p>
            <p>
              Se preferir, cancele e apague agora seu nome, WhatsApp e e-mail, sem esperar o prazo
              de retenção. Depois disso este link deixa de funcionar.
            </p>
            <p>
              <button type="submit" name="acao" value="apagar">
                Cancelar e apagar meus dados agora
              </button>
            </p>
          </form>`,
        { titulo: 'Cancelar inscrição', scripts: ['/publico/cancelar.js'] },
      ),
    )
  })

  app.post('/e/:idPublico/cancelar', async (pedido: FastifyRequest, resposta) => {
    const id = idPublico.safeParse((pedido.params as { idPublico: string }).idPublico)
    if (!id.success) return naoEncontrado(resposta)
    if (!limCancelarIp.tentar(truncarIp(pedido.ip))) {
      return responder(
        resposta,
        429,
        pagina(
          html`<h1>Muitas tentativas</h1>
            <p>Espere alguns minutos.</p>`,
          { titulo: 'Cancelar' },
        ),
      )
    }
    const corpoDoPedido = (pedido.body as Record<string, unknown> | undefined) ?? {}
    const token = String(corpoDoPedido['token'] ?? '')
    const tokenValido = /^[\w-]{20,200}$/.test(token)
    // O código de entrada só volta para quem tem o link (token) da inscrição.
    if (corpoDoPedido['acao'] === 'codigo') {
      const e = await lerEvento(id.data)
      const achada = tokenValido
        ? (
            await o.api.query<{ estado: string; codigo_checkin: string }>(
              'select * from uj.codigo_da_inscricao_publica($1, $2)',
              [id.data, hashDeToken(token)],
            )
          ).rows[0]
        : undefined
      if (!e || !achada) {
        return responder(
          resposta,
          404,
          pagina(
            html`<h1>Não encontramos esta inscrição</h1>
              <p class="suave">Ela pode já ter sido cancelada ou apagada.</p>`,
            { titulo: 'Inscrição' },
          ),
        )
      }
      return responder(
        resposta,
        200,
        pagina(
          html` <p class="suave">${e.comunidade_nome}</p>
            <h1>
              ${achada.estado === 'espera' ? 'Você está na lista de espera' : 'Inscrição confirmada'}
            </h1>
            ${await cartaoDoCodigo(e, achada.estado, achada.codigo_checkin)}`,
          { titulo: 'Inscrição', cor: e.comunidade_cor },
        ),
      )
    }
    const apagar = corpoDoPedido['acao'] === 'apagar'
    const funcao = apagar ? 'uj.apagar_inscricao_publica' : 'uj.cancelar_inscricao_publica'
    const ok =
      tokenValido &&
      (
        await o.api.query<{ ok: boolean }>(`select ${funcao}($1, $2) as ok`, [
          id.data,
          hashDeToken(token),
        ])
      ).rows[0]?.ok === true
    return responder(
      resposta,
      ok ? 200 : 404,
      pagina(
        ok
          ? apagar
            ? html`<h1>Inscrição cancelada e dados apagados</h1>
                <p>Apagamos seu nome, WhatsApp e e-mail desta inscrição. Obrigado por avisar.</p>`
            : html`<h1>Inscrição cancelada</h1>
                <p>Obrigado por avisar. A vaga ficou livre para outra pessoa.</p>
                <p class="suave">
                  Seus dados serão apagados no prazo informado. Para apagar agora, abra o mesmo link
                  de novo e escolha "Cancelar e apagar meus dados agora".
                </p>`
          : html`<h1>Não encontramos esta inscrição</h1>
              <p class="suave">Ela pode já ter sido cancelada ou apagada.</p>`,
        { titulo: 'Cancelar inscrição' },
      ),
    )
  })
}
