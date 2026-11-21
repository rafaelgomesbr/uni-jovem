import {
  ALTURA_DO_ACESSO,
  ALTURA_DO_ACESSO_TERCIARIO,
  ALTURA_DO_LINK_DO_RODAPE,
  ESPACO,
  LADO_DO_SOL,
  RITMO_DE_ACESSO,
  TIPO,
} from '@uj/tokens'

/**
 * Medidas da tela de acesso (D63), numa função pura: é com ela que o teste
 * prova "cabe sem rolar" nos tamanhos de aparelho e que a tela escolhe o lado
 * do sol, se mostra o apoio e se a rolagem de segurança liga. O layout em si é
 * de flexbox (as duas folgas pesam 2 e 3); aqui estão os números do desenho.
 */

export interface EntradaDasMedidas {
  /** Altura da janela e área segura de cima e de baixo, em pt. */
  altura: number
  topo: number
  base: number
  /** Escala da fonte do sistema (1 = padrão). */
  fonte: number
  /** Quantos acessos (2 sem a Apple, 3 com ela) e se o último é só texto (terciário). */
  acessos: 2 | 3
  /** O terceiro acesso (e-mail no iOS) é só texto de 48; senão todos têm 56. */
  terciario: boolean
  temSelo: boolean
  temConvite: boolean
  temBiometria: boolean
}

export interface MedidasDoAcesso {
  /** Lado do sol escolhido (112, 96, 88, 72 ou 56). */
  sol: number
  mostraApoio: boolean
  /** A rolagem de segurança liga (fonte acima de 1,6 ou altura que não comporta nem o mínimo). */
  rola: boolean
  /** Altura do palco (sol, nome e apoio com os intervalos) e dos acessos (selo ao rodapé). */
  alturaDoPalco: number
  alturaDosAcessos: number
  /** O que sobra para as duas folgas (e o respiro de cima e de baixo, 40% e 60%). */
  sobra: number
  respiroDeCima: number
  respiroDeBaixo: number
}

/** Quanto uma linha de `altura` cresce com a fonte do sistema (o papel tem teto). */
function crescer(altura: number, fonte: number, teto: number | null): number {
  const f = teto ? Math.min(fonte, teto) : fonte
  return Math.ceil(altura * Math.max(1, f))
}

const ALTURA_DO_SELO = 18

function alturaDosAcessos(e: EntradaDasMedidas): number {
  const botao = Math.max(
    ALTURA_DO_ACESSO,
    crescer(TIPO.botao.altura, e.fonte, TIPO.botao.teto) + ESPACO.e16,
  )
  const terciario = Math.max(
    ALTURA_DO_ACESSO_TERCIARIO,
    crescer(TIPO.botao.altura, e.fonte, TIPO.botao.teto) + ESPACO.e16,
  )
  const cheios = e.terciario ? e.acessos - 1 : e.acessos
  const botoes =
    botao * cheios +
    (e.terciario ? terciario : 0) +
    RITMO_DE_ACESSO.entreAcessos * (e.acessos - 1 + (e.temBiometria ? 1 : 0)) +
    (e.temBiometria ? botao : 0)
  const selo = e.temSelo ? ALTURA_DO_SELO + RITMO_DE_ACESSO.seloParaBotao : 0
  const rodape =
    RITMO_DE_ACESSO.acessosParaRodape +
    Math.max(
      ALTURA_DO_ACESSO_TERCIARIO,
      crescer(TIPO.meta.altura, e.fonte, TIPO.meta.teto) + ESPACO.e16,
    ) +
    Math.max(
      ALTURA_DO_LINK_DO_RODAPE,
      crescer(TIPO.meta.altura, e.fonte, TIPO.meta.teto) + ESPACO.e16,
    )
  return selo + botoes + rodape + ESPACO.e12 + e.base
}

function alturaDoPalco(sol: number, mostraApoio: boolean, fonte: number): number {
  const entreSolETitulo =
    sol > LADO_DO_SOL.medio ? RITMO_DE_ACESSO.solGrandeParaTitulo : RITMO_DE_ACESSO.solParaTitulo
  const nome = crescer(TIPO.tituloTela.altura, fonte, TIPO.tituloTela.teto)
  // O apoio tem 2 linhas de 22 no padrão e 3 a partir de 1,2.
  const linhas = fonte >= 1.2 ? 3 : 2
  const apoio = mostraApoio ? crescer(TIPO.corpo.altura * linhas, fonte, TIPO.corpo.teto) : 0
  return sol + entreSolETitulo + nome + (mostraApoio ? RITMO_DE_ACESSO.tituloParaApoio + apoio : 0)
}

