import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { Aviso } from '@/ui/Aviso'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { useAnunciar } from '@/ui/useAnunciar'

interface PropsDoErroAoCarregar {
  erro: unknown
  /** Completa "Não deu para carregar ..." ("a agenda", "as suas escalas"). */
  oQue: string
  aoTentarDeNovo: () => void
}

/**
 * Erro de tela inteira (2.12.23): um estado vazio com o ícone de erro e o
 * primário "Tentar de novo", anunciado ao leitor de tela. Sem internet é
 * alerta, não erro: o título diz isso em vez de "Não deu".
 *
 * Fica aqui enquanto o `AvisoDeErro` antigo não é substituído em `src/ui`.
 */
export function ErroAoCarregar({ erro, oQue, aoTentarDeNovo }: PropsDoErroAoCarregar) {
  const semConexao = erro instanceof SemConexao
  const titulo = semConexao ? 'Sem conexão' : `Não deu para carregar ${oQue}`
  const descricao = mensagemDoErro(erro)
  useAnunciar(`${titulo}. ${descricao}`)
  return (
    <EstadoVazio
      icone={semConexao ? 'semConexao' : 'erro'}
      titulo={titulo}
      descricao={descricao}
      acao={{ titulo: 'Tentar de novo', aoPressionar: aoTentarDeNovo }}
    />
  )
}

interface PropsDoAvisoDeFalha {
  erro: unknown
  titulo?: string
  aoTentarDeNovo?: () => void
}

/**
 * Falha de uma ação (confirmar, salvar, assumir) ou de um bloco da tela: o
 * Aviso de erro com a mensagem humana e, quando dá, o terciário "Tentar de
 * novo". Erro que pede ação não vai em toast (2.12.24).
 */
export function AvisoDeFalha({ erro, titulo, aoTentarDeNovo }: PropsDoAvisoDeFalha) {
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
      {mensagemDoErro(erro)}
    </Aviso>
  )
}
