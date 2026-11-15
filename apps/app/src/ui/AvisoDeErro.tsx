import { mensagemDoErro, SemConexao } from '@/servicos/erros'

import { Aviso } from './Aviso'

interface PropsDoAviso {
  /** Erro de qualquer origem; a mensagem humana vem de `mensagemDoErro`. */
  erro?: unknown
  mensagem?: string
  titulo?: string
  aoTentarDeNovo?: () => void
}

/**
 * Aviso de erro: o `Aviso` do tipo erro (ou alerta, sem conexão) com a
 * mensagem humana e, quando dá, o terciário "Tentar de novo". Anunciado ao
 * leitor de tela (o papel `alert` não fala no iOS).
 */
export function AvisoDeErro({ erro, mensagem, titulo, aoTentarDeNovo }: PropsDoAviso) {
  const semConexao = erro instanceof SemConexao
  const texto = mensagem ?? mensagemDoErro(erro)
  return (
    <Aviso
      tipo={semConexao ? 'alerta' : 'erro'}
      titulo={titulo ?? (semConexao ? 'Sem conexão' : 'Não deu certo')}
      anunciar
      {...(aoTentarDeNovo
        ? { acao: { titulo: 'Tentar de novo', aoPressionar: aoTentarDeNovo } }
        : {})}
    >
      {texto}
    </Aviso>
  )
}
