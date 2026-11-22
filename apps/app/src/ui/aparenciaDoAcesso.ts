import {
  ALTURA_DO_ACESSO,
  ALTURA_DO_ACESSO_TERCIARIO,
  CAMADA_DE_TOQUE_DO_ACESSO,
  MARCA_DA_APPLE,
  MARCA_DO_GOOGLE,
  MARCA_DO_GOOGLE_ESCURO,
  type Paleta,
} from '@uj/tokens'

import { aparenciaDoBotao } from './aparenciaDoBotao'

/**
 * Os botões de acesso (D63). `marca` decide o logotipo e, na Apple e no Google,
 * as cores fixas da marca; `nivel` decide o peso:
 * - `primario`: o caminho provável, o único preenchimento forte por estado;
 * - `secundario`: o outro caminho de um toque, mesma altura e largura, tonal
 *   e sem borda (nunca outra laje branca); o Google mantém o contorno da marca;
 * - `terciario`: o caminho de mais passos, só texto.
 * O coral cheio (`primaria`) é do "avançar" (Entrar, Continuar) e de quem
 * volta (método usado da última vez, Face ID).
 */
export type MarcaDoAcesso = 'apple' | 'google' | 'email' | 'biometria' | 'acao'
export type NivelDoAcesso = 'primario' | 'secundario' | 'terciario'
export type LogoDoAcesso = 'apple' | 'google' | 'email' | 'faceId' | null

export interface AparenciaDoAcesso {
  fundo: string
  texto: string
  /** Contorno de 1 pt por dentro; `null` sem contorno. */
  borda: string | null
  /** Camada de "pressionado": uma `View` que só muda de opacidade. */
  camada: string
  altura: number
  logo: LogoDoAcesso
  /** O botão branco do Google no claro ganha a sombra de cartão. */
  sombra: boolean
  /** Degradê do primário de e-mail, Face ID e ação (D64); `null` nos demais. */
  degrade: string | null
  /** Realce e brilho do primário (`boxShadow`); `null` nos demais. */
  brilho: string | null
}

const LOGO: Record<MarcaDoAcesso, LogoDoAcesso> = {
  apple: 'apple',
  google: 'google',
  email: 'email',
  biometria: 'faceId',
  acao: null,
}

interface Entrada {
  marca: MarcaDoAcesso
  nivel: NivelDoAcesso
  cores: Paleta
  escuro: boolean
}

/** Cores e medidas de cada botão (função pura: o teste confere a tabela 3.1 do desenho). */
export function aparenciaDoAcesso({ marca, nivel, cores, escuro }: Entrada): AparenciaDoAcesso {
  const logo = LOGO[marca]

  if (marca === 'apple') {
    const a = escuro ? MARCA_DA_APPLE.escuro : MARCA_DA_APPLE.claro
    return {
      fundo: a.fundo,
      texto: a.texto,
      borda: null,
      camada: escuro ? CAMADA_DE_TOQUE_DO_ACESSO.appleEscuro : CAMADA_DE_TOQUE_DO_ACESSO.appleClaro,
      altura: ALTURA_DO_ACESSO,
      logo,
      sombra: false,
      degrade: null,
      brilho: null,
    }
  }

  if (marca === 'google') {
    // Primário: branco com contorno (tema claro da marca), nos dois temas. Secundário: o tema
    // escuro da marca no escuro; no claro, o claro de novo, que já é contorno e não laje.
    const escuroDaMarca = nivel !== 'primario' && escuro
    if (escuroDaMarca) {
      const g = MARCA_DO_GOOGLE_ESCURO
      return {
        fundo: g.fundo,
        texto: g.texto,
        borda: g.borda,
        camada: CAMADA_DE_TOQUE_DO_ACESSO.googleEscuro,
        altura: ALTURA_DO_ACESSO,
        logo,
        sombra: false,
        degrade: null,
        brilho: null,
      }
    }
    const g = MARCA_DO_GOOGLE
    return {
      fundo: g.fundo,
      texto: g.texto,
      borda: g.borda,
      camada: CAMADA_DE_TOQUE_DO_ACESSO.googleClaro,
      altura: ALTURA_DO_ACESSO,
      logo,
      sombra: !escuro,
      degrade: null,
      brilho: null,
    }
  }

  // E-mail, Face ID e botões de ação: a tabela única do `Botao` (D64).
  const variante =
    nivel === 'primario' ? 'primario' : nivel === 'secundario' ? 'secundario' : 'terciario'
  const a = aparenciaDoBotao(variante, false, {
    cores,
    escuro,
    solido: (cor) => cor,
    semFundo: 'transparent',
  })
  return {
    fundo: a.fundo,
    texto: a.texto,
    borda: null,
    camada: a.camadaDeToque,
    altura: nivel === 'terciario' ? ALTURA_DO_ACESSO_TERCIARIO : ALTURA_DO_ACESSO,
    logo,
    sombra: false,
    degrade: a.degrade,
    brilho: a.sombra,
  }
}
