import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { EstadoVazio } from '@/ui/EstadoVazio'

interface PropsDaFalha {
  /** Erro de qualquer origem; a mensagem humana vem de `mensagemDoErro`. */
  erro?: unknown
  /** Texto próprio, no lugar da mensagem do erro. */
  mensagem?: string
  titulo?: string
  aoTentarDeNovo?: () => void
}

/**
 * Aviso de falha (seção 2.12.23): erro de uma ação ou de um bloco da tela,
 * com título específico, a mensagem em linguagem humana e, quando dá, o
 * terciário "Tentar de novo". Sem conexão vira alerta. Sempre anunciado.
 */
export function AvisoDeFalha({ erro, mensagem, titulo, aoTentarDeNovo }: PropsDaFalha) {
  const semConexao = erro instanceof SemConexao
  return (
    <Aviso
      tipo={semConexao ? 'alerta' : 'erro'}
      titulo={titulo ?? (semConexao ? 'Sem conexão' : 'Não deu certo')}
      anunciar
      {...(aoTentarDeNovo
        ? { acao: { titulo: 'Tentar de novo', aoPressionar: aoTentarDeNovo } }
        : {})}
    >
      {mensagem ?? mensagemDoErro(erro)}
    </Aviso>
  )
}

/**
 * Erro de tela inteira (2.12.23): um estado vazio com o ícone de erro e o
 * primário "Tentar de novo", no lugar do conteúdo que não carregou.
 */
export function ErroDaTela({
  erro,
  titulo,
  aoTentarDeNovo,
}: {
  erro: unknown
  titulo?: string
  aoTentarDeNovo: () => void
}) {
  const semConexao = erro instanceof SemConexao
  return (
    <EstadoVazio
      icone={semConexao ? 'semConexao' : 'erro'}
      titulo={titulo ?? (semConexao ? 'Sem conexão' : 'Não deu para abrir')}
      descricao={mensagemDoErro(erro)}
      acao={{ titulo: 'Tentar de novo', icone: 'sincronizar', aoPressionar: aoTentarDeNovo }}
    />
  )
}
