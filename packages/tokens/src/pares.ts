import { CAMADA_DE_TOQUE_DO_ACESSO, MARCA_DO_GOOGLE_ESCURO } from './acesso.ts'
import { corDaAuroraNoPonto, PONTOS_CRITICOS_DA_AURORA } from './aurora.ts'
import { comporCamadas, MINIMO } from './contraste.ts'
import {
  CORES_DA_COMUNIDADE,
  INICIAIS_SOBRE_COR,
  MARCA_DA_APPLE,
  MARCA_DO_GOOGLE,
  TEMAS,
  VIDRO,
  type NomeDoTema,
} from './cores.ts'

/**
 * Um par da tabela de contraste (seção 2.11). As camadas vão de baixo para
 * cima, a primeira opaca; cada camada é um token da paleta base (`texto`), da
 * inversa (`inverso.fundo`) ou uma cor pronta (`#...`, `rgba(...)`). A frente
 * também pode ser translúcida (contorno): é composta sobre o resultado.
 */
export interface DefinicaoDePar {
  nome: string
  frente: string
  sobre: readonly string[]
  tipo: keyof typeof MINIMO
}

export interface ParMedido {
  nome: string
  frente: string
  fundo: string
  minimo: number
}

function camadasDoTema(tema: NomeDoTema): readonly DefinicaoDePar[] {
  const barra = VIDRO.barra[tema].fundo
  // Android e web sem desfoque: o vidro vira a cor opaca do token (ui/Vidro.tsx).
  const barraOpaca = VIDRO.barra[tema].opaco
  const status = corDaAuroraNoPonto('coral', PONTOS_CRITICOS_DA_AURORA.status, tema)
  const sobACoral = corDaAuroraNoPonto('coral', PONTOS_CRITICOS_DA_AURORA.conteudoSobACoral, tema)
  const sobAVioleta = corDaAuroraNoPonto(
    'violeta',
    PONTOS_CRITICOS_DA_AURORA.conteudoSobAVioleta,
    tema,
  )
  const pares: DefinicaoDePar[] = [
    // Texto sobre o fundo, a superfície, a elevada e o campo.
    { nome: 'texto sobre fundo', frente: 'texto', sobre: ['fundo'], tipo: 'texto' },
    { nome: 'textoSuave sobre fundo', frente: 'textoSuave', sobre: ['fundo'], tipo: 'texto' },
    { nome: 'destaque sobre fundo', frente: 'destaque', sobre: ['fundo'], tipo: 'texto' },
    { nome: 'sucesso sobre fundo', frente: 'sucesso', sobre: ['fundo'], tipo: 'texto' },
    { nome: 'alerta sobre fundo', frente: 'alerta', sobre: ['fundo'], tipo: 'texto' },
    { nome: 'erro sobre fundo', frente: 'erro', sobre: ['fundo'], tipo: 'texto' },
    { nome: 'texto sobre superficie', frente: 'texto', sobre: ['superficie'], tipo: 'texto' },
    {
      nome: 'textoSuave sobre superficie',
      frente: 'textoSuave',
      sobre: ['superficie'],
      tipo: 'texto',
    },
    { nome: 'destaque sobre superficie', frente: 'destaque', sobre: ['superficie'], tipo: 'texto' },
    { nome: 'sucesso sobre superficie', frente: 'sucesso', sobre: ['superficie'], tipo: 'texto' },
    { nome: 'alerta sobre superficie', frente: 'alerta', sobre: ['superficie'], tipo: 'texto' },
    { nome: 'erro sobre superficie', frente: 'erro', sobre: ['superficie'], tipo: 'texto' },
    { nome: 'info sobre superficie', frente: 'info', sobre: ['superficie'], tipo: 'texto' },
    {
      nome: 'texto sobre superficieElevada',
      frente: 'texto',
      sobre: ['superficieElevada'],
      tipo: 'texto',
    },
    {
      nome: 'textoSuave sobre superficieElevada',
      frente: 'textoSuave',
      sobre: ['superficieElevada'],
      tipo: 'texto',
    },
    {
      nome: 'destaque sobre superficieElevada',
      frente: 'destaque',
      sobre: ['superficieElevada'],
      tipo: 'texto',
    },
    { nome: 'texto sobre campoFundo', frente: 'texto', sobre: ['campoFundo'], tipo: 'texto' },
    {
      nome: 'textoSuave (exemplo) sobre campoFundo',
      frente: 'textoSuave',
      sobre: ['campoFundo'],
      tipo: 'texto',
    },
    // Botões cheios.
    {
      nome: 'sobrePrimaria sobre primaria',
      frente: 'sobrePrimaria',
      sobre: ['primaria'],
      tipo: 'texto',
    },
    {
      nome: 'sobrePrimaria sobre primariaPressionada',
      frente: 'sobrePrimaria',
      sobre: ['primariaPressionada'],
      tipo: 'texto',
    },
    { nome: 'sobreErro sobre erroCheio', frente: 'sobreErro', sobre: ['erroCheio'], tipo: 'texto' },
    // Toque: o texto continua legível sobre a camada de pressionado.
    {
      nome: 'texto sobre pressionado na superficie',
      frente: 'texto',
      sobre: ['superficie', 'pressionado'],
      tipo: 'texto',
    },
    {
      nome: 'destaque sobre quenteFundo (terciário pressionado)',
      frente: 'destaque',
      sobre: ['superficie', 'quenteFundo'],
      tipo: 'texto',
    },
    {
      nome: 'erro sobre erroFundo (destrutivo pressionado)',
      frente: 'erro',
      sobre: ['superficie', 'erroFundo'],
      tipo: 'texto',
    },
    // Chips (texto sobre o fundo tonal composto sobre a superfície e sobre o fundo).
    {
      nome: 'chip sucesso',
      frente: 'sucesso',
      sobre: ['superficie', 'sucessoFundo'],
      tipo: 'texto',
    },
    { nome: 'chip alerta', frente: 'alerta', sobre: ['superficie', 'alertaFundo'], tipo: 'texto' },
    { nome: 'chip erro', frente: 'erro', sobre: ['superficie', 'erroFundo'], tipo: 'texto' },
    { nome: 'chip info', frente: 'info', sobre: ['superficie', 'infoFundo'], tipo: 'texto' },
    {
      nome: 'chip quente',
      frente: 'destaque',
      sobre: ['superficie', 'quenteFundo'],
      tipo: 'texto',
    },
    {
      nome: 'chip neutro',
      frente: 'textoSuave',
      sobre: ['superficie', 'neutroFundo'],
      tipo: 'texto',
    },
    {
      nome: 'chip sucesso sobre o fundo',
      frente: 'sucesso',
      sobre: ['fundo', 'sucessoFundo'],
      tipo: 'texto',
    },
    {
      nome: 'chip quente sobre o fundo',
      frente: 'destaque',
      sobre: ['fundo', 'quenteFundo'],
      tipo: 'texto',
    },
    // Avisos: título e texto em `texto` sobre o fundo do tipo.
    { nome: 'aviso info', frente: 'texto', sobre: ['superficie', 'infoFundo'], tipo: 'texto' },
    {
      nome: 'aviso sucesso',
      frente: 'texto',
      sobre: ['superficie', 'sucessoFundo'],
      tipo: 'texto',
    },
    { nome: 'aviso alerta', frente: 'texto', sobre: ['fundo', 'alertaFundo'], tipo: 'texto' },
    { nome: 'aviso erro', frente: 'texto', sobre: ['fundo', 'erroFundo'], tipo: 'texto' },
    // Inverso (cartão de destaque e toast).
    { nome: 'inverso: texto', frente: 'inverso.texto', sobre: ['inverso.fundo'], tipo: 'texto' },
    {
      nome: 'inverso: textoSuave',
      frente: 'inverso.textoSuave',
      sobre: ['inverso.fundo'],
      tipo: 'texto',
    },
    {
      nome: 'inverso: destaque',
      frente: 'inverso.destaque',
      sobre: ['inverso.fundo'],
      tipo: 'texto',
    },
    {
      nome: 'inverso: chip quente',
      frente: 'inverso.destaque',
      sobre: ['inverso.fundo', 'inverso.quenteFundo'],
      tipo: 'texto',
    },
    {
      nome: 'inverso: botão primário',
      frente: 'inverso.sobrePrimaria',
      sobre: ['inverso.primaria'],
      tipo: 'texto',
    },
    // Pílula e barra de abas.
    {
      nome: 'pílula: texto sobre tonal',
      frente: 'texto',
      sobre: ['fundo', 'tonal'],
      tipo: 'texto',
    },
    {
      nome: 'pílula de filtro inativa',
      frente: 'textoSuave',
      sobre: ['fundo'],
      tipo: 'texto',
    },
    {
      nome: 'aba inativa sobre a barra',
      frente: 'textoSuave',
      sobre: ['fundo', barra],
      tipo: 'texto',
    },
    {
      nome: 'aba inativa com o destaque por baixo',
      frente: 'textoSuave',
      sobre: ['inverso.fundo', barra],
      tipo: 'texto',
    },
    {
      nome: 'aba ativa sobre a pílula',
      frente: 'destaque',
      sobre: ['fundo', barra, 'abaAtivaFundo'],
      tipo: 'texto',
    },
    {
      nome: 'aba ativa com o destaque por baixo',
      frente: 'destaque',
      sobre: ['inverso.fundo', barra, 'abaAtivaFundo'],
      tipo: 'texto',
    },
    {
      nome: 'aba inativa sobre a barra opaca',
      frente: 'textoSuave',
      sobre: [barraOpaca],
      tipo: 'texto',
    },
    {
      nome: 'aba ativa sobre a pílula da barra opaca',
      frente: 'destaque',
      sobre: [barraOpaca, 'abaAtivaFundo'],
      tipo: 'texto',
    },
    {
      nome: 'texto sobre a barra opaca',
      frente: 'texto',
      sobre: [barraOpaca],
      tipo: 'texto',
    },
    // Aurora: status e conteúdo sobre o pior ponto (geometria ajustada, área segura de referência).
    {
      nome: 'status sobre o pior ponto da Aurora',
      frente: 'textoSuave',
      sobre: ['fundo', status],
      tipo: 'texto',
    },
    { nome: 'título sobre a coral', frente: 'texto', sobre: ['fundo', sobACoral], tipo: 'texto' },
    {
      nome: 'sobrancelha fora de cartão sobre a violeta',
      frente: 'destaque',
      sobre: ['fundo', sobAVioleta],
      tipo: 'texto',
    },
    {
      nome: 'meta fora de cartão sobre a violeta',
      frente: 'textoSuave',
      sobre: ['fundo', sobAVioleta],
      tipo: 'texto',
    },
    // Interface (3:1).
    {
      nome: 'interface: primaria contra fundo',
      frente: 'primaria',
      sobre: ['fundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: primaria contra superficie',
      frente: 'primaria',
      sobre: ['superficie'],
      tipo: 'interface',
    },
    {
      nome: 'interface: campoBorda contra superficie',
      frente: 'campoBorda',
      sobre: ['superficie'],
      tipo: 'interface',
    },
    {
      nome: 'interface: campoBorda contra campoFundo',
      frente: 'campoBorda',
      sobre: ['campoFundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: campoBorda contra fundo',
      frente: 'campoBorda',
      sobre: ['fundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: contorno contra superficie',
      frente: 'contorno',
      sobre: ['superficie'],
      tipo: 'interface',
    },
    {
      nome: 'interface: contorno contra fundo',
      frente: 'contorno',
      sobre: ['fundo'],
      tipo: 'interface',
    },
    { nome: 'interface: foco contra fundo', frente: 'foco', sobre: ['fundo'], tipo: 'interface' },
    {
      nome: 'interface: foco contra superficie',
      frente: 'foco',
      sobre: ['superficie'],
      tipo: 'interface',
    },
    {
      nome: 'interface: foco contra campoFundo',
      frente: 'foco',
      sobre: ['campoFundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: foco contra o inverso',
      frente: 'inverso.foco',
      sobre: ['inverso.fundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: erro (borda do campo) contra campoFundo',
      frente: 'erro',
      sobre: ['campoFundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: check de sincronizado sobre a Aurora',
      frente: 'sucesso',
      sobre: ['fundo', status],
      tipo: 'interface',
    },
    {
      nome: 'interface: ícone de erro sobre erroFundo',
      frente: 'erro',
      sobre: ['fundo', 'erroFundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: ícone de info sobre infoFundo',
      frente: 'info',
      sobre: ['fundo', 'infoFundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: ícone de sucesso no inverso (toast)',
      frente: 'inverso.sucesso',
      sobre: ['inverso.fundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: ícone de erro no inverso (toast)',
      frente: 'inverso.erro',
      sobre: ['inverso.fundo'],
      tipo: 'interface',
    },
    {
      nome: 'interface: ladrilho (destaque sobre tonal)',
      frente: 'destaque',
      sobre: ['superficie', 'tonal'],
      tipo: 'interface',
    },
    // Tela de acesso (D63): botões de marca, estados e textos sobre o pior ponto da Aurora.
    ...paresDoAcesso(tema, sobAVioleta),
    // Iniciais brancas sobre as cores de comunidade.
    ...CORES_DA_COMUNIDADE.map((c) => ({
      nome: `iniciais sobre ${c.rotulo}`,
      frente: INICIAIS_SOBRE_COR,
      sobre: [c.valor],
      tipo: 'texto' as const,
    })),
  ]
  if (tema === 'escuro') {
    // D32: cartão translúcido (branco a 7%, sem desfoque) medido sobre os dois brilhos.
    for (const [onde, aurora] of [
      ['violeta', sobAVioleta],
      ['coral', sobACoral],
    ] as const) {
      for (const frente of ['texto', 'textoSuave', 'destaque', 'sucesso', 'alerta']) {
        pares.push({
          nome: `cartão translúcido sobre a ${onde}: ${frente}`,
          frente,
          sobre: ['fundo', aurora, 'superficieTranslucida'],
          tipo: 'texto',
        })
      }
      for (const frente of ['primaria', 'foco']) {
        pares.push({
          nome: `cartão translúcido sobre a ${onde}: ${frente} (interface)`,
          frente,
          sobre: ['fundo', aurora, 'superficieTranslucida'],
          tipo: 'interface',
        })
      }
    }
  }
  return pares
}

/**
 * Pares da tela de acesso (Entrar, Criar conta e convite). Os botões de marca
 * têm cores fixas: a Apple troca com o tema, o Google escuro só é o secundário
 * do tema escuro, e o Google claro é o secundário do claro e o primário do
 * Android. O texto vai a 4,5:1; o botão e o contorno contra o fundo, a 3:1.
 */
function paresDoAcesso(tema: NomeDoTema, sobAVioleta: string): DefinicaoDePar[] {
  const apple = tema === 'escuro' ? MARCA_DA_APPLE.escuro : MARCA_DA_APPLE.claro
  const camadaDaApple =
    tema === 'escuro' ? CAMADA_DE_TOQUE_DO_ACESSO.appleEscuro : CAMADA_DE_TOQUE_DO_ACESSO.appleClaro
  const pares: DefinicaoDePar[] = [
    {
      nome: 'acesso: Apple, texto sobre o botão',
      frente: apple.texto,
      sobre: [apple.fundo],
      tipo: 'texto',
    },
    {
      nome: 'acesso: Apple pressionado, texto sobre o botão',
      frente: apple.texto,
      sobre: [apple.fundo, camadaDaApple],
      tipo: 'texto',
    },
    {
      nome: 'acesso: Apple, botão contra o fundo da tela',
      frente: apple.fundo,
      sobre: ['fundo'],
      tipo: 'interface',
    },
    {
      nome: 'acesso: Google claro, texto sobre o botão',
      frente: MARCA_DO_GOOGLE.texto,
      sobre: [MARCA_DO_GOOGLE.fundo],
      tipo: 'texto',
    },
    {
      nome: 'acesso: Google claro pressionado, texto sobre o botão',
      frente: MARCA_DO_GOOGLE.texto,
      sobre: [MARCA_DO_GOOGLE.fundo, CAMADA_DE_TOQUE_DO_ACESSO.googleClaro],
      tipo: 'texto',
    },
    {
      nome: 'acesso: Google claro, contorno contra o fundo da tela',
      frente: MARCA_DO_GOOGLE.borda,
      sobre: ['fundo'],
      tipo: 'interface',
    },
    {
      nome: 'acesso: ícone de erro sobre o pico do violeta',
      frente: 'erro',
      sobre: ['fundo', sobAVioleta],
      tipo: 'interface',
    },
    {
      nome: 'acesso: texto do erro sobre o pico do violeta',
      frente: 'texto',
      sobre: ['fundo', sobAVioleta],
      tipo: 'texto',
    },
    {
      nome: 'acesso: texto do Entrar (coral) pressionado',
      frente: 'sobrePrimaria',
      sobre: ['primariaPressionada'],
      tipo: 'texto',
    },
  ]
  if (tema === 'escuro') {
    pares.push(
      {
        // No Android o Google claro é o primário: no escuro, o fundo branco já separa o botão.
        nome: 'acesso: Google claro, botão contra o fundo da tela (primário)',
        frente: MARCA_DO_GOOGLE.fundo,
        sobre: ['fundo'],
        tipo: 'interface',
      },
      {
        nome: 'acesso: Google escuro, texto sobre o botão',
        frente: MARCA_DO_GOOGLE_ESCURO.texto,
        sobre: [MARCA_DO_GOOGLE_ESCURO.fundo],
        tipo: 'texto',
      },
      {
        nome: 'acesso: Google escuro pressionado, texto sobre o botão',
        frente: MARCA_DO_GOOGLE_ESCURO.texto,
        sobre: [MARCA_DO_GOOGLE_ESCURO.fundo, CAMADA_DE_TOQUE_DO_ACESSO.googleEscuro],
        tipo: 'texto',
      },
      {
        nome: 'acesso: Google escuro, contorno contra o fundo da tela',
        frente: MARCA_DO_GOOGLE_ESCURO.borda,
        sobre: ['fundo'],
        tipo: 'interface',
      },
    )
  }
  return pares
}

/** Resolve um nome de camada para a cor do tema. */
function resolver(tema: NomeDoTema, camada: string): string {
  if (camada.startsWith('#') || camada.startsWith('rgba')) return camada
  const { base, inverso } = TEMAS[tema]
  const [paleta, chave] = camada.startsWith('inverso.')
    ? [inverso, camada.slice('inverso.'.length)]
    : [base, camada]
  const cor = (paleta as unknown as Record<string, string | undefined>)[chave]
  if (!cor) throw new Error(`token inexistente: ${camada}`)
  return cor
}

/** Os pares de 2.11 de um tema, já compostos (frente e fundo opacos). */
export function paresObrigatorios(tema: NomeDoTema): ParMedido[] {
  return camadasDoTema(tema).map((par) => {
    const fundo = comporCamadas(par.sobre.map((c) => resolver(tema, c)))
    const frente = comporCamadas([fundo, resolver(tema, par.frente)])
    return { nome: par.nome, frente, fundo, minimo: MINIMO[par.tipo] }
  })
}

/**
 * Componentes dentro do cartão translúcido que têm fundo próprio (chip, aviso,
 * botão secundário, caixa de marcar) compõem esse fundo sobre a superfície
 * opaca: no pico da Aurora, os pares deles (erro e info, contorno) cairiam
 * abaixo do mínimo. Este é o motivo, medido, da regra.
 */
export const PARES_QUE_EXIGEM_FUNDO_OPACO = [
  'chip erro',
  'chip info',
  'interface: contorno contra superficie',
  'erro sobre superficie',
  'info sobre superficie',
] as const
