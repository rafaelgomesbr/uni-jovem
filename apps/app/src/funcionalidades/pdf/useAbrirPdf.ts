import { useState } from 'react'

import { chamadasDoPdf, type ResumoDoPdf } from '@/servicos/contratoDoPdf'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'

import { useOffline } from '../offline/ProvedorOffline'
import { MENSAGEM_PDF_SEM_INTERNET, obterPdf } from './obterPdf'
import { visualizadorDePdf } from './visualizadorDePdf'

export type EstadoDoAbrirPdf =
  | { fase: 'parado' }
  | { fase: 'abrindo' }
  | { fase: 'erro'; mensagem: string; semInternet: boolean }
  | {
      fase: 'aberto'
      origem: 'aparelho' | 'rede'
      /** Sem internet, abriu uma cópia mais antiga que a versão atual. */
      desatualizado: boolean
      /** Web: o navegador barrou a aba nova e o arquivo foi baixado. */
      baixado: boolean
    }

/**
 * Abrir o PDF de uma música (D76): a cópia guardada no aparelho, se for a versão certa (abre sem
 * internet), ou o download pela API (conferindo o ETag), e então o visualizador do sistema. O
 * estado conta o que aconteceu em palavras para a tela: nada de bytes nem de nome em log.
 */
export function useAbrirPdf({
  comunidadeId,
  musicaId,
  pdf,
}: {
  comunidadeId: string | null
  musicaId: string
  pdf: ResumoDoPdf
}) {
  const offline = useOffline()
  const [estado, setEstado] = useState<EstadoDoAbrirPdf>({ fase: 'parado' })

  async function abrir(): Promise<void> {
    if (!comunidadeId) return
    setEstado({ fase: 'abrindo' })
    try {
      const obtido = await obterPdf(musicaId, pdf, {
        lerLocal: (m, versao) => offline.lerPdf(m, versao),
        baixar: (m, versaoConhecida) => chamadasDoPdf.baixar(comunidadeId, m, versaoConhecida),
      })
      const como = await visualizadorDePdf.abrir(obtido.bytes, pdf.nome)
      setEstado({
        fase: 'aberto',
        origem: obtido.origem,
        desatualizado: obtido.desatualizado,
        baixado: como === 'baixado',
      })
    } catch (erro) {
      const mensagem = mensagemDoErro(erro)
      setEstado({
        fase: 'erro',
        mensagem,
        semInternet: erro instanceof SemConexao || mensagem === MENSAGEM_PDF_SEM_INTERNET,
      })
    }
  }

  return { estado, abrir }
}