/**
 * Escolhe o lado do sol e o que cabe. Escada (2.2): o sol cresce enquanto
 * sobra espaço (112 com 176 ou mais; 96 com 136 ou mais); se a sobra é menor
 * que 16, o sol vai a 72, depois o apoio some, e só então liga a rolagem. Com
 * fonte de 1,2 a 1,6 o sol vai a 56 e o apoio some; acima de 1,6 rola.
 */
export function calcularMedidasDoAcesso(e: EntradaDasMedidas): MedidasDoAcesso {
  const convite = e.temConvite ? RITMO_DE_ACESSO.apoioParaConvite + ALTURA_DO_ACESSO : 0
  const acessos = alturaDosAcessos(e)
  const livre = e.altura - e.topo - acessos - convite

  let sol: number = LADO_DO_SOL.base
  let mostraApoio = e.fonte < 1.2
  if (e.fonte >= 1.2) sol = LADO_DO_SOL.minimo
  else {
    const sobraComBase = livre - alturaDoPalco(LADO_DO_SOL.base, true, e.fonte)
    if (sobraComBase >= 176) sol = LADO_DO_SOL.grande
    else if (sobraComBase >= 136) sol = LADO_DO_SOL.medio
    else if (sobraComBase < RITMO_DE_ACESSO.respiroMinimo) {
      sol = LADO_DO_SOL.compacto
      if (livre - alturaDoPalco(sol, true, e.fonte) < RITMO_DE_ACESSO.respiroMinimo) {
        mostraApoio = false
        sol = LADO_DO_SOL.minimo
      }
    }
  }

  const palco = alturaDoPalco(sol, mostraApoio, e.fonte)
  const sobra = livre - palco
  const respiroDeCima = Math.max(
    0,
    Math.floor((Math.max(0, sobra) * RITMO_DE_ACESSO.fatorDoRespiroDeCima) / ESPACO.e8) * ESPACO.e8,
  )
  const respiroDeBaixo = Math.max(0, sobra - respiroDeCima)
  return {
    sol,
    mostraApoio,
    rola: e.fonte > 1.6 || sobra < 0,
    alturaDoPalco: palco,
    alturaDosAcessos: acessos + convite,
    sobra,
    respiroDeCima,
    respiroDeBaixo,
  }
}

/** Entrada das medidas do painel de e-mail. */
export interface EntradaDoPainel {
  altura: number
  topo: number
  /** Altura estimada do teclado (260 no SE, 336 no iPhone grande, 300 no Android, 0 na web). */
  teclado: number
  fonte: number
}

export interface MedidasDoPainel {
  ritmo: 'confortavel' | 'compacto'
  /** O título "Entrar com e-mail" some (teclado muito alto): o painel sobe e nunca rola. */
  tituloVisivel: boolean
  /** Do fim do botão até o topo do teclado; negativo = a rolagem de segurança liga. */
  sobraAcimaDoTeclado: number
  rola: boolean
}

/** Linha do rótulo (20) mais campo (56) mais a fenda de erro (26) com o intervalo de 8. */
const BLOCO_DO_CAMPO = 20 + ESPACO.e8 + ALTURA_DO_ACESSO + RITMO_DE_ACESSO.fendaDeErro

/**
 * Painel de e-mail com o teclado aberto (2.4). O painel é ancorado no topo e o
 * teclado só cobre o que está abaixo: se o título para o primeiro campo de 24
 * deixa pelo menos 16 de sobra, o ritmo é confortável; senão, compacto (12).
 */
export function calcularMedidasDoPainel({
  altura,
  topo,
  teclado,
  fonte,
}: EntradaDoPainel): MedidasDoPainel {
  const livre = altura - topo - teclado
  const voltar = 44
  const titulo = crescer(TIPO.tituloTela.altura, fonte, TIPO.tituloTela.teto)
  const base = ESPACO.e8 + voltar + titulo + BLOCO_DO_CAMPO * 2 + ALTURA_DO_ACESSO
  const confortavel = livre - (base + RITMO_DE_ACESSO.tituloParaCampoConfortavel)
  const ritmo = confortavel >= RITMO_DE_ACESSO.respiroMinimo ? 'confortavel' : 'compacto'
  const intervalo =
    ritmo === 'confortavel'
      ? RITMO_DE_ACESSO.tituloParaCampoConfortavel
      : RITMO_DE_ACESSO.tituloParaCampoCompacto
  // Teclado muito alto (menos de 372 livres): o título some e o painel sobe 32.
  const tituloVisivel = livre >= 372
  const sobra = livre - (base + intervalo) + (tituloVisivel ? 0 : titulo + ESPACO.e32)
  return {
    ritmo,
    tituloVisivel,
    sobraAcimaDoTeclado: sobra,
    rola: sobra < 0 || fonte > 1.6,
  }
}
