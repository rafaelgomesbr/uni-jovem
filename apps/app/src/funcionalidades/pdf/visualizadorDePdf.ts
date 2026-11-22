import { abrirPdfNoSistema } from './abrirPdf'

/**
 * O visualizador de PDF atrás de uma interface (D76): em produção, o do sistema (`abrirPdf.ts`,
 * Quick Look no iOS, intenção de visualização no Android, aba nova na web). Os testes entregam um
 * dublê com `trocarVisualizadorDePdf`.
 */
export interface VisualizadorDePdf {
  /** `aberto`: o visualizador foi apresentado. `baixado`: só na web, quando o navegador barrou a aba. */
  abrir(bytes: Uint8Array, nome: string): Promise<'aberto' | 'baixado'>
}

let atual: VisualizadorDePdf = { abrir: abrirPdfNoSistema }

export const visualizadorDePdf: VisualizadorDePdf = {
  abrir: (bytes, nome) => atual.abrir(bytes, nome),
}

/** Só para testes: troca o visualizador (sem argumento, volta ao do sistema). */
export function trocarVisualizadorDePdf(novo?: VisualizadorDePdf): void {
  atual = novo ?? { abrir: abrirPdfNoSistema }
}
