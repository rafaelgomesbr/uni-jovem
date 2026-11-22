import { ELEVACAO, type Paleta } from '@uj/tokens'

import { comOpacidade } from './cor'
import type { Tema } from './tema'

/**
 * Hierarquia (seção 2.12.1, D64): `primario` (no máximo um visível por tela ou
 * por cartão de destaque), `secundario` (tonal, sem borda), `terciario` (só
 * texto), `destrutivo` (tonal vermelho) e `destrutivoCheio` (a confirmação final).
 */
export type VarianteDoBotao =
  'primario' | 'secundario' | 'terciario' | 'destrutivo' | 'destrutivoCheio'

export interface AparenciaDoBotao {
  /** `backgroundColor`: no primário é o sólido que vale quando o degradê não é desenhado. */
  fundo: string
  /** `backgroundImage`: o degradê vertical do primário (`null` nas demais variantes). */
  degrade: string | null
  /** Cor da camada de "pressionado": uma `View` que só muda de opacidade (`''` sem camada). */
  camadaDeToque: string
  /** Cor da camada com o ponteiro em cima (web); `''` sem camada. */
  camadaDeHover: string
  texto: string
  borda: string | null
  /** Espessura da borda (1; 2 com "Aumentar contraste"). */
  larguraDaBorda: number
  /** `boxShadow` do repouso: realce interno e brilho. Sai no pressionado e no inativo. */
  sombra: string | null
}

/** Preferências de acessibilidade que mudam o desenho do botão. */
export interface PreferenciasDoBotao {
  aumentarContraste?: boolean
  reduzirTransparencia?: boolean
}

type TemaDoBotao = Pick<Tema, 'cores' | 'semFundo' | 'solido' | 'escuro'>

/** O degradê vertical de 8% de luminosidade: topo mais claro, base na cor do botão. */
export function degradeDoPrimario(cores: Paleta): string {
  return `linear-gradient(180deg, ${cores.primariaTopo}, ${cores.primariaBase})`
}

/** Brilho coral embaixo e realce de 1 pt em cima do primário (as cores em vigor decidem o par). */
export function sombraDoPrimario(escuro: boolean): string {
  const e = ELEVACAO[escuro ? 'escuro' : 'claro']
  return `${e.realceDoBotao}, ${e.botao}`
}

/**
 * Cores de cada variante em cada estado (tabela de 3.1 de `docs/design/controles-v2.md`).
 * Sem `opacity`: tudo é cor. Desabilitado não vira cinza: o primário continua coral
 * apagado, para ainda ler como "a ação principal, ainda não".
 */
export function aparenciaDoBotao(
  variante: VarianteDoBotao,
  inativo: boolean,
  { cores, solido, escuro }: TemaDoBotao,
  marcado = false,
  { aumentarContraste = false, reduzirTransparencia = false }: PreferenciasDoBotao = {},
): AparenciaDoBotao {
  const comContorno = (a: Omit<AparenciaDoBotao, 'larguraDaBorda'>): AparenciaDoBotao => {
    // Aumentar contraste: sem degradê nem sombra; borda de 2 na cor do texto nos que têm fundo.
    if (aumentarContraste && variante !== 'terciario') {
      return {
        ...a,
        degrade: null,
        sombra: null,
        borda: cores.texto,
        larguraDaBorda: 2,
      }
    }
    return { ...a, larguraDaBorda: a.borda ? 1 : 0 }
  }
  const semCamadas = { camadaDeToque: '', camadaDeHover: '' }

  if (inativo) {
    switch (variante) {
      case 'primario':
        return comContorno({
          fundo: solido(cores.quenteFundo),
          degrade: null,
          ...semCamadas,
          texto: comOpacidade(cores.destaque, 0.7),
          borda: null,
          sombra: null,
        })
      case 'destrutivoCheio':
        return comContorno({
          fundo: solido(cores.erroFundo),
          degrade: null,
          ...semCamadas,
          texto: comOpacidade(cores.erro, 0.7),
          borda: null,
          sombra: null,
        })
      case 'terciario':
        return comContorno({
          fundo: 'transparent',
          degrade: null,
          ...semCamadas,
          texto: comOpacidade(cores.destaque, 0.5),
          borda: null,
          sombra: null,
        })
      case 'secundario':
      case 'destrutivo':
        return comContorno({
          fundo: reduzirTransparencia ? cores.botaoTonalOpaco : solido(cores.tonal),
          degrade: null,
          ...semCamadas,
          texto: comOpacidade(cores.textoSuave, 0.7),
          borda: null,
          sombra: null,
        })
    }
  }

  switch (variante) {
    case 'primario':
      return comContorno({
        fundo: cores.primaria,
        degrade: degradeDoPrimario(cores),
        // Pressionado: sólido `primariaPressionada` por cima do degradê, sem sombra.
        camadaDeToque: cores.primariaPressionada,
        camadaDeHover: escuro ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        texto: cores.sobrePrimaria,
        borda: null,
        sombra: sombraDoPrimario(escuro),
      })
    case 'secundario':
      if (marcado) {
        // Alternável marcado ("Estou orando"): fundo quente, texto e borda em destaque (o check vem do ícone).
        return comContorno({
          fundo: solido(cores.quenteFundo),
          degrade: null,
          camadaDeToque: solido(cores.quenteFundo),
          camadaDeHover: comOpacidade(cores.quenteFundo, 0.5),
          texto: cores.destaque,
          borda: cores.destaque,
          sombra: null,
        })
      }
      return comContorno({
        fundo: reduzirTransparencia ? cores.botaoTonalOpaco : solido(cores.botaoTonal),
        degrade: null,
        camadaDeToque: cores.botaoTonalPressionado,
        camadaDeHover: cores.botaoTonalPressionado,
        texto: cores.texto,
        borda: null,
        sombra: null,
      })
    case 'terciario':
      return comContorno({
        fundo: 'transparent',
        degrade: null,
        camadaDeToque: solido(cores.quenteFundo),
        camadaDeHover: comOpacidade(cores.quenteFundo, 0.5),
        texto: cores.destaque,
        borda: null,
        sombra: null,
      })
    case 'destrutivo':
      return comContorno({
        fundo: solido(cores.erroFundo),
        degrade: null,
        // Escurece de leve em vez de clarear: o texto `erro` só ganha contraste.
        camadaDeToque: escuro ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)',
        camadaDeHover: escuro ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)',
        texto: cores.erro,
        borda: null,
        sombra: null,
      })
    case 'destrutivoCheio':
      return comContorno({
        fundo: cores.erroCheio,
        degrade: null,
        camadaDeToque: 'rgba(0,0,0,0.08)',
        camadaDeHover: 'rgba(0,0,0,0.04)',
        texto: cores.sobreErro,
        borda: null,
        sombra: null,
      })
  }
}
