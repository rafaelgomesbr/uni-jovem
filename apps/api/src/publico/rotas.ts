import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import QRCode from 'qrcode'
import { z } from 'zod'
import { gerarToken, hashDeToken } from '../autenticacao/cripto.ts'
import { Limitador, truncarIp } from '../autenticacao/limitador.ts'
import type { Config } from '../config.ts'
import { CSP_PUBLICA, ESTILO, Seguro, SCRIPT_CANCELAR, html, pagina } from './html.ts'
import { dataPorExtenso, normalizarTelefone, verificarTurnstile } from './apoio.ts'

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
  ): Seguro {
    if (!e.inscricoes_abertas) {
      return html`<div class="cartao">
        <p class="suave">As inscrições para este evento estão encerradas.</p>
      </div>`
    }
    if (e.vagas_restantes === 0 && !e.lista_de_espera) {
      return html`<div class="cartao"><p class="suave">As vagas acabaram.</p></div>`
    }
    return html` <h2>Inscrição</h2>
      ${erro ? html`<p class="erro" role="alert">${erro}</p>` : ''}
      <form method="post" action="/e/${id}/inscricao" class="cartao" novalidate>
        <label for="nome">Seu nome</label>
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
            >Concordo que ${e.comunidade_nome} use meu nome e WhatsApp só para organizar este
            evento. Os dados ficam guardados por tempo limitado e depois são apagados.
            <a href="/privacidade">Saiba mais</a>.</label
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
    const e = await lerEvento(id.data)
    if (!e) return naoEncontrado(resposta)
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
    if (nome.length < 1 || nome.length > 120) return comErro(400, 'Informe o seu nome.')
    const telefone = normalizarTelefone(valores.telefone)
    if (!telefone) return comErro(400, 'Informe o WhatsApp com DDD, por exemplo (11) 91234-5678.')
    const email = valores.email.trim().toLowerCase()
    if (email && !z.email().safeParse(email).success)
      return comErro(400, 'O e-mail não parece válido.')
    if (corpo['consentimento'] !== 'sim') {
      return comErro(400, 'Para se inscrever, marque a concordância com o uso dos seus dados.')
    }

    const token = gerarToken()
    let r: { estado: string; codigo_checkin: string; ja_existia: boolean } | undefined
    try {
      r = (
        await o.api.query('select * from uj.inscrever_publico($1, $2, $3, $4, $5)', [
          id.data,
          nome,
          telefone,
          email || null,
          hashDeToken(token),
        ])
      ).rows[0]
    } catch (err) {
      const codigo = (err as { code?: string }).code
      if (codigo === 'UJ031') return comErro(409, 'As vagas acabaram enquanto você preenchia.')
      if (codigo === 'UJ030')
        return comErro(409, 'As inscrições para este evento estão encerradas.')
      throw err
    }
    if (!r) return naoEncontrado(resposta)
    const qr = await QRCode.toString(r.codigo_checkin, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
    })
    const cancelar = new URL(`/e/${id.data}/cancelar#t=${token}`, o.config.URL_PUBLICA).toString()
    const compartilhar = `https://wa.me/?text=${encodeURIComponent(`${e.titulo}: ${urlDoEvento(id.data)}`)}`
    return responder(
      resposta,
      200,
      pagina(
        html` <p class="suave">${e.comunidade_nome}</p>
          <h1>
            ${r.estado === 'espera' ? 'Você está na lista de espera' : 'Inscrição confirmada'}
          </h1>
          ${r.ja_existia ? html`<p class="suave">Este WhatsApp já estava inscrito; mantivemos a inscrição anterior.</p>` : ''}
          <div class="cartao">
            <p><strong>${e.titulo}</strong><br />${dataPorExtenso(e.inicio, e.fuso)}</p>
            ${r.estado === 'espera' ? html`<p>Se abrir uma vaga, sua inscrição passa a confirmada automaticamente.</p>` : ''}
            <p>Na entrada, mostre este código:</p>
            <div class="qr" role="img" aria-label="Código de entrada ${r.codigo_checkin}">
              ${new Seguro(qr)}
            </div>
            <p>Código: <strong>${r.codigo_checkin}</strong></p>
          </div>
          ${r.ja_existia ? '' : html`<p>Guarde este link para cancelar, se precisar: <a href="${cancelar}">cancelar minha inscrição</a>. Ele não aparece de novo.</p>`}
          <p>
            <a class="botao" href="${compartilhar}" rel="noopener noreferrer"
              >Convidar alguém pelo WhatsApp</a
            >
          </p>`,
        { titulo: 'Inscrição', cor: e.comunidade_cor },
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
            <p>Ao cancelar, sua vaga fica livre para outra pessoa.</p>
            <button type="submit">Cancelar minha inscrição</button>
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
    const token = String((pedido.body as Record<string, unknown> | undefined)?.['token'] ?? '')
    const ok =
      /^[\w-]{20,200}$/.test(token) &&
      (
        await o.api.query<{ ok: boolean }>('select uj.cancelar_inscricao_publica($1, $2) as ok', [
          id.data,
          hashDeToken(token),
        ])
      ).rows[0]?.ok === true
    return responder(
      resposta,
      ok ? 200 : 404,
      pagina(
        ok
          ? html`<h1>Inscrição cancelada</h1>
              <p>Obrigado por avisar. A vaga ficou livre para outra pessoa.</p>`
          : html`<h1>Não encontramos esta inscrição</h1>
              <p class="suave">Ela pode já ter sido cancelada.</p>`,
        { titulo: 'Cancelar inscrição' },
      ),
    )
  })
}
